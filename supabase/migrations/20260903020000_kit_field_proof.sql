-- ============================================================================
-- 20260903020000_kit_field_proof.sql
-- Chantier « Lignées de kits » — Lot 2 : l'épreuve du terrain.
--   • hike_sessions.kit_id (rattachement session <-> kit)
--   • hiking_routes.region (granularité massif pour le journal anonymisé)
--   • kit_field_reports (débriefing : verdicts, upsert par (session, item))
--   • trigger field_proven_count (seuil : distance_km >= 1)
--   • get_kit_journal (agrégats ANONYMISÉS — RGPD : jamais de lat/lon,
--     jamais de noms ; granularité maximale exposée = massif / région)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Rattachement du kit à la session de randonnée
-- ----------------------------------------------------------------------------
ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS kit_id uuid REFERENCES public.materiel_kits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hike_sessions_kit
  ON public.hike_sessions (kit_id, started_at DESC);

-- ----------------------------------------------------------------------------
-- 2) Granularité massif pour le journal de lignée (nullable ; enrichissement
--    éditorial/géographique ultérieur — hors périmètre de ce chantier)
-- ----------------------------------------------------------------------------
ALTER TABLE public.hiking_routes
  ADD COLUMN IF NOT EXISTS region text;

CREATE INDEX IF NOT EXISTS idx_hiking_routes_region
  ON public.hiking_routes (region);

-- ----------------------------------------------------------------------------
-- 3) Débriefing terrain — table d'épreuve du kit
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kit_field_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id          uuid NOT NULL REFERENCES public.materiel_kits(id) ON DELETE CASCADE,
  hike_session_id uuid NOT NULL REFERENCES public.hike_sessions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  item_key        text NOT NULL,
  product_id      uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  verdict         text NOT NULL CHECK (verdict IN
                    ('essentiel','utile','jamais_servi','defaillant','manquait')),
  note            text CHECK (char_length(note) <= 500),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hike_session_id, item_key)
);

