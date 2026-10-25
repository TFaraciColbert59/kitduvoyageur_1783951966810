-- ==============================================================================
-- CHANTIER 1 — FONDATIONS DE L'ENTITÉ TRIP & TABLES FILLES
-- Migration: 20260904050000_trips_core.sql
-- ==============================================================================

-- 1. ENUMS CANONIQUES
DO $$ BEGIN
  CREATE TYPE public.trip_status AS ENUM ('draft', 'planned', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_visibility AS ENUM ('private', 'unlisted', 'public');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_collaborator_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_activity_type AS ENUM ('hiking', 'trekking', 'bivouac', 'roadtrip', 'cultural', 'bushcraft', 'mixed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_difficulty AS ENUM ('easy', 'moderate', 'hard', 'expert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_item_status AS ENUM ('packed', 'needed', 'optional', 'missing');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_budget_currency AS ENUM ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_document_category AS ENUM ('passport', 'insurance', 'booking', 'ticket', 'medical', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_step_transport AS ENUM ('foot', 'car', 'bus', 'train', 'plane', 'boat', 'bike', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. TABLE PRINCIPALE : TRIPS
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  destination_country_code TEXT REFERENCES public.countries_geo(iso_a2) ON DELETE SET NULL,
  destination_name TEXT,
  start_date DATE,
  end_date DATE,
  status public.trip_status NOT NULL DEFAULT 'draft',
  visibility public.trip_visibility NOT NULL DEFAULT 'private',
  difficulty public.trip_difficulty NOT NULL DEFAULT 'moderate',
  primary_activity public.trip_activity_type NOT NULL DEFAULT 'hiking',
  estimated_budget NUMERIC(10,2),
  budget_currency public.trip_budget_currency NOT NULL DEFAULT 'EUR',
  cover_image_url TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.travel_groups(id) ON DELETE SET NULL,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_trips_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_trips_budget CHECK (estimated_budget IS NULL OR estimated_budget >= 0),
  CONSTRAINT chk_trips_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 120)
);

-- 3. LES 8 TABLES FILLES

-- 3.1 Collaborateurs
CREATE TABLE IF NOT EXISTS public.trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.trip_collaborator_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

-- 3.2 Étapes / Itinéraire
CREATE TABLE IF NOT EXISTS public.trip_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number >= 1),
  order_index INT NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  accommodation_name TEXT,
  transport_mode public.trip_step_transport,
  distance_km NUMERIC(6,2) CHECK (distance_km IS NULL OR distance_km >= 0),
  elevation_gain_m INT CHECK (elevation_gain_m IS NULL OR elevation_gain_m >= 0),
  elevation_loss_m INT CHECK (elevation_loss_m IS NULL OR elevation_loss_m >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, day_number, order_index)
);

-- 3.3 Matériel & Sac à dos
CREATE TABLE IF NOT EXISTS public.trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  weight_grams NUMERIC(8,2) CHECK (weight_grams IS NULL OR weight_grams >= 0),
  is_packed BOOLEAN NOT NULL DEFAULT false,
  status public.trip_item_status NOT NULL DEFAULT 'needed',
  packed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inventory_item_id UUID,
  affiliate_link_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Dépenses
CREATE TABLE IF NOT EXISTS public.trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency public.trip_budget_currency NOT NULL DEFAULT 'EUR',
  category TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  split_type TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'individual')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 Documents de voyage
CREATE TABLE IF NOT EXISTS public.trip_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category public.trip_document_category NOT NULL DEFAULT 'other',
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  mime_type TEXT,
  expires_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 Points d'Intérêt (POIs)
