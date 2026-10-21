-- PROPOSITION NON APPLIQUEE : staging obligatoire avant activation.
-- Pre-requis : shop_products.id UUID, gear_items.product_id UUID -> shop_products.
-- Ne rejouer AUCUNE migration historique destructive en production.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='gear_items' AND column_name='product_id' AND udt_name='uuid') THEN
    RAISE EXCEPTION 'gear_items.product_id UUID attendu ; mapping a auditer avant migration';
  END IF;
END $$;
CREATE TABLE public.kit_simulation_specs (
  product_id uuid PRIMARY KEY REFERENCES public.shop_products(id) ON DELETE RESTRICT,
  slot text NOT NULL CHECK(slot IN('pack','shelter','bag','pad','rain','light',
    'first_aid','navigation','water_container','water_treatment','cook')),
  weight_g integer CHECK(weight_g>=0),volume_ml integer CHECK(volume_ml>=0),
  comfort_c numeric CHECK(comfort_c BETWEEN -60 AND 50),
  r_value numeric CHECK(r_value BETWEEN 0 AND 15),
  reviewed boolean NOT NULL DEFAULT false,
  offer_verified_at timestamptz,offer_valid_until timestamptz,
  offer_available_units integer CHECK(offer_available_units BETWEEN 0 AND 100),
  CHECK(offer_valid_until IS NULL OR offer_valid_until>offer_verified_at),
  evidence_url text,reviewed_at timestamptz,
  CHECK(NOT reviewed OR (evidence_url IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX kit_simulation_specs_slot ON public.kit_simulation_specs(slot,product_id) WHERE reviewed;
ALTER TABLE public.kit_simulation_specs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kit_simulation_specs FROM anon,authenticated;
GRANT SELECT ON public.kit_simulation_specs TO authenticated;
GRANT ALL ON public.kit_simulation_specs TO service_role;
CREATE POLICY specs_reviewed ON public.kit_simulation_specs FOR SELECT TO authenticated USING(reviewed);
CREATE TABLE public.kit_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  engine_version text NOT NULL,
  input_snapshot jsonb NOT NULL,candidate_snapshot jsonb NOT NULL,result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key),
  CHECK(jsonb_typeof(input_snapshot)='object'),
  CHECK(jsonb_typeof(candidate_snapshot)='array'),
  CHECK(jsonb_typeof(result)='object'),
  CHECK(octet_length(candidate_snapshot::text)<=1048576)
);
CREATE INDEX kit_simulation_runs_owner_created ON public.kit_simulation_runs(user_id,created_at DESC,id DESC);
ALTER TABLE public.kit_simulation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kit_simulation_runs FROM anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.kit_simulation_runs TO authenticated;
GRANT ALL ON public.kit_simulation_runs TO service_role;
CREATE POLICY runs_read ON public.kit_simulation_runs FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()));
CREATE POLICY runs_insert ON public.kit_simulation_runs FOR INSERT TO authenticated
  WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY runs_delete ON public.kit_simulation_runs FOR DELETE TO authenticated
  USING(user_id=(SELECT auth.uid()));
-- Les snapshots sont des aides personnelles non certifiees : le proprietaire
-- peut inserer des donnees arbitraires via REST. Aucun badge de confiance,
-- paiement ou statistique communautaire ne doit se fier a ces lignes.
CREATE OR REPLACE FUNCTION public.kit_simulation_candidates(p_slots text[],p_limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH requested AS (
 SELECT DISTINCT unnest(p_slots) AS slot
 WHERE cardinality(p_slots) BETWEEN 1 AND 16 AND auth.uid() IS NOT NULL
), owned AS (
 SELECT g.id,g.product_id,g.weight_g,
   LEAST(100,GREATEST(0,COALESCE(NULLIF(to_jsonb(g)->>'quantity','')::integer,1))) AS quantity
 FROM public.gear_items g WHERE g.user_id=auth.uid() AND g.product_id IS NOT NULL
 AND COALESCE(to_jsonb(g)->>'status','en_stock') IN('en_stock','a_louer','a_preter')
 AND NOT COALESCE((to_jsonb(g)->>'is_lent')::boolean,false)
 AND to_jsonb(g)->>'transferred_to_user_id' IS NULL
), all_options AS (
 SELECT 'owned:'||g.id::text AS option_id,p.id AS product_id,p.name,s.slot,
   s.weight_g,NULLIF(g.weight_g,0) AS measured_weight_g,s.volume_ml,s.comfort_c,s.r_value,
   s.reviewed AS verified,'owned'::text AS source,0::bigint AS price_cents,
   'EUR'::text AS currency,g.quantity AS available_units,
   now()+interval '5 minutes' AS valid_until
 FROM owned g JOIN public.shop_products p ON p.id=g.product_id
 JOIN public.kit_simulation_specs s ON s.product_id=p.id
 JOIN requested r ON r.slot=s.slot WHERE s.reviewed AND g.quantity>0
 UNION ALL
 SELECT 'new:'||p.id::text,p.id,p.name,s.slot,s.weight_g,NULL::integer,
   s.volume_ml,s.comfort_c,s.r_value,s.reviewed,'new',
   round(p.price_eur*100)::bigint,'EUR',s.offer_available_units,s.offer_valid_until
 FROM public.shop_products p JOIN public.kit_simulation_specs s ON s.product_id=p.id
 JOIN requested r ON r.slot=s.slot WHERE s.reviewed AND p.available AND p.price_eur>=0
 AND s.offer_verified_at<=now() AND s.offer_valid_until>now() AND s.offer_available_units>0
), ranked AS (
 SELECT a.*,row_number() OVER(PARTITION BY slot,source ORDER BY price_cents,
   COALESCE(measured_weight_g,weight_g) NULLS LAST,option_id) AS position
 FROM all_options a
)
SELECT COALESCE(jsonb_agg(to_jsonb(r)-'position' ORDER BY slot,source,position),'[]'::jsonb)
FROM ranked r WHERE position<=LEAST(32,GREATEST(1,p_limit));
$$;
REVOKE ALL ON FUNCTION public.kit_simulation_candidates(text[],integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kit_simulation_candidates(text[],integer) TO authenticated;
COMMIT;
