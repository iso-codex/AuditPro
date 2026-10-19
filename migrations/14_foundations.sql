-- 14_foundations.sql
-- 1. Add Take Out department
INSERT INTO departments (name)
VALUES ('Take Out')
ON CONFLICT (name) DO NOTHING;

-- 2. Update profiles role check to include records_keeper
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'store_manager'::text, 'store'::text, 'department_staff'::text, 'auditor'::text, 'mis'::text, 'procurement'::text, 'records_keeper'::text]));

-- 3. Add receipt_url to goods_receipts
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 4. Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Anyone authenticated can view receipts" ON storage.objects;
CREATE POLICY "Anyone authenticated can view receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;
CREATE POLICY "Public can view receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');
