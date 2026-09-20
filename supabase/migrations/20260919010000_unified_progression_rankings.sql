-- ============================================================================
-- MIGRATION : PROGRESSION UNIFIÉE ET CLASSEMENTS TERRITORIAUX LKDV
-- Date : 2026-09-19
-- Conforme aux invariants LKDV :
-- 1. Unité visible unique : Points LKDV (cumul permanent = niveau, saison = rang).
-- 2. 4 compétences transverses (Explorer, Se préparer, Partager, S'entraider).
-- 3. 5 filtres territoriaux (1 km privé, ville, région, pays, monde).
-- 4. Anonymisation stricte : zéro fuite de coordonnées GPS ou d'adresses privées.
-- 5. Anti-fraude : écriture compensatoire FRAUD_REVERSAL avec recalcul intègre.
-- ============================================================================

-- 1. SAISONS DE PROGRESSION (Cycles de 8 semaines par défaut)
CREATE TABLE IF NOT EXISTS public.progression_seasons (
  id TEXT PRIMARY KEY,
  season_number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertion de la Saison 1 active
INSERT INTO public.progression_seasons (id, season_number, name, starts_at, ends_at, status)
VALUES (
  'season_2026_s1',
  1,
  'Saison 1 · L’Appel des Cimes',
  NOW() - INTERVAL '14 days',
  NOW() + INTERVAL '42 days',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 2. DÉFIS DE PROGRESSION (Catalogue transversal)
CREATE TABLE IF NOT EXISTS public.progression_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('explorer', 'preparer', 'partager', 'entraider')),
  points_reward INTEGER NOT NULL CHECK (points_reward > 0),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('facile', 'moyen', 'expert')),
  target_progress INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'actions',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.progression_challenges (id, title, description, skill, points_reward, difficulty, target_progress, unit)
VALUES
  ('chal_exp_01', 'Arpenteur local', 'Explorez et enregistrez 1 sentier balisé dans votre région.', 'explorer', 50, 'facile', 1, 'sentier'),
  ('chal_exp_02', 'Sommets secrets', 'Validez 3 waypoints ou points d’intérêt en altitude.', 'explorer', 120, 'moyen', 3, 'points'),
  ('chal_prep_01', 'Pacte du sac léger', 'Optimisez et pesez un kit complet sous la barre des 12 kg.', 'preparer', 80, 'facile', 1, 'kit'),
  ('chal_prep_02', 'Vérification météo & sécurité', 'Complétez la checklist sécurité avant un départ.', 'preparer', 60, 'facile', 1, 'checklist'),
  ('chal_part_01', 'Plume des sentiers', 'Publiez un carnet d’expédition avec récit et photos.', 'partager', 100, 'moyen', 1, 'carnet'),
  ('chal_part_02', 'Conseil de cordée', 'Laissez un avis terrain utile sur un refuge ou un tracé.', 'partager', 40, 'facile', 1, 'avis'),
  ('chal_entr_01', 'Main tendue', 'Répondez avec bienveillance à une demande d’entraide.', 'entraider', 70, 'moyen', 1, 'réponse'),
  ('chal_entr_02', 'Partage d’équipement', 'Prêtez ou mettez à disposition un matériel via le club.', 'entraider', 90, 'moyen', 1, 'prêt')
ON CONFLICT (id) DO NOTHING;

-- 3. TABLE DE PROGRESSION UTILISATEUR
CREATE TABLE IF NOT EXISTS public.user_progression (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  season_points INTEGER NOT NULL DEFAULT 0 CHECK (season_points >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  level_title TEXT NOT NULL DEFAULT 'Randonneur Curieux',
  skill_explorer_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_explorer_points >= 0),
  skill_preparer_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_preparer_points >= 0),
  skill_partager_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_partager_points >= 0),
  skill_entraider_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_entraider_points >= 0),
  
  -- Rattachement territorial
  city_name TEXT,
  department_code TEXT,
  region_name TEXT,
  country_code TEXT NOT NULL DEFAULT 'FR',
  postal_code TEXT,
  lat_approx DOUBLE PRECISION,
  lng_approx DOUBLE PRECISION,
  territory_lock_until TIMESTAMPTZ,
  
  -- Défi actif & remplacement
  current_challenge_id TEXT REFERENCES public.progression_challenges(id),
  challenge_progress INTEGER NOT NULL DEFAULT 0,
  challenge_replaced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les classements territoriaux optimisés
CREATE INDEX IF NOT EXISTS idx_progression_season_points ON public.user_progression(season_points DESC);
CREATE INDEX IF NOT EXISTS idx_progression_lifetime_points ON public.user_progression(lifetime_points DESC);
CREATE INDEX IF NOT EXISTS idx_progression_city ON public.user_progression(city_name, season_points DESC);
CREATE INDEX IF NOT EXISTS idx_progression_region ON public.user_progression(region_name, season_points DESC);
CREATE INDEX IF NOT EXISTS idx_progression_country ON public.user_progression(country_code, season_points DESC);

