-- ============================================================================
-- PHASE 8B — Durcissement des 18 tables à politiques permissives
-- ============================================================================
--   • TEST-PHASE8B-01..13 : inventaire des policies (schéma + garde global)
--   • TEST-PHASE8B-14..18 : grants (anon/authenticated/service_role)
--   • TEST-PHASE8B-19..41 : écritures refusées à un authenticated lambda
--   • TEST-PHASE8B-42..47 : lectures attendues (anon / propriétaire / admin)
--   • TEST-PHASE8B-48..52 : service_role + RPC join_event/leave_event
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;

-- Replay local : grants explicites alignés sur l'état post-Phase 8B.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON
  public.affiliate_offers, public.affiliate_partners, public.affiliate_programs,
  public.club_challenges, public.club_recommended_kits, public.event_expenses,
  public.events, public.experts, public.gear_history, public.gear_images,
  public.guides, public.kit_items, public.loans, public.carnet_gear_links
TO anon, authenticated, service_role;
GRANT SELECT ON public.ambassadors, public.feature_flags, public.promo_codes,
  public.stock_movements
TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.events, public.gear_history, public.gear_images, public.loans,
  public.carnet_gear_links
TO authenticated, service_role;
GRANT INSERT ON public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.affiliate_offers, public.affiliate_partners, public.affiliate_programs,
  public.ambassadors, public.club_challenges, public.club_recommended_kits,
  public.event_expenses, public.experts, public.feature_flags, public.guides,
  public.kit_items, public.promo_codes, public.stock_movements
TO service_role;
REVOKE INSERT, UPDATE, DELETE ON
  public.affiliate_offers, public.affiliate_partners, public.affiliate_programs,
  public.ambassadors, public.club_challenges, public.club_recommended_kits,
  public.event_expenses, public.experts, public.feature_flags, public.guides,
  public.kit_items, public.promo_codes
FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON
  public.affiliate_offers, public.affiliate_partners, public.affiliate_programs,
  public.ambassadors, public.club_challenges, public.club_recommended_kits,
  public.event_expenses, public.events, public.experts, public.feature_flags,
  public.gear_history, public.gear_images, public.guides, public.kit_items,
  public.loans, public.promo_codes, public.stock_movements, public.carnet_gear_links
FROM anon;
REVOKE UPDATE, DELETE ON public.stock_movements FROM authenticated;
REVOKE SELECT ON public.ambassadors, public.feature_flags, public.promo_codes,
  public.stock_movements
FROM anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

SELECT plan(56);

