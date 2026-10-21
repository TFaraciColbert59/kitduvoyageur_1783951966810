-- 2026-10-22 — Privilèges des fonctions recréées pour les prêts.
-- `create or replace function` ne réapplique pas les revoke/grant d'origine :
-- sans ce bloc, PUBLIC garde EXECUTE et `return_inventory_item` perdrait
-- l'accès `authenticated` attendu par l'appel RPC de Compas.
revoke all on function public.inventory_guard() from public, anon;
revoke all on function public.inventory_loan_guard() from public, anon;
revoke all on function public.inventory_loan_return() from public, anon;
revoke all on function public.return_inventory_item(uuid) from public, anon;
grant execute on function public.return_inventory_item(uuid) to authenticated;
