-- ==============================================================================
-- A10 (10.5) — Lease, retry exponentiel et dead-letter des sessions GPS
--
-- Audit 31bdb279 item #6 : une session passée en `processing` par le claim
-- pouvait rester bloquée indéfiniment si le worker tombait (pas de lease, pas
-- de compteur de tentatives, pas d'état terminal).
--
--   • Colonnes de lease : processing_started_at, processing_attempts,
--     last_processing_error, next_retry_at.
--   • CHECK processing_status étendu à `dead_letter` (DROP/ADD gardé).
--   • a2_claim_pending_sessions(p_limit) : réclame les `pending` dues
--     (next_retry_at null ou passé) ET les `processing` dont le lease a expiré
--     (< 15 minutes) avec attempts < 5 ; incrémente attempts et pose
--     processing_started_at = now(). Les leases expirés à attempts >= 5 sont
--     basculés en `dead_letter` (état terminal, aucun blocage éternel).
--
-- Migration additive et idempotente ; service_role uniquement.
-- ==============================================================================

-- ── 1. Colonnes de lease ──────────────────────────────────────────────────────
ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processing_error text,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hike_sessions_processing_attempts_check'
      AND conrelid = 'public.hike_sessions'::regclass
  ) THEN
    ALTER TABLE public.hike_sessions
      ADD CONSTRAINT hike_sessions_processing_attempts_check
      CHECK (processing_attempts >= 0);
  END IF;
END $$;

-- Statut terminal `dead_letter` (contrainte recréée à l'identique si déjà à jour).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hike_sessions_processing_status_check'
      AND conrelid = 'public.hike_sessions'::regclass
  ) THEN
    ALTER TABLE public.hike_sessions
      DROP CONSTRAINT hike_sessions_processing_status_check;
  END IF;
  ALTER TABLE public.hike_sessions
    ADD CONSTRAINT hike_sessions_processing_status_check
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter'));
END $$;

COMMENT ON COLUMN public.hike_sessions.processing_started_at IS
  'A10 — début du lease de traitement ; un lease de plus de 15 minutes peut '
  'être repris par a2_claim_pending_sessions.';
COMMENT ON COLUMN public.hike_sessions.processing_attempts IS
  'A10 — nombre de tentatives de traitement ; à 5, la session passe en dead_letter.';
COMMENT ON COLUMN public.hike_sessions.last_processing_error IS
  'A10 — dernière erreur de traitement (diagnostic, jamais de donnée personnelle).';
COMMENT ON COLUMN public.hike_sessions.next_retry_at IS
  'A10 — prochaine reprise autorisée (backoff 2^attempts minutes) ; NULL = immédiate.';

CREATE INDEX IF NOT EXISTS idx_hike_sessions_claim_due
  ON public.hike_sessions(processing_status, next_retry_at)
  WHERE processing_status IN ('pending', 'processing');

-- ── 2. Claim atomique avec lease, retry et dead-letter ───────────────────────
CREATE OR REPLACE FUNCTION public.a2_claim_pending_sessions(p_limit integer DEFAULT 5)
RETURNS SETOF public.hike_sessions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH expired AS (
    SELECT id FROM public.hike_sessions
    WHERE processing_status = 'processing'
      AND processing_started_at IS NOT NULL
      AND processing_started_at < now() - interval '15 minutes'
      AND processing_attempts >= 5
    FOR UPDATE SKIP LOCKED
  ),
  dead_lettered AS (
    UPDATE public.hike_sessions hs
    SET processing_status = 'dead_letter',
        last_processing_error = COALESCE(
          hs.last_processing_error,
          'lease_expired_attempts_exhausted'
        ),
        updated_at = now()
    WHERE hs.id IN (SELECT id FROM expired)
    RETURNING hs.id
  )
  UPDATE public.hike_sessions
  SET processing_status = 'processing',
      processing_attempts = processing_attempts + 1,
      processing_started_at = now(),
      next_retry_at = NULL,
      updated_at = now()
  WHERE id IN (
    SELECT id FROM public.hike_sessions
    WHERE processing_attempts < 5
      AND (
        (
          processing_status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= now())
        )
        OR (
          processing_status = 'processing'
          AND processing_started_at IS NOT NULL
          AND processing_started_at < now() - interval '15 minutes'
        )
      )
    ORDER BY started_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

COMMENT ON FUNCTION public.a2_claim_pending_sessions(integer) IS
  'A10 — réserve atomiquement jusqu''à p_limit sessions à traiter : `pending` '
  'dues (next_retry_at null ou passé) et `processing` dont le lease a expiré '
  '(< 15 minutes), avec attempts < 5. Incrémente processing_attempts et pose '
  'processing_started_at. Les leases expirés à attempts >= 5 passent en '
  'dead_letter. Réservé au traitement serveur (service_role).';

REVOKE ALL ON FUNCTION public.a2_claim_pending_sessions(integer) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a2_claim_pending_sessions(integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a2_claim_pending_sessions(integer) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a2_claim_pending_sessions(integer) TO service_role;

-- ── 3. Backfill idempotent : sessions `processing` antérieures au lease ───────
-- Les sessions passées en `processing` avant l'introduction du lease n'ont pas
-- de `processing_started_at` : sans ce rattrapage elles resteraient invisibles
-- au claim (ni reprises, ni dead-letter). On leur pose un lease à now().
UPDATE public.hike_sessions
SET processing_started_at = now()
WHERE processing_status = 'processing'
  AND processing_started_at IS NULL;
