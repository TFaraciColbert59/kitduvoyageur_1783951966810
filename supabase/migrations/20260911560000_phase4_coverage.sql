-- ==============================================================================
-- Phase 4 — Couverture mondiale, randonnées et POI
-- Migration : modèle de couverture versionné + registre de licences + garde-fous.
--
-- CHANTIER_LANCEMENT_MONDIAL §Phase 4 :
--   • table(s) de couverture par pays/région (dataset versionné, statut,
--     métriques de qualité, source + licence référencée, horodatage/acteur) ;
--   • rollback de dataset possible (version précédente conservée/promouvable) ;
--   • RLS : lecture publique SEULEMENT pour `covered`, écriture service/admin ;
--   • jamais de `covered` sans licence enregistrée ni seuils atteints
--     (contraintes + triggers) ;
--   • registre de licences : une importation sans licence enregistrée est
--     refusée.
--
-- AUCUNE donnée géographique n'est insérée par cette migration : elle ne crée
-- que la structure, les garde-fous et un feature flag de publication DÉSACTIVÉ.
-- Strictement additive et idempotente.
-- ==============================================================================

-- ── 1. Types ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE TYPE public.coverage_status AS ENUM ('not_covered', 'experimental', 'covered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.coverage_dataset_status AS ENUM
    ('staged', 'validated', 'published', 'rolled_back', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.coverage_license_status AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Registre de licences ──────────────────────────────────────────────────
-- Une licence n'existe que si une PREUVE HUMAINE est enregistrée
-- (URL de licence, courriel d'autorisation, contrat...). Aucune licence
-- n'est créée ici : le contrat/licence des données est une décision humaine.
CREATE TABLE IF NOT EXISTS public.coverage_licenses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  license_url             text,
  attribution_text        text,
  allows_redistribution   boolean NOT NULL DEFAULT false,
  allows_commercial_use   boolean NOT NULL DEFAULT false,
  share_alike             boolean NOT NULL DEFAULT false,
  evidence_url            text,
  evidence_note           text,
  status                  public.coverage_license_status NOT NULL DEFAULT 'active',
  registered_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  registered_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at              timestamptz,
  revoked_reason          text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coverage_licenses_evidence_chk'
  ) THEN
    ALTER TABLE public.coverage_licenses
      ADD CONSTRAINT coverage_licenses_evidence_chk CHECK (
        COALESCE(NULLIF(btrim(COALESCE(evidence_url, '')), ''), NULLIF(btrim(COALESCE(evidence_note, '')), '')) IS NOT NULL
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coverage_licenses_revoked_chk'
  ) THEN
    ALTER TABLE public.coverage_licenses
      ADD CONSTRAINT coverage_licenses_revoked_chk CHECK (
        (status = 'active' AND revoked_at IS NULL)
        OR (status = 'revoked' AND revoked_at IS NOT NULL)
      );
  END IF;
END $$;

-- ── 3. Régions de couverture ─────────────────────────────────────────────────
-- `region_code` = '' désigne le pays entier ; sinon une région administrative
-- (code GeoNames/ISO 3166-2). Le FK vers countries_geo interdit toute
-- déclaration de couverture sur un pays absent du référentiel réel.
CREATE TABLE IF NOT EXISTS public.coverage_regions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_iso_a2     text NOT NULL REFERENCES public.countries_geo(iso_a2) ON DELETE RESTRICT,
  region_code        text NOT NULL DEFAULT '',
  region_name        text,
  admin_region_id    uuid REFERENCES public.admin_regions_geo(id) ON DELETE SET NULL,
  status             public.coverage_status NOT NULL DEFAULT 'not_covered',
  active_dataset_id  uuid,
  -- Seuils décidés par l'humain (jsonb) : min_valid_geometries,
  -- min_sourced_pois, min_sampled_routes, max_unjustified_breaks.
  thresholds         jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at       timestamptz,
  published_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_iso_a2, region_code)
);

