-- ==============================================================================
-- CHANTIER UNIFICATION LKDV — PHASE 3 : MODÈLE DE DONNÉES UNIFIÉ & RLS
-- Migration : 20260907000000_unify_crews_trips_rls.sql
-- Description : Création de `crews`, `crew_members`, `trip_participants`,
--               intégration `trips.crew_id`, fonction `lkv_can` et RLS unifiée.
-- ==============================================================================

BEGIN;

-- 1. EXTENSIONS & FONCTIONS UTILITAIRES
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE OR REPLACE FUNCTION public.lkv_slugify(v_text text)
RETURNS text AS $$
DECLARE
  clean_text text;
BEGIN
  clean_text := lower(unaccent(trim(v_text)));
  clean_text := regexp_replace(clean_text, '[^a-z0-9]+', '-', 'g');
  clean_text := regexp_replace(clean_text, '^-+|-+$', '', 'g');
  IF char_length(clean_text) < 3 THEN
    clean_text := clean_text || '-crew';
  END IF;
  RETURN substring(clean_text, 1, 80);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. TABLE DES ÉQUIPAGES (CREWS)
CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  description TEXT,
  theme TEXT DEFAULT 'Aventure',
  cover_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'link', 'public')),
  invite_code TEXT UNIQUE,
  max_members INTEGER NOT NULL DEFAULT 12 CHECK (max_members BETWEEN 2 AND 200),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_group_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLE DES MEMBRES D'ÉQUIPAGE (CREW_MEMBERS)
CREATE TABLE IF NOT EXISTS public.crew_members (
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'organizer', 'member', 'guest')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'left', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, user_id)
);

-- 4. ATTACHEMENT ÉQUIPAGE SUR TRIPS
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