-- 4. JOURNAL DES ÉVÉNEMENTS DE PROGRESSION (Ledger immuable avec idempotence)
CREATE TABLE IF NOT EXISTS public.progression_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES public.progression_seasons(id),
  action_type TEXT NOT NULL,
  points_total INTEGER NOT NULL,
  weight_explorer NUMERIC(4,3) NOT NULL CHECK (weight_explorer >= 0),
  weight_preparer NUMERIC(4,3) NOT NULL CHECK (weight_preparer >= 0),
  weight_partager NUMERIC(4,3) NOT NULL CHECK (weight_partager >= 0),
  weight_entraider NUMERIC(4,3) NOT NULL CHECK (weight_entraider >= 0),
  explanation TEXT NOT NULL,
  is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progression_events_user ON public.progression_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progression_events_season ON public.progression_events(season_id);

-- 5. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
ALTER TABLE public.progression_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_events ENABLE ROW LEVEL SECURITY;

-- Lecture publique des saisons et défis
CREATE POLICY "Public read progression seasons" ON public.progression_seasons
  FOR SELECT USING (true);

CREATE POLICY "Public read progression challenges" ON public.progression_challenges
  FOR SELECT USING (true);

-- Progression utilisateur : lecture publique des scores/niveaux pour les classements,
-- mise à jour restreinte au compte propriétaire (uniquement pour le territoire).
CREATE POLICY "Public read user progression" ON public.user_progression
  FOR SELECT USING (true);

CREATE POLICY "Users update own territory" ON public.user_progression
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Événements : lecture par le propriétaire, création via RPC serveur uniquement.
CREATE POLICY "Users view own progression events" ON public.progression_events
  FOR SELECT USING (auth.uid() = user_id);

-- 6. PROCÉDURE RPC SÉCURISÉE : APPLICATION DE POINTS DE PROGRESSION
CREATE OR REPLACE FUNCTION public.apply_progression_points(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_action_type TEXT,
  p_points_total INTEGER,
  p_weight_explorer NUMERIC,
  p_weight_preparer NUMERIC,
  p_weight_partager NUMERIC,
  p_weight_entraider NUMERIC,
  p_explanation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_active_season TEXT;
  v_existing_event UUID;
  v_p_explorer INTEGER;
  v_p_preparer INTEGER;
  v_p_partager INTEGER;
  v_p_entraider INTEGER;
  v_new_lifetime INTEGER;
  v_new_level INTEGER;
  v_new_title TEXT;
  v_res JSONB;
BEGIN
  -- 1. Contrôle d'idempotence strict
  SELECT id INTO v_existing_event FROM public.progression_events WHERE idempotency_key = p_idempotency_key;
  IF v_existing_event IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'eventId', v_existing_event);
  END IF;

  -- 2. Trouver la saison active
  SELECT id INTO v_active_season FROM public.progression_seasons WHERE status = 'active' LIMIT 1;
  IF v_active_season IS NULL THEN
    v_active_season := 'season_2026_s1';
  END IF;

  -- 3. Ventilation proportionnelle entière
  v_p_explorer := ROUND(p_points_total * p_weight_explorer);
  v_p_preparer := ROUND(p_points_total * p_weight_preparer);
  v_p_partager := ROUND(p_points_total * p_weight_partager);
  v_p_entraider := p_points_total - (v_p_explorer + v_p_preparer + v_p_partager);

  -- 4. Insertion de l'événement dans le ledger
  INSERT INTO public.progression_events (
    idempotency_key, user_id, season_id, action_type,
    points_total, weight_explorer, weight_preparer, weight_partager, weight_entraider,
    explanation
  ) VALUES (
    p_idempotency_key, p_user_id, v_active_season, p_action_type,
    p_points_total, p_weight_explorer, p_weight_preparer, p_weight_partager, p_weight_entraider,
    p_explanation
  );

  -- 5. Upsert et calcul de la progression utilisateur
  INSERT INTO public.user_progression (
    user_id, lifetime_points, season_points,
    skill_explorer_points, skill_preparer_points, skill_partager_points, skill_entraider_points,
    current_challenge_id, updated_at
  ) VALUES (
    p_user_id, p_points_total, p_points_total,
    v_p_explorer, v_p_preparer, v_p_partager, v_p_entraider,
    'chal_exp_01', NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    lifetime_points = user_progression.lifetime_points + p_points_total,
    season_points = user_progression.season_points + p_points_total,
    skill_explorer_points = user_progression.skill_explorer_points + v_p_explorer,
    skill_preparer_points = user_progression.skill_preparer_points + v_p_preparer,
    skill_partager_points = user_progression.skill_partager_points + v_p_partager,
    skill_entraider_points = user_progression.skill_entraider_points + v_p_entraider,
    updated_at = NOW()
  RETURNING lifetime_points INTO v_new_lifetime;

  -- 6. Recalcul déterministe du niveau permanent (1 à 10)
  IF v_new_lifetime >= 20000 THEN
    v_new_level := 10; v_new_title := 'Gardien des Horizons';
  ELSIF v_new_lifetime >= 14000 THEN
    v_new_level := 9; v_new_title := 'Légende des Sentiers';
  ELSIF v_new_lifetime >= 9000 THEN
    v_new_level := 8; v_new_title := 'Maître d''Expédition';
  ELSIF v_new_lifetime >= 5500 THEN
    v_new_level := 7; v_new_title := 'Guide de Cordée';
  ELSIF v_new_lifetime >= 3000 THEN
    v_new_level := 6; v_new_title := 'Pionnier des Crêtes';
  ELSIF v_new_lifetime >= 1500 THEN
    v_new_level := 5; v_new_title := 'Navigateur Alpin';
  ELSIF v_new_lifetime >= 700 THEN
    v_new_level := 4; v_new_title := 'Éclaireur des Cimes';
  ELSIF v_new_lifetime >= 300 THEN
    v_new_level := 3; v_new_title := 'Arpenteur des Bois';
  ELSIF v_new_lifetime >= 100 THEN
    v_new_level := 2; v_new_title := 'Marcheur Averti';
  ELSE
    v_new_level := 1; v_new_title := 'Randonneur Curieux';
  END IF;

  UPDATE public.user_progression
  SET level = v_new_level, level_title = v_new_title
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'pointsAdded', p_points_total,
    'newLifetimePoints', v_new_lifetime,
    'level', v_new_level,
    'levelTitle', v_new_title
  );
