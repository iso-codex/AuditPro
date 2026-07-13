-- Drop the old role check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the updated check constraint that includes the new roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('store_manager', 'department_staff', 'auditor', 'admin', 'store', 'manager', 'mis'));
