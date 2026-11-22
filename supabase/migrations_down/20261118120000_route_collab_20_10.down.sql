-- Retour arrière de 20261118120000_route_collab_20_10.sql.
-- Exécuter dans une transaction, dans l'ordre inverse de la migration :
-- fonctions, policies, colonnes ajoutées à hike_sessions / carnets, puis tables.
-- Refuse de s'exécuter s'il existe des espaces d'itinéraire (perte de données) : les exporter
-- puis les supprimer explicitement avant de rejouer ce script.
DO $$
BEGIN
  IF to_regclass('public.route_workspaces') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.route_workspaces) THEN
    RAISE EXCEPTION 'Le retour arrière supprimerait des espaces d’itinéraire collaboratifs (route_workspaces non vide).';
  END IF;
END;
$$;

-- 1. Fonctions (RPC puis fonctions internes, puis aide RLS utilisée par les policies).
DROP FUNCTION IF EXISTS public.get_shared_route_workspace_tx(UUID, TEXT);
DROP FUNCTION IF EXISTS public.manage_route_share_link_tx(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.write_route_workspace_part_tx(UUID, TEXT, JSONB, BIGINT);
DROP FUNCTION IF EXISTS public.publish_route_revision_tx(UUID, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT);
DROP FUNCTION IF EXISTS public.apply_route_operation_tx(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT);
DROP FUNCTION IF EXISTS public.create_route_workspace_tx(UUID, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.route_merge_snapshot_keys(JSONB, JSONB, TEXT[]);
DROP FUNCTION IF EXISTS public.route_workspace_effective_role(UUID, UUID);

-- 2. Policies (avant can_read_route_workspace qui les référence).
DROP POLICY IF EXISTS participant_pack_states_own_read ON public.participant_pack_states;
DROP POLICY IF EXISTS participant_pack_states_own_or_owner ON public.participant_pack_states;
DROP POLICY IF EXISTS departure_packs_member_read ON public.departure_packs;
DROP POLICY IF EXISTS route_comments_member_read ON public.route_comments;
DROP POLICY IF EXISTS route_proposals_member_read ON public.route_proposals;
DROP POLICY IF EXISTS route_revisions_member_read ON public.route_revisions;
DROP POLICY IF EXISTS route_operations_member_read ON public.route_operations;
DROP POLICY IF EXISTS route_stages_member_read ON public.route_stages;
DROP POLICY IF EXISTS route_sections_member_read ON public.route_sections;
DROP POLICY IF EXISTS route_points_member_read ON public.route_points;
DROP POLICY IF EXISTS route_ws_members_read ON public.route_workspace_members;
DROP POLICY IF EXISTS route_workspaces_owner_insert ON public.route_workspaces;
DROP POLICY IF EXISTS route_workspaces_member_read ON public.route_workspaces;

DROP FUNCTION IF EXISTS public.can_read_route_workspace(UUID);

-- 3. Colonnes additives nullable (avant les tables route_revisions / route_workspaces qu'elles référencent).
ALTER TABLE public.carnets
  DROP COLUMN IF EXISTS departure_kit_snapshot,
  DROP COLUMN IF EXISTS planned_revision_no,
  DROP COLUMN IF EXISTS planned_revision_id;

ALTER TABLE public.hike_sessions
  DROP COLUMN IF EXISTS kit_snapshot,
  DROP COLUMN IF EXISTS route_revision_id,
  DROP COLUMN IF EXISTS route_workspace_id;

-- 4. Tables, des plus dépendantes aux racines.
DROP TABLE IF EXISTS public.participant_pack_states;
DROP TABLE IF EXISTS public.departure_packs;
DROP TABLE IF EXISTS public.route_comments;
DROP TABLE IF EXISTS public.route_proposals;
DROP TABLE IF EXISTS public.route_revisions;
DROP TABLE IF EXISTS public.route_operations;
DROP TABLE IF EXISTS public.route_stages;
DROP TABLE IF EXISTS public.route_sections;
DROP TABLE IF EXISTS public.route_points;
DROP TABLE IF EXISTS public.route_workspace_members;
DROP TABLE IF EXISTS public.route_workspaces;
