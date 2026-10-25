-- ═══════════════════════════════════════════════════════════════════════════
-- Routeur IA LKDV — fondations (cache JSONB, quota par feature, jobs async)
-- Idempotent : CREATE IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- NB : nom de fichier volontairement sans "cache" (règle *cache* du .gitignore).
-- Remplace l'ancienne version (réponse TEXT) — conversion défensive incluse.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Store de réponses IA (accès service role uniquement) ────────────────
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  cache_key  text PRIMARY KEY,
  feature    text NOT NULL DEFAULT 'general',
  response   jsonb NOT NULL,
  model      text,
  provider   text,
  hit_count  integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Garde défensive : si une ancienne version (response TEXT) avait été appliquée.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_response_cache'
      AND column_name = 'response'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE public.ai_response_cache
      ALTER COLUMN response TYPE jsonb USING to_jsonb(response::text);
  END IF;
END $$;

ALTER TABLE public.ai_response_cache ADD COLUMN IF NOT EXISTS provider text;

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expires_at
  ON public.ai_response_cache(expires_at);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_response_cache_select_false" ON public.ai_response_cache;
CREATE POLICY "ai_response_cache_select_false" ON public.ai_response_cache
  FOR SELECT USING (false);

-- ── 2. Consommation IA quotidienne (tier + par feature) ────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day                 date NOT NULL DEFAULT CURRENT_DATE,
  requests_heavy      integer NOT NULL DEFAULT 0,
  requests_fast       integer NOT NULL DEFAULT 0,
  requests_by_feature jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage_daily
  ADD COLUMN IF NOT EXISTS requests_by_feature jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_daily_select_own" ON public.ai_usage_daily;
CREATE POLICY "ai_usage_daily_select_own" ON public.ai_usage_daily
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Jobs IA asynchrones (récit post-randonnée, etc.) ─────────────────────
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature      text NOT NULL,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  result       jsonb,
  attempts     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_jobs_select_own" ON public.ai_jobs;
CREATE POLICY "ai_jobs_select_own" ON public.ai_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_jobs_insert_own" ON public.ai_jobs;
CREATE POLICY "ai_jobs_insert_own" ON public.ai_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created
  ON public.ai_jobs(status, created_at);

-- ── 4. Quota atomique : 20 heavy + 100 fast / jour / user, + plafond feature ─
-- INSERT ... ON CONFLICT ... DO UPDATE avec WHERE de garde : les compteurs sont
-- vérifiés AVANT l'incrément, en une seule instruction (atomique).
-- Appel rétrocompatible : (p_user_id, p_tier) seul → garde tier uniquement.
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota(
  p_user_id uuid,
  p_tier text,
  p_feature text DEFAULT NULL,
  p_feature_limit integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.ai_usage_daily%ROWTYPE;
BEGIN
  IF p_tier NOT IN ('heavy', 'fast') THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, day, requests_heavy, requests_fast, requests_by_feature)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_tier = 'heavy' THEN 1 ELSE 0 END,
    CASE WHEN p_tier = 'fast' THEN 1 ELSE 0 END,
    CASE WHEN p_feature IS NOT NULL THEN jsonb_build_object(p_feature, 1) ELSE '{}'::jsonb END
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    requests_heavy = public.ai_usage_daily.requests_heavy
      + (CASE WHEN p_tier = 'heavy' THEN 1 ELSE 0 END),
    requests_fast = public.ai_usage_daily.requests_fast
      + (CASE WHEN p_tier = 'fast' THEN 1 ELSE 0 END),
    requests_by_feature = CASE WHEN p_feature IS NOT NULL
      THEN jsonb_set(
        COALESCE(public.ai_usage_daily.requests_by_feature, '{}'::jsonb),
        ARRAY[p_feature],
        COALESCE((public.ai_usage_daily.requests_by_feature ->> p_feature)::int, 0) + 1
      )
      ELSE COALESCE(public.ai_usage_daily.requests_by_feature, '{}'::jsonb)
    END
  WHERE (
    CASE WHEN p_tier = 'heavy'
      THEN public.ai_usage_daily.requests_heavy < 20
      ELSE public.ai_usage_daily.requests_fast < 100
    END
    AND (
      p_feature IS NULL
      OR p_feature_limit <= 0
      OR COALESCE((public.ai_usage_daily.requests_by_feature ->> p_feature)::int, 0) < p_feature_limit
    )
  )
  RETURNING * INTO v_row;

  RETURN v_row.user_id IS NOT NULL;
END;
$$;

-- ── 5. Fonctions d'accès au store de réponses (service role uniquement) ────
CREATE OR REPLACE FUNCTION public.get_ai_cache(p_cache_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_response jsonb;
BEGIN
  SELECT response INTO v_response
  FROM public.ai_response_cache
  WHERE cache_key = p_cache_key
    AND expires_at > now();

  IF v_response IS NOT NULL THEN
    UPDATE public.ai_response_cache
    SET hit_count = hit_count + 1
    WHERE cache_key = p_cache_key;
  END IF;

  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ai_cache(
  p_cache_key text,
  p_feature text,
  p_response jsonb,
  p_model text,
  p_provider text,
  p_ttl_seconds integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.ai_response_cache
    (cache_key, feature, response, model, provider, hit_count, created_at, expires_at)
  VALUES (
    p_cache_key, p_feature, p_response, p_model, p_provider, 0, now(),
    now() + make_interval(secs => greatest(p_ttl_seconds, 60))
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    feature    = excluded.feature,
    response   = excluded.response,
    model      = excluded.model,
    provider   = excluded.provider,
    created_at = now(),
    expires_at = now() + make_interval(secs => greatest(p_ttl_seconds, 60));
$$;

-- ── 6. Claim atomique de jobs pending (SKIP LOCKED, cap tentatives) ─────────
-- attempts est incrémenté par la ROUTE (pas ici) : un job repoussé pour quota
-- ne brûle pas de tentative.
CREATE OR REPLACE FUNCTION public.claim_pending_ai_jobs(p_limit integer DEFAULT 10)
RETURNS SETOF public.ai_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.ai_jobs
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM public.ai_jobs
    WHERE status = 'pending'
      AND attempts < 5
    ORDER BY created_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- ── 7. Durcissement des privilèges ──────────────────────────────────────────
REVOKE ALL ON FUNCTION public.check_and_increment_ai_quota(uuid, text, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.get_ai_cache(text) FROM public;
REVOKE ALL ON FUNCTION public.set_ai_cache(text, text, jsonb, text, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.claim_pending_ai_jobs(integer) FROM public;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_quota(uuid, text, text, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_ai_cache(text, text, jsonb, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_pending_ai_jobs(integer) TO service_role;
