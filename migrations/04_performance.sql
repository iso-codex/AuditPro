-- 04_performance.sql

-- 1. ADD TARGETED INDEXES
CREATE INDEX IF NOT EXISTS idx_audit_log_dept_created ON audit_log(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action_type);

CREATE INDEX IF NOT EXISTS idx_requisitions_dept_status ON requisitions(department_id, status);
CREATE INDEX IF NOT EXISTS idx_requisitions_created_at ON requisitions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_entries_dept_created ON sales_entries(department_id, date_entered DESC);
CREATE INDEX IF NOT EXISTS idx_sales_entries_item ON sales_entries(item_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_dept_item ON stock_movements(department_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dept_inv_dept_item ON department_inventory(department_id, item_id);

-- 2. OPTIMIZE RLS POLICIES
-- The original policy: CREATE POLICY "Enable read access for all authenticated users" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
-- Optimized RLS uses (select auth.uid()) to force Postgres to evaluate it once per query instead of per row.

DROP POLICY IF EXISTS "Department staff can view own department requisitions" ON requisitions;
CREATE POLICY "Department staff can view own department requisitions" 
ON requisitions FOR SELECT
USING (get_user_role((SELECT auth.uid())) = 'department_staff' AND get_user_department((SELECT auth.uid())) = department_id);

DROP POLICY IF EXISTS "Department staff can view own requisition items" ON requisition_items;
CREATE POLICY "Department staff can view own requisition items" 
ON requisition_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM requisitions r 
  WHERE r.id = requisition_items.requisition_id 
  AND get_user_role((SELECT auth.uid())) = 'department_staff' 
  AND get_user_department((SELECT auth.uid())) = r.department_id
));

-- 3. STATEMENT TIMEOUTS
-- Prevent bad queries from freezing the database
ALTER ROLE authenticator SET statement_timeout = '15s';

-- 4. DAILY SALES SUMMARY (Materialized on insert)
CREATE TABLE daily_sales_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id),
    item_id UUID REFERENCES items(id),
    sale_date DATE NOT NULL,
    total_qty_sold NUMERIC DEFAULT 0,
    UNIQUE(department_id, item_id, sale_date)
);

CREATE INDEX idx_daily_sales_date ON daily_sales_summary(sale_date DESC);
CREATE INDEX idx_daily_sales_dept ON daily_sales_summary(department_id);

-- Trigger to maintain summary table
CREATE OR REPLACE FUNCTION maintain_daily_sales_summary() RETURNS trigger AS $$
BEGIN
    INSERT INTO daily_sales_summary (department_id, item_id, sale_date, total_qty_sold)
    VALUES (NEW.department_id, NEW.item_id, (NEW.date_entered AT TIME ZONE 'UTC')::DATE, NEW.quantity_sold)
    ON CONFLICT (department_id, item_id, sale_date)
    DO UPDATE SET total_qty_sold = daily_sales_summary.total_qty_sold + EXCLUDED.total_qty_sold;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_maintain_daily_sales ON sales_entries;
CREATE TRIGGER trigger_maintain_daily_sales
AFTER INSERT ON sales_entries
FOR EACH ROW
EXECUTE FUNCTION maintain_daily_sales_summary();
