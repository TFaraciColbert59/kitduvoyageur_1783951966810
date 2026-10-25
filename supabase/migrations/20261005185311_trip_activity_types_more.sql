-- Le Compas couvre tout type de sortie : vélo, ski, alpinisme, escalade,
-- sports d'eau, city trip, plage, van. Ajout de valeurs seulement (aucune
-- valeur existante ne change).
alter type public.trip_activity_type add value if not exists 'cycling';
alter type public.trip_activity_type add value if not exists 'ski';
alter type public.trip_activity_type add value if not exists 'mountaineering';
alter type public.trip_activity_type add value if not exists 'climbing';
alter type public.trip_activity_type add value if not exists 'water';
alter type public.trip_activity_type add value if not exists 'citytrip';
alter type public.trip_activity_type add value if not exists 'beach';
alter type public.trip_activity_type add value if not exists 'vanlife';
