-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20261012142746.
-- Conservé tel quel : source de vérité pour la rejouabilité.
ALTER TABLE public.adventure_domain_events
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMENT ON COLUMN public.adventure_domain_events.claimed_at IS
  'Instant de la dernière réclamation par le cron. Une ligne `processing` dont '
  'claimed_at a plus de 15 minutes (ou est NULL) est réclamée de nouveau.';

CREATE OR REPLACE FUNCTION public.claim_pending_adventure_events(p_limit integer DEFAULT 10)
RETURNS SETOF public.adventure_domain_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.adventure_domain_events
  SET status = 'processing',
      attempts = attempts + 1,
      claimed_at = now()
  WHERE id IN (
    SELECT id FROM public.adventure_domain_events
    WHERE attempts < 5
      AND (
        status IN ('pending', 'failed')
        OR (status = 'processing'
            AND (claimed_at IS NULL OR claimed_at < now() - interval '15 minutes'))
      )
    ORDER BY (event_type = 'consent.revoked') DESC, created_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

COMMENT ON FUNCTION public.claim_pending_adventure_events(integer) IS
  'A10 — réclame atomiquement jusqu''à p_limit événements : `pending` et `failed` '
  '(attempts < 5), plus `processing` dont le bail (claimed_at) a plus de 15 minutes. '
  '`consent.revoked` d''abord (purge RGPD), puis par date. Incrémente attempts ; '
  'à 5 tentatives la ligne reste terminale. SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.claim_pending_adventure_events(integer) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.claim_pending_adventure_events(integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.claim_pending_adventure_events(integer) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_pending_adventure_events(integer) TO service_role;
