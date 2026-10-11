-- T15 — Unification des distinctions :
--   liaison par nom normalisé, possessions historiques conservées, aucune
--   promesse de points, privilèges fermés, FK réelle.
BEGIN;
SELECT plan(10);

-- Fixtures : variantes en double (legacy sans slug + canonique avec slug),
-- « Premier Pas » en trois exemplaires, plus un badge unique.
DELETE FROM public.user_badges WHERE user_id = '15151515-0000-4000-8000-00000000000a'::uuid;
DELETE FROM public.progression_badge_links
 WHERE badge_id IN (SELECT id FROM public.badges WHERE name IN ('Premier Pas', 'Solidaire', 'Éco-Voyageur'));
DELETE FROM public.badges WHERE name IN ('Premier Pas', 'Solidaire', 'Éco-Voyageur');

INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
  ('15151515-0000-4000-8000-00000000000a','t15-badges@test.invalid','authenticated','authenticated','{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.badges (id, name, description, icon, rarity, slug, points_reward, requirement_type, requirement_value, active) VALUES
  ('aa151515-0000-4000-8000-000000000001','Premier Pas','legacy','🎒','Commun',NULL,50,'early_adopter',1,true),
  ('aa151515-0000-4000-8000-000000000002','Premier Pas','legacy 2','🎒','Commun',NULL,0,'early_adopter',1,true),
  ('aa151515-0000-4000-8000-000000000003','Premier Pas','canonique','🎒','Commun','badge_premier_pas',50,'early_adopter',1,true),
  ('aa151515-0000-4000-8000-000000000004','Solidaire','legacy','🤝','Rare',NULL,150,'member_helped',1,true),
  ('aa151515-0000-4000-8000-000000000005','Solidaire','canonique','🤝','Rare','badge_solidaire',150,'member_helped',1,true),
  ('aa151515-0000-4000-8000-000000000006','Éco-Voyageur','unique','🌿','Commun',NULL,0,'post_created',1,true);

-- Le bénévole possède une variante LEGACY (doit rester possédée).
INSERT INTO public.user_badges (id, user_id, badge_id, earned_at) VALUES
  (gen_random_uuid(), '15151515-0000-4000-8000-00000000000a', 'aa151515-0000-4000-8000-000000000001', now() - interval '3 days'),
  (gen_random_uuid(), '15151515-0000-4000-8000-00000000000a', 'aa151515-0000-4000-8000-000000000006', now() - interval '1 day');

-- Mécanisme de liaison (identique à la migration, rejouable).
INSERT INTO public.progression_badge_links (badge_id, canonical_key, provenance)
SELECT b.id, regexp_replace(lower(b.name), '[^a-z0-9]+', '-', 'g'),
       CASE WHEN b.slug IS NOT NULL AND length(b.slug) > 0 THEN 'canonical_v2' ELSE 'legacy_kept' END
FROM public.badges b
ON CONFLICT (badge_id) DO UPDATE
  SET canonical_key = EXCLUDED.canonical_key, provenance = EXCLUDED.provenance, linked_at = now();
UPDATE public.badges SET points_reward = 0 WHERE points_reward <> 0;

-- 1. Toutes les variantes sont liées (aucune perdue).
SELECT is(
  (SELECT count(*)::int FROM public.progression_badge_links l
     WHERE l.badge_id::text LIKE 'aa151515-%'),
  6, 'les six variantes sont liées');

-- 2/3. La déduplication regroupe les variantes sous une seule clé.
SELECT is(
  (SELECT count(DISTINCT canonical_key)::int FROM public.progression_badge_links l
     WHERE l.badge_id::text LIKE 'aa151515-%'),
  3, 'trois clés canoniques pour six variantes (Premier Pas ×3, Solidaire ×2)');
SELECT is(
  (SELECT count(*)::int FROM public.progression_badge_links l
     WHERE l.badge_id::text LIKE 'aa151515-%' AND l.canonical_key = 'premier-pas'),
  3, '« Premier Pas » : trois variantes sous une clé');

-- 4/5. La possession historique d'une variante legacy est conservée et liée.
SELECT is(
  (SELECT count(*)::int FROM public.user_badges WHERE user_id = '15151515-0000-4000-8000-00000000000a'::uuid),
  2, 'possessions historiques conservées');
SELECT ok(
  (SELECT bool_and(l.badge_id IS NOT NULL) FROM public.user_badges ub
     LEFT JOIN public.progression_badge_links l ON l.badge_id = ub.badge_id
     WHERE ub.user_id = '15151515-0000-4000-8000-00000000000a'::uuid),
  'chaque badge possédé est lié (aucun orphelin)');

-- 6. Plus aucune promesse de points.
SELECT is(
  (SELECT count(*)::int FROM public.badges WHERE points_reward <> 0),
  0, 'aucun badge ne promet de points');

-- 7. FK : une liaison vers un badge inexistant est refusée.
SELECT throws_ok(
  $$INSERT INTO public.progression_badge_links (badge_id, canonical_key) VALUES ('aa999999-0000-4000-8000-000000000000', 'x')$$,
  '23503', NULL, 'liaison vers un badge inexistant refusée');

-- 8/9. Privilèges : clients fermés, service_role autorisé.
SELECT ok(NOT has_table_privilege('anon', 'public.progression_badge_links', 'SELECT'), 'anon sans lecture');
SELECT ok(has_table_privilege('service_role', 'public.progression_badge_links', 'SELECT'), 'service_role peut lire');

-- 10. Version de condition portée et bornée.
SELECT ok(
  (SELECT bool_and(condition_version >= 1) FROM public.progression_badge_links),
  'version de condition >= 1 partout');

SELECT * FROM finish();
ROLLBACK;
