BEGIN;
SELECT plan(4);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.materiel_kit_items'::regclass),
  'Les objets des kits conservent leur RLS'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='materiel_kit_items'
      AND policyname='materiel_kit_items_read_public_parent'
      AND cmd='SELECT' AND 'authenticated'=ANY(roles)
  ),
  'La lecture des objets de kits publics exige une session authentifiée'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='materiel_kit_items'
      AND policyname='materiel_kit_items_read_public_parent'
      AND qual ILIKE '%is_public%'
      AND qual ILIKE '%user_id%'
  ),
  'Une référence de kit publique et le même propriétaire sont requis'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='materiel_kit_items'
      AND policyname='materiel_kit_items_read_public_parent'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ),
  'Aucun droit d''écriture accordé sur les kits d''autrui'
);

SELECT * FROM finish();
ROLLBACK;