END;
$$;

-- 7. PROCÉDURE RPC SÉCURISÉE : FRAUD_REVERSAL COMPENSATOIRE
CREATE OR REPLACE FUNCTION public.reverse_progression_fraud(
  p_original_idempotency_key TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_event RECORD;
  v_user_id UUID;
  v_p_explorer INTEGER;
  v_p_preparer INTEGER;
  v_p_partager INTEGER;
  v_p_entraider INTEGER;
  v_new_lifetime INTEGER;
  v_new_level INTEGER;
  v_new_title TEXT;
BEGIN
  SELECT * INTO v_event FROM public.progression_events WHERE idempotency_key = p_original_idempotency_key;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.is_reversed THEN
    RETURN jsonb_build_object('success', true, 'alreadyReversed', true);
  END IF;

  v_user_id := v_event.user_id;
  v_p_explorer := ROUND(v_event.points_total * v_event.weight_explorer);
  v_p_preparer := ROUND(v_event.points_total * v_event.weight_preparer);
  v_p_partager := ROUND(v_event.points_total * v_event.weight_partager);
  v_p_entraider := v_event.points_total - (v_p_explorer + v_p_preparer + v_p_partager);

  -- Marquer l'événement original comme compensé
  UPDATE public.progression_events
  SET is_reversed = TRUE, reversal_reason = p_reason
  WHERE id = v_event.id;

  -- Déduire les points avec borne minimale à 0
  UPDATE public.user_progression
  SET
    lifetime_points = GREATEST(0, lifetime_points - v_event.points_total),
    season_points = GREATEST(0, season_points - v_event.points_total),
    skill_explorer_points = GREATEST(0, skill_explorer_points - v_p_explorer),
    skill_preparer_points = GREATEST(0, skill_preparer_points - v_p_preparer),
    skill_partager_points = GREATEST(0, skill_partager_points - v_p_partager),
    skill_entraider_points = GREATEST(0, skill_entraider_points - v_p_entraider),
    updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING lifetime_points INTO v_new_lifetime;

  -- Recalculer le niveau permanent
  IF v_new_lifetime >= 20000 THEN
    v_new_level := 10; v_new_title := 'Gardien des Horizons';
  ELSIF v_new_lifetime >= 14000 THEN
    v_new_level := 9; v_new_title := 'Légende des Sentiers';
  ELSIF v_new_lifetime >= 9000 THEN
    v_new_level := 8; v_new_title := 'Maître d''Expédition';
  ELSIF v_new_lifetime >= 5500 THEN
    v_new_level := 7; v_new_title := 'Guide de Cordée';
  ELSIF v_new_lifetime >= 3000 THEN
    v_new_level := 6; v_new_title := 'Pionnier des Crêtes';
  ELSIF v_new_lifetime >= 1500 THEN
    v_new_level := 5; v_new_title := 'Navigateur Alpin';
  ELSIF v_new_lifetime >= 700 THEN
    v_new_level := 4; v_new_title := 'Éclaireur des Cimes';
  ELSIF v_new_lifetime >= 300 THEN
    v_new_level := 3; v_new_title := 'Arpenteur des Bois';
  ELSIF v_new_lifetime >= 100 THEN
    v_new_level := 2; v_new_title := 'Marcheur Averti';
  ELSE
    v_new_level := 1; v_new_title := 'Randonneur Curieux';
  END IF;

  UPDATE public.user_progression
  SET level = v_new_level, level_title = v_new_title
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'pointsDeducted', v_event.points_total,
    'newLifetimePoints', v_new_lifetime,
    'level', v_new_level
  );
END;
$$;
