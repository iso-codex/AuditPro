-- Create department_inventory table
CREATE TABLE IF NOT EXISTS department_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity NUMERIC DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(department, item_id)
);

-- RLS for department_inventory
ALTER TABLE department_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" 
ON department_inventory FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert/update for authenticated users" 
ON department_inventory FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);


-- Create sales_entries table
CREATE TABLE IF NOT EXISTS sales_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity_sold NUMERIC NOT NULL,
  date_entered TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entered_by UUID REFERENCES profiles(id)
);

-- RLS for sales_entries
ALTER TABLE sales_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" 
ON sales_entries FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON sales_entries FOR INSERT 
TO authenticated 
WITH CHECK (true);


-- Migrate old Requisition Statuses
-- First, drop the old status check constraint to allow new statuses
ALTER TABLE requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;

-- 'Pending' goes to 'Pending_Manager'
-- 'Approved' goes to 'Pending_Store'
UPDATE requisitions SET status = 'Pending_Manager' WHERE status = 'Pending';
UPDATE requisitions SET status = 'Pending_Store' WHERE status = 'Approved';

-- Optionally, you can add a new check constraint with the updated statuses
ALTER TABLE requisitions ADD CONSTRAINT requisitions_status_check 
  CHECK (status IN ('Pending_Manager', 'Pending_Store', 'Dispatched', 'Received', 'Partially Received', 'Rejected', 'Approved', 'Pending'));
