-- 1. Profiles Table Policies
-- Allow all authenticated users to view profiles (needed to see who requested what)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);
