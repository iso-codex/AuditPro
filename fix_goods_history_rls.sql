-- This grants read access to the audit_log table for Managers, Store Managers, and Admins
-- so they can view the Goods History records.

CREATE POLICY "Allow managers to read audit_log" 
ON audit_log FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'store_manager', 'manager')
  )
);
