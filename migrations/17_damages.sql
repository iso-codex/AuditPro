-- 17_damages.sql

-- 1. Ensure stock_movements allows 'damage' movement_type
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
  CHECK (movement_type = ANY (ARRAY['sale'::text, 'receipt'::text, 'transfer_in'::text, 'transfer_out'::text, 'wastage'::text, 'adjustment'::text, 'count_variance'::text, 'void'::text, 'damage'::text]));

-- 2. Create Damages Register Table
CREATE TABLE IF NOT EXISTS damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0 AND quantity = FLOOR(quantity)),
  location_type TEXT NOT NULL CHECK (location_type IN ('store', 'department')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Before production', 'After production')),
  reason TEXT NOT NULL,
  receipt_url TEXT NOT NULL,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT damages_dept_check CHECK (
    (location_type = 'store' AND department_id IS NULL) OR
    (location_type = 'department' AND department_id IS NOT NULL)
  )
);

-- Index for queries and reports
CREATE INDEX IF NOT EXISTS idx_damages_recorded_at ON damages(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_damages_dept_item ON damages(department_id, item_id);
CREATE INDEX IF NOT EXISTS idx_damages_stage ON damages(stage);

-- 3. Row Level Security for damages
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read damages" ON damages;
CREATE POLICY "Authenticated users can read damages"
ON damages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authorized users can insert damages" ON damages;
CREATE POLICY "Authorized users can insert damages"
ON damages FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) IN ('store_manager', 'store', 'department_staff', 'manager', 'admin')
);

-- 4. Atomic Stock Write-Off RPC Function
CREATE OR REPLACE FUNCTION record_damage_rpc(
  p_item_id UUID,
  p_quantity NUMERIC,
  p_location_type TEXT,
  p_department_id UUID DEFAULT NULL,
  p_stage TEXT DEFAULT 'Before production',
  p_reason TEXT DEFAULT '',
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item_name TEXT;
  v_current_stock NUMERIC;
  v_damage_id UUID;
  v_unit_cost NUMERIC;
  v_total_loss NUMERIC;
  v_dept_name TEXT := 'Central Store';
BEGIN
  -- Strict validation: portions only
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity != FLOOR(p_quantity) THEN
    RAISE EXCEPTION 'Damage quantity must be a positive whole number in portions only (got %).', p_quantity;
  END IF;

  -- Strict validation: receipt is mandatory
  IF p_receipt_url IS NULL OR trim(p_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt or photo evidence is strictly required for writing off damages.';
  END IF;

  -- Strict validation: stage
  IF p_stage NOT IN ('Before production', 'After production') THEN
    RAISE EXCEPTION 'Invalid damage stage. Must be either "Before production" or "After production".';
  END IF;

  -- Strict validation: location
  IF p_location_type = 'store' THEN
    p_department_id := NULL;
    v_dept_name := 'Central Store';
  ELSIF p_location_type = 'department' THEN
    IF p_department_id IS NULL THEN
      RAISE EXCEPTION 'A valid department must be specified for department damages.';
    END IF;
    SELECT name INTO v_dept_name FROM departments WHERE id = p_department_id;
  ELSE
    RAISE EXCEPTION 'Invalid location type. Must be "store" or "department".';
  END IF;

  -- Lock item row
  SELECT name, unit_cost, quantity_in_store INTO v_item_name, v_unit_cost, v_current_stock
  FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found (ID: %).', p_item_id;
  END IF;

  v_total_loss := p_quantity * COALESCE(v_unit_cost, 0);

  -- Stock check & atomic deduction
  IF p_location_type = 'store' THEN
    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock in central store. Available: %, Requested write-off: %', v_current_stock, p_quantity;
    END IF;

    UPDATE items
    SET quantity_in_store = quantity_in_store - p_quantity
    WHERE id = p_item_id;

    INSERT INTO stock_movements (
      department_id, item_id, movement_type, quantity_changed, user_id, reason
    ) VALUES (
      NULL, p_item_id, 'damage', -p_quantity, v_user_id, p_reason
    );

  ELSE
    SELECT quantity INTO v_current_stock
    FROM department_inventory
    WHERE department_id = p_department_id AND item_id = p_item_id
    FOR UPDATE;

    IF v_current_stock IS NULL OR v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Insufficient department stock. Available: %, Requested write-off: %', COALESCE(v_current_stock, 0), p_quantity;
    END IF;

    UPDATE department_inventory
    SET quantity = quantity - p_quantity,
        last_updated = NOW()
    WHERE department_id = p_department_id AND item_id = p_item_id;

    INSERT INTO stock_movements (
      department_id, item_id, movement_type, quantity_changed, user_id, reason
    ) VALUES (
      p_department_id, p_item_id, 'damage', -p_quantity, v_user_id, p_reason
    );
  END IF;

  -- Insert damage record
  INSERT INTO damages (
    item_id, quantity, location_type, department_id, stage, reason, receipt_url, recorded_by, recorded_at
  ) VALUES (
    p_item_id, p_quantity, p_location_type, p_department_id, p_stage, p_reason, p_receipt_url, v_user_id, NOW()
  ) RETURNING id INTO v_damage_id;

  -- Audit Log
  INSERT INTO audit_log (
    action_type, actor_id, department_id, item_names, quantity, notes, table_name, record_id, new_data
  ) VALUES (
    'Damage Written Off',
    v_user_id,
    p_department_id,
    v_item_name,
    p_quantity,
    'Damage written off: ' || p_quantity || ' portion(s) of ' || v_item_name || ' (' || p_stage || ') at ' || v_dept_name || '. Reason: ' || p_reason,
    'damages',
    v_damage_id,
    jsonb_build_object(
      'item_id', p_item_id,
      'quantity', p_quantity,
      'location_type', p_location_type,
      'department_id', p_department_id,
      'stage', p_stage,
      'reason', p_reason,
      'receipt_url', p_receipt_url,
      'loss_value', v_total_loss
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'damage_id', v_damage_id,
    'item_name', v_item_name,
    'quantity_written_off', p_quantity,
    'total_loss', v_total_loss
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
