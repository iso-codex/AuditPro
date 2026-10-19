-- 16_weekly_stock_checks.sql

-- 1. Weekly Stock Entry Checks Table
CREATE TABLE IF NOT EXISTS stock_entry_weekly_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL UNIQUE,
  week_end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Awaiting Records Keeper' 
    CHECK (status IN ('Awaiting Records Keeper', 'Awaiting Manager', 'Awaiting Auditor', 'Fully checked')),
  records_keeper_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  records_keeper_signed_at TIMESTAMPTZ,
  records_keeper_comment TEXT,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  manager_signed_at TIMESTAMPTZ,
  manager_comment TEXT,
  auditor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  auditor_signed_at TIMESTAMPTZ,
  auditor_comment TEXT,
  has_recheck_warning BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_stock_weekly_checks_dates ON stock_entry_weekly_checks(week_start_date DESC);

-- Enable RLS
ALTER TABLE stock_entry_weekly_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stock_entry_weekly_checks" ON stock_entry_weekly_checks;
CREATE POLICY "Authenticated users can read stock_entry_weekly_checks"
ON stock_entry_weekly_checks FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authorized roles can update stock_entry_weekly_checks" ON stock_entry_weekly_checks;
CREATE POLICY "Authorized roles can update stock_entry_weekly_checks"
ON stock_entry_weekly_checks FOR ALL
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('records_keeper', 'manager', 'auditor', 'admin')
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('records_keeper', 'manager', 'auditor', 'admin')
);

