-- ============================================================================
-- LA TRAJECTOIRE VIVANTE — PLANS VERSIONNES, TRACES ET VEILLE
-- Migration: 20260930080001_trajectoire_plans_traces_veille.sql
--
-- Suite directe de 20260930080000_trajectoire_vivante.sql, qui ne portait que
-- l'instant d'echelle (`trajectoire_snapshots`). Le dossier d'architecture
-- (section 4) en nomme quatre ; il manquait les trois dernieres. Elles
-- vivent ici pour que le premier fichier reste lisible comme le socle.
--
-- Ce que ces tables ETABLISSENT, et pourquoi c'est le coeur du chantier :
--
--  1. IMMUTABILITE. `trajectoire_plans` n'a ni UPDATE ni DELETE autorise.
--     Un plan est ecrit une fois ; le corriger, c'est ecrire la version
--     suivante. C'est la seule facon de pouvoir dire « cette ligne vient
--     d'ici » six mois plus tard.
--  2. PREUVE. `sources_hash` est le FNV-1a du domaine TypeScript
--     (`hashSources`, src/features/trajectoire/domain/versioning.ts). Postgres
--     ne le RECALCULE JAMAIS : `pgcrypto` n'est pas active dans ce depot, et
--     un SHA-256 local serait une chaine differente a chaque fois, donc
--     « perime » en permanence. La comparaison se fait cote client, qui
--     possede le meme FNV-1a, puis le regrain passe par `regrainSteps`.
--  3. LIEN AVEC LES TRACES VECUES. `trajectoire_trace_refs` dit quel plan a
--     ete construit a partir de quelles traces, avec quel score d'adequation
--     d'echelle. C'est le carburant (V4) rendu auditable.
--  4. VEILLE SANS NOTIFICATION INVENTEE. `trajectoire_veille` stocke des
--     REGLES, pas des alertes. L'alerte elle-meme passe par le canal VAPID
--     deja configure (`push_subscriptions`, 20260816004000) ; cette table ne
--     fait que dire quelle regle a declenche quoi.
--
-- Aucune donnee de sante, conformement au contrat phase 1.
-- Idempotent : IF NOT EXISTS / DROP POLICY IF EXISTS, comme les migrations
-- precedentes. `set_updated_at()` existe deja (20260811000000_geodata_phase2_schema.sql)
-- : on le branche, on ne le redefinit pas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUM : la granularite du regrain
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.trajectoire_ref_kind AS ENUM ('trace_tribu', 'randonnee_perso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- TABLE : versions immuables du plan vivant.
--
-- `engine_version` permet de dire « ce plan vient du moteur 1.0.0 » meme si le
-- moteur a evolue depuis : on ne rejoue jamais un ancien plan avec les regles
-- d'aujourd'hui, on le conserve tel qu'il a ete calcule.
--
-- `narration` est stockee SEPAREMENT du plan et marquee par `narration_origin`.
-- C'est le seul champ produit par un modele, et il porte donc son propre
-- quittance : `modele` = ecrit par Nemotron, `deterministe` = gabarit local.
-- Le reste du plan ne peut pas y figurer, parce que le reste ne peut pas y
-- acceder : les colonnes budget/danger/fenetre/etapes/kit n'existent pas ici.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trajectoire_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectoire_id    uuid NOT NULL REFERENCES public.trajectoire_snapshots (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Version : strictement croissante par trajectoire, jamais reecrite.
  version           integer NOT NULL,
  engine_version    text NOT NULL,

  -- Instant d'echelle qui a produit CE plan.
  scale_t           double precision NOT NULL,
  zone              public.trajectoire_zone NOT NULL,
  grain             public.trajectoire_grain NOT NULL,
  hours             integer NOT NULL,

  -- Le corps du plan, tel que calcule par le domaine pur.
  -- `steps` et `kit` sont des tableaux d'objets ; `budget`, `danger` et
  -- `window` sont des objets. Aucune de ces formes n'est normalisee : le
  -- domaine les produit et les consomme telles quelles, et unitter un objet
  -- que l'on ne requete jamais par colonne ne ferait que perdre de l'information.
  plan              jsonb NOT NULL,

  -- FNV-1a des entrees (cf. en tete de fichier). Compare cote client.
  sources_hash      text NOT NULL,

  -- Narration : champ unique produit par un modele, donc unique etiquete.
  narration         text,
  narration_origin  text NOT NULL DEFAULT 'deterministe',

  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trajectoire_plans_version_chk
    CHECK (version >= 1),
  CONSTRAINT trajectoire_plans_t_range_chk
    CHECK (scale_t >= 0 AND scale_t <= 1),
  CONSTRAINT trajectoire_plans_hours_range_chk
    CHECK (hours >= 1 AND hours <= 720),
  CONSTRAINT trajectoire_plans_object_chk
    CHECK (jsonb_typeof(plan) = 'object'),
  -- Une narration existe => son origine est declaree. Pas de texte orphelin.
  CONSTRAINT trajectoire_plans_narration_origin_chk
    CHECK (
      narration IS NULL
      OR narration_origin IN ('modele', 'deterministe')
    )
);