-- ── 4. Datasets versionnés ───────────────────────────────────────────────────
-- Chaque import produit une version. L'ancienne version n'est jamais
-- supprimée : elle reste promouvable (rollback).
CREATE TABLE IF NOT EXISTS public.coverage_datasets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id             uuid NOT NULL REFERENCES public.coverage_regions(id) ON DELETE CASCADE,
  dataset_key           text NOT NULL,
  version               text NOT NULL,
  source_name           text NOT NULL,
  source_url            text,
  license_id            uuid NOT NULL REFERENCES public.coverage_licenses(id) ON DELETE RESTRICT,
  status                public.coverage_dataset_status NOT NULL DEFAULT 'staged',
  pipeline_version      text NOT NULL,
  import_actor          text NOT NULL,
  imported_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at           timestamptz NOT NULL DEFAULT now(),
  -- Métriques de qualité mesurées par le pipeline (jamais inventées).
  total_features        integer NOT NULL DEFAULT 0 CHECK (total_features >= 0),
  valid_geometries      integer NOT NULL DEFAULT 0 CHECK (valid_geometries >= 0),
  invalid_geometries    integer NOT NULL DEFAULT 0 CHECK (invalid_geometries >= 0),
  unjustified_breaks    integer NOT NULL DEFAULT 0 CHECK (unjustified_breaks >= 0),
  sourced_pois          integer NOT NULL DEFAULT 0 CHECK (sourced_pois >= 0),
  sampled_routes        integer NOT NULL DEFAULT 0 CHECK (sampled_routes >= 0),
  metrics               jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum              text,
  supersedes_dataset_id uuid REFERENCES public.coverage_datasets(id) ON DELETE SET NULL,
  promoted_at           timestamptz,
  promoted_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rolled_back_at        timestamptz,
  rolled_back_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_key, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coverage_datasets_geometry_count_chk'
  ) THEN
    ALTER TABLE public.coverage_datasets
      ADD CONSTRAINT coverage_datasets_geometry_count_chk CHECK (
        valid_geometries + invalid_geometries <= total_features
      );
  END IF;
END $$;

-- FK circulaire région → dataset actif (ajoutée après la création de la table).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coverage_regions_active_dataset_fk'
  ) THEN
    ALTER TABLE public.coverage_regions
      ADD CONSTRAINT coverage_regions_active_dataset_fk
      FOREIGN KEY (active_dataset_id)
      REFERENCES public.coverage_datasets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ── 5. Journal append-only des datasets (traçabilité import/rollback) ────────
