-- ==============================================================================
-- CHANTIER UNIFICATION — PHASE 7 : BUS D'ÉVÉNEMENTS UNIQUE (lkv_events)
-- Migration: 20260907010000_create_lkv_events_bus.sql
-- ==============================================================================

-- 1. Table lkv_events
CREATE TABLE IF NOT EXISTS public.lkv_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'crew', 'public')),
  crew_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index optimisés pour les requêtes de flux d'activité et d'équipage
CREATE INDEX IF NOT EXISTS idx_lkv_events_actor ON public.lkv_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_lkv_events_crew ON public.lkv_events(crew_id);
CREATE INDEX IF NOT EXISTS idx_lkv_events_entity ON public.lkv_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_lkv_events_created_at ON public.lkv_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lkv_events_type ON public.lkv_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lkv_events_visibility ON public.lkv_events(visibility);

-- 2. Fonction de purge automatique RGPD (13 mois maximum de rétention)
CREATE OR REPLACE FUNCTION public.purge_expired_lkv_events()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.lkv_events
  WHERE created_at < now() - INTERVAL '13 months';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Row Level Security (RLS)
ALTER TABLE public.lkv_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Visibilité publique (tout le monde peut lire)
DROP POLICY IF EXISTS "lkv_events_select_public" ON public.lkv_events;
CREATE POLICY "lkv_events_select_public"
  ON public.lkv_events FOR SELECT TO public
  USING (visibility = 'public');

-- Policy 2: Visibilité acteur (chacun peut lire ses propres événements)
DROP POLICY IF EXISTS "lkv_events_select_actor" ON public.lkv_events;
CREATE POLICY "lkv_events_select_actor"
  ON public.lkv_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- Policy 3: Visibilité équipage (membres de l'équipage cible)
DROP POLICY IF EXISTS "lkv_events_select_crew" ON public.lkv_events;
CREATE POLICY "lkv_events_select_crew"
  ON public.lkv_events FOR SELECT TO authenticated
  USING (
    visibility = 'crew'
    AND crew_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = lkv_events.crew_id
      AND gm.user_id = auth.uid()
    )
  );

-- Policy 4: Insertion par utilisateur authentifié (soi-même comme auteur)
DROP POLICY IF EXISTS "lkv_events_insert_authenticated" ON public.lkv_events;
CREATE POLICY "lkv_events_insert_authenticated"
  ON public.lkv_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Policy 5: Contrôle total pour service_role
DROP POLICY IF EXISTS "lkv_events_all_service" ON public.lkv_events;
CREATE POLICY "lkv_events_all_service"
  ON public.lkv_events FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
