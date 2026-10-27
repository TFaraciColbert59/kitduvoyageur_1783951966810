# Hiérarchie cartographique par zoom — Design

**Date :** 2026-10-27  
**Statut :** validé en design, à relire avant plan d’implémentation  
**Périmètre :** carte du Compte (`/compte`), couche MapLibre et marqueurs DOM

## Objectif

Faire de la carte du Compte une carte lisible à toutes les échelles :

- au **dézoom maximal**, montrer l’ensemble des randonnées, voyages et traces ;
- à l’échelle **pays**, montrer les massifs et les grands parcours ;
- à l’échelle **région**, montrer les traces détaillées, les carnets et les extrémités ;
- au **zoom local**, montrer uniquement les points autour du lieu observé ;
- garder des points de taille stable : ils ne grossissent jamais quand on dézoome.

La carte ne doit plus ouvrir sur une seule sortie ni masquer arbitrairement une partie de l’empreinte.

## Non-objectifs

- Modification de la base de données ou des API.
- Refonte du drawer, des fiches ou des appels à l’action.
- Nouveaux types de données cartographiques.
- Rendu 3D des traces.
- Déplacement automatique de la caméra hors des interactions existantes.

## Bandes de zoom

Quatre bandes, calculées à partir du zoom MapLibre courant :

| Bande | Identifiant | Zoom |
|---|---|---:|
| Monde | `world` | `< 4.5` |
| Pays | `country` | `>= 4.5 && < 6.5` |
| Région | `region` | `>= 6.5 && < 10` |
| Lieu | `place` | `>= 10` |

Les seuils sont centralisés dans un module unique. Aucun composant ne doit coder un seuil en dur.

## Couches et visibilité

### Monde

- **Traces** : toutes les sorties et tous les voyages.
- **Géométrie** : trace simplifiée (8 à 20 points), jamais la trace GPS complète.
- **Style** : ligne fine, sans glow, couleur par type.
- **Massifs** : regroupés par proximité à l’écran.
- **Agrégat de massifs** : point de 8 px avec compteur.
- **POI** : masqués.
- **Carnets** : masqués.
- **Départs / arrivées** : masqués.
- **Libellés** : uniquement sur l’élément sélectionné.

### Pays

- **Traces** : simplifiées, légèrement plus lisibles qu’en monde.
- **Massifs** : individuels dès que l’espace écran le permet ; sinon agrégats résiduels.
- **POI** : masqués.
- **Carnets** : masqués.
- **Départs / arrivées** : masqués.
- **Libellés** : sélection uniquement.

### Région

- **Traces** : détaillées, casing + glow.
- **Massifs** : individuels.
- **Carnets** : visibles en points discrets.
- **Départs / arrivées** : visibles.
- **POI** : masqués.
- **Libellés** : sélection uniquement.

### Lieu

- **Traces** : locales, détaillées.
- **POI** : visibles **uniquement dans le viewport avec une marge de 24 px**.
- **Carnets** : visibles dans le viewport.
- **Massifs** : visibles s’ils sont dans le viewport.
- **Départs / arrivées** : visibles.
- **Libellés** : sélection uniquement.

## Grammaire visuelle

| Élément | Monde | Pays | Région | Lieu |
|---|---:|---:|---:|---:|
| Trace — épaisseur | 1,5 px | 2 px | 3,5 px | 4 px |
| Trace — casing | non | non | oui | oui |
| Trace — glow | non | non | oui | oui |
| Massif agrégé | 8 px + compteur | 8 px + compteur | — | — |
| Massif | — | icône 24 px | icône 24 px | icône 24 px |
| Carnet | — | — | point 8 px | pastille 21 px |
| POI | — | — | — | pastille 20 px |
| Départ / arrivée | — | — | 5–6 px | 7 px |
| Libellé | sélection | sélection | sélection | sélection |

Règles :

- les tailles sont **fixes par bande** ;
- aucun point ne grossit au dézoom ;
- un point peut changer de **forme** entre bandes, jamais d’échelle arbitraire ;
- les icônes utilisent les glyphes Apple/SF déjà présents ;
- le verre translucide des POI est conservé au niveau Lieu.

## Priorité de superposition

Ordre strict, du plus prioritaire au moins prioritaire :

1. élément sélectionné ;
2. POI local ;
3. carnet ;
4. massif ;
5. extrémité de trace ;
6. trace.

Règles :

- un élément de priorité basse ne doit jamais intercepter le clic d’un élément de priorité haute ;
- les libellés ne s’affichent que pour l’élément sélectionné ;
- les éléments hors viewport sont masqués, pas déplacés ;
- les agrégats de massifs remplacent les massifs trop proches.

## Agrégation des massifs

- Calcul à l’écran, à partir de la distance entre points projetés.
- Rayon d’agrégation : **40 px**.
- Un agrégat contient au minimum 2 massifs.
- Le compteur affiche le nombre de massifs.
- Un clic sur un agrégat cadre l’emprise de ses massifs.
- Un massif seul reste cliquable individuellement.
- L’agrégation ne s’applique qu’aux bandes Monde et Pays.

