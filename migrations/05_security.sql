-- 05_security.sql

-- 1. SECURE ITEMS TABLE
-- Remove the wide-open policies if they exist
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON items;

-- Create strict policies
CREATE POLICY "Enable read access for all authenticated users on items" 
ON items FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for store managers and admins on items" 
ON items FOR INSERT 
WITH CHECK (
    get_user_role((SELECT auth.uid())) IN ('store_manager', 'admin', 'procurement')
);

CREATE POLICY "Enable update for store managers and admins on items" 
ON items FOR UPDATE 
USING (
    get_user_role((SELECT auth.uid())) IN ('store_manager', 'admin', 'procurement')
);


-- 2. SECURE GOODS_RECEIPTS TABLE
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON goods_receipts;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON goods_receipts;

CREATE POLICY "Enable read access for all authenticated users on goods receipts" 
ON goods_receipts FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for store managers on goods receipts" 
ON goods_receipts FOR INSERT 
WITH CHECK (
    get_user_role((SELECT auth.uid())) IN ('store_manager', 'admin', 'store')
);


-- 3. SECURE REQUISITIONS TABLE
-- We updated SELECT policies in 04_performance.sql, now we lock down INSERT/UPDATE
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON requisitions;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON requisitions;

CREATE POLICY "Enable insert for department staff on requisitions" 
ON requisitions FOR INSERT 
WITH CHECK (
    get_user_role((SELECT auth.uid())) IN ('department_staff', 'manager', 'admin')
);

CREATE POLICY "Enable update for relevant roles on requisitions" 
ON requisitions FOR UPDATE 
USING (
    get_user_role((SELECT auth.uid())) IN ('department_staff', 'manager', 'store_manager', 'store', 'admin')
);

-- Note: RLS on requisition_items, sales_entries, stock_movements should follow a similar pattern
-- Since these are mostly manipulated via RPCs with SECURITY DEFINER, the RPC bypasses RLS,
-- but having strict table-level RLS prevents malicious clients from bypassing the RPC logic.

DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON sales_entries;
CREATE POLICY "Enable insert for store roles on sales entries" 
ON sales_entries FOR INSERT 
WITH CHECK (
    get_user_role((SELECT auth.uid())) IN ('store', 'mis', 'admin')
);