-- 2. Update receive_goods_rpc to strictly enforce portions (whole numbers) and mandatory receipt
CREATE OR REPLACE FUNCTION receive_goods_rpc(
  p_item_id UUID, 
  p_quantity NUMERIC, 
  p_unit_cost NUMERIC, 
  p_supplier_id UUID DEFAULT NULL,
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_old_qty NUMERIC;
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
  v_receipt_id UUID;
  v_item_name TEXT;
  v_date DATE := CURRENT_DATE;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  -- Strict validation: Quantity must be whole number in portions
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity != FLOOR(p_quantity) THEN
    RAISE EXCEPTION 'Quantity must be a positive whole number in portions only (got %).', p_quantity;
  END IF;

  -- Strict validation: Receipt image is mandatory
  IF p_receipt_url IS NULL OR trim(p_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt image is strictly required for every stock entry.';
  END IF;

  -- Lock item row
  SELECT quantity_in_store, unit_cost, name INTO v_old_qty, v_old_cost, v_item_name
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
  INSERT INTO goods_receipts (item_id, quantity_received, received_by, unit_cost, receipt_url, date_received)
  VALUES (p_item_id, p_quantity, auth.uid(), p_unit_cost, p_receipt_url, v_date)
  RETURNING id INTO v_receipt_id;

  -- Insert price history
  INSERT INTO purchase_price_history (item_id, supplier_id, unit_cost, quantity)
  VALUES (p_item_id, p_supplier_id, p_unit_cost, p_quantity);

  -- Log in ledger (Central Store)
  INSERT INTO stock_movements (department_id, item_id, movement_type, quantity_changed, user_id, reference_id)
  VALUES (NULL, p_item_id, 'receipt', p_quantity, auth.uid(), v_receipt_id);

  -- Audit Log
  INSERT INTO audit_log (action_type, actor_id, item_names, quantity, notes, table_name, record_id, new_data)
  VALUES (
    'Received',
    auth.uid(),
    v_item_name,
    p_quantity,
    'Received ' || p_quantity || ' portion(s) of ' || COALESCE(v_item_name, 'item') || ' into Central Store with receipt',
    'goods_receipts',
    v_receipt_id,
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'unit_cost', p_unit_cost, 'receipt_url', p_receipt_url)
  );

  -- Weekly Check Integration: Calculate Monday-Sunday week boundaries
  v_week_start := date_trunc('week', v_date)::DATE;
  v_week_end := v_week_start + 6;

  -- Ensure weekly check record exists or reset if already in progress
  INSERT INTO stock_entry_weekly_checks (week_start_date, week_end_date, status)
  VALUES (v_week_start, v_week_end, 'Awaiting Records Keeper')
  ON CONFLICT (week_start_date) DO UPDATE
  SET status = CASE 
        WHEN stock_entry_weekly_checks.status != 'Awaiting Records Keeper' THEN 'Awaiting Records Keeper'
        ELSE stock_entry_weekly_checks.status
      END,
      has_recheck_warning = CASE 
        WHEN stock_entry_weekly_checks.status != 'Awaiting Records Keeper' THEN TRUE
        ELSE stock_entry_weekly_checks.has_recheck_warning
      END,
      updated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Sequential Weekly Sign-off RPC Function
CREATE OR REPLACE FUNCTION sign_off_weekly_check_rpc(
  p_week_start DATE,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_role TEXT;
  v_user_id UUID := auth.uid();
  v_record RECORD;
  v_new_status TEXT;
BEGIN
  v_user_role := get_user_role(v_user_id);
  
  SELECT * INTO v_record FROM stock_entry_weekly_checks WHERE week_start_date = p_week_start FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Weekly check record not found for week starting %', p_week_start;
  END IF;

  -- 1. Records Keeper Stage
  IF v_record.status = 'Awaiting Records Keeper' THEN
    IF v_user_role NOT IN ('records_keeper', 'admin') THEN
      RAISE EXCEPTION 'Permission denied: This check requires Records Keeper sign-off.';
    END IF;
    
    UPDATE stock_entry_weekly_checks
    SET status = 'Awaiting Manager',
        records_keeper_id = v_user_id,
        records_keeper_signed_at = NOW(),
        records_keeper_comment = p_comment,
        has_recheck_warning = FALSE,
        updated_at = NOW()
    WHERE week_start_date = p_week_start;

    v_new_status := 'Awaiting Manager';

  -- 2. Manager Stage
  ELSIF v_record.status = 'Awaiting Manager' THEN
    IF v_user_role NOT IN ('manager', 'admin') THEN
      RAISE EXCEPTION 'Permission denied: This check requires Manager sign-off.';
    END IF;

    UPDATE stock_entry_weekly_checks
    SET status = 'Awaiting Auditor',
        manager_id = v_user_id,
        manager_signed_at = NOW(),
        manager_comment = p_comment,
        updated_at = NOW()
    WHERE week_start_date = p_week_start;

    v_new_status := 'Awaiting Auditor';

  -- 3. Auditor Stage
  ELSIF v_record.status = 'Awaiting Auditor' THEN
    IF v_user_role NOT IN ('auditor', 'admin') THEN
      RAISE EXCEPTION 'Permission denied: This check requires Auditor sign-off.';
    END IF;

    UPDATE stock_entry_weekly_checks
    SET status = 'Fully checked',
        auditor_id = v_user_id,
        auditor_signed_at = NOW(),
        auditor_comment = p_comment,
        updated_at = NOW()
    WHERE week_start_date = p_week_start;

    v_new_status := 'Fully checked';

  ELSE
    RAISE EXCEPTION 'Week is already Fully checked and closed.';
  END IF;

  -- Audit Log
  INSERT INTO audit_log (action_type, actor_id, notes, table_name, record_id, new_data)
  VALUES (
    'Weekly Stock Check Signed',
    v_user_id,
    'Signed off weekly stock check for week ' || p_week_start || ' as ' || v_user_role || '. New status: ' || v_new_status,
    'stock_entry_weekly_checks',
    v_record.id,
    jsonb_build_object('week_start', p_week_start, 'role', v_user_role, 'status', v_new_status, 'comment', p_comment)
  );

  RETURN jsonb_build_object('success', true, 'new_status', v_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Initial Backfill: ensure existing entries and current week have a weekly check
INSERT INTO stock_entry_weekly_checks (week_start_date, week_end_date, status)
SELECT DISTINCT 
  date_trunc('week', COALESCE(date_received, created_at::DATE))::DATE AS week_start,
  (date_trunc('week', COALESCE(date_received, created_at::DATE))::DATE + 6) AS week_end,
  'Awaiting Records Keeper'
FROM goods_receipts
ON CONFLICT (week_start_date) DO NOTHING;

INSERT INTO stock_entry_weekly_checks (week_start_date, week_end_date, status)
VALUES (
  date_trunc('week', CURRENT_DATE)::DATE,
  (date_trunc('week', CURRENT_DATE)::DATE + 6),
  'Awaiting Records Keeper'
)
ON CONFLICT (week_start_date) DO NOTHING;