-- Une seule version par numero, et une seule version courante par plan :
-- le domaine garantit l'idempotence par `sources_hash`, la base garantit
-- qu'il n'y a pas deux lignes qui pretendent etre la meme version.
CREATE UNIQUE INDEX IF NOT EXISTS trajectoire_plans_version_uniq
  ON public.trajectoire_plans (trajectoire_id, version);

-- Le chemin du domaine : remonter de la version courante a la premiere.
CREATE INDEX IF NOT EXISTS trajectoire_plans_history_idx
  ON public.trajectoire_plans (trajectoire_id, version DESC);

-- Detecter la peremption cote client sans ramener toutes les versions.
CREATE INDEX IF NOT EXISTS trajectoire_plans_hash_idx
  ON public.trajectoire_plans (trajectoire_id, sources_hash);

DROP TRIGGER IF EXISTS trg_trajectoire_plans_updated_at ON public.trajectoire_plans;
CREATE TRIGGER trg_trajectoire_plans_updated_at
  BEFORE UPDATE ON public.trajectoire_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE : jointure plan <-> traces vecues, avec le score d'adequation.
--
-- Le score est un 0-1 calcule par `scaleMatchScore` (domain/traces.ts) :
-- 1 = meme duree exacte, 0 = aux deux extremes de l'axe 1 h -> 720 h.
-- Il est stocke tel quel, et NON recalcule ici : la formule est un logarithme
-- sur des heures, pas une expression SQL, et la dupliquer en base ferait
-- deux definitions a divergir.
--
-- `rank` fige l'ordre d'affichage au moment ou le plan a ete ecrit. Plus
-- tard, de nouvelles traces apparaissent : le plan deja ecrit garde l'ordre
-- qu'il a eu, il ne se retri pas tout seul derriere son dos.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trajectoire_trace_refs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES public.trajectoire_plans (id) ON DELETE CASCADE,
  trajectoire_id  uuid NOT NULL REFERENCES public.trajectoire_snapshots (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Identifiant de la trace dans sa table d'origine (traces / carnets).
  -- Volontairement un texte et non une FK : les traces viennent de tables
  -- differentes (gps, carnets de la tribu, randonnees perso) et une FK unique
  -- n'aurait pas de table cible. La source est portee par `kind`.
  trace_id        text NOT NULL,
  kind            public.trajectoire_ref_kind NOT NULL,

  -- Contexte fige au moment du calcul, comme le plan lui-meme.
  context          text NOT NULL,
  trace_hours      integer NOT NULL,
  scale_match      double precision NOT NULL,
  at_your_scale    boolean NOT NULL DEFAULT false,
  -- Ordre d'affichage dans la carte « Traces ».
  rank             integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trajectoire_trace_refs_hours_chk
    CHECK (trace_hours >= 1 AND trace_hours <= 720),
  CONSTRAINT trajectoire_trace_refs_match_chk
    CHECK (scale_match >= 0 AND scale_match <= 1),
  CONSTRAINT trajectoire_trace_refs_rank_chk
    CHECK (rank >= 0)
);

-- Une trace n'apparait qu'une fois par plan.
CREATE UNIQUE INDEX IF NOT EXISTS trajectoire_trace_refs_uniq
  ON public.trajectoire_trace_refs (plan_id, kind, trace_id);

-- « Les traces a ton echelle » : ce que la carte affiche en badge.
CREATE INDEX IF NOT EXISTS trajectoire_trace_refs_at_scale_idx
  ON public.trajectoire_trace_refs (trajectoire_id, at_your_scale DESC, rank);

CREATE INDEX IF NOT EXISTS trajectoire_trace_refs_lookup_idx
  ON public.trajectoire_trace_refs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE : regles d'autopilot (V5).
