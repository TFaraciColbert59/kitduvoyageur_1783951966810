-- ==============================================================================
-- A11 — Cohortes de rollout des feature flags (audit #33)
--
-- Le rollout 1 % → 100 % était impossible : `feature_flags.enabled` est un
-- booléen global. `feature_flag_cohorts` ajoute, par flag :
--   - un pourcentage d'activation (0..100) ;
--   - une allowlist interne prioritaire ;
--   - des exclusions explicites ;
--   - l'acteur et la date de dernière modification (audit des changements).
--
-- Attribution stable : `a11_cohort_bucket(uuid)` = premiers 8 caractères hex
-- du SHA-256 de l'UUID, modulo 100 (même formule que le domaine TS
-- `cohortBucketFromSha256Hex`, Node/navigateur/PostgreSQL compatibles).
--
-- RPC `current_feature_flags_for(uuid)` : un flag activé globalement sans
-- ligne de cohorte reste activé (comportement des flags existants préservés) ;
-- avec une ligne de cohorte, l'utilisateur doit être allowlisté ou tomber sous
-- le pourcentage, sans être exclu.
--
-- Écriture : service_role uniquement (aucune policy INSERT/UPDATE/DELETE).
-- Aucun flag n'est activé par cette migration. Additive et idempotente.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_cohorts (
  flag_id     text PRIMARY KEY REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  percentage  integer NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  allowlist   uuid[] NOT NULL DEFAULT '{}'::uuid[],
  exclusions  uuid[] NOT NULL DEFAULT '{}'::uuid[],
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_flag_cohorts IS
  'A11 — cohortes de rollout par flag : pourcentage (0..100), allowlist '
  'interne, exclusions, audit (updated_by/updated_at). service_role uniquement.';
COMMENT ON COLUMN public.feature_flag_cohorts.percentage IS
  'Pourcentage d''utilisateurs activés par bucket stable SHA-256 (0..100).';
COMMENT ON COLUMN public.feature_flag_cohorts.allowlist IS
  'UUID toujours activés, quel que soit le pourcentage (priorité maximale).';

ALTER TABLE public.feature_flag_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_cohorts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flag_cohorts_all_service" ON public.feature_flag_cohorts;
CREATE POLICY "feature_flag_cohorts_all_service"
  ON public.feature_flag_cohorts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.feature_flag_cohorts FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.feature_flag_cohorts FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.feature_flag_cohorts FROM authenticated;
  END IF;
END $$;
GRANT ALL ON TABLE public.feature_flag_cohorts TO service_role;

-- ── Bucket stable 0..99 (SHA-256, mêmes 8 premiers hex que le TS) ────────────
CREATE OR REPLACE FUNCTION public.a11_cohort_bucket(p_user_id uuid)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      ('x' || substring(encode(sha256(convert_to(p_user_id::text, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint
      % 100
    )::integer,
    0
  );
$$;

COMMENT ON FUNCTION public.a11_cohort_bucket(uuid) IS
  'A11 — bucket stable 0..99 d''un utilisateur : 8 premiers hex du SHA-256 '
  'de l''UUID modulo 100 (identique au domaine TS cohortBucketFromSha256Hex).';

REVOKE ALL ON FUNCTION public.a11_cohort_bucket(uuid) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a11_cohort_bucket(uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a11_cohort_bucket(uuid) FROM authenticated;
  END IF;
END $$;

-- ── Lecture des flags pour un utilisateur (cohorte appliquée) ────────────────
CREATE OR REPLACE FUNCTION public.current_feature_flags_for(p_user_id uuid)
RETURNS TABLE(id text, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    f.id,
    COALESCE(
      f.enabled
      AND (
        c.flag_id IS NULL
        OR p_user_id = ANY (c.allowlist)
        OR (
          NOT (p_user_id = ANY (c.exclusions))
          AND public.a11_cohort_bucket(p_user_id) < c.percentage
        )
      ),
      false
    ) AS enabled
  FROM public.feature_flags f
  LEFT JOIN public.feature_flag_cohorts c ON c.flag_id = f.id
  ORDER BY f.id;
$$;

COMMENT ON FUNCTION public.current_feature_flags_for(uuid) IS
  'A11 — flags visibles pour un utilisateur : enabled global ET (pas de '
  'cohorte OU allowlist OU (non exclu ET bucket < pourcentage)). SECURITY '
  'DEFINER, search_path verrouillé, EXECUTE authenticated uniquement.';

REVOKE ALL ON FUNCTION public.current_feature_flags_for(uuid) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.current_feature_flags_for(uuid) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.current_feature_flags_for(uuid) TO authenticated;
