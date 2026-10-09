-- 10_fk_cascades_part2.sql

-- stock_movements.user_id
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_user_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- sales_transactions.entered_by
ALTER TABLE sales_transactions ALTER COLUMN entered_by DROP NOT NULL;
ALTER TABLE sales_transactions DROP CONSTRAINT IF EXISTS sales_transactions_entered_by_fkey;
ALTER TABLE sales_transactions ADD CONSTRAINT sales_transactions_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- stock_count_cycles.submitted_by
ALTER TABLE stock_count_cycles DROP CONSTRAINT IF EXISTS stock_count_cycles_submitted_by_fkey;
ALTER TABLE stock_count_cycles ADD CONSTRAINT stock_count_cycles_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- stock_count_cycles.approved_by
ALTER TABLE stock_count_cycles DROP CONSTRAINT IF EXISTS stock_count_cycles_approved_by_fkey;
ALTER TABLE stock_count_cycles ADD CONSTRAINT stock_count_cycles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
