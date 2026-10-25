# A5 — Terrain Live — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Skills appliqués : `apple-ui-designer`, `ux-mobile`, `interaction-design`
Contraintes : ADR-AI-003 (privacy), ADR-AI-006 (jobs), ADR-AI-008 (flags/shadow)

## Vision

Le « Waze de l'outdoor » : signalement en moins de 5 secondes, confirmations,
déduplication, modération, expiration, affichage mobile natif. Détection automatique
uniquement en **shadow mode**.

## Catégories

- MVP actives : `obstacle`, `closure`, `mud`, `snow_ice`, `water`, `danger`.
- Étendues (schéma A1 complet) : `bridge`, `flood`, `marking`, `shelter`, `crowding`,
  `animal`, `rockfall` — acceptées côté logique, UI MVP limitée aux 6.

## Moteurs purs — `domain/terrainLive.ts`

```ts
export const MVP_TERRAIN_CATEGORIES = ['obstacle','closure','mud','snow_ice','water','danger'] as const;
export type TerrainLifecycleEvent = 'confirm' | 'auto_confirm' | 'age' | 'resolve' | 'reject' | 'expire';
export function nextReportStatus(current: TerrainReportStatus, event: TerrainLifecycleEvent, ctx: { now: string; expiresAt?: string | null; confirmationsPresent: number; contradicts: number }): TerrainReportStatus;
export function computeReportConfidence(input: { presentCount: number; goneCount: number; unknownCount: number; distinctUsers: number; ageHours: number; gpsAccuracyM?: number | null; hasPhoto: boolean; officialSource: boolean; traceCorroboration: boolean }): Confidence;
export function deduplicateReports(candidates: DedupCandidate[], incoming: DedupCandidate, options?: { maxDistanceM?: number; windowHours?: number }): { mergedWith: string | null; reason: string };
export function moderationDecision(input: { reportsLastHour: number; confirmationsLastHour: number; accountAgeDays: number; reputation: number; hasPhoto: boolean; descriptionLength: number; }): { allowed: boolean; reasons: string[] };
export function shouldExpire(report: { status: TerrainReportStatus; expiresAt?: string | null }, now: string): boolean;
```

Cycle : `pending → confirmed → active → stale → verify → resolved | expired | rejected`.
Confiance : positifs (confirmations distinctes, récence, qualité GPS, cohérence traces,
photo, source officielle, réputation plafonnée) − négatifs (contradictions `gone`,
ancienneté, précision faible, doublons). Bornée [0,1] via `makeConfidence`.
Dédup : même catégorie + même segment (ou ≤ 150 m) + fenêtre ≤ 6 h. Modération :
rate limit (10 signalements/1 h), cooldown (2 confirmations/5 min), réputation plafonnée
à 100, description ≤ 1000, upload photo validé (url + taille), source officielle prioritaire.

## Détection automatique (shadow) — `domain/terrainAutoDetection.ts`

```ts
export function detectAutoCandidates(input: { passages: CollectivePassage[] }): { category: TerrainReportCategory; segmentId: number; reason: string; confidence: number }[];
```
Signaux : ralentissement collectif ≥ 1,6× médiane attendue, demi-tours ≥ 3, sorties de
trace ≥ 3, contournements. **Toujours `shadow: true`** : produit des candidats
`source_type='auto'` non publiés, journalisés pour comparaison (flag
`terrain_auto_detection_shadow`).

## Flux de création UI — 3 gestes

`domain/terrainReportFlow.ts` (machine pure, testée) :
`idle → category → severity → confirm` ; retour arrière, annulation, `canSubmit`
(catégorie + sévérité choisies). Position/précision/heure/segment/sens capturés
automatiquement côté client ; photo et commentaire optionnels.

## Serveur

- `server/terrainReports.ts` (client injecté) : `createTerrainReport` (modération +
  anti-doublon → fusion ou rejet motivé), `confirmTerrainReport` (1 confirmation par
  utilisateur, compteurs via trigger A1), `listNearbyTerrainReports` (vue publique
  filtrée), `expireStaleReports` (transition `age`/`expire`).
- API : `POST /api/terrain/reports`, `POST /api/terrain/reports/[id]/confirm`,
  `GET /api/terrain/conditions?lat&lng&radius`, `POST /api/cron/expire-terrain-reports`
  (CRON_SECRET). Zod sur toutes les entrées, `force-dynamic`, erreurs `{ error, details? }`.
- Migration `20260911170000_a5_terrain_nearby.sql` : colonne générée `geog geography(Point,4326) STORED`
  + index GiST + RPC `a5_terrain_reports_near(lat,lng,radius_m)` (vue sans identité, seuil
  statuts A1), `GRANT authenticated`, `REVOKE` d'écriture. Additif, idempotent.

## UI mobile (apple-ui-designer + ux-mobile + interaction-design)

`src/features/terrain-live/` :
- `components/QuickReportSheet.tsx` — bottom sheet natif (drag-to-dismiss, `vaul`),
  étape unique par écran (catégorie → gravité/passabilité → confirmation),
  44 px minimum, safe-area, haptique légère à la sélection, pas d'animation bloquante.
- `components/TerrainReportCard.tsx` — carte calme iOS : icône système, titre, méta
  (« signalé il y a 2 h », « confirmé par 14 »), 3 actions `Toujours là / Disparu / Sais pas`.
- `components/TerrainReportsList.tsx` — liste verticale, états vide/chargement/erreur,
  skeleton sans CLS.
- `components/TerrainLiveLayer.tsx` — overlay Leaflet (CircleMarker colorés par gravité)
  + `toTerrainGeoJson(reports)` pur.
- `hooks/useTerrainReports.ts` — fetch `/api/terrain/conditions` (état, refetch, offline-safe :
  erreurs silencieuses, dernière donnée conservée).
Tokens LKDV (`#0B1F17`, `#17402C`, `#A3C4A3`, `#FBFAF6`), zéro orange `#E4501C`,
`prefers-reduced-motion`, ARIA live sur la confirmation, focus visibles.

## Tests

- `TEST-A5-LIFE-01..08` : transitions nominales et interdites, expiration, résolution.
- `TEST-A5-CONF-01..06` : confirmations/récence/contradictions/ancienneté/officiel/photo.
- `TEST-A5-DEDUP-01..04` : fusion même segment/proche, fenêtre, rejet hors fenêtre.
- `TEST-A5-MOD-01..06` : rate limit, cooldown, réputation plafonnée, description, photo, officiel prioritaire.
- `TEST-A5-FLOW-01..04` : machine 3 gestes, retour, annulation, `canSubmit`.
- `TEST-A5-AUTO-01..04` : détection shadow, jamais publiée, raisons explicites.
- `TEST-A5-SRV-01..05` : client factice — création, fusion, confirmation unique, liste filtrée, expiration.
- `TEST-A5-GEO-01..02` : `toTerrainGeoJson` sans reporter_id.

## Commits

1. `feat(a5): cycle de vie, confiance, dedup et moderation Terrain Live`
2. `feat(a5): detection automatique shadow (ralentissements, demi-tours, sorties)`
3. `feat(db): a5 proximite terrain (geog generee + index GiST + RPC sans identite)`
4. `feat(a5): serveur signalements, confirmations, expiration + APIs`
5. `feat(a5): UI mobile Terrain Live (sheet 3 gestes, liste, carte)`

## Gate de sortie

Création, confirmation, expiration, déduplication, modération, carte, liste verticale,
API filtrée, file offline (préparée en Phase 7 via hooks offline-safe).
