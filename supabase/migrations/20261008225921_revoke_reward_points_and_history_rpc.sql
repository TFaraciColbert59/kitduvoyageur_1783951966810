-- Revue des fonctions SECURITY DEFINER (plan 2.4, 8 octobre) : deux fonctions
-- prenaient l'identité en paramètre sans la vérifier, et restaient appelables
-- par `anon` et `authenticated` en production (les révocations des migrations
-- du 17 et du 22 septembre n'y avaient jamais été appliquées) :
--   - claim_reward_points(p_user_id, …) : n'importe qui créditait des points
--     à n'importe quel compte ;
--   - log_materiel_history(p_user_id, …) : n'importe qui écrivait l'historique
--     d'un autre.
-- L'application n'appelle la première que par la clé de service
-- (`/api/rewards/claim`, identité tirée de la session) ; la seconde n'est
-- appelée par aucun client.
revoke execute on function public.claim_reward_points(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_reward_points(uuid, text, uuid, text, jsonb) to service_role;
revoke execute on function public.log_materiel_history(uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_materiel_history(uuid, text, text, uuid, text, jsonb) to service_role;
