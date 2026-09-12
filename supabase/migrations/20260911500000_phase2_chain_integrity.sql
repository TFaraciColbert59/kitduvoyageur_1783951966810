-- ==============================================================================
-- Phase 2 — Unifier la chaîne d'identifiants (couche base de données)
--
-- Chantier LANCEMENT_MONDIAL §Phase 2 : formaliser les relations
-- voyage → plan → route → kit → session → carnet → publication, ajouter les
-- FK/index manquants et `correlation_id` sur chaque pivot, empêcher les
-- doublons de sélection. Migration strictement additive et idempotente
-- (ADD COLUMN IF NOT EXISTS, gardes pg_constraint, CREATE OR REPLACE).
--
--   • adventure_plans.selected_route_id → hiking_routes(id) ON DELETE SET NULL.
--     Type réel bigint : hiking_routes.id est un bigint (colonne geom
--     geometry(MultiLineString,4326)).
--   • correlation_id uuid NULL sur plans, versions, sessions, carnets et
--     publications + index partiels. NB : adventure_engine_runs.correlation_id
--     (A11) est de type text ; les pivots de la chaîne utilisent uuid.
--   • community_posts.linked_carnet_id (présent dans la lignée 20260713120000,
--     absent du schéma baseline local) → FK carnets(id) ON DELETE SET NULL.
--   • adventure_plan_route_selections : traçabilité des sélections de parcours,
--     une seule active par plan (index unique partiel).
--   • RPC select_adventure_plan_route(...) : commande canonique de sélection,
--     SECURITY DEFINER + search_path verrouillé, authenticated uniquement.
-- ==============================================================================

-- ── 1. Plan → route réellement sélectionnée ──────────────────────────────────
ALTER TABLE public.adventure_plans
  ADD COLUMN IF NOT EXISTS selected_route_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.adventure_plans'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.hiking_routes'::regclass
      AND a.attname = 'selected_route_id'
  ) THEN
    ALTER TABLE public.adventure_plans
      ADD CONSTRAINT adventure_plans_selected_route_id_fkey
      FOREIGN KEY (selected_route_id)
      REFERENCES public.hiking_routes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_adventure_plans_selected_route
  ON public.adventure_plans(selected_route_id)
  WHERE selected_route_id IS NOT NULL;

COMMENT ON COLUMN public.adventure_plans.selected_route_id IS
  'Phase 2 — parcours réellement sélectionné pour le plan (hiking_routes.id), '
  'écrit par select_adventure_plan_route.';

