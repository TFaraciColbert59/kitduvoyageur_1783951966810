-- ==============================================================================
-- A13 (S3) — Append transactionnel d'une version de plan (groupe / trek)
--
-- Les flux S3 calculent des agrégats (plan de groupe public, simulation trek)
-- et doivent les persister comme version immuable du plan, sans schéma
-- nouveau : une seule fonction transactionnelle.
--
--   • a13_append_plan_version(p_user_id, p_plan_id, p_version) :
--     vérifie que le plan appartient à p_user_id (verrou FOR UPDATE), insère la
--     version suivante et met à jour adventure_plans.current_version/updated_at.
--   • Le numéro de version fait autorité côté base : `snapshot.currentVersion`
--     est réécrit avec le numéro réellement inséré (aucune divergence possible).
--   • SECURITY DEFINER + search_path verrouillé, REVOKE anon/authenticated,
--     GRANT service_role : la route serveur applique l'ownership avant l'appel.
--
-- Migration additive et idempotente. Aucune donnée inventée : le snapshot est
-- repris tel quel, seule la version est calculée côté base.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.a13_append_plan_version(
  p_user_id uuid,
  p_plan_id uuid,
  p_version jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_owner uuid;
  v_current integer;
  v_next integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'a13_append_plan_version: p_user_id obligatoire';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'a13_append_plan_version: p_plan_id obligatoire';
  END IF;
  IF p_version IS NULL OR jsonb_typeof(p_version) <> 'object' THEN
    RAISE EXCEPTION 'a13_append_plan_version: p_version jsonb objet obligatoire';
  END IF;
  IF p_version->'snapshot' IS NULL OR jsonb_typeof(p_version->'snapshot') <> 'object' THEN
    RAISE EXCEPTION 'a13_append_plan_version: p_version.snapshot jsonb objet obligatoire';
  END IF;
  IF COALESCE(NULLIF(p_version->>'reason', ''), '') = '' THEN
    RAISE EXCEPTION 'a13_append_plan_version: p_version.reason obligatoire';
  END IF;

  -- Propriété vérifiée sous verrou : deux appends concurrents du même plan sont
  -- sérialisés (numéros de version fiables).
  SELECT owner_id, current_version
  INTO v_owner, v_current
  FROM public.adventure_plans
  WHERE id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a13_append_plan_version: plan % introuvable', p_plan_id;
  END IF;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION
      'a13_append_plan_version: plan % non détenu par l''utilisateur %',
      p_plan_id, p_user_id;
  END IF;

  v_next := GREATEST(
    v_current,
    COALESCE(
      (SELECT MAX(version) FROM public.adventure_plan_versions WHERE plan_id = p_plan_id),
      0
    )
  ) + 1;

  INSERT INTO public.adventure_plan_versions (
    plan_id, version, snapshot, reason, generated_by, confidence, created_at
  )
  VALUES (
    p_plan_id,
    v_next,
    jsonb_set(p_version->'snapshot', '{currentVersion}', to_jsonb(v_next), true),
    p_version->>'reason',
    COALESCE(NULLIF(p_version->>'generated_by', ''), 'a13-append'),
    COALESCE(p_version->'confidence', '{}'::jsonb),
    COALESCE((NULLIF(p_version->>'created_at', ''))::timestamptz, now())
  );

  UPDATE public.adventure_plans
  SET current_version = v_next,
      updated_at = now()
  WHERE id = p_plan_id;

  RETURN v_next;
END;
$fn$;

COMMENT ON FUNCTION public.a13_append_plan_version(uuid, uuid, jsonb) IS
  'A13 (S3) — append transactionnel d''une version de plan (groupe/trek) : '
  'propriété vérifiée sous verrou, version calculée en base et réécrite dans '
  'snapshot.currentVersion, mise à jour de current_version/updated_at. '
  'SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.a13_append_plan_version(uuid, uuid, jsonb) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a13_append_plan_version(uuid, uuid, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a13_append_plan_version(uuid, uuid, jsonb) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a13_append_plan_version(uuid, uuid, jsonb)
  TO service_role;
