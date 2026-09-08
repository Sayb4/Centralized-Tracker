-- Assign custom checklist fields to specific tracker windows.

ALTER TABLE public.custom_checklist_fields
  ADD COLUMN IF NOT EXISTS tracker_windows text[] NOT NULL DEFAULT ARRAY['payroll']::text[];
