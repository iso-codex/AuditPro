-- 07_profiles_dept_id.sql
-- Backfill the department_id in the profiles table for existing users.

UPDATE profiles p
SET department_id = d.id
FROM departments d
WHERE p.department = d.name AND p.department_id IS NULL;
