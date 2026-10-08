-- Compas copilote : sorties courtes (course à pied, trail).
-- Valeurs ajoutées à l'enum, jamais retirées (sans effet sur les lignes existantes).
alter type public.trip_activity_type add value if not exists 'running';
alter type public.trip_activity_type add value if not exists 'trail';