--
-- Une regle DECRIT un seuil et une consequence ; elle n emet rien. Ce qui
-- emet, c'est le canal VAPID, dont les abonnements vivent dans
-- `push_subscriptions`. La table ne fait que relier les deux : cette regle a
-- declenche, vers ce curseur, a cette heure.
--
-- `proposed_t` est une PROPOSITION du moteur (`proposeReposition`), pas une
-- decision : le curseur de l'utilisateur ne bouge que parce qu'il l'accepte.
-- C'est la difference entre un autopilote et une prise de controle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trajectoire_veille (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectoire_id  uuid NOT NULL REFERENCES public.trajectoire_snapshots (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  kind            text NOT NULL,
  label           text NOT NULL,
  detail          text,

  -- Seuil observe au moment du declenchement, en JSON, parce que sa forme
  -- depend du kind : km/h pour la meteo, EUR pour les prix, jours pour les
  -- creneaux, score /100 pour la dangerousite.
  threshold        jsonb NOT NULL DEFAULT '{}'::jsonb,

  active          boolean NOT NULL DEFAULT true,

  -- Derniere proposition faite, et son aboutissement. `pending` = propose,
  -- pas encore accepte ni refuse. Une proposition restee `pending` n'a
  -- jamais deconse de deplacer le curseur toute seule.
  proposed_t       double precision,
  proposal_state   text NOT NULL DEFAULT 'pending',
  triggered_at     timestamptz,
  resolved_at      timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trajectoire_veille_kind_chk
    CHECK (kind IN ('meteo', 'prix', 'creneaux', 'dangerosite')),
  CONSTRAINT trajectoire_veille_proposal_chk
    CHECK (proposal_state IN ('pending', 'accepted', 'declined', 'expired')),
  -- Une proposition ne peut pas avoir de position hors de l'axe.
  CONSTRAINT trajectoire_veille_proposed_t_chk
    CHECK (proposed_t IS NULL OR (proposed_t >= 0 AND proposed_t <= 1)),
  -- On ne peut pas avoir ete resolu sans avoir ete declenche.
  CONSTRAINT trajectoire_veille_resolution_chk
    CHECK (resolved_at IS NULL OR triggered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS trajectoire_veille_active_idx
  ON public.trajectoire_veille (user_id, kind, active);

DROP TRIGGER IF EXISTS trg_trajectoire_veille_updated_at ON public.trajectoire_veille;
CREATE TRIGGER trg_trajectoire_veille_updated_at
  BEFORE UPDATE ON public.trajectoire_veille
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — systematiquement, comme le reste du depot (convention §1.5).
--
-- `trajectoire_plans` n'a QUE lecture et insertion. Ni UPDATE ni DELETE :
-- l'immuabilite ne peut pas etre une promesse applicative, elle doit etre
-- une contrainte que le client ne peut pas contourner en contournant l'app.
-- ---------------------------------------------------------------------------
ALTER TABLE public.trajectoire_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajectoire_trace_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajectoire_veille ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trajectoire_plans_select_own" ON public.trajectoire_plans;
CREATE POLICY "trajectoire_plans_select_own" ON public.trajectoire_plans
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_plans_insert_own" ON public.trajectoire_plans;
CREATE POLICY "trajectoire_plans_insert_own" ON public.trajectoire_plans
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_trace_refs_select_own" ON public.trajectoire_trace_refs;
CREATE POLICY "trajectoire_trace_refs_select_own" ON public.trajectoire_trace_refs
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_trace_refs_insert_own" ON public.trajectoire_trace_refs;
CREATE POLICY "trajectoire_trace_refs_insert_own" ON public.trajectoire_trace_refs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_veille_select_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_select_own" ON public.trajectoire_veille
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_veille_insert_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_insert_own" ON public.trajectoire_veille
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Seules les REGLES s'activent et se resolvent ; la regle elle-meme ne se
-- supprime pas. Supprimer une regle, c'est choisir de ne plus watching :
-- cela se dit, cela ne se deduit pas de l'absence.
DROP POLICY IF EXISTS "trajectoire_veille_update_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_update_own" ON public.trajectoire_veille
  FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_veille_delete_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_delete_own" ON public.trajectoire_veille
  FOR DELETE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- FONCTION : dernier plan d'une trajectoire, pour reprendre la session.
--
-- SECURITY DEFINER + `search_path` fige. Elle ne ramene que des lignes deja
-- filtrees par RLS. Comme pour `get_latest_trajectoire`, `sources_hash` est
-- renvoye TEL QUE STOCKE : c'est au client de le comparer, seul endroit ou la
-- formule FNV-1a existe.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_latest_trajectory_plan(p_trajectoire_id uuid)
RETURNS TABLE (
  id               uuid,
  version          integer,
  engine_version   text,
  scale_t          double precision,
  zone             public.trajectoire_zone,
  grain            public.trajectoire_grain,
  hours            integer,
  plan             jsonb,
  sources_hash     text,
  narration        text,
  narration_origin text,
  created_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.version,
    p.engine_version,
    p.scale_t,
    p.zone,
    p.grain,
    p.hours,
    p.plan,
    p.sources_hash,
    p.narration,
    p.narration_origin,
    p.created_at
  FROM public.trajectoire_plans p
  WHERE p.trajectoire_id = p_trajectoire_id
    AND p.user_id = auth.uid()
  ORDER BY p.version DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_latest_trajectory_plan(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_latest_trajectory_plan(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- FONCTION : compter les traces « a ton echelle » d'une trajectoire.
--
-- Le gate de sortie de la phase T3 du dossier (« >= 1 trace a ton echelle sur
-- 3 zones test ») se verifie donc en SQL, sur donnees reelles, sans aller
-- recompter le monde en JavaScript.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_trajectoire_at_scale(p_trajectoire_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.trajectoire_trace_refs r
  WHERE r.trajectoire_id = p_trajectoire_id
    AND r.user_id = auth.uid()
    AND r.at_your_scale;
$$;
REVOKE ALL ON FUNCTION public.count_trajectoire_at_scale(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.count_trajectoire_at_scale(uuid) TO authenticated;