-- ==============================================================================
-- A10 (10.10) — Shadow runners : table de comparaison V1/V2
--
-- Audit 31bdb279 item #17 : les flags `*_shadow` et `compareShadow` existaient
-- sans job d'exécution ni persistance des comparaisons.
--
-- `adventure_shadow_runs` journalise chaque comparaison silencieuse :
-- version primaire, version shadow, valeurs, delta, accord, confiance, latence
-- et décision (jamais de promotion automatique : `pending` par défaut).
-- Terrain auto : sorties `detectAutoCandidates` journalisées `kind='terrain_auto'`
-- et jamais publiées (ADR-AI-008).
--
-- RLS service_role uniquement ; anon/authenticated explicitement révoqués.
-- Migration additive et idempotente.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.adventure_shadow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN ('profile', 'route_prediction', 'collective', 'terrain_auto')),
  primary_version text NOT NULL,
  shadow_version text NOT NULL,
  primary_value jsonb,
  shadow_value jsonb,
  delta_pct numeric,
  agreement boolean NOT NULL DEFAULT false,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  decision text NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'keep', 'promote', 'reject')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.adventure_shadow_runs IS
  'A10 — comparaisons shadow V1/V2 (profil, prédiction de route, collectif, '
  'terrain auto). Journal de décision uniquement : aucune promotion automatique, '
  'aucune exposition publique. service_role uniquement.';

CREATE INDEX IF NOT EXISTS idx_adventure_shadow_runs_kind_created
  ON public.adventure_shadow_runs(kind, created_at DESC);

ALTER TABLE public.adventure_shadow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adventure_shadow_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_shadow_runs_all_service" ON public.adventure_shadow_runs;
CREATE POLICY "adventure_shadow_runs_all_service"
  ON public.adventure_shadow_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.adventure_shadow_runs FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.adventure_shadow_runs FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.adventure_shadow_runs FROM authenticated;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.adventure_shadow_runs TO service_role;
