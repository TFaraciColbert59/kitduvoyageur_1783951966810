-- Rollback 20260920107000 — retire les 4 actions ajoutées au barème v1.
-- Tolérant à une table déjà retirée par un rollback plus profond.
DO $$
BEGIN
  IF to_regclass('public.progression_rules') IS NOT NULL THEN
    UPDATE public.progression_rules
    SET payload = jsonb_set(payload, '{actions}',
      COALESCE(payload->'actions', '{}'::jsonb)
        - 'hike_session_processed' - 'trail_prepared' - 'kit_field_report' - 'place_review')
    WHERE version = 'v1';
  END IF;
END $$;
