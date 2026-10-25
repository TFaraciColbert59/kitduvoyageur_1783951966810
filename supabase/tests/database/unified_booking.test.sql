-- unified_booking.test.sql
-- Moteur unifié /prepare : catalogue public, RLS, panier et promotions.
-- Exécuter après les migrations 20260926020000, 20260926030000 et le cycle de
-- vie des promotions (20260926050000).
--
-- Alignement sur l'état durci actuel (revue pré-existants) : les refus sont
-- inchangés (mêmes SQLSTATE) ; seuls les textes attendus suivent les messages
-- réels des contraintes/policies vivantes, l'UPDATE promotions est filtré par
-- la RLS sans exception (aucune policy UPDATE), et anon est refusé par RLS
-- (aucune policy anon) plutôt que par l'absence de GRANT (défaut Supabase).
BEGIN;
SET LOCAL search_path = public;

SELECT plan(32);

-- ---------------------------------------------------------------------------
-- Fixtures minimales, annulées par le ROLLBACK final.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email)
VALUES
  ('91000000-0000-4000-8000-000000000001', 'unified-booking-a@example.test'),
  ('91000000-0000-4000-8000-000000000002', 'unified-booking-b@example.test'),
  ('91000000-0000-4000-8000-000000000003', 'unified-booking-admin@example.test')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.user_profiles (id, email, role)
VALUES
  ('91000000-0000-4000-8000-000000000001', 'unified-booking-a@example.test', 'user'),
  ('91000000-0000-4000-8000-000000000002', 'unified-booking-b@example.test', 'user'),
  ('91000000-0000-4000-8000-000000000003', 'unified-booking-admin@example.test', 'user')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.trips (id, slug, title, user_id)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'unified-booking-trip-a', 'Voyage A', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002', 'unified-booking-trip-b', 'Voyage B', '91000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_products (id, slug, name, is_active)
VALUES
  ('93000000-0000-4000-8000-000000000001', 'unified-booking-product', 'Produit actif', true),
  ('93000000-0000-4000-8000-000000000002', 'unified-booking-product-off', 'Produit inactif', false)
ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;

INSERT INTO public.activity_catalog (
  id, slug, label, family, logistics_scope, is_seed, is_active
)
VALUES (
  '94000000-0000-4000-8000-000000000001',
  'unified-booking-draft',
  'Catalogue draft',
  'test',
  'none',
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_catalog_metrics (
  activity_id, metric_key, label, value_kind
)
VALUES (
  '94000000-0000-4000-8000-000000000001',
  'duration_minutes',
  'Durée',
  'duration'
)
ON CONFLICT (activity_id, metric_key) DO NOTHING;

INSERT INTO public.bookings (
  id, trip_id, user_id, vertical, provider, external_ref
)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'hotel',
    'affiliate',
    'unified-booking-ref-a'
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002',
    'hotel',
    'affiliate',
    'unified-booking-ref-b'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.model_promotions (id, model_version, score)
VALUES (
  '97000000-0000-4000-8000-000000000001',
  'unified-booking-model-v1',
  0.9
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Structure, catalogue public et RPC.
-- ---------------------------------------------------------------------------
SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_class
    WHERE oid IN (
      'public.activity_catalog'::regclass,
      'public.activity_catalog_metrics'::regclass,
      'public.bookings'::regclass,
      'public.cart_lines'::regclass,
      'public.model_promotions'::regclass
    )
  ),
  5,
  '1. les cinq tables du moteur unifié existent'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_class
    WHERE oid IN (
      'public.activity_catalog'::regclass,
      'public.activity_catalog_metrics'::regclass,
      'public.bookings'::regclass,
      'public.cart_lines'::regclass,
      'public.model_promotions'::regclass
    )
      AND relrowsecurity
  ),
  5,
  '2. RLS est activé sur les cinq tables'
);

