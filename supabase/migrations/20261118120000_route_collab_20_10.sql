-- Migration additive LKDV · Créateur d'itinéraires collaboratif « 20/10 »
-- Compatible avec les voyages, activités et carnets existants (`trips`, `trip_collaborators`,
-- `trip_invitations`, `hiking_routes`, `hike_sessions`, `club_events`, `carnets`).
-- Stratégie de retour arrière : supabase/migrations_down/20261118120000_route_collab_20_10.down.sql
-- (supprime uniquement les nouvelles fonctions, policies, tables et colonnes nullable ajoutées).

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
  share_token TEXT UNIQUE,
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

CREATE TABLE IF NOT EXISTS public.route_points (
  id TEXT PRIMARY KEY,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_points_workspace ON public.route_points(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_route_points_geom ON public.route_points USING GIST(geom);

CREATE TABLE IF NOT EXISTS public.route_sections (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  from_point_id TEXT NOT NULL REFERENCES public.route_points(id) ON DELETE CASCADE,
  to_point_id TEXT NOT NULL REFERENCES public.route_points(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_sections_workspace ON public.route_sections(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_route_sections_geom ON public.route_sections USING GIST(geom);

CREATE TABLE IF NOT EXISTS public.route_stages (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  order_key TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  title TEXT NOT NULL,
  date_iso DATE,
  departure_time_local TEXT NOT NULL DEFAULT '08:30',
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  start_point_id TEXT REFERENCES public.route_points(id) ON DELETE SET NULL,
  end_point_id TEXT REFERENCES public.route_points(id) ON DELETE SET NULL,
  overnight_place JSONB,
  notes TEXT NOT NULL DEFAULT '',
  water_observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  weather_slice JSONB,
  hazards JSONB NOT NULL DEFAULT '[]'::jsonb,
  entity_version BIGINT NOT NULL DEFAULT 1 CHECK (entity_version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  payload_hash TEXT NOT NULL,
  entity_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, seq),
  UNIQUE (workspace_id, op_id)
);

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

CREATE TABLE IF NOT EXISTS public.departure_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  revision_id UUID NOT NULL REFERENCES public.route_revisions(id) ON DELETE CASCADE,
  revision_no BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  manifest JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.participant_pack_states (
  pack_id UUID NOT NULL REFERENCES public.departure_packs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prepared_revision_no BIGINT,
  downloaded_revision_no BIGINT,
  status TEXT NOT NULL DEFAULT 'not_downloaded' CHECK (status IN ('not_downloaded', 'downloading', 'ready', 'outdated', 'failed')),
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (pack_id, user_id)
);

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
--     ci-dessous, qui revérifient le droit en base. Aucune policy INSERT/UPDATE/DELETE directe.
--   * state_version : jeton de concurrence optimiste incrémenté à chaque écriture du snapshot.
--     Les RPC acceptent p_expected_version : si la version lue par le serveur a changé, la RPC
--     répond {status:'conflict'} et le serveur relit puis recalcule (aucune mise à jour perdue).
--   * Les RPC de modification du tracé et de publication ne fusionnent QUE leurs clés propres
--     dans le snapshot (route_merge_snapshot_keys) : un appel direct à la RPC ne peut pas
--     réécrire members, shareLink, revisions…
--   * LIMITE CONNUE : write_route_workspace_part_tx remplace en bloc la liste comments / proposals /
--     kitItems / participantPacks / notifications. Tout membre autorisé (hors external_viewer) peut
--     donc, en appelant la RPC directement, réécrire toute la liste (ex. les commentaires d'autrui).
--     Le contrôle fin par rôle est fait côté serveur Next uniquement. À normaliser plus tard dans
--     route_comments / route_proposals avec des RPC par entité.
-- ============================================================================

-- Fonction d'aide sécurité : vérifie si auth.uid() a accès en lecture à un workspace.
CREATE OR REPLACE FUNCTION public.can_read_route_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.route_workspaces rw
    WHERE rw.id = p_workspace_id
      AND (
        rw.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.route_workspace_members rwm
          WHERE rwm.workspace_id = rw.id
            AND rwm.user_id = (SELECT auth.uid())
            AND rwm.revoked_at IS NULL
        )
        OR (
          rw.trip_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = rw.trip_id
              AND tc.user_id = (SELECT auth.uid())
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.route_workspace_members rwm_rev
            WHERE rwm_rev.workspace_id = rw.id
              AND rwm_rev.user_id = (SELECT auth.uid())
              AND rwm_rev.revoked_at IS NOT NULL
          )
        )
      )
  );
$$;

-- Rôle effectif d'un utilisateur sur un workspace (usage interne des RPC, non appelable par les clients).
-- Retourne : owner (créateur, jamais révocable) | rôle de route_workspace_members (non révoqué) |
-- trip_editor / trip_viewer (collaborateur du voyage sans ligne de membre) | NULL (aucun droit ou révoqué).
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
  v_trip_role TEXT;
BEGIN
  IF p_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_ws FROM public.route_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_ws.created_by = p_uid THEN
    RETURN 'owner';
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

  IF v_ws.trip_id IS NOT NULL THEN
    SELECT tc.role::text INTO v_trip_role
    FROM public.trip_collaborators tc
    WHERE tc.trip_id = v_ws.trip_id AND tc.user_id = p_uid;
    IF FOUND THEN
      IF v_trip_role IN ('owner', 'editor') THEN
        RETURN 'trip_editor';
      END IF;
      RETURN 'trip_viewer';
    END IF;
  END IF;

  RETURN NULL;
END;
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
-- Vérifie droits + idempotence (op_id / payload_hash) + séquence monotone + concurrence optimiste.
--   p_base_seq        : head_seq lu par le serveur avant de calculer p_next_snapshot (pas la vue du client).
--                       S'il a changé => {status:'conflict', reason:'head_moved'} (le serveur relit et recalcule).
--   p_expected_version: state_version lue par le serveur (idem, reason 'state_version_moved').
--   p_next_snapshot   : seules les clés propres aux opérations sont fusionnées dans le snapshot stocké.
-- Rôles autorisés : owner / co_organizer / editor, ou collaborateur owner/editor du voyage sans ligne de membre.
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
  END IF;
  IF p_next_snapshot IS NULL OR jsonb_typeof(p_next_snapshot) <> 'object'
     OR p_payload IS NULL OR p_op_id IS NULL OR char_length(p_op_id) = 0 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_input');
  END IF;

  -- Verrou court sur la tête de route : ordonne écritures concurrentes et révocations.
  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Contrôle de permission métier en base (un participant ou un révoqué est refusé).
  v_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'co_organizer', 'editor', 'trip_editor') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'insufficient_permissions_or_revoked');
  END IF;

  -- Idempotence : même (workspace_id, op_id) avec même hash => already_applied ; hash différent => refus.
  SELECT * INTO v_existing
  FROM public.route_operations
  WHERE workspace_id = p_workspace_id AND op_id = p_op_id;

  IF FOUND THEN
    IF v_existing.payload_hash <> p_payload_hash THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'idempotency_payload_mismatch');
    END IF;
    RETURN jsonb_build_object('status', 'already_applied', 'seq', v_existing.seq);
  END IF;

  -- Concurrence optimiste : l'état calculé par le serveur doit partir de la tête actuelle.
  IF p_base_seq IS NULL OR p_base_seq <> v_ws.head_seq THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'head_moved', 'currentSeq', v_ws.head_seq);
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_ws.state_version THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'state_version_moved', 'currentSeq', v_ws.head_seq);
  END IF;

  v_next_seq := v_ws.head_seq + 1;

  INSERT INTO public.route_operations (
    workspace_id, seq, op_id, actor_id, base_seq, operation_type, payload, payload_hash, entity_versions
  ) VALUES (
    p_workspace_id, v_next_seq, p_op_id, v_uid, p_base_seq, p_operation_type, p_payload, p_payload_hash, COALESCE(p_entity_versions, '{}'::jsonb)
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

-- Publication transactionnelle immuable : vérifie expected_head_seq = head_seq et droit de publication
-- (owner, ou co_organizer avec delegated_publish), crée révision + pack et met à jour le snapshot
-- (clés de publication uniquement) dans la même transaction.
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
     OR p_snapshot IS NULL OR p_manifest IS NULL OR p_checksum IS NULL THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'invalid_input');
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
    WHERE rwm.workspace_id = p_workspace_id AND rwm.user_id = v_uid;
    v_can_publish := COALESCE(v_delegated, false);
  END IF;

  IF NOT v_can_publish THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'publish_permission_required');
  END IF;

  IF v_ws.head_seq <> p_expected_head_seq THEN
    RETURN jsonb_build_object(
      'status', 'blocked',
      'reason', 'head_changed_requires_review',
      'currentHeadSeq', v_ws.head_seq
    );
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version <> v_ws.state_version THEN
    RETURN jsonb_build_object('status', 'conflict', 'reason', 'state_version_moved', 'currentHeadSeq', v_ws.head_seq);
  END IF;

  v_next_rev_no := COALESCE(v_ws.published_revision_no, 0) + 1;

  INSERT INTO public.route_revisions (
    workspace_id, revision_no, parent_revision_id, based_on_seq, created_by, kind, summary, snapshot
  ) VALUES (
    p_workspace_id, v_next_rev_no, v_ws.published_revision_id, v_ws.head_seq, v_uid, 'published', COALESCE(p_summary, ''), p_snapshot
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
-- Tout membre non révoqué sauf external_viewer (et collaborateur du voyage) peut écrire ; toute autre clé est refusée.
-- Voir LIMITE CONNUE en tête de section : la liste est remplacée en bloc.
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
  IF length(p_value::text) > 1000000 THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'value_too_large');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_role := public.route_workspace_effective_role(p_workspace_id, v_uid);
  IF v_role IS NULL OR v_role = 'external_viewer' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'insufficient_permissions_or_revoked');
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version <> v_ws.state_version THEN
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

