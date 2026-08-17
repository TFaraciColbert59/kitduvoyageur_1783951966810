-- Migration: Admin tables for Le Kit du Voyageur
-- Timestamp: 20260710110000

-- ─── Types ────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.admin_role CASCADE;
CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'moderateur');

DROP TYPE IF EXISTS public.audit_action CASCADE;
CREATE TYPE public.audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'REFUND', 'ROLE_CHANGE', 'SUSPEND', 'REACTIVATE');

DROP TYPE IF EXISTS public.sync_status CASCADE;
CREATE TYPE public.sync_status AS ENUM ('success', 'failed', 'pending');

DROP TYPE IF EXISTS public.moderation_status CASCADE;
CREATE TYPE public.moderation_status AS ENUM ('en_attente', 'approuve', 'rejete', 'signale');

-- ─── Tables ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.admin_role NOT NULL DEFAULT 'moderateur'::public.admin_role,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action public.audit_action NOT NULL,
    cible_type TEXT NOT NULL,
    cible_id TEXT NOT NULL,
    avant JSONB,
    apres JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.country_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'official',
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    statut public.sync_status NOT NULL DEFAULT 'pending'::public.sync_status,
    details JSONB
);

CREATE TABLE IF NOT EXISTS public.moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contenu_type TEXT NOT NULL,
    contenu_id TEXT NOT NULL,
    statut public.moderation_status NOT NULL DEFAULT 'en_attente'::public.moderation_status,
    moderateur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Soft-delete columns on key tables ───────────────────────────────────────
-- (Add archived_at to any existing tables that need soft-delete)
-- These are additive and safe to run multiple times

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON public.admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_country_sync_log_country_id ON public.country_sync_log(country_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_statut ON public.moderation_queue(statut);

-- ─── Unique constraint: one role per user ─────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_roles_unique_user ON public.admin_roles(user_id);

-- ─── Functions ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
    AND ar.role IN ('admin'::public.admin_role, 'super_admin'::public.admin_role)
)
$$;

CREATE OR REPLACE FUNCTION public.is_moderateur()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
)
$$;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT ar.role::TEXT FROM public.admin_roles ar WHERE ar.user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_moderation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- admin_roles: only admins can read/write
DROP POLICY IF EXISTS "admins_manage_admin_roles" ON public.admin_roles;
CREATE POLICY "admins_manage_admin_roles"
ON public.admin_roles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- admin_audit_log: admins can read, system writes
DROP POLICY IF EXISTS "admins_read_audit_log" ON public.admin_audit_log;
CREATE POLICY "admins_read_audit_log"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_audit_log" ON public.admin_audit_log;
CREATE POLICY "admins_insert_audit_log"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_moderateur());

-- country_sync_log: admins can read/write
DROP POLICY IF EXISTS "admins_manage_country_sync_log" ON public.country_sync_log;
CREATE POLICY "admins_manage_country_sync_log"
ON public.country_sync_log
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- moderation_queue: moderateurs can read/write
DROP POLICY IF EXISTS "modos_manage_moderation_queue" ON public.moderation_queue;
CREATE POLICY "modos_manage_moderation_queue"
ON public.moderation_queue
FOR ALL
TO authenticated
USING (public.is_moderateur())
WITH CHECK (public.is_moderateur());

-- ─── Triggers ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS moderation_updated_at_trigger ON public.moderation_queue;
CREATE TRIGGER moderation_updated_at_trigger
BEFORE UPDATE ON public.moderation_queue
FOR EACH ROW EXECUTE FUNCTION public.update_moderation_updated_at();
