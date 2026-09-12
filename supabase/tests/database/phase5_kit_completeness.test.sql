-- ============================================================================
-- Phase 5 — Kit voyageur complet (complétude traçable et modifiable)
--   • TEST-PHASE5-DB-01 : colonnes additives trip_items (ownership, owner_id,
--     condition, reason) + défaut personal + NOT NULL + commentaires.
--   • TEST-PHASE5-DB-02 : contraintes de domaine ownership/condition (valeurs
--     invalides refusées, NULL autorisé uniquement pour condition/reason).
--   • TEST-PHASE5-DB-03 : FK owner_id → auth.users (aucun propriétaire inventé).
--   • TEST-PHASE5-DB-04 : métadonnées kit (materiel_kit_items) + défauts
--     priority/is_vital + contraintes.
--   • TEST-PHASE5-DB-05 : RLS toujours activée, aucune politique affaiblie.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips, public.trip_items,
  public.materiel_kits, public.materiel_kit_items TO service_role, authenticated;
SELECT plan(24);

-- ----------------------------------------------------------------------------
-- Fixtures — aucun secret, aucune donnée personnelle réelle.
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f5a50000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'phase5_owner@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES (
  'f5a50000-0000-4000-8000-0000000000b1',
  'phase5-kit-complet',
  'Phase 5 — Kit complet',
  'f5a50000-0000-4000-8000-0000000000a1',
  'private'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.materiel_kits (id, user_id, name)
VALUES (
  'f5a50000-0000-4000-8000-0000000000c1',
  'f5a50000-0000-4000-8000-0000000000a1',
  'Kit Phase 5'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- TEST-PHASE5-DB-01 — colonnes trip_items + défaut
-- ----------------------------------------------------------------------------
SELECT has_column('public', 'trip_items', 'ownership',
  '1. DB-01. trip_items.ownership existe');
SELECT has_column('public', 'trip_items', 'owner_id',
  '2. DB-01. trip_items.owner_id existe');
SELECT has_column('public', 'trip_items', 'condition',
  '3. DB-01. trip_items.condition existe');
SELECT has_column('public', 'trip_items', 'reason',
  '4. DB-01. trip_items.reason existe');
SELECT col_default_is('public', 'trip_items', 'ownership', 'personal',
  '5. DB-01. ownership défaut = personal');
SELECT col_not_null('public', 'trip_items', 'ownership',
  '6. DB-01. ownership NOT NULL');
SELECT col_is_null('public', 'trip_items', 'condition',
  '7. DB-01. condition NULL autorisé (état inconnu, jamais inventé)');
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_description d
    JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE a.attrelid = 'public.trip_items'::regclass
      AND a.attname = 'reason'
  ),
  '8. DB-01. trip_items.reason porte un commentaire Phase 5'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE5-DB-02 — domaine ownership/condition
-- ----------------------------------------------------------------------------
INSERT INTO public.trip_items (id, trip_id, item_name)
VALUES (
  'f5a50000-0000-4000-8000-0000000000d1',
  'f5a50000-0000-4000-8000-0000000000b1',
  'Trousse de premiers secours'
);

SELECT is(
  (SELECT ownership FROM public.trip_items WHERE id = 'f5a50000-0000-4000-8000-0000000000d1'),
  'personal',
  '9. DB-02. Un item sans ownership explicite est personnel (défaut réel)'
);
SELECT is(
  (SELECT condition IS NULL FROM public.trip_items WHERE id = 'f5a50000-0000-4000-8000-0000000000d1'),
  true,
  '10. DB-02. condition reste NULL par défaut (aucune valeur inventée)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_items (trip_id, item_name, ownership)
     VALUES ('f5a50000-0000-4000-8000-0000000000b1', 'Invalide', 'collectif') $$,
  '23514',
  NULL,
  '11. DB-02. ownership hors domaine refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_items (trip_id, item_name, condition)
     VALUES ('f5a50000-0000-4000-8000-0000000000b1', 'Invalide', 'casse') $$,
  '23514',
  NULL,
  '12. DB-02. condition hors domaine refusée'
);
SELECT lives_ok(
  $$ INSERT INTO public.trip_items (id, trip_id, item_name, ownership, condition, reason)
     VALUES ('f5a50000-0000-4000-8000-0000000000d2',
             'f5a50000-0000-4000-8000-0000000000b1',
             'Tente 2 places', 'shared', 'bon',
             'Règle LKDV : bivouac — abri partagé du groupe') $$,
  '13. DB-02. shared + condition + raison acceptés'
);
SELECT is(
  (SELECT ownership FROM public.trip_items WHERE id = 'f5a50000-0000-4000-8000-0000000000d2'),
  'shared',
  '14. DB-02. ownership shared persisté'
);
SELECT is(
  (SELECT reason FROM public.trip_items WHERE id = 'f5a50000-0000-4000-8000-0000000000d2'),
  'Règle LKDV : bivouac — abri partagé du groupe',
  '15. DB-02. la raison vérifiable est persistée telle quelle'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE5-DB-03 — propriétaire réel uniquement (FK)
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ INSERT INTO public.trip_items (trip_id, item_name, owner_id)
     VALUES ('f5a50000-0000-4000-8000-0000000000b1', 'Propriétaire fantôme',
             'f5a50000-0000-4000-8000-00000000dead') $$,
  '23503',
  NULL,
  '16. DB-03. owner_id inexistant refusé (FK auth.users)'
);
SELECT lives_ok(
  $$ INSERT INTO public.trip_items (id, trip_id, item_name, owner_id)
     VALUES ('f5a50000-0000-4000-8000-0000000000d3',
             'f5a50000-0000-4000-8000-0000000000b1',
             'Sac de couchage',
             'f5a50000-0000-4000-8000-0000000000a1') $$,
  '17. DB-03. owner_id réel accepté'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE5-DB-04 — materiel_kit_items
-- ----------------------------------------------------------------------------
SELECT has_column('public', 'materiel_kit_items', 'ownership',
  '18. DB-04. materiel_kit_items.ownership existe');
SELECT has_column('public', 'materiel_kit_items', 'priority',
  '19. DB-04. materiel_kit_items.priority existe');
SELECT has_column('public', 'materiel_kit_items', 'is_vital',
  '20. DB-04. materiel_kit_items.is_vital existe');
SELECT col_default_is('public', 'materiel_kit_items', 'ownership', 'personal',
  '21. DB-04. ownership défaut = personal');
SELECT col_default_is('public', 'materiel_kit_items', 'priority', 'recommended',
  '22. DB-04. priority défaut = recommended');
SELECT throws_ok(
  $$ INSERT INTO public.materiel_kit_items (kit_id, user_id, name, priority)
     VALUES ('f5a50000-0000-4000-8000-0000000000c1',
             'f5a50000-0000-4000-8000-0000000000a1', 'Priorité invalide', 'urgent') $$,
  '23514',
  NULL,
  '23. DB-04. priority hors domaine refusée'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE5-DB-05 — RLS toujours active
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trip_items'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.materiel_kit_items'::regclass),
  '24. DB-05. RLS activée sur trip_items et materiel_kit_items'
);

SELECT * FROM finish();
ROLLBACK;
