-- ============================================================================
-- PHASE 8 — Revue RLS exhaustive : durcissements ADDITIFS
-- ============================================================================
-- Contexte : la revue du schéma local réel (replay baseline prod + migrations)
-- a relevé des politiques permissives `USING (true)` / `FOR ALL` héritées de la
-- baseline, non couvertes par les phases A1..A14 :
--
--   1. `hike_sessions` : 4 politiques SELECT/INSERT/UPDATE/DELETE `true` pour
--      `public` → tout visiteur anon lisait/modifiait/supprimait les sessions
--      GPS de tous les utilisateurs (traces, positions horodatées).
--   2. `carnet_moments` / `carnet_kit_items` : politiques seed `true` pour
--      `public` → contenus de carnets PRIVÉS lisibles par tous (la politique
--      scopée `*_read_scoped` existait déjà, la politique seed la contournait).
--   3. `groupe_messages` : SELECT `true` pour `public` → messages de groupe
--      privés lisibles par tous.
--   4. `comment_reports` : SELECT `true` pour `public` → tous les signalements
--      (reporter_id, contenu signalé) lisibles par tous.
--   5. `community_posts` : `auth_like_community_posts` UPDATE `true` pour
--      `authenticated` → n'importe quel utilisateur connecté pouvait modifier
--      n'importe quel post (titre, contenu, auteur…). Aucun code ne l'utilise.
--   6. Tables affiliations : politiques `*_public_read` déclarées `FOR ALL`
--      (donc INSERT/UPDATE/DELETE `true`) → écritures anonymes sur les
--      conversions/partenaires/offres/programmes. Reconverties en SELECT seul
--      (partenaires/offres/programmes) ; conversions réservées au service_role
--      (webhook Travelpayouts, cf. `recordAffiliateConversion` passé service).
--   7. `hub_dashboard_kpis` : vue DEFINER + grants anon/authenticated restaurés
--      (dérive baseline après le REVOKE V7) → REVOKE ré-appliqué.
--   8. Vues de projection publiques : privilèges DML anon/authenticated
--      hérités des default privileges → réduits à SELECT.
--   9. `spatial_ref_sys` : RLS non active (table PostGIS) → tentative
--      idempotente SELECT-only, tolérante aux privilèges.
--
-- Aucune donnée n'est réécrite ; aucun DROP de table/colonne.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. hike_sessions — propriétaire, ou carnet explicitement public
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "hike_sessions_select" ON public.hike_sessions;
DROP POLICY IF EXISTS "hike_sessions_insert" ON public.hike_sessions;
DROP POLICY IF EXISTS "hike_sessions_update" ON public.hike_sessions;
DROP POLICY IF EXISTS "hike_sessions_delete" ON public.hike_sessions;
DROP POLICY IF EXISTS "own_sessions" ON public.hike_sessions;

CREATE POLICY hike_sessions_select_owner_or_public_carnet ON public.hike_sessions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.carnets c
      WHERE c.id = hike_sessions.carnet_id
        AND (c.visibility = 'public' OR c.author_id = auth.uid())
    )
  );

CREATE POLICY hike_sessions_insert_owner ON public.hike_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY hike_sessions_update_owner ON public.hike_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY hike_sessions_delete_owner ON public.hike_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. carnet_moments / carnet_kit_items — supprimer les lectures seed `true`
--    (les politiques scopées `*_read_scoped` restent l'autorité)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS seed_public_read_carnet_moments ON public.carnet_moments;
DROP POLICY IF EXISTS seed_public_read_carnet_kit_items ON public.carnet_kit_items;

-- ----------------------------------------------------------------------------
-- 3. groupe_messages — membres du groupe uniquement
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS public_read_groupe_messages ON public.groupe_messages;

CREATE POLICY groupe_messages_select_member ON public.groupe_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.groupe_membres gm
      WHERE gm.groupe_id = groupe_messages.groupe_id
        AND gm.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. comment_reports — signalant, modérateurs et admins uniquement
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comment_reports_select ON public.comment_reports;

CREATE POLICY comment_reports_select_own_or_moderator ON public.comment_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.is_moderateur()
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 5. community_posts — retirer la mise à jour générique `true`
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_like_community_posts ON public.community_posts;

-- ----------------------------------------------------------------------------
-- 6. Affiliations — lectures publiques en SELECT seul ; conversions service
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS affiliate_clicks_public_read ON public.affiliate_clicks;
DROP POLICY IF EXISTS affiliate_conversions_public_read ON public.affiliate_conversions;
DROP POLICY IF EXISTS affiliate_offers_public_read ON public.affiliate_offers;
DROP POLICY IF EXISTS affiliate_partners_public_read ON public.affiliate_partners;
DROP POLICY IF EXISTS affiliate_programs_public_read ON public.affiliate_programs;

DROP POLICY IF EXISTS affiliate_offers_public_select ON public.affiliate_offers;
CREATE POLICY affiliate_offers_public_select ON public.affiliate_offers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS affiliate_partners_public_select ON public.affiliate_partners;
CREATE POLICY affiliate_partners_public_select ON public.affiliate_partners
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS affiliate_programs_public_select ON public.affiliate_programs;
CREATE POLICY affiliate_programs_public_select ON public.affiliate_programs
  FOR SELECT TO anon, authenticated USING (true);

-- Les clics restent insérables par le flux de redirection public
-- (`affiliate_clicks_insert_all`, CHECK true) — déjà en place, inchangé.

-- ----------------------------------------------------------------------------
-- 7. hub_dashboard_kpis — vue DEFINER réservée au service_role
--    (re-application du REVOKE V7 après restauration baseline)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.hub_dashboard_kpis FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Vues de projection publiques — lecture seule pour anon/authenticated
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.terrain_reports_public,
     public.public_profiles,
     public.segment_collective_public,
     public.explore_kits_public,
     public.explore_trails,
     public.countries_content_needs_review
  FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. spatial_ref_sys (PostGIS) — RLS SELECT-only si privilèges suffisants
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_select_all ON public.spatial_ref_sys';
    EXECUTE 'CREATE POLICY spatial_ref_sys_select_all ON public.spatial_ref_sys FOR SELECT USING (true)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys RLS non appliquée (privilèges insuffisants)';
  END;
END $$;
