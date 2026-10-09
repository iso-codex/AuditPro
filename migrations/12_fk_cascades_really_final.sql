-- 12_fk_cascades_really_final.sql
ALTER TABLE requisitions DROP CONSTRAINT IF EXISTS requisitions_requested_by_fkey;
ALTER TABLE requisitions ADD CONSTRAINT requisitions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
