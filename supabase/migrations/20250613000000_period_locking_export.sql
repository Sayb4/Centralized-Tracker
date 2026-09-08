-- Period locking after payroll close + unpaginated tracker export

CREATE TABLE public.payroll_periods (
  year int NOT NULL,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, month)
);

CREATE TRIGGER payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_periods_select ON public.payroll_periods
  FOR SELECT TO authenticated USING (true);

CREATE POLICY payroll_periods_admin ON public.payroll_periods
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE OR REPLACE FUNCTION public.is_period_locked(p_year int, p_month int)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(
    (
      SELECT pp.is_locked
      FROM public.payroll_periods pp
      WHERE pp.year = p_year
        AND pp.month = p_month
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_tracker_export(
  p_year int,
  p_month int,
  p_tracker_window text DEFAULT 'payroll',
  p_division text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_rows jsonb;
  v_custom_fields jsonb;
  v_search text := NULLIF(trim(p_search), '');
BEGIN
  WITH base AS (
    SELECT
      e.*,
      public.get_employee_window_progress(
        e.id,
        p_year,
        p_month,
        p_tracker_window
      ) AS progress
    FROM public.employees e
    WHERE e.status = 'active'
      AND (p_division IS NULL OR p_division = '' OR e.division = p_division)
      AND (
        v_search IS NULL
        OR e.full_name ILIKE '%' || v_search || '%'
        OR e.employee_code ILIKE '%' || v_search || '%'
      )
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE public.matches_status_filter(progress, p_status_filter)
  )
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'employee', to_jsonb(e) - 'progress',
          'checklist', CASE
            WHEN pc.id IS NOT NULL THEN to_jsonb(pc)
            ELSE NULL
          END,
          'custom_values', COALESCE(
            (
              SELECT jsonb_object_agg(cv.field_id::text, cv.status)
              FROM public.custom_checklist_values cv
              WHERE cv.employee_id = e.id
                AND cv.year = p_year
                AND cv.month = p_month
            ),
            '{}'::jsonb
          ),
          'progress', e.progress
        )
        ORDER BY e.full_name
      )
      FROM filtered e
      LEFT JOIN public.payroll_checklists pc
        ON pc.employee_id = e.id
        AND pc.year = p_year
        AND pc.month = p_month
    ),
    '[]'::jsonb
  )
  INTO v_rows;

  SELECT COALESCE(jsonb_agg(to_jsonb(cf.*) ORDER BY cf.sort_order, cf.label), '[]'::jsonb)
  INTO v_custom_fields
  FROM public.custom_checklist_fields cf
  WHERE cf.active = true;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', jsonb_array_length(v_rows),
    'customFields', v_custom_fields
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_period_context(
  p_year int,
  p_month int,
  p_tracker_window text DEFAULT 'payroll'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_locked boolean := false;
  v_locked_at timestamptz;
  v_locked_by uuid;
  v_notes text;
  v_completed int;
  v_in_progress int;
  v_not_started int;
BEGIN
  SELECT pp.is_locked, pp.locked_at, pp.locked_by, pp.notes
  INTO v_locked, v_locked_at, v_locked_by, v_notes
  FROM public.payroll_periods pp
  WHERE pp.year = p_year
    AND pp.month = p_month;

  WITH employee_progress AS (
    SELECT
      public.get_employee_window_progress(e.id, p_year, p_month, p_tracker_window) AS progress
    FROM public.employees e
    WHERE e.status = 'active'
  )
  SELECT
    count(*) FILTER (WHERE progress >= 100)::int,
    count(*) FILTER (WHERE progress > 0 AND progress < 100)::int,
    count(*) FILTER (WHERE progress = 0)::int
  INTO v_completed, v_in_progress, v_not_started
  FROM employee_progress;

  RETURN jsonb_build_object(
    'isLocked', COALESCE(v_locked, false),
    'lockedAt', v_locked_at,
    'lockedBy', v_locked_by,
    'notes', v_notes,
    'completed', v_completed,
    'inProgress', v_in_progress,
    'notStarted', v_not_started,
    'incomplete', v_in_progress + v_not_started
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_period_locked(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tracker_export(int, int, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_period_context(int, int, text) TO authenticated;
