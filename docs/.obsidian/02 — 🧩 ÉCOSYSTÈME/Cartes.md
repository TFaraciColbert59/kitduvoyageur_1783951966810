---
title: Fiche Module — Cartes & Moteur Géospatial PostGIS
aliases:
  - Cartes
  - PostGIS
  - Géodonnées
  - Moteur Géospatial
tags:
  - module
  - maps
  - postgis
  - spatial
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# 🗺️ FICHE MODULE — CARTES & GÉODONNÉES POSTGIS

---

### 1. Objectif
Fournir le moteur cartographique et géospatial de LKDV : rendu de traces vectorielles haute performance, requêtes de proximité spatiale (points d'intérêt, sources d'eau, abris), calcul d'altimétrie et hiérarchie géographique mondiale (Natural Earth).

---

### 2. UX & Ergonomie
- **Fluidité 60fps sur Mobile :** Limitation du ratio WebGL à 1.0 sur les smartphones pour éviter tout drop de frame et préserver la batterie.
- **Sélecteur de Couches Cartographiques :** Bascule instantanée entre vue Topographique / Relief (OpenTopoMap), vue Satellite et vue Plein Air épurée.
- **Interactions Tactiles Gestuelles :** Pincement pour zoomer (*pinch-to-zoom*), rotation fluide et centrage automatique sur la position de l'utilisateur.

---

### 3. Pages & Routes
- `/carte-interactive` : Carte plein écran exploratoire avec filtres multicouches.
- `/explorer` : Carte intégrée en bandeau ou double colonne sur desktop.
- `/randonnee-active` : Carte de guidage avec trace dynamique et curseur de position.
- `/pays` & `/pays/[code]` : Visualisation 3D du globe et fiches par destination.

---

### 4. Composants
- `src/components/map/InteractiveMap.tsx` : Composant cartographique React / Leaflet / Mapbox.
- `src/components/map/CountryGlobe.tsx` : Rendu 3D du globe terrestre (Three.js / WebGL).
- `src/components/map/ElevationProfile.tsx` : Graphique d'altitude interactif synchronisé avec le survol de la carte.

---

### 5. Données & Schéma
- Extension PostgreSQL `postgis` activée.
- Système de coordonnées de référence universel : WGS 84 (SRID 4326).
- Index spatiaux `GIST` sur toutes les colonnes géométriques (`geom`) pour des calculs `ST_DWithin` en moins de 5 millisecondes sur 115 000+ segments.

---

### 6. Tables Supabase
- `trail_segments` : Segments vectoriels des sentiers de randonnée (115 507 segments réels en base).
- `hiking_routes` : Itinéraires complets agrégés (1 173 itinéraires).
- `trail_pois` : Points d'intérêt géo-référencés.
- `geo_continents`, `geo_regions`, `geo_countries`, `geo_divisions`, `geo_places`, `geo_pois` : Hiérarchie géodonnées Natural Earth Phase 2.

---

### 7. RLS & Sécurité
- RLS activé et audité sur l'ensemble des tables géospatiales.
- Vues spatiales définies avec `SECURITY INVOKER` pour interdire toute exécution sous privilège élevé sans contrôle.

---

### 8. API Routes
- `GET /api/trails` : Flux GeoJSON découpé par zone d'affichage (*bounding box*).
- `GET /api/hikes` : Liste des sentiers avec coordonnées de départ et d'arrivée.

---

### 9. Dépendances & Interactions
- **[[Voyages]] :** Alimente l'explorateur et l'écran de randonnée active.
- **[[Carnets]] :** Permet de projeter les photos géotaggées sur la trace de l'expédition.
- **[[Configurateur]] :** Fournit le profil d'altitude pour adapter les recommandations thermiques du sac.

---

### 10. Notifications Associées
- Alerte sonore et vibration immédiate lorsque la distance entre le point GPS du randonneur et le segment le plus proche dépasse 50 mètres.

---

### 11. Points & Récompenses
- Badge « Explorateur de Sommets » lors du passage d'un col à plus de 2 500m d'altitude tracé sur la carte.

---

### 12. Problèmes Connus
- L'extension PostGIS est installée dans le schéma `public` (dette technique mineure sans impact fonctionnel, planifiée pour migration ultérieure dans un schéma `extensions`).

---

### 13. État
🟢 **Fonctionnel & Optimisé**.

---

### 14. Roadmap
- [ ] Tuilage vectoriel PBF auto-hébergé pour un chargement encore plus rapide des zones denses.
- [ ] Cartographie 3D avec ombrage des pentes pour repérer les couloirs d'avalanche.
