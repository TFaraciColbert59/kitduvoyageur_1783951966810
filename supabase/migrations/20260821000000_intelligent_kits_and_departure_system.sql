-- ==============================================================================
-- CHANTIER ULTIME : KITS INTELLIGENTS, PRÉPARATION DE DÉPART & CYCLE DE VIE
-- ==============================================================================

-- 1. Table custom_kits (extension & fiabilisation)
CREATE TABLE IF NOT EXISTS public.custom_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  for_destination TEXT DEFAULT '',
  season TEXT DEFAULT '',
  activity TEXT DEFAULT 'randonnee',
  total_weight_g INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manuel', -- 'configurator', 'manuel', 'auto_prepared'
  status TEXT DEFAULT 'active', -- 'active', 'trash', 'archived'
  deleted_at TIMESTAMPTZ,
  is_favorite BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ,
  trail_id BIGINT REFERENCES public.hiking_routes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Colonnes additionnelles sûres si la table existait déjà
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '';
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS activity TEXT DEFAULT 'randonnee';
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manuel';
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS trail_id BIGINT REFERENCES public.hiking_routes(id) ON DELETE SET NULL;
ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.custom_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own custom_kits" ON public.custom_kits;
CREATE POLICY "Users manage own custom_kits" ON public.custom_kits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_custom_kits_user_status ON public.custom_kits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_custom_kits_deleted_at ON public.custom_kits(deleted_at);

-- 2. Table custom_kit_items (articles dans les kits)
CREATE TABLE IF NOT EXISTS public.custom_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES public.custom_kits(id) ON DELETE CASCADE,
  gear_item_id UUID REFERENCES public.gear_items(id) ON DELETE SET NULL,
  item_name TEXT,
  category TEXT DEFAULT 'Autre',
  weight_g INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  is_essential BOOLEAN DEFAULT false,
  is_checked BOOLEAN DEFAULT false,
  custom_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Autre';
ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS weight_g INTEGER DEFAULT 0;
ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS is_essential BOOLEAN DEFAULT false;
ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS is_checked BOOLEAN DEFAULT false;
ALTER TABLE public.custom_kit_items ADD COLUMN IF NOT EXISTS custom_notes TEXT DEFAULT '';

ALTER TABLE public.custom_kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own custom_kit_items" ON public.custom_kit_items;
CREATE POLICY "Users manage own custom_kit_items" ON public.custom_kit_items
  FOR ALL USING (
    kit_id IN (SELECT id FROM public.custom_kits WHERE user_id = auth.uid())
  )
  WITH CHECK (
    kit_id IN (SELECT id FROM public.custom_kits WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_custom_kit_items_kit_id ON public.custom_kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_custom_kit_items_gear_id ON public.custom_kit_items(gear_item_id);

-- 3. Fonction d'épuration automatique des kits en corbeille depuis plus de 10 jours
CREATE OR REPLACE FUNCTION public.cleanup_expired_trash_kits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.custom_kits
  WHERE status = 'trash'
    AND deleted_at IS NOT NULL
    AND deleted_at < (now() - INTERVAL '10 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fonction pour mettre à jour l'usage du matériel après une sortie terminée
CREATE OR REPLACE FUNCTION public.record_hike_gear_usage(p_gear_ids UUID[])
RETURNS void AS $$
BEGIN
  IF p_gear_ids IS NOT NULL AND array_length(p_gear_ids, 1) > 0 THEN
    UPDATE public.gear_items
    SET 
      usage_count = COALESCE(usage_count, 0) + 1,
      last_used_date = CURRENT_DATE,
      sorties_count = COALESCE(sorties_count, 0) + 1
    WHERE id = ANY(p_gear_ids)
      AND user_id = auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
