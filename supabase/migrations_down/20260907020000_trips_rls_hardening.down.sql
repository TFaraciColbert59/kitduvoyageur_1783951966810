-- ============================================================
-- DOWN 20260907020000_trips_rls_hardening
-- Retour à l'état 20260904050000_trips_core pour les 2 policies
-- et suppression du trigger de gel du propriétaire.
-- Les vues legacy conservent security_invoker (remise à plat
-- via 20260907000000_unify_crews_trips_rls.down.sql si besoin).
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trips_freeze_owner_trigger ON public.trips;
DROP FUNCTION IF EXISTS public.freeze_trip_owner();

DROP POLICY IF EXISTS "trip_collab_insert_policy" ON public.trip_collaborators;
CREATE POLICY "trip_collab_insert_policy" ON public.trip_collaborators
  FOR INSERT WITH CHECK (
    public.can_edit_trip(trip_id)
    OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "trip_documents_insert_policy" ON public.trip_documents;
CREATE POLICY "trip_documents_insert_policy" ON public.trip_documents
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

COMMIT;
