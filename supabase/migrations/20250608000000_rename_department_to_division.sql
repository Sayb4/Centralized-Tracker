-- Rename employees.department → division for databases created before the rename.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department'
  ) THEN
    ALTER TABLE public.employees RENAME COLUMN department TO division;
  END IF;
END $$;
