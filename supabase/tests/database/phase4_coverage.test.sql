-- ============================================================================
-- Phase 4 — Couverture mondiale, randonnées et POI (pgTAP)
--   • TEST-PHASE4-DB-01 : structure, RLS, flag de publication désactivé.
--   • TEST-PHASE4-DB-02 : registre de licences — import refusé sans licence.
--   • TEST-PHASE4-DB-03 : jamais `covered` sans dataset/licence/seuils/preuves.
--   • TEST-PHASE4-DB-04 : transitions de statut et publication encadrées.
--   • TEST-PHASE4-DB-05 : promotion et rollback de dataset (historique gardé).
--   • TEST-PHASE4-DB-06 : RLS — lecture publique seulement pour `covered`.
--   • TEST-PHASE4-DB-07 : séparation POI/offres/affiliation horodatée.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.coverage_licenses, public.coverage_regions,
  public.coverage_datasets,
  public.affiliate_offers, public.affiliate_links, public.affiliate_partners,
  public.user_profiles
TO service_role, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  public.coverage_licenses, public.coverage_regions,
  public.coverage_datasets, public.coverage_dataset_events
FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_dataset_events TO service_role, authenticated;
GRANT SELECT ON public.coverage_licenses, public.coverage_regions,
  public.coverage_datasets, public.poi_offers_served
TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.coverage_dataset_events_id_seq TO service_role, authenticated;
SELECT plan(58);

-- ============================================================================
-- TEST-PHASE4-DB-01 — Structure
-- ============================================================================
SELECT ok(
  to_regclass('public.coverage_licenses') IS NOT NULL
  AND to_regclass('public.coverage_regions') IS NOT NULL
  AND to_regclass('public.coverage_datasets') IS NOT NULL
  AND to_regclass('public.coverage_dataset_events') IS NOT NULL,
  '1. DB-01. Les 4 tables de couverture existent'
);
SELECT ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN ('public.coverage_licenses'::regclass, 'public.coverage_regions'::regclass,
                 'public.coverage_datasets'::regclass, 'public.coverage_dataset_events'::regclass)),
  '2. DB-01. RLS activée sur les 4 tables'
);
SELECT ok(
  (SELECT bool_and(relforcerowsecurity) FROM pg_class
   WHERE oid IN ('public.coverage_licenses'::regclass, 'public.coverage_regions'::regclass,
                 'public.coverage_datasets'::regclass)),
  '3. DB-01. RLS forcée sur licences/régions/datasets'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.feature_flags
          WHERE id = 'coverage_publication_enabled' AND enabled = false),
  '4. DB-01. Flag coverage_publication_enabled présent et DÉSACTIVÉ'
);
SELECT is(
  (SELECT count(*)::int FROM public.coverage_regions
   WHERE status = 'covered' AND active_dataset_id IS NULL),
  0,
  '5. DB-01. Aucune région `covered` sans dataset actif (invariant global)'
);
SELECT ok(
  to_regprocedure('public.coverage_promote_dataset(uuid,text)') IS NOT NULL
  AND to_regprocedure('public.coverage_rollback_region(uuid,uuid,text,text)') IS NOT NULL,
  '6. DB-01. Fonctions promotion/rollback présentes'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'poi_offers_served'
      AND column_name = 'has_affiliate_link'
  ),
  '7. DB-01. Vue poi_offers_served expose has_affiliate_link'
);
SELECT ok(
  (SELECT count(*) = 4 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'affiliate_offers'
     AND column_name IN ('link_id', 'price_checked_at', 'availability_checked_at', 'expires_at')),
  '8. DB-01. affiliate_offers : horodatage prix/dispo + expiration + lien'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coverage_regions'
      AND policyname = 'coverage_regions_public_covered_read'
      AND qual::text LIKE '%covered%'
  ),
  '9. DB-01. Politique de lecture publique limitée à `covered`'
);