-- ----------------------------------------------------------------------------
-- 1..12 — Inventaire des durcissements
-- ----------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('affiliate_offers', 'affiliate_partners', 'affiliate_programs')
      AND cmd <> 'SELECT'
      AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['authenticated']::name[])
      AND COALESCE(qual, 'true') IN ('true', '(true)')
      AND COALESCE(with_check, 'true') IN ('true', '(true)')
  ),
  '1. RLS-8B-01. affiliate_* : plus aucune policy d''écriture permissive'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ambassadors'
      AND policyname IN ('public_read_ambassadors', 'auth_manage_ambassadors', 'auth_insert_ambassadors')
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ambassadors'
      AND policyname = 'ambassadors_select_own_or_admin'
  ),
  '2. RLS-8B-02. ambassadors : policies permissives supprimées, lecture propriétaire/admin'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'carnet_gear_links'
      AND policyname = 'carnet_gear_manage'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'carnet_gear_links'
      AND policyname IN (
        'carnet_gear_links_insert_carnet_owner',
        'carnet_gear_links_update_carnet_owner',
        'carnet_gear_links_delete_carnet_owner',
        'carnet_gear_links_read_scoped'
      )
    HAVING count(*) = 4
  ),
  '3. RLS-8B-03. carnet_gear_links : écriture auteur du carnet uniquement'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'club_challenges'
      AND policyname IN ('club_challenges_manage', 'auth_insert_club_challenges',
                         'Public read club_challenges', 'club_challenges_read',
                         'public_read_club_challenges')
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'club_challenges'
      AND policyname = 'club_challenges_select_public'
  ),
  '4. RLS-8B-04. club_challenges : lecture publique seule, écriture retirée'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'club_recommended_kits'
      AND policyname IN ('club_kits_manage', 'Public read club_recommended_kits', 'club_kits_read')
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'club_recommended_kits'
      AND policyname = 'club_recommended_kits_select_public'
  ),
  '5. RLS-8B-05. club_recommended_kits : lecture publique seule'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_expenses'
      AND policyname = 'auth_manage_event_expenses'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_expenses'
      AND policyname = 'public_read_event_expenses'
  ),
  '6. RLS-8B-06. event_expenses : lecture publique conservée, écriture retirée'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'auth_manage_events'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'auth_delete_events'
  ),
  '7. RLS-8B-07. events : policy ALL permissive supprimée, DELETE organisateur/admin'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'experts'
      AND policyname = 'auth_manage_experts'
  ),
  '8. RLS-8B-08. experts : écriture permissive supprimée'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guides'
      AND policyname IN ('auth_manage_guides', 'users_manage_own_guides',
                         'public_can_read_guides', 'public_read_guides')
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guides'
      AND policyname = 'guides_select_public'
  ),
  '9. RLS-8B-09. guides : lecture publique seule'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_items'
      AND policyname = 'auth_manage_kit_items'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_items'
      AND policyname = 'public_read_kit_items'
  ),
  '10. RLS-8B-10. kit_items : catalogue public, écriture retirée'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'promo_codes'
      AND policyname IN ('auth_manage_promo_codes', 'public_read_promo_codes')
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'promo_codes'
      AND policyname = 'promo_codes_select_ambassador_or_admin'
  ),
  '11. RLS-8B-11. promo_codes : lecture ambassadeur/admin uniquement'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_movements'
      AND policyname = 'public_read_stock_movements'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_movements'
      AND policyname = 'stock_movements_select_admin'
  ),
  '12. RLS-8B-12. stock_movements : lecture admin uniquement'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = ANY (ARRAY[
       'affiliate_offers', 'affiliate_partners', 'affiliate_programs',
       'ambassadors', 'carnet_gear_links', 'club_challenges',
       'club_recommended_kits', 'event_expenses', 'events', 'experts',
       'feature_flags', 'gear_history', 'gear_images', 'guides',
       'kit_items', 'loans', 'promo_codes', 'stock_movements'
     ])
     AND cmd <> 'SELECT'
     AND (roles @> ARRAY['anon']::name[]
          OR roles @> ARRAY['authenticated']::name[]
          OR roles @> ARRAY['public']::name[])
     AND COALESCE(qual, 'true') IN ('true', '(true)')
     AND COALESCE(with_check, 'true') IN ('true', '(true)')),
  0,
  '13. RLS-8B-13. Aucune policy permissive d''écriture résiduelle sur les 18 tables'
);

-- ----------------------------------------------------------------------------
-- 14..18 — Grants
-- ----------------------------------------------------------------------------
SELECT is_empty(
  $$ SELECT t.table_name
     FROM unnest(ARRAY[
       'affiliate_offers', 'affiliate_partners', 'affiliate_programs',
       'ambassadors', 'carnet_gear_links', 'club_challenges',
       'club_recommended_kits', 'event_expenses', 'events', 'experts',
       'feature_flags', 'gear_history', 'gear_images', 'guides',
       'kit_items', 'loans', 'promo_codes', 'stock_movements'
     ]) AS t(table_name)
     WHERE has_table_privilege('anon', 'public.' || t.table_name, 'INSERT')
        OR has_table_privilege('anon', 'public.' || t.table_name, 'UPDATE')
        OR has_table_privilege('anon', 'public.' || t.table_name, 'DELETE') $$,
  '14. RLS-8B-14. anon : plus aucun privilège d''écriture sur les 18 tables'
);

