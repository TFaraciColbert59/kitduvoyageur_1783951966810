---
title: ADR-002 — PostGIS & Hiérarchie Géodonnées Natural Earth
aliases:
  - ADR-002
tags:
  - adr
  - postgis
  - spatial
date: 2026-07-17
status: Accepté
---

# ADR-002 — POSTGIS & HIÉRARCHIE GÉODONNÉES NATURAL EARTH

### Contexte
LKDV stocke plus de 115 000 segments vectoriels et doit effectuer des requêtes spatiales complexes (recherche par proximité, détection de déviation d'itinéraire).

### Décision
Activer l'extension PostGIS avec SRID 4326 et index GIST. Structurer les entités administratives mondiales via les tables `geo_continents`, `geo_regions`, `geo_countries`, `geo_divisions`, `geo_places`.

### Conséquences
- **Positives :** Temps de calcul de proximité inférieur à 5ms, précision GPS métrique, support standard GeoJSON.
- **Négatives :** Volumétrie de la base de données accrue (~150 Mo).