-- Gestion des membres : owner ou co_organizer. Un co_organizer ne peut ni nommer ni révoquer un owner,
-- ni modifier delegated_publish (réservé à l'owner). Le créateur de l'espace n'est jamais révocable.
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
  v_new_role TEXT;
  v_new_delegated BOOLEAN;
  v_revoke BOOLEAN := COALESCE(p_revoke, false);
  v_now_iso TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_name TEXT;
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

  v_target_role := CASE
    WHEN v_ws.created_by = p_user_id THEN 'owner'
    WHEN v_target_found THEN v_target.role
    ELSE NULL
  END;
  v_new_role := COALESCE(p_role, CASE WHEN v_target_found THEN v_target.role ELSE 'participant' END);
  v_new_delegated := COALESCE(p_delegated_publish, CASE WHEN v_target_found THEN v_target.delegated_publish ELSE false END);

  IF p_user_id = v_ws.created_by AND (v_revoke OR v_new_role <> 'owner') THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'creator_immutable');
  END IF;

  IF v_actor_role = 'co_organizer' THEN
    IF v_target_role = 'owner' OR v_new_role = 'owner' THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'owner_protected');
    END IF;
    IF v_new_delegated IS DISTINCT FROM (CASE WHEN v_target_found THEN v_target.delegated_publish ELSE false END) THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'delegated_publish_requires_owner');
    END IF;
  END IF;

  SELECT COALESCE(
           NULLIF(btrim(left(p_display_name, 120)), ''),
           NULLIF(btrim(left(u.raw_user_meta_data ->> 'full_name', 120)), ''),
           NULLIF(btrim(left(u.raw_user_meta_data ->> 'name', 120)), '')
         )
  INTO v_name
  FROM auth.users u
  WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'reason', 'user_not_found');
  END IF;

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
                         'displayName', COALESCE(NULLIF(btrim(left(p_display_name, 120)), ''), t.e ->> 'displayName', v_name, 'Voyageur ' || left(p_user_id::text, 6)),
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

