-- ==============================================================================
-- A13 (S2) — Matérialisation transactionnelle d'un candidat sélectionné
--
-- Le flux produit expose trois plans complets réellement comparables
-- (`candidatePlans` + `candidateComparison`). La sélection utilisateur doit
-- devenir une version immuable du plan, sans jamais laisser de version,
-- compteur ou décision partiels.
--
--   • a13_materialize_candidate(p_user_id, p_plan_id, p_version, p_decision) :
--     vérifie que le plan appartient à p_user_id (verrou FOR UPDATE), insère la
--     version suivante, met à jour adventure_plans.current_version/updated_at et
--     journalise la décision confirmée (decision_type='other', decided_by
--     = p_user_id) — le tout dans une seule transaction.
--   • Idempotence : un snapshot dont `snapshot->>'candidateId'` a déjà été
--     matérialisé renvoie la version existante, sans insérer de doublon.
--   • SECURITY DEFINER + search_path verrouillé, REVOKE anon/authenticated,
--     GRANT service_role : la route serveur applique l'ownership avant l'appel.
--
-- Migration additive et idempotente. Aucune donnée inventée : le snapshot est
-- repris tel quel, seule la version est calculée côté base.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.a13_materialize_candidate(
  p_user_id uuid,
  p_plan_id uuid,
  p_version jsonb,
  p_decision jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_owner uuid;
  v_current integer;
  v_candidate_id text;
  v_existing integer;
  v_next integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'a13_materialize_candidate: p_user_id obligatoire';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'a13_materialize_candidate: p_plan_id obligatoire';
  END IF;
  IF p_version IS NULL OR jsonb_typeof(p_version) <> 'object' THEN
    RAISE EXCEPTION 'a13_materialize_candidate: p_version jsonb objet obligatoire';
  END IF;
  IF p_version->'snapshot' IS NULL OR jsonb_typeof(p_version->'snapshot') <> 'object' THEN
    RAISE EXCEPTION 'a13_materialize_candidate: p_version.snapshot jsonb objet obligatoire';
  END IF;

  v_candidate_id := NULLIF(p_version->'snapshot'->>'candidateId', '');
  IF v_candidate_id IS NULL THEN
    RAISE EXCEPTION
      'a13_materialize_candidate: candidateId obligatoire dans p_version.snapshot';
  END IF;

  -- Propriété vérifiée sous verrou : deux sélections concurrentes du même plan
  -- sont sérialisées (numéros de version et idempotence fiables).
  SELECT owner_id, current_version
  INTO v_owner, v_current
  FROM public.adventure_plans
  WHERE id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a13_materialize_candidate: plan % introuvable', p_plan_id;
  END IF;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION
      'a13_materialize_candidate: plan % non détenu par l''utilisateur %',
      p_plan_id, p_user_id;
  END IF;

  -- Idempotence : le même candidateId déjà matérialisé renvoie sa version.
  SELECT version
  INTO v_existing
  FROM public.adventure_plan_versions
  WHERE plan_id = p_plan_id
    AND snapshot->>'candidateId' = v_candidate_id
  ORDER BY version DESC
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
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
    p_version->'snapshot',
    COALESCE(NULLIF(p_version->>'reason', ''), 'Sélection variante (A13)'),
    COALESCE(NULLIF(p_version->>'generated_by', ''), 'a13-select'),
    COALESCE(p_version->'confidence', '{}'::jsonb),
    COALESCE((NULLIF(p_version->>'created_at', ''))::timestamptz, now())
  );

  UPDATE public.adventure_plans
  SET current_version = v_next,
      updated_at = now()
  WHERE id = p_plan_id;

  INSERT INTO public.adventure_plan_decisions (
    plan_id, decision_type, proposal, impact, requires_confirmation,
    status, decided_by, decided_at, created_at
  )
  VALUES (
    p_plan_id,
    'other',
    COALESCE(NULLIF(p_decision->>'proposal', ''), 'Sélection variante ' || v_candidate_id),
    COALESCE(p_decision->'impact', '[]'::jsonb),
    COALESCE((p_decision->>'requires_confirmation')::boolean, false),
    'confirmed',
    p_user_id,
    now(),
    COALESCE((NULLIF(p_decision->>'created_at', ''))::timestamptz, now())
  );

  RETURN v_next;
END;
$fn$;

COMMENT ON FUNCTION public.a13_materialize_candidate(uuid, uuid, jsonb, jsonb) IS
  'A13 (S2) — matérialisation transactionnelle d''un candidat sélectionné : '
  'propriété vérifiée sous verrou, insertion de la version suivante, mise à '
  'jour de current_version/updated_at et journalisation de la décision '
  'confirmée. Idempotente par snapshot->>candidateId. '
  'SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.a13_materialize_candidate(uuid, uuid, jsonb, jsonb) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a13_materialize_candidate(uuid, uuid, jsonb, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a13_materialize_candidate(uuid, uuid, jsonb, jsonb) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a13_materialize_candidate(uuid, uuid, jsonb, jsonb)
  TO service_role;