CREATE TABLE IF NOT EXISTS public.trip_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.trip_steps(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  notes TEXT,
  visited BOOLEAN NOT NULL DEFAULT false,
  osm_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 Checkpoints de Sécurité
CREATE TABLE IF NOT EXISTS public.trip_safety_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  checked_at TIMESTAMPTZ,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked', 'missed', 'alert_sent')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 Notes & Carnet de bord
CREATE TABLE IF NOT EXISTS public.trip_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  day_number INT CHECK (day_number IS NULL OR day_number >= 1),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_slug ON public.trips(slug);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_visibility ON public.trips(visibility);
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON public.trips(group_id);
CREATE INDEX IF NOT EXISTS idx_trips_destination_country ON public.trips(destination_country_code);
CREATE INDEX IF NOT EXISTS idx_trips_share_token ON public.trips(share_token);
CREATE INDEX IF NOT EXISTS idx_trips_user_status ON public.trips(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_user_start_date ON public.trips(user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_trip_collab_trip_id ON public.trip_collaborators(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_collab_user_id ON public.trip_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_steps_trip_id ON public.trip_steps(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_steps_day_order ON public.trip_steps(trip_id, day_number, order_index);
CREATE INDEX IF NOT EXISTS idx_trip_items_trip_id ON public.trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_category ON public.trip_items(trip_id, category);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON public.trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_payer ON public.trip_expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_trip_docs_trip_id ON public.trip_documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_docs_user_id ON public.trip_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_pois_trip_id ON public.trip_pois(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_pois_step_id ON public.trip_pois(step_id);
CREATE INDEX IF NOT EXISTS idx_trip_safety_trip_id ON public.trip_safety_checkpoints(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_safety_scheduled ON public.trip_safety_checkpoints(trip_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_trip_notes_trip_id ON public.trip_notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_notes_author ON public.trip_notes(author_id);

-- 5. TRIGGERS UPDATED_AT AUTOMATIQUE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trips_updated_at ON public.trips;
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_collab_updated_at ON public.trip_collaborators;
CREATE TRIGGER trg_trip_collab_updated_at BEFORE UPDATE ON public.trip_collaborators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_steps_updated_at ON public.trip_steps;
CREATE TRIGGER trg_trip_steps_updated_at BEFORE UPDATE ON public.trip_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_items_updated_at ON public.trip_items;
CREATE TRIGGER trg_trip_items_updated_at BEFORE UPDATE ON public.trip_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_expenses_updated_at ON public.trip_expenses;
CREATE TRIGGER trg_trip_expenses_updated_at BEFORE UPDATE ON public.trip_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_docs_updated_at ON public.trip_documents;
CREATE TRIGGER trg_trip_docs_updated_at BEFORE UPDATE ON public.trip_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_pois_updated_at ON public.trip_pois;
CREATE TRIGGER trg_trip_pois_updated_at BEFORE UPDATE ON public.trip_pois FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_safety_updated_at ON public.trip_safety_checkpoints;
CREATE TRIGGER trg_trip_safety_updated_at BEFORE UPDATE ON public.trip_safety_checkpoints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_notes_updated_at ON public.trip_notes;
CREATE TRIGGER trg_trip_notes_updated_at BEFORE UPDATE ON public.trip_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. TRIGGER DE GÉNÉRATION AUTOMATIQUE DU SLUG (SI VIDE)
CREATE OR REPLACE FUNCTION public.generate_trip_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  random_suffix text;
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    base_slug := lower(regexp_replace(coalesce(NEW.title, 'voyage'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'voyage';
    END IF;
    IF length(base_slug) > 100 THEN
      base_slug := substring(base_slug from 1 for 100);
      base_slug := trim(both '-' from base_slug);
    END IF;
    random_suffix := lower(substring(md5(random()::text) from 1 for 6));
    NEW.slug := base_slug || '-' || random_suffix;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trips_generate_slug ON public.trips;
CREATE TRIGGER trg_trips_generate_slug
  BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.generate_trip_slug();

-- 7. TRIGGER AUTO-INSERTION DE L'OWNER COMME COLLABORATEUR 'owner'
CREATE OR REPLACE FUNCTION public.handle_trip_owner_collaborator()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.trip_collaborators (trip_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.user_id, 'owner', now())
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_trips_insert_owner ON public.trips;
CREATE TRIGGER trg_trips_insert_owner
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_trip_owner_collaborator();

-- 8. FONCTIONS ANTI-RÉCURSION RLS (SECURITY DEFINER STABLE)
CREATE OR REPLACE FUNCTION public.can_read_trip(p_trip_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_visibility public.trip_visibility;
  v_owner_id UUID;
  v_is_collab BOOLEAN;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT visibility, user_id INTO v_visibility, v_owner_id
  FROM public.trips
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Visible publiquement ou non répertorié
  IF v_visibility IN ('public', 'unlisted') THEN
    RETURN true;
  END IF;

  -- Utilisateur anonyme sur voyage privé
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Propriétaire direct
  IF v_owner_id = v_user_id THEN
    RETURN true;
  END IF;

  -- Collaborateur invité
  SELECT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = p_trip_id AND user_id = v_user_id
  ) INTO v_is_collab;

  RETURN v_is_collab;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_edit_trip(p_trip_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner_id UUID;
  v_role public.trip_collaborator_role;
BEGIN
  IF p_trip_id IS NULL OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_owner_id
  FROM public.trips
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_owner_id = v_user_id THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role
  FROM public.trip_collaborators
  WHERE trip_id = p_trip_id AND user_id = v_user_id;

  IF FOUND AND v_role IN ('owner', 'editor') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 9. ACTIVATION DE LA ROW LEVEL SECURITY (RLS) SUR LES 9 TABLES
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_safety_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_notes ENABLE ROW LEVEL SECURITY;

-- 10. POLICIES RLS

-- 10.1 Trips
DROP POLICY IF EXISTS "trips_select_policy" ON public.trips;
CREATE POLICY "trips_select_policy" ON public.trips
  FOR SELECT USING (
    visibility IN ('public', 'unlisted')
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.can_read_trip(id)
  );

DROP POLICY IF EXISTS "trips_insert_policy" ON public.trips;
CREATE POLICY "trips_insert_policy" ON public.trips
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "trips_update_policy" ON public.trips;
CREATE POLICY "trips_update_policy" ON public.trips
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.can_edit_trip(id)
  ) WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.can_edit_trip(id)
  );

DROP POLICY IF EXISTS "trips_delete_policy" ON public.trips;
CREATE POLICY "trips_delete_policy" ON public.trips
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND user_id = auth.uid()
  );

-- 10.2 Collaborateurs
DROP POLICY IF EXISTS "trip_collab_select_policy" ON public.trip_collaborators;
CREATE POLICY "trip_collab_select_policy" ON public.trip_collaborators
  FOR SELECT USING (
    public.can_read_trip(trip_id)
  );

DROP POLICY IF EXISTS "trip_collab_insert_policy" ON public.trip_collaborators;
CREATE POLICY "trip_collab_insert_policy" ON public.trip_collaborators
  FOR INSERT WITH CHECK (
    public.can_edit_trip(trip_id)
    OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "trip_collab_update_policy" ON public.trip_collaborators;
CREATE POLICY "trip_collab_update_policy" ON public.trip_collaborators
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "trip_collab_delete_policy" ON public.trip_collaborators;
CREATE POLICY "trip_collab_delete_policy" ON public.trip_collaborators
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) -- un collaborateur peut se retirer
    OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid()) -- l'owner peut retirer
  );

-- 10.3 Étapes
DROP POLICY IF EXISTS "trip_steps_select_policy" ON public.trip_steps;
CREATE POLICY "trip_steps_select_policy" ON public.trip_steps
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_steps_insert_policy" ON public.trip_steps;
CREATE POLICY "trip_steps_insert_policy" ON public.trip_steps
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_steps_update_policy" ON public.trip_steps;
CREATE POLICY "trip_steps_update_policy" ON public.trip_steps
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_steps_delete_policy" ON public.trip_steps;
CREATE POLICY "trip_steps_delete_policy" ON public.trip_steps
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 10.4 Items & Matériel
DROP POLICY IF EXISTS "trip_items_select_policy" ON public.trip_items;
CREATE POLICY "trip_items_select_policy" ON public.trip_items
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_items_insert_policy" ON public.trip_items;
CREATE POLICY "trip_items_insert_policy" ON public.trip_items
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_items_update_policy" ON public.trip_items;
CREATE POLICY "trip_items_update_policy" ON public.trip_items
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_items_delete_policy" ON public.trip_items;
CREATE POLICY "trip_items_delete_policy" ON public.trip_items
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 10.5 Dépenses
DROP POLICY IF EXISTS "trip_expenses_select_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_select_policy" ON public.trip_expenses
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_expenses_insert_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_insert_policy" ON public.trip_expenses
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_expenses_update_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_update_policy" ON public.trip_expenses
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_expenses_delete_policy" ON public.trip_expenses;
CREATE POLICY "trip_expenses_delete_policy" ON public.trip_expenses
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 10.6 Documents (⚠️ RGPD : SELECT réservé à can_edit_trip, jamais aux simples viewers publics)
DROP POLICY IF EXISTS "trip_documents_select_policy" ON public.trip_documents;
CREATE POLICY "trip_documents_select_policy" ON public.trip_documents
  FOR SELECT USING (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_documents_insert_policy" ON public.trip_documents;
CREATE POLICY "trip_documents_insert_policy" ON public.trip_documents
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_documents_update_policy" ON public.trip_documents;
CREATE POLICY "trip_documents_update_policy" ON public.trip_documents
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_documents_delete_policy" ON public.trip_documents;
CREATE POLICY "trip_documents_delete_policy" ON public.trip_documents
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 10.7 POIs
DROP POLICY IF EXISTS "trip_pois_select_policy" ON public.trip_pois;
CREATE POLICY "trip_pois_select_policy" ON public.trip_pois
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_pois_insert_policy" ON public.trip_pois;
CREATE POLICY "trip_pois_insert_policy" ON public.trip_pois
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_pois_update_policy" ON public.trip_pois;
CREATE POLICY "trip_pois_update_policy" ON public.trip_pois
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_pois_delete_policy" ON public.trip_pois;
CREATE POLICY "trip_pois_delete_policy" ON public.trip_pois
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 10.8 Safety Checkpoints
DROP POLICY IF EXISTS "trip_safety_select_policy" ON public.trip_safety_checkpoints;
CREATE POLICY "trip_safety_select_policy" ON public.trip_safety_checkpoints
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_safety_insert_policy" ON public.trip_safety_checkpoints;
CREATE POLICY "trip_safety_insert_policy" ON public.trip_safety_checkpoints
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_safety_update_policy" ON public.trip_safety_checkpoints;
CREATE POLICY "trip_safety_update_policy" ON public.trip_safety_checkpoints
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_safety_delete_policy" ON public.trip_safety_checkpoints;
CREATE POLICY "trip_safety_delete_policy" ON public.trip_safety_checkpoints
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 10.9 Notes
DROP POLICY IF EXISTS "trip_notes_select_policy" ON public.trip_notes;
CREATE POLICY "trip_notes_select_policy" ON public.trip_notes
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_notes_insert_policy" ON public.trip_notes;
CREATE POLICY "trip_notes_insert_policy" ON public.trip_notes
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_notes_update_policy" ON public.trip_notes;
CREATE POLICY "trip_notes_update_policy" ON public.trip_notes
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_notes_delete_policy" ON public.trip_notes;
CREATE POLICY "trip_notes_delete_policy" ON public.trip_notes
  FOR DELETE USING (public.can_edit_trip(trip_id));

-- 11. PERMISSIONS DE BASE
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT ON public.trips TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_collaborators TO authenticated;
GRANT SELECT ON public.trip_collaborators TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_steps TO authenticated;
GRANT SELECT ON public.trip_steps TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_items TO authenticated;
GRANT SELECT ON public.trip_items TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_expenses TO authenticated;
GRANT SELECT ON public.trip_expenses TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_documents TO authenticated;
-- anon n'a pas accès aux documents !

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_pois TO authenticated;
GRANT SELECT ON public.trip_pois TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_safety_checkpoints TO authenticated;
GRANT SELECT ON public.trip_safety_checkpoints TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_notes TO authenticated;
GRANT SELECT ON public.trip_notes TO anon;
