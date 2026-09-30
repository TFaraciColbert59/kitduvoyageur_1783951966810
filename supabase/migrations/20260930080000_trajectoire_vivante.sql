-- ============================================================================
-- LA TRAJECTOIRE VIVANTE — PERSISTANCE DES INSTANTS D'ECHELLE
-- Migration: 20260930080000_trajectoire_vivante.sql
--
-- Le moteur (src/features/trajectoire/domain) est 100 % pur : meme entree,
-- meme sortie, aucun acces reseau. Cette migration ne stocke donc QUE ce que
-- le moteur ne peut pas recomputer seul : l'intention que l'utilisateur a
-- formulee, et l'instant d'echelle ou il s'est arrete.
--
-- Trois garanties non negociables :
--
--  1. AUCUNE DONNEE INVENTEE. Aucune colonne ne porte le budget, la
--     dangerousite, la fenetre meteo ou les etapes : tout cela se recalcule
--     depuis `sources_hash` + `t`. Si le moteur change, le snapshot suit.
--     La table ne memorise donc que l'ENTREE et l'ETAT DE VERSIONNAGE.
--  2. VERSIONNAGE EXPLICITE. `plan_version` + `sources_hash` permettent de
--     detecter qu'un snapshot est perime (le catalogue de traces ou les
--     sources ont change) et de le re-grainner sans jamais perdre une etape.
--  3. RLS STRICTE. Une trajectoire appartient a son auteur ET, optionnellement,
--     a un voyage. Personne d'autre ne la lit ni ne l'ecrit, pas meme via un
--     client anonyme.
--
-- Idempotent : CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT,
-- comme les migrations precedentes du depot. `set_updated_at()` existe deja
-- (20260811000000_geodata_phase2_schema.sql) : on le reutilise, on ne le
-- redefinit pas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.trajectoire_zone AS ENUM ('run', 'journee', 'raid', 'expedition', 'monde');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.trajectoire_grain AS ENUM ('boucle', 'demi-journee', 'jour', 'journee', 'pays');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- TABLE : un instant d'echelle enregistre par l'utilisateur.
--
-- `t` est la position sur l'axe logarithmique 1 h -> 720 h. On la stocke en
-- `double precision` (et non en heures) parce que c'est la seule quantite qui
-- survit au re-grainage : les heures en sont une fonction pure.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trajectoire_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Voyage rattache, facultatif : une trajectoire existe aussi sans voyage.
  trip_id         uuid REFERENCES public.trips (id) ON DELETE CASCADE,

  -- Entree brute telle que l'utilisateur l'a formulee (jamais reecrite).
  intention_raw   text NOT NULL,

  -- Destination et contraintes resolues par le moteur deterministe.
  destination_id  text NOT NULL,
  constraints     jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- L'INSTANT : position sur l'axe + lecture derivee correspondante.
  -- `hours` est un cache de confort ; `t` fait foi.
  t               double precision NOT NULL,
  hours           integer NOT NULL,
  zone            public.trajectoire_zone,
  grain           public.trajectoire_grain,

  -- VERSIONNAGE : permet de savoir si le snapshot est encore valide.
  plan_version    integer NOT NULL DEFAULT 1,
  sources_hash    text NOT NULL,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- L'axe est logarithmique sur [0, 1] : hors bornes, pas de zone, pas de grain.
  CONSTRAINT trajectoire_snapshots_t_range_chk
    CHECK (t >= 0 AND t <= 1),
  -- `zone` et `grain` sont denormalises pour lire une ligne sans JOIN.
  -- La coherence des deux est un invariant du domaine TypeScript, pas du
  -- schema : la base ne peut pas le garantir seule sans trigger.
  CONSTRAINT trajectoire_snapshots_hours_range_chk
    CHECK (hours >= 1 AND hours <= 720),
  CONSTRAINT trajectoire_snapshots_version_chk
    CHECK (plan_version >= 1),
  CONSTRAINT trajectoire_snapshots_constraints_array_chk
    CHECK (jsonb_typeof(constraints) = 'array')
);

-- `set_updated_at()` existe deja en base : on le branche, on ne le recree pas.
DROP TRIGGER IF EXISTS trg_trajectoire_snapshots_updated_at ON public.trajectoire_snapshots;
CREATE TRIGGER trg_trajectoire_snapshots_updated_at
  BEFORE UPDATE ON public.trajectoire_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recherche du dernier instant d'echelle d'un utilisateur (reprise de session).
CREATE INDEX IF NOT EXISTS trajectoire_snapshots_user_recent_idx
  ON public.trajectoire_snapshots (user_id, updated_at DESC);

-- Recherche par voyage rattache.
CREATE INDEX IF NOT EXISTS trajectoire_snapshots_trip_idx
  ON public.trajectoire_snapshots (trip_id)
  WHERE trip_id IS NOT NULL;

-- Detection de peremption : meme destination, hash de sources different.
CREATE INDEX IF NOT EXISTS trajectoire_snapshots_staleness_idx
  ON public.trajectoire_snapshots (user_id, sources_hash);

-- ---------------------------------------------------------------------------
-- RLS : l'auteur seul, en lecture comme en ecriture.
--
-- Pas de visibility publique ici (contrairement a `trips`) : une trajectoire
-- contient une intention de voyage encore en construction, pas un contenu
-- publie. Le partage passe par le voyage, qui a deja ses propres policies.
-- ---------------------------------------------------------------------------
ALTER TABLE public.trajectoire_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trajectoire_snapshots_select_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_select_own" ON public.trajectoire_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_snapshots_insert_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_insert_own" ON public.trajectoire_snapshots
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_snapshots_update_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_update_own" ON public.trajectoire_snapshots
  FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_snapshots_delete_own" ON public.trajectoire_snapshots;
CREATE POLICY "trajectoire_snapshots_delete_own" ON public.trajectoire_snapshots
  FOR DELETE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- FONCTION : dernier instant connu, pour reprendre ou l'utilisateur s'est arrete.
--
-- SECURITY DEFINER + `search_path` fige : la fonction est appelable par le
-- client, mais elle ne fait que ramener les lignes deja filtrees par RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_latest_trajectoire(p_trip_id uuid DEFAULT NULL)
RETURNS TABLE (
  id              uuid,
  intention_raw   text,
  destination_id  text,
  t               double precision,
  hours           integer,
  zone            public.trajectoire_zone,
  grain           public.trajectoire_grain,
  plan_version    integer,
  sources_hash    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- On renvoie `sources_hash` TEL QUE STOCKE, sans calculer la peremption ici.
  -- Le hash est un FNV-1a produit par le domaine TypeScript (`hashSources`,
  -- src/features/trajectoire/domain/versioning.ts) : le comparer a un SHA-256
  -- calcule par Postgres donnerait deux chaines differentes a chaque fois,
  -- donc « perime » en permanence. La comparaison se fait donc cote client,
  -- qui possede le meme FNV-1a, puis il regraine via `regrainSteps`.
  SELECT
    s.id,
    s.intention_raw,
    s.destination_id,
    s.t,
    s.hours,
    s.zone,
    s.grain,
    s.plan_version,
    s.sources_hash
  FROM public.trajectoire_snapshots s
  WHERE s.user_id = auth.uid()
    AND (p_trip_id IS NULL OR s.trip_id = p_trip_id)
  ORDER BY s.updated_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_latest_trajectoire(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_latest_trajectoire(uuid) TO authenticated;