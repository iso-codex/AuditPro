-- Create the categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read categories
CREATE POLICY "Enable read access for all authenticated users" ON public.categories
    FOR SELECT TO authenticated USING (true);

-- Allow admins to insert/update/delete categories (assuming role check or just enable for all authenticated for this MVP, but we can restrict if needed)
-- For this prototype, we'll allow authenticated users to insert, as the UI is protected
CREATE POLICY "Enable insert for authenticated users" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.categories
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.categories
    FOR DELETE TO authenticated USING (true);

-- Insert default categories to match the existing hardcoded ones
INSERT INTO public.categories (name) VALUES 
    ('Food'),
    ('Beverage'),
    ('Dry Goods'),
    ('Cleaning'),
    ('Other')
ON CONFLICT (name) DO NOTHING;
