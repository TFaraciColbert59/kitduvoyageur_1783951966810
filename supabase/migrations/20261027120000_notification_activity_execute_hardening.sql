-- Activity functions were introduced after the previous trigger grant cleanup.
-- Trigger dispatch does not require client EXECUTE privileges. Their DEFINER
-- owner can still call notify_activity; preserve service_role's existing grant.
revoke all on function public.on_follow_activity() from public, anon, authenticated;
revoke all on function public.on_order_activity() from public, anon, authenticated;
revoke all on function public.on_loan_activity() from public, anon, authenticated;
revoke all on function public.on_badge_activity() from public, anon, authenticated;
revoke all on function public.on_challenge_activity() from public, anon, authenticated;
revoke all on function public.on_repost_activity() from public, anon, authenticated;

-- Internal notification writer: only the DEFINER activity triggers call it.
revoke all on function public.notify_activity(uuid, text, text, text, text, uuid, text, uuid, text)
  from public, anon, authenticated;