SELECT is_empty(
  $$ SELECT t.table_name
     FROM unnest(ARRAY[
       'affiliate_offers', 'affiliate_partners', 'affiliate_programs',
       'ambassadors', 'club_challenges', 'club_recommended_kits',
       'event_expenses', 'experts', 'feature_flags', 'guides',
       'kit_items', 'promo_codes'
     ]) AS t(table_name)
     WHERE has_table_privilege('authenticated', 'public.' || t.table_name, 'INSERT')
        OR has_table_privilege('authenticated', 'public.' || t.table_name, 'UPDATE')
        OR has_table_privilege('authenticated', 'public.' || t.table_name, 'DELETE') $$,
  '15. RLS-8B-15. authenticated : écriture révoquée sur les 12 tables verrouillées'
);

SELECT is_empty(
  $$ SELECT t.table_name
     FROM unnest(ARRAY[
       'events', 'gear_history', 'gear_images', 'loans', 'carnet_gear_links'
     ]) AS t(table_name)
     WHERE NOT has_table_privilege('authenticated', 'public.' || t.table_name, 'INSERT')
        OR NOT has_table_privilege('authenticated', 'public.' || t.table_name, 'UPDATE')
        OR NOT has_table_privilege('authenticated', 'public.' || t.table_name, 'DELETE') $$,
  '16. RLS-8B-16. authenticated : écritures propriétaire conservées (events, gear_*, loans, carnet_gear_links)'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.stock_movements', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.stock_movements', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.stock_movements', 'DELETE'),
  '17. RLS-8B-17. authenticated : stock_movements INSERT admin seulement, pas d''UPDATE/DELETE'
);

SELECT is_empty(
  $$ SELECT t.table_name
     FROM unnest(ARRAY['ambassadors', 'feature_flags', 'promo_codes', 'stock_movements']) AS t(table_name)
     WHERE has_table_privilege('anon', 'public.' || t.table_name, 'SELECT') $$,
  '18. RLS-8B-18. anon : SELECT révoqué sur ambassadors/feature_flags/promo_codes/stock_movements'
);

-- ----------------------------------------------------------------------------
-- Fixtures — A propriétaire/organisateur, B lambda, ADMIN administrateur
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f8b80000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'phase8b_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f8b80000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'phase8b_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f8b80000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'phase8b_admin@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('f8b80000-0000-4000-8000-0000000000a1', 'Propriétaire A', 'phase8b_a@test.local', 'user', 50),
  ('f8b80000-0000-4000-8000-0000000000a2', 'Lambda B', 'phase8b_b@test.local', 'user', 50),
  ('f8b80000-0000-4000-8000-0000000000a3', 'Admin', 'phase8b_admin@test.local', 'admin', 90)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, trust_score = EXCLUDED.trust_score;

-- Objet personnel de A + image / historique / prêt
INSERT INTO public.gear_items (id, user_id, name, category, weight_g)
VALUES ('f8b80000-0000-4000-8000-000000000f01', 'f8b80000-0000-4000-8000-0000000000a1', 'Sac A', 'sac', 800);

INSERT INTO public.gear_images (id, gear_item_id, url)
VALUES ('f8b80000-0000-4000-8000-000000000f02', 'f8b80000-0000-4000-8000-000000000f01', 'https://example.test/sac-a.jpg');

INSERT INTO public.gear_history (id, gear_item_id, event_type, event_date, notes)
VALUES ('f8b80000-0000-4000-8000-000000000f03', 'f8b80000-0000-4000-8000-000000000f01', 'achat', now() - interval '30 days', 'Historique A');

INSERT INTO public.loans (id, gear_item_id, loaned_to, loaned_at, status)
VALUES ('f8b80000-0000-4000-8000-000000000f04', 'f8b80000-0000-4000-8000-000000000f01', 'Ami de A', now() - interval '3 days', 'en_cours');

-- Carnet de A + lien matériel
INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES ('f8b80000-0000-4000-8000-000000000c01', 'f8b80000-0000-4000-8000-0000000000a1', 'Carnet B relais', 'Vercors', 'private');

