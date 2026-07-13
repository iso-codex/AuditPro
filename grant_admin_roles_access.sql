-- Ensure Admin and Store Manager roles have full access to requisitions
CREATE POLICY "Admin and Store Manager select requisitions" 
ON requisitions FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'store_manager')
  )
);

CREATE POLICY "Admin and Store Manager update requisitions" 
ON requisitions FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'store_manager')
  )
);

-- Ensure Admin and Store Manager roles have full access to requisition_items
CREATE POLICY "Admin and Store Manager select requisition_items" 
ON requisition_items FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'store_manager')
  )
);

CREATE POLICY "Admin and Store Manager update requisition_items" 
ON requisition_items FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'store_manager')
  )
);
