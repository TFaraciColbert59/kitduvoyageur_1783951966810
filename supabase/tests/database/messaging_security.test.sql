BEGIN;
SELECT plan(15);

-- ----------------------------------------------------------------------------
-- FIXTURES TEMPORAIRES (ISOLÉES DANS LA TRANSACTION DU TEST)
-- ----------------------------------------------------------------------------
INSERT INTO public.user_profiles (id, full_name, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Utilisateur A', 'user_a@test.local'),
    ('22222222-2222-2222-2222-222222222222', 'Utilisateur B', 'user_b@test.local'),
    ('33333333-3333-3333-3333-333333333333', 'Utilisateur C (Tiers)', 'user_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, type, title, created_by, direct_pair_key) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'direct', 'DM A-B', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversation_members (id, conversation_id, user_id, role) VALUES
    ('cm111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner'),
    ('cm222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'member')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
    ('m1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Message de A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_reactions (id, message_id, user_id, reaction_value) VALUES
    ('r1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '👍')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- EXECUTION DES ASSERTIONS PGTAP (15/15)
-- ----------------------------------------------------------------------------

-- Test 1 : Anonyme ne peut pas lire conversations
SET LOCAL ROLE anon;
SELECT is_empty(
    'SELECT * FROM public.conversations',
    '1. Un utilisateur anonyme ne voit aucune conversation'
);

-- Test 2 : Membre A voit sa conversation
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT ok(
    EXISTS (SELECT 1 FROM public.conversations WHERE id = 'c1111111-1111-1111-1111-111111111111'),
    '2. Membre A peut lire sa propre conversation'
);

-- Test 3 : Non-membre C ne voit pas la conversation A-B
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SELECT is_empty(
    'SELECT * FROM public.conversations WHERE id = ''c1111111-1111-1111-1111-111111111111''',
    '3. Non-membre C ne voit pas la conversation A-B'
);

-- Test 4 : Usurpation d expéditeur rejetée
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT throws_ok(
    $$ INSERT INTO public.messages (conversation_id, sender_id, content) VALUES ('c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Usurpation') $$,
    'new row violates row-level security policy for table "messages"',
    '4. Membre A ne peut pas envoyer un message au nom de B'
);

-- Test 5 : Déplacement de conversation_id bloqué par Trigger
SELECT throws_ok(
    $$ UPDATE public.messages SET conversation_id = 'c2222222-2222-2222-2222-222222222222' WHERE id = 'm1111111-1111-1111-1111-111111111111' $$,
    'Impossible de déplacer un message vers une autre conversation',
    '5. Auteur A ne peut pas déplacer son message vers une autre conversation'
);

-- Test 6 : Non-membre C ne voit pas les messages de A-B
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SELECT is_empty(
    'SELECT * FROM public.messages WHERE conversation_id = ''c1111111-1111-1111-1111-111111111111''',
    '6. Non-membre C ne voit pas les messages A-B'
);

-- Test 7 : Auto-ajout arbitraire à une conversation refusé par RLS
SELECT throws_ok(
    $$ INSERT INTO public.conversation_members (conversation_id, user_id, role) VALUES ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'member') $$,
    'new row violates row-level security policy for table "conversation_members"',
    '7. Utilisateur C ne peut pas s auto-ajouter à la conversation A-B'
);

-- Test 8 : Auto-promotion de rôle bloquée par Trigger
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT throws_ok(
    $$ UPDATE public.conversation_members SET role = 'owner' WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
    'Seul le propriétaire de la conversation peut gérer le rôle owner',
    '8. Membre B ne peut pas s auto-promouvoir owner'
);

-- Test 9 : Modification de membre tiers par un membre simple refusée
SELECT throws_ok(
    $$ UPDATE public.conversation_members SET is_muted = true WHERE user_id = '11111111-1111-1111-1111-111111111111' $$,
    'new row violates row-level security policy for table "conversation_members"',
    '9. Membre B ne peut pas modifier la ligne de A'
);

-- Test 10 : DELETE non autorisé sur message affecte 0 ligne
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
DELETE FROM public.messages WHERE id = 'm1111111-1111-1111-1111-111111111111';
SELECT ok(
    EXISTS (SELECT 1 FROM public.messages WHERE id = 'm1111111-1111-1111-1111-111111111111'),
    '10. Tentative de DELETE par non-membre C laisse le message intact'
);

-- Test 11 : DELETE non autorisé sur réaction affecte 0 ligne
SELECT throws_ok(
    $$ DELETE FROM public.message_reactions WHERE id = 'r1111111-1111-1111-1111-111111111111' $$,
    'new row violates row-level security policy for table "message_reactions"',
    '11. Utilisateur C ne peut pas supprimer la réaction de B'
);

-- Test 12 : RPC is_conversation_member refusé pour anon
SET LOCAL ROLE anon;
SELECT throws_ok(
    $$ SELECT public.is_conversation_member('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') $$,
    'permission denied for function is_conversation_member',
    '12. Anonyme ne peut pas exécuter is_conversation_member'
);

-- Test 13 : RPC get_or_create_direct_conversation refusé pour anon
SELECT throws_ok(
    $$ SELECT public.get_or_create_direct_conversation('22222222-2222-2222-2222-222222222222') $$,
    'permission denied for function get_or_create_direct_conversation',
    '13. Anonyme ne peut pas exécuter get_or_create_direct_conversation'
);

-- Test 14 : Self-DM refusé par RPC
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT throws_ok(
    $$ SELECT public.get_or_create_direct_conversation('11111111-1111-1111-1111-111111111111') $$,
    'Impossible de créer une conversation directe avec vous-même',
    '14. Utilisateur A ne peut pas démarrer un DM avec lui-même'
);

-- Test 15 : Protection Storage - Accès anonyme refusé
SET LOCAL ROLE anon;
SELECT is_empty(
    'SELECT * FROM storage.objects WHERE bucket_id = ''message-attachments''',
    '15. Anonyme ne peut accéder à aucun objet du bucket message-attachments'
);

SELECT * FROM finish();
ROLLBACK;
