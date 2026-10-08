-- 06_rls_reads.sql
-- Adds missing READ policies to ensure the frontend can fetch data now that we enforce RLS everywhere.

-- 1. DEPARTMENT INVENTORY
CREATE POLICY "Enable read access for all authenticated users on department_inventory" 
ON department_inventory FOR SELECT USING (auth.role() = 'authenticated');

-- 2. REQUISITION ITEMS
CREATE POLICY "Enable read access for all authenticated users on requisition_items" 
ON requisition_items FOR SELECT USING (auth.role() = 'authenticated');

-- 3. AUDIT LOG
CREATE POLICY "Enable read access for all authenticated users on audit_log" 
ON audit_log FOR SELECT USING (auth.role() = 'authenticated');

-- 4. SALES ENTRIES
CREATE POLICY "Enable read access for all authenticated users on sales_entries" 
ON sales_entries FOR SELECT USING (auth.role() = 'authenticated');

-- 5. NOTIFICATIONS
CREATE POLICY "Enable read access for users on their notifications" 
ON notifications FOR SELECT USING (auth.uid() = user_id);
-- Enable insert/update for system/managers (can use authenticated for now to allow RPCs and clients to insert)
CREATE POLICY "Enable insert for all authenticated users on notifications" 
ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for users on their notifications" 
ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- 6. SUPPLIERS
CREATE POLICY "Enable read access for all authenticated users on suppliers" 
ON suppliers FOR SELECT USING (auth.role() = 'authenticated');

-- 7. PURCHASE ORDERS & ITEMS
CREATE POLICY "Enable read access for all authenticated users on purchase_orders" 
ON purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all authenticated users on purchase_order_items" 
ON purchase_order_items FOR SELECT USING (auth.role() = 'authenticated');

-- 8. STOCK MOVEMENTS (just in case it was missed)
DROP POLICY IF EXISTS "All authenticated can read movements" ON stock_movements;
CREATE POLICY "All authenticated can read movements" 
ON stock_movements FOR SELECT USING (auth.role() = 'authenticated');

-- 9. REQUISITION TEMPLATES
DO $$ BEGIN
    -- Safe enablement in case tables don't exist yet
    ALTER TABLE IF EXISTS requisition_templates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS requisition_template_items ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    -- do nothing
END $$;

CREATE POLICY "Enable read access for all authenticated users on requisition_templates" 
ON requisition_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for users on requisition_templates" 
ON requisition_templates FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all authenticated users on requisition_template_items" 
ON requisition_template_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for users on requisition_template_items" 
ON requisition_template_items FOR ALL USING (auth.role() = 'authenticated');
