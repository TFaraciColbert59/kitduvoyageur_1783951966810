-- ============================================================================
-- ADMIN OS P0-07 — Triage sécurité : FORCE RLS sur tables admin legacy.
-- DOWN : aucune (FORCE RLS = durcissement sans perte de données).
-- Périmètre volontairement conservateur : les fonctions DEFINER nommées
-- (decrement_stock_on_order, update_moderation_updated_at) sont déjà
-- durcies par 20260903030000 + 20260917010000 — pas de redéfinition ici.
-- Voir docs/admin-os/SECURITY_TRIAGE_P0.md (lignes 1-14).
-- ============================================================================

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue FORCE ROW LEVEL SECURITY;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
