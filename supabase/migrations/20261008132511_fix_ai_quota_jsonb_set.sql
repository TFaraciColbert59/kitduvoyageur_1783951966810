-- Le quota IA par personne n'a jamais fonctionné : jsonb_set attend un jsonb
-- en 3e argument, pas un entier (42883). L'appel échouait, et le code laisse
-- passer en cas d'échec (fail-open) : aucune limite n'était appliquée.
-- Seule correction : to_jsonb(...) autour du compteur.
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota(
  p_user_id uuid,
  p_tier text,
  p_feature text DEFAULT NULL::text,
  p_feature_limit integer DEFAULT 0
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.ai_usage_daily%ROWTYPE;
BEGIN
  IF p_tier NOT IN ('heavy', 'fast') THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, day, requests_heavy, requests_fast, requests_by_feature)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_tier = 'heavy' THEN 1 ELSE 0 END,
    CASE WHEN p_tier = 'fast' THEN 1 ELSE 0 END,
    CASE WHEN p_feature IS NOT NULL THEN jsonb_build_object(p_feature, 1) ELSE '{}'::jsonb END
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    requests_heavy = public.ai_usage_daily.requests_heavy
      + (CASE WHEN p_tier = 'heavy' THEN 1 ELSE 0 END),
    requests_fast = public.ai_usage_daily.requests_fast
      + (CASE WHEN p_tier = 'fast' THEN 1 ELSE 0 END),
    requests_by_feature = CASE WHEN p_feature IS NOT NULL
      THEN jsonb_set(
        COALESCE(public.ai_usage_daily.requests_by_feature, '{}'::jsonb),
        ARRAY[p_feature],
        to_jsonb(COALESCE((public.ai_usage_daily.requests_by_feature ->> p_feature)::int, 0) + 1)
      )
      ELSE COALESCE(public.ai_usage_daily.requests_by_feature, '{}'::jsonb)
    END
  WHERE (
    CASE WHEN p_tier = 'heavy'
      THEN public.ai_usage_daily.requests_heavy < 20
      ELSE public.ai_usage_daily.requests_fast < 100
    END
    AND (
      p_feature IS NULL
      OR p_feature_limit <= 0
      OR COALESCE((public.ai_usage_daily.requests_by_feature ->> p_feature)::int, 0) < p_feature_limit
    )
  )
  RETURNING * INTO v_row;

  RETURN v_row.user_id IS NOT NULL;
END;
$function$;
