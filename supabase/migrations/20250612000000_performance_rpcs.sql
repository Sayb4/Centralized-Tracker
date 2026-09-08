-- Progress helpers, tracker pagination RPC, dashboard analytics RPC

CREATE OR REPLACE FUNCTION public.compute_progress_from_statuses(
  statuses checklist_status[],
  progress_override int DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  applicable checklist_status[];
  done_count int;
  applicable_len int;
BEGIN
  IF progress_override IS NOT NULL THEN
    RETURN LEAST(100, GREATEST(0, progress_override));
  END IF;

  SELECT array_agg(s) INTO applicable
  FROM unnest(statuses) AS s
  WHERE s <> 'not_needed'::checklist_status;

  applicable_len := COALESCE(array_length(applicable, 1), 0);
  IF applicable_len = 0 THEN
    RETURN 100;
  END IF;

  SELECT count(*) INTO done_count
  FROM unnest(applicable) AS s
  WHERE s IN ('completed'::checklist_status, 'submitted'::checklist_status);

  RETURN round((done_count::numeric / applicable_len) * 100)::int;
END;
$$;

CREATE OR REPLACE FUNCTION public.matches_status_filter(
  p_progress int,
  p_filter text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(p_filter, 'all')
    WHEN 'all' THEN true
    WHEN 'completed' THEN p_progress >= 100
    WHEN 'not_started' THEN p_progress = 0
    WHEN 'pending' THEN p_progress > 0 AND p_progress < 100
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.tracker_window_built_in_keys(p_window text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_window
    WHEN 'payroll' THEN ARRAY[
      'certificate_of_appearance',
      'special_order',
      'override_status',
      'leave_application'
    ]::text[]
    WHEN 'documentation' THEN ARRAY[
      'certificate_of_appearance',
      'special_order'
    ]::text[]
    WHEN 'leave' THEN ARRAY['leave_application', 'certificate_of_appearance']::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_checklist_field_status(
  p_checklist public.payroll_checklists,
  p_key text
)
RETURNS checklist_status
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_checklist IS NULL THEN 'not_yet_submitted'::checklist_status
    WHEN p_key = 'certificate_of_appearance' THEN p_checklist.certificate_of_appearance
    WHEN p_key = 'special_order' THEN p_checklist.special_order
    WHEN p_key = 'override_status' THEN p_checklist.override_status
    WHEN p_key = 'leave_application' THEN p_checklist.leave_application
    ELSE 'not_yet_submitted'::checklist_status
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_window_statuses(
  p_employee_id uuid,
  p_year int,
  p_month int,
  p_tracker_window text
)
RETURNS checklist_status[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_checklist public.payroll_checklists;
  v_built_in_keys text[];
  v_key text;
  v_statuses checklist_status[] := ARRAY[]::checklist_status[];
  v_custom_field record;
BEGIN
  SELECT * INTO v_checklist
  FROM public.payroll_checklists
  WHERE employee_id = p_employee_id
    AND year = p_year
    AND month = p_month;

  v_built_in_keys := public.tracker_window_built_in_keys(p_tracker_window);

  FOREACH v_key IN ARRAY v_built_in_keys LOOP
    v_statuses := array_append(
      v_statuses,
      public.get_checklist_field_status(v_checklist, v_key)
    );
  END LOOP;

  FOR v_custom_field IN
    SELECT cf.id
    FROM public.custom_checklist_fields cf
    WHERE cf.active = true
      AND p_tracker_window = ANY (cf.tracker_windows)
    ORDER BY cf.sort_order, cf.label
  LOOP
    v_statuses := array_append(
      v_statuses,
      COALESCE(
        (
          SELECT cv.status
          FROM public.custom_checklist_values cv
          WHERE cv.employee_id = p_employee_id
            AND cv.field_id = v_custom_field.id
            AND cv.year = p_year
            AND cv.month = p_month
        ),
        'not_yet_submitted'::checklist_status
      )
    );
  END LOOP;

  RETURN v_statuses;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_window_progress(
  p_employee_id uuid,
  p_year int,
  p_month int,
  p_tracker_window text
)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_checklist public.payroll_checklists;
  v_statuses checklist_status[];
  v_override int := NULL;
BEGIN
  SELECT * INTO v_checklist
  FROM public.payroll_checklists
  WHERE employee_id = p_employee_id
    AND year = p_year
    AND month = p_month;

  v_statuses := public.get_employee_window_statuses(
    p_employee_id,
    p_year,
    p_month,
    p_tracker_window
  );

  IF p_tracker_window = 'payroll' AND v_checklist.progress_override IS NOT NULL THEN
    v_override := v_checklist.progress_override;
  END IF;

  RETURN public.compute_progress_from_statuses(v_statuses, v_override);
END;
$$;

CREATE OR REPLACE FUNCTION public.built_in_field_label(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'certificate_of_appearance' THEN 'Certificate of Appearance'
    WHEN 'special_order' THEN 'Special Order'
    WHEN 'override_status' THEN 'Override Status'
    WHEN 'leave_application' THEN 'Leave Application'
    ELSE p_key
  END;
$$;

CREATE OR REPLACE FUNCTION public.build_dashboard_member_fields(
  p_employee_id uuid,
  p_year int,
  p_month int,
  p_tracker_window text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_checklist public.payroll_checklists;
  v_fields jsonb := '[]'::jsonb;
  v_key text;
  v_cf record;
BEGIN
  SELECT * INTO v_checklist
  FROM public.payroll_checklists
  WHERE employee_id = p_employee_id
    AND year = p_year
    AND month = p_month;

  FOREACH v_key IN ARRAY public.tracker_window_built_in_keys(p_tracker_window) LOOP
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object(
        'key', v_key,
        'label', public.built_in_field_label(v_key),
        'status', public.get_checklist_field_status(v_checklist, v_key)
      )
    );
  END LOOP;

  FOR v_cf IN
    SELECT cf.key, cf.label, cf.id
    FROM public.custom_checklist_fields cf
    WHERE cf.active = true
      AND p_tracker_window = ANY (cf.tracker_windows)
    ORDER BY cf.sort_order, cf.label
  LOOP
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object(
        'key', v_cf.key,
        'label', v_cf.label,
        'status', COALESCE(
          (
            SELECT cv.status
            FROM public.custom_checklist_values cv
            WHERE cv.employee_id = p_employee_id
              AND cv.field_id = v_cf.id
              AND cv.year = p_year
              AND cv.month = p_month
          ),
          'not_yet_submitted'::checklist_status
        )
      )
    );
  END LOOP;

  RETURN v_fields;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tracker_page(
  p_year int,
  p_month int,
  p_tracker_window text DEFAULT 'payroll',
  p_division text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'all',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_offset int;
  v_total int;
  v_rows jsonb;
  v_custom_fields jsonb;
  v_search text := NULLIF(trim(p_search), '');
BEGIN
  v_offset := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);

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
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY full_name
    LIMIT GREATEST(p_page_size, 1)
    OFFSET v_offset
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(
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
        FROM paged e
        LEFT JOIN public.payroll_checklists pc
          ON pc.employee_id = e.id
          AND pc.year = p_year
          AND pc.month = p_month
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  SELECT COALESCE(jsonb_agg(to_jsonb(cf.*) ORDER BY cf.sort_order, cf.label), '[]'::jsonb)
  INTO v_custom_fields
  FROM public.custom_checklist_fields cf
  WHERE cf.active = true;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', GREATEST(p_page, 1),
    'pageSize', GREATEST(p_page_size, 1),
    'customFields', v_custom_fields
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
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
  v_total int;
  v_active int;
  v_completed int;
  v_in_progress int;
  v_not_started int;
  v_avg_progress numeric;
  v_status_distribution jsonb;
  v_division_summary jsonb;
  v_payroll_groups jsonb;
BEGIN
  SELECT count(*)::int INTO v_total FROM public.employees;
  SELECT count(*)::int INTO v_active FROM public.employees WHERE status = 'active';

  WITH employee_progress AS (
    SELECT
      e.*,
      public.get_employee_window_progress(e.id, p_year, p_month, p_tracker_window) AS progress
    FROM public.employees e
    WHERE e.status = 'active'
  ),
  categorized AS (
    SELECT
      ep.*,
      CASE
        WHEN ep.progress >= 100 THEN 'completed'
        WHEN ep.progress > 0 THEN 'in_progress'
        ELSE 'not_started'
      END AS category
    FROM employee_progress ep
  )
  SELECT
    count(*) FILTER (WHERE category = 'completed')::int,
    count(*) FILTER (WHERE category = 'in_progress')::int,
    count(*) FILTER (WHERE category = 'not_started')::int,
    COALESCE(round(avg(progress)), 0)
  INTO v_completed, v_in_progress, v_not_started, v_avg_progress
  FROM categorized;

  WITH employee_progress AS (
    SELECT
      e.id,
      public.get_employee_window_progress(e.id, p_year, p_month, p_tracker_window) AS progress
    FROM public.employees e
    WHERE e.status = 'active'
  ),
  status_rows AS (
    SELECT unnest(
      public.get_employee_window_statuses(ep.id, p_year, p_month, p_tracker_window)
    ) AS status
    FROM employee_progress ep
  ),
  status_counts AS (
    SELECT status, count(*)::int AS cnt
    FROM status_rows
    GROUP BY status
  ),
  total_status AS (
    SELECT COALESCE(sum(cnt), 0)::numeric AS total FROM status_counts
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'status', sc.status,
        'count', sc.cnt,
        'percentage', CASE
          WHEN ts.total = 0 THEN 0
          ELSE round((sc.cnt / ts.total) * 1000) / 10
        END
      )
      ORDER BY sc.status
    ),
    '[]'::jsonb
  )
  INTO v_status_distribution
  FROM status_counts sc
  CROSS JOIN total_status ts;

  WITH employee_progress AS (
    SELECT
      e.division,
      public.get_employee_window_progress(e.id, p_year, p_month, p_tracker_window) AS progress
    FROM public.employees e
    WHERE e.status = 'active'
  ),
  division_stats AS (
    SELECT
      COALESCE(NULLIF(division, ''), 'Unassigned') AS division,
      count(*)::int AS employee_count,
      count(*) FILTER (WHERE progress >= 100)::int AS completed,
      count(*) FILTER (WHERE progress > 0 AND progress < 100)::int AS in_progress,
      count(*) FILTER (WHERE progress = 0)::int AS not_started,
      COALESCE(round(avg(progress)), 0)::int AS average_progress
    FROM employee_progress
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'division', division,
        'employeeCount', employee_count,
        'completed', completed,
        'inProgress', in_progress,
        'notStarted', not_started,
        'averageProgress', average_progress
      )
      ORDER BY division
    ),
    '[]'::jsonb
  )
  INTO v_division_summary
  FROM division_stats;

  IF p_tracker_window = 'payroll' THEN
    WITH employee_progress AS (
      SELECT
        e.*,
        public.get_employee_window_progress(e.id, p_year, p_month, p_tracker_window) AS progress
      FROM public.employees e
      WHERE e.status = 'active'
    ),
    with_category AS (
      SELECT
        ep.*,
        CASE
          WHEN ep.progress >= 100 THEN 'completed'
          WHEN ep.progress > 0 THEN 'in_progress'
          ELSE 'not_started'
        END AS category
      FROM employee_progress ep
    ),
    grouped AS (
      SELECT
        COALESCE(NULLIF(wc.payroll_group, ''), 'Unassigned') AS grp,
        jsonb_agg(
          jsonb_build_object(
            'employeeId', wc.id,
            'employeeCode', wc.employee_code,
            'fullName', wc.full_name,
            'division', wc.division,
            'progress', wc.progress,
            'category', wc.category,
            'fields', public.build_dashboard_member_fields(
              wc.id,
              p_year,
              p_month,
              p_tracker_window
            )
          )
          ORDER BY wc.full_name
        ) AS members,
        count(*)::int AS employee_count,
        count(*) FILTER (WHERE wc.category = 'completed')::int AS completed,
        count(*) FILTER (WHERE wc.category = 'in_progress')::int AS in_progress,
        count(*) FILTER (WHERE wc.category = 'not_started')::int AS not_started,
        COALESCE(round(avg(wc.progress)), 0)::int AS average_progress
      FROM with_category wc
      GROUP BY 1
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'group', grp,
          'employeeCount', employee_count,
          'completed', completed,
          'inProgress', in_progress,
          'notStarted', not_started,
          'averageProgress', average_progress,
          'members', members
        )
        ORDER BY grp
      ),
      '[]'::jsonb
    )
    INTO v_payroll_groups
    FROM grouped;
  ELSE
    v_payroll_groups := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'total', v_total,
      'active', v_active,
      'completed', v_completed,
      'inProgress', v_in_progress
    ),
    'averageProgress', v_avg_progress::int,
    'completionPie', jsonb_build_array(
      jsonb_build_object('name', 'Completed', 'value', v_completed),
      jsonb_build_object('name', 'In Progress', 'value', v_in_progress),
      jsonb_build_object('name', 'Not Started', 'value', v_not_started)
    ),
    'statusDistribution', v_status_distribution,
    'divisionSummary', v_division_summary,
    'payrollGroups', v_payroll_groups
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tracker_page(
  int, int, text, text, text, text, int, int
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(int, int, text) TO authenticated;
