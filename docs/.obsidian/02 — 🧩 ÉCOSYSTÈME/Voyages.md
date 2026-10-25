---
title: Fiche Module — Voyages & Itinéraires
aliases:
  - Voyages
  - Sentiers
  - Randonnées
tags:
  - module
  - hikes
  - postgis
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# 🧭 FICHE MODULE — VOYAGES & ITINÉRAIRES

---

### 1. Objectif
Permettre aux voyageurs de découvrir, planifier et suivre en direct plus de 1 100 sentiers de randonnée et de trek à travers le monde, avec des données fiables (profil altimétrique, points d'eau, abris, dénivelé) et un suivi GPS sécurisé sur le terrain.

---

### 2. UX & Ergonomie
- **Recherche instantanée :** Filtrage multi-critères par région, difficulté, distance (km) et dénivelé positif (`D+`).
- **Affichage dynamique :** Vue cartographique synchronisée avec la liste des sentiers.
- **Randonnée Active :** Écran immersif plein écran sans distraction, fond sombre pour économiser la batterie, métriques en typographie mono lisible en plein soleil, retour haptique en cas d'écart d'itinéraire.

---

### 3. Pages & Routes
- `/explorer` : Explorateur principal de sentiers (Server Component avec SSR immédiat).
- `/carte-interactive` : Carte plein écran avec sélecteur de couches géographiques.
- `/randonnee-active` : Interface de suivi temps réel durant l'effort.
- `/preparer-randonnee` : Assistant de préparation avant départ.

---

### 4. Composants
- `src/components/explore/ExploreContainer.tsx` : Conteneur principal de la vue exploration.
- `src/components/explore/TrailCard.tsx` : Carte résumé d'un itinéraire (distance, D+, note, aperçu tracé).
- `src/components/hike/ActiveHikeTracker.tsx` : Tracker GPS temps réel.
- `src/components/hike/ElevationChart.tsx` : Graphique altimétrique interactif.
- `src/components/hike/SOSButton.tsx` : Déclencheur d'alerte d'urgence avec coordonnées exactes.

---

### 5. Données & Schéma
- Modèle de données spatiales PostGIS : géométries de type `LineString` et `MultiLineString` (SRID 4326).
- Calculs de distance temps réel via formule Haversine dans `useActiveHikeMode.ts`.
- Profil altimétrique stocké sous forme de tableau JSON de points `[distance, elevation]`.

---

### 6. Tables Supabase
- `hiking_routes` : Table principale des itinéraires (titre, description, distance, dénivelé, difficulté, pays).
- `trail_segments` : Segments géométriques vectoriels (colonnes PostGIS `geom`).
- `trail_metadata` : Données enrichies (type de terrain, balisage, saison recommandée).
- `trail_pois` : Points d'intérêt le long de la trace (sources d'eau, refuges, cols, points de vue).
- `explore_trails` : Vue SQL consolidée optimisée pour l'affichage public rapide.

---

### 7. RLS & Sécurité
- **Lecture publique :** `SELECT` autorisé pour tous (`anon` et `authenticated`).
- **Écriture restreinte :** `INSERT`, `UPDATE`, `DELETE` strictement réservés aux administrateurs (`user_profiles.role = 'admin'`).
- Vues SQL définies en `SECURITY INVOKER` pour respecter les droits de l'utilisateur appelant.

---

### 8. API Routes
- `GET /api/hikes` : Récupération paginée des sentiers avec filtre géographique (cache ISR 60s).
- `GET /api/trails` : Récupération des segments géométriques GeoJSON pour le tracé.
- `POST /api/hike-sessions` : Démarrage d'une session de randonnée enregistrée.
- `PUT /api/hike-sessions/[id]` : Mise à jour des coordonnées et fin de session.

---

### 9. Dépendances & Interactions
- **[[Inventaire]] :** Recommande le matériel adéquat selon la difficulté du sentier sélectionné.
- **[[Carnets]] :** La session de randonnée active peut être convertie en carnet de voyage en 1 clic à l'arrivée.
- **[[Notifications]] :** Envoi d'alertes SOS aux contacts d'urgence en cas de déclenchement manuel.

---

### 10. Notifications Associées
- Alerte sonore/vibration lors d'une déviation d'itinéraire supérieure à 50 mètres.
- Notification push à mi-parcours et à l'approche de la tombée de la nuit.

---

### 11. Points & Récompenses
- +50 XP et +10 Points [[Points|LKDV]] attribués lors de la complétion d'un nouvel itinéraire certifié par trace GPS.

---

### 12. Problèmes Connus
- Le rendu WebGL peut ralentir sur les smartphones d'entrée de gamme si trop de traces sont affichées simultanément (contourné en limitant le pixel ratio à 1.0).

---

### 13. État
🟢 **Fonctionnel & Déployé** (1 139 routes connectées à Supabase PostGIS).

---

### 14. Roadmap
- [ ] Mode hors-ligne vectoriel complet avec mise en cache locale IndexedDB des tuiles et traces.
- [ ] Profils d'élévation 3D enrichis avec rendu ombré.
