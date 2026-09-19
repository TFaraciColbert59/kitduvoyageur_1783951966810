-- ============================================================================
-- P1 — Règles versionnées, décisions journalisées, niveau canonique.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_rules (
  version TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_progression_rules_active ON public.progression_rules ((active)) WHERE active;
ALTER TABLE public.progression_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_rules FROM anon, authenticated;

INSERT INTO public.progression_rules (version, active, payload) VALUES ('v1', true, jsonb_build_object(
  'levels', jsonb_build_array(
    jsonb_build_object('level',1,'min_points',0,'title','Randonneur Curieux'),
    jsonb_build_object('level',2,'min_points',100,'title','Marcheur Averti'),
    jsonb_build_object('level',3,'min_points',300,'title','Arpenteur des Bois'),
    jsonb_build_object('level',4,'min_points',700,'title','Éclaireur des Cimes'),
    jsonb_build_object('level',5,'min_points',1500,'title','Navigateur Alpin'),
    jsonb_build_object('level',6,'min_points',3000,'title','Pionnier des Crêtes'),
    jsonb_build_object('level',7,'min_points',5500,'title','Guide de Cordée'),
    jsonb_build_object('level',8,'min_points',9000,'title','Maître d''Expédition'),
    jsonb_build_object('level',9,'min_points',14000,'title','Légende des Sentiers'),
    jsonb_build_object('level',10,'min_points',20000,'title','Gardien des Horizons')),
  'grace_days', 14,
  'late_policy', 'refuse',
  'min_participants', 5,
  'season_duration_weeks', 8,
  'actions', '{}'::jsonb
)) ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.progression_decisions (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('awarded','awarded_lifetime_only','refused','duplicate')),
  reason TEXT,
  reward_transaction_id UUID,
  rules_version TEXT NOT NULL,
  effective_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.progression_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_decisions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.progression_level_for(p_points INTEGER)
RETURNS TABLE(level INT, level_title TEXT)
LANGUAGE sql STABLE AS $$
  SELECT t.level::int, t.title
  FROM public.progression_rules r,
       jsonb_to_recordset(r.payload->'levels') AS t(level int, min_points int, title text)
  WHERE r.active AND p_points >= t.min_points
  ORDER BY t.min_points DESC LIMIT 1;
$$;
