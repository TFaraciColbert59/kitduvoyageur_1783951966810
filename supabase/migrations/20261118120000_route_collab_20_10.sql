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

-- Nombre JSON => double precision, sinon NULL (aucune erreur de cast sur un type inattendu).
CREATE OR REPLACE FUNCTION public.route_jf(p_value JSONB)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'number' THEN (p_value #>> '{}')::double precision END;
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

-- Distance haversine en mètres (sphère de 6 371 km) : aucune dépendance PostGIS.
CREATE OR REPLACE FUNCTION public.route_haversine_m(
  p_lat1 DOUBLE PRECISION, p_lon1 DOUBLE PRECISION, p_lat2 DOUBLE PRECISION, p_lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
  )));
$$;

-- Vrai si (lat, lon) est dans le rayon d'au moins un des centres privés.
CREATE OR REPLACE FUNCTION public.route_point_in_zone(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_center_lats DOUBLE PRECISION[],
  p_center_lons DOUBLE PRECISION[],
  p_radius_m DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM generate_subscripts(p_center_lats, 1) AS i
    WHERE public.route_haversine_m(p_center_lats[i], p_center_lons[i], p_lat, p_lon) <= p_radius_m
  );
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
--   (collaborateur du voyage sans ligne de membre) | NULL (aucun droit ou révoqué).
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
    SELECT m.workspace_id FROM public.route_workspace_members m
    WHERE m.user_id = (SELECT auth.uid()) AND m.revoked_at IS NULL
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

