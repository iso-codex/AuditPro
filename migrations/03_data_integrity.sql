-- 03_data_integrity.sql

-- 1. ADD CONSTRAINTS TO PREVENT NEGATIVE STOCK AND PRICES
ALTER TABLE department_inventory ADD CONSTRAINT check_qty_non_negative CHECK (quantity >= 0);
ALTER TABLE items ADD CONSTRAINT check_qty_non_negative CHECK (quantity_in_store >= 0);
ALTER TABLE items ADD CONSTRAINT check_unit_cost_non_negative CHECK (unit_cost >= 0);
ALTER TABLE sales_entries ADD CONSTRAINT check_quantity_sold_not_zero CHECK (quantity_sold != 0);

-- 2. STOCK LEDGER (Append-Only)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id), -- NULL means central store
    item_id UUID REFERENCES items(id) NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'receipt', 'transfer_in', 'transfer_out', 'wastage', 'adjustment', 'count_variance', 'void')),
    quantity_changed NUMERIC NOT NULL,
    user_id UUID REFERENCES profiles(id),
    reference_id UUID, -- ID of the sale, receipt, requisition, etc.
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can insert movements" ON stock_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "All authenticated can read movements" ON stock_movements FOR SELECT USING (auth.role() = 'authenticated');

-- 3. IDEMPOTENCY FOR SALES
-- Add transaction grouping and idempotency to sales
CREATE TABLE sales_transactions (
    id UUID PRIMARY KEY, -- Client-generated UUID for idempotency
    department_id UUID REFERENCES departments(id) NOT NULL,
    entered_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'voided'))
);

ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert transactions" ON sales_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can view transactions" ON sales_transactions FOR SELECT USING (auth.role() = 'authenticated');

-- Link entries to transaction
ALTER TABLE sales_entries ADD COLUMN transaction_id UUID REFERENCES sales_transactions(id);

-- 4. REWRITE RPCs FOR ATOMICITY AND LEDGER INTEGRATION

