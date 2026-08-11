-- LOT 7: Calculs poids & optimisation
-- Migration: 20260810212500_lot7_weight_calculations_and_optimizations.sql
-- Auteur: LKDV Interconnectivity Repair
-- Description: Création des tables pour le calcul et l'optimisation des poids des kits de randonnée

BEGIN;

-- ===========================================================================
-- 1. Table des calculs de poids
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.weight_calculations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    kit_id uuid REFERENCES public.kits(id) ON DELETE CASCADE,
    calculated_at timestamptz DEFAULT now(),
    
    -- Poids total du kit
    total_weight_g numeric NOT NULL DEFAULT 0,
    total_weight_kg numeric GENERATED ALWAYS AS (total_weight_g / 1000.0) STORED,
    
    -- Détails par catégorie
    shelter_weight_g numeric DEFAULT 0,
    sleep_weight_g numeric DEFAULT 0,
    clothing_weight_g numeric DEFAULT 0,
    cooking_weight_g numeric DEFAULT 0,
    food_weight_g numeric DEFAULT 0,
    water_weight_g numeric DEFAULT 0,
    tools_weight_g numeric DEFAULT 0,
    electronics_weight_g numeric DEFAULT 0,
    first_aid_weight_g numeric DEFAULT 0,
    personal_weight_g numeric DEFAULT 0,
    
    -- Métadonnées de calcul
    calculation_method text DEFAULT 'manual', -- 'manual', 'auto', 'smart'
    items_count integer DEFAULT 0,
    is_optimized boolean DEFAULT false,
    optimization_score numeric DEFAULT 0,
    
    -- Configuration
    trip_type text, -- 'day_hike', 'overnight', 'multi_day', 'expedition'
    season text, -- 'summer', 'spring_fall', 'winter'
    temperature_min numeric,
    temperature_max numeric,
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Contraintes
    CHECK (total_weight_g >= 0),
    CHECK (shelter_weight_g >= 0),
    CHECK (sleep_weight_g >= 0),
    CHECK (clothing_weight_g >= 0),
    CHECK (cooking_weight_g >= 0),
    CHECK (food_weight_g >= 0),
    CHECK (water_weight_g >= 0),
    CHECK (tools_weight_g >= 0),
    CHECK (electronics_weight_g >= 0),
    CHECK (first_aid_weight_g >= 0),
    CHECK (personal_weight_g >= 0),
    CHECK (optimization_score BETWEEN 0 AND 100)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_weight_calculations_user_id ON public.weight_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_calculations_kit_id ON public.weight_calculations(kit_id);
