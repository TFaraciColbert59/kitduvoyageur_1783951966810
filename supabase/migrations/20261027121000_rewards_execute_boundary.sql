-- Make the service-only boundary explicit for static and runtime permission
-- reviews. These preserve the grants already installed by the rewards v1
-- migration's dynamic signature loop; no client gains EXECUTE.
revoke all on function public.rewards_program_config() from public, anon, authenticated;
revoke all on function public.rewards_period_start(timestamptz) from public, anon, authenticated;
revoke all on function public.rewards_award_points(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.rewards_decide_award(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.rewards_reverse_award(uuid, text) from public, anon, authenticated;
revoke all on function public.rewards_redeem(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rewards_cancel_redemption(uuid, text) from public, anon, authenticated;
revoke all on function public.rewards_set_goal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rewards_wallet_snapshot(uuid) from public, anon, authenticated;
