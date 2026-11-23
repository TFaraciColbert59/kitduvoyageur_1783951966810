-- Retour arrière de 20261123130000_route_collab_followups.sql, dans l'ordre inverse.
-- Refuse de s'exécuter s'il perdrait des données : préférences d'interface (user_ui_prefs non vide) ou révisions de
-- tracé de club issues d'un espace d'itinéraire (club_event_route_revisions.source_workspace_id). Exporter puis
-- supprimer explicitement avant de rejouer ce script. Les décisions de modération déjà appliquées (commentaire masqué,
-- lien révoqué, trace retirée) ne sont PAS restaurées : leurs effets sont dans les données, pas dans le schéma.
DO $$
DECLARE
  v_count bigint;
BEGIN
  IF to_regclass('public.user_ui_prefs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.user_ui_prefs' INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Le retour arrière supprimerait % préférence(s) d’interface (user_ui_prefs non vide).', v_count;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'club_event_route_revisions' AND column_name = 'source_workspace_id') THEN
    EXECUTE 'SELECT count(*) FROM public.club_event_route_revisions WHERE source_workspace_id IS NOT NULL OR trace IS NOT NULL' INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Le retour arrière perdrait % révision(s) de tracé de club issue(s) d’un itinéraire.', v_count;
    END IF;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_apply_route_moderation(text, text, text);
DROP FUNCTION IF EXISTS public.admin_list_route_moderation(integer);
DROP FUNCTION IF EXISTS public.publish_club_event_route_from_workspace(uuid, uuid);

-- Les trois fonctions ci-dessous n'existent que si 20261119204829 / 20261119205238 sont passées (la section 2 de la
-- migration est conditionnelle) : on ne restaure que ce qui existe.
DO $restore$
DECLARE
  def text;
  added constant text := ' AND current_revision.trace IS NULL';
BEGIN
  -- get_club_event_route_trace : définition de 20261119205238 (géométrie du catalogue seulement). Corps recopié
  -- à l'identique (indentation comprise) : la définition restaurée est celle d'avant.
  IF to_regprocedure('public.get_club_event_route_trace(uuid,integer)') IS NOT NULL THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.get_club_event_route_trace(p_event_id uuid, p_revision integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $b$
  SELECT public.st_asgeojson(c.geom)::jsonb
  FROM public.club_event_route_revisions AS r
  JOIN public.hiking_route_revisions AS c ON c.id = r.canonical_revision_id
  WHERE r.event_id = p_event_id AND r.revision = p_revision;
$b$ $fn$;
  END IF;

  -- trip_private.trip_club_route_updates : définition de 20261119205238 (révisions du catalogue seulement).
  IF to_regprocedure('trip_private.trip_club_route_updates(uuid)') IS NOT NULL THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION trip_private.trip_club_route_updates(p_trip_id uuid)
RETURNS TABLE (event_id uuid, event_title text, revision integer, route_name text, adopted_revision integer, decision_pending boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $b$
  SELECT e.id, e.title, r.revision, r.route_name, s.adopted_revision,
    r.requires_participant_decision
      AND EXISTS (SELECT 1 FROM club_private.active_event_route_participants(e.id, (SELECT auth.uid())))
      AND d.revision IS NULL
  FROM trip_private.visible_event_trip_links AS l
  JOIN public.club_events AS e ON e.id = l.event_id
  JOIN public.club_event_route_revisions AS r ON r.event_id = e.id AND r.revision = e.route_revision
  LEFT JOIN public.club_event_route_sync AS s ON s.event_id = e.id AND s.user_id = (SELECT auth.uid())
  LEFT JOIN public.club_event_route_decisions AS d ON d.event_id = e.id AND d.user_id = (SELECT auth.uid())
    AND d.revision = r.revision
  WHERE l.trip_id = p_trip_id AND l.source_kind = 'club_event' AND r.canonical_revision_id IS NOT NULL
  ORDER BY r.updated_at DESC, e.id;
$b$ $fn$;
  END IF;

  -- save_event_route_state : retire la clause ajoutée (une révision sans géométrie du catalogue n'est plus adoptable).
  IF to_regprocedure('club_private.save_event_route_state(uuid,integer,boolean)') IS NOT NULL THEN
    def := pg_get_functiondef('club_private.save_event_route_state(uuid,integer,boolean)'::regprocedure);
    IF position(added IN def) > 0 THEN
      IF regexp_count(def, added) <> 1 THEN
        RAISE EXCEPTION 'Définition inattendue pour club_private.save_event_route_state.';
      END IF;
      EXECUTE replace(def, added, '');
    END IF;
  END IF;
END;
$restore$;

-- elevation_gain_m reste nullable (20261119204829 le fait aussi) : aucune donnée n'est perdue.
DROP INDEX IF EXISTS public.club_event_route_revisions_source_ws_idx;
ALTER TABLE public.club_event_route_revisions
  DROP COLUMN IF EXISTS trace,
  DROP COLUMN IF EXISTS source_revision_no,
  DROP COLUMN IF EXISTS source_workspace_id;

DROP TABLE IF EXISTS public.user_ui_prefs;
