-- ==============================================================================
-- A10 (10.3) — GPS horodaté : échantillons de positions horodatés
--
-- positions_geojson ne porte pas d'horodatage : reconstruire le temps à partir
-- de la seule géométrie produisait des durées, allures et pauses artificielles
-- (audit 31bdb279, item #4). positions_timed devient la source unique de temps ;
-- positions_geojson reste la géométrie d'affichage.
--
-- Migration additive et idempotente : colonne nullable + CHECK gardée.
-- Aucune policy ni donnée modifiée.
-- ==============================================================================

ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS positions_timed jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hike_sessions_positions_timed_check'
      AND conrelid = 'public.hike_sessions'::regclass
  ) THEN
    ALTER TABLE public.hike_sessions
      ADD CONSTRAINT hike_sessions_positions_timed_check
      CHECK (positions_timed IS NULL OR jsonb_typeof(positions_timed) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.hike_sessions.positions_timed IS
  'Échantillons GPS horodatés [{ lat, lng, timestamp, elevationM?, accuracyM?, '
  'speedMps? }] — source unique de temps du traitement A2/A10. '
  'positions_geojson ne sert qu''à la géométrie et à l''affichage : sans '
  'échantillons horodatés, les passages restent privés (pas d''observation, '
  'non éligibles au collectif).';
