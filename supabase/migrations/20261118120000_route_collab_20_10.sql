-- Migration additive LKDV · Créateur d'itinéraires collaboratif « 20/10 »
-- Compatible avec les voyages, activités et carnets existants (`trips`, `trip_collaborators`,
-- `trip_invitations`, `hiking_routes`, `hike_sessions`, `club_events`, `carnets`).
-- Stratégie de retour arrière : supabase/migrations_down/20261118120000_route_collab_20_10.down.sql
-- (supprime uniquement les nouvelles fonctions, policies, tables et colonnes nullable ajoutées ;
-- refuse de s'exécuter tant que des données ont été créées).
--
-- Révision après relecture de sécurité (non appliquée en production avant cette révision) :
--   * lecture par lien de partage : masquage RGPD fait DANS la base (liste blanche de clés, zone privée) ;
--   * jeton de partage généré en SQL, seul son SHA-256 est stocké ;
--   * rôles d'écriture des parties du snapshot, p_expected_version obligatoire, tailles bornées ;
--   * rôle du créateur adossé au voyage ; membres limités aux collaborateurs du voyage ;
--   * external_viewer : jamais de lecture directe des tables, uniquement la vue assainie.
--
-- Troisième passe : masquage ensembliste borné (B1) et plafonds d'écriture ; un membre retiré du voyage perd son
-- accès (N2) ; route_jf sans exception ; espace archivé en lecture seule (membres, création de lien) ;
-- p_entity_versions borné ; share_token_hash illisible des clients ; index des clés étrangères ; étape confiée
-- (p_stage_scope_ids) ; temps réel privé route:<uuid> ; colonnes de liaison de hike_sessions et vue participant.

-- ----------------------------------------------------------------------------
-- 0. Prérequis : pgcrypto dans le schéma `extensions` (disposition Supabase).
--    Sans lui la migration s'arrête ici, avant toute écriture.
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF to_regprocedure('extensions.digest(text,text)') IS NULL
     OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto doit être installé dans le schéma extensions (digest, gen_random_bytes).';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.route_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  sport TEXT NOT NULL DEFAULT 'marche',
  routing_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  head_seq BIGINT NOT NULL DEFAULT 0 CHECK (head_seq >= 0),
  reviewed_seq BIGINT,
  published_revision_id UUID,
  published_revision_no BIGINT,
  source_origin JSONB NOT NULL DEFAULT '{"kind":"blank"}'::jsonb,
  -- Jeton de partage : seul son SHA-256 (hex) est stocké ; le jeton en clair n'est renvoyé qu'une fois.
  share_token_hash TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  share_revoked_at TIMESTAMPTZ,
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_version BIGINT NOT NULL DEFAULT 0 CHECK (state_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_workspaces_trip_id ON public.route_workspaces(trip_id);
CREATE INDEX IF NOT EXISTS idx_route_workspaces_created_by ON public.route_workspaces(created_by);

CREATE TABLE IF NOT EXISTS public.route_workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'co_organizer', 'editor', 'contributor', 'participant', 'external_viewer')),
  delegated_publish BOOLEAN NOT NULL DEFAULT false,
  stage_scope_ids TEXT[] NOT NULL DEFAULT '{}',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_route_ws_members_user ON public.route_workspace_members(user_id) WHERE revoked_at IS NULL;