-- ----------------------------------------------------------------------------
-- 4. Assainissement RGPD d'un snapshot pour un lecteur externe (lien de partage ou external_viewer)
--   Aligné sur src/features/route-collab/shareSanitize.ts (défense en profondeur côté Next).
--   * liste blanche de clés à chaque niveau ; jamais tripId, provenance, sourceId/sourceUrl,
--     originalGpxXml, notes, observations d'eau, dangers, lieux de nuit (lat/lon), userId ;
--   * zone de départ privée (et d'arrivée si boucle) : points du rayon retirés, départ/arrivée
--     déplacés au premier/dernier point du tracé hors du rayon, coordonnées de géométrie du rayon
--     retirées ; sans aucune coordonnée hors du rayon, départ/arrivée ne sont pas montrés ;
--   * rayon minimal 200 m ; haversine plpgsql (pas de PostGIS requis).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.route_sanitize_snapshot_for_share(
  p_workspace_id UUID,
  p_snapshot JSONB,
  p_head_seq BIGINT,
  p_radius_m NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_radius DOUBLE PRECISION := GREATEST(COALESCE(p_radius_m, 500), 200)::double precision;
  v_src JSONB := COALESCE(p_snapshot, '{}'::jsonb);
  v_raw_points JSONB := CASE WHEN jsonb_typeof(v_src -> 'points') = 'array' THEN v_src -> 'points' ELSE '[]'::jsonb END;
  v_raw_sections JSONB := CASE WHEN jsonb_typeof(v_src -> 'sections') = 'array' THEN v_src -> 'sections' ELSE '[]'::jsonb END;
  v_raw_stages JSONB := CASE WHEN jsonb_typeof(v_src -> 'stages') = 'array' THEN v_src -> 'stages' ELSE '[]'::jsonb END;
  v_raw_members JSONB := CASE WHEN jsonb_typeof(v_src -> 'members') = 'array' THEN v_src -> 'members' ELSE '[]'::jsonb END;
  v_origin JSONB := CASE WHEN jsonb_typeof(v_src -> 'sourceOrigin') = 'object' THEN v_src -> 'sourceOrigin' ELSE '{}'::jsonb END;
  v_options JSONB := CASE WHEN jsonb_typeof(v_src -> 'routingOptions') = 'object' THEN v_src -> 'routingOptions' ELSE '{}'::jsonb END;
  v_pts JSONB[];
  v_n INTEGER;
  v_start INTEGER;
  v_clat DOUBLE PRECISION[] := '{}';
  v_clon DOUBLE PRECISION[] := '{}';
  v_first_lon DOUBLE PRECISION;
  v_first_lat DOUBLE PRECISION;
  v_last_lon DOUBLE PRECISION;
  v_last_lat DOUBLE PRECISION;
  v_out_points JSONB := '[]'::jsonb;
  v_out_sections JSONB := '[]'::jsonb;
  v_out_stages JSONB;
  v_out_members JSONB;
  v_kept_ids TEXT[] := '{}';
  e JSONB;
  s JSONB;
  i INTEGER;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_kind TEXT;
  v_use_last BOOLEAN;
  v_anchor_lat DOUBLE PRECISION;
  v_anchor_lon DOUBLE PRECISION;
  v_coords JSONB;
  v_total INTEGER;
  v_kept INTEGER;
  v_kept_coords JSONB;
BEGIN
  -- Points actifs, valides, triés par orderKey puis id (collation C = comparaison de chaînes du moteur).
  SELECT COALESCE(array_agg(t.e ORDER BY (t.e ->> 'orderKey') COLLATE "C", (t.e ->> 'id') COLLATE "C"), '{}')
  INTO v_pts
  FROM jsonb_array_elements(v_raw_points) AS t(e)
  WHERE jsonb_typeof(t.e) = 'object'
    AND jsonb_typeof(t.e -> 'id') = 'string'
    AND COALESCE(t.e ->> 'deletedAt', '') = ''
    AND public.route_jf(t.e -> 'lat') BETWEEN -90 AND 90
    AND public.route_jf(t.e -> 'lon') BETWEEN -180 AND 180;

  v_n := COALESCE(array_length(v_pts, 1), 0);

  IF v_n > 0 THEN
    v_start := 1;
    FOR i IN 1..v_n LOOP
      IF v_pts[i] ->> 'kind' = 'start' THEN
        v_start := i;
        EXIT;
      END IF;
    END LOOP;
    v_clat := v_clat || public.route_jf(v_pts[v_start] -> 'lat');
    v_clon := v_clon || public.route_jf(v_pts[v_start] -> 'lon');
    -- Boucle : l'arrivée est aussi un lieu privé.
    IF v_src ->> 'shapeMode' = 'loop' AND v_n >= 2 THEN
      v_clat := v_clat || public.route_jf(v_pts[v_n] -> 'lat');
      v_clon := v_clon || public.route_jf(v_pts[v_n] -> 'lon');
    END IF;
  END IF;

  -- Premier et dernier point du tracé hors de la zone privée (tronçons pris par point de départ).
  WITH pts AS (
    SELECT t.e ->> 'id' AS pid, t.ord
    FROM unnest(v_pts) WITH ORDINALITY AS t(e, ord)
  ), secs AS (
    SELECT DISTINCT ON (t.e ->> 'fromPointId') t.e AS sec, t.e ->> 'fromPointId' AS fid
    FROM jsonb_array_elements(v_raw_sections) WITH ORDINALITY AS t(e, o)
    WHERE jsonb_typeof(t.e) = 'object'
    ORDER BY (t.e ->> 'fromPointId'), t.o DESC
  ), coords AS (
    SELECT pts.ord AS pord, c.o AS cord,
           public.route_jf(c.v -> 0) AS lon, public.route_jf(c.v -> 1) AS lat
    FROM pts
    JOIN secs ON secs.fid = pts.pid
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(secs.sec -> 'geometry' -> 'coordinates') = 'array'
           THEN secs.sec -> 'geometry' -> 'coordinates' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS c(v, o)
    WHERE jsonb_typeof(c.v) = 'array'
  ), outs AS (
    SELECT * FROM coords
    WHERE lon IS NOT NULL AND lat IS NOT NULL
      AND NOT public.route_point_in_zone(lat, lon, v_clat, v_clon, v_radius)
  )
  SELECT (SELECT o.lon FROM outs o ORDER BY o.pord, o.cord LIMIT 1),
         (SELECT o.lat FROM outs o ORDER BY o.pord, o.cord LIMIT 1),
         (SELECT o.lon FROM outs o ORDER BY o.pord DESC, o.cord DESC LIMIT 1),
         (SELECT o.lat FROM outs o ORDER BY o.pord DESC, o.cord DESC LIMIT 1)
  INTO v_first_lon, v_first_lat, v_last_lon, v_last_lat;

  -- Points : hors zone => conservés (note retirée) ; dans la zone => seuls départ/arrivée subsistent,
  -- déplacés hors du rayon ; sans coordonnée hors du rayon, ils ne sont pas montrés.
  IF v_n > 0 THEN
    FOR i IN 1..v_n LOOP
      e := v_pts[i];
      v_lat := public.route_jf(e -> 'lat');
      v_lon := public.route_jf(e -> 'lon');
      v_kind := e ->> 'kind';

      IF NOT public.route_point_in_zone(v_lat, v_lon, v_clat, v_clon, v_radius) THEN
        v_out_points := v_out_points || jsonb_build_array(jsonb_build_object(
          'id', public.route_jtext(e, 'id', 80),
          'workspaceId', to_jsonb(p_workspace_id::text),
          'kind', public.route_jtext(e, 'kind', 24),
          'orderKey', public.route_jtext(e, 'orderKey', 40),
          'lat', e -> 'lat',
          'lon', e -> 'lon',
          'eleM', public.route_jnum(e, 'eleM'),
          'name', public.route_jtext(e, 'name', 200),
          'semanticKind', public.route_jtext(e, 'semanticKind', 40),
          'note', 'null'::jsonb,
          'entityVersion', public.route_jnum(e, 'entityVersion')
        ));
        v_kept_ids := v_kept_ids || (e ->> 'id');
      ELSIF v_kind IN ('start', 'finish') OR i = 1 OR i = v_n THEN
        v_use_last := v_kind = 'finish' OR (i = v_n AND i <> 1);
        v_anchor_lat := CASE WHEN v_use_last THEN v_last_lat ELSE v_first_lat END;
        v_anchor_lon := CASE WHEN v_use_last THEN v_last_lon ELSE v_first_lon END;
        IF v_anchor_lat IS NOT NULL AND v_anchor_lon IS NOT NULL THEN
          v_out_points := v_out_points || jsonb_build_array(jsonb_build_object(
            'id', public.route_jtext(e, 'id', 80),
            'workspaceId', to_jsonb(p_workspace_id::text),
            'kind', public.route_jtext(e, 'kind', 24),
            'orderKey', public.route_jtext(e, 'orderKey', 40),
            'lat', to_jsonb(v_anchor_lat),
            'lon', to_jsonb(v_anchor_lon),
            'eleM', 'null'::jsonb,
            'name', to_jsonb(CASE WHEN v_kind = 'start' OR (i = 1 AND v_kind <> 'finish')
                                  THEN 'Départ (zone privée masquée)'
                                  ELSE 'Arrivée (zone privée masquée)' END),
            'note', 'null'::jsonb,
            'entityVersion', public.route_jnum(e, 'entityVersion'),
            'masked', 'true'::jsonb
          ));
          v_kept_ids := v_kept_ids || (e ->> 'id');
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Tronçons entre deux points conservés ; coordonnées de la zone privée retirées.
  FOR s IN
    SELECT t.e FROM jsonb_array_elements(v_raw_sections) AS t(e) WHERE jsonb_typeof(t.e) = 'object'
  LOOP
    CONTINUE WHEN NOT ((s ->> 'fromPointId') = ANY (v_kept_ids) AND (s ->> 'toPointId') = ANY (v_kept_ids));

    v_coords := CASE WHEN jsonb_typeof(s -> 'geometry' -> 'coordinates') = 'array'
                     THEN s -> 'geometry' -> 'coordinates' ELSE '[]'::jsonb END;

    SELECT count(*), count(*) FILTER (WHERE c.ok),
           COALESCE(jsonb_agg(jsonb_build_array(c.v -> 0, c.v -> 1) ORDER BY c.o) FILTER (WHERE c.ok), '[]'::jsonb)
    INTO v_total, v_kept, v_kept_coords
    FROM (
      SELECT t.v, t.o,
             CASE WHEN jsonb_typeof(t.v) = 'array'
                       AND public.route_jf(t.v -> 0) IS NOT NULL AND public.route_jf(t.v -> 1) IS NOT NULL
                  THEN NOT public.route_point_in_zone(public.route_jf(t.v -> 1), public.route_jf(t.v -> 0), v_clat, v_clon, v_radius)
                  ELSE false END AS ok
      FROM jsonb_array_elements(v_coords) WITH ORDINALITY AS t(v, o)
    ) AS c;

    v_out_sections := v_out_sections || jsonb_build_array(jsonb_build_object(
      'id', public.route_jtext(s, 'id', 80),
      'workspaceId', to_jsonb(p_workspace_id::text),
      'fromPointId', s -> 'fromPointId',
      'toPointId', s -> 'toPointId',
      'mode', public.route_jtext(s, 'mode', 24),
      'geometry', jsonb_build_object('type', 'LineString', 'coordinates', v_kept_coords),
      'distanceKm', public.route_jnum(s, 'distanceKm'),
      'durationMin', public.route_jnum(s, 'durationMin'),
      'ascentM', public.route_jnum(s, 'ascentM'),
      'descentM', public.route_jnum(s, 'descentM'),
      'surfaceSegments', CASE WHEN jsonb_typeof(s -> 'surfaceSegments') = 'array'
                              THEN s -> 'surfaceSegments' ELSE '[]'::jsonb END,
      'warnings', '[]'::jsonb,
      'entityVersion', public.route_jnum(s, 'entityVersion')
    ) || CASE
           -- Les altitudes ne sont gardées que si aucune coordonnée n'a été retirée (sinon désalignées).
           WHEN v_total = v_kept AND jsonb_typeof(s -> 'elevationSamples') = 'array'
           THEN jsonb_build_object('elevationSamples', s -> 'elevationSamples')
           ELSE '{}'::jsonb
         END);
  END LOOP;

  -- Étapes réduites : identité, jour, titre, date, distance éventuelle, ids de points conservés.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', public.route_jtext(t.e, 'id', 80),
           'workspaceId', to_jsonb(p_workspace_id::text),
           'orderKey', public.route_jtext(t.e, 'orderKey', 40),
           'dayNumber', public.route_jnum(t.e, 'dayNumber'),
           'kind', public.route_jtext(t.e, 'kind', 16),
           'title', public.route_jtext(t.e, 'title', 160),
           'dateIso', public.route_jtext(t.e, 'dateIso', 32),
           'distanceKm', public.route_jnum(t.e, 'distanceKm'),
           'startPointId', CASE WHEN (t.e ->> 'startPointId') = ANY (v_kept_ids) THEN t.e -> 'startPointId' ELSE 'null'::jsonb END,
           'endPointId', CASE WHEN (t.e ->> 'endPointId') = ANY (v_kept_ids) THEN t.e -> 'endPointId' ELSE 'null'::jsonb END
         ) ORDER BY t.ord), '[]'::jsonb)
  INTO v_out_stages
  FROM jsonb_array_elements(v_raw_stages) WITH ORDINALITY AS t(e, ord)
  WHERE jsonb_typeof(t.e) = 'object';

  -- Membres : nom affiché et rôle uniquement (jamais d'identifiant), non révoqués.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'displayName', public.route_jtext(t.e, 'displayName', 120),
           'role', public.route_jtext(t.e, 'role', 24)
         ) ORDER BY t.ord), '[]'::jsonb)
  INTO v_out_members
  FROM jsonb_array_elements(v_raw_members) WITH ORDINALITY AS t(e, ord)
  WHERE jsonb_typeof(t.e) = 'object' AND COALESCE(t.e ->> 'revokedAt', '') = '';

  RETURN jsonb_build_object(
    'id', to_jsonb(p_workspace_id::text),
    'title', public.route_jtext(v_src, 'title', 160),
    'status', public.route_jtext(v_src, 'status', 16),
    'sport', public.route_jtext(v_src, 'sport', 40),
    'shapeMode', public.route_jtext(v_src, 'shapeMode', 16),
    'routingOptions', jsonb_strip_nulls(jsonb_build_object(
      'ebike', CASE WHEN jsonb_typeof(v_options -> 'ebike') = 'boolean' THEN v_options -> 'ebike' END,
      'avoidSteps', CASE WHEN jsonb_typeof(v_options -> 'avoidSteps') = 'boolean' THEN v_options -> 'avoidSteps' END,
      'avoidFerries', CASE WHEN jsonb_typeof(v_options -> 'avoidFerries') = 'boolean' THEN v_options -> 'avoidFerries' END,
      'surfacePref', CASE WHEN jsonb_typeof(v_options -> 'surfacePref') = 'string'
                          THEN to_jsonb(left(v_options ->> 'surfacePref', 24)) END
    )),
    'headSeq', to_jsonb(COALESCE(p_head_seq, 0)),
    'reviewedSeq', public.route_jnum(v_src, 'reviewedSeq'),
    'publishedRevisionNo', public.route_jnum(v_src, 'publishedRevisionNo'),
    'sourceOrigin', jsonb_build_object(
      'kind', public.route_jtext(v_origin, 'kind', 24),
      'sourceTitle', public.route_jtext(v_origin, 'sourceTitle', 160),
      'importedAt', public.route_jtext(v_origin, 'importedAt', 40),
      'attribution', public.route_jtext(v_origin, 'attribution', 300)
    ),
    'shareLink', 'null'::jsonb,
    'points', v_out_points,
    'sections', v_out_sections,
    'stages', v_out_stages,
    'variants', '[]'::jsonb,
    'proposals', '[]'::jsonb,
    'comments', '[]'::jsonb,
    'kitItems', '[]'::jsonb,
    'members', v_out_members,
    'revisions', '[]'::jsonb,
    'packs', '[]'::jsonb,
    'participantPacks', '[]'::jsonb,
    'updatedAt', public.route_jtext(v_src, 'updatedAt', 40)
  );
