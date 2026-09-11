-- ==============================================================================
-- A10 (10.7) — Consentements imposés et purge sur révocation
--
-- Audit 31bdb279 items #11, #12, #25 :
--   • le traitement GPS créait des observations sans contrôle de consentement ;
--   • la révocation ne purgeait ni observations, ni profil, ni prédictions,
--     ni agrégats collectifs ;
--   • un consentement était réputé actif dès qu'UNE ancienne version l'était.
--
-- has_active_consent() ne considère que la DERNIÈRE policy_version connue pour
-- le couple (user, purpose) : granted AND revoked_at IS NULL. Toute version
-- antérieure est ignorée (pas de cumul historique).
--
-- SECURITY DEFINER + search_path verrouillé, service_role uniquement.
-- Migration additive et idempotente.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.has_active_consent(
  p_user_id uuid,
  p_purpose text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE((
    SELECT (c.granted AND c.revoked_at IS NULL)
    FROM public.adventure_data_consents c
    WHERE c.user_id = p_user_id
      AND c.purpose = p_purpose
    ORDER BY c.policy_version DESC
    LIMIT 1
  ), false);
$fn$;

COMMENT ON FUNCTION public.has_active_consent(uuid, text) IS
  'A10 — consentement courant : seule la dernière policy_version du couple '
  '(user, purpose) est évaluée (granted AND revoked_at IS NULL). Les versions '
  'antérieures ne comptent jamais (audit #25). SECURITY DEFINER, service_role '
  'uniquement.';

REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.has_active_consent(uuid, text) TO service_role;

-- ==============================================================================
-- File d'événements — reprise fiable de la purge RGPD
--
-- Sans cette redéfinition, la purge pouvait ne jamais aboutir : le claim A1 ne
-- réclamait que `pending` et n'incrémentait pas `attempts`, tandis que
-- `markEventFailed` était terminal. Une erreur transitoire (RPC indisponible)
-- laissait donc la révocation définitivement non appliquée.
--
-- Le claim réclame désormais `pending` ET `failed` tant que `attempts < 5` et
-- incrémente `attempts` dans la même instruction atomique (SKIP LOCKED). Le
-- chemin d'échec applicatif écrit `status='failed'` + `error` : rejouable par
-- le claim. Après 5 tentatives, la ligne reste `failed` — état terminal, plus
-- jamais réclamée (documenté ci-dessous).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.claim_pending_adventure_events(p_limit integer DEFAULT 10)
RETURNS SETOF public.adventure_domain_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.adventure_domain_events
  SET status = 'processing',
      attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM public.adventure_domain_events
    WHERE status IN ('pending', 'failed')
      AND attempts < 5
    ORDER BY created_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

COMMENT ON FUNCTION public.claim_pending_adventure_events(integer) IS
  'A10 — réclame atomiquement jusqu''à p_limit événements de la file : '
  '`pending` et `failed` avec attempts < 5 (un échec transitoire est rejoué, '
  'la purge RGPD ne peut plus rester silencieusement non appliquée) ; '
  'incrémente attempts. À 5 tentatives, la ligne reste `failed` (état terminal). '
  'SECURITY DEFINER, service_role uniquement.';

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
