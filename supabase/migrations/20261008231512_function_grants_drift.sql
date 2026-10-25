-- ============================================================================
-- Revue des fonctions SECURITY DEFINER (plan 2.4), 8-9 octobre 2026.
--
-- Les droits posés le 21 septembre (20260921100000_legacy_hardening, bien
-- enregistrée en production) étaient repartis pour neuf fonctions : EXECUTE de
-- nouveau accordé à PUBLIC (donc à anon), ou à authenticated pour une fonction
-- réservée au serveur. Constat du 8 octobre (conseiller Supabase + pg_proc.proacl) :
--
--   (a) appelées avec la session de la personne (src/) : authenticated garde
--       EXECUTE, anon le perd. Chacune vérifie auth.uid() en interne.
--         get_user_badges_progress  (FideliteTab)
--         record_hike_gear_usage    (SmartDepartureEngine)
--         request_withdrawal        (/api/rewards/withdraw)
--         toggle_community_post_like (CommunityPostCard)
--   (b) jamais appelées par l'app avec une session (aucun .rpc() dans src/ ni
--       supabase/functions) : réservées à service_role.
--         get_comparable_sales, get_occasion_listing_for_product,
--         get_hiking_routes_geojson, get_trail_pois_geojson,
--         refresh_user_field_signature (une session, même d'essai anonyme,
--         pouvait relancer à volonté le recalcul d'une vue matérialisée)
--   (c) fonctions trigger : jamais des RPC, EXECUTE retiré à tous (le
--       déclenchement d'un trigger ne vérifie pas ce droit).
--         trg_compat_loans_*, trg_compat_products_*, validate_cart_line_reference
--
-- Plus les deux `search_path` mobiles relevés par le conseiller (fonctions SQL
-- en SECURITY INVOKER, sans table non qualifiée) : verrouillés à ''.
--
-- Additive et idempotente : chaque instruction est gardée par to_regprocedure.
-- ============================================================================

DO $$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.get_user_badges_progress(uuid)',
    'public.record_hike_gear_usage(uuid[])',
    'public.request_withdrawal(numeric,text,text,jsonb)',
    'public.toggle_community_post_like(uuid)'
  ] LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_sig);
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.get_comparable_sales(uuid,integer)',
    'public.get_occasion_listing_for_product(uuid)',
    'public.get_hiking_routes_geojson()',
    'public.get_trail_pois_geojson()',
    'public.refresh_user_field_signature()'
  ] LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.trg_compat_loans_delete()',
    'public.trg_compat_loans_insert()',
    'public.trg_compat_loans_update()',
    'public.trg_compat_products_delete()',
    'public.trg_compat_products_insert()',
    'public.trg_compat_products_update()',
    'public.validate_cart_line_reference()'
  ] LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    END IF;
  END LOOP;

  IF to_regprocedure('public.progression_allocations_valid(integer,jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.progression_allocations_valid(integer, jsonb) SET search_path = '';
  END IF;
  IF to_regprocedure('public.progression_level_for(integer)') IS NOT NULL THEN
    ALTER FUNCTION public.progression_level_for(integer) SET search_path = '';
  END IF;
END $$;
