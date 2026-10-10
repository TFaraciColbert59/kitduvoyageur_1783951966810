-- ============================================================================
-- F-006 phase 1 — politiques d'appartenance sur le bucket group-media.
--
-- Etat constate : bucket `public=true`, AUCUNE policy storage.objects en
-- migration (les uploads clients echouaient ou dependaient d'un etat hors
-- depot ; toute URL d'objet etait publiquement servie).
--
-- Phase 1 (additive, reversible) : lecture/ecriture reservees aux membres du
-- groupe (chemin `<group_id>/<fichier>`), suppression reservee au proprietaire
-- de l'objet. Le bucket reste `public` pour ne pas casser les URLs deja
-- publiees dans les messages ; le passage en prive + URLs signees est la
-- decision produit D7 (migration des URLs historiques requise).
--
-- La fonction public.is_group_member(uuid, uuid) existe en production et dans
-- la chaine (migration 20260716000000_group_system_complete).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE $p$DROP POLICY IF EXISTS group_media_select_member ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY group_media_select_member ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'group-media'
        AND public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
      )$p$;

    EXECUTE $p$DROP POLICY IF EXISTS group_media_insert_member ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY group_media_insert_member ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'group-media'
        AND array_length(storage.foldername(name), 1) >= 1
        AND public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
      )$p$;

    EXECUTE $p$DROP POLICY IF EXISTS group_media_delete_owner ON storage.objects$p$;
    EXECUTE $p$CREATE POLICY group_media_delete_owner ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'group-media'
        AND owner = auth.uid()
      )$p$;
  END IF;
END $$;
