-- Suites de l'itinéraire collaboratif (/compas/itineraire), après 20261118120000_route_collab_20_10 :
--   4.1  préférences d'interface par compte (Simple / Expert), table privée sous RLS ;
--   10.5 sortie de club : la version PUBLIÉE d'un espace devient une révision de tracé de la sortie ;
--   10.10 modération : lecture et APPLICATION réelle des décisions (commentaire, lien partagé, trace publique).
-- Retour arrière : supabase/migrations_down/20261123130000_route_collab_followups.down.sql.
-- Prérequis : 20261118120000 (route_*), 20261119204829 / 20261119205238 (révisions de tracé des clubs),
-- 20260710110000 (admin_roles, moderation_queue, admin_audit_log, is_moderateur).

-- ----------------------------------------------------------------------------
-- 1. 4.1 Préférences d'interface par compte. Jamais exposées par une vue publique.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_ui_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(prefs) = 'object' AND length(prefs::text) <= 2048),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_ui_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_ui_prefs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_ui_prefs TO authenticated;
DROP POLICY IF EXISTS user_ui_prefs_select_own ON public.user_ui_prefs;
CREATE POLICY user_ui_prefs_select_own ON public.user_ui_prefs
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_ui_prefs_insert_own ON public.user_ui_prefs;
CREATE POLICY user_ui_prefs_insert_own ON public.user_ui_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_ui_prefs_update_own ON public.user_ui_prefs;
CREATE POLICY user_ui_prefs_update_own ON public.user_ui_prefs
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. 10.5 Clubs : révision de tracé issue d'un espace d'itinéraire
-- ----------------------------------------------------------------------------
-- La géométrie vit dans la révision (`trace`, GeoJSON) : un espace n'a pas de ligne dans hiking_route_revisions.
-- `trace.sanitized` dit si la zone de départ privée a été masquée (sortie publique) au moment de la copie.
ALTER TABLE public.club_event_route_revisions
  ADD COLUMN IF NOT EXISTS source_workspace_id UUID REFERENCES public.route_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_revision_no BIGINT,
  ADD COLUMN IF NOT EXISTS trace JSONB;
CREATE INDEX IF NOT EXISTS club_event_route_revisions_source_ws_idx
  ON public.club_event_route_revisions (source_workspace_id) WHERE source_workspace_id IS NOT NULL;

-- Une révision portant sa propre géométrie est adoptable au même titre qu'une révision du catalogue.
DO $$
DECLARE
  def text := pg_get_functiondef('club_private.save_event_route_state(uuid,integer,boolean)'::regprocedure);
  needle constant text := 'current_revision.canonical_revision_id IS NULL';
