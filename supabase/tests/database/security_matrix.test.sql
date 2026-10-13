BEGIN;
SELECT plan(11);

-- A-213 — matrice allow/deny consolidée sur identités synthétiques
-- (messagerie, stockage, clubs, sorties, stories). Complète les suites
-- dédiées (F-001, F-003, F-020, F-027) par les recoupements inter-domaines.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a2130000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mx_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a2130000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mx_b@test.local', 'x', '{}', '{}', now(), now()),
  ('a2130000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'mx_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a2130000-0000-4000-8000-000000000001', 'Anna', 'mx_a@test.local'),
  ('a2130000-0000-4000-8000-000000000002', 'Bruno', 'mx_b@test.local'),
  ('a2130000-0000-4000-8000-000000000003', 'Chloé', 'mx_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, type, name, created_by, direct_pair_key) VALUES
  ('a2130000-1000-4000-8000-000000000001', 'direct', 'DM A-B', 'a2130000-0000-4000-8000-000000000001',
   'a2130000-0000-4000-8000-000000000001:a2130000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conversation_members (conversation_id, user_id, role) VALUES
  ('a2130000-1000-4000-8000-000000000001', 'a2130000-0000-4000-8000-000000000001', 'owner'),
  ('a2130000-1000-4000-8000-000000000001', 'a2130000-0000-4000-8000-000000000002', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO public.events (id, title, event_date, max_participants, current_participants, status, organizer_id) VALUES
  ('a2130000-2000-4000-8000-000000000001', 'Sortie matrice', CURRENT_DATE + 10, 10, 0, 'upcoming', 'a2130000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Objet storage fictif dans le dossier de la conversation A-B (propriétaire B).
INSERT INTO storage.objects (id, bucket_id, name, owner, metadata) VALUES
  ('a2130000-3000-4000-8000-000000000001', 'message-attachments',
   'a2130000-1000-4000-8000-000000000001/a2130000-0000-4000-8000-000000000002/fichier.png',
   'a2130000-0000-4000-8000-000000000002', '{"mimetype":"image/png"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── anon ───────────────────────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT is_empty(
  $$ SELECT 1 FROM public.conversations $$,
  '1. anon : aucune conversation lisible'
);
SELECT is_empty(
  $$ SELECT 1 FROM storage.objects WHERE bucket_id = 'message-attachments' $$,
  '2. anon : aucun objet de pièce jointe lisible'
);
SELECT throws_ok(
  $$ SELECT 1 FROM public.post_stories $$,
  '42501', NULL,
  '3. anon : stories inaccessibles (aucun grant)'
);
RESET ROLE;

-- ── membre B ───────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2130000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM storage.objects
    WHERE bucket_id = 'message-attachments'
      AND name LIKE 'a2130000-1000-4000-8000-000000000001/%'),
  1,
  '4. membre : lit la pièce jointe de sa conversation'
);

-- ── tiers C ────────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'a2130000-0000-4000-8000-000000000003';
SELECT is_empty(
  $$ SELECT 1 FROM storage.objects WHERE bucket_id = 'message-attachments' $$,
  '5. tiers : ne lit aucun objet de pièce jointe'
);
SELECT is_empty(
  $$ SELECT 1 FROM public.conversation_members
     WHERE conversation_id = 'a2130000-1000-4000-8000-000000000001' $$,
  '6. tiers : ne voit pas les adhésions d''une conversation privée'
);
SELECT is_empty(
  $$ SELECT 1 FROM public.messages
     WHERE conversation_id = 'a2130000-1000-4000-8000-000000000001' $$,
  '7. tiers : ne lit aucun message de la conversation A-B'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_participants (event_id, user_id)
     VALUES ('a2130000-2000-4000-8000-000000000001', 'a2130000-0000-4000-8000-000000000001') $$,
  '42501', NULL,
  '8. tiers : impossible d''inscrire quelqu''un d''autre à une sortie'
);
-- Auto-approbation d'une demande d'adhésion : refusée (statut forcé pending).
RESET ROLE;
INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('a2130000-4000-4000-8000-000000000001', 'club-matrice', 'Club matrice', 'closed', 'a2130000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2130000-0000-4000-8000-000000000003';
INSERT INTO public.club_join_requests (club_id, user_id, status) VALUES
  ('a2130000-4000-4000-8000-000000000001', 'a2130000-0000-4000-8000-000000000003', 'pending')
ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'pending';
SELECT throws_ok(
  $$ UPDATE public.club_join_requests SET status = 'approved'
      WHERE club_id = 'a2130000-4000-4000-8000-000000000001'
        AND user_id = 'a2130000-0000-4000-8000-000000000003' $$,
  '42501', NULL,
  '9. tiers : auto-approbation d''une demande d''adhésion refusée'
);
SELECT is_empty(
  $$ SELECT 1 FROM public.user_presence WHERE user_id = 'a2130000-0000-4000-8000-000000000001' $$,
  '10. tiers : aucune présence d''autrui hors battement réel (aucune ligne)'
);
UPDATE public.conversation_members SET unread_count = 99
 WHERE conversation_id = 'a2130000-1000-4000-8000-000000000001'
   AND user_id = 'a2130000-0000-4000-8000-000000000002';
RESET ROLE;
SELECT is(
  (SELECT unread_count FROM public.conversation_members
    WHERE conversation_id = 'a2130000-1000-4000-8000-000000000001'
      AND user_id = 'a2130000-0000-4000-8000-000000000002'),
  0,
  '11. tiers : l''écriture sur l''adhésion d''autrui ne passe pas'
);

SELECT * FROM finish();
ROLLBACK;