-- ============================================================================
-- Fixtures
-- ============================================================================
INSERT INTO public.coverage_licenses (id, code, name, allows_redistribution, evidence_url)
VALUES
  ('c4a00000-0000-4000-8000-000000000001', 'phase4-lic-test', 'Licence de test (redistribuable)', true, 'https://example.invalid/phase4-licence'),
  ('c4a00000-0000-4000-8000-000000000002', 'phase4-lic-noredist', 'Licence de test (sans redistribution)', false, 'https://example.invalid/phase4-licence-2'),
  ('c4a00000-0000-4000-8000-000000000003', 'phase4-lic-revoked', 'Licence de test (révoquée)', true, 'https://example.invalid/phase4-licence-3');
UPDATE public.coverage_licenses
   SET status = 'revoked', revoked_at = now()
 WHERE id = 'c4a00000-0000-4000-8000-000000000003';

INSERT INTO public.coverage_regions (id, country_iso_a2, region_code, region_name)
VALUES
  ('c4b00000-0000-4000-8000-000000000001', 'FR', 'phase4-test', 'Région Phase 4 (test)'),
  ('c4b00000-0000-4000-8000-000000000002', 'FR', 'phase4-test-2', 'Région Phase 4 n°2 (test)');

-- Datasets : ds_ok (métriques conformes), ds_low (métriques insuffisantes),
-- ds_breaks (ruptures), ds_stage (staged), ds_r2 (autre région), ds_tmp (licence révoquée plus tard).
INSERT INTO public.coverage_datasets
  (id, region_id, dataset_key, version, source_name, license_id, status, pipeline_version, import_actor,
   total_features, valid_geometries, invalid_geometries, unjustified_breaks, sourced_pois, sampled_routes)
