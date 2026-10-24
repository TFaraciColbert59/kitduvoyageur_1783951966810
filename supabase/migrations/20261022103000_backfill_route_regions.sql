-- 2026-10-22 — Backfill du massif le plus proche pour les itinéraires sans région.
-- hiking_routes.region est vide sur 100 % des lignes (0/1171) alors que 1140
-- itinéraires ont une géométrie 4326 et que geo_massifs contient 774 massifs.
-- On renseigne uniquement les régions vides, avec un seuil de 25 km pour ne
-- jamais inventer un massif lointain.
update public.hiking_routes r
set region = (
  select g.name_plain
  from public.geo_massifs g
  where ST_Distance(
          r.geom::geography,
          ST_SetSRID(ST_MakePoint(g.lon, g.lat), 4326)::geography
        ) < 25000
  order by r.geom <-> ST_SetSRID(ST_MakePoint(g.lon, g.lat), 4326)
  limit 1
)
where (r.region is null or btrim(r.region) = '')
  and r.geom is not null;
