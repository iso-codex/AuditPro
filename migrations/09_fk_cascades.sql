-- 09_fk_cascades.sql
-- Update foreign keys to handle user deletion gracefully

-- purchase_orders
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_ordered_by_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- goods_receipts
ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_received_by_fkey;
ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- requisitions (approved_by) - requested_by is already ON DELETE CASCADE
ALTER TABLE requisitions DROP CONSTRAINT IF EXISTS requisitions_approved_by_fkey;
ALTER TABLE requisitions ADD CONSTRAINT requisitions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- sales_entries
ALTER TABLE sales_entries DROP CONSTRAINT IF EXISTS sales_entries_entered_by_fkey;
ALTER TABLE sales_entries ADD CONSTRAINT sales_entries_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- audit_log
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- pending_users
ALTER TABLE pending_users DROP CONSTRAINT IF EXISTS pending_users_requested_by_fkey;
ALTER TABLE pending_users ADD CONSTRAINT pending_users_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
