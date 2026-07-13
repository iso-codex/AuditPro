-- Allow Manager and Store roles to SELECT and UPDATE requisitions
CREATE POLICY "Manager and Store select requisitions" 
ON requisitions FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('manager', 'store', 'mis')
  )
);

CREATE POLICY "Manager and Store update requisitions" 
ON requisitions FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('manager', 'store', 'mis')
  )
);

-- Allow Manager and Store roles to SELECT and UPDATE requisition_items
CREATE POLICY "Manager and Store select requisition_items" 
ON requisition_items FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('manager', 'store', 'mis')
  )
);

CREATE POLICY "Manager and Store update requisition_items" 
ON requisition_items FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('manager', 'store', 'mis')
  )
);
