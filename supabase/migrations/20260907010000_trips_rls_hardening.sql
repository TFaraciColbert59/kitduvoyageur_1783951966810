-- ============================================================
-- 20260907010000_trips_rls_hardening
-- Durcissement RLS module voyages (audit sécurité post-refonte Liquid Glass)
--
-- ⚠️ NE PAS APPLIQUER EN PROD SANS VALIDATION SUR COPIE (règle repo).
--    Tester sur un dump local : vérifier les parcours owner/editor/viewer/anon
--    (lecture, update d'étape, invitation, upload document) avant application.
--
-- Couvre :
--   H2 — vol de propriété : un editor peut se réattribuer un trip en PATCHant
--        user_id (PostgREST direct). Correctif : trigger BEFORE UPDATE qui
--        gèle user_id (pas de sous-requête récursive dans la policy).
--   M4 — un editor peut insérer un collaborateur role='owner' via PostgREST.
--        Correctif : la policy d'insert restreint role à editor/viewer.
--   M5 — un editor peut créer un document attribué au propriétaire.
--        Correctif : la policy d'insert impose user_id = auth.uid().
--   M7 — vues legacy sans security_invoker => exposition des lignes
--        crews / trip_participants en bypass RLS. Correctif : security_invoker.
-- ============================================================

BEGIN;

-- ── H2 : user_id de trips immuable ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.freeze_trip_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'trips.user_id est immuable (transfert de propriété interdit via RLS)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_freeze_owner_trigger ON public.trips;
CREATE TRIGGER trips_freeze_owner_trigger
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.freeze_trip_owner();

-- ── M4 : pas de création de collaborateur 'owner' via la policy d'insert ────
-- (l'app limite déjà le rôle via zod ; la policy est le dernier rempart)
DROP POLICY IF EXISTS "trip_collab_insert_policy" ON public.trip_collaborators;
CREATE POLICY "trip_collab_insert_policy" ON public.trip_collaborators
  FOR INSERT WITH CHECK (
    role IN ('editor', 'viewer')
    AND (
      public.can_edit_trip(trip_id)
      OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    )
  );

-- ── M5 : document attribué à son créateur réel ──────────────────────────────
DROP POLICY IF EXISTS "trip_documents_insert_policy" ON public.trip_documents;
CREATE POLICY "trip_documents_insert_policy" ON public.trip_documents
  FOR INSERT WITH CHECK (
    public.can_edit_trip(trip_id)
    AND user_id = auth.uid()
  );

-- ── M7 : vues legacy en security_invoker (respect des RLS sous-jacentes) ────
ALTER VIEW public.travel_groups_legacy SET (security_invoker = true);
ALTER VIEW public.trip_collaborators_legacy SET (security_invoker = true);

COMMIT;
