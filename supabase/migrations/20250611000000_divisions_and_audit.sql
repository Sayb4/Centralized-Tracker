-- Divisions table, audit trigger fixes, custom field auditing

CREATE TABLE public.divisions (
  name text PRIMARY KEY,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO public.divisions (name, sort_order) VALUES
  ('Admin', 0),
  ('Sectoral', 1),
  ('PPDIV', 2),
  ('IMD', 3),
  ('Traffic', 4)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.divisions (name, sort_order, active)
SELECT DISTINCT e.division, 100, true
FROM public.employees e
WHERE e.division IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.divisions d WHERE d.name = e.division
  )
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_division_fkey
  FOREIGN KEY (division) REFERENCES public.divisions (name);

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY divisions_select ON public.divisions FOR SELECT TO authenticated USING (true);
CREATE POLICY divisions_admin ON public.divisions FOR ALL TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

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

  SELECT p.email INTO v_actor_email
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF v_actor_email IS NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  END IF;

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

CREATE TRIGGER audit_custom_checklist_fields
  AFTER INSERT OR UPDATE OR DELETE ON public.custom_checklist_fields
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
