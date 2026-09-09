-- ==============================================================================
-- CHANTIER H-ACT — COUCHE GROUPE UNIVERSELLE : ÉQUIPAGE AUTO PAR ACTIVITÉ
-- Migration : 20260909000000_activity_auto_crew.sql
-- Description : Chaque activité (voyage) dispose d'un équipage (`crew`) auto-créé
--               et invisible tant qu'il est solo. Colonne `crews.auto_created`,
--               trigger `trips` -> création de l'équipage + membre propriétaire,
--               backfill des voyages existants sans équipage.
-- ==============================================================================

BEGIN;

-- 1. COLONNE auto_created SUR CREWS
ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_crews_auto_created ON public.crews(auto_created);

-- 2. FONCTION DE CRÉATION D'ÉQUIPAGE AUTO (SECURITY DEFINER pour bypass RLS)
CREATE OR REPLACE FUNCTION public.lkv_ensure_auto_crew()
RETURNS TRIGGER AS $$
DECLARE
  v_crew_id UUID;
BEGIN
  -- Ne pas écraser un équipage déjà lié (choix explicite de l'utilisateur)
  IF NEW.crew_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.crews (
    name,
    slug,
    theme,
    visibility,
    max_members,
    created_by,
    auto_created
  )
  VALUES (
    CASE WHEN NEW.title IS NULL OR char_length(NEW.title) < 2
         THEN 'Mon équipage'
         ELSE NEW.title || ' — Équipage' END,
    public.lkv_slugify(COALESCE(NEW.title, 'equipage')) || '-' || substring(NEW.id::text, 1, 6),
    'Aventure',
    'private',
    12,
    NEW.user_id,
    true
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_crew_id;

  IF v_crew_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Propriétaire = premier membre owner actif
  INSERT INTO public.crew_members (crew_id, user_id, role, status)
  VALUES (v_crew_id, NEW.user_id, 'owner', 'active')
  ON CONFLICT (crew_id, user_id) DO NOTHING;

  NEW.crew_id := v_crew_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER SUR INSERT trips
DROP TRIGGER IF EXISTS trg_trips_ensure_auto_crew ON public.trips;
CREATE TRIGGER trg_trips_ensure_auto_crew
BEFORE INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.lkv_ensure_auto_crew();

-- 4. BACKFILL DES VOYAGES EXISTANTS SANS ÉQUIPAGE (idempotent)
DO $$
DECLARE
  r RECORD;
  v_crew_id UUID;
BEGIN
  FOR r IN
    SELECT id, title, user_id
    FROM public.trips
    WHERE crew_id IS NULL AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.crews (
      name,
      slug,
      theme,
      visibility,
      max_members,
      created_by,
      auto_created
    )
    VALUES (
      CASE WHEN r.title IS NULL OR char_length(r.title) < 2
           THEN 'Mon équipage'
           ELSE r.title || ' — Équipage' END,
      public.lkv_slugify(COALESCE(r.title, 'equipage')) || '-' || substring(r.id::text, 1, 6),
      'Aventure',
      'private',
      12,
      r.user_id,
      true
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO v_crew_id;

    IF v_crew_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.crew_members (crew_id, user_id, role, status)
    VALUES (v_crew_id, r.user_id, 'owner', 'active')
    ON CONFLICT (crew_id, user_id) DO NOTHING;

    UPDATE public.trips SET crew_id = v_crew_id WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;