CREATE INDEX IF NOT EXISTS idx_weight_calculations_calculated_at ON public.weight_calculations(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_weight_calculations_is_optimized ON public.weight_calculations(is_optimized);

-- ===========================================================================
-- 2. Table des optimisations de poids
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.weight_optimizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id uuid REFERENCES public.weight_calculations(id) ON DELETE CASCADE,
    
    -- Suggestions d'amélioration
    optimization_type text NOT NULL, -- 'replace_item', 'remove_item', 'share_item', 'better_item'
    category text NOT NULL,
    
    -- Informations sur l'item courant
    current_item_id uuid REFERENCES public.gear_items(id) ON DELETE SET NULL,
    current_item_name text,
    current_weight_g numeric NOT NULL,
    
    -- Suggestions
    suggested_item_id uuid REFERENCES public.gear_items(id) ON DELETE SET NULL,
    suggested_item_name text,
    suggested_weight_g numeric NOT NULL,
    
    -- Impact de l'optimisation
    weight_saving_g numeric GENERATED ALWAYS AS (current_weight_g - suggested_weight_g) STORED,
    weight_saving_percentage numeric GENERATED ALWAYS AS (
        CASE 
            WHEN current_weight_g > 0 THEN (current_weight_g - suggested_weight_g) / current_weight_g * 100
            ELSE 0
        END
    ) STORED,
    
    -- Coût et disponibilité
    cost_impact_eur numeric, -- Coût additionnel (positif) ou économie (négatif)
    availability text DEFAULT 'in_stock', -- 'in_stock', 'out_of_stock', 'custom'
    
    -- Priorité
    priority_level integer DEFAULT 3, -- 1 = haute, 2 = moyenne, 3 = basse
    estimated_time_saving_minutes integer, -- Temps estimé économisé
    
    -- Métadonnées
    reason text,
    source text DEFAULT 'algorithm', -- 'algorithm', 'community', 'expert'
    confidence_score numeric DEFAULT 80, -- Score de confiance 0-100
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    
    -- Contraintes
    CHECK (current_weight_g >= 0),
    CHECK (suggested_weight_g >= 0),
    CHECK (weight_saving_g >= 0),
    CHECK (priority_level BETWEEN 1 AND 5),
    CHECK (confidence_score BETWEEN 0 AND 100)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_weight_optimizations_calculation_id ON public.weight_optimizations(calculation_id);
CREATE INDEX IF NOT EXISTS idx_weight_optimizations_category ON public.weight_optimizations(category);
CREATE INDEX IF NOT EXISTS idx_weight_optimizations_priority_level ON public.weight_optimizations(priority_level);
CREATE INDEX IF NOT EXISTS idx_weight_optimizations_weight_saving_g ON public.weight_optimizations(weight_saving_g DESC);

-- ===========================================================================
-- 3. Table des profils de poids recommandés
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.weight_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuration du profil
    profile_name text NOT NULL UNIQUE,
    profile_type text NOT NULL, -- 'ultralight', 'lightweight', 'traditional', 'expedition'
    description text,
    
    -- Poids cibles par catégorie (en grammes)
    target_shelter_g numeric NOT NULL,
    target_sleep_g numeric NOT NULL,
    target_clothing_g numeric NOT NULL,
    target_cooking_g numeric NOT NULL,
    target_food_water_g numeric NOT NULL, -- Pour un jour
    target_tools_g numeric NOT NULL,
    target_electronics_g numeric NOT NULL,
    target_first_aid_g numeric NOT NULL,
    target_personal_g numeric NOT NULL,
    
    -- Poids totaux
    target_base_weight_g numeric GENERATED ALWAYS AS (
        target_shelter_g + target_sleep_g + target_clothing_g + 
        target_cooking_g + target_tools_g + target_electronics_g + 
        target_first_aid_g + target_personal_g
    ) STORED,
    
    -- Adaptation aux conditions
    max_trip_days integer DEFAULT 1,
    min_temperature_c numeric,
    max_temperature_c numeric,
    season_adaptation text, -- 'summer', 'three_season', 'winter'
    
    -- Recommandations
    experience_level text DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced', 'expert'
    physical_condition text DEFAULT 'average', -- 'poor', 'average', 'good', 'excellent'
    
    -- Métadonnées
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    source text DEFAULT 'system', -- 'system', 'community', 'expert_curated'
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Contraintes
    CHECK (target_shelter_g >= 0),
    CHECK (target_sleep_g >= 0),
    CHECK (target_clothing_g >= 0),
    CHECK (target_cooking_g >= 0),
    CHECK (target_food_water_g >= 0),
    CHECK (target_tools_g >= 0),
    CHECK (target_electronics_g >= 0),
    CHECK (target_first_aid_g >= 0),
    CHECK (target_personal_g >= 0),
    CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    CHECK (physical_condition IN ('poor', 'average', 'good', 'excellent'))
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_weight_profiles_profile_type ON public.weight_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_weight_profiles_is_active ON public.weight_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_weight_profiles_is_default ON public.weight_profiles(is_default);
CREATE INDEX IF NOT EXISTS idx_weight_profiles_target_base_weight_g ON public.weight_profiles(target_base_weight_g);

-- ===========================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ===========================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.weight_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes (pour récréation propre)
DROP POLICY IF EXISTS "users_crud_own_weight_calculations" ON public.weight_calculations;
DROP POLICY IF EXISTS "users_crud_own_weight_optimizations" ON public.weight_calculations;
DROP POLICY IF EXISTS "public_read_weight_profiles" ON public.weight_profiles;
DROP POLICY IF EXISTS "admins_manage_weight_profiles" ON public.weight_profiles;

-- Politiques pour weight_calculations
CREATE POLICY "users_crud_own_weight_calculations" ON public.weight_calculations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politiques pour weight_optimizations (liées aux calculs de l'utilisateur)
CREATE POLICY "users_read_own_weight_optimizations" ON public.weight_optimizations
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.weight_calculations wc 
        WHERE wc.id = weight_optimizations.calculation_id 
        AND wc.user_id = auth.uid()
    ));

