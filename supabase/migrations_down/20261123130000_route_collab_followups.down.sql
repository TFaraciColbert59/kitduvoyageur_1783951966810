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

-- get_club_event_route_trace : définition de 20261119205238 (géométrie du catalogue seulement).
CREATE OR REPLACE FUNCTION public.get_club_event_route_trace(p_event_id uuid, p_revision integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT public.st_asgeojson(c.geom)::jsonb
  FROM public.club_event_route_revisions AS r
  JOIN public.hiking_route_revisions AS c ON c.id = r.canonical_revision_id
  WHERE r.event_id = p_event_id AND r.revision = p_revision;
$$;

-- save_event_route_state : retire la clause ajoutée (une révision sans géométrie du catalogue n'est plus adoptable).
DO $$
DECLARE
  def text := pg_get_functiondef('club_private.save_event_route_state(uuid,integer,boolean)'::regprocedure);
  added constant text := ' AND current_revision.trace IS NULL';
BEGIN
  IF position(added IN def) = 0 THEN RETURN; END IF;
  IF regexp_count(def, added) <> 1 THEN
    RAISE EXCEPTION 'Définition inattendue pour club_private.save_event_route_state.';
  END IF;
  EXECUTE replace(def, added, '');
END;
$$;

DROP INDEX IF EXISTS public.club_event_route_revisions_source_ws_idx;
ALTER TABLE public.club_event_route_revisions
  DROP COLUMN IF EXISTS trace,
  DROP COLUMN IF EXISTS source_revision_no,
  DROP COLUMN IF EXISTS source_workspace_id;

DROP TABLE IF EXISTS public.user_ui_prefs;
