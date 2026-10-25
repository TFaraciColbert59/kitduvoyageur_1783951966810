-- V7 — Durcissement ACL de la vue KPI hub : réservée au service_role
-- (l'accès admin passe par /api/hub/dashboard). Sans ce REVOKE, les privilèges
-- par défaut Supabase exposeraient la vue à anon/authenticated via PostgREST.

REVOKE ALL ON public.hub_dashboard_kpis FROM anon, authenticated;

ALTER VIEW public.hub_dashboard_kpis SET (security_invoker = true);
