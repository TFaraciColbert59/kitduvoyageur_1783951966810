BEGIN;
SELECT plan(6);

-- F-019 / F-020 — dernier message borné + mute temporaire réel.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0190000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inbox_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0190000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'inbox_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f0190000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'inbox_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0190000-0000-4000-8000-000000000001', 'Inès', 'inbox_a@test.local'),
  ('f0190000-0000-4000-8000-000000000002', 'Paul', 'inbox_b@test.local'),
  ('f0190000-0000-4000-8000-000000000003', 'Zoé', 'inbox_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, type, name, created_by, direct_pair_key) VALUES
  ('f0190000-1000-4000-8000-000000000001', 'direct', 'DM A-B', 'f0190000-0000-4000-8000-000000000001', 'f0190000-0000-4000-8000-000000000001:f0190000-0000-4000-8000-000000000002'),
  ('f0190000-1000-4000-8000-000000000002', 'direct', 'DM A-C', 'f0190000-0000-4000-8000-000000000001', 'f0190000-0000-4000-8000-000000000001:f0190000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversation_members (conversation_id, user_id, role, is_muted, mute_until) VALUES
  ('f0190000-1000-4000-8000-000000000001', 'f0190000-0000-4000-8000-000000000001', 'owner', false, NULL),
  ('f0190000-1000-4000-8000-000000000001', 'f0190000-0000-4000-8000-000000000002', 'member', true, now() + interval '2 hours'),
  ('f0190000-1000-4000-8000-000000000002', 'f0190000-0000-4000-8000-000000000001', 'owner', false, NULL),
  ('f0190000-1000-4000-8000-000000000002', 'f0190000-0000-4000-8000-000000000003', 'member', true, now() - interval '2 hours')
ON CONFLICT DO NOTHING;

INSERT INTO public.messages (id, conversation_id, sender_id, content, created_at) VALUES
  ('f0190000-2000-4000-8000-000000000001', 'f0190000-1000-4000-8000-000000000001', 'f0190000-0000-4000-8000-000000000001', 'Premier', now() - interval '2 hours'),
  ('f0190000-2000-4000-8000-000000000002', 'f0190000-1000-4000-8000-000000000001', 'f0190000-0000-4000-8000-000000000002', 'Dernier A-B', now() - interval '1 hour'),
  ('f0190000-2000-4000-8000-000000000003', 'f0190000-1000-4000-8000-000000000002', 'f0190000-0000-4000-8000-000000000001', 'Dernier A-C', now() - interval '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- F-019 : projection du dernier message (appelée par A, membre des deux).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0190000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM public.get_last_messages(ARRAY[
    'f0190000-1000-4000-8000-000000000001'::uuid,
    'f0190000-1000-4000-8000-000000000002'::uuid])),
  2,
  '1. Un dernier message par conversation (deux lignes)'
);

SELECT is(
  (SELECT content FROM public.get_last_messages(ARRAY['f0190000-1000-4000-8000-000000000001'::uuid])
    WHERE conversation_id = 'f0190000-1000-4000-8000-000000000001'),
  'Dernier A-B',
  '2. C''est bien le message le plus récent'
);

-- B (membre de A-B uniquement) ne voit que sa conversation.
SET LOCAL "request.jwt.claim.sub" = 'f0190000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.get_last_messages(ARRAY[
    'f0190000-1000-4000-8000-000000000001'::uuid,
    'f0190000-1000-4000-8000-000000000002'::uuid])),
  1,
  '3. La RLS borne la projection aux conversations du membre'
);

-- F-020 : mute temporaire actif → aucune notification.
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE user_id = 'f0190000-0000-4000-8000-000000000002'),
  0,
  '4. Mute temporaire en cours : aucune notification (messages insérés avant trigger)'
);

-- Mute expiré (Zoé) : chaque message produit sa notification (le message de
-- fixture « Dernier A-C » en a déjà produit une ; le nouveau en ajoute une).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0190000-0000-4000-8000-000000000001';
INSERT INTO public.messages (id, conversation_id, sender_id, content)
VALUES ('f0190000-2000-4000-8000-000000000004', 'f0190000-1000-4000-8000-000000000002', 'f0190000-0000-4000-8000-000000000001', 'Après expiration du mute');
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0190000-0000-4000-8000-000000000003' AND type = 'new_message'),
  2,
  '5. Mute expiré : la notification reprend à chaque message'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0190000-0000-4000-8000-000000000002' AND type = 'new_message'),
  0,
  '6. Mute toujours actif : toujours aucune notification'
);

SELECT * FROM finish();
ROLLBACK;
