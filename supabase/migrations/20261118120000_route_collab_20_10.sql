-- Migration additive LKDV · Créateur d'itinéraires collaboratif « 20/10 »
-- Compatible avec les voyages existants (`trips`, `trip_collaborators`, `hiking_routes`, `hike_sessions`).
-- Retour arrière : DROP TABLE IF EXISTS ... CASCADE sur les nouvelles tables uniquement.

CREATE TABLE IF NOT EXISTS public.route_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  sport TEXT NOT NULL DEFAULT 'marche',
  routing_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  head_seq BIGINT NOT NULL DEFAULT 0,
  reviewed_seq BIGINT,
  published_revision_id UUID,
  published_revision_no BIGINT,
  source_origin JSONB NOT NULL DEFAULT '{"kind":"blank"}'::jsonb,
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_workspaces_trip_id ON public.route_workspaces(trip_id);

CREATE TABLE IF NOT EXISTS public.route_operations (
  workspace_id UUID NOT NULL REFERENCES public.route_workspaces(id) ON DELETE CASCADE,
  seq BIGINT NOT NULL,
  op_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  revision_no BIGINT NOT NULL,
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
  anchor_type TEXT NOT NULL,
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

-- RLS : lecture autorisée uniquement au propriétaire du voyage ou aux collaborateurs actifs.
ALTER TABLE public.route_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departure_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_pack_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS route_workspaces_member_read ON public.route_workspaces;
CREATE POLICY route_workspaces_member_read ON public.route_workspaces
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = route_workspaces.trip_id
        AND tc.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS route_operations_member_read ON public.route_operations;
CREATE POLICY route_operations_member_read ON public.route_operations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_workspaces rw
      LEFT JOIN public.trip_collaborators tc ON tc.trip_id = rw.trip_id AND tc.user_id = (SELECT auth.uid())
      WHERE rw.id = route_operations.workspace_id
        AND (rw.created_by = (SELECT auth.uid()) OR tc.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS route_revisions_member_read ON public.route_revisions;
CREATE POLICY route_revisions_member_read ON public.route_revisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_workspaces rw
      LEFT JOIN public.trip_collaborators tc ON tc.trip_id = rw.trip_id AND tc.user_id = (SELECT auth.uid())
      WHERE rw.id = route_revisions.workspace_id
        AND (rw.created_by = (SELECT auth.uid()) OR tc.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS route_proposals_member_read ON public.route_proposals;
CREATE POLICY route_proposals_member_read ON public.route_proposals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_workspaces rw
      LEFT JOIN public.trip_collaborators tc ON tc.trip_id = rw.trip_id AND tc.user_id = (SELECT auth.uid())
      WHERE rw.id = route_proposals.workspace_id
        AND (rw.created_by = (SELECT auth.uid()) OR tc.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS route_comments_member_read ON public.route_comments;
CREATE POLICY route_comments_member_read ON public.route_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_workspaces rw
      LEFT JOIN public.trip_collaborators tc ON tc.trip_id = rw.trip_id AND tc.user_id = (SELECT auth.uid())
      WHERE rw.id = route_comments.workspace_id
        AND (rw.created_by = (SELECT auth.uid()) OR tc.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS departure_packs_member_read ON public.departure_packs;
CREATE POLICY departure_packs_member_read ON public.departure_packs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_workspaces rw
      LEFT JOIN public.trip_collaborators tc ON tc.trip_id = rw.trip_id AND tc.user_id = (SELECT auth.uid())
      WHERE rw.id = departure_packs.workspace_id
        AND (rw.created_by = (SELECT auth.uid()) OR tc.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS participant_pack_states_own_or_owner ON public.participant_pack_states;
CREATE POLICY participant_pack_states_own_or_owner ON public.participant_pack_states
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
