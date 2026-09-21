-- 01_enhancements.sql

-- 1. DEPARTMENTS
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed exactly four operating departments
INSERT INTO departments (name) VALUES ('Byte'), ('Kitchen'), ('Bar'), ('Pool & Playground');

-- DROP dependent policies
DROP POLICY IF EXISTS "Department staff can view own department requisitions" ON requisitions;
DROP POLICY IF EXISTS "Department staff can view own requisition items" ON requisition_items;

-- 2. ALTER PROFILES (Roles and scoping)
DO $$ 
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'profiles'::regclass AND contype = 'c'
  LIMIT 1;
  
  IF c_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || c_name;
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'store_manager', 'store', 'department_staff', 'auditor', 'mis', 'procurement'));
ALTER TABLE profiles ADD COLUMN department_id UUID REFERENCES departments(id);

-- Helper functions for RLS (Must be created after altering profiles)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_department(user_id UUID)
RETURNS UUID AS $$
  SELECT department_id FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Automatically move one store_manager to procurement
DO $$
DECLARE
  sm_id UUID;
BEGIN
  SELECT id INTO sm_id FROM profiles WHERE role = 'store_manager' LIMIT 1;
  IF sm_id IS NOT NULL THEN
    UPDATE profiles SET role = 'procurement' WHERE id = sm_id;
  END IF;
END $$;

-- 3. MIGRATE department_inventory
ALTER TABLE department_inventory ADD COLUMN department_id UUID REFERENCES departments(id);

UPDATE department_inventory di
SET department_id = d.id
FROM departments d
WHERE di.department = d.name;

DO $$ 
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'department_inventory'::regclass AND contype = 'u'
  LIMIT 1;
  
  IF c_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE department_inventory DROP CONSTRAINT ' || c_name;
  END IF;
END $$;

ALTER TABLE department_inventory DROP COLUMN department CASCADE;
ALTER TABLE department_inventory ADD CONSTRAINT dept_inv_unique UNIQUE(department_id, item_id);

-- 4. MIGRATE sales_entries
ALTER TABLE sales_entries ADD COLUMN department_id UUID REFERENCES departments(id);

UPDATE sales_entries se
SET department_id = d.id
FROM departments d
WHERE se.department = d.name;

ALTER TABLE sales_entries DROP COLUMN department CASCADE;

-- 5. MIGRATE requisitions
ALTER TABLE requisitions ADD COLUMN department_id UUID REFERENCES departments(id);

UPDATE requisitions r
SET department_id = d.id
FROM departments d
WHERE r.department = d.name;

ALTER TABLE requisitions DROP COLUMN department CASCADE;

-- 6. MIGRATE audit_log
ALTER TABLE audit_log ADD COLUMN department_id UUID REFERENCES departments(id);

UPDATE audit_log al
SET department_id = d.id
FROM departments d
WHERE al.department = d.name;

ALTER TABLE audit_log DROP COLUMN department CASCADE;

-- 7. ITEMS updates
ALTER TABLE items ADD COLUMN is_consumable BOOLEAN DEFAULT true;

-- 8. STOCK COUNT CYCLES & LINES
CREATE TABLE stock_count_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id), -- NULL means central store
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved')),
    submitted_by UUID REFERENCES profiles(id),
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_count_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES stock_count_cycles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    opening_qty NUMERIC DEFAULT 0,
    receipts_qty NUMERIC DEFAULT 0,
    issues_qty NUMERIC DEFAULT 0,
    expected_closing_qty NUMERIC DEFAULT 0,
    counted_qty NUMERIC,
    variance_qty NUMERIC,
    variance_value NUMERIC,
    variance_pct NUMERIC,
    reason_code TEXT,
    comment TEXT,
    UNIQUE(cycle_id, item_id)
);

-- 9. RECIPES / MAPPING
CREATE TABLE item_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    component_item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    is_composite BOOLEAN DEFAULT true,
    UNIQUE(parent_item_id, component_item_id)
);

-- 10. THRESHOLDS
CREATE TABLE department_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id), -- NULL for central store
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    low_threshold NUMERIC DEFAULT 0,
    high_threshold NUMERIC,
    UNIQUE(department_id, item_id)
);

-- 11. COSTING
CREATE TABLE purchase_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    unit_cost NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate policies that were dropped
CREATE POLICY "Department staff can view own department requisitions" 
ON requisitions FOR SELECT
USING (get_user_role(auth.uid()) = 'department_staff' AND get_user_department(auth.uid()) = department_id);

CREATE POLICY "Department staff can view own requisition items" 
ON requisition_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND get_user_role(auth.uid()) = 'department_staff' 
  AND get_user_department(auth.uid()) = r.department_id
));

-- RLS ON NEW TABLES
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read departments" ON departments FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE stock_count_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store, Manager, Admin, Auditor can read stock_count_cycles" ON stock_count_cycles FOR SELECT USING (
  get_user_role(auth.uid()) IN ('store', 'manager', 'admin', 'auditor')
);
CREATE POLICY "Store can insert stock counts" ON stock_count_cycles FOR INSERT WITH CHECK (
  get_user_role(auth.uid()) = 'store' 
  AND (get_user_department(auth.uid()) IS NULL OR get_user_department(auth.uid()) = department_id)
);
CREATE POLICY "Store can update own open stock counts" ON stock_count_cycles FOR UPDATE USING (
  get_user_role(auth.uid()) = 'store' AND status = 'open'
);
CREATE POLICY "Manager and Admin can update stock counts" ON stock_count_cycles FOR UPDATE USING (
  get_user_role(auth.uid()) IN ('manager', 'admin')
);

ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store, Manager, Admin, Auditor can read stock_count_lines" ON stock_count_lines FOR SELECT USING (
  get_user_role(auth.uid()) IN ('store', 'manager', 'admin', 'auditor')
);
CREATE POLICY "Store can insert stock count lines" ON stock_count_lines FOR INSERT WITH CHECK (
  get_user_role(auth.uid()) = 'store'
);
CREATE POLICY "Store can update stock count lines" ON stock_count_lines FOR UPDATE USING (
  get_user_role(auth.uid()) = 'store'
);
CREATE POLICY "Manager and Admin can update stock count lines" ON stock_count_lines FOR UPDATE USING (
  get_user_role(auth.uid()) IN ('manager', 'admin')
);

ALTER TABLE item_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read item_recipes" ON item_recipes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin and Manager can modify item_recipes" ON item_recipes USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

ALTER TABLE department_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read department_thresholds" ON department_thresholds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin and Manager can modify department_thresholds" ON department_thresholds USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

ALTER TABLE purchase_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read purchase_price_history" ON purchase_price_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Procurement and Admin can modify purchase_price_history" ON purchase_price_history USING (get_user_role(auth.uid()) IN ('procurement', 'admin'));