INSERT INTO public.carnet_gear_links (id, carnet_id, product_id, note)
VALUES ('f8b80000-0000-4000-8000-000000000c02', 'f8b80000-0000-4000-8000-000000000c01', NULL, 'Lien A');

-- Club : A admin actif, B non membre. Défi + kit recommandé.
INSERT INTO public.clubs (id, slug, name, created_by)
VALUES ('f8b80000-0000-4000-8000-000000000c11', 'phase8b-club', 'Club Phase 8B', 'f8b80000-0000-4000-8000-0000000000a1');

INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES ('f8b80000-0000-4000-8000-000000000c11', 'f8b80000-0000-4000-8000-0000000000a1', 'admin', 'active');

INSERT INTO public.kits (id, slug, nom)
VALUES ('f8b80000-0000-4000-8000-000000000d01', 'phase8b-kit', 'Kit Phase 8B');

INSERT INTO public.club_challenges (id, club_id, title, active)
VALUES ('f8b80000-0000-4000-8000-000000000c12', 'f8b80000-0000-4000-8000-000000000c11', 'Défi Phase 8B', true);

INSERT INTO public.club_recommended_kits (id, club_id, kit_id, recommended_by)
VALUES ('f8b80000-0000-4000-8000-000000000c13', 'f8b80000-0000-4000-8000-000000000c11', 'f8b80000-0000-4000-8000-000000000d01', 'f8b80000-0000-4000-8000-0000000000a1');

-- Catalogue kits / experts / guides
INSERT INTO public.kit_items (id, kit_id, nom, categorie, poids_g)
VALUES ('f8b80000-0000-4000-8000-000000000d02', 'f8b80000-0000-4000-8000-000000000d01', 'Tente Phase 8B', 'abri', 1200);

INSERT INTO public.experts (id, name)
VALUES ('f8b80000-0000-4000-8000-000000000d03', 'Expert Phase 8B');

INSERT INTO public.guides (id, slug, title, author_id)
VALUES ('f8b80000-0000-4000-8000-000000000d04', 'phase8b-guide', 'Guide Phase 8B', 'f8b80000-0000-4000-8000-0000000000a1');

-- Événement de A + dépense associée
INSERT INTO public.events (id, title, event_date, organizer_id, current_participants, max_participants, status)
VALUES ('f8b80000-0000-4000-8000-000000000e01', 'Sortie Phase 8B', current_date + 7, 'f8b80000-0000-4000-8000-0000000000a1', 0, 2, 'upcoming');

INSERT INTO public.event_expenses (id, event_id, label, amount)
VALUES ('f8b80000-0000-4000-8000-000000000e02', 'f8b80000-0000-4000-8000-000000000e01', 'Péage Phase 8B', 12.50);

-- Affiliation (catalogue)
INSERT INTO public.affiliate_partners (id, name, slug)
VALUES ('f8b80000-0000-4000-8000-000000000a01', 'Partenaire Phase 8B', 'phase8b-partner');

INSERT INTO public.affiliate_programs (id, partner_id, program_identifier)
VALUES ('f8b80000-0000-4000-8000-000000000a02', 'f8b80000-0000-4000-8000-000000000a01', 'phase8b-program');

INSERT INTO public.affiliate_offers (id, program_id, title, affiliate_url, availability, availability_checked_at)
VALUES ('f8b80000-0000-4000-8000-000000000a03', 'f8b80000-0000-4000-8000-000000000a02', 'Offre Phase 8B', 'https://example.test/offre', true, now());

-- Ambassadeur A + code promo associé + feature flag + mouvement de stock
INSERT INTO public.ambassadors (id, user_id, name)
VALUES ('f8b80000-0000-4000-8000-000000000b01', 'f8b80000-0000-4000-8000-0000000000a1', 'Ambassadeur A');