-- Lien de partage lecture seule : owner ou co_organizer. 'create' enregistre le jeton généré côté serveur
-- (>= 32 caractères) ; 'revoke' marque le lien révoqué. Met à jour les colonnes share_* ET snapshot.shareLink.
CREATE OR REPLACE FUNCTION public.manage_route_share_link_tx(
  p_workspace_id UUID,
  p_action TEXT,
  p_token TEXT,
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
    IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_token');
    END IF;
    IF p_hide_radius_m IS NULL OR p_hide_radius_m < 0 OR p_hide_radius_m > 5000 THEN
      RETURN jsonb_build_object('status', 'denied', 'reason', 'invalid_radius');
    END IF;

    v_link := jsonb_build_object(
      'token', p_token,
      'audience', 'external_viewer',
      'expiresAt', CASE WHEN p_expires_at IS NULL THEN 'null'::jsonb
                        ELSE to_jsonb(to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
      'revokedAt', 'null'::jsonb,
      'hidePrivateStartRadiusM', p_hide_radius_m,
      'createdBy', v_uid,
      'createdAt', v_now_iso
    );

    UPDATE public.route_workspaces
    SET share_token = p_token,
        share_expires_at = p_expires_at,
        share_revoked_at = NULL,
        state_snapshot = jsonb_set(state_snapshot, '{shareLink}', v_link, true),
        state_version = state_version + 1,
        updated_at = now()
    WHERE id = p_workspace_id;
  ELSE
    v_link := CASE WHEN jsonb_typeof(v_ws.state_snapshot -> 'shareLink') = 'object'
                   THEN (v_ws.state_snapshot -> 'shareLink') || jsonb_build_object('revokedAt', v_now_iso)
                   ELSE NULL END;

    UPDATE public.route_workspaces
    SET share_revoked_at = CASE WHEN share_token IS NOT NULL THEN now() ELSE share_revoked_at END,
        state_snapshot = CASE WHEN v_link IS NOT NULL
                              THEN jsonb_set(state_snapshot, '{shareLink}', v_link, true)
                              ELSE state_snapshot END,
        state_version = state_version + 1,
        updated_at = now()
    WHERE id = p_workspace_id;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'shareLink', COALESCE(v_link, 'null'::jsonb));
END;
$$;

-- Lecture publique d'un itinéraire par lien de partage (le visiteur n'a pas de ligne RLS).
-- Seul un jeton exact, non révoqué et non expiré ouvre l'accès ; le snapshot renvoyé est assaini
-- (sans propositions, notifications, états de packs ni lien ; membres réduits à userId/displayName/role).
-- Seule RPC exécutable par `anon` : le jeton (>= 32 caractères aléatoires) fait office de secret.
CREATE OR REPLACE FUNCTION public.get_shared_route_workspace_tx(p_workspace_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws public.route_workspaces%ROWTYPE;
  v_members JSONB;
  v_snapshot JSONB;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id AND share_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_ws.share_revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;
  IF v_ws.share_expires_at IS NOT NULL AND v_ws.share_expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'userId', m ->> 'userId',
           'displayName', m ->> 'displayName',
           'role', m ->> 'role')), '[]'::jsonb)
  INTO v_members
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(v_ws.state_snapshot -> 'members') = 'array'
              THEN v_ws.state_snapshot -> 'members' ELSE '[]'::jsonb END) AS m
  WHERE COALESCE(m ->> 'revokedAt', '') = '';

  -- RGPD : ni versions/packs complets (coordonnées non masquées), ni commentaires, sac, variantes
  -- de travail ou XML GPX d'origine. Le masquage de la zone de départ privée (hideRadiusM) est
  -- appliqué ensuite par le serveur (sanitizeWorkspaceForShareLink).
  v_snapshot := (v_ws.state_snapshot - 'proposals' - 'notifications' - 'participantPacks' - 'shareLink'
                   - 'revisions' - 'packs' - 'comments' - 'kitItems' - 'variants')
    || jsonb_build_object('id', v_ws.id, 'headSeq', v_ws.head_seq, 'proposals', '[]'::jsonb,
                          'revisions', '[]'::jsonb, 'packs', '[]'::jsonb, 'comments', '[]'::jsonb,
                          'kitItems', '[]'::jsonb, 'variants', '[]'::jsonb, 'members', v_members);
  IF jsonb_typeof(v_snapshot -> 'sourceOrigin') = 'object' THEN
    v_snapshot := jsonb_set(v_snapshot, '{sourceOrigin}', (v_snapshot -> 'sourceOrigin') - 'originalGpxXml', true);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'snapshot', v_snapshot,
    'hideRadiusM', COALESCE((v_ws.state_snapshot -> 'shareLink' ->> 'hidePrivateStartRadiusM')::numeric, 500)
  );
