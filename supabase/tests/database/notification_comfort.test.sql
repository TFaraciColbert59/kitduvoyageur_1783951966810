BEGIN;
SELECT plan(6);

-- A-186/A-187/A-188 — confort et vie privée des notifications.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a1860000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'nc_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a1860000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'nc_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a1860000-0000-4000-8000-000000000001', 'Nina', 'nc_a@test.local'),
  ('a1860000-0000-4000-8000-000000000002', 'Noam', 'nc_b@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1-2. Regroupement : deux commentaires non lus → une seule ligne (×2).
INSERT INTO public.notifications (user_id, type, title, message, related_id)
VALUES ('a1860000-0000-4000-8000-000000000001', 'comment', 'Nouveau commentaire', 'Nina a commenté', 'a1860000-9000-4000-8000-000000000001');
INSERT INTO public.notifications (user_id, type, title, message, related_id)
VALUES ('a1860000-0000-4000-8000-000000000001', 'comment', 'Nouveau commentaire', 'Nina a commenté', 'a1860000-9000-4000-8000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'a1860000-0000-4000-8000-000000000001' AND type = 'comment'),
  1,
  '1. Deux commentaires rapprochés → une seule notification'
);
SELECT is(
  (SELECT message FROM public.notifications
    WHERE user_id = 'a1860000-0000-4000-8000-000000000001' AND type = 'comment'),
  'Nina a commenté (×2)',
  '2. Le compteur de regroupement est visible (×2)'
);

-- 3. Une notification lue n'absorbe plus les suivantes.
UPDATE public.notifications SET read = true
 WHERE user_id = 'a1860000-0000-4000-8000-000000000001' AND type = 'comment';
INSERT INTO public.notifications (user_id, type, title, message, related_id)
VALUES ('a1860000-0000-4000-8000-000000000001', 'comment', 'Nouveau commentaire', 'Nina a commenté', 'a1860000-9000-4000-8000-000000000001');
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'a1860000-0000-4000-8000-000000000001' AND type = 'comment'),
  2,
  '3. Une notification lue n''absorbe plus'
);

-- 4. Les messages privés restent individuels (jamais regroupés).
INSERT INTO public.notifications (user_id, type, title, message, related_id)
VALUES ('a1860000-0000-4000-8000-000000000002', 'new_message', 'Nouveau message LKDV', 'Salut', 'a1860000-9000-4000-8000-000000000002');
INSERT INTO public.notifications (user_id, type, title, message, related_id)
VALUES ('a1860000-0000-4000-8000-000000000002', 'new_message', 'Nouveau message LKDV', 'Encore', 'a1860000-9000-4000-8000-000000000002');
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'a1860000-0000-4000-8000-000000000002' AND type = 'new_message'),
  2,
  '4. Les messages privés ne sont jamais regroupés'
);

-- 5. A-187 : aperçu push désactivé par défaut.
SELECT is(
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_preferences'
      AND column_name = 'push_preview_enabled'),
  'false',
  '5. L''aperçu sur écran verrouillé est désactivé par défaut'
);

-- 6. A-186 : la livraison peut être reportée hors heures calmes.
SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_deliveries'
      AND column_name = 'scheduled_after'),
  1,
  '6. notification_deliveries peut être reportée (scheduled_after)'
);

SELECT * FROM finish();
ROLLBACK;
