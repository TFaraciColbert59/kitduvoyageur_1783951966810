-- Strava & Komoot Club Extensions + Gear Vault
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS who_can_post text NOT NULL DEFAULT 'members'
    CHECK (who_can_post IN ('members', 'admins_only'));

ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS surface_type text NOT NULL DEFAULT 'trail'
    CHECK (surface_type IN ('road', 'trail', 'gravel', 'mixed'));

-- Komoot-style Collections & Multi-day Routes
CREATE TABLE IF NOT EXISTS public.club_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  discipline text NOT NULL DEFAULT 'trail',
  difficulty text NOT NULL DEFAULT 'intermediaire',
  is_multi_day boolean NOT NULL DEFAULT false,
  cover_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_collection_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.club_collections(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  day_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  distance_km numeric(7,2) NOT NULL DEFAULT 0,
  elevation_gain_m integer NOT NULL DEFAULT 0,
  surface_breakdown jsonb NOT NULL DEFAULT '{"trail":100}'::jsonb,
  geojson jsonb,
  start_lat double precision,
  start_lng double precision,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Komoot-style Collaborative Highlights
CREATE TABLE IF NOT EXISTS public.club_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  tip text,
  category text NOT NULL DEFAULT 'panorama'
    CHECK (category IN ('panorama', 'eau', 'refuge', 'danger', 'singletrack')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  photo_url text,
  upvotes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_highlight_votes (
  highlight_id uuid NOT NULL REFERENCES public.club_highlights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (highlight_id, user_id)
);

-- Shared Club Gear Vault & Standard Kits
CREATE TABLE IF NOT EXISTS public.club_gear_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  category text NOT NULL DEFAULT 'Bivouac & Sécurité',
  weight_g integer NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_gear_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid NOT NULL REFERENCES public.club_gear_items(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  borrower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'returned', 'declined')),
  needed_from date,
  needed_until date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_standard_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  season text NOT NULL DEFAULT '3 saisons',
  total_weight_g integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_collection_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_highlight_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_gear_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_standard_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_collections_read" ON public.club_collections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND (c.privacy = 'public' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active')))
);
CREATE POLICY "club_collection_routes_read" ON public.club_collection_routes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND (c.privacy = 'public' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active')))
);
CREATE POLICY "club_highlights_read" ON public.club_highlights FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND (c.privacy = 'public' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active')))
);
CREATE POLICY "club_highlight_votes_read" ON public.club_highlight_votes FOR SELECT USING (true);
CREATE POLICY "club_gear_items_read" ON public.club_gear_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND (c.privacy = 'public' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active')))
);
CREATE POLICY "club_gear_loans_read" ON public.club_gear_loans FOR SELECT USING (
  auth.uid() = borrower_id OR EXISTS (SELECT 1 FROM public.club_gear_items g WHERE g.id = gear_item_id AND g.owner_id = auth.uid())
);
CREATE POLICY "club_standard_kits_read" ON public.club_standard_kits FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND (c.privacy = 'public' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active')))
);

CREATE POLICY "club_collections_insert" ON public.club_collections FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
CREATE POLICY "club_collection_routes_insert" ON public.club_collection_routes FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
CREATE POLICY "club_highlights_insert" ON public.club_highlights FOR INSERT WITH CHECK (
  auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
CREATE POLICY "club_highlight_votes_write" ON public.club_highlight_votes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "club_gear_items_insert" ON public.club_gear_items FOR INSERT WITH CHECK (
  auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
CREATE POLICY "club_gear_items_update" ON public.club_gear_items FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "club_gear_loans_insert" ON public.club_gear_loans FOR INSERT WITH CHECK (
  auth.uid() = borrower_id AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
CREATE POLICY "club_gear_loans_update" ON public.club_gear_loans FOR UPDATE USING (
  auth.uid() = borrower_id OR EXISTS (SELECT 1 FROM public.club_gear_items g WHERE g.id = gear_item_id AND g.owner_id = auth.uid())
);
CREATE POLICY "club_standard_kits_insert" ON public.club_standard_kits FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