-- Tables normalisées : clé primaire (workspace_id, id) et clés étrangères composites, pour qu'un
-- identifiant textuel identique dans deux espaces ne puisse ni se heurter ni se référencer à travers
-- les espaces. Elles ne sont PAS alimentées pour l'instant (l'état vit dans state_snapshot).
CREATE TABLE IF NOT EXISTS public.route_points (
  id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('start', 'via', 'stop', 'stage_boundary', 'finish')),
  order_key TEXT NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  ele_m NUMERIC(8,2),
  name TEXT,
  semantic_kind TEXT,
  note TEXT,
  entity_version BIGINT NOT NULL DEFAULT 1 CHECK (entity_version >= 1),
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS idx_route_points_workspace ON public.route_points(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_route_points_geom ON public.route_points USING GIST(geom);

CREATE TABLE IF NOT EXISTS public.route_sections (
  id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  from_point_id TEXT NOT NULL,
  to_point_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('routed', 'manual', 'imported_preserved')),
  geom geography(LineString, 4326),
  distance_km NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
  duration_min INTEGER,
  ascent_m INTEGER,
  descent_m INTEGER,
  routing_input_hash TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  surface_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  entity_version BIGINT NOT NULL DEFAULT 1 CHECK (entity_version >= 1),
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, from_point_id) REFERENCES public.route_points(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, to_point_id) REFERENCES public.route_points(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_route_sections_workspace ON public.route_sections(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_route_sections_geom ON public.route_sections USING GIST(geom);

CREATE TABLE IF NOT EXISTS public.route_stages (
  id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  order_key TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  title TEXT NOT NULL,
  date_iso DATE,
  departure_time_local TEXT NOT NULL DEFAULT '08:30',
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  start_point_id TEXT,
  end_point_id TEXT,
  overnight_place JSONB,
  notes TEXT NOT NULL DEFAULT '',
  water_observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  weather_slice JSONB,
  hazards JSONB NOT NULL DEFAULT '[]'::jsonb,
  entity_version BIGINT NOT NULL DEFAULT 1 CHECK (entity_version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  -- SET NULL (colonne) : workspace_id est NOT NULL et ne doit pas être remis à NULL (PostgreSQL 15+).
  FOREIGN KEY (workspace_id, start_point_id) REFERENCES public.route_points(workspace_id, id) ON DELETE SET NULL (start_point_id),
  FOREIGN KEY (workspace_id, end_point_id) REFERENCES public.route_points(workspace_id, id) ON DELETE SET NULL (end_point_id)
);

CREATE INDEX IF NOT EXISTS idx_route_stages_workspace ON public.route_stages(workspace_id, day_number);

CREATE TABLE IF NOT EXISTS public.route_operations (
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  seq BIGINT NOT NULL CHECK (seq >= 1),
  op_id TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_seq BIGINT NOT NULL DEFAULT 0,
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  -- SHA-256 (hex) du payload calculé par la base : jamais fourni par l'appelant.
  payload_hash TEXT NOT NULL,
  entity_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, seq),
  UNIQUE (workspace_id, op_id)
);

-- La clé primaire (workspace_id, seq) sert déjà les lectures par espace ; l'acteur est une clé étrangère.
CREATE INDEX IF NOT EXISTS idx_route_operations_actor ON public.route_operations(actor_id);

CREATE TABLE IF NOT EXISTS public.route_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  revision_no BIGINT NOT NULL CHECK (revision_no >= 1),
  parent_revision_id UUID REFERENCES public.route_revisions(id),
  based_on_seq BIGINT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('candidate', 'published')),
  summary TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.route_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  base_seq BIGINT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  scope_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_ops JSONB NOT NULL,
  impact_preview JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected', 'superseded')),
  votes JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_proposals_workspace ON public.route_proposals(workspace_id);

CREATE TABLE IF NOT EXISTS public.route_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK (anchor_type IN ('point', 'section', 'stage', 'position')),
  anchor_entity_id TEXT NOT NULL,
  anchor_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_revision_no BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'needs_relocation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_comments_workspace ON public.route_comments(workspace_id);

CREATE TABLE IF NOT EXISTS public.departure_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  revision_id UUID NOT NULL REFERENCES public.route_revisions(id) ON DELETE CASCADE,
  revision_no BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  manifest JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departure_packs_workspace ON public.departure_packs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_departure_packs_revision ON public.departure_packs(revision_id);

CREATE TABLE IF NOT EXISTS public.participant_pack_states (
  pack_id UUID NOT NULL REFERENCES public.departure_packs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prepared_revision_no BIGINT,
  downloaded_revision_no BIGINT,
  status TEXT NOT NULL DEFAULT 'not_downloaded' CHECK (status IN ('not_downloaded', 'downloading', 'ready', 'outdated', 'failed')),
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_pack_states_user ON public.participant_pack_states(user_id);

-- Colonnes additives nullable pour relier activité réelle et carnet à la révision & au kit figé.
ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS route_workspace_id UUID REFERENCES public.route_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS route_revision_id UUID REFERENCES public.route_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kit_snapshot JSONB;

ALTER TABLE public.carnets
  ADD COLUMN IF NOT EXISTS planned_revision_id UUID REFERENCES public.route_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_revision_no BIGINT,
  ADD COLUMN IF NOT EXISTS departure_kit_snapshot JSONB;

-- Index des clés étrangères ajoutées (ON DELETE SET NULL parcourrait sinon toute la table) ; partiels : la
-- quasi-totalité des lignes existantes a ces colonnes à NULL.
CREATE INDEX IF NOT EXISTS idx_hike_sessions_route_workspace ON public.hike_sessions(route_workspace_id)
  WHERE route_workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hike_sessions_route_revision ON public.hike_sessions(route_revision_id)
  WHERE route_revision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carnets_planned_revision ON public.carnets(planned_revision_id)
  WHERE planned_revision_id IS NOT NULL;

-- ============================================================================
-- Modèle d'écriture (décision d'architecture)
--   * L'état complet (RouteWorkspaceState) vit dans route_workspaces.state_snapshot (JSONB) ;
--     head_seq est reflété en colonne. Les tables normalisées (route_points, route_sections, …)
--     sont créées mais PAS alimentées pour l'instant.
--   * Le serveur Next lit la ligne avec le client Supabase de l'UTILISATEUR (RLS active), calcule
--     l'état suivant avec le moteur pur, puis écrit UNIQUEMENT via les RPC SECURITY DEFINER
--     ci-dessous, qui revérifient le droit en base. Aucune policy INSERT/UPDATE/DELETE directe,
--     et les privilèges INSERT/UPDATE/DELETE sont retirés à anon/authenticated.
--   * state_version : jeton de concurrence optimiste incrémenté à chaque écriture du snapshot.
--     Toutes les RPC d'écriture EXIGENT p_expected_version (NULL => refus) : si la version lue par
--     le serveur a changé, la RPC répond {status:'conflict'} et le serveur relit puis recalcule.
--   * Les RPC de modification du tracé et de publication ne fusionnent QUE leurs clés propres
--     dans le snapshot (route_merge_snapshot_keys) : un appel direct à la RPC ne peut pas
--     réécrire members, shareLink, revisions…
--   * external_viewer (lien de partage ou membre) ne lit JAMAIS les tables : il reçoit la vue
--     assainie produite par route_sanitize_snapshot_for_share (get_shared_route_workspace_tx pour
--     un jeton, get_route_external_view_tx pour un membre external_viewer).
--   * LIMITES CONNUES :
--       - write_route_workspace_part_tx remplace en bloc la liste comments / proposals / kitItems /
--         participantPacks / notifications : un rôle autorisé peut, par appel direct, réécrire toute
--         la liste (ex. les commentaires d'autrui). Le contrôle fin (auteur, droit de relecture) est
--         fait côté Next. À normaliser dans route_comments / route_proposals avec des RPC par entité.
--       - apply_route_operation_tx reçoit l'état suivant calculé par le serveur : un éditeur peut,
--         par appel direct, écrire n'importe quel tracé (clés points/sections/stages/…), mais jamais
--         members, shareLink, révisions ni statut. Le moteur d'opérations n'est pas rejoué en base.
--       - un espace SANS voyage ne peut avoir que son créateur pour membre (set_route_member_tx
--         n'ajoute que des collaborateurs du voyage de l'espace).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. Aides internes (jamais exposées aux clients)
-- ----------------------------------------------------------------------------

-- Nombre JSON => double precision, sinon NULL (aucune erreur de cast sur un type inattendu). Un nombre hors
-- bornes (1e400 : dépassement ; 1e-400 : sous-dépassement) ne lève JAMAIS d'exception de cast :
--   |x| >= 1e300 => NULL ; sinon arrondi à 12 décimales (1e-400 => 0) avant le passage en double precision.
CREATE OR REPLACE FUNCTION public.route_jf(p_value JSONB)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- CASE imbriqués : l'ordre d'évaluation des opérandes d'un AND n'est pas garanti.
  SELECT CASE WHEN jsonb_typeof(p_value) = 'number' THEN
           CASE WHEN abs(p_value::numeric) < 1e300 THEN round(p_value::numeric, 12)::double precision END
         END;
$$;

-- Chaîne JSON tronquée, sinon null JSON.
CREATE OR REPLACE FUNCTION public.route_jtext(p_obj JSONB, p_key TEXT, p_max INTEGER)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(p_obj -> p_key) = 'string'
              THEN to_jsonb(left(p_obj ->> p_key, p_max))
              ELSE 'null'::jsonb END;
$$;

-- Nombre JSON, sinon null JSON.
CREATE OR REPLACE FUNCTION public.route_jnum(p_obj JSONB, p_key TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(p_obj -> p_key) = 'number' THEN p_obj -> p_key ELSE 'null'::jsonb END;
$$;

-- Vrai si la clé est absente ou si sa valeur a le type JSON attendu ('array', 'object', 'string'…).
CREATE OR REPLACE FUNCTION public.route_part_ok(p_obj JSONB, p_key TEXT, p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT (p_obj ? p_key) OR jsonb_typeof(p_obj -> p_key) = p_type;
$$;

-- Plafonds de taille d'un instantané, appliqués à l'ÉCRITURE (création, opération, publication) pour que
-- le masquage de lecture (anon compris) reste borné : <= 2 000 points actifs, <= 2 000 tronçons,
-- <= 80 000 coordonnées au total (somme des geometry.coordinates), <= 60 étapes. Linéaire ; les parcours
-- coûteux ne s'exécutent qu'après les plafonds de nombre (CASE : l'ordre des AND n'est pas garanti).
-- Un argument NULL ou non tableau compte pour vide.
-- Pourquoi 80 000 coordonnées et non 200 000 : le masquage de lecture a été mesuré à ~0,8 s pour 200 000
-- coordonnées (2 000 points + 2 000 tronçons), ~0,45 s pour 100 000 (marge trop faible) et ~0,35 s pour 80 000 ; l'import du client est borné à
-- 20 000 points par tracé (startBuilders.MAX_IMPORT_POINTS), soit 5 fois de marge.
CREATE OR REPLACE FUNCTION public.route_snapshot_within_caps(p_points JSONB, p_sections JSONB, p_stages JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN l.n_stages > 60 OR l.n_sections > 2000 THEN false
    WHEN (SELECT count(*) FROM jsonb_array_elements(l.points) AS e
          WHERE jsonb_typeof(e) = 'object' AND COALESCE(e ->> 'deletedAt', '') = '') > 2000 THEN false
    ELSE COALESCE((
      SELECT sum(CASE WHEN jsonb_typeof(e #> '{geometry,coordinates}') = 'array'
                      THEN jsonb_array_length(e #> '{geometry,coordinates}') ELSE 0 END)
      FROM jsonb_array_elements(l.sections) AS e
      WHERE jsonb_typeof(e) = 'object'
    ), 0) <= 80000
  END
  FROM (
    SELECT CASE WHEN jsonb_typeof(p_points) = 'array' THEN p_points ELSE '[]'::jsonb END AS points,
           CASE WHEN jsonb_typeof(p_sections) = 'array' THEN p_sections ELSE '[]'::jsonb END AS sections,
           CASE WHEN jsonb_typeof(p_stages) = 'array' THEN jsonb_array_length(p_stages) ELSE 0 END AS n_stages,
           CASE WHEN jsonb_typeof(p_sections) = 'array' THEN jsonb_array_length(p_sections) ELSE 0 END AS n_sections
  ) AS l;
$$;

-- Tableau JSON trié par id (comparaison de contenu indépendante de l'ordre) ; p_skip_deleted retire
-- les entrées portant un deletedAt non vide (points supprimés logiquement).
CREATE OR REPLACE FUNCTION public.route_sorted_by_id(p_array JSONB, p_skip_deleted BOOLEAN)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(e ORDER BY (e ->> 'id') COLLATE "C"), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_array) = 'array' THEN p_array ELSE '[]'::jsonb END) AS e
  WHERE NOT p_skip_deleted OR COALESCE(e ->> 'deletedAt', '') = '';
$$;

-- Fusionne dans p_base uniquement les clés listées de p_next (les autres clés de p_next sont ignorées).
CREATE OR REPLACE FUNCTION public.route_merge_snapshot_keys(p_base JSONB, p_next JSONB, p_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_result JSONB := COALESCE(p_base, '{}'::jsonb);
  v_key TEXT;
BEGIN
  FOREACH v_key IN ARRAY p_keys LOOP
    IF p_next ? v_key THEN
      v_result := jsonb_set(v_result, ARRAY[v_key], p_next -> v_key, true);
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Rôle effectif (usage interne des RPC et des policies, non appelable par les clients)
--   Retourne : owner | rôle de route_workspace_members (non révoqué) | trip_editor / trip_viewer
--   (collaborateur du voyage sans ligne de membre) | NULL (aucun droit, révoqué, ou membre d'un espace lié
--   à un voyage dont il n'est plus collaborateur).
--   Espace lié à un voyage : le propriétaire du voyage (trips.user_id ou trip_collaborators.role =
--   'owner') est owner ; le créateur n'est owner que s'il est encore propriétaire ou éditeur du voyage,
--   sinon il n'a plus aucun droit. Espace sans voyage : le créateur est owner.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.route_workspace_effective_role(p_workspace_id UUID, p_uid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws public.route_workspaces%ROWTYPE;
  v_member public.route_workspace_members%ROWTYPE;
  v_trip_owner BOOLEAN := false;
  v_trip_role TEXT;
BEGIN
  IF p_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_ws FROM public.route_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_ws.trip_id IS NULL THEN
    IF v_ws.created_by = p_uid THEN
      RETURN 'owner';
    END IF;
  ELSE
    SELECT (t.user_id = p_uid) INTO v_trip_owner FROM public.trips t WHERE t.id = v_ws.trip_id;
    SELECT tc.role::text INTO v_trip_role
    FROM public.trip_collaborators tc
    WHERE tc.trip_id = v_ws.trip_id AND tc.user_id = p_uid;

    IF COALESCE(v_trip_owner, false) OR v_trip_role = 'owner' THEN
      RETURN 'owner';
    END IF;
    IF v_ws.created_by = p_uid THEN
      -- Créateur : owner tant qu'il peut encore éditer le voyage, sinon plus aucun droit.
      IF v_trip_role = 'editor' THEN
        RETURN 'owner';
      END IF;
      RETURN NULL;
    END IF;
  END IF;

  SELECT * INTO v_member
  FROM public.route_workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_uid;

  IF FOUND THEN
    IF v_member.revoked_at IS NOT NULL THEN
      RETURN NULL;
    END IF;
    -- Espace lié à un voyage : un rôle de membre n'est valable que tant que la personne est encore
    -- collaboratrice du voyage (le propriétaire et le créateur ont été traités plus haut). Retirée de
    -- trip_collaborators, elle perd tout accès, sans attendre une révocation explicite.
    IF v_ws.trip_id IS NOT NULL AND v_trip_role IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN v_member.role;
  END IF;

  IF v_ws.trip_id IS NOT NULL AND v_trip_role IS NOT NULL THEN
    IF v_trip_role = 'editor' THEN
      RETURN 'trip_editor';
    END IF;
    RETURN 'trip_viewer';
  END IF;

  RETURN NULL;
END;
$$;

-- Identifiants des espaces lisibles EN ENTIER par auth.uid() (tous rôles sauf external_viewer).
-- SETOF évalué UNE fois par requête quand la policy est écrite `col IN (SELECT fonction())` ;
-- une fonction scalaire `can_read(col)` serait réévaluée ligne à ligne. Les candidats sont d'abord
-- restreints par index (créateur, appartenance, voyage) puis filtrés par le rôle effectif.
CREATE OR REPLACE FUNCTION public.readable_route_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rw.id
  FROM public.route_workspaces rw
  WHERE rw.id IN (
    SELECT w.id FROM public.route_workspaces w WHERE w.created_by = (SELECT auth.uid())
    UNION
    -- Membre d'un espace sans voyage, ou d'un espace lié qui l'a encore pour collaborateur (N2).
    SELECT m.workspace_id FROM public.route_workspace_members m
    JOIN public.route_workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = (SELECT auth.uid()) AND m.revoked_at IS NULL
      AND (w.trip_id IS NULL
           OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
                      WHERE tc.trip_id = w.trip_id AND tc.user_id = (SELECT auth.uid())))
    UNION
    SELECT w.id FROM public.route_workspaces w
    JOIN public.trip_collaborators tc ON tc.trip_id = w.trip_id
    WHERE tc.user_id = (SELECT auth.uid())
    UNION
    SELECT w.id FROM public.route_workspaces w
    JOIN public.trips t ON t.id = w.trip_id
    WHERE t.user_id = (SELECT auth.uid())
  )
  AND COALESCE(public.route_workspace_effective_role(rw.id, (SELECT auth.uid())), 'external_viewer') <> 'external_viewer';
$$;

-- Lecture complète d'un espace (même règle que les policies). Un external_viewer n'a pas de lecture
-- directe : il passe par get_route_external_view_tx.
CREATE OR REPLACE FUNCTION public.can_read_route_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.route_workspace_effective_role(p_workspace_id, (SELECT auth.uid())) <> 'external_viewer',
    false
  );
$$;

-- Identifiant d'espace porté par un topic Realtime « route:<uuid> » ; NULL pour tout autre topic ou un uuid
-- mal formé (jamais d'exception : un topic hostile est simplement refusé par les policies realtime.messages).
CREATE OR REPLACE FUNCTION public.route_topic_workspace_id(p_topic TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_topic ~ '^route:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN substring(p_topic from 7)::uuid END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Assainissement RGPD d'un snapshot pour un lecteur externe (lien de partage ou external_viewer)
--   Aligné sur src/features/route-collab/shareSanitize.ts (défense en profondeur côté Next).
--   * liste blanche de clés à chaque niveau ; jamais tripId, provenance, sourceId/sourceUrl,
--     originalGpxXml, notes, observations d'eau, dangers, lieux de nuit (lat/lon), userId ;
--   * zone de départ privée (et d'arrivée si boucle) : points du rayon retirés, départ/arrivée
--     déplacés au premier/dernier point du tracé hors du rayon, coordonnées de géométrie du rayon
--     retirées ; sans aucune coordonnée hors du rayon, départ/arrivée ne sont pas montrés ;
--   * rayon minimal 200 m ; haversine inlinée (SQL pur, aucune dépendance PostGIS).
--   COÛT : requête ENSEMBLISTE unique (jsonb_array_elements + jsonb_agg, semi-jointures sur les identifiants
--   conservés), linéaire en nombre de points + coordonnées. Aucune concaténation JSONB en boucle et aucune
--   fonction avec SET search_path appelée par coordonnée (c'était quadratique : 26 s au plafond, 23 s pour 5 000 points
--   + 5 000 tronçons). Elle est atteignable par anon (get_shared_route_workspace_tx) : les plafonds d'écriture
--   (route_snapshot_within_caps) bornent l'entrée ; mesuré ~0,35 s au plafond (2 000 points, 1 999 tronçons,
--   79 960 coordonnées ; test SQL, cas B1). SET enable_nestloop = off et jit = off : sans statistiques sur les CTE
--   le planificateur choisissait des boucles imbriquées quadratiques, et JIT ajoutait ~1,7 s de compilation.
--   Une coordonnée hors bornes (lat ±90, lon ±180) ou non numérique est retirée, jamais source d'erreur.
CREATE OR REPLACE FUNCTION public.route_sanitize_snapshot_for_share(
  p_workspace_id UUID,
  p_snapshot JSONB,
  p_head_seq BIGINT,
  p_radius_m NUMERIC
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
-- Les CTE n'ont pas de statistiques : sans cela le planificateur les croit à 1 ligne et choisit des
-- boucles imbriquées quadratiques. Jointures par hachage / fusion à la place.
SET enable_nestloop = off
-- JIT : la compilation d'une requête de ce type coûte ~1,7 s, plus que l'exécution (mesuré).
SET jit = off
AS $$
WITH
raw AS (
  SELECT
    x.s,
    LEAST(GREATEST(COALESCE(p_radius_m, 500), 200), 20000000)::double precision AS radius,
    CASE WHEN jsonb_typeof(x.s -> 'points') = 'array' THEN x.s -> 'points' ELSE '[]'::jsonb END AS points,
    CASE WHEN jsonb_typeof(x.s -> 'sections') = 'array' THEN x.s -> 'sections' ELSE '[]'::jsonb END AS sections,
    CASE WHEN jsonb_typeof(x.s -> 'stages') = 'array' THEN x.s -> 'stages' ELSE '[]'::jsonb END AS stages,
    CASE WHEN jsonb_typeof(x.s -> 'members') = 'array' THEN x.s -> 'members' ELSE '[]'::jsonb END AS members,
    CASE WHEN jsonb_typeof(x.s -> 'sourceOrigin') = 'object' THEN x.s -> 'sourceOrigin' ELSE '{}'::jsonb END AS origin,
    CASE WHEN jsonb_typeof(x.s -> 'routingOptions') = 'object' THEN x.s -> 'routingOptions' ELSE '{}'::jsonb END AS options
  -- `|| '{}'` : copie en mémoire, le jsonb (plusieurs Mo) n'est ainsi décompressé qu'une fois et non à chaque accès.
  FROM (SELECT COALESCE(p_snapshot, '{}'::jsonb) || '{}'::jsonb AS s OFFSET 0) AS x
),
-- Points actifs, valides, triés par orderKey puis id (collation C = comparaison de chaînes du moteur).
pts AS MATERIALIZED (
  SELECT row_number() OVER (ORDER BY (q.e ->> 'orderKey') COLLATE "C", (q.e ->> 'id') COLLATE "C") AS ord,
         q.e, q.e ->> 'id' AS pid, q.e ->> 'kind' AS kind, q.lat, q.lon
  FROM (
    SELECT t.e,
           CASE WHEN jsonb_typeof(t.e -> 'lat') = 'number' THEN
             CASE WHEN abs((t.e -> 'lat')::numeric) <= 90 THEN round((t.e -> 'lat')::numeric, 9)::double precision END
           END AS lat,
           CASE WHEN jsonb_typeof(t.e -> 'lon') = 'number' THEN
             CASE WHEN abs((t.e -> 'lon')::numeric) <= 180 THEN round((t.e -> 'lon')::numeric, 9)::double precision END
           END AS lon
    FROM raw, jsonb_array_elements(raw.points) AS t(e)
    WHERE jsonb_typeof(t.e) = 'object'
      AND jsonb_typeof(t.e -> 'id') = 'string'
      AND COALESCE(t.e ->> 'deletedAt', '') = ''
  ) AS q
  WHERE q.lat IS NOT NULL AND q.lon IS NOT NULL
),
-- Centres privés : le départ (premier point de kind 'start', sinon le premier) ; en boucle, aussi l'arrivée.
ctr AS MATERIALIZED (
  SELECT raw.radius, n.n,
         f.lat::numeric - (degrees(raw.radius / 6371000.0) * 1.001 + 0.000001)::numeric AS lo1,
         f.lat::numeric + (degrees(raw.radius / 6371000.0) * 1.001 + 0.000001)::numeric AS hi1,
         f.lat AS lat1, f.lon AS lon1,
         CASE WHEN raw.s ->> 'shapeMode' = 'loop' AND n.n >= 2
              THEN l.lat::numeric - (degrees(raw.radius / 6371000.0) * 1.001 + 0.000001)::numeric END AS lo2,
         CASE WHEN raw.s ->> 'shapeMode' = 'loop' AND n.n >= 2
              THEN l.lat::numeric + (degrees(raw.radius / 6371000.0) * 1.001 + 0.000001)::numeric END AS hi2,
         CASE WHEN raw.s ->> 'shapeMode' = 'loop' AND n.n >= 2 THEN l.lat END AS lat2,
         CASE WHEN raw.s ->> 'shapeMode' = 'loop' AND n.n >= 2 THEN l.lon END AS lon2
  FROM raw
  CROSS JOIN (SELECT count(*) AS n FROM pts) AS n
  LEFT JOIN pts f ON f.ord = COALESCE((SELECT min(p.ord) FROM pts p WHERE p.kind = 'start'), 1)
  LEFT JOIN pts l ON l.ord = n.n
),
-- Dans la zone privée = à moins de `radius` mètres d'un centre (haversine, sphère de 6 371 km).
pz AS MATERIALIZED (
  SELECT p.*,
    COALESCE(
      (c.lat1 IS NOT NULL AND 2 * 6371000 * asin(least(1, sqrt(
         power(sin(radians(p.lat - c.lat1) / 2), 2)
         + cos(radians(c.lat1)) * cos(radians(p.lat)) * power(sin(radians(p.lon - c.lon1) / 2), 2)))) <= c.radius)
      OR
      (c.lat2 IS NOT NULL AND 2 * 6371000 * asin(least(1, sqrt(
         power(sin(radians(p.lat - c.lat2) / 2), 2)
         + cos(radians(c.lat2)) * cos(radians(p.lat)) * power(sin(radians(p.lon - c.lon2) / 2), 2)))) <= c.radius),
      false) AS inz
  FROM pts p CROSS JOIN ctr c
),
sec_raw AS MATERIALIZED (
  SELECT t.o, t.e, t.e ->> 'fromPointId' AS fid, t.e ->> 'toPointId' AS tid
  FROM raw, jsonb_array_elements(raw.sections) WITH ORDINALITY AS t(e, o)
  WHERE jsonb_typeof(t.e) = 'object'
),
-- Toutes les coordonnées des tronçons, une seule fois : ok = couple [lon, lat] numérique, dans les bornes
-- et hors de la zone privée. Chemin chaud (jusqu'à 200 000 coordonnées), donc :
--   * comparaisons en numeric (aucun aller-retour texte, aucun cast pouvant déborder : 1e400 reste un numeric) ;
--   * double precision et trigonométrie seulement pour une coordonnée proche d'un centre privé
--     (|Δlat| <= rayon : sinon la distance est forcément supérieure, exact ; bornes lo/hi précalculées) ;
--   * OFFSET 0 : aucune expression n'est dupliquée par le planificateur.
-- Les gardes sont des CASE (l'ordre d'évaluation des AND n'est pas garanti).
coords AS MATERIALIZED (
  SELECT g.sord, g.cord, g.jlon, g.jlat, g.two,
    CASE WHEN g.nlon IS NULL OR g.nlat IS NULL THEN false
         WHEN g.nlon NOT BETWEEN -180 AND 180 OR g.nlat NOT BETWEEN -90 AND 90 THEN false
         ELSE NOT CASE WHEN c.lat1 IS NULL THEN false
                       WHEN g.nlat NOT BETWEEN c.lo1 AND c.hi1 THEN false
                       ELSE 2 * 6371000 * asin(least(1, sqrt(
                              power(sin(radians(g.nlat::double precision - c.lat1) / 2), 2)
                              + cos(radians(c.lat1)) * cos(radians(g.nlat::double precision))
                                * power(sin(radians(g.nlon::double precision - c.lon1) / 2), 2)))) <= c.radius
                  END
              AND NOT CASE WHEN c.lat2 IS NULL THEN false
                           WHEN g.nlat NOT BETWEEN c.lo2 AND c.hi2 THEN false
                           ELSE 2 * 6371000 * asin(least(1, sqrt(
                                  power(sin(radians(g.nlat::double precision - c.lat2) / 2), 2)
                                  + cos(radians(c.lat2)) * cos(radians(g.nlat::double precision))
                                    * power(sin(radians(g.nlon::double precision - c.lon2) / 2), 2)))) <= c.radius
                      END
    END AS ok
  FROM (
    SELECT s.o AS sord, c.ord AS cord, c.v -> 0 AS jlon, c.v -> 1 AS jlat,
           CASE WHEN jsonb_typeof(c.v -> 0) = 'number' THEN (c.v -> 0)::numeric END AS nlon,
           CASE WHEN jsonb_typeof(c.v -> 1) = 'number' THEN (c.v -> 1)::numeric END AS nlat,
           CASE WHEN jsonb_typeof(c.v) = 'array' THEN jsonb_array_length(c.v) = 2 ELSE false END AS two
    FROM sec_raw s
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(s.e #> '{geometry,coordinates}') = 'array'
           THEN s.e #> '{geometry,coordinates}' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS c(v, ord)
    OFFSET 0
  ) AS g
  CROSS JOIN ctr c
),
-- Statistiques par tronçon (un passage) : nombre de coordonnées, conservées, couples [lon, lat], première/dernière conservée.
cstat AS (
  SELECT c.sord, count(*) AS total, count(*) FILTER (WHERE c.ok) AS kept, count(*) FILTER (WHERE c.two) AS pairs,
         min(c.cord) FILTER (WHERE c.ok) AS cmin, max(c.cord) FILTER (WHERE c.ok) AS cmax
  FROM coords c
  GROUP BY c.sord
),
-- Premier et dernier point du tracé hors de la zone privée (tronçons pris par point de départ : le dernier
-- tronçon du tableau dont fromPointId est l'identifiant du point). Par tronçon, cstat donne déjà la première
-- et la dernière coordonnée hors zone : il ne reste qu'à choisir parmi <= 1 tronçon par point.
last_sec AS (
  SELECT DISTINCT ON (s.fid) s.o, s.fid FROM sec_raw s ORDER BY s.fid, s.o DESC
),
sec_pts AS (
  SELECT ls.o AS sord, p.ord AS pord, z.cmin, z.cmax
  FROM pts p
  JOIN last_sec ls ON ls.fid = p.pid
  JOIN cstat z ON z.sord = ls.o
  WHERE z.cmin IS NOT NULL
),
first_k AS (SELECT t.sord, t.cmin AS cord FROM sec_pts t ORDER BY t.pord, t.cmin LIMIT 1),
last_k AS (SELECT t.sord, t.cmax AS cord FROM sec_pts t ORDER BY t.pord DESC, t.cmax DESC LIMIT 1),
-- Une seule ligne (jamais rejouée par point) : premier et dernier point hors zone.
anc AS MATERIALIZED (
  SELECT f.v -> 0 AS fjlon, f.v -> 1 AS fjlat, l.v -> 0 AS ljlon, l.v -> 1 AS ljlat
  FROM (
    SELECT (SELECT jsonb_build_array(c.jlon, c.jlat) FROM coords c JOIN first_k fk ON c.sord = fk.sord AND c.cord = fk.cord) AS fv,
           (SELECT jsonb_build_array(c.jlon, c.jlat) FROM coords c JOIN last_k lk ON c.sord = lk.sord AND c.cord = lk.cord) AS lv
  ) AS q
  CROSS JOIN LATERAL (SELECT q.fv AS v) AS f
  CROSS JOIN LATERAL (SELECT q.lv AS v) AS l
),
-- Points : hors zone => conservés (note retirée) ; dans la zone => seuls départ/arrivée subsistent,
-- déplacés hors du rayon ; sans coordonnée hors du rayon, ils ne sont pas montrés.
outp AS MATERIALIZED (
  SELECT a.ord, a.pid,
    CASE WHEN NOT a.inz THEN
      jsonb_build_object(
        'id', CASE WHEN jsonb_typeof(a.e -> 'id') = 'string' THEN to_jsonb(left(a.e ->> 'id', 80)) ELSE 'null'::jsonb END,
        'workspaceId', to_jsonb(p_workspace_id::text),
        'kind', CASE WHEN jsonb_typeof(a.e -> 'kind') = 'string' THEN to_jsonb(left(a.e ->> 'kind', 24)) ELSE 'null'::jsonb END,
        'orderKey', CASE WHEN jsonb_typeof(a.e -> 'orderKey') = 'string' THEN to_jsonb(left(a.e ->> 'orderKey', 40)) ELSE 'null'::jsonb END,
        'lat', a.e -> 'lat',
        'lon', a.e -> 'lon',
        'eleM', CASE WHEN jsonb_typeof(a.e -> 'eleM') = 'number' THEN a.e -> 'eleM' ELSE 'null'::jsonb END,
        'name', CASE WHEN jsonb_typeof(a.e -> 'name') = 'string' THEN to_jsonb(left(a.e ->> 'name', 200)) ELSE 'null'::jsonb END,
        'semanticKind', CASE WHEN jsonb_typeof(a.e -> 'semanticKind') = 'string' THEN to_jsonb(left(a.e ->> 'semanticKind', 40)) ELSE 'null'::jsonb END,
        'note', 'null'::jsonb,
        'entityVersion', CASE WHEN jsonb_typeof(a.e -> 'entityVersion') = 'number' THEN a.e -> 'entityVersion' ELSE 'null'::jsonb END)
    ELSE
      jsonb_build_object(
        'id', CASE WHEN jsonb_typeof(a.e -> 'id') = 'string' THEN to_jsonb(left(a.e ->> 'id', 80)) ELSE 'null'::jsonb END,
        'workspaceId', to_jsonb(p_workspace_id::text),
        'kind', CASE WHEN jsonb_typeof(a.e -> 'kind') = 'string' THEN to_jsonb(left(a.e ->> 'kind', 24)) ELSE 'null'::jsonb END,
        'orderKey', CASE WHEN jsonb_typeof(a.e -> 'orderKey') = 'string' THEN to_jsonb(left(a.e ->> 'orderKey', 40)) ELSE 'null'::jsonb END,
        'lat', a.anc_jlat,
        'lon', a.anc_jlon,
        'eleM', 'null'::jsonb,
        'name', to_jsonb(CASE WHEN a.kind = 'start' OR (a.ord = 1 AND COALESCE(a.kind, '') <> 'finish')
                              THEN 'Départ (zone privée masquée)'
                              ELSE 'Arrivée (zone privée masquée)' END),
        'note', 'null'::jsonb,
        'entityVersion', CASE WHEN jsonb_typeof(a.e -> 'entityVersion') = 'number' THEN a.e -> 'entityVersion' ELSE 'null'::jsonb END,
        'masked', 'true'::jsonb)
    END AS obj
  FROM (
    SELECT p.*, c.n,
           CASE WHEN COALESCE(p.kind = 'finish', false) OR (p.ord = c.n AND p.ord <> 1) THEN an.ljlat ELSE an.fjlat END AS anc_jlat,
           CASE WHEN COALESCE(p.kind = 'finish', false) OR (p.ord = c.n AND p.ord <> 1) THEN an.ljlon ELSE an.fjlon END AS anc_jlon
    FROM pz p
    CROSS JOIN ctr c
    CROSS JOIN anc an
  ) AS a
  WHERE NOT a.inz
     OR (COALESCE(a.kind IN ('start', 'finish'), false) OR a.ord = 1 OR a.ord = a.n)
        AND a.anc_jlat IS NOT NULL AND a.anc_jlon IS NOT NULL
),
kept AS MATERIALIZED (SELECT DISTINCT pid FROM outp),
-- Tronçons entre deux points conservés ; coordonnées de la zone privée retirées.
sec_out AS (
  SELECT s.o, s.e
  FROM sec_raw s
  WHERE s.fid IN (SELECT pid FROM kept) AND s.tid IN (SELECT pid FROM kept)
),
-- Statistiques par tronçon (un passage), puis reconstruction des seules coordonnées des tronçons qui en
-- perdent une ou qui ne sont pas de simples couples [lon, lat] ; les autres gardent leur tableau d'origine.
cagg AS (
  SELECT c.sord, jsonb_agg(jsonb_build_array(c.jlon, c.jlat) ORDER BY c.cord) AS kept_coords
  FROM coords c
  WHERE c.ok AND c.sord IN (SELECT t.sord FROM cstat t WHERE t.kept <> t.total OR t.pairs <> t.total)
  GROUP BY c.sord
),
secj AS (
  SELECT w.o,
    -- Les altitudes ne sont gardées que si aucune coordonnée n'a été retirée (sinon désalignées).
    -- Deux variantes d'un même jsonb_build_object (pas de `||` : il recopierait toute la géométrie).
    CASE WHEN w.all_kept AND jsonb_typeof(w.e -> 'elevationSamples') = 'array'
         THEN jsonb_build_object(
        'id', CASE WHEN jsonb_typeof(w.e -> 'id') = 'string' THEN to_jsonb(left(w.e ->> 'id', 80)) ELSE 'null'::jsonb END,
        'workspaceId', to_jsonb(p_workspace_id::text),
        'fromPointId', w.e -> 'fromPointId',
        'toPointId', w.e -> 'toPointId',
        'mode', CASE WHEN jsonb_typeof(w.e -> 'mode') = 'string' THEN to_jsonb(left(w.e ->> 'mode', 24)) ELSE 'null'::jsonb END,
        'geometry', jsonb_build_object('type', 'LineString', 'coordinates', w.coords_out),
        'distanceKm', CASE WHEN jsonb_typeof(w.e -> 'distanceKm') = 'number' THEN w.e -> 'distanceKm' ELSE 'null'::jsonb END,
        'durationMin', CASE WHEN jsonb_typeof(w.e -> 'durationMin') = 'number' THEN w.e -> 'durationMin' ELSE 'null'::jsonb END,
        'ascentM', CASE WHEN jsonb_typeof(w.e -> 'ascentM') = 'number' THEN w.e -> 'ascentM' ELSE 'null'::jsonb END,
        'descentM', CASE WHEN jsonb_typeof(w.e -> 'descentM') = 'number' THEN w.e -> 'descentM' ELSE 'null'::jsonb END,
        'surfaceSegments', CASE WHEN jsonb_typeof(w.e -> 'surfaceSegments') = 'array' THEN w.e -> 'surfaceSegments' ELSE '[]'::jsonb END,
        'warnings', '[]'::jsonb,
        'entityVersion', CASE WHEN jsonb_typeof(w.e -> 'entityVersion') = 'number' THEN w.e -> 'entityVersion' ELSE 'null'::jsonb END,
        'elevationSamples', w.e -> 'elevationSamples')
         ELSE jsonb_build_object(
        'id', CASE WHEN jsonb_typeof(w.e -> 'id') = 'string' THEN to_jsonb(left(w.e ->> 'id', 80)) ELSE 'null'::jsonb END,
        'workspaceId', to_jsonb(p_workspace_id::text),
        'fromPointId', w.e -> 'fromPointId',
        'toPointId', w.e -> 'toPointId',
        'mode', CASE WHEN jsonb_typeof(w.e -> 'mode') = 'string' THEN to_jsonb(left(w.e ->> 'mode', 24)) ELSE 'null'::jsonb END,
        'geometry', jsonb_build_object('type', 'LineString', 'coordinates', w.coords_out),
        'distanceKm', CASE WHEN jsonb_typeof(w.e -> 'distanceKm') = 'number' THEN w.e -> 'distanceKm' ELSE 'null'::jsonb END,
        'durationMin', CASE WHEN jsonb_typeof(w.e -> 'durationMin') = 'number' THEN w.e -> 'durationMin' ELSE 'null'::jsonb END,
        'ascentM', CASE WHEN jsonb_typeof(w.e -> 'ascentM') = 'number' THEN w.e -> 'ascentM' ELSE 'null'::jsonb END,
        'descentM', CASE WHEN jsonb_typeof(w.e -> 'descentM') = 'number' THEN w.e -> 'descentM' ELSE 'null'::jsonb END,
        'surfaceSegments', CASE WHEN jsonb_typeof(w.e -> 'surfaceSegments') = 'array' THEN w.e -> 'surfaceSegments' ELSE '[]'::jsonb END,
        'warnings', '[]'::jsonb,
        'entityVersion', CASE WHEN jsonb_typeof(w.e -> 'entityVersion') = 'number' THEN w.e -> 'entityVersion' ELSE 'null'::jsonb END)
    END AS obj
  FROM (
    SELECT s.o, s.e,
           COALESCE(z.total, 0) = COALESCE(z.kept, 0) AS all_kept,
           -- Tronçon intact (rien retiré, que des couples [lon, lat]) : tableau d'origine, sinon reconstruit.
           CASE WHEN COALESCE(z.kept, 0) = COALESCE(z.total, 0) AND COALESCE(z.pairs, 0) = COALESCE(z.total, 0)
                THEN CASE WHEN jsonb_typeof(s.e #> '{geometry,coordinates}') = 'array'
                          THEN s.e #> '{geometry,coordinates}' ELSE '[]'::jsonb END
                ELSE COALESCE(a.kept_coords, '[]'::jsonb) END AS coords_out
    FROM sec_out s
    LEFT JOIN cstat z ON z.sord = s.o
    LEFT JOIN cagg a ON a.sord = s.o
    OFFSET 0
  ) AS w
)
SELECT jsonb_build_object(
  'id', to_jsonb(p_workspace_id::text),
  'title', CASE WHEN jsonb_typeof(raw.s -> 'title') = 'string' THEN to_jsonb(left(raw.s ->> 'title', 160)) ELSE 'null'::jsonb END,
  'status', CASE WHEN jsonb_typeof(raw.s -> 'status') = 'string' THEN to_jsonb(left(raw.s ->> 'status', 16)) ELSE 'null'::jsonb END,
  'sport', CASE WHEN jsonb_typeof(raw.s -> 'sport') = 'string' THEN to_jsonb(left(raw.s ->> 'sport', 40)) ELSE 'null'::jsonb END,
  'shapeMode', CASE WHEN jsonb_typeof(raw.s -> 'shapeMode') = 'string' THEN to_jsonb(left(raw.s ->> 'shapeMode', 16)) ELSE 'null'::jsonb END,
  'routingOptions', jsonb_strip_nulls(jsonb_build_object(
    'ebike', CASE WHEN jsonb_typeof(raw.options -> 'ebike') = 'boolean' THEN raw.options -> 'ebike' END,
    'avoidSteps', CASE WHEN jsonb_typeof(raw.options -> 'avoidSteps') = 'boolean' THEN raw.options -> 'avoidSteps' END,
    'avoidFerries', CASE WHEN jsonb_typeof(raw.options -> 'avoidFerries') = 'boolean' THEN raw.options -> 'avoidFerries' END,
    'surfacePref', CASE WHEN jsonb_typeof(raw.options -> 'surfacePref') = 'string'
                        THEN to_jsonb(left(raw.options ->> 'surfacePref', 24)) END
  )),
  'headSeq', to_jsonb(COALESCE(p_head_seq, 0)),
  'reviewedSeq', CASE WHEN jsonb_typeof(raw.s -> 'reviewedSeq') = 'number' THEN raw.s -> 'reviewedSeq' ELSE 'null'::jsonb END,
  'publishedRevisionNo', CASE WHEN jsonb_typeof(raw.s -> 'publishedRevisionNo') = 'number' THEN raw.s -> 'publishedRevisionNo' ELSE 'null'::jsonb END,
  'sourceOrigin', jsonb_build_object(
    'kind', CASE WHEN jsonb_typeof(raw.origin -> 'kind') = 'string' THEN to_jsonb(left(raw.origin ->> 'kind', 24)) ELSE 'null'::jsonb END,
    'sourceTitle', CASE WHEN jsonb_typeof(raw.origin -> 'sourceTitle') = 'string' THEN to_jsonb(left(raw.origin ->> 'sourceTitle', 160)) ELSE 'null'::jsonb END,
    'importedAt', CASE WHEN jsonb_typeof(raw.origin -> 'importedAt') = 'string' THEN to_jsonb(left(raw.origin ->> 'importedAt', 40)) ELSE 'null'::jsonb END,
    'attribution', CASE WHEN jsonb_typeof(raw.origin -> 'attribution') = 'string' THEN to_jsonb(left(raw.origin ->> 'attribution', 300)) ELSE 'null'::jsonb END
  ),
  'shareLink', 'null'::jsonb,
  'points', COALESCE((SELECT jsonb_agg(o.obj ORDER BY o.ord) FROM outp o), '[]'::jsonb),
  'sections', COALESCE((SELECT jsonb_agg(j.obj ORDER BY j.o) FROM secj j), '[]'::jsonb),
  -- Étapes réduites : identité, jour, titre, date, distance éventuelle, ids de points conservés.
  'stages', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', CASE WHEN jsonb_typeof(t.e -> 'id') = 'string' THEN to_jsonb(left(t.e ->> 'id', 80)) ELSE 'null'::jsonb END,
             'workspaceId', to_jsonb(p_workspace_id::text),
             'orderKey', CASE WHEN jsonb_typeof(t.e -> 'orderKey') = 'string' THEN to_jsonb(left(t.e ->> 'orderKey', 40)) ELSE 'null'::jsonb END,
             'dayNumber', CASE WHEN jsonb_typeof(t.e -> 'dayNumber') = 'number' THEN t.e -> 'dayNumber' ELSE 'null'::jsonb END,
             'kind', CASE WHEN jsonb_typeof(t.e -> 'kind') = 'string' THEN to_jsonb(left(t.e ->> 'kind', 16)) ELSE 'null'::jsonb END,
             'title', CASE WHEN jsonb_typeof(t.e -> 'title') = 'string' THEN to_jsonb(left(t.e ->> 'title', 160)) ELSE 'null'::jsonb END,
             'dateIso', CASE WHEN jsonb_typeof(t.e -> 'dateIso') = 'string' THEN to_jsonb(left(t.e ->> 'dateIso', 32)) ELSE 'null'::jsonb END,
             'distanceKm', CASE WHEN jsonb_typeof(t.e -> 'distanceKm') = 'number' THEN t.e -> 'distanceKm' ELSE 'null'::jsonb END,
             'startPointId', CASE WHEN (t.e ->> 'startPointId') IN (SELECT pid FROM kept) THEN t.e -> 'startPointId' ELSE 'null'::jsonb END,
             'endPointId', CASE WHEN (t.e ->> 'endPointId') IN (SELECT pid FROM kept) THEN t.e -> 'endPointId' ELSE 'null'::jsonb END
           ) ORDER BY t.ord)
    FROM jsonb_array_elements(raw.stages) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(t.e) = 'object'
  ), '[]'::jsonb),
  'variants', '[]'::jsonb,
  'proposals', '[]'::jsonb,
  'comments', '[]'::jsonb,
  'kitItems', '[]'::jsonb,
  -- Membres : nom affiché et rôle uniquement (jamais d'identifiant), non révoqués.
  'members', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'displayName', CASE WHEN jsonb_typeof(t.e -> 'displayName') = 'string' THEN to_jsonb(left(t.e ->> 'displayName', 120)) ELSE 'null'::jsonb END,
             'role', CASE WHEN jsonb_typeof(t.e -> 'role') = 'string' THEN to_jsonb(left(t.e ->> 'role', 24)) ELSE 'null'::jsonb END
           ) ORDER BY t.ord)
    FROM jsonb_array_elements(raw.members) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(t.e) = 'object' AND COALESCE(t.e ->> 'revokedAt', '') = ''
  ), '[]'::jsonb),
  'revisions', '[]'::jsonb,
  'packs', '[]'::jsonb,
  'participantPacks', '[]'::jsonb,
  'updatedAt', CASE WHEN jsonb_typeof(raw.s -> 'updatedAt') = 'string' THEN to_jsonb(left(raw.s ->> 'updatedAt', 40)) ELSE 'null'::jsonb END
)
FROM raw;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC d'écriture
-- ----------------------------------------------------------------------------

-- Création d'un espace d'itinéraire : auth requise ; si p_trip_id est fourni, droit d'édition du voyage
-- (can_edit_trip) exigé. Insère l'espace + la ligne de membre owner et renvoie l'id.
-- Les membres du snapshot fourni sont ignorés : seul l'appelant est inscrit (owner).
-- Erreurs : 42501 (non authentifié / voyage non éditable), 22023 (paramètre invalide).
CREATE OR REPLACE FUNCTION public.create_route_workspace_tx(
  p_trip_id UUID,
  p_title TEXT,
  p_sport TEXT,
  p_snapshot JSONB,
  p_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_id UUID := COALESCE(p_id, gen_random_uuid());
  v_name TEXT;
  v_snapshot JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) < 2 OR char_length(p_title) > 160 THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023';
  END IF;
  IF p_sport IS NULL OR char_length(btrim(p_sport)) = 0 OR char_length(p_sport) > 40 THEN
    RAISE EXCEPTION 'invalid_sport' USING ERRCODE = '22023';
  END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR length(p_snapshot::text) > 5000000 THEN
    RAISE EXCEPTION 'invalid_snapshot' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.route_part_ok(p_snapshot, 'points', 'array')
          AND public.route_part_ok(p_snapshot, 'sections', 'array')
          AND public.route_part_ok(p_snapshot, 'stages', 'array')
          AND public.route_part_ok(p_snapshot, 'variants', 'array')
          AND public.route_part_ok(p_snapshot, 'comments', 'array')
          AND public.route_part_ok(p_snapshot, 'proposals', 'array')
          AND public.route_part_ok(p_snapshot, 'kitItems', 'array')
          AND public.route_part_ok(p_snapshot, 'routingOptions', 'object')
          AND public.route_part_ok(p_snapshot, 'sourceOrigin', 'object')) THEN
    RAISE EXCEPTION 'invalid_snapshot_shape' USING ERRCODE = '22023';
  END IF;
  -- Plafonds d'écriture (2 000 points actifs, 2 000 tronçons, 80 000 coordonnées, 60 étapes) : ils bornent
  -- le coût du masquage de lecture, atteignable par anon.
  IF NOT public.route_snapshot_within_caps(p_snapshot -> 'points', p_snapshot -> 'sections', p_snapshot -> 'stages') THEN
    RAISE EXCEPTION 'snapshot_too_large' USING ERRCODE = '22023';
  END IF;
  IF p_trip_id IS NOT NULL AND NOT public.can_edit_trip(p_trip_id) THEN
    RAISE EXCEPTION 'trip_edit_required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_snapshot -> 'members') = 'array' THEN
    SELECT m ->> 'displayName' INTO v_name
    FROM jsonb_array_elements(p_snapshot -> 'members') AS m
    WHERE m ->> 'userId' = v_uid::text
    LIMIT 1;
  END IF;
  v_name := COALESCE(NULLIF(btrim(left(v_name, 120)), ''), 'Voyageur ' || left(v_uid::text, 6));

  -- tripId : uniquement le voyage dont le droit d'édition a été vérifié (p_trip_id) ; la valeur du snapshot
  -- fourni n'est jamais recopiée (un espace sans voyage ne porte pas d'identifiant de voyage inventé).
  v_snapshot := (p_snapshot - 'tripId') || jsonb_build_object(
    'id', v_id,
    'tripId', p_trip_id::text,
    'title', btrim(p_title),
    'sport', p_sport,
    'status', 'draft',
    'headSeq', 0,
    'reviewedSeq', NULL,
    'publishedRevisionId', NULL,
    'publishedRevisionNo', NULL,
    'shareLink', NULL,
    'revisions', '[]'::jsonb,
    'packs', '[]'::jsonb,
    'participantPacks', '[]'::jsonb,
    'notifications', '[]'::jsonb,
    'members', jsonb_build_array(jsonb_build_object(
      'userId', v_uid,
      'displayName', v_name,
      'role', 'owner',
      'delegatedPublish', false,
      'revokedAt', NULL
    ))
  );

  INSERT INTO public.route_workspaces (id, trip_id, created_by, title, sport, state_snapshot)
  VALUES (v_id, p_trip_id, v_uid, btrim(p_title), p_sport, v_snapshot);

  INSERT INTO public.route_workspace_members (workspace_id, user_id, role, delegated_publish)
  VALUES (v_id, v_uid, 'owner', false);

  RETURN v_id;
END;
$$;

-- Fonction transactionnelle courte (FOR UPDATE sur la tête de route) :
-- Vérifie droits + idempotence (op_id / hash SQL du payload) + séquence monotone + concurrence optimiste.
--   p_base_seq        : head_seq lu par le serveur avant de calculer p_next_snapshot (pas la vue du client).
--                       S'il a changé => {status:'conflict', reason:'head_moved'}.
--   p_expected_version: OBLIGATOIRE (NULL => refus) ; state_version lue par le serveur (reason 'state_version_moved').
--   p_payload_hash    : conservé pour compatibilité d'appel, IGNORÉ : le hash est calculé ici (SHA-256).
--   p_next_snapshot   : seules les clés propres aux opérations sont fusionnées dans le snapshot stocké ;
--                       les types des clés fusionnées sont contrôlés, taille <= 5 Mo (payload <= 200 Ko,
--                       2 Mo pour import_track), plafonds du tracé (refus 'snapshot_too_large') :
--                       <= 2 000 points actifs, 2 000 tronçons, 80 000 coordonnées au total, 60 étapes.
--   p_entity_versions : <= 100 Ko (sinon 'payload_too_large').
-- Rôles autorisés : owner / co_organizer / editor, ou collaborateur éditeur du voyage sans ligne de membre.
-- Un espace archivé est en lecture seule.
CREATE OR REPLACE FUNCTION public.apply_route_operation_tx(
  p_workspace_id UUID,
  p_op_id TEXT,
  p_base_seq BIGINT,
  p_operation_type TEXT,
  p_payload JSONB,
  p_payload_hash TEXT,
  p_entity_versions JSONB,
  p_next_snapshot JSONB,
  p_expected_version BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_existing public.route_operations%ROWTYPE;
  v_role TEXT;
  v_next_seq BIGINT;
  v_snapshot JSONB;
  v_hash TEXT;
  v_payload_limit INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
  END IF;
  IF p_next_snapshot IS NULL OR jsonb_typeof(p_next_snapshot) <> 'object'
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR p_op_id IS NULL OR char_length(p_op_id) = 0 OR char_length(p_op_id) > 120
     OR p_operation_type IS NULL OR char_length(p_operation_type) = 0 OR char_length(p_operation_type) > 60 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_input');
  END IF;
  IF p_expected_version IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'expected_version_required');
  END IF;

  v_payload_limit := CASE WHEN p_operation_type = 'import_track' THEN 2000000 ELSE 200000 END;
  IF length(p_payload::text) > v_payload_limit OR length(p_next_snapshot::text) > 5000000 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'payload_too_large');
  END IF;
  IF NOT (public.route_part_ok(p_next_snapshot, 'points', 'array')
          AND public.route_part_ok(p_next_snapshot, 'sections', 'array')
          AND public.route_part_ok(p_next_snapshot, 'stages', 'array')
          AND public.route_part_ok(p_next_snapshot, 'variants', 'array')
          AND public.route_part_ok(p_next_snapshot, 'comments', 'array')
          AND public.route_part_ok(p_next_snapshot, 'kitItems', 'array')
          AND public.route_part_ok(p_next_snapshot, 'routingOptions', 'object')
          AND public.route_part_ok(p_next_snapshot, 'sport', 'string')
          AND public.route_part_ok(p_next_snapshot, 'shapeMode', 'string')
          AND public.route_part_ok(p_next_snapshot, 'updatedAt', 'string')) THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_snapshot_shape');
  END IF;
  IF p_next_snapshot ? 'sport' AND char_length(p_next_snapshot ->> 'sport') > 40 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_snapshot_shape');
  END IF;
  -- Versions d'entités attendues : petite table id -> version, bornée (journal des opérations).
  IF p_entity_versions IS NOT NULL AND length(p_entity_versions::text) > 100000 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'payload_too_large');
  END IF;
  -- Plafonds d'écriture (voir route_snapshot_within_caps) sur les parties du tracé fournies.
  IF NOT public.route_snapshot_within_caps(p_next_snapshot -> 'points', p_next_snapshot -> 'sections', p_next_snapshot -> 'stages') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'snapshot_too_large');
  END IF;

  -- Verrou court sur la tête de route : ordonne écritures concurrentes et révocations.
  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Contrôle de permission métier en base (un participant, un lecteur ou un révoqué est refusé).
  v_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'co_organizer', 'editor', 'trip_editor') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'insufficient_permissions_or_revoked');
  END IF;
  IF v_ws.status = 'archived' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'workspace_archived');
  END IF;

  v_hash := encode(extensions.digest(p_payload::text, 'sha256'), 'hex');

  -- Idempotence : même (workspace_id, op_id) avec même hash => already_applied ; hash différent => refus.
  SELECT * INTO v_existing
  FROM public.route_operations
  WHERE workspace_id = p_workspace_id AND op_id = p_op_id;

  IF FOUND THEN
    IF v_existing.payload_hash <> v_hash THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'idempotency_payload_mismatch');
    END IF;
    RETURN jsonb_build_object('status', 'already_applied', 'seq', v_existing.seq);
  END IF;

  -- Concurrence optimiste : l'état calculé par le serveur doit partir de la tête actuelle.
  IF p_base_seq IS NULL OR p_base_seq <> v_ws.head_seq THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'head_moved', 'currentSeq', v_ws.head_seq);
  END IF;
  IF p_expected_version <> v_ws.state_version THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'state_version_moved', 'currentSeq', v_ws.head_seq);
  END IF;

  v_next_seq := v_ws.head_seq + 1;

  INSERT INTO public.route_operations (
    workspace_id, seq, op_id, actor_id, base_seq, operation_type, payload, payload_hash, entity_versions
  ) VALUES (
    p_workspace_id, v_next_seq, p_op_id, v_uid, p_base_seq, p_operation_type, p_payload, v_hash,
    CASE WHEN jsonb_typeof(p_entity_versions) = 'object' THEN p_entity_versions ELSE '{}'::jsonb END
  );

  v_snapshot := public.route_merge_snapshot_keys(
    v_ws.state_snapshot,
    p_next_snapshot,
    ARRAY['sport', 'shapeMode', 'routingOptions', 'points', 'sections', 'stages', 'variants', 'comments', 'kitItems', 'updatedAt']
  );
  v_snapshot := jsonb_set(v_snapshot, '{headSeq}', to_jsonb(v_next_seq), true);

  UPDATE public.route_workspaces
  SET head_seq = v_next_seq,
      state_snapshot = v_snapshot,
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object('status', 'accepted', 'seq', v_next_seq);
END;
$$;

