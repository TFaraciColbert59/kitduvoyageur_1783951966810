# A7 — Hub, cockpit et offline — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Skills appliqués : `apple-ui-designer`, `ux-mobile`, `interaction-design`
Contraintes : ADR-AI-007 (Dexie), ADR-AI-008 (flags), A3/A5/A6 (prédictions, terrain, plan)

## Vision

Transformer les moteurs en expérience utilisable : un cockpit mobile calme (iOS),
une hiérarchie de Hub bornée, un recalcul live déclenché par les bons signaux, et une
couche offline V2 sur Dexie avec opérations idempotentes.

## Domaine pur

### `domain/cockpit.ts`

```ts
export interface CockpitInput {
  plan: { id: string; status: string; confidence: Confidence; personalDifficulty: number | null; etaP50: string | null; etaP90: string | null; /* … */ } | null;
  prediction: { strategy: 'comfort'|'recommended'|'fast'; paceRangeMinPerKm: [number, number]; turnaroundTime: string | null; nextCriticalSegment: { id: number; label: string; difficulty: number } | null } | null;
  liveReports: { id: string; category: string; severity: 'info'|'warning'|'critical'; distanceM: number }[];
  decisionsRequired: { id: string; label: string; requiresConfirmation: boolean }[];
  recalcReasons: string[];
  offline: boolean;
  batteryLevel?: number | null;
}
export interface CockpitView {
  hero: { title: string; subtitle: string; status: string };
  indicators: { id: string; label: string; value: string; tone: 'neutral'|'positive'|'warning'|'critical' }[]; // ≤ 3
  priorityActions: { id: string; label: string; kind: 'decide'|'navigate'|'report' }[];                    // ≤ 3
  alerts: { id: string; label: string; severity: 'info'|'warning'|'critical' }[];                          // vertical
  eta: { p50: string | null; p90: string | null; aheadBehindMinutes: number | null };
  difficulty: { value: number | null; label: string };
  paceStrategy: { id: string; label: string } | null;
  turnaroundTime: string | null;
  confidence: Confidence | null;
  recalcReasons: string[];
  offline: boolean;
}
export function buildCockpitView(input: CockpitInput): CockpitView; // caps stricts : 3 indicateurs, 3 actions
```

Règles : un Hero unique ; 0 à 1 carrousel (aucun dans ce composant) ; alertes triées par
gravité puis distance ; actions prioritaires = décisions requises > signaler > naviguer ;
ton des indicateurs dérivé (fatigue/difficulté > 75 → warning, > 90 → critical).

### `domain/recalcTriggers.ts`

```ts
export interface RecalcState { lastRecalcAt: string | null; lastPositionAt: string | null; lastPosition: { lat: number; lng: number } | null;
  lastPaceMinPerKm: number | null; lastReportsVersion: number; lastOffRouteAt: string | null; batteryLevel: number | null; routeVersion: number; }
export interface RecalcSignal { kind: 'position'|'pause'|'pace'|'offroute'|'terrain'|'battery'|'route'; at: string; detail?: string; }
export interface RecalcDecision { shouldRecalculate: boolean; reasons: string[]; nextState: RecalcState; }
export function evaluateRecalc(input: { state: RecalcState; now: string; position?: { lat: number; lng: number } | null; moving?: boolean; paceMinPerKm?: number | null; reportsVersion?: number; offRoute?: boolean; batteryLevel?: number | null; routeVersion?: number; }): RecalcDecision;
```
Seuils : position ≥ 250 m ; pause ≥ 2 min (reprise) ; écart d'allure ≥ 15 % ;
terrain : version de signalements changée ; batterie ≤ 20 % (une fois) ; route versionnée ;
**anti-rebond** : jamais deux recalculs à moins de 60 s.

### `offline/operations.ts` (pur)

```ts
export type OfflineStore = 'offline_adventures'|'offline_routes'|'offline_segments'|'offline_predictions'|'offline_pois'|'offline_terrain_events'|'offline_reports_queue'|'offline_sessions_queue'|'offline_decisions_queue'|'sync_metadata';
export interface OfflineOperation { id: string; store: OfflineStore; kind: string; payload: unknown; idempotencyKey: string; createdAt: string; attempts: number }
export function makeIdempotencyKey(input: { kind: string; entityId: string; payloadHash: string }): string;
export function planLegacyMigration(raw: Record<string, string>): { operations: OfflineOperation[]; migratedKeys: string[]; skipped: string[] };
export function packSizeBytes(ops: OfflineOperation[]): number;
```

### `offline/db.ts` (Dexie, fin)

`class AdventureOfflineDb extends Dexie` avec les 10 stores, index `idempotencyKey`
(unique), `createdAt`, `store`. Helpers : `enqueue(operation)`, `pending(store?)`,
`markSynced(ids)`, `markFailed(ids)`, `metadata(key, value)`. Aucun test unitaire Dexie
(pas d'IndexedDB en Node) — couche fine typée, logique testée dans `operations.ts`.

## UI (dossier `src/features/adventure-intelligence/ui/`)

- `AdventureCockpit.tsx` — client : Hero → 3 indicateurs → jusqu'à 3 actions →
  alertes verticales → ETA P50/P90 (fourchette, jamais une fausse précision) →
  difficulté personnelle → stratégie d'allure → heure de demi-tour → confiance →
  raisons de recalcul → bandeau offline. Applique les bornes 7.2.
- `AdventureHubSection.tsx` — bloc insérable dans le Hub : état global, décisions requises,
  grille compacte vers les sections existantes (aucune route nouvelle).
- `OfflineBanner.tsx` — discret, `role="status"`, non bloquant.

Contraintes design (skills) : tokens LKDV, 44 px, safe-area, `prefers-reduced-motion`,
animations transform/opacity uniquement, skeletons sans CLS, zéro orange, zéro dialogue natif,
rayons/ombres système (garde-fous U-D61/U-D62).

## Tests (IDs)

- `TEST-A7-COCK-01..06` : caps 3/3, tri des alertes, ton des indicateurs, ETA fourchette,
  offline propagé, entrée vide sans crash.
- `TEST-A7-TRIG-01..06` : position, pause, allure, terrain, batterie, anti-rebond 60 s.
- `TEST-A7-OFF-01..05` : idempotency key stable, migration legacy (clés connues/inconnues),
  taille du pack, opérations sans doublon, métadonnées.
- Pas de tests Dexie (couche fine) ; type-check + lint couvrent l'UI.

## Commits

1. `feat(a7): vue cockpit bornee et declencheurs de recalcul`
2. `feat(a7): offline V2 — operations idempotentes et base Dexie`
3. `feat(a7): UI cockpit, section hub et bandeau offline`

## Gate de sortie

Cockpit borné et lisible, prédiction et Terrain Live visibles, recalcul déclenché par les
bons signaux, offline V2 structuré et idempotent. L'intégration au sein des pages Hub
existantes et les tests Playwright visuels/a11y sont traités en Phase 9 (montage réel),
les composants étant prêts à être montés.
