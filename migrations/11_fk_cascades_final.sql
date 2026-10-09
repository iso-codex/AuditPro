-- 11_fk_cascades_final.sql
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE requisition_templates DROP CONSTRAINT IF EXISTS requisition_templates_created_by_fkey;
ALTER TABLE requisition_templates ADD CONSTRAINT requisition_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