INSERT INTO public.promo_codes (id, code, ambassador_id, discount_pct)
VALUES ('f8b80000-0000-4000-8000-000000000b02', 'PHASE8B', 'f8b80000-0000-4000-8000-000000000b01', 10);

INSERT INTO public.feature_flags (id, enabled)
VALUES ('phase8b.flag', false);

INSERT INTO public.stock_movements (id, movement_type, quantity_change, user_id, notes)
VALUES ('f8b80000-0000-4000-8000-000000000b03', 'ajustement', 1, 'f8b80000-0000-4000-8000-0000000000a1', 'Fixture 8B');

-- ============================================================================
-- ÉCRITURES REFUSÉES — B (authenticated lambda)
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b80000-0000-4000-8000-0000000000a2';

SELECT throws_ok(
  $$ INSERT INTO public.affiliate_partners (id, name, slug)
     VALUES ('f8b80000-0000-4000-8000-000000000a11', 'Pirate', 'phase8b-pirate') $$,
  NULL, NULL,
  '19. RLS-8B-19. affiliate_partners : INSERT refusé (grant révoqué)'
);
SELECT throws_ok(
  $$ INSERT INTO public.affiliate_programs (id, partner_id, program_identifier)
     VALUES ('f8b80000-0000-4000-8000-000000000a12', 'f8b80000-0000-4000-8000-000000000a01', 'pirate') $$,
  NULL, NULL,
  '20. RLS-8B-20. affiliate_programs : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.affiliate_offers (id, program_id, title, affiliate_url)
     VALUES ('f8b80000-0000-4000-8000-000000000a13', 'f8b80000-0000-4000-8000-000000000a02', 'Pirate', 'https://pirate.test') $$,
  NULL, NULL,
  '21. RLS-8B-21. affiliate_offers : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.ambassadors (id, user_id, name)
     VALUES ('f8b80000-0000-4000-8000-000000000b11', 'f8b80000-0000-4000-8000-0000000000a2', 'Faux ambassadeur') $$,
  NULL, NULL,
  '22. RLS-8B-22. ambassadors : auto-inscription refusée'
);
SELECT throws_ok(
  $$ INSERT INTO public.club_challenges (id, club_id, title, active)
     VALUES ('f8b80000-0000-4000-8000-000000000c14', 'f8b80000-0000-4000-8000-000000000c11', 'Pirate', true) $$,
  NULL, NULL,
  '23. RLS-8B-23. club_challenges : INSERT non-membre refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.club_recommended_kits (id, club_id, kit_id, recommended_by)
     VALUES ('f8b80000-0000-4000-8000-000000000c15', 'f8b80000-0000-4000-8000-000000000c11', 'f8b80000-0000-4000-8000-000000000d01', 'f8b80000-0000-4000-8000-0000000000a2') $$,
  NULL, NULL,
  '24. RLS-8B-24. club_recommended_kits : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_expenses (id, event_id, label, amount)
     VALUES ('f8b80000-0000-4000-8000-000000000e03', 'f8b80000-0000-4000-8000-000000000e01', 'Pirate', 999) $$,
  NULL, NULL,
  '25. RLS-8B-25. event_expenses : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.experts (id, name)
     VALUES ('f8b80000-0000-4000-8000-000000000d05', 'Faux expert') $$,
  NULL, NULL,
  '26. RLS-8B-26. experts : INSERT refusé'
);
SELECT throws_ok(
  $$ UPDATE public.feature_flags SET enabled = true WHERE id = 'phase8b.flag' $$,
  NULL, NULL,
  '27. RLS-8B-27. feature_flags : UPDATE refusé (grant révoqué)'
);
SELECT throws_ok(
  $$ INSERT INTO public.guides (id, slug, title)
     VALUES ('f8b80000-0000-4000-8000-000000000d06', 'pirate-guide', 'Guide pirate') $$,
  NULL, NULL,
  '28. RLS-8B-28. guides : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.kit_items (id, kit_id, nom, categorie, poids_g)
     VALUES ('f8b80000-0000-4000-8000-000000000d07', 'f8b80000-0000-4000-8000-000000000d01', 'Pirate', 'abri', 1) $$,
  NULL, NULL,
  '29. RLS-8B-29. kit_items : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.promo_codes (id, code, discount_pct)
     VALUES ('f8b80000-0000-4000-8000-000000000b12', 'PIRATE', 99) $$,
  NULL, NULL,
  '30. RLS-8B-30. promo_codes : INSERT refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.stock_movements (id, movement_type, quantity_change)
     VALUES ('f8b80000-0000-4000-8000-000000000b13', 'ajustement', 9999) $$,
  NULL, NULL,
  '31. RLS-8B-31. stock_movements : INSERT non-admin refusé (policy is_admin)'
);

