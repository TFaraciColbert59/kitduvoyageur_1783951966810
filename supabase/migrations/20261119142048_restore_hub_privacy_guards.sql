-- Le partage masqué des sorties passe par la projection du carnet.
-- Les lectures directes de hike_sessions restent réservées au propriétaire
-- et aux participants selon la politique posée dans 20261112121000.
DROP POLICY IF EXISTS hike_sessions_select_followers ON public.hike_sessions;
DROP POLICY IF EXISTS hike_sessions_select_public ON public.hike_sessions;

-- Les publications écrivent des URL de stockage public. Tant que le stockage
-- privé et sa lecture autorisée ne sont pas raccordés aux publications, garder
-- les médias et instantanés publics hors des audiences restreintes.
CREATE OR REPLACE FUNCTION public.reject_public_media_on_restricted_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $guard$
BEGIN
  IF NEW.audience <> 'public' AND (
    NULLIF(btrim(coalesce(NEW.image_url, '')), '') IS NOT NULL
    OR jsonb_array_length(coalesce(NEW.media_urls, '[]'::jsonb)) > 0
    OR NEW.linked_carnet_id IS NOT NULL
    OR NEW.snapshot_payload IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Restricted Community posts cannot reference public media or snapshots'
      USING ERRCODE = '23514', CONSTRAINT = 'community_post_restricted_media';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS trg_community_post_restricted_media ON public.community_posts;
CREATE TRIGGER trg_community_post_restricted_media
  BEFORE INSERT OR UPDATE OF audience, image_url, media_urls, linked_carnet_id, snapshot_payload
  ON public.community_posts FOR EACH ROW
  EXECUTE FUNCTION public.reject_public_media_on_restricted_post();

-- Conserver le validateur, les contrôles d’accès et l’idempotence du RPC
-- existant. Traduire uniquement la violation du nouveau garde en erreur métier.
ALTER FUNCTION public.create_community_post(jsonb) RENAME TO create_community_post_impl;
REVOKE ALL ON FUNCTION public.create_community_post_impl(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_community_post(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $post$
DECLARE
  violated_constraint text;
BEGIN
  RETURN public.create_community_post_impl(p);
EXCEPTION
  WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint = 'community_post_restricted_media' THEN
      PERFORM public.lkdv_raise('validation_failed', 'Les médias et aperçus publics nécessitent une audience publique.', 'media');
    END IF;
    RAISE;
END;
$post$;

REVOKE ALL ON FUNCTION public.create_community_post(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_community_post(jsonb) TO authenticated;