CREATE TABLE IF NOT EXISTS public.coverage_dataset_events (
  id            bigserial PRIMARY KEY,
  dataset_id    uuid NOT NULL REFERENCES public.coverage_datasets(id) ON DELETE CASCADE,
  event         text NOT NULL CHECK (event IN
                  ('imported', 'staged', 'validated', 'published', 'rolled_back', 'rejected')),
  actor         text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 6. Index ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coverage_regions_country
  ON public.coverage_regions (country_iso_a2, region_code);
CREATE INDEX IF NOT EXISTS idx_coverage_regions_status
  ON public.coverage_regions (status);
CREATE INDEX IF NOT EXISTS idx_coverage_datasets_region
  ON public.coverage_datasets (region_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_coverage_datasets_license
  ON public.coverage_datasets (license_id);
CREATE INDEX IF NOT EXISTS idx_coverage_dataset_events_dataset
  ON public.coverage_dataset_events (dataset_id, created_at DESC);

-- ── 7. updated_at ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coverage_licenses_updated_at ON public.coverage_licenses;
CREATE TRIGGER trg_coverage_licenses_updated_at
  BEFORE UPDATE ON public.coverage_licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_coverage_regions_updated_at ON public.coverage_regions;
CREATE TRIGGER trg_coverage_regions_updated_at
  BEFORE UPDATE ON public.coverage_regions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_coverage_datasets_updated_at ON public.coverage_datasets;
CREATE TRIGGER trg_coverage_datasets_updated_at
  BEFORE UPDATE ON public.coverage_datasets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 8. Garde-fous ────────────────────────────────────────────────────────────

-- 8a. Lecture d'un seuil entier (null si absent ou non numérique).
CREATE OR REPLACE FUNCTION public.coverage_threshold_int(p_thresholds jsonb, p_key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN COALESCE(p_thresholds ->> p_key, '') ~ '^[0-9]+$'
      THEN (p_thresholds ->> p_key)::integer
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.coverage_threshold_int(jsonb, text) IS
  'Phase 4 — seuil entier d''une région de couverture ; NULL si absent ou invalide.';

-- 8b. Un dataset ne peut exister qu'avec une licence enregistrée, active et
--     prouvée ; les statuts validé/publié exigent la redistribution.
CREATE OR REPLACE FUNCTION public.coverage_guard_dataset_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status     public.coverage_license_status;
  v_redistrib  boolean;
  v_evidence   text;
BEGIN
  SELECT l.status,
         l.allows_redistribution,
         COALESCE(
           NULLIF(btrim(COALESCE(l.evidence_url, '')), ''),
           NULLIF(btrim(COALESCE(l.evidence_note, '')), '')
         )
    INTO v_status, v_redistrib, v_evidence
  FROM public.coverage_licenses l
  WHERE l.id = NEW.license_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import refusé : licence % introuvable — une licence enregistrée est obligatoire.',
      NEW.license_id
      USING ERRCODE = '23514';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Import refusé : licence % non active (statut %).', NEW.license_id, v_status
      USING ERRCODE = '23514';
  END IF;

  IF v_evidence IS NULL THEN
    RAISE EXCEPTION 'Import refusé : licence % sans preuve enregistrée (URL ou note).', NEW.license_id
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IN ('validated', 'published') AND NOT v_redistrib THEN
    RAISE EXCEPTION 'Statut % refusé : la licence % n''autorise pas la redistribution.',
      NEW.status, NEW.license_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.coverage_guard_dataset_license() IS
  'Phase 4 — garde-fou d''import : sans licence enregistrée/active/prouvée, '
  'l''insertion d''un dataset est refusée ; validé/publié exigent la redistribution.';

DROP TRIGGER IF EXISTS trg_coverage_dataset_license_guard ON public.coverage_datasets;
CREATE TRIGGER trg_coverage_dataset_license_guard
  BEFORE INSERT OR UPDATE OF license_id, status ON public.coverage_datasets
  FOR EACH ROW EXECUTE FUNCTION public.coverage_guard_dataset_license();

-- 8c. Transitions de statut d'un dataset (conservation de l'historique).
CREATE OR REPLACE FUNCTION public.coverage_guard_dataset_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed text[];
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  v_allowed := CASE OLD.status::text
    WHEN 'staged'     THEN ARRAY['validated', 'rejected']
    WHEN 'validated'  THEN ARRAY['published', 'rejected', 'staged']
    WHEN 'published'  THEN ARRAY['rolled_back']
    WHEN 'rolled_back' THEN ARRAY['published', 'rejected']
    WHEN 'rejected'   THEN ARRAY['staged']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.status::text = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Transition de dataset refusée : % → %.', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  -- Gate du chantier : 20 parcours échantillonnés manuellement avant publication.
  IF NEW.status = 'published' AND NEW.sampled_routes < 20 THEN
    RAISE EXCEPTION 'Publication refusée : % parcours échantillonnés (< 20 exigés par le gate).',
      NEW.sampled_routes
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.coverage_guard_dataset_status() IS
  'Phase 4 — transitions de statut d''un dataset encadrées ; publication '
  'impossible sans 20 parcours échantillonnés manuellement.';

DROP TRIGGER IF EXISTS trg_coverage_dataset_status_guard ON public.coverage_datasets;
CREATE TRIGGER trg_coverage_dataset_status_guard
  BEFORE UPDATE ON public.coverage_datasets
  FOR EACH ROW EXECUTE FUNCTION public.coverage_guard_dataset_status();

-- 8d. Une région ne peut être `covered` que si TOUT est prouvé :
--     dataset actif appartenant à la région, statut validé/publié, licence
--     active + redistribution, seuils explicites et atteints, échantillonnage
--     ≥ 20 (gate), ruptures injustifiées sous le seuil.
CREATE OR REPLACE FUNCTION public.coverage_guard_region_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ds            public.coverage_datasets%ROWTYPE;
  v_lic           public.coverage_licenses%ROWTYPE;
  v_min_geoms     integer;
  v_min_pois      integer;
  v_min_samples   integer;
  v_max_breaks    integer;
BEGIN
  IF NEW.status <> 'covered' THEN
    NEW.published_at := NULL;
    NEW.published_by := NULL;
    RETURN NEW;
  END IF;

  IF NEW.active_dataset_id IS NULL THEN
    RAISE EXCEPTION 'Couverture refusée : aucun dataset actif pour %.% (pays + région).',
      NEW.country_iso_a2, NEW.region_code
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_ds FROM public.coverage_datasets d WHERE d.id = NEW.active_dataset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Couverture refusée : dataset % introuvable.', NEW.active_dataset_id
      USING ERRCODE = '23514';
  END IF;

  IF v_ds.region_id <> NEW.id THEN
    RAISE EXCEPTION 'Couverture refusée : le dataset % n''appartient pas à la région %.',
      v_ds.id, NEW.id
      USING ERRCODE = '23514';
  END IF;

  IF v_ds.status NOT IN ('validated', 'published') THEN
    RAISE EXCEPTION 'Couverture refusée : dataset au statut % (validé ou publié requis).',
      v_ds.status
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_lic FROM public.coverage_licenses l WHERE l.id = v_ds.license_id;
  IF NOT FOUND OR v_lic.status <> 'active' OR NOT v_lic.allows_redistribution THEN
    RAISE EXCEPTION 'Couverture refusée : licence absente, inactive ou sans redistribution autorisée.'
      USING ERRCODE = '23514';
  END IF;

  v_min_geoms   := public.coverage_threshold_int(NEW.thresholds, 'min_valid_geometries');
  v_min_pois    := public.coverage_threshold_int(NEW.thresholds, 'min_sourced_pois');
  v_min_samples := public.coverage_threshold_int(NEW.thresholds, 'min_sampled_routes');
  v_max_breaks  := public.coverage_threshold_int(NEW.thresholds, 'max_unjustified_breaks');

  IF v_min_geoms IS NULL OR v_min_pois IS NULL OR v_min_samples IS NULL OR v_max_breaks IS NULL THEN
    RAISE EXCEPTION 'Couverture refusée : seuils explicites requis (min_valid_geometries, min_sourced_pois, min_sampled_routes, max_unjustified_breaks).'
      USING ERRCODE = '23514';
  END IF;

  -- Gate du chantier : 20 parcours échantillonnés manuellement.
  IF v_min_samples < 20 THEN
    RAISE EXCEPTION 'Couverture refusée : le seuil d''échantillonnage humain doit être ≥ 20 (reçu %).', v_min_samples
      USING ERRCODE = '23514';
  END IF;

  IF v_ds.valid_geometries < v_min_geoms THEN
    RAISE EXCEPTION 'Couverture refusée : % géométries valides < seuil % (dataset %).',
      v_ds.valid_geometries, v_min_geoms, v_ds.id
      USING ERRCODE = '23514';
  END IF;

  IF v_ds.sourced_pois < v_min_pois THEN
    RAISE EXCEPTION 'Couverture refusée : % POI sourcés < seuil % (dataset %).',
      v_ds.sourced_pois, v_min_pois, v_ds.id
      USING ERRCODE = '23514';
  END IF;

  IF v_ds.sampled_routes < v_min_samples THEN
    RAISE EXCEPTION 'Couverture refusée : % parcours échantillonnés < seuil % (dataset %).',
      v_ds.sampled_routes, v_min_samples, v_ds.id
      USING ERRCODE = '23514';
  END IF;

  IF v_ds.unjustified_breaks > v_max_breaks THEN
    RAISE EXCEPTION 'Couverture refusée : % ruptures injustifiées > seuil % (dataset %).',
      v_ds.unjustified_breaks, v_max_breaks, v_ds.id
      USING ERRCODE = '23514';
  END IF;

  NEW.published_at := COALESCE(NEW.published_at, now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.coverage_guard_region_status() IS
  'Phase 4 — jamais `covered` sans dataset réel, licence enregistrée, seuils '
  'explicites atteints et 20 parcours échantillonnés. Aucune déclaration de '
  'complaisance possible.';

DROP TRIGGER IF EXISTS trg_coverage_region_status_guard ON public.coverage_regions;
CREATE TRIGGER trg_coverage_region_status_guard
  BEFORE INSERT OR UPDATE ON public.coverage_regions
  FOR EACH ROW EXECUTE FUNCTION public.coverage_guard_region_status();

-- 8e. Journal automatique des imports et changements de statut.
CREATE OR REPLACE FUNCTION public.coverage_log_dataset_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor text;
  v_event text;
BEGIN
  v_actor := COALESCE(
    NULLIF(current_setting('coverage.actor', true), ''),
    NULLIF(auth.uid()::text, ''),
    'sql'
  );

  IF TG_OP = 'INSERT' THEN
    v_event := 'imported';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := NEW.status::text;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.coverage_dataset_events (dataset_id, event, actor, actor_user_id, details)
  VALUES (
    NEW.id, v_event, v_actor, auth.uid(),
    jsonb_build_object(
      'status', NEW.status,
      'license_id', NEW.license_id,
      'valid_geometries', NEW.valid_geometries,
      'invalid_geometries', NEW.invalid_geometries,
      'unjustified_breaks', NEW.unjustified_breaks,
      'sourced_pois', NEW.sourced_pois,
      'sampled_routes', NEW.sampled_routes
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coverage_dataset_events ON public.coverage_datasets;
CREATE TRIGGER trg_coverage_dataset_events
  AFTER INSERT OR UPDATE OF status ON public.coverage_datasets
  FOR EACH ROW EXECUTE FUNCTION public.coverage_log_dataset_event();

-- ── 9. Promotion et rollback de dataset (service/admin uniquement) ──────────
CREATE OR REPLACE FUNCTION public.coverage_promote_dataset(p_dataset_id uuid, p_actor text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ds  public.coverage_datasets%ROWTYPE;
  v_old uuid;
BEGIN
  IF current_user <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'coverage_promote_dataset : réservé service_role/admin.'
      USING ERRCODE = '42501';
  END IF;

  IF p_actor IS NULL OR btrim(p_actor) = '' THEN
    RAISE EXCEPTION 'coverage_promote_dataset : acteur d''import obligatoire.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('coverage.actor', btrim(p_actor), true);

  SELECT * INTO v_ds FROM public.coverage_datasets WHERE id = p_dataset_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coverage_promote_dataset : dataset % introuvable.', p_dataset_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT active_dataset_id INTO v_old
  FROM public.coverage_regions WHERE id = v_ds.region_id FOR UPDATE;

  IF v_old IS NOT NULL AND v_old <> p_dataset_id THEN
    UPDATE public.coverage_datasets
       SET status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid()
     WHERE id = v_old AND status = 'published';
  END IF;

  UPDATE public.coverage_datasets
     SET status = 'published',
         promoted_at = now(),
         promoted_by = auth.uid(),
         rolled_back_at = NULL,
         rolled_back_by = NULL
   WHERE id = p_dataset_id;

  UPDATE public.coverage_regions
     SET active_dataset_id = p_dataset_id,
         status = 'covered'
   WHERE id = v_ds.region_id;

  RETURN p_dataset_id;
END;
$$;

COMMENT ON FUNCTION public.coverage_promote_dataset(uuid, text) IS
  'Phase 4 — publie un dataset validé (version précédente conservée en '
  'rolled_back, donc re-promouvable). Les garde-fous s''appliquent.';

CREATE OR REPLACE FUNCTION public.coverage_rollback_region(
  p_region_id uuid,
  p_to_dataset_id uuid,
  p_actor text,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.coverage_regions%ROWTYPE;
  v_target public.coverage_datasets%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'coverage_rollback_region : réservé service_role/admin.'
      USING ERRCODE = '42501';
  END IF;

  IF p_actor IS NULL OR btrim(p_actor) = '' THEN
    RAISE EXCEPTION 'coverage_rollback_region : acteur obligatoire.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('coverage.actor', btrim(p_actor), true);

  SELECT * INTO v_region FROM public.coverage_regions WHERE id = p_region_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coverage_rollback_region : région % introuvable.', p_region_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target FROM public.coverage_datasets WHERE id = p_to_dataset_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coverage_rollback_region : dataset % introuvable.', p_to_dataset_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_target.region_id <> p_region_id THEN
    RAISE EXCEPTION 'coverage_rollback_region : le dataset % n''appartient pas à la région %.',
      p_to_dataset_id, p_region_id
      USING ERRCODE = '23514';
  END IF;

  IF v_target.status NOT IN ('validated', 'published', 'rolled_back') THEN
    RAISE EXCEPTION 'coverage_rollback_region : dataset au statut % non promouvable.',
      v_target.status
      USING ERRCODE = '23514';
  END IF;

  IF v_region.active_dataset_id IS NOT NULL
     AND v_region.active_dataset_id <> p_to_dataset_id THEN
    UPDATE public.coverage_datasets
       SET status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid()
     WHERE id = v_region.active_dataset_id
       AND status = 'published';
  END IF;

  UPDATE public.coverage_datasets
     SET status = 'published',
         promoted_at = now(),
         promoted_by = auth.uid(),
         rolled_back_at = NULL,
         rolled_back_by = NULL
   WHERE id = p_to_dataset_id;

  UPDATE public.coverage_regions
     SET active_dataset_id = p_to_dataset_id,
         status = 'covered',
         evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object(
           'last_rollback', jsonb_build_object(
             'at', now(),
             'actor', btrim(p_actor),
             'reason', p_reason,
             'from_dataset', v_region.active_dataset_id,
             'to_dataset', p_to_dataset_id
           )
         )
   WHERE id = p_region_id;

  RETURN p_to_dataset_id;
END;
$$;

COMMENT ON FUNCTION public.coverage_rollback_region(uuid, uuid, text, text) IS
  'Phase 4 — rollback d''un dataset : repromotion d''une version antérieure '
  'conservée, journalisée, sans suppression de l''historique.';

REVOKE ALL ON FUNCTION public.coverage_promote_dataset(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coverage_rollback_region(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coverage_threshold_int(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coverage_guard_dataset_license() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coverage_guard_dataset_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coverage_guard_region_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coverage_log_dataset_event() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.coverage_promote_dataset(uuid, text) FROM anon;
    REVOKE ALL ON FUNCTION public.coverage_rollback_region(uuid, uuid, text, text) FROM anon;
    REVOKE ALL ON FUNCTION public.coverage_threshold_int(jsonb, text) FROM anon;
    REVOKE ALL ON FUNCTION public.coverage_guard_dataset_license() FROM anon;
    REVOKE ALL ON FUNCTION public.coverage_guard_dataset_status() FROM anon;
    REVOKE ALL ON FUNCTION public.coverage_guard_region_status() FROM anon;
    REVOKE ALL ON FUNCTION public.coverage_log_dataset_event() FROM anon;
  END IF;
END $$;

-- Garde-fous : EXECUTE nécessaire au rôle qui écrit (trigger invoker).
GRANT EXECUTE ON FUNCTION public.coverage_threshold_int(jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coverage_guard_dataset_license() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coverage_guard_dataset_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coverage_guard_region_status() TO authenticated, service_role;
-- Promotion/rollback : service_role ou admin (vérifié dans le corps).
GRANT EXECUTE ON FUNCTION public.coverage_promote_dataset(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coverage_rollback_region(uuid, uuid, text, text) TO authenticated, service_role;

-- ── 10. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.coverage_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_dataset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_licenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_regions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_datasets FORCE ROW LEVEL SECURITY;

-- Licences : lecture publique des licences actives (transparence), écriture admin.
DROP POLICY IF EXISTS coverage_licenses_public_read ON public.coverage_licenses;
CREATE POLICY coverage_licenses_public_read
  ON public.coverage_licenses FOR SELECT TO public
  USING (status = 'active');

DROP POLICY IF EXISTS coverage_licenses_admin_all ON public.coverage_licenses;
CREATE POLICY coverage_licenses_admin_all
  ON public.coverage_licenses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Régions : lecture publique SEULEMENT pour `covered`.
DROP POLICY IF EXISTS coverage_regions_public_covered_read ON public.coverage_regions;
CREATE POLICY coverage_regions_public_covered_read
  ON public.coverage_regions FOR SELECT TO public
  USING (status = 'covered');

DROP POLICY IF EXISTS coverage_regions_admin_all ON public.coverage_regions;
CREATE POLICY coverage_regions_admin_all
  ON public.coverage_regions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Datasets : lecture publique seulement s'ils sont le dataset actif d'une
-- région `covered`.
DROP POLICY IF EXISTS coverage_datasets_public_read ON public.coverage_datasets;
CREATE POLICY coverage_datasets_public_read
  ON public.coverage_datasets FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.coverage_regions r
      WHERE r.active_dataset_id = coverage_datasets.id
        AND r.status = 'covered'
    )
  );

DROP POLICY IF EXISTS coverage_datasets_admin_all ON public.coverage_datasets;
CREATE POLICY coverage_datasets_admin_all
  ON public.coverage_datasets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Journal : lisible par les admins uniquement (audit).
DROP POLICY IF EXISTS coverage_dataset_events_admin_read ON public.coverage_dataset_events;
CREATE POLICY coverage_dataset_events_admin_read
  ON public.coverage_dataset_events FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 11. Droits API ───────────────────────────────────────────────────────────
GRANT SELECT ON public.coverage_licenses TO anon, authenticated;
GRANT SELECT ON public.coverage_regions TO anon, authenticated;
GRANT SELECT ON public.coverage_datasets TO anon, authenticated;
GRANT SELECT ON public.coverage_dataset_events TO authenticated;
GRANT ALL ON public.coverage_licenses TO service_role;
GRANT ALL ON public.coverage_regions TO service_role;
GRANT ALL ON public.coverage_datasets TO service_role;
GRANT ALL ON public.coverage_dataset_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.coverage_dataset_events_id_seq TO authenticated, service_role;

-- Moindre privilège : anon ne peut jamais écrire une couverture (la RLS le
-- bloquait déjà, le privilège est retiré en plus).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.coverage_licenses, public.coverage_regions,
     public.coverage_datasets, public.coverage_dataset_events
  FROM anon;

-- ── 12. Feature flag de publication — DÉSACTIVÉ par défaut ───────────────────
-- L'activation est une décision humaine ; aucun agent ne l'active.
INSERT INTO public.feature_flags (id, enabled, scope)
VALUES ('coverage_publication_enabled', false, 'global')
ON CONFLICT (id) DO NOTHING;

-- ── 13. Aucune donnée de couverture insérée ──────────────────────────────────
-- Volontairement : la matrice de couverture est générée depuis l'état réel
-- (docs/coverage/COVERAGE_MATRIX.md) et aucune région n'est déclarée couverte
-- sans dataset importé, licencié et échantillonné par un humain.