-- 4a. RECEIVE GOODS RPC
CREATE OR REPLACE FUNCTION receive_goods_rpc(p_item_id UUID, p_quantity NUMERIC, p_unit_cost NUMERIC, p_supplier_id UUID, p_receipt_url TEXT)
RETURNS VOID AS $$
DECLARE
  v_old_qty NUMERIC;
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
  v_receipt_id UUID;
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

  -- Update items table (Check constraint will ensure it doesn't go below 0, though not possible for receipt unless qty is negative)
  UPDATE items
  SET quantity_in_store = quantity_in_store + p_quantity,
      unit_cost = v_new_cost
  WHERE id = p_item_id;

  -- Insert receipt
  INSERT INTO goods_receipts (item_id, quantity_received, received_by, unit_cost, receipt_url)
  VALUES (p_item_id, p_quantity, auth.uid(), p_unit_cost, p_receipt_url)
  RETURNING id INTO v_receipt_id;

  -- Insert price history
  INSERT INTO purchase_price_history (item_id, supplier_id, unit_cost, quantity)
  VALUES (p_item_id, p_supplier_id, p_unit_cost, p_quantity);

  -- Log in ledger (Central Store)
  INSERT INTO stock_movements (department_id, item_id, movement_type, quantity_changed, user_id, reference_id)
  VALUES (NULL, p_item_id, 'receipt', p_quantity, auth.uid(), v_receipt_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4b. DISPATCH REQUISITION RPC
CREATE OR REPLACE FUNCTION dispatch_requisition_rpc(p_req_id UUID, p_dispatches JSONB)
RETURNS VOID AS $$
DECLARE
  v_dept_id UUID;
  d JSONB;
  v_item_id UUID;
  v_qty NUMERIC;
BEGIN
  -- Lock the requisition
  SELECT department_id INTO v_dept_id FROM requisitions WHERE id = p_req_id FOR UPDATE;
  
  UPDATE requisitions SET status = 'Dispatched' WHERE id = p_req_id;

  FOR d IN SELECT * FROM jsonb_array_elements(p_dispatches)
  LOOP
    v_qty := (d->>'qty')::NUMERIC;
    IF v_qty > 0 THEN
      SELECT item_id INTO v_item_id FROM requisition_items WHERE id = (d->>'req_item_id')::UUID;
      
      -- 1. Deduct from Central Store
      -- The CHECK constraint on items will automatically fail the transaction if quantity_in_store < 0
      UPDATE items SET quantity_in_store = quantity_in_store - v_qty WHERE id = v_item_id;
      
      -- Ledger for Central Store Out
      INSERT INTO stock_movements (department_id, item_id, movement_type, quantity_changed, user_id, reference_id)
      VALUES (NULL, v_item_id, 'transfer_out', -v_qty, auth.uid(), p_req_id);

      -- 2. Add to Department
      INSERT INTO department_inventory (department_id, item_id, quantity)
      VALUES (v_dept_id, v_item_id, v_qty)
      ON CONFLICT (department_id, item_id) 
      DO UPDATE SET quantity = department_inventory.quantity + EXCLUDED.quantity, last_updated = NOW();

      -- Ledger for Department In
      INSERT INTO stock_movements (department_id, item_id, movement_type, quantity_changed, user_id, reference_id)
      VALUES (v_dept_id, v_item_id, 'transfer_in', v_qty, auth.uid(), p_req_id);

      -- Update Requisition Line
      UPDATE requisition_items SET quantity_dispatched = v_qty WHERE id = (d->>'req_item_id')::UUID;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4c. PROCESS SALES ENTRY RPC (Idempotent and Atomic)
CREATE OR REPLACE FUNCTION process_sales_entry_rpc(p_client_uuid UUID, p_department_id UUID, p_sales JSONB)
RETURNS VOID AS $$
DECLARE
  s JSONB;
  v_sold_item_id UUID;
  v_sold_qty NUMERIC;
  v_recipe RECORD;
  v_has_recipe BOOLEAN;
  v_entry_id UUID;
BEGIN
  -- Idempotency check: try to insert the transaction. If UUID exists, it will throw a unique violation,
  -- effectively rejecting the duplicate transaction without affecting data.
  INSERT INTO sales_transactions (id, department_id, entered_by)
  VALUES (p_client_uuid, p_department_id, auth.uid());

  FOR s IN SELECT * FROM jsonb_array_elements(p_sales)
  LOOP
    v_sold_item_id := (s->>'item_id')::UUID;
    v_sold_qty := (s->>'qty')::NUMERIC;
    
    INSERT INTO sales_entries (department_id, item_id, quantity_sold, entered_by, transaction_id)
    VALUES (p_department_id, v_sold_item_id, v_sold_qty, auth.uid(), p_client_uuid)
    RETURNING id INTO v_entry_id;

    v_has_recipe := false;
    FOR v_recipe IN SELECT component_item_id, quantity FROM item_recipes WHERE parent_item_id = v_sold_item_id
    LOOP
      v_has_recipe := true;
      -- Update inventory (CHECK constraint will fail if goes negative, meaning transaction aborts)
      UPDATE department_inventory 
      SET quantity = quantity - (v_sold_qty * v_recipe.quantity), last_updated = NOW()
      WHERE department_id = p_department_id AND item_id = v_recipe.component_item_id;

      IF NOT FOUND THEN
          -- This means the department doesn't even have a row for this item yet.
          -- Inserting a negative amount will immediately fail the CHECK constraint, rolling back.
          INSERT INTO department_inventory (department_id, item_id, quantity)
          VALUES (p_department_id, v_recipe.component_item_id, -(v_sold_qty * v_recipe.quantity));
      END IF;

      -- Log movement
      INSERT INTO stock_movements (department_id, item_id, movement_type, quantity_changed, user_id, reference_id)
      VALUES (p_department_id, v_recipe.component_item_id, 'sale', -(v_sold_qty * v_recipe.quantity), auth.uid(), v_entry_id);
    END LOOP;

    IF NOT v_has_recipe THEN
      UPDATE department_inventory 
      SET quantity = quantity - v_sold_qty, last_updated = NOW()
      WHERE department_id = p_department_id AND item_id = v_sold_item_id;

      IF NOT FOUND THEN
          INSERT INTO department_inventory (department_id, item_id, quantity)
          VALUES (p_department_id, v_sold_item_id, -v_sold_qty);
      END IF;

      INSERT INTO stock_movements (department_id, item_id, movement_type, quantity_changed, user_id, reference_id)
      VALUES (p_department_id, v_sold_item_id, 'sale', -v_sold_qty, auth.uid(), v_entry_id);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
