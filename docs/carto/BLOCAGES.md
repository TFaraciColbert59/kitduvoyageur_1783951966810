# CARTO · Blocages

## B1 — Débit Maptoolkit Community insuffisant pour une carte réelle *(bloquant recette)*

**Constat mesuré (2026-10-31, build local, Chromium headless)** :

| Scénario | Requêtes Maptoolkit | 429 |
|---|---|---|
| Premier chargement, z12.6, sans plafond | 66 | **2+** (tuiles vectorielles perdues) |
| Idem, `setMaxParallelImageRequests(6)` | 36 | 0 (mais source `mtk` vide : `querySourceFeatures` = 0) |
| Zoom vers z14.2 | burst de tuiles `.mvt` | **429 en série** |

En-têtes renvoyés par `tiles.maptoolkit.org` :
```
x-ratelimit-limit: 180, 180;w=1, 1800;w=60
CF-Cache-Status: HIT
```
Et le TOS §9 : **10 requêtes non cachées/s** en non enregistré, 100 req/s avec
Referer enregistré. `setMaxParallelImageRequests` ne règle que les images : les
tuiles **vectorielles** partent par le worker MapLibre, sans plafond.

**Conséquence** : la base Maptoolkit se charge (contours + hillshade visibles) mais
les couches vectorielles (sentiers, eau, labels) restent vides dès qu'un 429 tombe.

**Remèdes, par ordre de préférence**
1. **Enregistrer le Referer** sur maptoolkit.org (gratuit, immédiat) → 100 req/s.
   Action humaine, hors code.
2. **Client throttlé** : protocole MapLibre custom (`addProtocol`) qui espace les
   requêtes vers les URLs officielles (débit cible 8/s). Compatible TOS (les tuiles
   restent sur `tiles.maptoolkit.org`, rien n'est proxifié côté serveur).
3. **Repli de base** : OpenFreeMap (déjà dans le projet, sans limite) comme fond
   par défaut, Maptoolkit en couche optionnelle — s'éloigne de la référence imposée.

## B2 — Clé ArcGIS absente *(bloquant satellite)*

`NEXT_PUBLIC_ARCGIS_API_KEY` n'est pas dans `.env.local`. L'hybride satellite est
codé et testé (`withSatelliteBase`), mais **aucune capture satellite n'est possible**
sans clé. Quota ArcGIS : 2 M tuiles/mois, puis coupure.

## B3 — Éligibilité Community License *(à confirmer avant production)*

TOS §4 : usage professionnel, et Community License seulement si usage non commercial,
open source non exploité, **ou** CA < 1 M€ **et** < 10 ETP. Au-delà : Enterprise.
Tony doit confirmer les deux seuils.

## B4 — Couche vectorielle vide à diagnostiquer après B1

Même hors 429, `querySourceFeatures('mtk')` = 0 sur Chamonix à z12.6. À rejouer une
fois le débit réglé : si les tuiles arrivent, le rendu doit se remplir.
