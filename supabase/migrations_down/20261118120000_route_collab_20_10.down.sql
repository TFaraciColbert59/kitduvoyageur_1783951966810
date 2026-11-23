-- Retour arrière de 20261118120000_route_collab_20_10.sql.
-- Exécuter dans une transaction, dans l'ordre inverse de la migration :
-- policies, fonctions, colonnes ajoutées à hike_sessions / carnets, puis tables.
-- Refuse de s'exécuter s'il existe des données créées par la fonctionnalité (perte de données) :
--   * espaces d'itinéraire (route_workspaces non vide) ;
--   * valeurs non nulles dans les colonnes ajoutées à hike_sessions (kit_snapshot, route_workspace_id,
--     route_revision_id) ou à carnets (departure_kit_snapshot, planned_revision_id, planned_revision_no).
-- Dans ce cas, exporter puis supprimer / remettre à NULL explicitement avant de rejouer ce script.
-- L'extension pgcrypto (schéma extensions) n'est PAS supprimée : elle peut servir à d'autres objets.
DO $$
DECLARE
  v_count BIGINT;
  v_col TEXT;
BEGIN
  IF to_regclass('public.route_workspaces') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.route_workspaces' INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Le retour arrière supprimerait des espaces d’itinéraire collaboratifs (route_workspaces non vide : % ligne(s)).', v_count;
    END IF;
  END IF;

  FOREACH v_col IN ARRAY ARRAY['kit_snapshot', 'route_workspace_id', 'route_revision_id'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'hike_sessions' AND column_name = v_col) THEN
      EXECUTE format('SELECT count(*) FROM public.hike_sessions WHERE %I IS NOT NULL', v_col) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'Le retour arrière perdrait des données : hike_sessions.% porte % valeur(s) non nulle(s).', v_col, v_count;
      END IF;
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY ARRAY['departure_kit_snapshot', 'planned_revision_id', 'planned_revision_no'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'carnets' AND column_name = v_col) THEN
      EXECUTE format('SELECT count(*) FROM public.carnets WHERE %I IS NOT NULL', v_col) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'Le retour arrière perdrait des données : carnets.% porte % valeur(s) non nulle(s).', v_col, v_count;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 1. Policies (avant les fonctions qu'elles référencent).
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

-- 2. Fonctions (RPC, vues assainies, fonctions de lecture RLS, fonctions internes).
DROP FUNCTION IF EXISTS public.get_shared_route_workspace_tx(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_route_external_view_tx(UUID);
DROP FUNCTION IF EXISTS public.manage_route_share_link_tx(UUID, TEXT, TIMESTAMPTZ, INTEGER);
-- Ancienne signature (jeton fourni par l'appelant), au cas où une version antérieure aurait été appliquée.
DROP FUNCTION IF EXISTS public.manage_route_share_link_tx(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.set_route_member_tx(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.write_route_workspace_part_tx(UUID, TEXT, JSONB, BIGINT);
DROP FUNCTION IF EXISTS public.publish_route_revision_tx(UUID, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT);
DROP FUNCTION IF EXISTS public.apply_route_operation_tx(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB, JSONB, BIGINT);
DROP FUNCTION IF EXISTS public.create_route_workspace_tx(UUID, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.route_sanitize_snapshot_for_share(UUID, JSONB, BIGINT, NUMERIC);
DROP FUNCTION IF EXISTS public.route_sorted_by_id(JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS public.route_merge_snapshot_keys(JSONB, JSONB, TEXT[]);
DROP FUNCTION IF EXISTS public.can_read_route_workspace(UUID);
DROP FUNCTION IF EXISTS public.readable_route_workspace_ids();
DROP FUNCTION IF EXISTS public.route_workspace_effective_role(UUID, UUID);
DROP FUNCTION IF EXISTS public.route_point_in_zone(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION[], DOUBLE PRECISION[], DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.route_haversine_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.route_part_ok(JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.route_jnum(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.route_jtext(JSONB, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.route_jf(JSONB);

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
