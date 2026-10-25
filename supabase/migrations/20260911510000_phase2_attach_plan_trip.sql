-- ==============================================================================
-- Phase 2 — Unifier la chaîne d'identifiants (attachement plan → voyage)
--
-- Chantier LANCEMENT_MONDIAL §Phase 2 : empêcher les plans orphelins. Un plan
-- Adventure généré (POST /api/adventure/generate) naît sans `trip_id` ; cette
-- commande l'attache explicitement au voyage de l'utilisateur, vérifie la
-- double propriété (plan et voyage), refuse tout rattachement à un autre
-- voyage et propage le `correlation_id` de la chaîne. Migration strictement
-- additive et idempotente (CREATE OR REPLACE, gardes pg_roles).
--
--   • RPC attach_adventure_plan_to_trip(...) : SECURITY DEFINER + search_path
--     verrouillé, auth.uid() requis, idempotente si le plan est déjà attaché
--     au même voyage, exception si le plan est attaché à un AUTRE voyage.
--     Retourne {plan_id, trip_id, correlation_id}.
--   • Corrélation : p_correlation_id prime, sinon la corrélation existante du
--     plan est conservée, sinon génération. `trips` ne porte pas de colonne
--     correlation_id (la chaîne la stocke sur les pivots) — rien n'est écrit
--     sur le voyage.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.attach_adventure_plan_to_trip(
  p_plan_id uuid,
  p_trip_id uuid,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user              uuid := auth.uid();
  v_owner             uuid;
  v_current_trip      uuid;
  v_plan_correlation  uuid;
  v_trip_owner        uuid;
  v_correlation       uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'attach_adventure_plan_to_trip: authentification requise';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'attach_adventure_plan_to_trip: p_plan_id obligatoire';
  END IF;
  IF p_trip_id IS NULL THEN
    RAISE EXCEPTION 'attach_adventure_plan_to_trip: p_trip_id obligatoire';
  END IF;

  -- Double propriété vérifiée sous verrou : une ré-attachement concurrent est
  -- sérialisé et ne peut pas créer deux chaînes divergentes.
  SELECT owner_id, trip_id, correlation_id
  INTO v_owner, v_current_trip, v_plan_correlation
  FROM public.adventure_plans
  WHERE id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'attach_adventure_plan_to_trip: plan % introuvable', p_plan_id;
  END IF;
  IF v_owner <> v_user THEN
    RAISE EXCEPTION
      'attach_adventure_plan_to_trip: plan % non détenu par l''utilisateur %',
      p_plan_id, v_user;
  END IF;

  -- Un plan déjà attaché reste sur son voyage : jamais de réaffectation
  -- silencieuse (la chaîne voyage → plan doit rester univoque).
  IF v_current_trip IS NOT NULL AND v_current_trip <> p_trip_id THEN
    RAISE EXCEPTION
      'attach_adventure_plan_to_trip: plan % déjà attaché au voyage %',
      p_plan_id, v_current_trip;
  END IF;

  SELECT user_id
  INTO v_trip_owner
  FROM public.trips
  WHERE id = p_trip_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'attach_adventure_plan_to_trip: voyage % introuvable', p_trip_id;
  END IF;
  IF v_trip_owner <> v_user THEN
    RAISE EXCEPTION
      'attach_adventure_plan_to_trip: voyage % non détenu par l''utilisateur %',
      p_trip_id, v_user;
  END IF;

  v_correlation := COALESCE(p_correlation_id, v_plan_correlation, gen_random_uuid());

  UPDATE public.adventure_plans
  SET trip_id = p_trip_id,
      correlation_id = v_correlation,
      updated_at = now()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'trip_id', p_trip_id,
    'correlation_id', v_correlation
  );
END;
$fn$;

COMMENT ON FUNCTION public.attach_adventure_plan_to_trip(uuid,uuid,uuid) IS
  'Phase 2 — attache un plan Adventure orphelin au voyage de son propriétaire '
  '(double propriété vérifiée), idempotent sur le même voyage, refuse toute '
  'réaffectation vers un autre voyage et propage le correlation_id de la chaîne. '
  'SECURITY DEFINER, authenticated uniquement.';

REVOKE ALL ON FUNCTION public.attach_adventure_plan_to_trip(uuid,uuid,uuid) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.attach_adventure_plan_to_trip(uuid,uuid,uuid) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.attach_adventure_plan_to_trip(uuid,uuid,uuid)
  TO authenticated;
