---
name: map-geospatial
description: Geospatial engineering for LKDV maps using PostGIS, OSM and Leaflet.
---

# Geospatial Engineering

LKDV contains potentially large amounts of geographic data.

Never assume all map data can be loaded into the browser.

## PostGIS

Prefer:
- spatial indexes
- bounding-box filtering
- ST_Intersects
- ST_DWithin when appropriate
- geometry simplification where appropriate
- server-side filtering
- pagination

Inspect existing SRID and geometry types before modifying spatial queries.

Never invent spatial columns.

## Map API

Map endpoints should:
- filter by viewport
- limit results
- return only required fields
- avoid unnecessary geometry precision
- handle large datasets safely

## Leaflet

Avoid:
- rendering thousands of markers individually
- loading all trails at startup
- unnecessary React re-renders
- repeatedly recreating map layers

Prefer:
- clustering
- viewport loading
- lazy loading
- memoization where justified
- simplified geometries
- efficient layer management

## OSM

Treat OSM data as external source data.

Do not repeatedly synchronize large datasets during user requests.

Heavy imports and synchronization should run asynchronously or as controlled jobs.

## Hiking trails

Keep distinct concepts separate:
- trail
- route
- waypoint
- POI
- refuge
- campsite
- water point
- danger
- accommodation

Never destroy existing geographic data merely to simplify implementation.
