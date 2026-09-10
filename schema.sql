-- AuditPro Supabase Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    department TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'store_manager', 'store', 'department_staff', 'auditor', 'mis')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ITEMS (Catalog)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_cost NUMERIC DEFAULT 0,
    quantity_in_store NUMERIC DEFAULT 0,
    low_stock_threshold NUMERIC DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUPPLIERS
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PURCHASE ORDERS
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    ordered_by UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Completed', 'Cancelled')),
    expected_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PURCHASE ORDER ITEMS
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity_ordered NUMERIC NOT NULL,
    quantity_received NUMERIC DEFAULT 0,
    unit_cost NUMERIC DEFAULT 0
);

-- 6. GOODS RECEIPTS
CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity_received NUMERIC NOT NULL,
    received_by UUID REFERENCES profiles(id),
    date_received DATE DEFAULT CURRENT_DATE,
    unit_cost NUMERIC DEFAULT 0,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REQUISITIONS
CREATE TABLE requisitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Pending_Manager', 'Pending_Store', 'Approved', 'Dispatched', 'Rejected', 'Completed')),
    approved_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. REQUISITION ITEMS
CREATE TABLE requisition_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisition_id UUID REFERENCES requisitions(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity_requested NUMERIC NOT NULL,
    quantity_approved NUMERIC DEFAULT 0,
    quantity_dispatched NUMERIC DEFAULT 0,
    quantity_confirmed NUMERIC DEFAULT 0,
    unit_cost NUMERIC DEFAULT 0,
    discrepancy_notes TEXT
);

-- 9. DEPARTMENT INVENTORY
CREATE TABLE department_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department TEXT NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department, item_id)
);

-- 10. SALES ENTRIES (MIS)
CREATE TABLE sales_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department TEXT NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    quantity_sold NUMERIC NOT NULL,
    entered_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AUDIT LOG
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type TEXT NOT NULL,
    actor_id UUID REFERENCES profiles(id),
    department TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
-- Note: Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Base Policy (Allow all authenticated users to read profiles)
CREATE POLICY "Enable read access for all authenticated users" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
-- Note: You should add comprehensive Insert/Update/Delete RLS policies based on auth.uid() and role checks for your specific application logic.
