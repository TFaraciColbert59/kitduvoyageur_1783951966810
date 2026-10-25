-- ============================================================================
-- Séquencement de déploiement — à appliquer UNIQUEMENT APRÈS que la nouvelle
-- app soit servie (route `/api/rewards/claim` migrée en service_role).
--
-- Avant : l'app déployée appelle `claim_reward_points` avec la session
-- utilisateur ; révoquer avant le déploiement interromprait les récompenses.
-- Après : plus aucun client n'a besoin d'EXECUTE ; seul le service_role décide,
-- avec contrôle d'identité et validation des sources côté serveur.
-- ============================================================================

REVOKE ALL ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) IS
  'Attribution de récompenses économiques — service_role uniquement depuis le '
  'déploiement de la route serveur (séquencement 20260922000000).';
