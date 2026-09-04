-- ============================================================================
-- Chantier « Orientation & Empreinte » (ADR-010)
-- Lot C — user_field_signature : EMPREINTE PUBLIQUE, 100 % DÉRIVÉE du terrain.
-- ----------------------------------------------------------------------------
--  • Dérivée EXCLUSIVEMENT de hike_sessions (+ hiking_routes.region).
--  • GARDE-FOUS (non négociables, ADR-010) :
--      - Granularité géographique = région/massif, JAMAIS de coordonnées.
--      - AUCUN agrégat inter-utilisateurs (pas de percentile/moyenne).
--      - Consentement : matview NON lisible directement ; exposée UNIQUEMENT par
--        get_user_signature() qui vérifie user_profiles.signature_visibility
--        (DÉFAUT 'private').
--  • DEPEND : migration 20260903020000 (hiking_routes.region) — à appliquer
--    APRÈS la vague 1→5 des Lignées.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) consentement — colonne sur user_profiles (défaut PRIVÉ)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signature_visibility text NOT NULL DEFAULT 'private'
  CHECK (signature_visibility IN ('private','communaute','public'));

-- Le propriétaire peut lire et modifier sa propre visibilité.
DROP POLICY IF EXISTS "profile_read_own_visibility" ON public.user_profiles;
CREATE POLICY "profile_read_own_visibility"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profile_update_own_visibility" ON public.user_profiles;
CREATE POLICY "profile_update_own_visibility"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- N'ouvre pas lecture publique du profil : empreinte = fonction sécurisée.
DROP POLICY IF EXISTS "profile_select_public_subset" ON public.user_profiles;
CREATE POLICY "profile_select_public_subset"
  ON public.user_profiles FOR SELECT
  TO anon
  USING (false); -- Aucune lecture directe — tout passe par get_user_signature().

-- ---------------------------------------------------------------------------
-- 2) matview — agrégats strictement per-user, granularité = région
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.user_field_signature;
CREATE MATERIALIZED VIEW public.user_field_signature AS
SELECT
  hs.user_id,
  count(*)                                                                  AS total_outings,
  round(sum(coalesce(hs.distance_km, 0))::numeric, 1)                       AS total_km,
  round(sum(coalesce(hs.elevation_gain_m, 0))::numeric, 0)                  AS total_dplus_m,
  round(max(coalesce(hs.elevation_gain_m, 0))::numeric, 0)                  AS max_altitude_gain_m, -- PROXY : D+ max d'une sortie (pas d'altitude stockée)
  count(distinct to_char(hs.started_at, 'YYYY-MM'))                         AS distinct_months,
  count(distinct r.region)                                                  AS distinct_regions,
  max(greatest(1, ceil(extract(epoch from (hs.ended_at - hs.started_at)) / 86400)))
                                                                            AS max_autonomy_days,
  coalesce(
    round((count(*) FILTER (WHERE hs.route_id IS NULL))::numeric
          / nullif(count(*), 0), 3), 0)                                     AS off_trail_share -- PROXY : route inconnue = hors sentier
FROM public.hike_sessions hs
LEFT JOIN public.hiking_routes r ON r.id = hs.route_id
GROUP BY hs.user_id;

CREATE INDEX IF NOT EXISTS user_field_signature_user_id_idx
  ON public.user_field_signature (user_id);

-- Pas de colonne de coordonnées, pas de lat/lon, pas de positions_geojson :
-- le SELECT ci-dessus n'y accède JAMAIS (règle d'or RGPD, get_kit_journal Lot 2).

-- ---------------------------------------------------------------------------
-- 3) refresh (à brancher sur un cron si besoin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_user_field_signature()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_field_signature;
$$;

-- Maintenance : PAS exécutable par anon/authenticated (un refresh de matview est
-- coûteux). Réservé à la couche serveur / service_role / postgres.
REVOKE ALL ON FUNCTION public.refresh_user_field_signature() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_user_field_signature() TO service_role;

-- ---------------------------------------------------------------------------
-- 4) EXPOSITION SÉCURISÉE — le seul accès, consentement vérifié
-- ---------------------------------------------------------------------------
-- Un matview n'a pas de RLS : il sera lisible par quiconque a le schéma.
-- On le rend donc non lisible par défaut (DROP des privilèges génériques) et
-- on n'expose la signature QUE via cette fonction SECURITY DEFINER.
REVOKE ALL ON public.user_field_signature FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_signature(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_self      boolean := (auth.uid() IS NOT NULL AND auth.uid() = p_target);
  v_visib     text;
  v_row       jsonb;
BEGIN
  -- Cible inconnue → objet vide (aucun indice d'existence).
  SELECT p.signature_visibility INTO v_visib
  FROM public.user_profiles p WHERE p.id = p_target;
  IF v_visib IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Consentement (ADR-010, C.2) : défaut 'private'.
  --   private     → soi-même uniquement
  --   communaute  → soi-même + membres connectés (autrui authentifié)
  --   public      → n'importe qui
  IF v_visib = 'private' AND NOT v_self THEN
    RETURN '{}'::jsonb;
  END IF;
  IF v_visib = 'communaute' AND NOT v_self AND auth.uid() IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT to_jsonb(s)
  FROM (SELECT * FROM public.user_field_signature WHERE user_id = p_target) s
  INTO v_row;

  -- Plancher : la matview n'expose pas les sous-seuils (voir hasFieldSignature
  -- côté applicatif), mais on ne renvoie jamais une ligne faite uniquement de 0.
  RETURN coalesce(v_row, '{}'::jsonb);
END;
$$;