-- Les fonctions d'activité sont appelées uniquement par leurs triggers.
-- Aucun rôle client ne doit pouvoir les exécuter directement.
revoke all on function public.notify_activity(uuid, text, text, text, text, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.on_follow_activity() from public, anon, authenticated;
revoke all on function public.on_order_activity() from public, anon, authenticated;
revoke all on function public.on_loan_activity() from public, anon, authenticated;
revoke all on function public.on_badge_activity() from public, anon, authenticated;
revoke all on function public.on_challenge_activity() from public, anon, authenticated;
revoke all on function public.on_repost_activity() from public, anon, authenticated;
