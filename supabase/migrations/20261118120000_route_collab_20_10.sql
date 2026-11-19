-- Migration additive LKDV · Créateur d'itinéraires collaboratif « 20/10 »
-- Compatible avec les voyages, activités et carnets existants (`trips`, `trip_collaborators`,
-- `trip_invitations`, `hiking_routes`, `hike_sessions`, `club_events`, `carnets`).
-- Stratégie de retour arrière : supprimer uniquement les nouvelles tables/fonctions et colonnes nullable ajoutées.

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

-- Fonction transactionnelle courte (FOR UPDATE sur la tête de route) :
-- Vérifie droits + idempotence (op_id / payload_hash) + séquence monotone.
CREATE OR REPLACE FUNCTION public.apply_route_operation_tx(
  p_workspace_id UUID,
  p_op_id TEXT,
  p_base_seq BIGINT,
  p_operation_type TEXT,
  p_payload JSONB,
  p_payload_hash TEXT,
  p_entity_versions JSONB,
  p_next_snapshot JSONB
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
  v_can_edit BOOLEAN := false;
  v_next_seq BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'auth_required');
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
  SELECT (
    v_ws.created_by = v_uid
    OR EXISTS (
      SELECT 1 FROM public.route_workspace_members rwm
      WHERE rwm.workspace_id = p_workspace_id
        AND rwm.user_id = v_uid
        AND rwm.revoked_at IS NULL
        AND rwm.role IN ('owner', 'co_organizer', 'editor')
    )
    OR (
      v_ws.trip_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.trip_collaborators tc
        WHERE tc.trip_id = v_ws.trip_id
          AND tc.user_id = v_uid
          AND tc.role IN ('owner', 'editor')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.route_workspace_members rwm_rev
        WHERE rwm_rev.workspace_id = p_workspace_id
          AND rwm_rev.user_id = v_uid
          AND rwm_rev.revoked_at IS NOT NULL
      )
    )
  ) INTO v_can_edit;

  IF NOT v_can_edit THEN
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

  v_next_seq := v_ws.head_seq + 1;

  INSERT INTO public.route_operations (
    workspace_id, seq, op_id, actor_id, base_seq, operation_type, payload, payload_hash, entity_versions
  ) VALUES (
    p_workspace_id, v_next_seq, p_op_id, v_uid, p_base_seq, p_operation_type, p_payload, p_payload_hash, COALESCE(p_entity_versions, '{}'::jsonb)
  );

  UPDATE public.route_workspaces
  SET head_seq = v_next_seq,
      state_snapshot = p_next_snapshot,
      updated_at = now()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object('status', 'accepted', 'seq', v_next_seq);
END;
$$;

-- Publication transactionnelle immuable : vérifie expected_head_seq = head_seq et droit de publication.
CREATE OR REPLACE FUNCTION public.publish_route_revision_tx(
  p_workspace_id UUID,
  p_expected_head_seq BIGINT,
  p_summary TEXT,
  p_snapshot JSONB,
  p_checksum TEXT,
  p_manifest JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_ws public.route_workspaces%ROWTYPE;
  v_can_publish BOOLEAN := false;
  v_next_rev_no BIGINT;
  v_rev_id UUID;
  v_pack_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'auth_required');
  END IF;

  SELECT * INTO v_ws
  FROM public.route_workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT (
    v_ws.created_by = v_uid
    OR EXISTS (
      SELECT 1 FROM public.route_workspace_members rwm
      WHERE rwm.workspace_id = p_workspace_id
        AND rwm.user_id = v_uid
        AND rwm.revoked_at IS NULL
        AND (rwm.role = 'owner' OR (rwm.role = 'co_organizer' AND rwm.delegated_publish = true))
    )
  ) INTO v_can_publish;

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

  UPDATE public.route_workspaces
  SET status = 'published',
      reviewed_seq = v_ws.head_seq,
      published_revision_id = v_rev_id,
      published_revision_no = v_next_rev_no,
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

DROP POLICY IF EXISTS route_workspaces_owner_insert ON public.route_workspaces;
CREATE POLICY route_workspaces_owner_insert ON public.route_workspaces
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

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
CREATE POLICY participant_pack_states_own_or_owner ON public.participant_pack_states
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON FUNCTION public.apply_route_operation_tx(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_route_operation_tx(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_route_revision_tx(UUID, BIGINT, TEXT, JSONB, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_route_revision_tx(UUID, BIGINT, TEXT, JSONB, TEXT, JSONB) TO authenticated;