END;
$$;

-- RLS strict sur toutes les nouvelles tables.
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

DROP POLICY IF EXISTS route_workspaces_member_read ON public.route_workspaces;
CREATE POLICY route_workspaces_member_read ON public.route_workspaces
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(id));

-- Aucune policy INSERT / UPDATE / DELETE directe sur les tables route_* : toute écriture passe par les RPC
-- SECURITY DEFINER (create_route_workspace_tx exige notamment le droit d'édition du voyage rattaché).

DROP POLICY IF EXISTS route_ws_members_read ON public.route_workspace_members;
CREATE POLICY route_ws_members_read ON public.route_workspace_members
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_points_member_read ON public.route_points;
CREATE POLICY route_points_member_read ON public.route_points
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_sections_member_read ON public.route_sections;
CREATE POLICY route_sections_member_read ON public.route_sections
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_stages_member_read ON public.route_stages;
CREATE POLICY route_stages_member_read ON public.route_stages
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_operations_member_read ON public.route_operations;
CREATE POLICY route_operations_member_read ON public.route_operations
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_revisions_member_read ON public.route_revisions;
CREATE POLICY route_revisions_member_read ON public.route_revisions
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_proposals_member_read ON public.route_proposals;
CREATE POLICY route_proposals_member_read ON public.route_proposals
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS route_comments_member_read ON public.route_comments;
CREATE POLICY route_comments_member_read ON public.route_comments
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS departure_packs_member_read ON public.departure_packs;
CREATE POLICY departure_packs_member_read ON public.departure_packs
  FOR SELECT TO authenticated
  USING (public.can_read_route_workspace(workspace_id));

DROP POLICY IF EXISTS participant_pack_states_own_or_owner ON public.participant_pack_states;
DROP POLICY IF EXISTS participant_pack_states_own_read ON public.participant_pack_states;
CREATE POLICY participant_pack_states_own_read ON public.participant_pack_states
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Droits d'exécution : jamais PUBLIC ni anon (sauf lecture par lien de partage), authenticated seulement.
REVOKE ALL ON FUNCTION public.can_read_route_workspace(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_route_workspace(UUID) TO authenticated;

-- Fonctions internes, appelées uniquement par les fonctions SECURITY DEFINER ci-dessus.
REVOKE ALL ON FUNCTION public.route_workspace_effective_role(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_merge_snapshot_keys(JSONB, JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;

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

REVOKE ALL ON FUNCTION public.manage_route_share_link_tx(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_route_share_link_tx(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

-- Lecture publique par lien de partage : seule RPC ouverte à anon (jeton secret, voir commentaire de la fonction).
REVOKE ALL ON FUNCTION public.get_shared_route_workspace_tx(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_route_workspace_tx(UUID, TEXT) TO anon, authenticated;
