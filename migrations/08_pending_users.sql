-- 08_pending_users.sql
CREATE TABLE pending_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    department_id UUID REFERENCES departments(id),
    requested_by UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pending_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for managers and admins" ON pending_users 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);
