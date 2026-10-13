-- ==============================================================================
-- File d'événements — bail de réclamation et priorité à la purge RGPD
--
-- Deux défauts de `claim_pending_adventure_events` (A10) :
--
-- 1. Une ligne passée à `processing` n'était JAMAIS réclamée de nouveau : si le
--    traitement est coupé (délai du cron quotidien, fonction arrêtée par
--    l'hébergeur), la révocation de consentement restait non appliquée pour de
--    bon. Le claim marque désormais l'instant de réclamation (`claimed_at`) et
--    reprend une ligne `processing` dont le bail a expiré (15 minutes), dans la
--    limite des 5 tentatives déjà en place.
-- 2. L'ordre était purement chronologique : n'importe quelle session (même
--    anonyme) peut insérer des événements à son nom (policy d'insertion), donc
--    une rafale d'événements sans effet pouvait repousser une purge RGPD au-delà
--    du lot. `consent.revoked` passe devant.
--
-- Aucune donnée n'est supprimée. Rejouable (IF NOT EXISTS / CREATE OR REPLACE).
-- ==============================================================================

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