-- Publication transactionnelle immuable : vérifie expected_head_seq = head_seq, p_expected_version (obligatoire)
-- et droit de publication (owner, ou co_organizer avec delegated_publish), CONTRÔLE que l'instantané publié
-- (basedOnSeq, revisionNo, points actifs, tronçons, étapes, kitSnapshot) est bien celui de la base, crée
-- révision + pack et met à jour le snapshot (clés de publication uniquement) dans la même transaction.
-- NB : les colonnes published_revision_id / route_revisions.id sont des UUID générés ici ; le snapshot
-- conserve l'identifiant lisible produit par le moteur (rev-<workspace>-v<n>).
CREATE OR REPLACE FUNCTION public.publish_route_revision_tx(
  p_workspace_id UUID,
  p_expected_head_seq BIGINT,
  p_summary TEXT,
  p_snapshot JSONB,
  p_checksum TEXT,
  p_manifest JSONB,
  p_next_snapshot JSONB,
  p_expected_version BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_role TEXT;
  v_delegated BOOLEAN := false;
  v_can_publish BOOLEAN := false;
  v_next_rev_no BIGINT;
  v_rev_id UUID;
  v_pack_id UUID;
  v_snapshot JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'auth_required');
  END IF;
  IF p_next_snapshot IS NULL OR jsonb_typeof(p_next_snapshot) <> 'object'
     OR p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object'
     OR p_manifest IS NULL OR jsonb_typeof(p_manifest) <> 'object'
     OR p_checksum IS NULL OR char_length(p_checksum) = 0 OR char_length(p_checksum) > 200
     OR p_expected_head_seq IS NULL THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'invalid_input');
  END IF;
  IF p_expected_version IS NULL THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'expected_version_required');
  END IF;
  IF length(p_snapshot::text) > 5000000 OR length(p_manifest::text) > 5000000
     OR length(p_next_snapshot::text) > 5000000 THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'payload_too_large');
  END IF;
  IF NOT (public.route_part_ok(p_next_snapshot, 'revisions', 'array')
          AND public.route_part_ok(p_next_snapshot, 'packs', 'array')
          AND public.route_part_ok(p_next_snapshot, 'participantPacks', 'array')
          AND public.route_part_ok(p_next_snapshot, 'publishedRevisionId', 'string')
          AND public.route_part_ok(p_next_snapshot, 'updatedAt', 'string')
          AND public.route_part_ok(p_snapshot, 'points', 'array')
          AND public.route_part_ok(p_snapshot, 'sections', 'array')
          AND public.route_part_ok(p_snapshot, 'stages', 'array')
          AND public.route_part_ok(p_snapshot, 'kitSnapshot', 'array')) THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'invalid_snapshot_shape');
  END IF;
  IF NOT public.route_snapshot_within_caps(p_snapshot -> 'points', p_snapshot -> 'sections', p_snapshot -> 'stages') THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'snapshot_too_large');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_role = 'owner' THEN
    v_can_publish := true;
  ELSIF v_role = 'co_organizer' THEN
    SELECT rwm.delegated_publish INTO v_delegated
    FROM public.route_workspace_members rwm
    WHERE rwm.workspace_id = p_workspace_id AND rwm.user_id = v_uid AND rwm.revoked_at IS NULL;
    v_can_publish := COALESCE(v_delegated, false);
  END IF;

  IF NOT v_can_publish THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'publish_permission_required');
  END IF;
  IF v_ws.status = 'archived' THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'workspace_archived');
  END IF;

  IF v_ws.head_seq <> p_expected_head_seq THEN
    RETURN jsonb_build_object(
      'status', 'blocked',
      'reason', 'head_changed_requires_review',
      'currentHeadSeq', v_ws.head_seq
    );
  END IF;

  IF p_expected_version <> v_ws.state_version THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'state_version_moved', 'currentHeadSeq', v_ws.head_seq);
  END IF;

  v_next_rev_no := COALESCE(v_ws.published_revision_no, 0) + 1;

  -- Cohérence de l'instantané publié avec l'état de la base (immuable une fois écrit).
  IF (p_snapshot ->> 'basedOnSeq') IS DISTINCT FROM v_ws.head_seq::text
     OR (p_snapshot ->> 'revisionNo') IS DISTINCT FROM v_next_rev_no::text THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'snapshot_head_mismatch', 'currentHeadSeq', v_ws.head_seq);
  END IF;
  IF public.route_sorted_by_id(p_snapshot -> 'points', true) IS DISTINCT FROM public.route_sorted_by_id(v_ws.state_snapshot -> 'points', true)
     OR public.route_sorted_by_id(p_snapshot -> 'sections', false) IS DISTINCT FROM public.route_sorted_by_id(v_ws.state_snapshot -> 'sections', false)
     OR public.route_sorted_by_id(p_snapshot -> 'stages', false) IS DISTINCT FROM public.route_sorted_by_id(v_ws.state_snapshot -> 'stages', false)
     OR public.route_sorted_by_id(p_snapshot -> 'kitSnapshot', false) IS DISTINCT FROM public.route_sorted_by_id(v_ws.state_snapshot -> 'kitItems', false) THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'snapshot_content_mismatch');
  END IF;

  INSERT INTO public.route_revisions (
    workspace_id, revision_no, parent_revision_id, based_on_seq, created_by, kind, summary, snapshot
  ) VALUES (
    p_workspace_id, v_next_rev_no, v_ws.published_revision_id, v_ws.head_seq, v_uid, 'published', left(COALESCE(p_summary, ''), 500), p_snapshot
  )
  RETURNING id INTO v_rev_id;

  INSERT INTO public.departure_packs (
    workspace_id, revision_id, revision_no, checksum, manifest
  ) VALUES (
    p_workspace_id, v_rev_id, v_next_rev_no, p_checksum, p_manifest
  )
  RETURNING id INTO v_pack_id;

  v_snapshot := public.route_merge_snapshot_keys(
    v_ws.state_snapshot,
    p_next_snapshot,
    ARRAY['publishedRevisionId', 'revisions', 'packs', 'participantPacks', 'updatedAt']
  );
  v_snapshot := v_snapshot || jsonb_build_object(
    'status', 'published',
    'reviewedSeq', v_ws.head_seq,
    'publishedRevisionNo', v_next_rev_no
  );

  UPDATE public.route_workspaces
  SET status = 'published',
      reviewed_seq = v_ws.head_seq,
      published_revision_id = v_rev_id,
      published_revision_no = v_next_rev_no,
      state_snapshot = v_snapshot,
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object(
    'status', 'published',
    'revisionId', v_rev_id,
    'revisionNo', v_next_rev_no,
    'packId', v_pack_id
  );
