-- 1. Add receipt_url column to goods_receipts
ALTER TABLE public.goods_receipts 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2. Create the storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies (Allow public viewing and authenticated uploads)
-- Drop existing policies if they exist to prevent errors on re-run
DROP POLICY IF EXISTS "Public View Receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Receipts" ON storage.objects;

-- Create new policies
CREATE POLICY "Public View Receipts" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated Upload Receipts" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'receipts');
