# Hub Universel — Phase 1 (Randonnée + Voyage)

Date : 2026-09-09 · Statut : implémenté · Tests : `tests/features/hub/*.spec.ts`

## Vision

Le Hub est une coquille unique et intelligente qui compose automatiquement son
contenu selon l'activité active. Le matériel est une ressource transversale ;
le groupe est une couche collaborative présente dans chaque hub (plus une
aventure séparée). Ajouter une activité (course, natation, vélo…) demandera
seulement : un nouveau profil d'activité, la déclaration de ses widgets dans
le catalogue, un adaptateur de données.

## Décisions clés

1. **Source de vérité Randonnée** : un voyage `trips` avec
   `primary_activity ∈ {hiking, trekking, bivouac, bushcraft}` + parcours lié
   via `metadata.route_id` (table `hiking_routes`). Aucune nouvelle table
   d'activité — pattern server-first conservé.
2. **Couche groupe** : chaque activité reçoit un `crew` auto-créé
   (`crews.auto_created`), invisible tant que solo (≤ 1 membre), supprimé
   automatiquement en fin d'activité. L'onglet Équipage reste toujours visible.
3. **Composition en couches** : `deriveTripProfile` (base, R2) →
   `applyActivityProfile` (deltas par activité) → sélection par le catalogue.
   Les moteurs existants ne sont pas dupliqués.

## Architecture

```
getHubAdventureData (serveur : trip + group + hiking + counts)
        │
        ▼
deriveHubProfile(input) ── nature sortie ──► deriveTripProfile (moteur Y)
        │                                     │
        │                                     ▼
        │                          applyActivityProfile (deltas)
        ▼
profile { activityType, sections, widgets, reason }
        │
        ▼
HubOverviewSortie ──► selectOverviewBlocks (catalogue central)
        │                    │
        │                    ▼
        │            blocs overview (Randonnée ≠ Voyage)
        ▼
grille de sections (libellés par activité, routes existantes)
```

### Catalogue central — `src/features/hub/registry/widgetCatalog.ts`

Chaque widget déclare : activités compatibles, données requises, priorité,
position (`overview` | `sidebar`), condition d'affichage, action. Les 19
widgets de sidebar existants sont déclarés EN RICHISSANT
`tripWidgetRegistry`/`hubWidgetRegistry` (pas de duplication des priorités) ;
7 blocs d'aperçu par activité complètent le catalogue :

| Id | Activités | Données | Condition |
|---|---|---|---|
| `cta-randonnee-active` | hiking | — | toujours |
| `parcours-apercu` | hiking | steps, dates | steps ou route |
| `meteo-rando` | hiking | weather | toujours |
| `points-passage` | hiking | trip.pois | POI présents |
| `points-eau` | hiking | trip.pois | waterPointsCount > 0 |
| `reservations` | travel | trip.steps | étapes présentes |
| `groupe-bloc` | toutes | — | toujours |

### Moteurs (purs, testés)

- `activityTypes.ts` : `ActivityType`, `deriveActivityType`, estimations Naismith.
- `activityProfiles.ts` : Équipage toujours visible ; masque
  budget/pays/documents/contexte pour la randonnée ; libellés spécialisés.
- `crewVisibility.ts` : `isCrewVisible` / `isCrewSolo`.
- `widgetContext.ts` : contexte déclaratif depuis les données serveur.

### Couche groupe

- Migration `20260909000000_activity_auto_crew.sql` : colonne `auto_created`,
  trigger `trips` INSERT → crew auto (owner), backfill idempotent.
- Sync collaborateurs ↔ crew (`server/syncTripCrew.ts`) branchée sur
  `inviteCollaborator`/`removeCollaborator`.
- Nettoyage : `updateTripStatus(completed|cancelled)` + cron
  `/api/cron/cleanup-solo-crews` (CRON_SECRET).
- Filtrage des crews auto solo dans `fetchUserCrews`/`fetchPublicCrews`
  → invisibles dans `/equipages`, le sélecteur d'aventure, `/api/hub/adventures`.

### Données serveur

`getHubAdventureData` expose désormais `group` (crew block : membres, rôles,
invitations pending) et `hiking` (route via `metadata.route_id`, dénivelés
`trail_metadata`, distance `hiking_routes`/étapes, durée estimée, météo
Open-Meteo via `getWeather`, points d'eau comptés sur les POI) ; `buildHubCounts`
ajoute `pois`/`reservations`.

## Contraintes respectées

- Routes `/hub`, `/hub/[section]`, `/voyages/[slug]/*`, redirects : inchangées
  (sections sortie toujours 307 vers les pages voyage).
- Inventaire = source unique du matériel ; posession/collectif inchangés.
- R2 : composition, zéro duplication des matrices Y.
- Garde-fou H-D85 : tokens `--lkv-*`, zéro classe froide.

## Phase 2 (hors périmètre)

Course, natation, vélo : étendre `ActivityType`, ajouter les blocs/widgets au
catalogue, un adaptateur de données — coquille et moteur identiques.
Réservations approfondies (liaison documents de réservation par étape).
Lien parcours : picker `metadata.route_id` dans `/preparer-randonnee`.