VALUES
  ('c4c00000-0000-4000-8000-000000000001', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds', 'v1', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'staged', 'phase4-1.0.0', 'test-agent', 0, 0, 0, 0, 0, 0),
  ('c4c00000-0000-4000-8000-000000000002', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds', 'v2', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'validated', 'phase4-1.0.0', 'test-agent', 30, 28, 2, 0, 40, 20),
  ('c4c00000-0000-4000-8000-000000000003', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds', 'v3', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'validated', 'phase4-1.0.0', 'test-agent', 30, 5, 25, 0, 40, 20),
  ('c4c00000-0000-4000-8000-000000000004', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds', 'v4', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'validated', 'phase4-1.0.0', 'test-agent', 30, 28, 2, 5, 40, 20),
  ('c4c00000-0000-4000-8000-000000000005', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds-stage', 'v1', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'staged', 'phase4-1.0.0', 'test-agent', 10, 10, 0, 0, 0, 0),
  ('c4c00000-0000-4000-8000-000000000006', 'c4b00000-0000-4000-8000-000000000002',
   'phase4-ds-r2', 'v1', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'validated', 'phase4-1.0.0', 'test-agent', 30, 28, 2, 0, 40, 20),
  ('c4c00000-0000-4000-8000-000000000007', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds-revoked', 'v1', 'Source test', 'c4a00000-0000-4000-8000-000000000002', 'staged', 'phase4-1.0.0', 'test-agent', 5, 5, 0, 0, 0, 0),
  ('c4c00000-0000-4000-8000-000000000008', 'c4b00000-0000-4000-8000-000000000001',
   'phase4-ds', 'v5', 'Source test', 'c4a00000-0000-4000-8000-000000000001', 'validated', 'phase4-1.0.0', 'test-agent', 31, 29, 2, 0, 41, 20);

-- ============================================================================
-- TEST-PHASE4-DB-02 — Registre de licences / garde-fou d'import
-- ============================================================================
SELECT throws_ok(
  $$INSERT INTO public.coverage_licenses (code, name, allows_redistribution)
    VALUES ('phase4-lic-no-evidence', 'Licence sans preuve', true)$$,
  '23514', NULL,
  '10. DB-02. Licence sans preuve humaine refusée'
);
SELECT throws_ok(
  $$INSERT INTO public.coverage_datasets
      (region_id, dataset_key, version, source_name, license_id, status, pipeline_version, import_actor)
    VALUES ('c4b00000-0000-4000-8000-000000000001', 'phase4-ds-x', 'vX', 'Source test',
            'c4a00000-0000-4000-8000-00000000ffff', 'staged', 'phase4-1.0.0', 'test-agent')$$,
  '23514', NULL,
  '11. DB-02. Import refusé : licence inconnue'
);
SELECT throws_ok(
  $$INSERT INTO public.coverage_datasets
      (region_id, dataset_key, version, source_name, license_id, status, pipeline_version, import_actor)
    VALUES ('c4b00000-0000-4000-8000-000000000001', 'phase4-ds-y', 'vY', 'Source test',
            'c4a00000-0000-4000-8000-000000000003', 'staged', 'phase4-1.0.0', 'test-agent')$$,
  '23514', NULL,
  '12. DB-02. Import refusé : licence révoquée'
);
SELECT throws_ok(
  $$INSERT INTO public.coverage_datasets
      (region_id, dataset_key, version, source_name, license_id, status, pipeline_version, import_actor)
    VALUES ('c4b00000-0000-4000-8000-000000000001', 'phase4-ds-z', 'vZ', 'Source test',
            'c4a00000-0000-4000-8000-000000000002', 'validated', 'phase4-1.0.0', 'test-agent')$$,
  '23514', NULL,
  '13. DB-02. Statut validé refusé : licence sans redistribution'
);
SELECT lives_ok(
  $$INSERT INTO public.coverage_datasets
      (region_id, dataset_key, version, source_name, license_id, status, pipeline_version, import_actor)
    VALUES ('c4b00000-0000-4000-8000-000000000001', 'phase4-ds-z2', 'vZ2', 'Source test',
            'c4a00000-0000-4000-8000-000000000002', 'staged', 'phase4-1.0.0', 'test-agent')$$,
  '14. DB-02. Import staged accepté avec licence enregistrée'
);
SELECT lives_ok(
  $$INSERT INTO public.coverage_datasets
      (region_id, dataset_key, version, source_name, license_id, status, pipeline_version, import_actor)
    VALUES ('c4b00000-0000-4000-8000-000000000001', 'phase4-ds-ok2', 'vOK', 'Source test',
            'c4a00000-0000-4000-8000-000000000001', 'staged', 'phase4-1.0.0', 'test-agent')$$,
  '15. DB-02. Import staged accepté avec licence active redistribuable'
);

-- ============================================================================
-- TEST-PHASE4-DB-03 — Jamais `covered` sans preuves
-- ============================================================================
SELECT throws_ok(
  $$UPDATE public.coverage_regions SET status = 'covered'
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '16. DB-03. `covered` sans dataset actif refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000006', status = 'covered'
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '17. DB-03. Dataset d''une autre région refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000002', status = 'covered'
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '18. DB-03. `covered` sans seuils explicites refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000002', status = 'covered',
        thresholds = '{"min_valid_geometries":20,"min_sourced_pois":10,"min_sampled_routes":19,"max_unjustified_breaks":1}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '19. DB-03. Seuil d''échantillonnage humain < 20 refusé (gate)'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000003', status = 'covered',
        thresholds = '{"min_valid_geometries":20,"min_sourced_pois":10,"min_sampled_routes":20,"max_unjustified_breaks":1}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '20. DB-03. Géométries valides sous le seuil refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000002', status = 'covered',
        thresholds = '{"min_valid_geometries":20,"min_sourced_pois":41,"min_sampled_routes":20,"max_unjustified_breaks":1}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '21. DB-03. POI sourcés sous le seuil refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000002', status = 'covered',
        thresholds = '{"min_valid_geometries":20,"min_sourced_pois":10,"min_sampled_routes":21,"max_unjustified_breaks":1}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '22. DB-03. Parcours échantillonnés sous le seuil refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000004', status = 'covered',
        thresholds = '{"min_valid_geometries":20,"min_sourced_pois":10,"min_sampled_routes":20,"max_unjustified_breaks":1}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '23. DB-03. Ruptures injustifiées au-dessus du seuil refusé'
);
SELECT throws_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000005', status = 'covered',
        thresholds = '{"min_valid_geometries":1,"min_sourced_pois":0,"min_sampled_routes":20,"max_unjustified_breaks":0}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '23514', NULL,
  '24. DB-03. Dataset non validé (staged) refusé'
);
SELECT lives_ok(
  $$UPDATE public.coverage_regions
    SET active_dataset_id = 'c4c00000-0000-4000-8000-000000000002', status = 'covered',
        thresholds = '{"min_valid_geometries":20,"min_sourced_pois":10,"min_sampled_routes":20,"max_unjustified_breaks":1}'::jsonb
    WHERE id = 'c4b00000-0000-4000-8000-000000000001'$$,
  '25. DB-03. `covered` accepté quand toutes les preuves sont réunies'
);
SELECT is(
  (SELECT status::text FROM public.coverage_regions
   WHERE id = 'c4b00000-0000-4000-8000-000000000001'),
  'covered',
  '26. DB-03. Statut réellement `covered`'
);
SELECT ok(
  (SELECT published_at IS NOT NULL FROM public.coverage_regions
   WHERE id = 'c4b00000-0000-4000-8000-000000000001'),
  '27. DB-03. Horodatage de publication renseigné automatiquement'
);

-- Licence révoquée après coup : toute republication/transition est refusée.
UPDATE public.coverage_licenses
   SET status = 'revoked', revoked_at = now()
 WHERE id = 'c4a00000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$UPDATE public.coverage_datasets SET status = 'validated'
    WHERE id = 'c4c00000-0000-4000-8000-000000000007'$$,
  '23514', NULL,
  '28. DB-03. Licence révoquée : validation refusée'
);

-- ============================================================================
-- TEST-PHASE4-DB-04 — Transitions de statut
-- ============================================================================
SELECT throws_ok(
  $$UPDATE public.coverage_datasets SET status = 'published'
    WHERE id = 'c4c00000-0000-4000-8000-000000000005'$$,
  '23514', NULL,
  '29. DB-04. Transition staged → published interdite'
);
SELECT lives_ok(
  $$UPDATE public.coverage_datasets SET status = 'validated'
    WHERE id = 'c4c00000-0000-4000-8000-000000000005'$$,
  '30. DB-04. Transition staged → validated autorisée'
);
SELECT lives_ok(
  $$UPDATE public.coverage_datasets SET status = 'staged'
    WHERE id = 'c4c00000-0000-4000-8000-000000000005'$$,
  '31. DB-04. Transition validated → staged autorisée (retour atelier)'
);

-- ============================================================================
-- TEST-PHASE4-DB-05 — Promotion / rollback (service_role)
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_ok(
  $$SELECT public.coverage_promote_dataset('c4c00000-0000-4000-8000-000000000002', 'test-agent')$$,
  '42501', NULL,
  '32. DB-05. Promotion refusée à un utilisateur non admin'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$SELECT public.coverage_promote_dataset('c4c00000-0000-4000-8000-000000000002', '')$$,
  '23514', NULL,
  '33. DB-05. Promotion refusée sans acteur d''import'
);
SELECT throws_ok(
  $$SELECT public.coverage_promote_dataset('c4c00000-0000-4000-8000-000000000005', 'test-agent')$$,
  '23514', NULL,
  '34. DB-05. Promotion d''un dataset staged refusée'
);
SELECT lives_ok(
  $$SELECT public.coverage_promote_dataset('c4c00000-0000-4000-8000-000000000002', 'test-agent')$$,
  '35. DB-05. Promotion du dataset validé acceptée (service_role)'
);
SELECT is(
  (SELECT status::text FROM public.coverage_datasets
   WHERE id = 'c4c00000-0000-4000-8000-000000000002'),
  'published',
  '36. DB-05. Dataset promu publié'
);
SELECT lives_ok(
  $$SELECT public.coverage_promote_dataset('c4c00000-0000-4000-8000-000000000008', 'test-agent')$$,
  '37. DB-05. Promotion d''une nouvelle version acceptée'
);
SELECT is(
  (SELECT status::text FROM public.coverage_datasets
   WHERE id = 'c4c00000-0000-4000-8000-000000000002'),
  'rolled_back',
  '38. DB-05. Version précédente conservée en rolled_back (rollback possible)'
);
SELECT lives_ok(
  $$SELECT public.coverage_rollback_region(
      'c4b00000-0000-4000-8000-000000000001',
      'c4c00000-0000-4000-8000-000000000002',
      'test-agent', 'régression qualité détectée')$$,
  '39. DB-05. Rollback vers la version précédente accepté'
);
SELECT is(
  (SELECT active_dataset_id FROM public.coverage_regions
   WHERE id = 'c4b00000-0000-4000-8000-000000000001'),
  'c4c00000-0000-4000-8000-000000000002'::uuid,
  '40. DB-05. La région repointe vers l''ancienne version'
);
SELECT is(
  (SELECT status::text FROM public.coverage_datasets
   WHERE id = 'c4c00000-0000-4000-8000-000000000008'),
  'rolled_back',
  '41. DB-05. La version défectueuse est marquée rolled_back'
);
SELECT ok(
  (SELECT evidence ? 'last_rollback' FROM public.coverage_regions
   WHERE id = 'c4b00000-0000-4000-8000-000000000001'),
  '42. DB-05. Le rollback est tracé (acteur, raison, versions)'
);
SELECT ok(
  (SELECT count(*) >= 2 FROM public.coverage_dataset_events
   WHERE dataset_id = 'c4c00000-0000-4000-8000-000000000002'
     AND event IN ('published', 'rolled_back')),
  '43. DB-05. Journal : publications/rollbacks tracés'
);
SELECT throws_ok(
  $$SELECT public.coverage_rollback_region(
      'c4b00000-0000-4000-8000-000000000001',
      'c4c00000-0000-4000-8000-000000000005',
      'test-agent')$$,
  '23514', NULL,
  '44. DB-05. Rollback refusé : dataset staged non promouvable'
);
SELECT lives_ok(
  $$SELECT public.coverage_promote_dataset('c4c00000-0000-4000-8000-000000000008', 'test-agent')$$,
  '45. DB-05. Re-promotion d''une version rollbackée acceptée (promouvable)'
);
RESET ROLE;

SELECT throws_ok(
  $$UPDATE public.coverage_datasets SET status = 'staged'
    WHERE id = 'c4c00000-0000-4000-8000-000000000008'$$,
  '23514', NULL,
  '46. DB-04. Transition published → staged interdite'
);

-- ============================================================================
-- TEST-PHASE4-DB-06 — RLS : lecture publique seulement pour `covered`
-- ============================================================================
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.coverage_regions
   WHERE region_code LIKE 'phase4-%'),
  1,
  '47. DB-06. anon ne voit que la région `covered`'
);
SELECT is(
  (SELECT count(*)::int FROM public.coverage_datasets d
   JOIN public.coverage_regions r ON r.id = d.region_id
   WHERE r.region_code LIKE 'phase4-%'),
  1,
  '48. DB-06. anon ne voit que le dataset actif d''une région couverte'
);
SELECT throws_ok(
  $$INSERT INTO public.coverage_regions (country_iso_a2, region_code)
    VALUES ('FR', 'phase4-anon-write')$$,
  '42501', NULL,
  '49. DB-06. anon ne peut pas écrire une couverture'
);
SELECT is(
  (SELECT count(*)::int FROM public.coverage_dataset_events),
  0,
  '50. DB-06. anon ne voit aucun événement du journal d''audit (RLS)'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c4d00000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT count(*)::int FROM public.coverage_regions
   WHERE region_code LIKE 'phase4-%'),
  1,
  '51. DB-06. authenticated non admin ne voit que `covered`'
);
RESET ROLE;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('c4d00000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated',
        'phase4_admin@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES ('c4d00000-0000-4000-8000-0000000000a1', 'Admin Phase 4', 'phase4_admin@test.local', 'admin', 90)
ON CONFLICT (id) DO UPDATE SET role = 'admin', trust_score = 90;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c4d00000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT count(*)::int FROM public.coverage_regions
   WHERE region_code LIKE 'phase4-%'),
  2,
  '52. DB-06. L''admin voit toutes les régions (y compris non couvertes)'
);
SELECT lives_ok(
  $$INSERT INTO public.coverage_regions (country_iso_a2, region_code, region_name)
    VALUES ('FR', 'phase4-admin-write', 'Région créée par admin')$$,
  '53. DB-06. L''admin peut écrire une région non couverte'
);
RESET ROLE;

