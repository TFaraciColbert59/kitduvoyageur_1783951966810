-- Allow a logged-in traveller to inspect the contents of a kit whose owner
-- has explicitly published it. Private kits remain owner-only.
-- The parent kit's user_id must also match the item owner (defense in depth).
DROP POLICY IF EXISTS materiel_kit_items_read_public_parent ON public.materiel_kit_items;
CREATE POLICY materiel_kit_items_read_public_parent
  ON public.materiel_kit_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.materiel_kits k
      WHERE k.id = materiel_kit_items.kit_id
        AND k.user_id = materiel_kit_items.user_id
        AND k.is_public IS TRUE
    )
  );

-- Data is still written only to the requester's account by existing INSERT RLS.
-- Never grant remote INSERT/UPDATE/DELETE or private-gear SELECT permissions.
