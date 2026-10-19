-- 15_procurement_forms.sql

CREATE TABLE IF NOT EXISTS procurement_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT NOT NULL CHECK (form_type IN ('market', 'frozen_goods')),
  status TEXT NOT NULL DEFAULT 'Created' CHECK (status IN ('Created', 'Saved', 'Updated', 'Completed')),
  form_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  first_saved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_saved_at TIMESTAMPTZ,
  last_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_updated_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS procurement_form_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES procurement_forms(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC DEFAULT 0,
  item_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS procurement_form_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES procurement_forms(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_procurement_forms_type_status ON procurement_forms(form_type, status);
CREATE INDEX IF NOT EXISTS idx_procurement_forms_created_at ON procurement_forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proc_form_items_form ON procurement_form_items(form_id);
CREATE INDEX IF NOT EXISTS idx_proc_form_history_form ON procurement_form_history(form_id, created_at DESC);

-- Enable RLS
ALTER TABLE procurement_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_form_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_form_history ENABLE ROW LEVEL SECURITY;

-- RLS: procurement_forms
DROP POLICY IF EXISTS "Procurement and admin can do everything on procurement_forms" ON procurement_forms;
CREATE POLICY "Procurement and admin can do everything on procurement_forms"
ON procurement_forms FOR ALL
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('procurement', 'admin')
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('procurement', 'admin')
);

DROP POLICY IF EXISTS "Manager and auditor read-only on Saved, Updated, and Completed procurement_forms" ON procurement_forms;
CREATE POLICY "Manager and auditor read-only on Saved, Updated, and Completed procurement_forms"
ON procurement_forms FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('manager', 'auditor')
  AND status IN ('Saved', 'Updated', 'Completed')
);

-- RLS: procurement_form_items
DROP POLICY IF EXISTS "Procurement and admin can do everything on procurement_form_items" ON procurement_form_items;
CREATE POLICY "Procurement and admin can do everything on procurement_form_items"
ON procurement_form_items FOR ALL
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('procurement', 'admin')
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('procurement', 'admin')
);

DROP POLICY IF EXISTS "Manager and auditor read-only on procurement_form_items" ON procurement_form_items;
CREATE POLICY "Manager and auditor read-only on procurement_form_items"
ON procurement_form_items FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('manager', 'auditor')
  AND EXISTS (
    SELECT 1 FROM procurement_forms pf 
    WHERE pf.id = procurement_form_items.form_id 
    AND pf.status IN ('Saved', 'Updated', 'Completed')
  )
);

-- RLS: procurement_form_history
DROP POLICY IF EXISTS "Procurement and admin can do everything on procurement_form_history" ON procurement_form_history;
CREATE POLICY "Procurement and admin can do everything on procurement_form_history"
ON procurement_form_history FOR ALL
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('procurement', 'admin')
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('procurement', 'admin')
);

DROP POLICY IF EXISTS "Manager and auditor read-only on procurement_form_history" ON procurement_form_history;
CREATE POLICY "Manager and auditor read-only on procurement_form_history"
ON procurement_form_history FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('manager', 'auditor')
  AND EXISTS (
    SELECT 1 FROM procurement_forms pf 
    WHERE pf.id = procurement_form_history.form_id 
    AND pf.status IN ('Saved', 'Updated', 'Completed')
  )
);
