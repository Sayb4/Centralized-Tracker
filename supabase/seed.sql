-- Assign admin role/profile to the auth user matching VITE_ADMIN_EMAIL.
-- Create that user first in Supabase Authentication (Users), then run this seed.

DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'iloilo.cpdo.it@gmail.com';
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = admin_email LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE NOTICE 'Create auth user % first (must match VITE_ADMIN_EMAIL), then re-run seed.', admin_email;
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_active)
  VALUES (admin_id, admin_email, 'OCPDC Admin', true)
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