-- Politiques pour weight_profiles (lecture publique, gestion admin)
CREATE POLICY "public_read_weight_profiles" ON public.weight_profiles
    FOR SELECT TO public
    USING (is_active = true);

CREATE POLICY "admins_manage_weight_profiles" ON public.weight_profiles
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    ));

-- ===========================================================================
-- 5. FONCTIONS UTILES
-- ===========================================================================

-- Fonction pour calculer le poids total d'un kit
CREATE OR REPLACE FUNCTION public.calculate_kit_total_weight(kit_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
DECLARE
    total_weight numeric := 0;
BEGIN
    -- Calculer la somme des poids de tous les items du kit
    SELECT COALESCE(SUM(gi.weight_g), 0)
    INTO total_weight
    FROM public.gear_items gi
    JOIN public.kit_items ki ON gi.id = ki.gear_item_id
    WHERE ki.kit_id = kit_id_param
      AND gi.weight_g IS NOT NULL;
    
    RETURN total_weight;
END;
\$\$;

-- Fonction pour générer des suggestions d'optimisation
CREATE OR REPLACE FUNCTION public.generate_weight_optimizations(
    calculation_id_param uuid,
    user_id_param uuid
)
RETURNS TABLE (
    optimization_type text,
    category text,
    current_item_name text,
    current_weight_g numeric,
    suggested_item_name text,
    suggested_weight_g numeric,
    weight_saving_g numeric,
    priority_level integer,
    reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
    -- Cette fonction analyse le calcul de poids et génère des suggestions
    -- Pour l'instant, retourne des résultats vides comme squelette
    -- L'implémentation complète serait ajoutée dans LOT 9
    RETURN QUERY
    SELECT 
        'placeholder'::text as optimization_type,
        'placeholder'::text as category,
        'placeholder'::text as current_item_name,
        0::numeric as current_weight_g,
        'placeholder'::text as suggested_item_name,
        0::numeric as suggested_weight_g,
        0::numeric as weight_saving_g,
        3::integer as priority_level,
        'Implementation pending in LOT 9'::text as reason
    WHERE false; -- Ne retourne rien pour l'instant
END;
\$\$;

-- Fonction pour obtenir le profil de poids recommandé
CREATE OR REPLACE FUNCTION public.get_recommended_weight_profile(
    user_experience text,
    trip_type text,
    season text,
    temperature_min numeric,
    temperature_max numeric
)
RETURNS SETOF public.weight_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.weight_profiles wp
    WHERE wp.is_active = true
      AND wp.experience_level = user_experience
      AND (wp.min_temperature_c IS NULL OR wp.min_temperature_c <= temperature_min)
      AND (wp.max_temperature_c IS NULL OR wp.max_temperature_c >= temperature_max)
      AND (wp.season_adaptation IS NULL OR wp.season_adaptation = season)
    ORDER BY 
        CASE 
            WHEN wp.is_default = true THEN 1
            ELSE 2
        END,
        wp.target_base_weight_g ASC
    LIMIT 1;
END;
\$\$;

-- ===========================================================================
-- 6. DONNÉES DE RÉFÉRENCE (Profils par défaut)
-- ===========================================================================

-- Insérer les profils de poids par défaut
INSERT INTO public.weight_profiles (
    profile_name,
    profile_type,
    description,
    target_shelter_g,
    target_sleep_g,
    target_clothing_g,
    target_cooking_g,
    target_food_water_g,
    target_tools_g,
    target_electronics_g,
    target_first_aid_g,
    target_personal_g,
    max_trip_days,
    min_temperature_c,
    max_temperature_c,
    season_adaptation,
    experience_level,
    physical_condition,
    is_default
) VALUES 
-- Profil Ultraléger (pour experts)
(
    'ultralight_expert',
    'ultralight',
    'Kit ultraléger pour experts - privilégie le poids minimal',
    500,   -- shelter
    800,   -- sleep  
    1000,  -- clothing
    400,   -- cooking
    1500,  -- food_water (par jour)
    200,   -- tools
    500,   -- electronics
    100,   -- first_aid
    300,   -- personal
    7,     -- max_trip_days
    -5,    -- min_temperature_c
    30,    -- max_temperature_c
    'three_season',
    'expert',
    'excellent',
    false
),
-- Profil Léger (pour randonneurs intermédiaires)
(
    'lightweight_standard',
    'lightweight',
    'Kit léger équilibré - confort et poids raisonnable',
    1500,  -- shelter
    1500,  -- sleep
    1500,  -- clothing
    800,   -- cooking
    2000,  -- food_water (par jour)
    400,   -- tools
    800,   -- electronics
    200,   -- first_aid
    500,   -- personal
    5,     -- max_trip_days
    -10,   -- min_temperature_c
    25,    -- max_temperature_c
    'three_season',
    'intermediate',
    'good',
    true   -- Profil par défaut
),
-- Profil Traditionnel (pour débutants)
(
    'traditional_beginner',
    'traditional',
    'Kit traditionnel complet - privilégie le confort et la sécurité',
    2500,  -- shelter
    2500,  -- sleep
    2000,  -- clothing
    1200,  -- cooking
    2500,  -- food_water (par jour)
    600,   -- tools
    1000,  -- electronics
    300,   -- first_aid
    800,   -- personal
    3,     -- max_trip_days
    -15,   -- min_temperature_c
    20,    -- max_temperature_c
    'three_season',
    'beginner',
    'average',
    false
),
-- Profil Expédition (conditions extrêmes)
(
    'expedition_extreme',
    'expedition',
    'Kit d''expédition - pour conditions extrêmes et autonomie longue',
    3500,  -- shelter
    3000,  -- sleep
    3000,  -- clothing
    1500,  -- cooking
    3000,  -- food_water (par jour)
    800,   -- tools
    1200,  -- electronics
    500,   -- first_aid
    1000,  -- personal
    14,    -- max_trip_days
    -30,   -- min_temperature_c
    15,    -- max_temperature_c
    'winter',
    'advanced',
    'excellent',
    false
)
ON CONFLICT (profile_name) DO NOTHING;

-- ===========================================================================
-- 7. TRIGGERS POUR LA MAINTENANCE
-- ===========================================================================

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Appliquer le trigger à weight_calculations
DROP TRIGGER IF EXISTS update_weight_calculations_updated_at ON public.weight_calculations;
CREATE TRIGGER update_weight_calculations_updated_at
    BEFORE UPDATE ON public.weight_calculations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Appliquer le trigger à weight_profiles
DROP TRIGGER IF EXISTS update_weight_profiles_updated_at ON public.weight_profiles;
CREATE TRIGGER update_weight_profiles_updated_at
    BEFORE UPDATE ON public.weight_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 8. COMMENTAIRES POUR LA DOCUMENTATION
-- ===========================================================================

COMMENT ON TABLE public.weight_calculations IS 'Calculs de poids des kits de randonnée';
COMMENT ON TABLE public.weight_optimizations IS 'Suggestions d''optimisation de poids';
COMMENT ON TABLE public.weight_profiles IS 'Profils de poids recommandés par type de randonnée';

COMMIT;

-- ===========================================================================
-- LOT 7: Calculs poids & optimisation - COMPLÉTÉ
-- ===========================================================================
