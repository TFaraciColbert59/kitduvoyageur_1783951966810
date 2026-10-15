-- The moderation resolver was created after A-214's grant sweep.
-- PostgreSQL functions default to EXECUTE for PUBLIC unless explicitly revoked.
-- As a SECURITY DEFINER trigger this must not be directly callable by anon.
-- Keep authenticated/service_role EXECUTE for RLS-backed updates.
REVOKE ALL ON FUNCTION public.stamp_report_resolution() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_report_resolution() TO authenticated, service_role;

-- For the newly introduced social kit validation trigger, make the
-- contract explicit even when default privileges differ between projects.
REVOKE ALL ON FUNCTION public.validate_community_post_shared_kit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_community_post_shared_kit() TO authenticated, service_role;