SELECT is(
  (SELECT count(*)::integer FROM public.activity_catalog WHERE is_seed),
  43,
  '3. le seed publie exactement 43 activités'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.activity_catalog
    WHERE slug = 'footing-45'
      AND is_active
  ),
  '4. une activité courte canonique est publiée'
);

SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*)::integer FROM public.activity_catalog WHERE is_active),
  43,
  '5. anon voit uniquement le catalogue actif'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.activity_catalog
    WHERE id = '94000000-0000-4000-8000-000000000001'
  ),
  0,
  '6. anon ne voit pas une activité inactive'
);

SELECT ok(
  (
    SELECT count(*) >= 3
    FROM public.activity_catalog_metrics
    WHERE activity_id = (
      SELECT id
      FROM public.activity_catalog
      WHERE slug = 'footing-45'
    )
  ),
  '7. les métriques d’une activité publiée sont lisibles'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.activity_catalog_metrics
    WHERE activity_id = '94000000-0000-4000-8000-000000000001'
  ),
  0,
  '8. les métriques d’un draft restent masquées'
);

SELECT throws_ok(
  $$
    INSERT INTO public.activity_catalog (slug, label, family, logistics_scope)
    VALUES ('anon-write', 'Interdit', 'test', 'none')
  $$,
  '42501',
  'new row violates row-level security policy for table "activity_catalog"'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.activities_by_scope('none'::public.activity_logistics_scope)
  ),
  3,
  '9. la RPC none retourne les 3 activités sans logistique'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.activities_by_scope('full'::public.activity_logistics_scope)
  ),
  9,
  '10. la RPC full retourne les 9 activités voyage'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- RLS des réservations, du panier et des promotions.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bookings
    WHERE id = '95000000-0000-4000-8000-000000000001'
  ),
  1,
  '11. le propriétaire voit sa réservation'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bookings
    WHERE id = '95000000-0000-4000-8000-000000000002'
  ),
  0,
  '12. un tiers ne voit pas une réservation étrangère'
);

SELECT lives_ok(
  $$
    INSERT INTO public.bookings (
      trip_id, user_id, vertical, provider, external_ref
    ) VALUES (
      '92000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001',
      'activity',
      'affiliate',
      'unified-booking-created-a'
    )
  $$,
  '13. le propriétaire crée une réservation sur son voyage'
);