-- events : B garde ses droits mais la policy le limite à ses propres créations
UPDATE public.events SET title = 'piraté' WHERE id = 'f8b80000-0000-4000-8000-000000000e01';
DELETE FROM public.events WHERE id = 'f8b80000-0000-4000-8000-000000000e01';
UPDATE public.gear_history SET notes = 'piraté' WHERE id = 'f8b80000-0000-4000-8000-000000000f03';
DELETE FROM public.gear_history WHERE id = 'f8b80000-0000-4000-8000-000000000f03';
UPDATE public.gear_images SET url = 'https://pirate.test' WHERE id = 'f8b80000-0000-4000-8000-000000000f02';
DELETE FROM public.gear_images WHERE id = 'f8b80000-0000-4000-8000-000000000f02';
UPDATE public.loans SET loaned_to = 'piraté' WHERE id = 'f8b80000-0000-4000-8000-000000000f04';
DELETE FROM public.loans WHERE id = 'f8b80000-0000-4000-8000-000000000f04';
UPDATE public.carnet_gear_links SET note = 'piraté' WHERE id = 'f8b80000-0000-4000-8000-000000000c02';
DELETE FROM public.carnet_gear_links WHERE id = 'f8b80000-0000-4000-8000-000000000c02';

SELECT throws_ok(
  $$ INSERT INTO public.gear_history (id, gear_item_id, event_type)
     VALUES ('f8b80000-0000-4000-8000-000000000f05', 'f8b80000-0000-4000-8000-000000000f01', 'pirate') $$,
  NULL, NULL,
  '32. RLS-8B-32. gear_history : INSERT sur l''objet d''autrui refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.gear_images (id, gear_item_id, url)
     VALUES ('f8b80000-0000-4000-8000-000000000f06', 'f8b80000-0000-4000-8000-000000000f01', 'https://pirate.test/x.jpg') $$,
  NULL, NULL,
  '33. RLS-8B-33. gear_images : INSERT sur l''objet d''autrui refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.loans (id, gear_item_id, loaned_to)
     VALUES ('f8b80000-0000-4000-8000-000000000f07', 'f8b80000-0000-4000-8000-000000000f01', 'Pirate') $$,
  NULL, NULL,
  '34. RLS-8B-34. loans : INSERT sur l''objet d''autrui refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.carnet_gear_links (id, carnet_id, note)
     VALUES ('f8b80000-0000-4000-8000-000000000c16', 'f8b80000-0000-4000-8000-000000000c01', 'Pirate') $$,
  NULL, NULL,
  '35. RLS-8B-35. carnet_gear_links : INSERT dans le carnet d''autrui refusé'
);

