-- ==============================================================================
-- Migration : 20260909100000_trip_checklist_items.sql
-- HUB V5 — Checklist persistée en BDD (zéro mock) : la checklist de
-- préparation du voyage (J-30 / J-7 / J-1…) vit dans Supabase au lieu du
-- localStorage. Pattern trip_notes : lecture via can_read_trip, écriture
-- via can_edit_trip.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.trip_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  due_offset_days INT NOT NULL DEFAULT 30,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_checklist_trip
  ON public.trip_checklist_items(trip_id, due_offset_days, position);

ALTER TABLE public.trip_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_checklist_items_select_policy" ON public.trip_checklist_items;
CREATE POLICY "trip_checklist_items_select_policy" ON public.trip_checklist_items
  FOR SELECT USING (public.can_read_trip(trip_id));

DROP POLICY IF EXISTS "trip_checklist_items_insert_policy" ON public.trip_checklist_items;
CREATE POLICY "trip_checklist_items_insert_policy" ON public.trip_checklist_items
  FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_checklist_items_update_policy" ON public.trip_checklist_items;
CREATE POLICY "trip_checklist_items_update_policy" ON public.trip_checklist_items
  FOR UPDATE USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));

DROP POLICY IF EXISTS "trip_checklist_items_delete_policy" ON public.trip_checklist_items;
CREATE POLICY "trip_checklist_items_delete_policy" ON public.trip_checklist_items
  FOR DELETE USING (public.can_edit_trip(trip_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_checklist_items TO authenticated;

COMMIT;