BEGIN
  IF position('current_revision.trace' IN def) > 0 THEN RETURN; END IF;
  IF regexp_count(def, needle) <> 1 THEN
    RAISE EXCEPTION 'Définition inattendue pour club_private.save_event_route_state.';
  END IF;
  EXECUTE replace(def, needle, needle || ' AND current_revision.trace IS NULL');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_club_event_route_trace(p_event_id uuid, p_revision integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT COALESCE(public.st_asgeojson(c.geom)::jsonb, r.trace)
  FROM public.club_event_route_revisions AS r
  LEFT JOIN public.hiking_route_revisions AS c ON c.id = r.canonical_revision_id
  WHERE r.event_id = p_event_id AND r.revision = p_revision;
$$;

-- Propose à la sortie la version PUBLIÉE d'un espace. Règles :
--   * l'appelant organise la sortie ou modère le club (règle de publish_club_event_route) ;
--   * ET possède l'espace (owner) ou y est co_organizer avec la publication déléguée : proposer un tracé à un club est
--     une publication. Une inscription à la sortie ne donne aucun droit d'écriture sur l'espace ;
--   * seule la version publiée est copiée (jamais le brouillon) ; sortie ni 'club_only' ni 'private' : zone de départ
--     privée masquée (route_sanitize_snapshot_for_share, 500 m au moins) ;
--   * idempotent : même version, même contrôle, même mode de masquage = aucune nouvelle révision ni notification.
CREATE OR REPLACE FUNCTION public.publish_club_event_route_from_workspace(p_event_id uuid, p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  e public.club_events%ROWTYPE;
  ws public.route_workspaces%ROWTYPE;
  rev public.route_revisions%ROWTYPE;
  cur public.club_event_route_revisions%ROWTYPE;
  published public.club_event_route_revisions%ROWTYPE;
  v_role text;
  v_delegated boolean := false;
  v_checksum text;
  v_dist numeric;
  v_gain numeric;
  v_unknown integer;
  v_sanitize boolean;
  v_snap jsonb;
  v_coords jsonb;
  v_trace jsonb;
  next_revision integer;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO e FROM public.club_events AS ev
    WHERE ev.id = p_event_id AND (ev.organizer_id = actor OR public.lkdv_is_club_moderator(ev.club_id))
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publication réservée à l’organisateur ou à la modération du club.' USING ERRCODE = '42501';
  END IF;
  IF e.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette sortie est annulée.' USING ERRCODE = '55000';
  END IF;

  v_role := public.route_workspace_effective_role(p_workspace_id, actor);
  IF v_role = 'co_organizer' THEN
    SELECT m.delegated_publish INTO v_delegated FROM public.route_workspace_members AS m
      WHERE m.workspace_id = p_workspace_id AND m.user_id = actor AND m.revoked_at IS NULL;
  END IF;
  -- COALESCE : sans rôle (espace inconnu, étranger), v_role est NULL et NOT (NULL OR false) ne lèverait rien.
  IF NOT (COALESCE(v_role, '') = 'owner' OR (COALESCE(v_role, '') = 'co_organizer' AND COALESCE(v_delegated, false))) THEN
    RAISE EXCEPTION 'Publication réservée au propriétaire de l’itinéraire ou à son co-organisateur délégué.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO ws FROM public.route_workspaces AS w WHERE w.id = p_workspace_id FOR SHARE;
  IF ws.status = 'archived' THEN
    RAISE EXCEPTION 'Cet itinéraire est archivé.' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO rev FROM public.route_revisions AS r WHERE r.id = ws.published_revision_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune version publiée.' USING ERRCODE = 'P0002';
  END IF;
  SELECT p.checksum INTO v_checksum FROM public.departure_packs AS p
    WHERE p.revision_id = rev.id ORDER BY p.generated_at DESC LIMIT 1;
  IF v_checksum IS NULL THEN
    RAISE EXCEPTION 'Pack de départ absent : publie de nouveau l’itinéraire.' USING ERRCODE = 'P0002';
  END IF;

  -- Distance et dénivelé de la version publiée ; un tronçon sans distance rend la version inexploitable,
  -- un tronçon sans dénivelé rend le dénivelé inconnu (NULL, jamais 0).
  SELECT round(sum(public.route_jf(s -> 'distanceKm'))::numeric * 1000, 1),
         CASE WHEN count(*) FILTER (WHERE public.route_jf(s -> 'ascentM') IS NULL) = 0
              THEN greatest(round(sum(public.route_jf(s -> 'ascentM'))::numeric), 0) END,
         count(*) FILTER (WHERE public.route_jf(s -> 'distanceKm') IS NULL)
    INTO v_dist, v_gain, v_unknown
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(rev.snapshot -> 'sections') = 'array' THEN rev.snapshot -> 'sections' ELSE '[]'::jsonb END) AS s
  WHERE jsonb_typeof(s) = 'object' AND COALESCE(s ->> 'deletedAt', '') = '';
  IF v_dist IS NULL OR v_unknown > 0 OR v_dist <= 0 THEN
    RAISE EXCEPTION 'Distance de la version publiée inconnue.' USING ERRCODE = '22023';
  END IF;

  v_sanitize := e.visibility NOT IN ('club_only', 'private');
  SELECT * INTO cur FROM public.club_event_route_revisions AS r WHERE r.event_id = e.id AND r.revision = e.route_revision;
  IF FOUND AND cur.source_workspace_id = ws.id AND cur.source_revision_no = rev.revision_no AND cur.checksum = v_checksum
     AND COALESCE((cur.trace ->> 'sanitized')::boolean, false) = v_sanitize THEN
    RETURN jsonb_build_object('event', to_jsonb(e), 'snapshot', to_jsonb(cur) - 'trace');
  END IF;

  v_snap := rev.snapshot || jsonb_build_object('shapeMode', ws.state_snapshot -> 'shapeMode');
  IF v_sanitize THEN
    v_snap := public.route_sanitize_snapshot_for_share(
      ws.id, v_snap, rev.based_on_seq,
      greatest(500, COALESCE(public.route_jf(ws.state_snapshot -> 'shareLink' -> 'hidePrivateStartRadiusM'), 500))::numeric);
  END IF;
  SELECT jsonb_agg(t.s #> '{geometry,coordinates}' ORDER BY t.o) INTO v_coords
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_snap -> 'sections') = 'array' THEN v_snap -> 'sections' ELSE '[]'::jsonb END)
       WITH ORDINALITY AS t(s, o)
  WHERE jsonb_typeof(t.s) = 'object' AND COALESCE(t.s ->> 'deletedAt', '') = ''
    AND jsonb_typeof(t.s #> '{geometry,coordinates}') = 'array' AND jsonb_array_length(t.s #> '{geometry,coordinates}') >= 2;
  v_trace := jsonb_build_object('type', 'MultiLineString', 'coordinates', v_coords, 'sanitized', v_sanitize);
  IF v_coords IS NULL OR length(v_trace::text) > 3000000 THEN
    RAISE EXCEPTION 'Tracé indisponible (vide après masquage de la zone privée, ou trop volumineux).' USING ERRCODE = '22023';
  END IF;

  SELECT GREATEST(e.route_revision, COALESCE(max(r.revision), 0)) + 1 INTO next_revision
  FROM public.club_event_route_revisions AS r WHERE r.event_id = e.id;
  INSERT INTO public.club_event_route_revisions (
    event_id, revision, route_id, checksum, distance_m, elevation_gain_m, updated_by, requires_participant_decision,
    route_name, meeting_point, previous_meeting, source_workspace_id, source_revision_no, trace
  ) VALUES (
    e.id, next_revision, ws.id::text, v_checksum, v_dist, v_gain, actor, true,
    left(ws.title, 160), e.meeting_point, jsonb_build_object('place', e.meeting_point, 'lat', e.lat, 'lng', e.lng),
    ws.id, rev.revision_no, v_trace
  ) RETURNING * INTO published;
  UPDATE public.club_events SET route_id = published.route_id, route_revision = published.revision
  WHERE id = e.id RETURNING * INTO e;

  PERFORM public.notify_activity(
    p.user_id, 'club_route_revision', 'social',
    'Nouveau parcours proposé', e.title || ' · révision ' || next_revision,
    actor, 'club_event', e.id, '/sorties/' || e.id::text || '?source=club#parcours')
  FROM club_private.active_event_route_participants(e.id) AS p;

  RETURN jsonb_build_object('event', to_jsonb(e), 'snapshot', to_jsonb(published) - 'trace');
END;
$$;
REVOKE ALL ON FUNCTION public.publish_club_event_route_from_workspace(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_club_event_route_from_workspace(uuid, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. 10.10 Modération des itinéraires (fonction proposée en amont, durcie ici)
-- ----------------------------------------------------------------------------
-- Les commentaires vivent dans route_workspaces.state_snapshot -> 'comments' (la table route_comments n'est pas
-- alimentée) : un modérateur n'est pas membre de l'espace (RLS), la lecture passe par cette fonction. Elle ne renvoie
-- que type, identifiant, aperçu borné et date : jamais le jeton ni son hash, jamais une coordonnée. `created_at` est du
-- texte : une date écrite par un membre dans le snapshot n'est pas castée (elle ferait échouer toute la file).
-- Identifiants : commentaire = '<espace>:<commentaire>', lien partagé = '<espace>'.
CREATE OR REPLACE FUNCTION public.admin_list_route_moderation(p_limit integer DEFAULT 50)
RETURNS TABLE (type text, id text, preview text, created_at text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT COALESCE(public.is_moderateur(), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  (
    SELECT 'route_comment'::text, w.id::text || ':' || left(c.e ->> 'id', 80), left(c.e ->> 'body', 120),
           COALESCE(left(c.e ->> 'createdAt', 40), to_char(w.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    FROM (SELECT x.id, x.updated_at, x.state_snapshot -> 'comments' AS cs
            FROM public.route_workspaces AS x
           WHERE jsonb_typeof(x.state_snapshot -> 'comments') = 'array' AND jsonb_array_length(x.state_snapshot -> 'comments') > 0
           ORDER BY x.updated_at DESC LIMIT v_limit) AS w
    CROSS JOIN LATERAL jsonb_array_elements(w.cs) WITH ORDINALITY AS c(e, o)
    WHERE jsonb_typeof(c.e) = 'object' AND jsonb_typeof(c.e -> 'id') = 'string' AND jsonb_typeof(c.e -> 'body') = 'string'
    ORDER BY w.updated_at DESC, c.o DESC LIMIT v_limit
  )
  UNION ALL
  (
    SELECT 'route_share_link'::text, w.id::text, left(w.title, 120), to_char(w.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    FROM public.route_workspaces AS w
    WHERE w.share_token_hash IS NOT NULL AND w.share_revoked_at IS NULL
      AND (w.share_expires_at IS NULL OR w.share_expires_at > now())
    ORDER BY w.updated_at DESC LIMIT v_limit
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_route_moderation(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_route_moderation(integer) TO authenticated;

-- Applique la décision de rejet et la journalise (file + audit), dans une seule transaction.
--   route_comment      : 'hide' (texte remplacé, commentaire gardé) | 'remove' (retiré du snapshot) ;
--   route_share_link   : 'revoke' (lien révoqué, même effet que manage_route_share_link_tx) ;
--   route_public_trace : 'remove' (publication communautaire créée par « Publier le tracé » seulement).
-- Réponse : status 'applied' | 'noop' (déjà appliquée, rien journalisé de plus) | 'not_found'.
CREATE OR REPLACE FUNCTION public.admin_apply_route_moderation(p_kind text, p_id text, p_action text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_status text := 'not_found';
  v_ws public.route_workspaces%ROWTYPE;
  v_wid uuid;
  v_cid text;
  v_link jsonb;
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF actor IS NULL OR NOT COALESCE(public.is_moderateur(), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR char_length(p_id) NOT BETWEEN 36 AND 120
     OR NOT ((p_kind = 'route_comment' AND p_action IN ('hide', 'remove') AND substr(p_id, 37, 1) = ':' AND char_length(p_id) > 37)
          OR (p_kind = 'route_share_link' AND p_action = 'revoke' AND p_id ~ uuid_re)
          OR (p_kind = 'route_public_trace' AND p_action = 'remove' AND p_id ~ uuid_re)) THEN
    RAISE EXCEPTION 'Décision de modération invalide.' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'route_public_trace' THEN
    DELETE FROM public.community_posts WHERE id = p_id::uuid AND creation_meta ->> 'created_from' = 'route_collab';
    IF FOUND THEN v_status := 'applied'; END IF;
  ELSIF p_kind = 'route_share_link' THEN
    SELECT * INTO v_ws FROM public.route_workspaces WHERE id = p_id::uuid FOR UPDATE;
    IF FOUND AND v_ws.share_token_hash IS NOT NULL THEN
      IF v_ws.share_revoked_at IS NOT NULL THEN
        v_status := 'noop';
      ELSE
        v_link := CASE WHEN jsonb_typeof(v_ws.state_snapshot -> 'shareLink') = 'object'
                       THEN ((v_ws.state_snapshot -> 'shareLink') - 'token') || jsonb_build_object('revokedAt', v_now_iso) END;
        UPDATE public.route_workspaces
        SET share_revoked_at = now(),
            state_snapshot = CASE WHEN v_link IS NOT NULL THEN jsonb_set(state_snapshot, '{shareLink}', v_link, true) ELSE state_snapshot END,
            state_version = state_version + 1, updated_at = now()
        WHERE id = v_ws.id;
        v_status := 'applied';
      END IF;
    END IF;
  ELSE
    IF substr(p_id, 1, 36) !~ uuid_re THEN
      RAISE EXCEPTION 'Décision de modération invalide.' USING ERRCODE = '22023';
    END IF;
    v_wid := substr(p_id, 1, 36)::uuid;
    v_cid := substr(p_id, 38);
    SELECT * INTO v_ws FROM public.route_workspaces WHERE id = v_wid FOR UPDATE;
    IF FOUND AND jsonb_typeof(v_ws.state_snapshot -> 'comments') = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_ws.state_snapshot -> 'comments') AS c(e) WHERE c.e ->> 'id' = v_cid) THEN
      IF p_action = 'hide' AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_ws.state_snapshot -> 'comments') AS c(e)
                                       WHERE c.e ->> 'id' = v_cid AND c.e ->> 'moderation' = 'hidden') THEN
        v_status := 'noop';
      ELSE
        UPDATE public.route_workspaces
        SET state_snapshot = jsonb_set(state_snapshot, '{comments}', COALESCE((
              SELECT jsonb_agg(CASE WHEN p_action = 'hide' AND c.e ->> 'id' = v_cid
                                    THEN c.e || jsonb_build_object('body', '[Commentaire masqué par la modération]', 'moderation', 'hidden')
                                    ELSE c.e END ORDER BY c.o)
              FROM jsonb_array_elements(state_snapshot -> 'comments') WITH ORDINALITY AS c(e, o)
              WHERE NOT (p_action = 'remove' AND c.e ->> 'id' = v_cid)), '[]'::jsonb), true),
            state_version = state_version + 1, updated_at = now()
        WHERE id = v_wid;
        v_status := 'applied';
      END IF;
    END IF;
  END IF;

  IF v_status <> 'not_found' THEN
    UPDATE public.moderation_queue SET statut = 'rejete', moderateur_id = actor, updated_at = now()
      WHERE contenu_type = p_kind AND contenu_id = p_id;
    IF NOT FOUND THEN
      INSERT INTO public.moderation_queue (contenu_type, contenu_id, statut, moderateur_id) VALUES (p_kind, p_id, 'rejete', actor);
    END IF;
  END IF;
  IF v_status = 'applied' THEN
    INSERT INTO public.admin_audit_log (admin_id, action, cible_type, cible_id, avant, apres)
    VALUES (actor, CASE WHEN p_action = 'remove' THEN 'DELETE' ELSE 'UPDATE' END::public.audit_action, p_kind, p_id,
            NULL, jsonb_build_object('enforced', p_action));
  END IF;
  RETURN jsonb_build_object('status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_apply_route_moderation(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_route_moderation(text, text, text) TO authenticated;