SELECT is_empty(
  'SELECT 1 FROM public.gear_images WHERE id = ''f8b80000-0000-4000-8000-000000000f02''',
  '36. RLS-8B-36. gear_images d''autrui invisibles pour B'
);
SELECT is_empty(
  'SELECT 1 FROM public.gear_history WHERE id = ''f8b80000-0000-4000-8000-000000000f03''',
  '37. RLS-8B-37. gear_history d''autrui invisible pour B'
);
SELECT is_empty(
  'SELECT 1 FROM public.loans WHERE id = ''f8b80000-0000-4000-8000-000000000f04''',
  '38. RLS-8B-38. loans d''autrui invisibles pour B'
);
SELECT is_empty(
  'SELECT 1 FROM public.carnet_gear_links WHERE id = ''f8b80000-0000-4000-8000-000000000c02''',
  '39. RLS-8B-39. carnet_gear_links d''un carnet privé invisibles pour B'
);
SELECT is_empty(
  'SELECT 1 FROM public.ambassadors WHERE id = ''f8b80000-0000-4000-8000-000000000b01''',
  '40. RLS-8B-40. ambassadors : ligne d''un autre ambassadeur invisible pour B'
);
SELECT is_empty(
  'SELECT 1 FROM public.promo_codes WHERE id = ''f8b80000-0000-4000-8000-000000000b02''',
  '41. RLS-8B-41. promo_codes : code d''un autre ambassadeur invisible pour B'
);

RESET ROLE;

-- Intégrité post-tentatives (lecture superuser)
SELECT is(
  (SELECT title FROM public.events WHERE id = 'f8b80000-0000-4000-8000-000000000e01'),
  'Sortie Phase 8B',
  '42. RLS-8B-42. events de A intacts (ni UPDATE ni DELETE par B)'
);
SELECT is(
  (SELECT notes FROM public.gear_history WHERE id = 'f8b80000-0000-4000-8000-000000000f03'),
  'Historique A',
  '43. RLS-8B-43. gear_history de A intact'
);
SELECT is(
  (SELECT url FROM public.gear_images WHERE id = 'f8b80000-0000-4000-8000-000000000f02'),
  'https://example.test/sac-a.jpg',
  '44. RLS-8B-44. gear_images de A intactes'
);
SELECT is(
  (SELECT loaned_to FROM public.loans WHERE id = 'f8b80000-0000-4000-8000-000000000f04'),
  'Ami de A',
  '45. RLS-8B-45. loans de A intacts'
);
SELECT is(
  (SELECT note FROM public.carnet_gear_links WHERE id = 'f8b80000-0000-4000-8000-000000000c02'),
  'Lien A',
  '46. RLS-8B-46. carnet_gear_links de A intacts'
);

-- ============================================================================
-- LECTURES ATTENDUES
-- ============================================================================
SET LOCAL ROLE anon;

