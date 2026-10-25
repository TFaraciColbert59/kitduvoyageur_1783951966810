-- 20260912200000_preparer_activity_enrichment.sql
-- Enrichissement provenance pour "Préparer une activité" (additif uniquement).
--
-- Audit idempotence (scripts/db/audit-route-id-duplicates.mjs) exécuté avant écriture :
--   { "duplicates": [], "count": 0 }
-- => aucune paire (user_id, metadata->>'route_id') en doublon en prod.
--    Variante UNIQUE retenue : uniq_trips_user_route_active.
--    (Si l'audit avait renvoyé count > 0, la variante non unique idx_trips_user_route
--     aurait été créée à la place.)

ALTER TABLE public.trip_steps ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trip_steps ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.trip_pois  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trip_pois  ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_trips_user_route_active
  ON public.trips (user_id, (metadata->>'route_id'))
  WHERE metadata ? 'route_id';