-- ============================================================================
-- TEST-PHASE4-DB-07 — Séparation POI / offres / affiliation horodatée
-- ============================================================================
INSERT INTO public.affiliate_partners (id, slug, name, network, is_active)
VALUES ('c4e00000-0000-4000-8000-000000000001', 'phase4-partner', 'Partenaire Phase 4', 'travelpayouts', true);

INSERT INTO public.affiliate_links (id, slug, partner_id, category, title, target_url, is_active)
VALUES ('c4e00000-0000-4000-8000-000000000002', 'phase4-link', 'c4e00000-0000-4000-8000-000000000001',
        'hotel', 'Hôtel Phase 4', 'https://example.invalid/hotel', true);

SELECT throws_ok(
  $$INSERT INTO public.affiliate_offers (title, affiliate_url, price, currency)
    VALUES ('Offre sans horodatage prix', 'https://example.invalid/offre-1', 42, 'EUR')$$,
  '23514', NULL,
  '54. DB-07. Prix sans horodatage de vérification refusé'
);
SELECT throws_ok(
  $$INSERT INTO public.affiliate_offers (title, affiliate_url, availability, currency)
    VALUES ('Offre sans horodatage dispo', 'https://example.invalid/offre-2', true, 'EUR')$$,
  '23514', NULL,
  '55. DB-07. Disponibilité sans horodatage de vérification refusée'
);