-- ── 2. correlation_id sur les pivots de la chaîne ────────────────────────────
ALTER TABLE public.adventure_plans
  ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.adventure_plan_versions
  ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.carnets
  ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE INDEX IF NOT EXISTS idx_adventure_plans_correlation
  ON public.adventure_plans(correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_adventure_plan_versions_correlation
  ON public.adventure_plan_versions(plan_id, correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hike_sessions_correlation
  ON public.hike_sessions(correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carnets_correlation
  ON public.carnets(correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_correlation
  ON public.community_posts(correlation_id)
  WHERE correlation_id IS NOT NULL;

COMMENT ON COLUMN public.adventure_plans.correlation_id IS
  'Phase 2 — identifiant de corrélation de la chaîne plan/route/session/publication.';
COMMENT ON COLUMN public.community_posts.correlation_id IS
  'Phase 2 — identifiant de corrélation de la chaîne, propagé à la publication.';

-- ── 3. Publication → carnet source ───────────────────────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS linked_carnet_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.community_posts'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.carnets'::regclass
      AND a.attname = 'linked_carnet_id'
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_linked_carnet_id_fkey
      FOREIGN KEY (linked_carnet_id)
      REFERENCES public.carnets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_posts_linked_carnet
  ON public.community_posts(linked_carnet_id)
  WHERE linked_carnet_id IS NOT NULL;

COMMENT ON COLUMN public.community_posts.linked_carnet_id IS
  'Phase 2 — carnet source de la publication (FK additive, NULL toléré pour '
  'les publications historiques sans carnet).';

-- ── 4. Historique des sélections de parcours (une seule active par plan) ─────
CREATE TABLE IF NOT EXISTS public.adventure_plan_route_selections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid NOT NULL REFERENCES public.adventure_plans(id) ON DELETE CASCADE,
  route_id       bigint NOT NULL REFERENCES public.hiking_routes(id) ON DELETE CASCADE,
  selected_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  correlation_id uuid,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_adventure_plan_route_selections_active
  ON public.adventure_plan_route_selections(plan_id)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_adventure_plan_route_selections_plan
  ON public.adventure_plan_route_selections(plan_id, created_at DESC);

ALTER TABLE public.adventure_plan_route_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_plan_route_selections_select_access" ON public.adventure_plan_route_selections;
CREATE POLICY "adventure_plan_route_selections_select_access" ON public.adventure_plan_route_selections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.adventure_plans p
      WHERE p.id = adventure_plan_route_selections.plan_id
        AND (
          p.owner_id = auth.uid()
          OR (p.trip_id IS NOT NULL AND public.can_read_trip(p.trip_id))
        )
    )
  );

DROP POLICY IF EXISTS "adventure_plan_route_selections_all_service" ON public.adventure_plan_route_selections;
CREATE POLICY "adventure_plan_route_selections_all_service" ON public.adventure_plan_route_selections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.adventure_plan_route_selections FROM anon, authenticated;
GRANT SELECT ON TABLE public.adventure_plan_route_selections TO authenticated;
GRANT ALL ON TABLE public.adventure_plan_route_selections TO service_role;

COMMENT ON TABLE public.adventure_plan_route_selections IS
  'Phase 2 — historique des sélections de parcours d''un plan ; une seule '
  'ligne active par plan (index unique partiel), piste d''audit de la chaîne.';

-- ── 5. RPC — sélectionner le parcours d'un plan ──────────────────────────────
CREATE OR REPLACE FUNCTION public.select_adventure_plan_route(
  p_plan_id uuid,
  p_route_id bigint,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user        uuid := auth.uid();
  v_owner       uuid;
  v_trip_id     uuid;
  v_geom_ok     boolean;
  v_correlation uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'select_adventure_plan_route: authentification requise';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'select_adventure_plan_route: p_plan_id obligatoire';
  END IF;
  IF p_route_id IS NULL THEN
    RAISE EXCEPTION 'select_adventure_plan_route: p_route_id obligatoire';
  END IF;

  -- Propriété vérifiée sous verrou : deux sélections concurrentes sont sérialisées.
  SELECT owner_id, trip_id
  INTO v_owner, v_trip_id
  FROM public.adventure_plans
  WHERE id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'select_adventure_plan_route: plan % introuvable', p_plan_id;
  END IF;
  IF v_owner <> v_user THEN
    RAISE EXCEPTION
      'select_adventure_plan_route: plan % non détenu par l''utilisateur %',
      p_plan_id, v_user;
  END IF;

  -- Géométrie réelle exigée : ni NULL, ni vide, ni dégénérée, ni invalide.
  SELECT (
    geom IS NOT NULL
    AND NOT ST_IsEmpty(geom)
    AND ST_NPoints(geom) >= 2
    AND ST_IsValid(geom)
  )
  INTO v_geom_ok
  FROM public.hiking_routes
  WHERE id = p_route_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'select_adventure_plan_route: route % introuvable', p_route_id;
  END IF;
  IF NOT v_geom_ok THEN
    RAISE EXCEPTION
      'select_adventure_plan_route: route % sans géométrie navigable (nulle, vide ou invalide)',
      p_route_id;
  END IF;

  v_correlation := COALESCE(p_correlation_id, gen_random_uuid());

  UPDATE public.adventure_plan_route_selections
  SET is_active = false
  WHERE plan_id = p_plan_id AND is_active;

  INSERT INTO public.adventure_plan_route_selections (
    plan_id, route_id, selected_by, correlation_id, is_active
  )
  VALUES (p_plan_id, p_route_id, v_user, v_correlation, true);

  UPDATE public.adventure_plans
  SET selected_route_id = p_route_id,
      correlation_id = v_correlation,
      updated_at = now()
  WHERE id = p_plan_id;

  IF v_trip_id IS NOT NULL THEN
    UPDATE public.trips
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{route_id}',
      to_jsonb(p_route_id),
      true
    )
    WHERE id = v_trip_id;
  END IF;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'selected_route_id', p_route_id,
    'correlation_id', v_correlation,
    'trip_id', v_trip_id
  );
END;
$fn$;

COMMENT ON FUNCTION public.select_adventure_plan_route(uuid,bigint,uuid) IS
  'Phase 2 — commande canonique de sélection du parcours réel : propriétaire du '
  'plan vérifié, géométrie navigable exigée, historique mono-actif, propagation '
  'trips.metadata.route_id et correlation_id. SECURITY DEFINER, authenticated '
  'uniquement.';

REVOKE ALL ON FUNCTION public.select_adventure_plan_route(uuid,bigint,uuid) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.select_adventure_plan_route(uuid,bigint,uuid) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.select_adventure_plan_route(uuid,bigint,uuid)
  TO authenticated;