## Filtrage local des POI

- Un POI n’est affiché que si son point projeté est dans le viewport, marge comprise.
- Marge : **24 px** de chaque côté.
- Si deux POI se chevauchent, le plus prioritaire reste visible ; l’autre est masqué.
- Le POI sélectionné reste visible même à la limite du viewport.

## Interactions

| Action | Résultat |
|---|---|
| Clic sur un agrégat de massifs | Cadrage sur l’emprise du groupe |
| Clic sur un massif | Vol vers le massif, zoom 10,5 |
| Clic sur une trace | Sélection, cadrage de la trace, fiche |
| Clic sur un POI | Vol vers le POI, zoom 14, fiche |
| Clic sur un carnet | Vol vers le carnet, fiche |
| Clic sur le fond | Fermeture de la sélection |
| Changement de bande | Fondu court, pas de saut de taille |

## Architecture

### Nouveau module

`src/features/compte/map/zoomHierarchy.ts`

Responsabilités :

- définir les seuils ;
- retourner la bande pour un zoom ;
- retourner la visibilité de chaque couche ;
- retourner les tailles et styles par bande ;
- exposer l’ordre de priorité ;
- exposer le rayon d’agrégation et la marge de viewport.

Interface cible :

```ts
export type MapZoomBand = 'world' | 'country' | 'region' | 'place';

export interface MapZoomConfig {
  band: MapZoomBand;
  tracks: 'simplified' | 'detailed';
  massifs: 'clustered' | 'individual' | 'hidden';
  carnets: 'hidden' | 'dots' | 'pills';
  pois: 'hidden' | 'pills';
  endpoints: 'hidden' | 'dots';
  trackWidth: number;
  casing: boolean;
  glow: boolean;
  viewportMarginPx: number;
  clusterRadiusPx: number;
}

export function resolveMapZoomConfig(zoom: number): MapZoomConfig;
```

### Modifications

`src/components/compte/map/CompteMap.tsx`

- calculer la bande à chaque `zoom` ;
- appliquer les styles de trace selon la bande ;
- agréger les massifs selon la distance écran ;
- filtrer les POI et carnets au viewport ;
- conserver les interactions existantes ;
- exposer la bande sur le conteneur (`data-zoom-band`) pour le style.

`src/components/compte/map/compte-map.css`

- styles pilotés par `data-zoom-band` ;
- suppression des tailles qui varient avec le zoom ;
- conservation du verre translucide des POI au niveau Lieu ;
- aucun `transform: scale()` sur les marqueurs.

### Données

Aucun changement de schéma. Les données existantes suffisent :

- traces : `tracks[].coordinates`, `bounds`, `massifId` ;
- massifs : `massifs[].center`, `outings` ;
- carnets : `carnets[].position` ;
- POI : `pois[].position`, `label`, `outingId`.

### Performance

- Simplification des traces mémorisée par identifiant de trace et bande.
- Agrégation recalculée uniquement sur `move` / `zoom`, avec un throttle de 16 ms.
- Aucun nouveau fetch.
- Les marqueurs masqués ne sont pas recréés.

## Accessibilité

- Chaque marqueur conserve un `aria-label` explicite.
- Les agrégats annoncent « N massifs ».
- La sélection reste accessible au clavier.
- Les changements de bande ne volent pas le focus.
- `prefers-reduced-motion` supprime les fondus et les vols.

## Tests

### Unitaires

`src/features/compte/map/__tests__/zoomHierarchy.test.ts`

- seuils exacts 4.5, 6.5, 10 ;
- visibilité par bande ;
- tailles fixes ;
- ordre de priorité ;
- rayon d’agrégation et marge.

### Intégration Playwright

- zoom 3 : toutes les traces, agrégats, aucun POI ;
- zoom 5 : massifs, traces, aucun POI ;
- zoom 8 : traces détaillées, carnets, extrémités, aucun POI ;
- zoom 12 : POI du viewport uniquement, libellé sélectionné ;
- clic sur chaque type ;
- aucune taille de point qui augmente au dézoom ;
- aucun chevauchement bloquant.

### Recette manuelle

- cadrage initial sur toute l’empreinte ;
- zoom avant/arrière fluide ;
- sélection d’un massif, d’une trace, d’un POI ;
- comportement mobile 430 × 932 et desktop 858 × 506.

## Critères d’acceptation

1. Au dézoom maximal, toutes les traces sont visibles.
2. Les points conservent une taille stable au dézoom.
3. Les POI n’apparaissent qu’au niveau Lieu et dans le viewport.
4. Les massifs sont agrégés quand ils sont trop proches.
5. La priorité de clic est respectée.
6. Aucune régression des fiches et des vols caméra.
7. Tests unitaires et Playwright au vert.