INSERT INTO public.affiliate_offers
  (id, title, affiliate_url, price, currency, price_checked_at, availability, availability_checked_at,
   link_id, valid_from, valid_to, expires_at, created_at)
VALUES
  ('c4f00000-0000-4000-8000-000000000001', 'Offre affiliée fraîche', 'https://example.invalid/offre-a',
   120, 'EUR', now(), true, now(), 'c4e00000-0000-4000-8000-000000000002',
   now() - interval '1 day', now() + interval '30 days', NULL, now() - interval '1 day'),
  ('c4f00000-0000-4000-8000-000000000002', 'Offre sans prix', 'https://example.invalid/offre-b',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, now() - interval '1 day'),
  ('c4f00000-0000-4000-8000-000000000003', 'Offre expirée', 'https://example.invalid/offre-c',
   80, 'EUR', now() - interval '60 days', false, now() - interval '60 days', NULL,
   now() - interval '90 days', now() - interval '30 days', now() - interval '1 day', now() - interval '90 days');

SELECT is(
  (SELECT price IS NULL AND has_affiliate_link = false
   FROM public.poi_offers_served WHERE offer_id = 'c4f00000-0000-4000-8000-000000000002'),
  true,
  '56. DB-07. Aucune invention : offre sans prix servie avec price NULL, sans lien affilié'
);
SELECT is(
  (SELECT is_price_timestamped AND has_affiliate_link AND partner_slug = 'phase4-partner'
   FROM public.poi_offers_served WHERE offer_id = 'c4f00000-0000-4000-8000-000000000001'),
  true,
  '57. DB-07. Prix horodaté + `has_affiliate_link` vrai + partenaire exposé'
);
SELECT is(
  (SELECT is_expired AND is_validity_expired
   FROM public.poi_offers_served WHERE offer_id = 'c4f00000-0000-4000-8000-000000000003'),
  true,
  '58. DB-07. Offre expirée signalée, donnée conservée'
);

SELECT * FROM finish();
ROLLBACK;
