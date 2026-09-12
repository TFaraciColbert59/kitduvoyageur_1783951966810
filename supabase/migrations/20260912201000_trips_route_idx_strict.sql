-- 20260912201000_trips_route_idx_strict.sql
-- Correctif idempotence route_id : l'index précédent (uniq_trips_user_route_active,
-- migration 20260912200000) incluait les route_id vides (predicate metadata ? 'route_id').
-- Remplacement par un index strict excluant les valeurs vides/espaces, renommé
-- uniq_trips_user_route (le suffixe _active suggérait à tort un filtre de statut).

DROP INDEX IF EXISTS public.uniq_trips_user_route_active;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trips_user_route
  ON public.trips (user_id, (metadata->>'route_id'))
  WHERE metadata ? 'route_id' AND metadata->>'route_id' <> '';
