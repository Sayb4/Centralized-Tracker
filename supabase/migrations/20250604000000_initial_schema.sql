-- OCPDC Payroll Tracker — initial schema

CREATE TYPE app_role AS ENUM ('admin', 'manager', 'user');
CREATE TYPE checklist_status AS ENUM (
  'not_yet_submitted',
  'submitted',
  'not_needed',
  'completed'
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  division text NOT NULL,
  position text,
  payroll_group text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.user_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, feature)
);

CREATE TABLE public.payroll_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  certificate_of_appearance checklist_status NOT NULL DEFAULT 'not_yet_submitted',
  special_order checklist_status NOT NULL DEFAULT 'not_yet_submitted',
  override_status checklist_status NOT NULL DEFAULT 'not_yet_submitted',
  leave_application checklist_status NOT NULL DEFAULT 'not_yet_submitted',
  progress_override int CHECK (progress_override >= 0 AND progress_override <= 100),
  notes text,
  updated_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

CREATE TABLE public.custom_checklist_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  tracker_windows text[] NOT NULL DEFAULT ARRAY['payroll']::text[]
);

CREATE TABLE public.custom_checklist_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.custom_checklist_fields (id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  status checklist_status NOT NULL DEFAULT 'not_yet_submitted',
  updated_by uuid REFERENCES auth.users (id),
  UNIQUE (employee_id, field_id, year, month)
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_checklists_period ON public.payroll_checklists (year, month);
CREATE INDEX idx_custom_checklist_values_period ON public.custom_checklist_values (year, month);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor_email ON public.audit_log (actor_email);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payroll_checklists_updated_at
  BEFORE UPDATE ON public.payroll_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_actor_id := auth.uid();
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id::text;
    v_before := to_jsonb(OLD);
    v_after := NULL;
    INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before, after)
    VALUES (v_actor_id, v_actor_email, 'DELETE', TG_TABLE_NAME, v_entity_id, v_before, v_after);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id::text;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before, after)
    VALUES (v_actor_id, v_actor_email, 'UPDATE', TG_TABLE_NAME, v_entity_id, v_before, v_after);
    RETURN NEW;
  ELSE
    v_entity_id := NEW.id::text;
    v_before := NULL;
    v_after := to_jsonb(NEW);
    INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before, after)
    VALUES (v_actor_id, v_actor_email, 'INSERT', TG_TABLE_NAME, v_entity_id, v_before, v_after);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_payroll_checklists
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_checklists
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_custom_checklist_values
  AFTER INSERT OR UPDATE OR DELETE ON public.custom_checklist_values
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid DEFAULT auth.uid())
RETURNS app_role[] AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::app_role[])
  FROM public.user_roles WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(p_role app_role)
RETURNS boolean AS $$
  SELECT p_role = ANY(public.get_user_roles());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_feature(p_feature text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_feature_access
    WHERE user_id = auth.uid() AND feature = p_feature AND allowed = true
  ) OR public.has_role('admin'::app_role);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_checklist_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_checklist_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY employees_insert ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin') OR public.has_role('manager'));
CREATE POLICY employees_update ON public.employees FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('manager'));
CREATE POLICY employees_delete ON public.employees FOR DELETE TO authenticated
  USING (public.has_role('admin') OR public.has_role('manager'));

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role('admin'));

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin') OR public.has_role('manager'));

CREATE POLICY feature_access_select ON public.user_feature_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'));

CREATE POLICY checklists_select ON public.payroll_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY checklists_insert ON public.payroll_checklists FOR INSERT TO authenticated
  WITH CHECK (public.has_feature('tracker.edit') OR public.has_role('admin') OR public.has_role('manager'));
CREATE POLICY checklists_update ON public.payroll_checklists FOR UPDATE TO authenticated
  USING (public.has_feature('tracker.edit') OR public.has_role('admin') OR public.has_role('manager'));

CREATE POLICY custom_fields_select ON public.custom_checklist_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY custom_fields_admin ON public.custom_checklist_fields FOR ALL TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

CREATE POLICY custom_values_select ON public.custom_checklist_values FOR SELECT TO authenticated USING (true);
CREATE POLICY custom_values_write ON public.custom_checklist_values FOR ALL TO authenticated
  USING (public.has_feature('tracker.edit') OR public.has_role('admin') OR public.has_role('manager'))
  WITH CHECK (public.has_feature('tracker.edit') OR public.has_role('admin') OR public.has_role('manager'));

CREATE POLICY audit_log_deny ON public.audit_log FOR ALL TO authenticated USING (false);
