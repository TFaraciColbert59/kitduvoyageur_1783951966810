-- Référentiel géographique, offre gratuite (docs/compas/REFERENTIEL-GEO.md §6).
-- Index en double ou jamais lus (pg_stat_user_indexes, 8 octobre 2026).
-- Lancé par Tony dans le SQL Editor le 8 octobre (le connecteur de la session
-- refusait toute suppression) : base de 424 à 353 Mo.

-- Doublons des contraintes UNIQUE(geoname_id), qui servent déjà d'index.
DROP INDEX IF EXISTS public.idx_places_geo_geoname_id;
DROP INDEX IF EXISTS public.idx_admin_regions_geo_geoname_id;
DROP INDEX IF EXISTS public.idx_countries_geo_geoname_id;

-- Recherche plein texte jamais utilisée (la recherche par nom passe par les trigrammes).
DROP INDEX IF EXISTS public.idx_places_geo_name;
DROP INDEX IF EXISTS public.idx_admin_regions_geo_name;

-- Codes administratifs jamais filtrés (les lieux se lisent par admin_region_id).
DROP INDEX IF EXISTS public.idx_places_geo_admin1_code;
DROP INDEX IF EXISTS public.idx_places_geo_admin2_code;
DROP INDEX IF EXISTS public.idx_admin_regions_geo_admin_code;

-- Couvert par idx_places_geo_country_population (country_iso_a2 en tête).
DROP INDEX IF EXISTS public.idx_places_geo_country_iso;
