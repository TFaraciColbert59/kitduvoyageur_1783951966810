-- PROPOSITION (non appliquée, hors de supabase/migrations) : audit de modération des itinéraires (10.10).
-- Utilisée par src/features/route-collab/server/adminModeration.ts. Tant qu'elle n'est pas appliquée, le code
-- déclare les commentaires et les liens partagés « indisponibles » (jamais « vides »).
--
-- Pourquoi une fonction : route_comments et route_workspaces ne sont lisibles que par les membres de l'espace
-- (RLS « member_read »). Un modérateur n'est pas membre : la lecture passe par cette fonction SECURITY
-- DEFINER qui vérifie is_moderateur() et ne renvoie que type, identifiant, aperçu borné et date. Jamais le
-- jeton ni son hash (share_token_hash), jamais une coordonnée, jamais le contenu du tracé.
-- À valider sur copie avant la production ; rollback : DROP FUNCTION public.admin_list_route_moderation(integer);

CREATE OR REPLACE FUNCTION public.admin_list_route_moderation(p_limit integer DEFAULT 50)
RETURNS TABLE (type text, id text, preview text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_moderateur() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  (
    SELECT 'route_comment'::text, c.id::text, LEFT(c.body, 120), c.created_at
      FROM public.route_comments c
     ORDER BY c.created_at DESC
     LIMIT v_limit
  )
  UNION ALL
  (
    SELECT 'route_share_link'::text, w.id::text, LEFT(w.title, 120), w.updated_at
      FROM public.route_workspaces w
     WHERE w.share_token_hash IS NOT NULL
       AND w.share_revoked_at IS NULL
       AND (w.share_expires_at IS NULL OR w.share_expires_at > now())
     ORDER BY w.updated_at DESC
     LIMIT v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_route_moderation(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_route_moderation(integer) TO authenticated;