END;
$$;

-- Remplace UNE partie du snapshot (liste blanche) : comments, proposals, kitItems, participantPacks, notifications.
-- Rôles autorisés par partie (trip_viewer et external_viewer refusés partout) :
--   comments, proposals          : owner, co_organizer, editor, contributor, trip_editor
--   kitItems, participantPacks   : idem + participant
--   notifications                : owner, co_organizer, editor, trip_editor
-- p_expected_version est OBLIGATOIRE ; un espace archivé est en lecture seule.
-- Voir LIMITES CONNUES en tête de section : la liste est remplacée en bloc.
CREATE OR REPLACE FUNCTION public.write_route_workspace_part_tx(
  p_workspace_id UUID,
  p_part TEXT,
  p_value JSONB,
  p_expected_version BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_role TEXT;
  v_allowed TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
  END IF;
  IF p_part IS NULL OR p_part NOT IN ('comments', 'proposals', 'kitItems', 'participantPacks', 'notifications') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'part_not_allowed');
  END IF;
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_value');
  END IF;
  IF p_expected_version IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'expected_version_required');
  END IF;
  IF length(p_value::text) > 1000000 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'value_too_large');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_value) AS e WHERE jsonb_typeof(e) <> 'object') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_value');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_allowed := CASE p_part
    WHEN 'comments' THEN ARRAY['owner', 'co_organizer', 'editor', 'contributor', 'trip_editor']
    WHEN 'proposals' THEN ARRAY['owner', 'co_organizer', 'editor', 'contributor', 'trip_editor']
    WHEN 'kitItems' THEN ARRAY['owner', 'co_organizer', 'editor', 'contributor', 'participant', 'trip_editor']
    WHEN 'participantPacks' THEN ARRAY['owner', 'co_organizer', 'editor', 'contributor', 'participant', 'trip_editor']
    ELSE ARRAY['owner', 'co_organizer', 'editor', 'trip_editor']
  END;

  v_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_role IS NULL OR NOT (v_role = ANY (v_allowed)) THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'insufficient_permissions_or_revoked');
  END IF;
  IF v_ws.status = 'archived' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'workspace_archived');
  END IF;

  IF p_expected_version <> v_ws.state_version THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'state_version_moved', 'currentSeq', v_ws.head_seq);
  END IF;

  UPDATE public.route_workspaces
  SET state_snapshot = jsonb_set(state_snapshot, ARRAY[p_part], p_value, true),
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object('status', 'ok', 'stateVersion', v_ws.state_version + 1);
END;
$$;

