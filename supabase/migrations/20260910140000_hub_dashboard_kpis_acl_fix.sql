-- V7 — Correctif ACL : security_invoker empêchait le service_role de lire la vue
-- (pas de SELECT sur auth.users). Le REVOKE de la migration précédente suffit à
-- fermer anon/authenticated ; la vue repasse en exécution propriétaire.

ALTER VIEW public.hub_dashboard_kpis RESET (security_invoker);