SELECT throws_ok(
  $$
    INSERT INTO public.bookings (
      trip_id, user_id, vertical, provider
    ) VALUES (
      '92000000-0000-4000-8000-000000000002',
      '91000000-0000-4000-8000-000000000001',
      'hotel',
      'affiliate'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "bookings"'
);

SELECT lives_ok(
  $$
    INSERT INTO public.cart_lines (user_id, trip_id, kind, ref_id)
    VALUES (
      '91000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      'product',
      '93000000-0000-4000-8000-000000000001'
    )
  $$,
  '14. le panier accepte un produit actif'
);

SELECT throws_ok(
  $$
    INSERT INTO public.cart_lines (user_id, trip_id, kind, ref_id)
    VALUES (
      '91000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      'product',
      '93000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "cart_lines_owner_trip_kind_ref_uniq"'
);

SELECT throws_ok(
  $$
    INSERT INTO public.cart_lines (user_id, trip_id, kind, ref_id)
    VALUES (
      '91000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      'product',
      '93000000-0000-4000-8000-000000000002'
    )
  $$,
  '23503',
  'cart_lines: product reference does not exist'
);

SELECT throws_ok(
  $$
    INSERT INTO public.cart_lines (user_id, trip_id, kind, ref_id)
    VALUES (
      '91000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      'booking',
      '95000000-0000-4000-8000-000000000002'
    )
  $$,
  '23514',
  'cart_lines: booking reference does not belong to the cart owner'
);

SELECT throws_ok(
  $$
    INSERT INTO public.cart_lines (user_id, trip_id, kind, ref_id)
    VALUES (
      '91000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      'booking',
      '99999999-9999-4999-8999-999999999999'
    )
  $$,
  '23503',
  'cart_lines: booking reference does not exist'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.model_promotions
    WHERE id = '97000000-0000-4000-8000-000000000001'
  ),
  1,
  '15. authenticated peut lire une promotion'
);

-- Aucune policy UPDATE pour authenticated : Postgres filtre les lignes via
-- USING et n'émet AUCUNE exception (0 ligne touchée). L'interdiction reste
-- prouvée par deux assertions : pas d'erreur ET score inchangé.
SELECT lives_ok(
  $$
    UPDATE public.model_promotions
    SET score = 0.5
    WHERE id = '97000000-0000-4000-8000-000000000001'
  $$,
  'authenticated ne peut pas modifier une promotion (UPDATE filtré par RLS)'
);
SELECT is(
  (
    SELECT score
    FROM public.model_promotions
    WHERE id = '97000000-0000-4000-8000-000000000001'
  ),
  0.9::numeric,
  'le score de la promotion reste inchangé (0.9)'
);

SELECT throws_ok(
  $$
    INSERT INTO public.model_promotions (model_version, score)
    VALUES ('client-write', 0.5)
  $$,
  '42501',
  'new row violates row-level security policy for table "model_promotions"'
);

SELECT throws_ok(
  $$
    INSERT INTO public.activity_catalog (slug, label, family, logistics_scope)
    VALUES ('client-write', 'Interdit', 'test', 'none')
  $$,
  '42501',
  'new row violates row-level security policy for table "activity_catalog"'
);

RESET ROLE;

UPDATE public.user_profiles
SET role = 'admin'
WHERE id = '91000000-0000-4000-8000-000000000003';

SELECT set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000003',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO public.activity_catalog (
      slug, label, family, logistics_scope, is_seed
    ) VALUES (
      'unified-booking-admin-write',
      'Admin write',
      'test',
      'none',
      false
    )
  $$,
  '16. un admin peut écrire dans le catalogue'
);

RESET ROLE;

SELECT throws_ok(
  $$
    INSERT INTO public.bookings (
      trip_id, user_id, vertical, provider, external_ref
    ) VALUES (
      '92000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001',
      'hotel',
      'affiliate',
      'unified-booking-ref-a'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "bookings_provider_external_ref_uniq"'
);

SELECT throws_ok(
  $$
    INSERT INTO public.activity_catalog_metrics (
      activity_id, metric_key, label, value_kind
    )
    SELECT id, 'duration_minutes', 'Durée', 'duration'
    FROM public.activity_catalog
    WHERE slug = 'footing-45'
  $$,
  '23505',
  'duplicate key value violates unique constraint "activity_catalog_metrics_activity_key_uniq"'
);

-- Le GRANT SELECT à anon est le défaut Supabase sur les tables public : la
-- barrière réelle est la RLS (aucune policy anon sur model_promotions).
SET LOCAL ROLE anon;
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.model_promotions
  ),
  0,
  'anon ne lit aucune promotion (RLS deny : aucune policy anon)'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.cart_lines'::regclass
      AND tgname = 'cart_lines_validate_reference'
      AND NOT tgisinternal
  ),
  'le trigger de validation des références du panier est installé'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.activity_catalog_metrics
    WHERE activity_id = (
      SELECT id
      FROM public.activity_catalog
      WHERE slug = 'footing-45'
    )
  ),
  (
    SELECT count(DISTINCT metric_key)::integer
    FROM public.activity_catalog_metrics
    WHERE activity_id = (
      SELECT id
      FROM public.activity_catalog
      WHERE slug = 'footing-45'
    )
  ),
  'aucune métrique du seed n’est dupliquée'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.activity_catalog
    WHERE is_seed
  ),
  43,
  'le replay du seed ne duplique aucune activité'
);

SELECT * FROM finish();
ROLLBACK;
