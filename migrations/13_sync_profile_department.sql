-- 13_sync_profile_department.sql
-- Keep department name and department_id synchronized on profiles

CREATE OR REPLACE FUNCTION sync_profile_department()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    SELECT name INTO NEW.department FROM departments WHERE id = NEW.department_id;
  ELSIF NEW.department IS NOT NULL THEN
    SELECT id INTO NEW.department_id FROM departments WHERE name = NEW.department;
  ELSE
    NEW.department := NULL;
    NEW.department_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_profile_department ON profiles;
CREATE TRIGGER trigger_sync_profile_department
BEFORE INSERT OR UPDATE OF department, department_id ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_department();

-- Also sync all existing profiles
UPDATE profiles p
SET department = d.name
FROM departments d
WHERE p.department_id = d.id AND (p.department IS NULL OR p.department != d.name);

UPDATE profiles p
SET department_id = d.id
FROM departments d
WHERE p.department = d.name AND p.department_id IS NULL;
