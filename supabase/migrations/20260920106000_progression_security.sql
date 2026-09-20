-- ============================================================================
-- P1 — Sécurité de la progression : plus d'écriture cliente, plus de lecture
-- publique des scores, fonctions legacy supprimées, territoire privé cloisonné.
-- ============================================================================

-- Lecture/écriture clientes retirées : tout passe par des routes serveur contrôlées.
DROP POLICY IF EXISTS "Public read user progression" ON public.user_progression;
DROP POLICY IF EXISTS "Users update own territory" ON public.user_progression;
REVOKE ALL ON TABLE public.user_progression, public.progression_events, public.progression_decisions FROM anon, authenticated;

-- Fonctions du moteur parallèle de la branche : révoquées puis supprimées.
-- Gardé : une remigration après rollback peut les avoir déjà retirées.
DO $$
BEGIN
  IF to_regprocedure('public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.reverse_progression_fraud(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.reverse_progression_fraud(text,text) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text);
DROP FUNCTION IF EXISTS public.reverse_progression_fraud(text,text);

-- Territoire déclaré (identifiants stables) et rattachement privé (consentement + verrou).
CREATE TABLE IF NOT EXISTS public.user_territory (
  user_id UUID PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'FR',
  city_code TEXT,
  region_code TEXT,
  city_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','geocoded')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_territory_private (
  user_id UUID PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m INTEGER,
  consent_at TIMESTAMPTZ NOT NULL,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_territory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_territory_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_territory, public.user_territory_private FROM anon, authenticated;
DROP POLICY IF EXISTS "Users read own territory" ON public.user_territory;
CREATE POLICY "Users read own territory" ON public.user_territory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