END;
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

  v_snapshot := p_snapshot || jsonb_build_object(
    'id', v_id,
    'tripId', COALESCE(p_trip_id::text, p_snapshot ->> 'tripId'),
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
--                       2 Mo pour import_track).
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
CREATE OR REPLACE FUNCTION public.set_route_member_tx(
  p_workspace_id UUID,
  p_user_id UUID,
  p_role TEXT,
  p_revoke BOOLEAN,
  p_delegated_publish BOOLEAN,
  p_display_name TEXT DEFAULT NULL
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

  INSERT INTO public.route_workspace_members (workspace_id, user_id, role, delegated_publish, revoked_at)
  VALUES (p_workspace_id, p_user_id, v_new_role, v_new_delegated, CASE WHEN v_revoke THEN now() ELSE NULL END)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        delegated_publish = EXCLUDED.delegated_publish,
        revoked_at = EXCLUDED.revoked_at,
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
--   'revoke' : marque le lien révoqué.
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
REVOKE ALL ON FUNCTION public.route_haversine_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_point_in_zone(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION[], DOUBLE PRECISION[], DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
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

REVOKE ALL ON FUNCTION public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.manage_route_share_link_tx(UUID, TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_route_share_link_tx(UUID, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_route_external_view_tx(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_route_external_view_tx(UUID) TO authenticated;

-- Lecture publique par lien de partage : seule RPC ouverte à anon (jeton secret, voir commentaire de la fonction).
REVOKE ALL ON FUNCTION public.get_shared_route_workspace_tx(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_route_workspace_tx(UUID, TEXT) TO anon, authenticated;
