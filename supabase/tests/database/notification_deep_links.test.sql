BEGIN;
SELECT plan(1);

-- A-183 — la notification de message pointe vers la discussion exacte.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a1830000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dl_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a1830000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dl_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a1830000-0000-4000-8000-000000000001', 'Dora', 'dl_a@test.local'),
  ('a1830000-0000-4000-8000-000000000002', 'Eli', 'dl_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, type, name, created_by) VALUES
  ('a1830000-1000-4000-8000-000000000001', 'group', 'Conv deep link', 'a1830000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conversation_members (conversation_id, user_id, role) VALUES
  ('a1830000-1000-4000-8000-000000000001', 'a1830000-0000-4000-8000-000000000001', 'owner'),
  ('a1830000-1000-4000-8000-000000000001', 'a1830000-0000-4000-8000-000000000002', 'member')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1830000-0000-4000-8000-000000000001';
INSERT INTO public.messages (conversation_id, sender_id, content)
VALUES ('a1830000-1000-4000-8000-000000000001', 'a1830000-0000-4000-8000-000000000001', 'Deep link ?');
RESET ROLE;

SELECT is(
  (SELECT link FROM public.notifications
    WHERE user_id = 'a1830000-0000-4000-8000-000000000002' AND type = 'new_message'
    LIMIT 1),
  '/messagerie?conversation=a1830000-1000-4000-8000-000000000001',
  '1. Le lien de notification cible la conversation exacte'
);

SELECT * FROM finish();
ROLLBACK;
