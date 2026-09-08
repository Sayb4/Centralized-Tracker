-- Migrate legacy admin email to Gmail address
DO $$
DECLARE
  legacy_id uuid;
  keeper_id uuid;
  target_email text := 'iloilo.cpdo.it@gmail.com';
  legacy_email text := 'ocpdc_admin@ocpdc.local';
BEGIN
  SELECT id INTO legacy_id FROM auth.users WHERE email = legacy_email LIMIT 1;
  SELECT id INTO keeper_id FROM auth.users WHERE email = target_email LIMIT 1;

  IF legacy_id IS NOT NULL
     AND keeper_id IS NOT NULL
     AND legacy_id IS DISTINCT FROM keeper_id THEN
    -- Both accounts exist: keep the Gmail user (may own checklist data) and retire legacy.
    UPDATE public.payroll_checklists
    SET updated_by = keeper_id
    WHERE updated_by = legacy_id;

    UPDATE public.custom_checklist_values
    SET updated_by = keeper_id
    WHERE updated_by = legacy_id;

    UPDATE public.audit_log
    SET actor_id = keeper_id
    WHERE actor_id = legacy_id;

    UPDATE public.audit_log
    SET actor_email = target_email
    WHERE actor_email = legacy_email;

    INSERT INTO public.profiles (id, email, full_name, is_active)
    SELECT keeper_id, target_email, p.full_name, p.is_active
    FROM public.profiles p
    WHERE p.id = legacy_id
    ON CONFLICT (id) DO UPDATE
    SET
      email = target_email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      is_active = true;

    INSERT INTO public.user_roles (user_id, role)
    SELECT keeper_id, role
    FROM public.user_roles
    WHERE user_id = legacy_id
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_feature_access (user_id, feature, allowed)
    SELECT keeper_id, feature, allowed
    FROM public.user_feature_access
    WHERE user_id = legacy_id
    ON CONFLICT (user_id, feature) DO UPDATE
    SET allowed = user_feature_access.allowed OR EXCLUDED.allowed;

    DELETE FROM auth.identities WHERE user_id = legacy_id;
    DELETE FROM auth.users WHERE id = legacy_id;

  ELSIF legacy_id IS NOT NULL AND keeper_id IS NULL THEN
    UPDATE auth.users
    SET
      email = target_email,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('email', target_email)
    WHERE id = legacy_id;

    UPDATE auth.identities
    SET
      provider_id = target_email,
      identity_data = jsonb_set(
        coalesce(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(target_email)
      )
    WHERE user_id = legacy_id;

    UPDATE public.profiles
    SET email = target_email
    WHERE id = legacy_id;
  END IF;

  UPDATE public.profiles
  SET email = target_email
  WHERE email = legacy_email;
END $$;
