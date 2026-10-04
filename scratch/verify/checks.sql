-- Vérifications fonctionnelles miroir des pgTAP (échec = EXCEPTION).
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.roles WHERE name IN ('super_admin','admin','moderateur')) = 3, 'roles seed';
  ASSERT (SELECT count(*) FROM public.permissions) >= 13, 'permissions seed';
  ASSERT (SELECT count(*) FROM public.role_permissions) > 0, 'role_permissions seed';
  RAISE NOTICE 'PASS seeds';
END $$;

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.user_roles
    WHERE user_id = '11111111-1111-4111-8111-111111111111') = 2, 'backfill A x2 (admin+super_admin)';
  RAISE NOTICE 'PASS backfill';
END $$;

SET app.uid = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  ASSERT public.has_permission('users.read'), 'A users.read';
  ASSERT public.has_permission('roles.grant'), 'A roles.grant via filet is_admin';
  RAISE NOTICE 'PASS has_permission A';
END $$;

SET app.uid = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
  ASSERT NOT public.has_permission('users.read'), 'B no users.read';
  ASSERT NOT public.has_permission('audit.read'), 'B no audit.read';
  RAISE NOTICE 'PASS has_permission B denied';
END $$;

-- Expiration : octroi expiré ne donne rien.
DO $$ BEGIN
  INSERT INTO public.user_roles (user_id, role_id, expires_at)
  SELECT '22222222-2222-4222-8222-222222222222', id, now() - interval '1 day'
  FROM public.roles WHERE name = 'moderateur';
END $$;
SET app.uid = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
  ASSERT NOT public.has_permission('moderation.write'), 'expired grant ignored';
  RAISE NOTICE 'PASS expiry';
END $$;
DELETE FROM public.user_roles WHERE user_id = '22222222-2222-4222-8222-222222222222';

-- Trigger auto-log sur octroi.
DO $$ DECLARE rid uuid; BEGIN
  SELECT id INTO rid FROM public.roles WHERE name = 'moderateur';
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES ('22222222-2222-4222-8222-222222222222', rid);
  ASSERT EXISTS (SELECT 1 FROM public.action_logs
    WHERE action = 'role.grant' AND target_id = '22222222-2222-4222-8222-222222222222'),
    'trigger logged grant';
  RAISE NOTICE 'PASS trigger';
END $$;

-- Backfill legacy importé (2 sources).
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.action_logs WHERE source = 'legacy:admin_audit_log') = 1, 'legacy singulier';
  ASSERT (SELECT count(*) FROM public.action_logs WHERE source = 'legacy:admin_audit_logs') = 1, 'legacy pluriel';
  RAISE NOTICE 'PASS backfill logs';
END $$;

-- Idempotence : rejouer le backfill ne duplique rien.
DO $$ BEGIN
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT up.id, r.id FROM public.user_profiles up
  JOIN public.roles r ON r.name = 'admin' WHERE up.role = 'admin'
  ON CONFLICT DO NOTHING;
  ASSERT (SELECT count(*) FROM public.user_roles
    WHERE user_id = '11111111-1111-4111-8111-111111111111') = 2, 'idempotent (admin+super_admin)';
  RAISE NOTICE 'PASS idempotence';
END $$;

-- Enforcement RLS en tant que authenticated / B (modérateur : users.read légitime).
SET ROLE authenticated;
SET app.uid = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.user_roles) = 3, 'B voit tout via users.read (moderateur)';
  RAISE NOTICE 'PASS read via permission';
END $$;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT '22222222-2222-4222-8222-222222222222', id FROM public.roles WHERE name = 'admin';
    RAISE EXCEPTION 'self-grant should have failed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS self-grant denied';
  END;
END $$;

DO $$ BEGIN
  INSERT INTO public.action_logs (actor_id, action) VALUES
    ('22222222-2222-4222-8222-222222222222', 'test.own');
  RAISE NOTICE 'PASS own insert allowed';
  BEGIN
    INSERT INTO public.action_logs (actor_id, action) VALUES
      ('11111111-1111-4111-8111-111111111111', 'test.forge');
    RAISE EXCEPTION 'forged actor should have failed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS forged actor denied';
  END;
  BEGIN
    UPDATE public.action_logs SET action = 'x' WHERE actor_id = '22222222-2222-4222-8222-222222222222';
    RAISE EXCEPTION 'update should have failed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS update denied';
  END;
  BEGIN
    DELETE FROM public.action_logs WHERE actor_id = '22222222-2222-4222-8222-222222222222';
    RAISE EXCEPTION 'delete should have failed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS delete denied';
  END;
  ASSERT (SELECT count(*) FROM public.action_logs) = 0, 'B reads zero logs';
  RAISE NOTICE 'PASS select denied for B';
END $$;

-- Isolation stricte : C (aucun rôle) ne voit que ses propres lignes (zéro).
SET app.uid = '33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.user_roles) = 0, 'C sees zero rows';
  RAISE NOTICE 'PASS strict isolation C';
END $$;

RESET ROLE;
SET app.uid = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.action_logs) >= 4, 'A reads all logs via audit.read';
  RAISE NOTICE 'PASS admin read all';
END $$;

SELECT 'ALL CHECKS PASSED' AS resultat;
