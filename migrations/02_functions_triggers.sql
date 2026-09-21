-- 02_functions_triggers.sql

-- 1. ADD AUDIT COLUMNS
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS record_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS new_data JSONB;

-- 2. AUDIT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- We try to get auth.uid() if called via Supabase PostgREST
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (action_type, actor_id, table_name, old_data)
    VALUES (TG_OP, v_user_id, TG_TABLE_NAME::TEXT, row_to_json(OLD)::JSONB);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (action_type, actor_id, table_name, old_data, new_data)
    VALUES (TG_OP, v_user_id, TG_TABLE_NAME::TEXT, row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (action_type, actor_id, table_name, new_data)
    VALUES (TG_OP, v_user_id, TG_TABLE_NAME::TEXT, row_to_json(NEW)::JSONB);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to key tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['items', 'departments', 'stock_count_cycles', 'stock_count_lines', 'item_recipes', 'department_thresholds', 'purchase_orders', 'purchase_order_items', 'goods_receipts', 'requisitions', 'requisition_items', 'department_inventory']) LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger ON ' || t;
    EXECUTE 'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ' || t || ' FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()';
  END LOOP;
END $$;


-- 3. RPC: RECEIVE GOODS (Weighted Average Costing)
CREATE OR REPLACE FUNCTION receive_goods_rpc(p_item_id UUID, p_quantity NUMERIC, p_unit_cost NUMERIC, p_supplier_id UUID, p_receipt_url TEXT)
RETURNS VOID AS $$
DECLARE
  v_old_qty NUMERIC;
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
BEGIN
  -- Lock item row
  SELECT quantity_in_store, unit_cost INTO v_old_qty, v_old_cost
  FROM items WHERE id = p_item_id FOR UPDATE;

  -- Calculate weighted average cost
  IF (v_old_qty + p_quantity) > 0 THEN
    v_new_cost := ((v_old_qty * v_old_cost) + (p_quantity * p_unit_cost)) / (v_old_qty + p_quantity);
  ELSE
    v_new_cost := p_unit_cost;
  END IF;

  -- Update items table
  UPDATE items
  SET quantity_in_store = quantity_in_store + p_quantity,
      unit_cost = v_new_cost
  WHERE id = p_item_id;

  -- Insert receipt
  INSERT INTO goods_receipts (item_id, quantity_received, received_by, unit_cost, receipt_url)
  VALUES (p_item_id, p_quantity, auth.uid(), p_unit_cost, p_receipt_url);

  -- Insert price history
  INSERT INTO purchase_price_history (item_id, supplier_id, unit_cost, quantity)
  VALUES (p_item_id, p_supplier_id, p_unit_cost, p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: DISPATCH REQUISITION
CREATE OR REPLACE FUNCTION dispatch_requisition_rpc(p_req_id UUID, p_dispatches JSONB)
-- p_dispatches format: [{"req_item_id": "uuid", "qty": 10}, ...]
RETURNS VOID AS $$
DECLARE
  v_dept_id UUID;
  d JSONB;
  v_item_id UUID;
  v_qty NUMERIC;
BEGIN
  -- Lock the requisition
  SELECT department_id INTO v_dept_id FROM requisitions WHERE id = p_req_id FOR UPDATE;
  
  -- Update requisition status
  UPDATE requisitions SET status = 'Dispatched' WHERE id = p_req_id;

  -- Process each dispatch
  FOR d IN SELECT * FROM jsonb_array_elements(p_dispatches)
  LOOP
    v_qty := (d->>'qty')::NUMERIC;
    IF v_qty > 0 THEN
      -- Get item_id
      SELECT item_id INTO v_item_id FROM requisition_items WHERE id = (d->>'req_item_id')::UUID;
      
      -- Update req item
      UPDATE requisition_items SET quantity_dispatched = v_qty WHERE id = (d->>'req_item_id')::UUID;
      
      -- Deduct from central store
      UPDATE items SET quantity_in_store = quantity_in_store - v_qty WHERE id = v_item_id;
      
      -- Add to department inventory
      INSERT INTO department_inventory (department_id, item_id, quantity)
      VALUES (v_dept_id, v_item_id, v_qty)
      ON CONFLICT (department_id, item_id) 
      DO UPDATE SET quantity = department_inventory.quantity + EXCLUDED.quantity, last_updated = NOW();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC: PROCESS SALES ENTRY
CREATE OR REPLACE FUNCTION process_sales_entry_rpc(p_department_id UUID, p_sales JSONB)
-- p_sales format: [{"item_id": "uuid", "qty": 5}, ...]
RETURNS VOID AS $$
DECLARE
  s JSONB;
  v_sold_item_id UUID;
  v_sold_qty NUMERIC;
  v_recipe RECORD;
  v_has_recipe BOOLEAN;
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(p_sales)
  LOOP
    v_sold_item_id := (s->>'item_id')::UUID;
    v_sold_qty := (s->>'qty')::NUMERIC;
    
    -- Insert into sales_entries
    INSERT INTO sales_entries (department_id, item_id, quantity_sold, entered_by)
    VALUES (p_department_id, v_sold_item_id, v_sold_qty, auth.uid());

    -- Deduct from department inventory based on recipes
    v_has_recipe := false;
    FOR v_recipe IN SELECT component_item_id, quantity FROM item_recipes WHERE parent_item_id = v_sold_item_id
    LOOP
      v_has_recipe := true;
      INSERT INTO department_inventory (department_id, item_id, quantity)
      VALUES (p_department_id, v_recipe.component_item_id, -(v_sold_qty * v_recipe.quantity))
      ON CONFLICT (department_id, item_id) 
      DO UPDATE SET quantity = department_inventory.quantity - (v_sold_qty * v_recipe.quantity), last_updated = NOW();
    END LOOP;

    -- If no recipe exists, try to deduct the item itself (direct sales)
    IF NOT v_has_recipe THEN
      INSERT INTO department_inventory (department_id, item_id, quantity)
      VALUES (p_department_id, v_sold_item_id, -v_sold_qty)
      ON CONFLICT (department_id, item_id) 
      DO UPDATE SET quantity = department_inventory.quantity - v_sold_qty, last_updated = NOW();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. VIEW: THEORETICAL vs ACTUAL USAGE & EXPECTED CLOSING
-- This view helps generate the numbers for the weekly stock count.
CREATE OR REPLACE VIEW vw_department_stock_movement AS
SELECT 
  d.id as department_id,
  i.id as item_id,
  -- Opening Qty comes from the last approved stock count cycle
  COALESCE((
    SELECT scl.counted_qty 
    FROM stock_count_lines scl 
    JOIN stock_count_cycles scc ON scl.cycle_id = scc.id
    WHERE scc.department_id = d.id AND scl.item_id = i.id AND scc.status = 'approved'
    ORDER BY scc.end_date DESC LIMIT 1
  ), 0) as opening_qty,
  
  -- Current actual quantity in inventory
  COALESCE((
    SELECT quantity FROM department_inventory di WHERE di.department_id = d.id AND di.item_id = i.id
  ), 0) as current_qty
  
FROM departments d
CROSS JOIN items i
WHERE i.is_consumable = true;
