-- explore_trails : suppression des valeurs synthétiques (COALESCE) — NON APPLIQUÉE
--
-- ⚠️ Cette migration n'a PAS été poussée (Docker/Supabase CLI indisponible au
-- moment de sa création). À appliquer via `supabase db push` quand le CLI est
-- disponible.
--
-- Pourquoi : la vue précédente générait des valeurs arbitraires quand les
-- données manquaient (scores calculés depuis difficulté+dénivelé,
-- duration=0, difficulty='moderate', distance=0, elevation=0). Mission
-- "ZÉRO MOCK" : une donnée absente doit être NULL, jamais inventée.
-- Le frontend gère déjà les NULL (affichage '—').
-- Note : /api/hikes surcharge déjà ces colonnes par les vraies tables
-- (hiking_routes / trail_metadata / trail_scores), donc cette migration
-- rend simplement la vue cohérente pour tous les consommateurs.

DROP VIEW IF EXISTS public.explore_trails;

CREATE OR REPLACE VIEW public.explore_trails AS
SELECT
  r.id::text                                                         AS id,
  r.name                                                             AS name,
  ST_AsGeoJSON(r.geom)::jsonb                                        AS geometry,
  r.distance_km                                                      AS distance_km,
  m.duration_hours                                                   AS duration_hours,
  m.difficulty                                                       AS difficulty,
  m.elevation_gain                                                   AS elevation_gain,
  s.adventure_score                                                  AS adventure_score,
  s.nature_score                                                     AS nature_score,
  s.panorama_score                                                   AS panorama_score,
  s.accessibility_score                                              AS accessibility_score,
  s.challenge_score                                                  AS challenge_score,
  s.services_score                                                   AS services_score,
  ST_YMin(ST_Envelope(r.geom))                                       AS bbox_min_lat,
  ST_XMin(ST_Envelope(r.geom))                                       AS bbox_min_lng,
  ST_YMax(ST_Envelope(r.geom))                                       AS bbox_max_lat,
  ST_XMax(ST_Envelope(r.geom))                                       AS bbox_max_lng,
  ST_Y(ST_StartPoint(ST_GeometryN(r.geom, 1)))                       AS start_lat,
  ST_X(ST_StartPoint(ST_GeometryN(r.geom, 1)))                       AS start_lng,
  r.ref,
  r.network,
  m.terrain_type,
  m.family_friendly,
  m.season,
  m.ai_description
FROM public.hiking_routes r
LEFT JOIN public.trail_metadata m ON m.trail_id = r.id
LEFT JOIN public.trail_scores   s ON s.trail_id = r.id
WHERE r.geom IS NOT NULL;

GRANT SELECT ON public.explore_trails TO anon, authenticated;