BEGIN;
SELECT plan(18);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — lot C + phase 2 : sorties, liste d'attente (20261108130003,
-- 20261108130007). Couvre : join_event identique sans liste d'attente,
-- waitlist quand complet + activée, promotion du plus ancien au départ,
-- compteur = confirmés seulement, refus de changement de statut (auto-promotion
-- et tiers), contrat jsonb {registered, current_participants, status, waitlisted},
-- événements annulés/terminés.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('e7e10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'wait_a@test.local', 'x', '{}', '{}', now(), now()),
  ('e7e10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'wait_b@test.local', 'x', '{}', '{}', now(), now()),
  ('e7e10000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'wait_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('e7e10000-0000-4000-8000-000000000001', 'Inès Organisatrice', 'wait_a@test.local'),
  ('e7e10000-0000-4000-8000-000000000002', 'Jules Inscrit', 'wait_b@test.local'),
  ('e7e10000-0000-4000-8000-000000000003', 'Karim Attente', 'wait_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, event_date, starts_at, organizer_id, status, max_participants, waitlist_enabled) VALUES
  -- Complet + liste d'attente activée (2 places).
  ('e7e20000-0000-4000-8000-000000000001', 'Sortie avec attente', CURRENT_DATE + 3, now() + interval '3 days',
   'e7e10000-0000-4000-8000-000000000001', 'upcoming', 2, true),
  -- Complet sans liste d'attente (1 place).
  ('e7e20000-0000-4000-8000-000000000002', 'Sortie sans attente', CURRENT_DATE + 3, now() + interval '3 days',
   'e7e10000-0000-4000-8000-000000000001', 'upcoming', 1, false),
  -- Complet + attente : une seule place, occupée par A, pour l'auto-promotion.
  ('e7e20000-0000-4000-8000-000000000003', 'Sortie auto-promotion', CURRENT_DATE + 4, now() + interval '4 days',
   'e7e10000-0000-4000-8000-000000000001', 'upcoming', 1, true),
  -- Annulée.
  ('e7e20000-0000-4000-8000-000000000004', 'Sortie annulée attente', CURRENT_DATE + 2, now() + interval '2 days',
   'e7e10000-0000-4000-8000-000000000001', 'cancelled', 5, true),
  -- Terminée.
  ('e7e20000-0000-4000-8000-000000000005', 'Sortie terminée attente', CURRENT_DATE - 2, now() - interval '2 days',
   'e7e10000-0000-4000-8000-000000000001', 'past', 5, true)
ON CONFLICT (id) DO NOTHING;

-- Pré-remplissage : la place unique de la sortie auto-promotion est occupée.
INSERT INTO public.event_participants (event_id, user_id, status) VALUES
  ('e7e20000-0000-4000-8000-000000000002', 'e7e10000-0000-4000-8000-000000000001', 'confirmed'),
  ('e7e20000-0000-4000-8000-000000000003', 'e7e10000-0000-4000-8000-000000000001', 'confirmed'),
  ('e7e20000-0000-4000-8000-000000000005', 'e7e10000-0000-4000-8000-000000000001', 'confirmed')
ON CONFLICT (event_id, user_id) DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1-4 : inscription nominale, sans liste d'attente ──────────────────────
SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ->> 'registered'),
  'true',
  '1. join_event : inscription confirmée quand une place existe'
);
SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ->> 'current_participants'),
  '2',
  '2. join_event : compteur à jour (2 confirmés)'
);
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ->> 'status'),
  'full',
  '3. join_event : la sortie passe « complète »'
);
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ? 'waitlisted'),
  true,
  '4. join_event : le contrat expose la clé waitlisted'
);

-- ── 5-6 : complet sans liste d'attente = refus ────────────────────────────
SELECT throws_ok(
  $$ SELECT public.join_event('e7e20000-0000-4000-8000-000000000002') $$,
  'P0001',
  NULL,
  '5. join_event : refus quand complet et liste d''attente désactivée'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_participants (event_id, user_id, status)
     VALUES ('e7e20000-0000-4000-8000-000000000002', 'e7e10000-0000-4000-8000-000000000002', 'waitlist') $$,
  'P0001',
  NULL,
  '6. Insertion directe : waitlist refusée si waitlist_enabled = false'
);

-- ── 7-10 : liste d'attente réelle + promotion ─────────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ->> 'waitlisted'),
  'true',
  '7. join_event : complet + liste d''attente activée → waitlist'
);
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ->> 'registered'),
  'false',
  '8. join_event : un inscrit en attente n''est pas « registered »'
);
SELECT is(
  (SELECT status FROM public.event_participants
    WHERE event_id = 'e7e20000-0000-4000-8000-000000000001'
      AND user_id = 'e7e10000-0000-4000-8000-000000000003'),
  'waitlist',
  '9. La ligne est bien stockée en waitlist'
);
SELECT is(
  (SELECT count(*)::int FROM public.event_participants
    WHERE event_id = 'e7e20000-0000-4000-8000-000000000001' AND status = 'confirmed'),
  2,
  '10. Le compteur ne compte que les confirmés (2)'
);

-- A (occupant la 1re place) part : C, seul en attente, est promu.
SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.leave_event('e7e20000-0000-4000-8000-000000000001') ->> 'promoted') IS NOT NULL,
  true,
  '11. leave_event : la place libérée est proposée à un inscrit en attente'
);
SELECT is(
  (SELECT count(*)::int FROM public.event_participants
    WHERE event_id = 'e7e20000-0000-4000-8000-000000000001' AND status = 'waitlist'),
  0,
  '12. leave_event : plus personne en attente après promotion'
);
-- La personne promue (C) rejoint : idempotent et confirmé.
SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000001') ->> 'registered'),
  'true',
  '13. L''inscription de la personne promue est idempotente et confirmée'
);

-- ── 14-16 : un tiers ne peut pas changer le statut ────────────────────────
SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ UPDATE public.event_participants SET status = 'waitlist'
      WHERE event_id = 'e7e20000-0000-4000-8000-000000000001'
        AND user_id = 'e7e10000-0000-4000-8000-000000000002' $$,
  '42501',
  NULL,
  '14. Un inscrit ne peut pas modifier son propre statut'
);

SET LOCAL "request.jwt.claim.sub" = 'e7e10000-0000-4000-8000-000000000003';
-- C est sur liste d'attente de la sortie auto-promotion.
SELECT is(
  (SELECT public.join_event('e7e20000-0000-4000-8000-000000000003') ->> 'waitlisted'),
  'true',
  '15. C rejoint la liste d''attente de la sortie auto-promotion'
);
SELECT throws_ok(
  $$ UPDATE public.event_participants SET status = 'confirmed'
      WHERE event_id = 'e7e20000-0000-4000-8000-000000000003'
        AND user_id = 'e7e10000-0000-4000-8000-000000000003' $$,
  '42501',
  NULL,
  '16. Auto-promotion waitlist → confirmé interdite'
);
SELECT is(
  (SELECT count(*)::int FROM public.event_participants
    WHERE event_id = 'e7e20000-0000-4000-8000-000000000003' AND status = 'confirmed'),
  1,
  '17. Un tiers (ou soi-même) ne modifie pas le statut d''autrui'
);

-- ── 18 : annulée / terminée refusées ──────────────────────────────────────
SELECT throws_ok(
  $$ SELECT public.join_event('e7e20000-0000-4000-8000-000000000004') $$,
  'P0001',
  NULL,
  '18. join_event refuse une sortie annulée'
);

SELECT * FROM finish();
ROLLBACK;
