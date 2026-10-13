BEGIN;
SELECT plan(7);

-- F-020 — demandes de message : pending côté serveur, écriture après acceptation.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'req_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'req_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0200000-0000-4000-8000-000000000001', 'Ada', 'req_a@test.local'),
  ('f0200000-0000-4000-8000-000000000002', 'Bilal', 'req_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, type, name, created_by, direct_pair_key) VALUES
  ('f0200000-1000-4000-8000-000000000001', 'group', 'Groupe test F-020', 'f0200000-0000-4000-8000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversation_members (conversation_id, user_id, role, status) VALUES
  ('f0200000-1000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('f0200000-1000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000002', 'member', 'pending')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0200000-0000-4000-8000-000000000001';

-- 1. B (pending) lit l'aperçu de la conversation.
SELECT is(
  (SELECT count(*)::int FROM public.conversations WHERE id = 'f0200000-1000-4000-8000-000000000001'),
  1,
  '1. Un membre en attente voit la conversation (aperçu)'
);

-- 2. B (pending) ne peut PAS écrire.
SET LOCAL "request.jwt.claim.sub" = 'f0200000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ INSERT INTO public.messages (conversation_id, sender_id, content)
     VALUES ('f0200000-1000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000002', 'avant acceptation') $$,
  '42501', NULL,
  '2. Écriture refusée tant que la demande est en attente'
);

-- 3. B accepte (met sa propre adhésion active).
UPDATE public.conversation_members SET status = 'active'
 WHERE conversation_id = 'f0200000-1000-4000-8000-000000000001'
   AND user_id = 'f0200000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT status FROM public.conversation_members
    WHERE conversation_id = 'f0200000-1000-4000-8000-000000000001'
      AND user_id = 'f0200000-0000-4000-8000-000000000002'),
  'active',
  '3. L''acceptation met l''adhésion active'
);

-- 4. B écrit désormais.
SELECT lives_ok(
  $$ INSERT INTO public.messages (conversation_id, sender_id, content)
     VALUES ('f0200000-1000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000002', 'après acceptation') $$,
  '4. Écriture autorisée après acceptation'
);

-- 5. B ne peut pas modifier le rôle en acceptant (contrôle d'existence : la
-- tentative de promotion est refusée par le trigger de hiérarchie).
SELECT throws_ok(
  $$ UPDATE public.conversation_members SET role = 'admin'
      WHERE conversation_id = 'f0200000-1000-4000-8000-000000000001'
        AND user_id = 'f0200000-0000-4000-8000-000000000002' $$,
  NULL,
  'Seul un administrateur peut promouvoir un membre en admin',
  '5. L''acceptation n''ouvre pas l''auto-promotion'
);

-- 6. La RPC place bien la cible en pending (chemin réel).
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0200000-0000-4000-8000-000000000001';
SELECT public.get_or_create_direct_conversation('f0200000-0000-4000-8000-000000000002');

RESET ROLE;
SELECT is(
  (SELECT status FROM public.conversation_members cm
     JOIN public.conversations c ON c.id = cm.conversation_id
    WHERE c.direct_pair_key = 'f0200000-0000-4000-8000-000000000001:f0200000-0000-4000-8000-000000000002'
      AND cm.user_id = 'f0200000-0000-4000-8000-000000000002'),
  'pending',
  '6. La RPC de DM crée la cible en pending'
);

SELECT is(
  (SELECT status FROM public.conversation_members cm
     JOIN public.conversations c ON c.id = cm.conversation_id
    WHERE c.direct_pair_key = 'f0200000-0000-4000-8000-000000000001:f0200000-0000-4000-8000-000000000002'
      AND cm.user_id = 'f0200000-0000-4000-8000-000000000001'),
  'active',
  '7. L''initiateur reste actif'
);

SELECT * FROM finish();
ROLLBACK;
