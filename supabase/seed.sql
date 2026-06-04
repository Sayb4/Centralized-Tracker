-- Run after creating auth user: ocpdc_admin@ocpdc.local / adminocpdc123

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'ocpdc_admin@ocpdc.local' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE NOTICE 'Create auth user ocpdc_admin@ocpdc.local first, then re-run seed.';
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_active)
  VALUES (admin_id, 'ocpdc_admin@ocpdc.local', 'OCPDC Admin', true)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_feature_access (user_id, feature, allowed)
  VALUES
    (admin_id, 'tracker.edit', true),
    (admin_id, 'employees.manage', true),
    (admin_id, 'settings.edit', true)
  ON CONFLICT (user_id, feature) DO UPDATE SET allowed = true;
END $$;