-- Gestion des membres : owner ou co_organizer.
--   * Seuls les collaborateurs du voyage de l'espace (ou les membres existants) peuvent être ajoutés ;
--     sinon {status:'denied', reason:'not_eligible'} sans révéler si l'identifiant existe. Aucune lecture
--     de auth.users : le nom affiché vient de p_display_name, du snapshot ou d'un libellé neutre.
--   * Le créateur et le propriétaire du voyage ne sont ni révocables ni rétrogradables.
--   * Un co_organizer ne peut ni nommer/révoquer un owner, ni modifier delegated_publish, ni réactiver un
--     membre révoqué, ni changer le rôle d'une cible qui porte la délégation de publication.
--   * delegated_publish est forcé à false si le rôle n'est pas co_organizer ou en cas de révocation.
-- Met à jour la table ET state_snapshot -> 'members'. p_role NULL = rôle inchangé ('participant' pour un
-- nouveau membre) ; p_delegated_publish NULL = inchangé ; p_revoke = true révoque, false/NULL rétablit.
-- p_stage_scope_ids (« une étape confiée », 8.3) : NULL = inchangé ('{}' pour un nouveau membre) ; sinon la
-- liste des étapes confiées (<= 60 identifiants de <= 80 caractères [A-Za-z0-9_-]), écrite dans
-- route_workspace_members.stage_scope_ids ET dans le membre du snapshot (stageScopeIds). '{}' = aucune restriction.
-- Un espace archivé est en lecture seule (aucune modification de membre).
-- Ancienne signature (6 arguments) retirée : une surcharge avec valeurs par défaut rendrait l'appel ambigu.
DROP FUNCTION IF EXISTS public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.set_route_member_tx(
  p_workspace_id UUID,
  p_user_id UUID,
  p_role TEXT,
  p_revoke BOOLEAN,
  p_delegated_publish BOOLEAN,
  p_display_name TEXT DEFAULT NULL,
  p_stage_scope_ids TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_actor_role TEXT;
  v_target public.route_workspace_members%ROWTYPE;
  v_target_found BOOLEAN;
  v_target_role TEXT;
  v_fixed_owner BOOLEAN;
  v_new_role TEXT;
  v_new_delegated BOOLEAN;
  v_revoke BOOLEAN := COALESCE(p_revoke, false);
  v_now_iso TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_name TEXT := NULLIF(btrim(left(p_display_name, 120)), '');
  v_scope TEXT[];
  v_scope_json JSONB;
  v_entry JSONB;
  v_members JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_target');
  END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('owner', 'co_organizer', 'editor', 'contributor', 'participant', 'external_viewer') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_role');
  END IF;
  IF p_stage_scope_ids IS NOT NULL AND (
       array_ndims(p_stage_scope_ids) > 1
       OR cardinality(p_stage_scope_ids) > 60
       OR EXISTS (SELECT 1 FROM unnest(p_stage_scope_ids) AS e
                  WHERE e IS NULL OR char_length(e) > 80 OR e !~ '^[A-Za-z0-9_-]+$')) THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_stage_scope');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_actor_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'co_organizer') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'member_management_requires_owner_or_co_organizer');
  END IF;
  IF v_ws.status = 'archived' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'workspace_archived');
  END IF;

  SELECT * INTO v_target
  FROM public.route_workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  v_target_found := FOUND;

  -- Propriétaire « figé » : créateur de l'espace ou propriétaire du voyage rattaché.
  v_fixed_owner := p_user_id = v_ws.created_by
    OR (v_ws.trip_id IS NOT NULL AND (
          EXISTS (SELECT 1 FROM public.trips t WHERE t.id = v_ws.trip_id AND t.user_id = p_user_id)
          OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
                     WHERE tc.trip_id = v_ws.trip_id AND tc.user_id = p_user_id AND tc.role::text = 'owner')));

  -- Éligibilité d'un nouveau membre : collaborateur du voyage de l'espace uniquement.
  IF NOT v_target_found THEN
    IF v_ws.trip_id IS NULL OR NOT (
         v_fixed_owner
         OR EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = v_ws.trip_id AND tc.user_id = p_user_id)
       ) THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'not_eligible');
    END IF;
  END IF;

  v_target_role := CASE
    WHEN v_fixed_owner THEN 'owner'
    WHEN v_target_found THEN v_target.role
    ELSE NULL
  END;
  v_new_role := COALESCE(p_role, CASE WHEN v_target_found THEN v_target.role
                                      WHEN v_fixed_owner THEN 'owner'
                                      ELSE 'participant' END);

  IF v_fixed_owner AND (v_revoke OR v_new_role <> 'owner') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'creator_immutable');
  END IF;

  IF v_actor_role = 'co_organizer' THEN
    IF v_target_role = 'owner' OR v_new_role = 'owner' THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'owner_protected');
    END IF;
    IF p_delegated_publish IS NOT NULL
       AND p_delegated_publish IS DISTINCT FROM (CASE WHEN v_target_found THEN v_target.delegated_publish ELSE false END) THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'delegated_publish_requires_owner');
    END IF;
    IF v_target_found AND v_target.revoked_at IS NOT NULL AND NOT v_revoke THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'reactivation_requires_owner');
    END IF;
    IF v_target_found AND v_target.delegated_publish AND NOT v_revoke AND v_new_role IS DISTINCT FROM v_target.role THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'delegated_publish_requires_owner');
    END IF;
  END IF;

  v_new_delegated := CASE
    WHEN v_revoke OR v_new_role <> 'co_organizer' THEN false
    ELSE COALESCE(p_delegated_publish, CASE WHEN v_target_found THEN v_target.delegated_publish ELSE false END)
  END;

  -- Étapes confiées : NULL = inchangé (liste existante, sinon vide).
  v_scope := COALESCE(p_stage_scope_ids, CASE WHEN v_target_found THEN v_target.stage_scope_ids ELSE '{}'::text[] END);
  v_scope_json := to_jsonb(v_scope);

  INSERT INTO public.route_workspace_members (workspace_id, user_id, role, delegated_publish, revoked_at, stage_scope_ids)
  VALUES (p_workspace_id, p_user_id, v_new_role, v_new_delegated, CASE WHEN v_revoke THEN now() ELSE NULL END, v_scope)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        delegated_publish = EXCLUDED.delegated_publish,
        revoked_at = EXCLUDED.revoked_at,
        stage_scope_ids = EXCLUDED.stage_scope_ids,
        updated_at = now();

  v_members := CASE WHEN jsonb_typeof(v_ws.state_snapshot -> 'members') = 'array'
                    THEN v_ws.state_snapshot -> 'members' ELSE '[]'::jsonb END;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_members) e WHERE e ->> 'userId' = p_user_id::text) THEN
    SELECT COALESCE(jsonb_agg(
             CASE WHEN t.e ->> 'userId' = p_user_id::text
                  THEN t.e || jsonb_build_object(
                         'displayName', COALESCE(v_name, t.e ->> 'displayName', 'Voyageur ' || left(p_user_id::text, 6)),
                         'role', v_new_role,
                         'delegatedPublish', v_new_delegated,
                         'stageScopeIds', v_scope_json,
                         'revokedAt', CASE WHEN v_revoke THEN to_jsonb(v_now_iso) ELSE 'null'::jsonb END)
                  ELSE t.e END
             ORDER BY t.ord), '[]'::jsonb)
    INTO v_members
    FROM jsonb_array_elements(v_members) WITH ORDINALITY AS t(e, ord);
  ELSE
    v_entry := jsonb_build_object(
      'userId', p_user_id,
      'displayName', COALESCE(v_name, 'Voyageur ' || left(p_user_id::text, 6)),
      'role', v_new_role,
      'delegatedPublish', v_new_delegated,
      'stageScopeIds', v_scope_json,
      'revokedAt', CASE WHEN v_revoke THEN to_jsonb(v_now_iso) ELSE 'null'::jsonb END
    );
    v_members := v_members || jsonb_build_array(v_entry);
  END IF;

  UPDATE public.route_workspaces
  SET state_snapshot = jsonb_set(state_snapshot, '{members}', v_members, true),
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- Lien de partage lecture seule : owner ou co_organizer.
--   'create' : GÉNÈRE le jeton en SQL (256 bits aléatoires, préfixe « shr- » + hex), ne stocke que son
--              SHA-256 (share_token_hash) et le renvoie UNE SEULE FOIS dans la clé `token` ; il n'apparaît
--              jamais dans le snapshot (shareLink : expiresAt, revokedAt, hidePrivateStartRadiusM, …).
--              Remplacer un lien invalide l'ancien jeton. Rayon de la zone privée : 200 à 5000 m.
--   'revoke' : marque le lien révoqué (permis même sur un espace archivé, qui refuse en revanche 'create').
-- Met à jour les colonnes share_* ET snapshot.shareLink.
CREATE OR REPLACE FUNCTION public.manage_route_share_link_tx(
  p_workspace_id UUID,
  p_action TEXT,
  p_expires_at TIMESTAMPTZ,
  p_hide_radius_m INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_role TEXT;
  v_link JSONB;
  v_token TEXT;
  v_now_iso TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('create', 'revoke') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_action');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'co_organizer') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'share_management_requires_owner_or_co_organizer');
  END IF;
  -- Espace archivé en lecture seule : plus de nouveau lien. La RÉVOCATION reste permise (geste protecteur :
  -- sans elle, un lien déjà publié resterait ouvert à anon jusqu'à son expiration).
  IF p_action = 'create' AND v_ws.status = 'archived' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'workspace_archived');
  END IF;

  IF p_action = 'create' THEN
    IF p_hide_radius_m IS NULL OR p_hide_radius_m < 200 OR p_hide_radius_m > 5000 THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_radius');
    END IF;
    IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_expiry');
    END IF;

    v_token := 'shr-' || encode(extensions.gen_random_bytes(32), 'hex');

    v_link := jsonb_build_object(
      'audience', 'external_viewer',
      'expiresAt', CASE WHEN p_expires_at IS NULL THEN 'null'::jsonb
                        ELSE to_jsonb(to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
      'revokedAt', 'null'::jsonb,
      'hidePrivateStartRadiusM', p_hide_radius_m,
      'createdBy', v_uid,
      'createdAt', v_now_iso
    );

    UPDATE public.route_workspaces
    SET share_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
        share_expires_at = p_expires_at,
        share_revoked_at = NULL,
        state_snapshot = jsonb_set(state_snapshot, '{shareLink}', v_link, true),
        state_version = state_version + 1,
        updated_at = now()
    WHERE id = p_workspace_id;

    RETURN jsonb_build_object('status', 'ok', 'shareLink', v_link, 'token', v_token);
  END IF;

  v_link := CASE WHEN jsonb_typeof(v_ws.state_snapshot -> 'shareLink') = 'object'
                 THEN ((v_ws.state_snapshot -> 'shareLink') - 'token') || jsonb_build_object('revokedAt', v_now_iso)
                 ELSE NULL END;

  UPDATE public.route_workspaces
  SET share_revoked_at = CASE WHEN share_token_hash IS NOT NULL THEN now() ELSE share_revoked_at END,
      state_snapshot = CASE WHEN v_link IS NOT NULL
                            THEN jsonb_set(state_snapshot, '{shareLink}', v_link, true)
                            ELSE state_snapshot END,
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object('status', 'ok', 'shareLink', COALESCE(v_link, 'null'::jsonb));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC de lecture assainie
-- ----------------------------------------------------------------------------

-- Lecture publique d'un itinéraire par lien de partage (le visiteur n'a pas de ligne RLS).
-- Seul un jeton dont le SHA-256 correspond, non révoqué et non expiré, ouvre l'accès ; le snapshot
-- renvoyé est assaini DANS la base (route_sanitize_snapshot_for_share : liste blanche, zone de départ
-- privée masquée, aucune coordonnée du rayon). Seule RPC exécutable par `anon` : le jeton (256 bits)
-- fait office de secret, comparé par son hash (index unique, aucune comparaison de secret en clair).
CREATE OR REPLACE FUNCTION public.get_shared_route_workspace_tx(p_workspace_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws public.route_workspaces%ROWTYPE;
  v_radius NUMERIC;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
    AND share_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_ws.share_revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;
  IF v_ws.share_expires_at IS NOT NULL AND v_ws.share_expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  v_radius := GREATEST(COALESCE(public.route_jf(v_ws.state_snapshot -> 'shareLink' -> 'hidePrivateStartRadiusM'), 500), 200);

  RETURN jsonb_build_object(
    'status', 'ok',
    'snapshot', public.route_sanitize_snapshot_for_share(v_ws.id, v_ws.state_snapshot, v_ws.head_seq, v_radius),
    'hideRadiusM', v_radius
  );
END;
$$;

-- Vue assainie pour un membre external_viewer (authentifié) : même résultat que le lien de partage,
-- rayon de la zone privée repris du lien s'il existe (sinon 500 m). Les autres rôles lisent les tables.
CREATE OR REPLACE FUNCTION public.get_route_external_view_tx(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_radius NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
  END IF;

  SELECT * INTO v_ws FROM public.route_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND OR public.route_workspace_effective_role(p_workspace_id, v_uid) IS DISTINCT FROM 'external_viewer' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_radius := GREATEST(COALESCE(public.route_jf(v_ws.state_snapshot -> 'shareLink' -> 'hidePrivateStartRadiusM'), 500), 200);

  RETURN jsonb_build_object(
    'status', 'ok',
    'snapshot', public.route_sanitize_snapshot_for_share(v_ws.id, v_ws.state_snapshot, v_ws.head_seq, v_radius),
    'hideRadiusM', v_radius
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. RLS strict sur toutes les nouvelles tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.route_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departure_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_pack_states ENABLE ROW LEVEL SECURITY;

-- Aucune policy INSERT / UPDATE / DELETE directe sur les tables route_* : toute écriture passe par les RPC
-- SECURITY DEFINER (create_route_workspace_tx exige notamment le droit d'édition du voyage rattaché).
-- Les policies SELECT s'écrivent `col IN (SELECT readable_route_workspace_ids())` : sous-requête non
-- corrélée évaluée une fois par requête (et non une fois par ligne). external_viewer est exclu : il
-- ne lit que la vue assainie (get_route_external_view_tx).
DROP POLICY IF EXISTS route_workspaces_member_read ON public.route_workspaces;
CREATE POLICY route_workspaces_member_read ON public.route_workspaces
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_ws_members_read ON public.route_workspace_members;
CREATE POLICY route_ws_members_read ON public.route_workspace_members
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_points_member_read ON public.route_points;
CREATE POLICY route_points_member_read ON public.route_points
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_sections_member_read ON public.route_sections;
CREATE POLICY route_sections_member_read ON public.route_sections
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_stages_member_read ON public.route_stages;
CREATE POLICY route_stages_member_read ON public.route_stages
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_operations_member_read ON public.route_operations;
CREATE POLICY route_operations_member_read ON public.route_operations
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_revisions_member_read ON public.route_revisions;
CREATE POLICY route_revisions_member_read ON public.route_revisions
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_proposals_member_read ON public.route_proposals;
CREATE POLICY route_proposals_member_read ON public.route_proposals
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS route_comments_member_read ON public.route_comments;
CREATE POLICY route_comments_member_read ON public.route_comments
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS departure_packs_member_read ON public.departure_packs;
CREATE POLICY departure_packs_member_read ON public.departure_packs
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.readable_route_workspace_ids()));

DROP POLICY IF EXISTS participant_pack_states_own_or_owner ON public.participant_pack_states;
DROP POLICY IF EXISTS participant_pack_states_own_read ON public.participant_pack_states;
CREATE POLICY participant_pack_states_own_read ON public.participant_pack_states
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Privilèges de table : les privilèges par défaut de Supabase donnent ALL à anon et authenticated.
-- share_token_hash (empreinte du jeton de partage) ne doit être lisible par AUCUN client : un REVOKE de
-- colonne seul est sans effet tant que le privilège SELECT de table subsiste. On retire donc le SELECT de
-- table à `authenticated` et on le rend colonne par colonne, SANS share_token_hash (lu uniquement par les
-- fonctions SECURITY DEFINER). Conséquence documentée : `select('*')` sur route_workspaces échoue pour un
-- client (permission denied) ; le store liste ses colonnes. Toute colonne ajoutée plus tard devra être
-- accordée explicitement (refus par défaut).
-- Aucune écriture directe (la RLS la bloquerait déjà faute de policy) et rien pour anon.
REVOKE ALL ON TABLE
  public.route_workspaces, public.route_workspace_members, public.route_points, public.route_sections,
  public.route_stages, public.route_operations, public.route_revisions, public.route_proposals,
  public.route_comments, public.departure_packs, public.participant_pack_states
  FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.route_workspaces, public.route_workspace_members, public.route_points, public.route_sections,
  public.route_stages, public.route_operations, public.route_revisions, public.route_proposals,
  public.route_comments, public.departure_packs, public.participant_pack_states
  FROM authenticated;

REVOKE SELECT ON TABLE public.route_workspaces FROM authenticated;
GRANT SELECT (
  id, trip_id, created_by, title, status, sport, routing_options, head_seq, reviewed_seq,
  published_revision_id, published_revision_no, source_origin, share_expires_at, share_revoked_at,
  state_snapshot, state_version, created_at, updated_at
) ON public.route_workspaces TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. Droits d'exécution : jamais PUBLIC ni anon (sauf lecture par lien de partage), authenticated seulement.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.can_read_route_workspace(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_route_workspace(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.readable_route_workspace_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.readable_route_workspace_ids() TO authenticated;

-- Fonctions internes, appelées uniquement par les fonctions SECURITY DEFINER ci-dessus.
REVOKE ALL ON FUNCTION public.route_workspace_effective_role(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_merge_snapshot_keys(JSONB, JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_jf(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_jtext(JSONB, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_jnum(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_part_ok(JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_snapshot_within_caps(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_topic_workspace_id(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.route_topic_workspace_id(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.route_sorted_by_id(JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_sanitize_snapshot_for_share(UUID, JSONB, BIGINT, NUMERIC) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_route_workspace_tx(UUID, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_route_workspace_tx(UUID, TEXT, TEXT, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_route_operation_tx(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_route_operation_tx(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_route_revision_tx(UUID, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_route_revision_tx(UUID, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.write_route_workspace_part_tx(UUID, TEXT, JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_route_workspace_part_tx(UUID, TEXT, JSONB, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.manage_route_share_link_tx(UUID, TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_route_share_link_tx(UUID, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_route_external_view_tx(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_route_external_view_tx(UUID) TO authenticated;

-- Lecture publique par lien de partage : seule RPC ouverte à anon (jeton secret, voir commentaire de la fonction).
REVOKE ALL ON FUNCTION public.get_shared_route_workspace_tx(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_route_workspace_tx(UUID, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Temps réel privé (Supabase Realtime Authorization) : canaux privés « route:<uuid> »
--   Un canal privé (client : `supabase.channel('route:<uuid>', { config: { private: true } })`) n'est ouvert
--   que si les policies de realtime.messages l'autorisent. Lecture (SELECT : réception des diffusions et de
--   la présence) et écriture (INSERT : envoi, présence) exigent le topic `route:<uuid>` ET le droit de lecture
--   complète de l'espace (can_read_route_workspace : un external_viewer, un membre retiré du voyage ou une
--   personne étrangère sont refusés). Un topic mal formé donne NULL (route_topic_workspace_id), donc un refus
--   sans exception. Bloc gardé : sans schéma `realtime` (Postgres local nu), la migration reste applicable.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL AND to_regprocedure('realtime.topic()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS route_realtime_read ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY route_realtime_read ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          (SELECT realtime.topic()) LIKE 'route:%'
          AND realtime.messages.extension IN ('broadcast', 'presence')
          AND public.can_read_route_workspace(public.route_topic_workspace_id((SELECT realtime.topic())))
        )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS route_realtime_write ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY route_realtime_write ON realtime.messages
        FOR INSERT TO authenticated
        WITH CHECK (
          (SELECT realtime.topic()) LIKE 'route:%'
          AND realtime.messages.extension IN ('broadcast', 'presence')
          AND public.can_read_route_workspace(public.route_topic_workspace_id((SELECT realtime.topic())))
        )
    $p$;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Sorties (hike_sessions) : colonnes de liaison lisibles par les clients, vue participant
--   Les clients lisent hike_sessions colonne par colonne (privilèges accordés à `authenticated` sans les points
--   GPS bruts) et la ligne complète via la vue hike_sessions_participant (SECURITY DEFINER, filtre
--   propriétaire / carnet / présence). Les trois colonnes ajoutées plus haut sont donc :
--     (1) accordées colonne par colonne SI les privilèges le sont déjà ainsi (sinon le SELECT de table les couvre) ;
--     (2) ajoutées EN FIN de la vue participant, dont la définition existante est reprise À L'IDENTIQUE (mêmes
--         colonnes dans le même ordre, mêmes filtres, security_invoker = false) : la liste de colonnes est lue sur
--         la vue en place, jamais réécrite à la main (une vue `select hs.*` fige ses colonnes à sa création).
--   Risque : une sortie d'un carnet public expose route_workspace_id, route_revision_id et kit_snapshot aux
--   personnes connectées (lecture colonne, lignes déjà ouvertes par la policy « carnet public »).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cols TEXT;
BEGIN
  IF to_regclass('public.hike_sessions') IS NOT NULL
     AND NOT has_table_privilege('authenticated', 'public.hike_sessions', 'SELECT')
     AND has_any_column_privilege('authenticated', 'public.hike_sessions', 'SELECT') THEN
    GRANT SELECT (route_workspace_id, route_revision_id, kit_snapshot) ON public.hike_sessions TO authenticated;
  END IF;

  IF to_regclass('public.hike_sessions_participant') IS NOT NULL
     AND to_regclass('public.hike_session_participants') IS NOT NULL
     AND to_regprocedure('public.is_carnet_participant(uuid)') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                     WHERE a.attrelid = 'public.hike_sessions_participant'::regclass
                       AND a.attname = 'route_workspace_id' AND NOT a.attisdropped) THEN
    SELECT string_agg(format('hs.%I', a.attname), ', ' ORDER BY a.attnum) INTO v_cols
    FROM pg_attribute a
    WHERE a.attrelid = 'public.hike_sessions_participant'::regclass AND a.attnum > 0 AND NOT a.attisdropped;

    EXECUTE format($v$
      CREATE OR REPLACE VIEW public.hike_sessions_participant
      WITH (security_invoker = false) AS
      SELECT %s, hs.route_workspace_id, hs.route_revision_id, hs.kit_snapshot
      FROM public.hike_sessions hs
      WHERE hs.user_id = (SELECT auth.uid())
         OR (hs.carnet_id IS NOT NULL AND public.is_carnet_participant(hs.carnet_id))
         OR EXISTS (
           SELECT 1
           FROM public.hike_session_participants p
           WHERE p.session_id = hs.id
             AND p.user_id = (SELECT auth.uid())
         )
    $v$, v_cols);
  END IF;
END;
$$;