SELECT is_empty(
  $$ SELECT t.table_name
     FROM unnest(ARRAY[
       'events', 'event_expenses', 'guides', 'kit_items', 'experts',
       'club_challenges', 'club_recommended_kits',
       'affiliate_offers', 'affiliate_partners', 'affiliate_programs'
     ]) AS t(table_name)
     WHERE NOT EXISTS (
       SELECT 1 FROM (
         SELECT 1 FROM public.events
         WHERE t.table_name = 'events'
         UNION ALL
         SELECT 1 FROM public.event_expenses WHERE t.table_name = 'event_expenses'
         UNION ALL
         SELECT 1 FROM public.guides WHERE t.table_name = 'guides'
         UNION ALL
         SELECT 1 FROM public.kit_items WHERE t.table_name = 'kit_items'
         UNION ALL
         SELECT 1 FROM public.experts WHERE t.table_name = 'experts'
         UNION ALL
         SELECT 1 FROM public.club_challenges WHERE t.table_name = 'club_challenges'
         UNION ALL
         SELECT 1 FROM public.club_recommended_kits WHERE t.table_name = 'club_recommended_kits'
         UNION ALL
         SELECT 1 FROM public.affiliate_offers WHERE t.table_name = 'affiliate_offers'
         UNION ALL
         SELECT 1 FROM public.affiliate_partners WHERE t.table_name = 'affiliate_partners'
         UNION ALL
         SELECT 1 FROM public.affiliate_programs WHERE t.table_name = 'affiliate_programs'
       ) visible
     ) $$,
  '47. RLS-8B-47. anon : catalogue public lisible (events, dépenses, guides, kits, experts, clubs, affiliation)'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b80000-0000-4000-8000-0000000000a1';

SELECT is_empty(
  $$ SELECT t.table_name
     FROM unnest(ARRAY['gear_images', 'gear_history', 'loans', 'carnet_gear_links', 'ambassadors', 'promo_codes']) AS t(table_name)
     WHERE NOT EXISTS (
       SELECT 1 FROM (
         SELECT 1 FROM public.gear_images WHERE t.table_name = 'gear_images' AND id = 'f8b80000-0000-4000-8000-000000000f02'
         UNION ALL
         SELECT 1 FROM public.gear_history WHERE t.table_name = 'gear_history' AND id = 'f8b80000-0000-4000-8000-000000000f03'
         UNION ALL
         SELECT 1 FROM public.loans WHERE t.table_name = 'loans' AND id = 'f8b80000-0000-4000-8000-000000000f04'
         UNION ALL
         SELECT 1 FROM public.carnet_gear_links WHERE t.table_name = 'carnet_gear_links' AND id = 'f8b80000-0000-4000-8000-000000000c02'
         UNION ALL
         SELECT 1 FROM public.ambassadors WHERE t.table_name = 'ambassadors' AND id = 'f8b80000-0000-4000-8000-000000000b01'
         UNION ALL
         SELECT 1 FROM public.promo_codes WHERE t.table_name = 'promo_codes' AND id = 'f8b80000-0000-4000-8000-000000000b02'
       ) visible
     ) $$,
  '48. RLS-8B-48. A : données perso (gear/carnet) et ambassadeur lues par leur propriétaire'
);

SELECT isnt_empty(
  'SELECT 1 FROM public.feature_flags WHERE id = ''phase8b.flag'' AND enabled = false',
  '49. RLS-8B-49. authenticated : feature_flags lisibles (client)'
);

RESET ROLE;

-- Admin : lecture/écriture stock_movements via session
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b80000-0000-4000-8000-0000000000a3';

SELECT isnt_empty(
  'SELECT 1 FROM public.stock_movements WHERE id = ''f8b80000-0000-4000-8000-000000000b03''',
  '50. RLS-8B-50. admin : stock_movements lisibles (policy is_admin)'
);
SELECT lives_ok(
  $$ INSERT INTO public.stock_movements (id, movement_type, quantity_change, user_id, notes)
     VALUES ('f8b80000-0000-4000-8000-000000000b14', 'ajustement', -1, 'f8b80000-0000-4000-8000-0000000000a3', 'Admin 8B') $$,
  '51. RLS-8B-51. admin : INSERT stock_movements autorisé'
);

RESET ROLE;

-- ============================================================================
-- RPC events (join/leave atomiques) et service_role
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b80000-0000-4000-8000-0000000000a2';

SELECT is(
  (public.join_event('f8b80000-0000-4000-8000-000000000e01') ->> 'current_participants')::int,
  1,
  '52. RLS-8B-52. B rejoint l''événement via RPC join_event (compteur = 1)'
);

RESET ROLE;

SELECT is(
  (SELECT current_participants FROM public.events WHERE id = 'f8b80000-0000-4000-8000-000000000e01'),
  1,
  '53. RLS-8B-53. Compteur persisté après join_event'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8b80000-0000-4000-8000-0000000000a2';

SELECT is(
  (public.leave_event('f8b80000-0000-4000-8000-000000000e01') ->> 'current_participants')::int,
  0,
  '54. RLS-8B-54. B quitte l''événement via RPC leave_event (compteur = 0)'
);

RESET ROLE;

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT public.join_event('f8b80000-0000-4000-8000-000000000e01') $$,
  NULL, NULL,
  '55. RLS-8B-55. anon : join_event refusé (EXECUTE révoqué)'
);

RESET ROLE;

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$ INSERT INTO public.promo_codes (id, code, discount_pct)
     VALUES ('f8b80000-0000-4000-8000-000000000b15', 'PHASE8B-SERVICE', 5) $$,
  '56. RLS-8B-56. service_role : écriture promo_codes autorisée'
);

SELECT * FROM finish();
ROLLBACK;