-- Contrainte nommée pour les tests / erreurs claires
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kit_field_reports_note_chk') THEN
    ALTER TABLE public.kit_field_reports
      ADD CONSTRAINT kit_field_reports_note_chk CHECK (char_length(note) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kit_field_reports_verdict_chk') THEN
    ALTER TABLE public.kit_field_reports
      ADD CONSTRAINT kit_field_reports_verdict_chk
      CHECK (verdict IN ('essentiel','utile','jamais_servi','defaillant','manquait'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kit_field_reports_kit ON public.kit_field_reports (kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_field_reports_session ON public.kit_field_reports (hike_session_id);

-- RLS : lecture/écriture par le propriétaire UNIQUEMENT. Aucune lecture publique
-- directe — l'exposition ne passe que par les agrégats du Lot 4.
ALTER TABLE public.kit_field_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_reports_select_own" ON public.kit_field_reports;
CREATE POLICY "field_reports_select_own" ON public.kit_field_reports
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "field_reports_insert_own" ON public.kit_field_reports;
CREATE POLICY "field_reports_insert_own" ON public.kit_field_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "field_reports_update_own" ON public.kit_field_reports;
CREATE POLICY "field_reports_update_own" ON public.kit_field_reports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "field_reports_delete_own" ON public.kit_field_reports;
CREATE POLICY "field_reports_delete_own" ON public.kit_field_reports
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4) Trigger : field_proven_count — incrément AU SEUIL distance_km >= 1,
--    ajusté sur INSERT / UPDATE (kit_id, distance_km) / DELETE. Clamp >= 0.
--    SECURITY DEFINER : le compteur vit sur materiel_kits, potentiellement un
--    kit d'un autre utilisateur (les sessions sont à soi).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_field_proven_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_kit uuid := NULL;
  v_new_kit uuid := NULL;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF TG_OP = 'UPDATE' THEN
      v_old_kit := OLD.kit_id;
    END IF;
    v_new_kit := NEW.kit_id;
  ELSE
    v_old_kit := OLD.kit_id;
  END IF;

  IF v_old_kit IS NOT NULL AND OLD.distance_km >= 1 THEN
    UPDATE public.materiel_kits
    SET field_proven_count = GREATEST(0, field_proven_count - 1)
    WHERE id = v_old_kit;
  END IF;

  IF v_new_kit IS NOT NULL AND NEW.distance_km >= 1 THEN
    UPDATE public.materiel_kits
    SET field_proven_count = field_proven_count + 1
    WHERE id = v_new_kit;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_hike_sessions_field_proven_count ON public.hike_sessions;
CREATE TRIGGER trg_hike_sessions_field_proven_count
AFTER INSERT OR UPDATE OF kit_id, distance_km OR DELETE ON public.hike_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_field_proven_count();

-- ----------------------------------------------------------------------------
-- 5) Journal de lignée — agrégats anonymisés, accessibles aux utilisateurs
--    connectés (le KitSheet du Lot 5 en consommera). SECURITY DEFINER +
--    search_path verrouillé. AUCUNE donnée de localisation précise ne sort :
--    granularité maximale = region (massif).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_kit_journal(p_kit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kit  public.materiel_kits%ROWTYPE;
  v_out  jsonb;
BEGIN
  SELECT * INTO v_kit FROM public.materiel_kits WHERE id = p_kit_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'kit_id',    v_kit.id,
    'birth',     jsonb_build_object(
                   'origin',      v_kit.origin,
                   'created_at',  v_kit.created_at,
                   'generation',  v_kit.generation
                 ),
    'lineage',   jsonb_build_object(
                   'fork_count',     (SELECT count(*) FROM public.materiel_kits
                                      WHERE lineage_root_id = v_kit.lineage_root_id
                                        AND id <> v_kit.id),
                   'max_generation', (SELECT max(generation) FROM public.materiel_kits
                                      WHERE lineage_root_id = v_kit.lineage_root_id)
                 ),
    'field',     jsonb_build_object(
                   'session_count',
                     (SELECT count(*) FROM public.hike_sessions WHERE kit_id = v_kit.id),
                   'total_km',
                     round(COALESCE((SELECT sum(distance_km) FROM public.hike_sessions
                                     WHERE kit_id = v_kit.id), 0)::numeric, 1),
                   'total_elevation_gain_m',
                     (SELECT COALESCE(sum(elevation_gain_m), 0) FROM public.hike_sessions
                      WHERE kit_id = v_kit.id),
                   'seasons', (SELECT jsonb_object_agg(s, c) FROM (
                                  SELECT CASE
                                           WHEN EXTRACT(MONTH FROM started_at) IN (12,1,2) THEN 'hiver'
                                           WHEN EXTRACT(MONTH FROM started_at) IN (3,4,5) THEN 'printemps'
                                           WHEN EXTRACT(MONTH FROM started_at) IN (6,7,8) THEN 'ete'
                                           ELSE 'automne'
                                         END AS s,
                                         count(*) AS c
                                  FROM public.hike_sessions
                                  WHERE kit_id = v_kit.id
                                  GROUP BY s) seasons),
                   'regions', (SELECT jsonb_agg(row) FROM (
                                  SELECT r.region, count(*) AS sessions
                                  FROM public.hike_sessions s
                                  JOIN public.hiking_routes r ON r.id = s.route_id
                                  WHERE s.kit_id = v_kit.id AND r.region IS NOT NULL
                                  GROUP BY r.region
                                  ORDER BY count(*) DESC) row)
                 ),
    'ecosystem', jsonb_build_object(
                   'public_carnet_count',
                     (SELECT count(*) FROM public.carnets
                      WHERE author_id = v_kit.user_id AND visibility = 'public'),
                   'public_carnet_moment_count',
                     (SELECT count(*) FROM public.carnet_moments cm
                      JOIN public.carnets c ON c.id = cm.carnet_id
                      WHERE c.author_id = v_kit.user_id AND c.visibility = 'public')
                 )
  ) INTO v_out;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.get_kit_journal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kit_journal(uuid) TO authenticated;