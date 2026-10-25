BEGIN;
SELECT plan(7);

-- ----------------------------------------------------------------------------
-- F-021 — Effets de bord serveur d'un message : dernier message, non-lus,
-- notifications. Le client n'écrit plus au nom des autres comptes.
-- ----------------------------------------------------------------------------

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0210000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'msg_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0210000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'msg_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f0210000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'msg_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0210000-0000-4000-8000-000000000001', 'Anna', 'msg_a@test.local'),
  ('f0210000-0000-4000-8000-000000000002', 'Bastien', 'msg_b@test.local'),
  ('f0210000-0000-4000-8000-000000000003', 'Clara', 'msg_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, type, name, created_by, direct_pair_key) VALUES
  ('f0210000-1000-4000-8000-000000000001', 'group', 'Groupe test F-021', 'f0210000-0000-4000-8000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversation_members (conversation_id, user_id, role, unread_count, is_muted) VALUES
  ('f0210000-1000-4000-8000-000000000001', 'f0210000-0000-4000-8000-000000000001', 'owner', 0, false),
  ('f0210000-1000-4000-8000-000000000001', 'f0210000-0000-4000-8000-000000000002', 'member', 0, false),
  ('f0210000-1000-4000-8000-000000000001', 'f0210000-0000-4000-8000-000000000003', 'member', 0, true)
ON CONFLICT DO NOTHING;

-- A envoie un message (chemin direct autorisé par la policy membres).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0210000-0000-4000-8000-000000000001';
INSERT INTO public.messages (id, conversation_id, sender_id, content, message_type)
VALUES ('f0210000-2000-4000-8000-000000000001', 'f0210000-1000-4000-8000-000000000001', 'f0210000-0000-4000-8000-000000000001', 'Bonjour le groupe', 'text');

RESET ROLE;

SELECT is(
  (SELECT last_message_at FROM public.conversations WHERE id = 'f0210000-1000-4000-8000-000000000001'),
  (SELECT created_at FROM public.messages WHERE id = 'f0210000-2000-4000-8000-000000000001'),
  '1. conversations.last_message_at = horodatage serveur du message'
);

SELECT is(
  (SELECT unread_count FROM public.conversation_members
    WHERE conversation_id = 'f0210000-1000-4000-8000-000000000001'
      AND user_id = 'f0210000-0000-4000-8000-000000000002'),
  1,
  '2. Le destinataire non muet voit unread_count = 1'
);

SELECT is(
  (SELECT unread_count FROM public.conversation_members
    WHERE conversation_id = 'f0210000-1000-4000-8000-000000000001'
      AND user_id = 'f0210000-0000-4000-8000-000000000003'),
  1,
  '3. Le membre muet compte aussi son non-lu'
);

SELECT is(
  (SELECT unread_count FROM public.conversation_members
    WHERE conversation_id = 'f0210000-1000-4000-8000-000000000001'
      AND user_id = 'f0210000-0000-4000-8000-000000000001'),
  0,
  '4. L''expéditeur ne s''auto-incrémente pas de non-lu'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0210000-0000-4000-8000-000000000002'
      AND type = 'new_message'
      AND related_id = 'f0210000-1000-4000-8000-000000000001'),
  1,
  '5. Une notification in-app pour le destinataire non muet'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0210000-0000-4000-8000-000000000003'),
  0,
  '6. Aucune notification pour un membre muet'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0210000-0000-4000-8000-000000000001'),
  0,
  '7. Aucune notification pour l''expéditeur'
);

SELECT * FROM finish();
ROLLBACK;
