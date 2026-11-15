-- ============================================================================
-- A05 · S2.19 — objectifs personnels chiffrés, privés et récurrents.
--
-- Pourquoi une migration :
--   `progression_user_preferences` ne porte qu'un rythme hebdomadaire global ;
--   elle ne peut pas représenter un objectif par sport, par mois ou par année,
--   ni une cible chiffrée. Aucun autre contrat existant ne le permet.
--
-- Portée strictement additive :
--   • une table privée `progression_goals` (aucune table existante modifiée) ;
--   • RLS propriétaire en lecture et en écriture, aucune policy publique ;
--   • aucun XP, aucune série, aucune distinction : la table ne touche ni
--     `reward_transactions`, ni `progression_decisions`, ni les classements.
--
-- Les objectifs sont récurrents : la ligne décrit la période (semaine, mois,
-- année) et la progression est recalculée à la lecture sur la période civile
-- courante, dans le fuseau du profil. Aucune date de début n'est stockée, donc
-- aucun objectif ne « périme » silencieusement au changement de semaine.
--
-- La puissance et les segments ne sont pas des grandeurs de cette table :
-- aucune mesure de puissance n'est collectée, et les passages de segment ne
-- sont pas exposés au bootstrap du Compte. Voir
-- `docs/compte/A05-S2.19-OBJECTIFS.md`.
-- ============================================================================

begin;

CREATE TABLE IF NOT EXISTS public.progression_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('week', 'month', 'year')),
  -- NULL = tous les sports. Un identifiant de sport reste une donnée de
  -- taxonomie, jamais un libellé affiché.
  sport text,
  metric text NOT NULL CHECK (
    metric IN ('distance_km', 'duration_s', 'elevation_gain_m', 'sessions')
  ),
  -- Unité canonique : km, secondes, mètres ou nombre de séances.
  target numeric NOT NULL CHECK (target > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progression_goals_sport_format CHECK (
    sport IS NULL
    OR (sport = btrim(sport) AND char_length(sport) BETWEEN 1 AND 64)
  )
);

COMMENT ON TABLE public.progression_goals IS
  'A05/S2.19 — objectifs privés récurrents par semaine, mois ou année, avec '
  'sport facultatif. Aucun crédit, aucune série, aucune exposition publique.';
COMMENT ON COLUMN public.progression_goals.sport IS
  'Identifiant de sport (explorer_sport_map) ou NULL pour tous les sports.';
COMMENT ON COLUMN public.progression_goals.metric IS
  'Grandeur réellement enregistrée : distance_km, duration_s, elevation_gain_m '
  'ou sessions. La puissance et les segments ne sont pas collectés.';
COMMENT ON COLUMN public.progression_goals.target IS
  'Cible canonique : km, secondes, mètres ou nombre de séances.';

-- Un seul objectif par personne, période, grandeur et sport. `coalesce` rend
-- « tous sports » unique aussi, ce qu'une contrainte UNIQUE classique ne ferait
-- pas avec NULL.
CREATE UNIQUE INDEX IF NOT EXISTS progression_goals_owner_period_metric_sport_idx
  ON public.progression_goals (
    user_id,
    period,
    metric,
    (COALESCE(sport, ''))
  );

CREATE INDEX IF NOT EXISTS progression_goals_owner_idx
  ON public.progression_goals (user_id, period, created_at);

DROP TRIGGER IF EXISTS trg_progression_goals_updated_at ON public.progression_goals;
CREATE TRIGGER trg_progression_goals_updated_at
  BEFORE UPDATE ON public.progression_goals
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

ALTER TABLE public.progression_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_goals FORCE ROW LEVEL SECURITY;

-- Aucun droit anonyme. L'écriture reste bornée au propriétaire par la policy.
REVOKE ALL ON TABLE public.progression_goals FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS progression_goals_owner_all ON public.progression_goals;
CREATE POLICY progression_goals_owner_all
  ON public.progression_goals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.progression_goals TO authenticated;
GRANT ALL ON TABLE public.progression_goals TO service_role;

commit;
