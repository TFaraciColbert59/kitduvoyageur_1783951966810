-- LOT 4 : Fusion inventaire - Compléments fonctionnels
-- Ajout de fonctionnalités d'inventaire manquantes

-- 1. Table pour les catégories d'équipement personnalisées
CREATE TABLE IF NOT EXISTS public.gear_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '',
  color TEXT DEFAULT '#17402C',
  parent_category_id UUID REFERENCES public.gear_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.gear_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own categories" ON public.gear_categories FOR ALL USING (user_id = auth.uid());

-- 2. Table pour les emplacements de stockage
CREATE TABLE IF NOT EXISTS public.gear_locations (
  id UUID PRIMARY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  room TEXT DEFAULT '',
  shelf TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.gear_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own locations" ON public.gear_locations FOR ALL USING (user_id = auth.uid());

-- 3. Ajout des colonnes manquantes à gear_items
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.gear_locations(id) ON DELETE SET NULL;
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS custom_category_id UUID REFERENCES public.gear_categories(id) ON DELETE SET NULL;
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS insurance_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS last_used_date DATE;
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS service_interval_months INTEGER DEFAULT 12;

-- 4. Table pour les listes de vérification (checklists)
CREATE TABLE IF NOT EXISTS public.gear_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  for_trip_type TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.gear_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own checklists" ON public.gear_checklists FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.gear_checklist_items (
  checklist_id UUID REFERENCES public.gear_checklists(id) ON DELETE CASCADE,
  gear_item_id UUID REFERENCES public.gear_items(id) ON DELETE CASCADE,
  required BOOLEAN DEFAULT true,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (checklist_id, gear_item_id)
);
ALTER TABLE public.gear_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own checklist items" ON public.gear_checklist_items FOR ALL USING (
  checklist_id IN (SELECT id FROM public.gear_checklists WHERE user_id = auth.uid())
);

-- 5. Table pour les kits personnalisés
CREATE TABLE IF NOT EXISTS public.custom_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  for_destination TEXT DEFAULT '',
  total_weight_g INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.custom_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kits" ON public.custom_kits FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.custom_kit_items (
  kit_id UUID REFERENCES public.custom_kits(id) ON DELETE CASCADE,
  gear_item_id UUID REFERENCES public.gear_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kit_id, gear_item_id)
);
ALTER TABLE public.custom_kit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kit items" ON public.custom_kit_items FOR ALL USING (
  kit_id IN (SELECT id FROM public.custom_kits WHERE user_id = auth.uid())
);
