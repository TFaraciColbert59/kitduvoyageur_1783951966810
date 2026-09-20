-- Rollback 20260920108000 — retire les 3 actions carnet/checklist/voyage du barème.
-- Tolérant à une table déjà retirée par un rollback plus profond.
DO $$
BEGIN
  IF to_regclass('public.progression_rules') IS NOT NULL THEN
    UPDATE public.progression_rules
    SET payload = jsonb_set(payload, '{actions}',
      COALESCE(payload->'actions', '{}'::jsonb)
        - 'carnet_published' - 'checklist_completed' - 'trip_completed')
    WHERE version = 'v1';
  END IF;
END $$;