-- 5. TABLE DES PARTICIPANTS AU VOYAGE (TRIP_PARTICIPANTS)
CREATE TABLE IF NOT EXISTS public.trip_participants (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'organizer', 'member', 'guest')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('invited', 'confirmed', 'declined', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

-- 6. INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_crews_slug ON public.crews(slug);
CREATE INDEX IF NOT EXISTS idx_crews_invite_code ON public.crews(invite_code);
CREATE INDEX IF NOT EXISTS idx_crews_created_by ON public.crews(created_by);
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON public.crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_crew_role ON public.crew_members(crew_id, role, status);
CREATE INDEX IF NOT EXISTS idx_trips_crew_id ON public.trips(crew_id);
CREATE INDEX IF NOT EXISTS idx_trip_participants_user_id ON public.trip_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_participants_trip_role ON public.trip_participants(trip_id, role, status);

-- 7. FONCTION DE CONTRÔLE D'ACCÈS CANONIQUE : lkv_can
CREATE OR REPLACE FUNCTION public.lkv_can(
  p_user_id UUID,
  p_resource TEXT,
  p_resource_id UUID,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_visibility TEXT;
  v_owner_id UUID;
  v_crew_id UUID;
BEGIN
  -- A. Accès anonyme (p_user_id NULL)
  IF p_user_id IS NULL THEN
    IF p_action <> 'select' THEN
      RETURN FALSE;
    END IF;

    IF p_resource = 'crews' THEN
      SELECT visibility INTO v_visibility FROM public.crews WHERE id = p_resource_id;
      RETURN v_visibility = 'public';
    ELSIF p_resource = 'trips' THEN
      SELECT visibility INTO v_visibility FROM public.trips WHERE id = p_resource_id;
      RETURN v_visibility = 'public';
    ELSE
      RETURN FALSE;
    END IF;
  END IF;

  -- B. Ressource : CREWS
  IF p_resource = 'crews' THEN
    -- Récupération métadonnées équipage
    SELECT created_by, visibility INTO v_owner_id, v_visibility
    FROM public.crews WHERE id = p_resource_id;

    IF NOT FOUND THEN
      -- Si insertion d'un nouvel équipage
      IF p_action = 'insert' THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;

    -- Créateur / Propriétaire direct
    IF v_owner_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    -- Rôle dans l'équipage
    SELECT role, status INTO v_role, v_status
    FROM public.crew_members
    WHERE crew_id = p_resource_id AND user_id = p_user_id;

    -- Statuts inactifs
    IF v_status IN ('left', 'removed') THEN
      RETURN (p_action = 'select' AND v_visibility = 'public');
    END IF;

    -- Droits par action
    IF p_action = 'select' THEN
      RETURN (v_status = 'active' OR v_visibility IN ('public', 'link'));
    ELSIF p_action = 'update' THEN
      RETURN (v_status = 'active' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'delete' THEN
      RETURN (v_status = 'active' AND v_role = 'owner');
    ELSE
      RETURN FALSE;
    END IF;

  -- C. Ressource : CREW_MEMBERS
  ELSIF p_resource = 'crew_members' THEN
    SELECT role, status INTO v_role, v_status
    FROM public.crew_members
    WHERE crew_id = p_resource_id AND user_id = p_user_id;

    IF p_action = 'select' THEN
      RETURN (v_status = 'active');
    ELSIF p_action = 'insert' THEN
      RETURN (v_status = 'active' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'update' THEN
      RETURN (v_status = 'active' AND v_role = 'owner');
    ELSIF p_action = 'delete' THEN
      -- Le propriétaire/organisateur peut retirer, ou l'utilisateur peut se retirer lui-même
      RETURN (v_status = 'active' AND (v_role IN ('owner', 'organizer') OR p_user_id IS NOT NULL));
    ELSE
      RETURN FALSE;
    END IF;

  -- D. Ressource : TRIPS
  ELSIF p_resource = 'trips' THEN
    SELECT user_id, crew_id, visibility INTO v_owner_id, v_crew_id, v_visibility
    FROM public.trips WHERE id = p_resource_id;

    IF NOT FOUND THEN
      IF p_action = 'insert' THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;

    -- Propriétaire du voyage
    IF v_owner_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    -- Participation directe au voyage
    SELECT role, status INTO v_role, v_status
    FROM public.trip_participants
    WHERE trip_id = p_resource_id AND user_id = p_user_id;

    IF v_status = 'confirmed' THEN
      IF p_action = 'select' THEN
        RETURN TRUE;
      ELSIF p_action = 'update' THEN
        RETURN v_role IN ('owner', 'organizer');
      ELSIF p_action = 'delete' THEN
        RETURN v_role = 'owner';
      END IF;
    END IF;

    -- Appartenance à l'équipage hôte
    IF v_crew_id IS NOT NULL THEN
      SELECT role, status INTO v_role, v_status
      FROM public.crew_members
      WHERE crew_id = v_crew_id AND user_id = p_user_id;

      IF v_status = 'active' THEN
        IF p_action = 'select' AND v_visibility <> 'private' THEN
          RETURN TRUE;
        ELSIF p_action = 'update' AND v_role IN ('owner', 'organizer') THEN
          RETURN TRUE;
        END IF;
      END IF;
    END IF;

    -- Règle de visibilité publique
    IF p_action = 'select' AND v_visibility = 'public' THEN
      RETURN TRUE;
    END IF;

    RETURN FALSE;

  -- E. Ressource : TRIP_PARTICIPANTS
  ELSIF p_resource = 'trip_participants' THEN
    SELECT user_id, crew_id INTO v_owner_id, v_crew_id
    FROM public.trips WHERE id = p_resource_id;

    IF v_owner_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    SELECT role, status INTO v_role, v_status
    FROM public.trip_participants
    WHERE trip_id = p_resource_id AND user_id = p_user_id;

    IF p_action = 'select' THEN
      RETURN (v_status = 'confirmed');
    ELSIF p_action = 'insert' THEN
      RETURN (v_status = 'confirmed' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'update' THEN
      RETURN (v_status = 'confirmed' AND v_role IN ('owner', 'organizer'));
    ELSIF p_action = 'delete' THEN
      RETURN (v_status = 'confirmed' AND (v_role IN ('owner', 'organizer') OR p_user_id IS NOT NULL));
    ELSE
      RETURN FALSE;
    END IF;

  END IF;

  RETURN FALSE;
END;
$$;

-- 8. POLICIES RLS SUR CREWS
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crews_select_policy" ON public.crews;
CREATE POLICY "crews_select_policy" ON public.crews
  FOR SELECT USING (public.lkv_can(auth.uid(), 'crews', id, 'select'));

DROP POLICY IF EXISTS "crews_insert_policy" ON public.crews;
CREATE POLICY "crews_insert_policy" ON public.crews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "crews_update_policy" ON public.crews;
CREATE POLICY "crews_update_policy" ON public.crews
  FOR UPDATE USING (public.lkv_can(auth.uid(), 'crews', id, 'update'));

DROP POLICY IF EXISTS "crews_delete_policy" ON public.crews;
CREATE POLICY "crews_delete_policy" ON public.crews
  FOR DELETE USING (public.lkv_can(auth.uid(), 'crews', id, 'delete'));

-- 9. POLICIES RLS SUR CREW_MEMBERS
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_members_select_policy" ON public.crew_members;
CREATE POLICY "crew_members_select_policy" ON public.crew_members
  FOR SELECT USING (public.lkv_can(auth.uid(), 'crews', crew_id, 'select'));

DROP POLICY IF EXISTS "crew_members_insert_policy" ON public.crew_members;
CREATE POLICY "crew_members_insert_policy" ON public.crew_members
  FOR INSERT WITH CHECK (public.lkv_can(auth.uid(), 'crew_members', crew_id, 'insert'));

DROP POLICY IF EXISTS "crew_members_update_policy" ON public.crew_members;
CREATE POLICY "crew_members_update_policy" ON public.crew_members
  FOR UPDATE USING (public.lkv_can(auth.uid(), 'crew_members', crew_id, 'update'));

DROP POLICY IF EXISTS "crew_members_delete_policy" ON public.crew_members;
CREATE POLICY "crew_members_delete_policy" ON public.crew_members
  FOR DELETE USING (public.lkv_can(auth.uid(), 'crew_members', crew_id, 'delete') OR auth.uid() = user_id);

-- 10. POLICIES RLS SUR TRIP_PARTICIPANTS
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_participants_select_policy" ON public.trip_participants;
CREATE POLICY "trip_participants_select_policy" ON public.trip_participants
  FOR SELECT USING (public.lkv_can(auth.uid(), 'trips', trip_id, 'select'));

DROP POLICY IF EXISTS "trip_participants_insert_policy" ON public.trip_participants;
CREATE POLICY "trip_participants_insert_policy" ON public.trip_participants
  FOR INSERT WITH CHECK (public.lkv_can(auth.uid(), 'trip_participants', trip_id, 'insert'));

DROP POLICY IF EXISTS "trip_participants_update_policy" ON public.trip_participants;
CREATE POLICY "trip_participants_update_policy" ON public.trip_participants
  FOR UPDATE USING (public.lkv_can(auth.uid(), 'trip_participants', trip_id, 'update'));

DROP POLICY IF EXISTS "trip_participants_delete_policy" ON public.trip_participants;
CREATE POLICY "trip_participants_delete_policy" ON public.trip_participants
  FOR DELETE USING (public.lkv_can(auth.uid(), 'trip_participants', trip_id, 'delete') OR auth.uid() = user_id);

-- 11. MIGRATION DES DONNÉES EXISTANTES (IDEMPOTENTE)
DO $$
BEGIN
  -- A. Migration travel_groups -> crews si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'travel_groups') THEN
    INSERT INTO public.crews (
      id, name, slug, description, theme, cover_url, visibility,
      invite_code, max_members, level, xp, created_by, legacy_group_id, created_at, updated_at
    )
    SELECT
      g.id,
      g.name,
      COALESCE(
        CASE WHEN g.name ~ '^[a-z0-9-]{3,80}$' THEN g.name ELSE NULL END,
        public.lkv_slugify(g.name) || '-' || substring(g.id::text, 1, 6)
      ),
      g.description,
      COALESCE(g.theme, 'Aventure'),
      g.cover_url,
      CASE WHEN g.visibility::text = 'invite_only' THEN 'link'
           WHEN g.visibility::text = 'public' THEN 'public'
           ELSE 'private' END,
      g.invite_code,
      COALESCE(g.max_members, 12),
      COALESCE(g.group_level, 1),
      COALESCE(g.group_xp, 0),
      COALESCE(g.owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
      g.id,
      COALESCE(g.created_at, now()),
      COALESCE(g.updated_at, now())
    FROM public.travel_groups g
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- B. Migration group_members -> crew_members si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
    INSERT INTO public.crew_members (crew_id, user_id, role, status, joined_at)
    SELECT
      gm.group_id,
      gm.user_id,
      CASE WHEN gm.role::text = 'organizer' THEN 'owner'
           WHEN gm.role::text = 'co_organizer' THEN 'organizer'
           WHEN gm.role::text = 'observer' THEN 'guest'
           ELSE 'member' END,
      CASE WHEN gm.status::text IN ('active', 'pending', 'left', 'removed') THEN gm.status::text
           ELSE 'active' END,
      COALESCE(gm.joined_at, now())
    FROM public.group_members gm
    JOIN public.crews c ON c.id = gm.group_id
    ON CONFLICT (crew_id, user_id) DO NOTHING;
  END IF;

  -- C. Migration trip_collaborators -> trip_participants si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trip_collaborators') THEN
    INSERT INTO public.trip_participants (trip_id, user_id, role, status, joined_at)
    SELECT
      tc.trip_id,
      tc.user_id,
      CASE WHEN tc.role::text = 'owner' THEN 'owner'
           WHEN tc.role::text = 'editor' THEN 'organizer'
           ELSE 'guest' END,
      'confirmed',
      COALESCE(tc.joined_at, now())
    FROM public.trip_collaborators tc
    ON CONFLICT (trip_id, user_id) DO NOTHING;
  END IF;

  -- D. Liaison trips.crew_id depuis trips.group_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'group_id') THEN
    UPDATE public.trips t
    SET crew_id = c.id
    FROM public.crews c
    WHERE t.group_id = c.legacy_group_id AND t.crew_id IS NULL;
  END IF;
END $$;

-- 12. VUES DE RÉTROCOMPATIBILITÉ
CREATE OR REPLACE VIEW public.travel_groups_legacy AS
SELECT
  c.id,
  c.name,
  c.description,
  NULL::text AS destination,
  c.theme,
  c.cover_url,
  c.visibility,
  c.invite_code,
  c.max_members,
  NULL::date AS departure_date,
  NULL::date AS return_date,
  0::numeric AS budget_target,
  c.created_by AS owner_id,
  c.level AS group_level,
  c.xp AS group_xp,
  0 AS optimization_score,
  c.created_at,
  c.updated_at
FROM public.crews c;

CREATE OR REPLACE VIEW public.trip_collaborators_legacy AS
SELECT
  tp.trip_id,
  tp.user_id,
  CASE WHEN tp.role = 'owner' THEN 'owner'
       WHEN tp.role = 'organizer' THEN 'editor'
       ELSE 'viewer' END AS role,
  NULL::uuid AS invited_by,
  tp.joined_at,
  tp.joined_at AS created_at,
  tp.joined_at AS updated_at
FROM public.trip_participants tp;

COMMIT;
