-- Revue SECURITY DEFINER (plan 2.4, garde `tests/ops/securityDefinerReview.spec.ts`) : deux fonctions de
-- déclencheur créées le 21 octobre 2026 gardaient le droit d'exécution par défaut de PostgreSQL (PUBLIC).
-- Ce sont des fonctions de déclencheur : le déclencheur les appelle sans ce droit ; personne n'a à les
-- appeler directement (elles contournent la RLS : `security definer`). On retire donc EXECUTE à tous.
-- Aucune suppression de données ; sans effet sur les déclencheurs `trg_community_post_shares_count` et
-- `trg_user_profile_handle`.
revoke all on function public.sync_community_post_shares_count() from public, anon, authenticated;
revoke all on function public.set_user_profile_handle() from public, anon, authenticated;
