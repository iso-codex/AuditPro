-- Add approver information columns to the requisitions table
ALTER TABLE public.requisitions
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approver_name TEXT;
