-- ==============================================================================
-- CHANTIER UNIFICATION LKDV — PHASE 3 : ROLLBACK MIGRATION
-- Migration : 20260907000000_unify_crews_trips_rls.down.sql
-- Description : Annulation transactionnelle et propre de la migration d'unification.
-- ==============================================================================

BEGIN;

-- 1. SUPPRESSION DES VUES DE COMPATIBILITÉ
DROP VIEW IF EXISTS public.trip_collaborators_legacy CASCADE;
DROP VIEW IF EXISTS public.travel_groups_legacy CASCADE;

-- 2. SUPPRESSION DES POLICIES ET TABLES PARTICIPANTS
DROP POLICY IF EXISTS "trip_participants_delete_policy" ON public.trip_participants;
DROP POLICY IF EXISTS "trip_participants_update_policy" ON public.trip_participants;
DROP POLICY IF EXISTS "trip_participants_insert_policy" ON public.trip_participants;
DROP POLICY IF EXISTS "trip_participants_select_policy" ON public.trip_participants;
DROP TABLE IF EXISTS public.trip_participants CASCADE;

-- 3. DÉTACHEMENT TRIPS.CREW_ID
ALTER TABLE public.trips DROP COLUMN IF EXISTS crew_id CASCADE;

-- 4. SUPPRESSION DES POLICIES ET TABLES MEMBRES & ÉQUIPAGES
DROP POLICY IF EXISTS "crew_members_delete_policy" ON public.crew_members;
DROP POLICY IF EXISTS "crew_members_update_policy" ON public.crew_members;
DROP POLICY IF EXISTS "crew_members_insert_policy" ON public.crew_members;
DROP POLICY IF EXISTS "crew_members_select_policy" ON public.crew_members;
DROP TABLE IF EXISTS public.crew_members CASCADE;

DROP POLICY IF EXISTS "crews_delete_policy" ON public.crews;
DROP POLICY IF EXISTS "crews_update_policy" ON public.crews;
DROP POLICY IF EXISTS "crews_insert_policy" ON public.crews;
DROP POLICY IF EXISTS "crews_select_policy" ON public.crews;
DROP TABLE IF EXISTS public.crews CASCADE;

-- 5. SUPPRESSION DES FONCTIONS ET EXTENSIONS
DROP FUNCTION IF EXISTS public.lkv_can(UUID, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.lkv_slugify(TEXT);

COMMIT;
