# Compte — carte vivante — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer la carte factice et bloquée du Compte par une carte
MapLibre alimentée par les traces GPS réelles, avec une interface en verre
identique à la barre du bas et un contexte propre à chaque drawer.

**Architecture :** un îlot React `CompteMap` est monté dans le nœud
`#lkdv-map-root` de la coquille existante. Le runtime vanilla cesse de créer
MapLibre et se contente d'émettre le contexte du drawer. Les données passent
par un endpoint propriétaire `GET /api/compte/map`, simplifiées côté serveur.
Les calques, la caméra, les marqueurs et les états sont pilotés par React.

**Tech Stack :** Next 15, React 19, TypeScript strict, MapLibre GL 6.4.1,
Supabase, TanStack Query, Vitest, Playwright, Vercel.

**Spec :** `docs/superpowers/specs/2026-10-23-compte-carte-vivante-design.md`

## Contraintes globales

- Aucune coordonnée inventée : pas de tracé Tour du Mont-Blanc, pas de massif
  par défaut, pas de POI de démonstration.
- La carte du Compte est propriétaire uniquement : session obligatoire,
  filtre `user_id`, `Cache-Control: no-store`.
- Le mode invité ne doit jamais appeler `/api/compte/map`.
- Verre : recette exacte de `#tb.lg` (48 px, gradient blanc .486/.325/.404,
  blur 4 px saturate 1.9 brightness 1.07, ombres internes) ; secondaire 30 px
  selon `.lkdv-lens-float`. Aucun `#fff` opaque.
- Cibles tactiles 44 px minimum, focus visible, `aria-label`, reduced motion.
- MapLibre : `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')` **avant**
  `new Map`, readiness sur `style.load`, pas de `terrain` dans le style initial,
  pas de `sky` racine.
- Payload ≤ 250 Ko, 80 traces maximum, 120 points par trace.
- Chaque tâche : test d'abord quand la logique est pure, `npm run type-check`,
  tests ciblés, commit.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/features/compte/map/types.ts` | contrat `CompteMapPayload`, modes, contextes |
| `src/features/compte/map/geometry.ts` | parsing GeoJSON, simplification, bornes |
| `src/features/compte/map/modes.ts` | matrice mode → calques / caméra / HUD ; résolution du sheet |
| `src/features/compte/map/server/loadCompteMap.ts` | lectures Supabase + assemblage |
| `src/app/api/compte/map/route.ts` | endpoint propriétaire |
| `src/components/compte/map/CompteMap.tsx` | îlot React, cycle de vie MapLibre |
| `src/components/compte/map/CompteMapHud.tsx` | capsules, contrôles, synthèse |
| `src/components/compte/map/CompteMapCallout.tsx` | fiche verre d'un objet |
| `src/components/compte/map/CompteMapFallback.tsx` | SVG réel si WebGL absent |
| `src/components/compte/map/compte-map.css` | styles scopés `.lkdv-map-root` |
| `src/components/compte/map/useCompteMapContext.ts` | abonnement au pont runtime |
| `tests/e2e/compte-map.spec.ts` | invité, vide, modes, sortie |
| `tests/visual/compte-map.spec.ts` | captures 430 × 932 et 390 × 844 |

Modifications :

- `src/components/compte/CompteLiquidGlassV8.tsx` : portail du map root,
  contexte, suppression de l'import `maplibregl`.
- `src/components/compte/compte-liquid-glass-v8-runtime.js` : suppression de
  `setup3DMap`, émission du contexte, retrait des anciens contrôles.
- `src/components/compte/drawer/SlotShell.tsx` : retrait du badge et du filtre
  carte hérités.
- `src/components/compte/drawer/slots/MemoriesSlot.tsx` : événement d'année.
- `supabase/migrations/20261023094500_compte_map_indexes.sql` : index de lecture.

---

### Task 1 — Contrats, géométrie et matrice de modes

**Files :**
- Create: `src/features/compte/map/types.ts`
- Create: `src/features/compte/map/geometry.ts`
- Create: `src/features/compte/map/modes.ts`
- Test: `src/features/compte/map/__tests__/geometry.test.ts`
- Test: `src/features/compte/map/__tests__/modes.test.ts`

**Interfaces :**
- Produces :
  - `type CompteMapMode`
  - `interface MapTrack`, `MapMassif`, `MapCarnet`, `MapPoi`, `CompteMapPayload`
  - `parsePositions(value: unknown): TrackPoint[]`
  - `simplifyTrack(points: TrackPoint[], maxPoints?: number): TrackPoint[]`
  - `boundsOf(points: TrackPoint[]): MapBounds | null`
  - `mergeBounds(bounds: Array<MapBounds | null>): MapBounds | null`
  - `mapModeConfig(mode: CompteMapMode): MapModeConfig`
  - `filterTracksForMode(tracks, mode, selectedId?): MapTrack[]`
  - `resolveSheetMode(sheet): CompteMapMode`

- [ ] **Step 1 : écrire les tests de géométrie (rouges)**

```ts
// src/features/compte/map/__tests__/geometry.test.ts
import { describe, expect, it } from 'vitest';
import { boundsOf, mergeBounds, parsePositions, simplifyTrack } from '../geometry';

describe('parsePositions', () => {
  it('lit une Feature LineString et ignore l’altitude', () => {
    const points = parsePositions({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.87, 45.92, 1200],
          [6.88, 45.93, 1300],
        ],
      },
    });
    expect(points).toEqual([
      { lng: 6.87, lat: 45.92 },
      { lng: 6.88, lat: 45.93 },
    ]);
  });

  it('lit un tableau de positions horodatées', () => {
    expect(
      parsePositions([
        { lat: 45.92, lng: 6.87, timestamp: '2026-10-01T08:00:00Z' },
        { lat: 999, lng: 6.88 },
      ])
    ).toEqual([{ lng: 6.87, lat: 45.92 }]);
  });

  it('rejette une géométrie vide ou non numérique', () => {
    expect(parsePositions(null)).toEqual([]);
    expect(parsePositions({ type: 'LineString', coordinates: [['x', 2]] })).toEqual([]);
  });
});

describe('simplifyTrack', () => {
  const line = Array.from({ length: 1000 }, (_, i) => ({
    lng: 6 + i * 0.0001,
    lat: 45 + Math.sin(i / 20) * 0.0002,
  }));

  it('conserve les extrémités et borne le nombre de points', () => {
    const out = simplifyTrack(line, 120);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out[0]).toEqual(line[0]);
    expect(out.at(-1)).toEqual(line.at(-1));
  });

  it('ne touche pas une trace déjà courte', () => {
    expect(simplifyTrack(line.slice(0, 2), 120)).toHaveLength(2);
  });
});

describe('boundsOf / mergeBounds', () => {
  it('calcule les bornes et fusionne', () => {
    const a = boundsOf([{ lng: 6, lat: 45 }, { lng: 7, lat: 46 }]);
    const b = boundsOf([{ lng: 5, lat: 44 }]);
    expect(a).toEqual([6, 45, 7, 46]);
    expect(mergeBounds([a, b])).toEqual([5, 44, 7, 46]);
    expect(mergeBounds([null, null])).toBeNull();
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/features/compte/map/__tests__/geometry.test.ts`
Expected: FAIL — les modules n'existent pas.

- [ ] **Step 3 : écrire `types.ts`**

```ts
// src/features/compte/map/types.ts
export type CompteMapMode =
  | 'overview'
  | 'vitrine'
  | 'kit'
  | 'prets'
  | 'souvenirs'
  | 'communaute'
  | 'compte'
  | 'reseau'
  | 'sortie';

export interface TrackPoint {
  lng: number;
  lat: number;
}

export type MapBounds = [west: number, south: number, east: number, north: number];

export interface MapTrack {
  id: string;
  title: string;
  startedAt: string | null;
  year: number | null;
  km: number;
  dplus: number;
  maxAlt: number | null;
  verified: boolean;
  visibility: 'private' | 'collective_anonymized';
  massif: string | null;
  massifId: string | null;
  kitId: string | null;
  kitName: string | null;
  carnetId: string | null;
  photosCount: number;
  participantsCount: number;
  coordinates: TrackPoint[];
  bounds: MapBounds;
  start: TrackPoint;
  end: TrackPoint;
}

export interface MapMassif {
  id: string;
  name: string;
  countryCode: string | null;
  center: TrackPoint;
  outings: number;
  verified: boolean;
}

export interface MapCarnet {
  id: string;
  title: string;
  coverUrl: string | null;
  outingId: string;
  position: TrackPoint;
}

export interface MapPoi {
  id: string;
  outingId: string;
  label: string;
  day: number | null;
  position: TrackPoint;
}

export interface CompteMapStats {
  outings: number;
  km: number;
  dplus: number;
  massifs: number;
  countries: number;
}

export interface CompteMapPayload {
  tracks: MapTrack[];
  massifs: MapMassif[];
  carnets: MapCarnet[];
  pois: MapPoi[];
  stats: CompteMapStats;
  bounds: MapBounds | null;
  truncated: boolean;
  generatedAt: string;
}

export interface CompteMapSheet {
  kind: string | null;
  step: number;
  slot: string | null;
  detent: string;
  outingId: string | null;
}

export interface CompteMapUi {
  tracks: 'all' | 'filtered' | 'selected' | 'none';
  massifs: boolean;
  carnets: boolean;
  pois: boolean;
  outingPins: boolean;
}

export interface MapModeConfig {
  mode: CompteMapMode;
  label: string;
  emptyTitle: string;
  emptyHint: string;
  emptyCta: { label: string; href?: string; action?: 'open-kits' | 'open-outings' } | null;
  camera: 'fit-all' | 'fit-filtered' | 'fit-selected' | 'keep' | 'default';
  layers: CompteMapUi;
  hud: 'full' | 'count' | 'outing' | 'none';
  dimmed: boolean;
}
```

- [ ] **Step 4 : écrire `geometry.ts`**

```ts
// src/features/compte/map/geometry.ts
import type { MapBounds, TrackPoint } from './types';

export function isValidPoint(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function pointFromCoordinate(value: unknown): TrackPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    return isValidPoint(lng, lat) ? { lng, lat } : null;
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return isValidPoint(row.lng, row.lat)
      ? { lng: row.lng as number, lat: row.lat as number }
      : null;
  }
  return null;
}

export function parsePositions(value: unknown): TrackPoint[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(pointFromCoordinate).filter((p): p is TrackPoint => p !== null);
  }
  if (typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  if (row.type === 'Feature' && row.geometry && typeof row.geometry === 'object') {
    return parsePositions(row.geometry);
  }
  if (row.type === 'LineString' && Array.isArray(row.coordinates)) {
    return row.coordinates
      .map(pointFromCoordinate)
      .filter((p): p is TrackPoint => p !== null);
  }
  return [];
}

function dedupe(points: TrackPoint[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || last.lng !== point.lng || last.lat !== point.lat) out.push(point);
  }
  return out;
}

function segmentDistanceSq(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return (p.lng - a.lng) ** 2 + (p.lat - a.lat) ** 2;
  }
  const t = Math.max(
    0,
    Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy))
  );
  const x = a.lng + t * dx;
  const y = a.lat + t * dy;
  return (p.lng - x) ** 2 + (p.lat - y) ** 2;
}

function douglasPeucker(points: TrackPoint[], toleranceSq: number): TrackPoint[] {
  if (points.length <= 2) return points;
  let index = 0;
  let maxDistance = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = segmentDistanceSq(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= toleranceSq) return [points[0], points[points.length - 1]];
  const left = douglasPeucker(points.slice(0, index + 1), toleranceSq);
  const right = douglasPeucker(points.slice(index), toleranceSq);
  return [...left, ...right.slice(1)];
}

function uniform(points: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

export function simplifyTrack(points: TrackPoint[], maxPoints = 120): TrackPoint[] {
  const clean = dedupe(points.filter((p) => isValidPoint(p.lng, p.lat)));
  if (clean.length <= maxPoints) return clean;
  const bounds = boundsOf(clean);
  const diagonal = bounds
    ? Math.hypot(bounds[2] - bounds[0], bounds[3] - bounds[1])
    : 0.01;
  let tolerance = Math.max(diagonal / 2000, 1e-7);
  let simplified = douglasPeucker(clean, tolerance ** 2);
  while (simplified.length > maxPoints && tolerance < 1) {
    tolerance *= 2;
    simplified = douglasPeucker(clean, tolerance ** 2);
  }
  return simplified.length <= maxPoints ? simplified : uniform(simplified, maxPoints);
}

export function boundsOf(points: TrackPoint[]): MapBounds | null {
  if (points.length === 0) return null;
  let west = points[0].lng;
  let south = points[0].lat;
  let east = points[0].lng;
  let north = points[0].lat;
  for (const point of points) {
    if (point.lng < west) west = point.lng;
    if (point.lng > east) east = point.lng;
    if (point.lat < south) south = point.lat;
    if (point.lat > north) north = point.lat;
  }
  return [west, south, east, north];
}

export function mergeBounds(bounds: Array<MapBounds | null>): MapBounds | null {
  const valid = bounds.filter((b): b is MapBounds => Array.isArray(b));
  if (valid.length === 0) return null;
  return valid.reduce<MapBounds>(
    (acc, b) => [
      Math.min(acc[0], b[0]),
      Math.min(acc[1], b[1]),
      Math.max(acc[2], b[2]),
      Math.max(acc[3], b[3]),
    ],
    [...valid[0]]
  );
}
```

- [ ] **Step 5 : écrire les tests de modes (rouges)**

```ts
// src/features/compte/map/__tests__/modes.test.ts
import { describe, expect, it } from 'vitest';
import { mapModeConfig, resolveSheetMode } from '../modes';

describe('mapModeConfig', () => {
  it('ne montre aucun calque de données pour Prêts et Réseau', () => {
    for (const mode of ['prets', 'reseau', 'compte'] as const) {
      const config = mapModeConfig(mode);
      expect(config.layers.tracks).toBe('none');
      expect(config.layers.massifs).toBe(false);
      expect(config.dimmed).toBe(true);
    }
  });

  it('la sortie ne montre qu’une trace sélectionnée', () => {
    const config = mapModeConfig('sortie');
    expect(config.layers.tracks).toBe('selected');
    expect(config.camera).toBe('fit-selected');
  });
});

describe('resolveSheetMode', () => {
  it('mappe les cinq slots du profil', () => {
    for (const slot of ['vitrine', 'kit', 'prets', 'souvenirs', 'communaute'] as const) {
      expect(
        resolveSheetMode({ kind: 'step', step: 0, slot, detent: 'card', outingId: null })
      ).toBe(slot);
    }
  });

  it('mappe les drawers Réseau, Compte et Sortie', () => {
    const base = { step: 0, slot: null, detent: 'card', outingId: null };
    expect(resolveSheetMode({ ...base, kind: 'followers_sheet' })).toBe('reseau');
    expect(resolveSheetMode({ ...base, kind: 'account_drawer' })).toBe('compte');
    expect(resolveSheetMode({ ...base, kind: 'outing_drawer' })).toBe('sortie');
  });

  it('retombe sur overview sans drawer', () => {
    expect(
      resolveSheetMode({ kind: null, step: 0, slot: null, detent: 'closed', outingId: null })
    ).toBe('overview');
  });
});
```

- [ ] **Step 6 : implémenter `modes.ts`**

```ts
// src/features/compte/map/modes.ts
import type {
  CompteMapMode,
  CompteMapSheet,
  MapModeConfig,
  MapTrack,
} from './types';

const CONFIG: Record<CompteMapMode, MapModeConfig> = {
  overview: {
    mode: 'overview',
    label: 'Ta carte',
    emptyTitle: 'Ta carte se dessine à ta première sortie.',
    emptyHint: 'Enregistre une sortie pour voir ta trace, tes massifs et tes kilomètres.',
    emptyCta: { label: 'Enregistrer une sortie', href: '/compas' },
    camera: 'fit-all',
    layers: { tracks: 'all', massifs: true, carnets: true, pois: true, outingPins: true },
    hud: 'full',
    dimmed: false,
  },
  vitrine: {
    mode: 'vitrine',
    label: 'Vitrine',
    emptyTitle: 'Aucune sortie publiée.',
    emptyHint: 'Tes statistiques apparaîtront ici dès ta première sortie.',
    emptyCta: { label: 'Enregistrer une sortie', href: '/compas' },
    camera: 'fit-all',
    layers: { tracks: 'all', massifs: true, carnets: false, pois: false, outingPins: true },
    hud: 'full',
    dimmed: false,
  },
  kit: {
    mode: 'kit',
    label: 'Kit',
    emptyTitle: 'Aucune sortie liée à un kit.',
    emptyHint: 'Une sortie apparaît ici quand tu lui associes un kit réel.',
    emptyCta: { label: 'Voir mes kits', action: 'open-kits' },
    camera: 'fit-filtered',
    layers: { tracks: 'filtered', massifs: true, carnets: false, pois: false, outingPins: true },
    hud: 'count',
    dimmed: false,
  },
  prets: {
    mode: 'prets',
    label: 'Prêts',
    emptyTitle: 'Les prêts n’ont pas de position.',
    emptyHint: 'Les lieux de vie ne sont jamais publiés. Retrouve chaque prêt dans le drawer.',
    emptyCta: null,
    camera: 'keep',
    layers: { tracks: 'none', massifs: false, carnets: false, pois: false, outingPins: false },
    hud: 'none',
    dimmed: true,
  },
  souvenirs: {
    mode: 'souvenirs',
    label: 'Souvenirs',
    emptyTitle: 'Aucun souvenir géolocalisé.',
    emptyHint: 'Les sorties avec une trace GPS et les carnets liés apparaîtront ici.',
    emptyCta: null,
    camera: 'fit-filtered',
    layers: { tracks: 'filtered', massifs: true, carnets: true, pois: true, outingPins: true },
    hud: 'count',
    dimmed: false,
  },
  communaute: {
    mode: 'communaute',
    label: 'Communauté',
    emptyTitle: 'Aucune sortie partagée géolocalisée.',
    emptyHint: 'Les sorties avec au moins un compagnon réel apparaîtront ici.',
    emptyCta: null,
    camera: 'fit-filtered',
    layers: { tracks: 'filtered', massifs: true, carnets: false, pois: false, outingPins: true },
    hud: 'count',
    dimmed: false,
  },
  compte: {
    mode: 'compte',
    label: 'Compte',
    emptyTitle: '',
    emptyHint: '',
    emptyCta: null,
    camera: 'keep',
    layers: { tracks: 'none', massifs: false, carnets: false, pois: false, outingPins: false },
    hud: 'none',
    dimmed: true,
  },
  reseau: {
    mode: 'reseau',
    label: 'Réseau',
    emptyTitle: 'Le réseau n’est pas une carte.',
    emptyHint: 'Aucune position de tes relations n’est exposée.',
    emptyCta: null,
    camera: 'keep',
    layers: { tracks: 'none', massifs: false, carnets: false, pois: false, outingPins: false },
    hud: 'none',
    dimmed: true,
  },
  sortie: {
    mode: 'sortie',
    label: 'Sortie',
    emptyTitle: 'Trace GPS non enregistrée pour cette sortie.',
    emptyHint: 'La sortie existe, mais aucun point GPS n’est disponible.',
    emptyCta: null,
    camera: 'fit-selected',
    layers: { tracks: 'selected', massifs: false, carnets: false, pois: true, outingPins: true },
    hud: 'outing',
    dimmed: false,
  },
};

export function mapModeConfig(mode: CompteMapMode): MapModeConfig {
  return CONFIG[mode] ?? CONFIG.overview;
}

export function resolveSheetMode(sheet: CompteMapSheet): CompteMapMode {
  if (!sheet.kind) return 'overview';
  if (sheet.kind === 'step' && sheet.step === 0) {
    const slot = sheet.slot as CompteMapMode | null;
    return slot && slot in CONFIG ? slot : 'vitrine';
  }
  if (sheet.kind === 'account_drawer') return 'compte';
  if (sheet.kind === 'followers_sheet') return 'reseau';
  if (sheet.kind === 'outing_drawer') return 'sortie';
  return 'overview';
}

export function filterTracksForMode(
  tracks: MapTrack[],
  mode: CompteMapMode,
  selectedId?: string | null
): MapTrack[] {
  const config = mapModeConfig(mode);
  if (config.layers.tracks === 'none') return [];
  if (config.layers.tracks === 'selected') {
    return tracks.filter((track) => track.id === selectedId);
  }
  if (config.layers.tracks === 'filtered') {
    if (mode === 'kit') return tracks.filter((track) => Boolean(track.kitId));
    if (mode === 'communaute') return tracks.filter((track) => track.participantsCount > 0);
  }
  return tracks;
}
```

- [ ] **Step 7 : lancer les tests, le type-check et committer**

Run:
`npx vitest run src/features/compte/map/__tests__/geometry.test.ts src/features/compte/map/__tests__/modes.test.ts`
`npm run type-check`

Expected: PASS.

```bash
git add src/features/compte/map
git commit -m "feat(compte): contrats, géométrie et modes de la carte"
```

---

### Task 2 — Endpoint carte propriétaire et assemblage réel

**Files :**
- Create: `src/features/compte/map/server/loadCompteMap.ts`
- Create: `src/features/compte/map/__tests__/loadCompteMap.test.ts`
- Create: `src/app/api/compte/map/route.ts`
- Create: `src/app/api/compte/map/__tests__/route.test.ts`
- Create: `supabase/migrations/20261023094500_compte_map_indexes.sql`

**Interfaces :**
- Consumes : `parsePositions`, `simplifyTrack`, `boundsOf`, `mergeBounds`,
  `mapModeConfig` n'est pas utilisé côté serveur.
- Produces :
  - `interface CompteMapSourceRows`
  - `buildCompteMapPayload(rows: CompteMapSourceRows): CompteMapPayload`
  - `loadCompteMap(supabase, userId): Promise<CompteMapPayload>`
  - `GET /api/compte/map`

- [ ] **Step 1 : écrire le test de l'assembleur avec des données réelles**

```ts
// src/features/compte/map/__tests__/loadCompteMap.test.ts
import { describe, expect, it } from 'vitest';
import { buildCompteMapPayload } from '../server/loadCompteMap';

describe('buildCompteMapPayload', () => {
  const rows = {
    sessions: [
      {
        id: 's1',
        title: 'Lac Blanc',
        route_id: 7,
        started_at: '2026-09-19T06:00:00Z',
        distance_km: 12.4,
        elevation_gain_m: 860,
        max_altitude_m: 2352,
        positions_geojson: {
          type: 'LineString',
          coordinates: [
            [6.87, 45.92],
            [6.88, 45.93],
            [6.89, 45.94],
          ],
        },
        visibility: 'private',
        kit_id: 'k1',
        carnet_id: 'c1',
        poi_events: [{ label: 'Lac Blanc', lat: 45.94, lng: 6.89 }],
      },
    ],
    statsSessions: [
      { id: 's1', route_id: 7, started_at: '2026-09-19T06:00:00Z', distance_km: 12.4, elevation_gain_m: 860 },
    ],
    routes: [{ id: 7, name: 'Lac Blanc', region: 'Mont-Blanc' }],
    geoMassifs: [
      { geoname_id: 1, feature_code: 'MTS' as const, name: 'Massif du Mont-Blanc', name_plain: 'mont blanc', country_code: 'FR', lat: 45.85, lon: 6.86, elevation_m: 4808 },
    ],
    photoCounts: new Map([['s1', 3]]),
    participantCounts: new Map([['s1', 2]]),
    carnets: [{ id: 'c1', title: 'Lac Blanc', cover_image: null }],
    kitNames: new Map([['k1', 'Kit léger']]),
  };

  it('produit une trace, un massif, un carnet et un POI réels', () => {
    const payload = buildCompteMapPayload(rows);
    expect(payload.tracks).toHaveLength(1);
    expect(payload.tracks[0].title).toBe('Lac Blanc');
    expect(payload.tracks[0].kitName).toBe('Kit léger');
    expect(payload.tracks[0].photosCount).toBe(3);
    expect(payload.tracks[0].participantsCount).toBe(2);
    expect(payload.massifs[0]).toMatchObject({ name: 'Massif du Mont-Blanc', outings: 1 });
    expect(payload.carnets[0]).toMatchObject({ id: 'c1', outingId: 's1' });
    expect(payload.pois[0]).toMatchObject({ label: 'Lac Blanc', outingId: 's1' });
    expect(payload.bounds).not.toBeNull();
  });

  it('n’invente ni massif ni trace sans coordonnées', () => {
    const payload = buildCompteMapPayload({
      ...rows,
      sessions: [{ ...rows.sessions[0], positions_geojson: null, poi_events: [] }],
      routes: [{ id: 7, name: 'Lac Blanc', region: 'Massif inconnu' }],
      geoMassifs: [],
    });
    expect(payload.tracks).toHaveLength(0);
    expect(payload.massifs).toHaveLength(0);
    expect(payload.carnets).toHaveLength(0);
    expect(payload.pois).toHaveLength(0);
  });

  it('signale la troncature au-delà de 80 sorties', () => {
    const payload = buildCompteMapPayload({
      ...rows,
      statsSessions: Array.from({ length: 120 }, (_, i) => ({
        ...rows.statsSessions[0],
        id: `s${i}`,
      })),
    });
    expect(payload.truncated).toBe(true);
  });
});
```

- [ ] **Step 2 : lancer le test, vérifier l'échec**

Run: `npx vitest run src/features/compte/map/__tests__/loadCompteMap.test.ts`
Expected: FAIL — module absent.

- [ ] **Step 3 : écrire l'assembleur et le loader**

```ts
// src/features/compte/map/server/loadCompteMap.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeMassifName,
  type GeoMassifRow,
} from '@/features/compas/engine/geoMassifs';
import { mapStats } from '@/features/compte/data/accountBootstrap';
import { boundsOf, mergeBounds, parsePositions, simplifyTrack } from '../geometry';
import type {
  CompteMapPayload,
  MapCarnet,
  MapMassif,
  MapPoi,
  MapTrack,
  TrackPoint,
} from '../types';

export interface MapSessionRow {
  id: string;
  title: string | null;
  route_id: number | null;
  started_at: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
  max_altitude_m: number | null;
  positions_geojson: unknown;
  visibility: string | null;
  kit_id: string | null;
  carnet_id: string | null;
  poi_events: unknown;
}

export interface MapStatsSessionRow {
  id: string;
  route_id: number | null;
  started_at: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
}

export interface MapRouteRow {
  id: number;
  name: string | null;
  region: string | null;
}

export interface MapCarnetRow {
  id: string;
  title: string | null;
  cover_image: string | null;
}

export interface CompteMapSourceRows {
  sessions: MapSessionRow[];
  statsSessions: MapStatsSessionRow[];
  routes: MapRouteRow[];
  geoMassifs: GeoMassifRow[];
  photoCounts: Map<string, number>;
  participantCounts: Map<string, number>;
  carnets: MapCarnetRow[];
  kitNames: Map<string, string>;
}

const MAX_TRACKS = 80;
const MAX_POINTS = 120;

function number(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function yearOf(value: string | null): number | null {
  if (!value) return null;
  const year = new Date(value).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

function visibility(value: string | null): MapTrack['visibility'] {
  return value === 'collective_anonymized' ? 'collective_anonymized' : 'private';
}

function poisFor(session: MapSessionRow): MapPoi[] {
  if (!Array.isArray(session.poi_events)) return [];
  return session.poi_events.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!label) return [];
    return [{
      id: `poi_${session.id}_${index}`,
      outingId: session.id,
      label,
      day: Number.isFinite(Number(row.day)) ? Number(row.day) : null,
      position: { lat, lng },
    }];
  });
}

export function buildCompteMapPayload(rows: CompteMapSourceRows): CompteMapPayload {
  const routeById = new Map(rows.routes.map((route) => [route.id, route]));
  const geoByKey = new Map(
    rows.geoMassifs
      .map((massif) => [massif.name_plain, massif] as const)
      .filter(([key]) => Boolean(key))
  );
  const carnetById = new Map(rows.carnets.map((carnet) => [carnet.id, carnet]));

  const tracks: MapTrack[] = [];
  const massifCounts = new Map<string, { massif: GeoMassifRow; outings: number; verified: boolean }>();
  const carnets: MapCarnet[] = [];
  const pois: MapPoi[] = [];

  /* Comptage sur TOUTES les sorties, pas seulement les 80 traces affichées :
     un massif visité il y a deux ans reste un massif visité. */
  for (const session of rows.statsSessions) {
    const route = session.route_id ? routeById.get(session.route_id) : undefined;
    const key = normalizeMassifName(route?.region);
    if (!key) continue;
    const massif = geoByKey.get(key);
    if (!massif) continue;
    const current = massifCounts.get(key) ?? { massif, outings: 0, verified: false };
    current.outings += 1;
    massifCounts.set(key, current);
  }

  for (const session of rows.sessions.slice(0, MAX_TRACKS)) {
    const route = session.route_id ? routeById.get(session.route_id) : undefined;
    const region = route?.region?.trim() || '';
    const key = normalizeMassifName(region);
    const massifRow = key ? geoByKey.get(key) : undefined;
    const points = simplifyTrack(parsePositions(session.positions_geojson), MAX_POINTS);
    const verified = points.length >= 2;

    if (massifRow && key && verified) {
      const current = massifCounts.get(key);
      if (current) current.verified = true;
    }

    if (!verified) {
      for (const poi of poisFor(session)) pois.push(poi);
      continue;
    }

    const start = points[0];
    const end = points[points.length - 1];
    const track: MapTrack = {
      id: session.id,
      title:
        session.title?.trim() ||
        route?.name?.trim() ||
        (session.started_at ? `Sortie du ${session.started_at.slice(0, 10)}` : 'Sortie'),
      startedAt: session.started_at,
      year: yearOf(session.started_at),
      km: number(session.distance_km),
      dplus: number(session.elevation_gain_m),
      maxAlt: session.max_altitude_m,
      verified,
      visibility: visibility(session.visibility),
      massif: massifRow?.name || region || null,
      massifId: massifRow ? `massif_${massifRow.geoname_id}` : null,
      kitId: session.kit_id,
      kitName: session.kit_id ? rows.kitNames.get(session.kit_id) ?? null : null,
      carnetId: session.carnet_id,
      photosCount: rows.photoCounts.get(session.id) ?? 0,
      participantsCount: rows.participantCounts.get(session.id) ?? 0,
      coordinates: points,
      bounds: boundsOf(points)!,
      start,
      end,
    };
    tracks.push(track);

    for (const poi of poisFor(session)) pois.push(poi);

    const carnet = session.carnet_id ? carnetById.get(session.carnet_id) : undefined;
    if (carnet && !carnets.some((entry) => entry.id === carnet.id)) {
      carnets.push({
        id: carnet.id,
        title: carnet.title?.trim() || 'Carnet',
        coverUrl: carnet.cover_image?.trim() || null,
        outingId: session.id,
        position: start,
      });
    }
  }

  const massifs: MapMassif[] = [...massifCounts.entries()].map(([key, entry]) => ({
    id: `massif_${entry.massif.geoname_id}`,
    name: entry.massif.name,
    countryCode: entry.massif.country_code,
    center: { lng: entry.massif.lon, lat: entry.massif.lat },
    outings: entry.outings,
    verified: entry.verified,
  }));

  const stats = mapStats(rows.statsSessions as never, rows.routes as never, rows.geoMassifs as never);
  const bounds = mergeBounds([
    ...tracks.map((track) => track.bounds),
    ...massifs.map((massif) => [massif.center.lng, massif.center.lat, massif.center.lng, massif.center.lat] as const),
    ...pois.map((poi) => [poi.position.lng, poi.position.lat, poi.position.lng, poi.position.lat] as const),
  ]);

  return {
    tracks,
    massifs,
    carnets,
    pois,
    stats: {
      outings: stats.outings,
      km: stats.km,
      dplus: stats.dplus,
      massifs: stats.massifs,
      countries: stats.countries,
    },
    bounds,
    truncated: rows.statsSessions.length > rows.sessions.length,
    generatedAt: new Date().toISOString(),
  };
}

export async function loadCompteMap(
  supabase: SupabaseClient,
  userId: string
): Promise<CompteMapPayload> {
  const [sessionRes, statsRes] = await Promise.all([
    supabase
      .from('hike_sessions')
      .select(
        'id,title,started_at,distance_km,elevation_gain_m,max_altitude_m,positions_geojson,visibility,kit_id,carnet_id,poi_events,route_id'
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(MAX_TRACKS),
    supabase
      .from('hike_sessions')
      .select('id,route_id,started_at,distance_km,elevation_gain_m')
      .eq('user_id', userId),
  ]);

  const sessions = (sessionRes.data ?? []) as unknown as MapSessionRow[];
  const statsSessions = (statsRes.data ?? []) as unknown as MapStatsSessionRow[];
  const sessionIds = sessions.map((session) => session.id);
  const routeIds = [
    ...new Set(
      statsSessions
        .map((session) => session.route_id)
        .filter((id): id is number => typeof id === 'number')
    ),
  ];
  const kitIds = [...new Set(sessions.map((s) => s.kit_id).filter((id): id is string => Boolean(id)))];
  const carnetIds = [
    ...new Set(sessions.map((s) => s.carnet_id).filter((id): id is string => Boolean(id))),
  ];

  const [photoRes, participantRes, routeRes, kitRes, carnetRes] = await Promise.all([
    sessionIds.length
      ? supabase.from('hike_session_photos').select('session_id').in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: string }> }),
    sessionIds.length
      ? supabase
          .from('hike_session_participants')
          .select('session_id,role')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: string; role: string | null }> }),
    routeIds.length
      ? supabase.from('hiking_routes').select('id,name,region').in('id', routeIds)
      : Promise.resolve({ data: [] as MapRouteRow[] }),
    kitIds.length
      ? supabase.from('materiel_kits').select('id,name').in('id', kitIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    carnetIds.length
      ? supabase.from('carnets').select('id,title,cover_image').in('id', carnetIds)
      : Promise.resolve({ data: [] as MapCarnetRow[] }),
  ]);

  const routes = (routeRes.data ?? []) as MapRouteRow[];
  const massifKeys = [
    ...new Set(
      routes
        .map((route) => normalizeMassifName(route.region))
        .filter((key): key is string => Boolean(key))
    ),
  ];
  const massifRes = massifKeys.length
    ? await supabase
        .from('geo_massifs')
        .select('geoname_id,feature_code,name,name_plain,country_code,lat,lon,elevation_m')
        .in('name_plain', massifKeys)
    : { data: [] as GeoMassifRow[] };

  const photoCounts = new Map<string, number>();
  for (const row of (photoRes.data ?? []) as Array<{ session_id: string }>) {
    photoCounts.set(row.session_id, (photoCounts.get(row.session_id) ?? 0) + 1);
  }
  const participantCounts = new Map<string, number>();
  for (const row of (participantRes.data ?? []) as Array<{ session_id: string; role: string | null }>) {
    // Le propriétaire est aussi une ligne `owner` : on ne compte que les
    // compagnons réels, sinon toutes les sorties seraient « partagées ».
    if (row.role === 'guest') {
      participantCounts.set(row.session_id, (participantCounts.get(row.session_id) ?? 0) + 1);
    }
  }
  const kitNames = new Map(
    ((kitRes.data ?? []) as Array<{ id: string; name: string | null }>).map((kit) => [
      kit.id,
      kit.name?.trim() || 'Kit',
    ])
  );

  return buildCompteMapPayload({
    sessions,
    statsSessions,
    routes,
    geoMassifs: (massifRes.data ?? []) as GeoMassifRow[],
    photoCounts,
    participantCounts,
    carnets: (carnetRes.data ?? []) as MapCarnetRow[],
    kitNames,
  });
}
```

- [ ] **Step 4 : écrire la route API**

```ts
// src/app/api/compte/map/route.ts
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadCompteMap } from '@/features/compte/map/server/loadCompteMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok(await loadCompteMap(auth.supabase, auth.user.id));
  } catch {
    return fail('server', 'Impossible de charger ta carte.');
  }
}
```

- [ ] **Step 5 : test de route (401 / 200 / 500)**

```ts
// src/app/api/compte/map/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireUser = vi.fn();
const loadCompteMap = vi.fn();
vi.mock('@/lib/api/requireUser', () => ({ requireUser }));
vi.mock('@/features/compte/map/server/loadCompteMap', () => ({ loadCompteMap }));

import { GET } from '../route';

describe('GET /api/compte/map', () => {
  beforeEach(() => {
    requireUser.mockReset();
    loadCompteMap.mockReset();
  });

  it('refuse sans session', async () => {
    requireUser.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(loadCompteMap).not.toHaveBeenCalled();
  });

  it('renvoie la carte du propriétaire', async () => {
    requireUser.mockResolvedValue({ ok: true, supabase: {}, user: { id: 'u1' } });
    loadCompteMap.mockResolvedValue({ tracks: [], massifs: [], carnets: [], pois: [], stats: { outings: 0, km: 0, dplus: 0, massifs: 0, countries: 0 }, bounds: null, truncated: false, generatedAt: 'x' });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(loadCompteMap).toHaveBeenCalledWith({}, 'u1');
  });

  it('ne casse pas la page en cas d’erreur serveur', async () => {
    requireUser.mockResolvedValue({ ok: true, supabase: {}, user: { id: 'u1' } });
    loadCompteMap.mockRejectedValue(new Error('boom'));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 6 : migration d'index**

```sql
-- supabase/migrations/20261023094500_compte_map_indexes.sql
-- Lecture de la carte du Compte : les 80 sorties récentes d'un utilisateur.
create index if not exists idx_hike_sessions_user_started
  on public.hike_sessions (user_id, started_at desc);
```

- [ ] **Step 7 : exécuter, vérifier, committer**

Run:
`npx vitest run src/features/compte/map/__tests__/loadCompteMap.test.ts src/app/api/compte/map/__tests__/route.test.ts`
`npm run type-check`

Expected: PASS.

```bash
git add src/features/compte/map src/app/api/compte/map supabase/migrations/20261023094500_compte_map_indexes.sql
git commit -m "feat(compte): endpoint carte réel et simplification des traces"
```

---

### Task 3 — Îlot React et chargement MapLibre

**Files :**
- Create: `src/components/compte/map/CompteMap.tsx`
- Create: `src/components/compte/map/compte-map.css`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `src/components/compte/map/__tests__/CompteMapStates.test.tsx`

**Interfaces :**
- Consumes : `CompteMapPayload`, `createMapStyle`, `setWorkerUrl`.
- Produces : `<CompteMap authState context />`, `window.__lkdvCompteMapReady`,
  `window.__lkdvCompteMapOpenOuting`.

- [ ] **Step 1 : ajouter le nœud carte dans la coquille**

Dans `COMPTE_V8_HTML`, remplacer le contenu de `.mapzone` par :

```html
<section class="mapzone" aria-label="Carte de tes sorties">
  <div class="map" id="map">
    <div id="lkdv-map-root" style="position:absolute;inset:0;z-index:1;"></div>
  </div>
</section>
```

Dans `CompteLiquidGlassV8.tsx`, après `el.innerHTML = COMPTE_V8_HTML` :

```ts
const mapNode = el.querySelector<HTMLElement>('#lkdv-map-root');
if (mapNode) setMapRoot(mapNode);
```

Ajouter l'état :

```ts
const [mapRoot, setMapRoot] = useState<HTMLElement | null>(null);
```

Et le portail, à côté de `drawerMount` :

```tsx
{mapRoot
  ? createPortal(
      <CompteMap
        authState={
          bootstrapPhase === 'ready'
            ? (bootstrapPayloadRef.current as { authenticated?: boolean } | null)?.authenticated
              ? 'owner'
              : 'guest'
            : bootstrapPhase === 'error'
              ? 'error'
              : 'loading'
        }
        context={mapContext}
      />,
      mapRoot
    )
  : null}
```

- [ ] **Step 2 : écrire le test d'états sans MapLibre**

```tsx
// src/components/compte/map/__tests__/CompteMapStates.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapState } from '../CompteMap';

describe('CompteMapState', () => {
  it('invité : CTA connexion, aucun marqueur', () => {
    render(<CompteMapState kind="guest" />);
    expect(screen.getByText('Connecte-toi pour voir ta carte.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?redirect=/compte'
    );
  });

  it('vide : un seul message et un CTA', () => {
    render(<CompteMapState kind="empty" />);
    expect(screen.getByText('Ta carte se dessine à ta première sortie.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enregistrer une sortie' })).toHaveAttribute(
      'href',
      '/compas'
    );
  });

  it('erreur : bouton réessayer', () => {
    const onRetry = vi.fn();
    render(<CompteMapState kind="error" onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Réessayer' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3 : écrire `CompteMap.tsx` — chargement et sources**

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { prefersReducedMotion } from '@/components/map/engine/camera';
import type {
  CompteMapMode,
  CompteMapPayload,
  MapTrack,
} from '@/features/compte/map/types';
import { filterTracksForMode, mapModeConfig } from '@/features/compte/map/modes';
import './compte-map.css';

const DEFAULT_CENTER: [number, number] = [2.5, 46.5];

function tracksFeatureCollection(tracks: MapTrack[]) {
  return {
    type: 'FeatureCollection' as const,
    features: tracks.map((track) => ({
      type: 'Feature' as const,
      properties: {
        id: track.id,
        year: track.year ?? 0,
        kitId: track.kitId ?? '',
        participants: track.participantsCount,
        visibility: track.visibility,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: track.coordinates.map((point) => [point.lng, point.lat]),
      },
    })),
  };
}

async function fetchCompteMap(): Promise<CompteMapPayload> {
  const response = await fetch('/api/compte/map', { cache: 'no-store' });
  if (response.status === 401) {
    const error = new Error('unauthorized');
    (error as Error & { code?: string }).code = 'unauthorized';
    throw error;
  }
  if (!response.ok) throw new Error(`map_http_${response.status}`);
  return (await response.json()) as CompteMapPayload;
}

export function CompteMap({
  authState,
  context,
}: {
  authState: 'loading' | 'guest' | 'owner' | 'error';
  context: { mode: CompteMapMode; outingId?: string | null };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const config = mapModeConfig(context.mode);
  const query = useQuery({
    queryKey: ['compte-map'],
    queryFn: fetchCompteMap,
    enabled: authState === 'owner',
    staleTime: 60_000,
    retry: 1,
  });
  const data = query.data;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const map = new MapLibreMap({
      container: containerRef.current,
      style: createMapStyle('satellite'),
      center: DEFAULT_CENTER,
      zoom: 4.2,
      minZoom: 1.2,
      maxZoom: 18,
      maxPitch: 70,
      attributionControl: false,
      renderWorldCopies: false,
      locale: { 'Map.Title': 'Carte du compte' },
    });
    mapRef.current = map;
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => map.resize())
        : null;
    observer?.observe(containerRef.current);
    const timeout = window.setTimeout(() => setStyleFailed(true), 4000);
    map.on('style.load', () => {
      window.clearTimeout(timeout);
      setStyleFailed(false);
      setReady(true);
    });
    return () => {
      window.clearTimeout(timeout);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data || !map.isStyleLoaded()) return;
    if (map.getSource('compte-tracks')) {
      (map.getSource('compte-tracks') as GeoJSONSource).setData(
        tracksFeatureCollection(data.tracks)
      );
    } else {
      map.addSource('compte-tracks', {
        type: 'geojson',
        data: tracksFeatureCollection(data.tracks),
      });
      map.addLayer({
        id: 'compte-tracks-glow',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5B7F55',
          'line-width': 7,
          'line-opacity': 0.35,
          'line-blur': 4,
        },
      });
      map.addLayer({
        id: 'compte-tracks-line',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#17402C',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
    }

    const bounds = data.bounds;
    if (bounds && config.camera === 'fit-all') {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: 24,
          maxZoom: 11,
          duration: prefersReducedMotion() ? 0 : 1000,
          essential: true,
        }
      );
    }
  }, [data, config.camera, ready]);

  return (
    <div
      className="lkdv-map-root"
      role="region"
      aria-label="Carte de tes sorties"
      data-map-mode={context.mode}
      data-map-ready={ready ? 'true' : 'false'}
      data-map-style-failed={styleFailed ? 'true' : 'false'}
      data-map-empty={data && data.tracks.length === 0 ? 'true' : 'false'}
      data-map-dimmed={config.dimmed ? 'true' : 'false'}
    >
      <div ref={containerRef} className="lkdv-map-canvas" />
      <p className="sr-only" aria-live="polite">
        {data
          ? `Carte de tes sorties : ${data.stats.outings} sorties, ${data.stats.km} kilomètres, ${data.stats.massifs} massifs.`
          : 'Carte en chargement.'}
      </p>
      {!ready && !styleFailed ? <div className="lkdv-map-loading" aria-hidden="true" /> : null}
      {styleFailed ? <CompteMapState kind="fallback" data={data} /> : null}
      {ready && data && data.tracks.length === 0 ? (
        data.stats.outings > 0 ? (
          <CompteMapState
            kind="no-tracks"
            count={data.stats.outings}
            onOpenOutings={() => window.__lkdvOpenSlot?.('souvenirs')}
          />
        ) : (
          <CompteMapState kind="empty" />
        )
      ) : null}
      {ready && authState === 'owner' && config.dimmed && config.emptyTitle ? (
        <CompteMapState kind="neutral" title={config.emptyTitle} hint={config.emptyHint} />
      ) : null}
      {authState === 'guest' ? <CompteMapState kind="guest" /> : null}
      {authState === 'error' || query.isError ? (
        <CompteMapState kind="error" onRetry={() => query.refetch()} />
      ) : null}
    </div>
  );
}

export function CompteMapState({
  kind,
  onRetry,
  data,
  count,
  onOpenOutings,
  title,
  hint,
}: {
  kind: 'guest' | 'empty' | 'no-tracks' | 'neutral' | 'error' | 'fallback';
  onRetry?: () => void;
  data?: CompteMapPayload;
  count?: number;
  onOpenOutings?: () => void;
  title?: string;
  hint?: string;
}) {
  const state = {
    guest: {
      title: 'Connecte-toi pour voir ta carte.',
      hint: 'Tes traces, tes massifs et tes carnets restent privés.',
      cta: <a href="/connexion?redirect=/compte">Se connecter</a>,
    },
    empty: {
      title: 'Ta carte se dessine à ta première sortie.',
      hint: 'Enregistre une sortie pour voir ta trace, tes massifs et tes kilomètres.',
      cta: <a href="/compas">Enregistrer une sortie</a>,
    },
    neutral: {
      title: title ?? '',
      hint: hint ?? '',
      cta: null,
    },
    'no-tracks': {
      title: `${count ?? 0} sortie(s) enregistrée(s), aucune trace GPS.`,
      hint: 'Les sorties sans trace restent dans tes Souvenirs, mais ne peuvent pas être dessinées.',
      cta: (
        <button type="button" onClick={onOpenOutings}>
          Voir mes sorties
        </button>
      ),
    },
    error: {
      title: 'Impossible de charger ta carte.',
      hint: 'Vérifie ta connexion, puis réessaie.',
      cta: <button type="button" onClick={onRetry}>Réessayer</button>,
    },
    fallback: {
      title: 'Carte simplifiée',
      hint: data?.tracks.length
        ? `${data.tracks.length} sorties affichées sans relief 3D.`
        : 'Aucune trace à afficher pour le moment.',
      cta: null,
    },
  }[kind];

  return (
    <div className="lkdv-map-state" data-kind={kind}>
      <b>{state.title}</b>
      <p>{state.hint}</p>
      {state.cta}
    </div>
  );
}

export default CompteMap;
```

- [ ] **Step 4 : écrire le CSS de base**

```css
/* src/components/compte/map/compte-map.css */
.lkdv-map-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #0b101b;
  border-radius: 32px 32px 0 0;
}
.lkdv-map-canvas {
  position: absolute;
  inset: 0;
  transition: filter 300ms ease-out;
}
.lkdv-map-root[data-map-dimmed='true'] .lkdv-map-canvas {
  filter: saturate(0.55) brightness(0.9);
}
.lkdv-map-root .maplibregl-canvas {
  outline: none;
}
.lkdv-map-loading {
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, #0b101b, #142018, #0b101b);
  background-size: 220% 100%;
  animation: lkdv-map-shimmer 1.4s ease-in-out infinite;
}
@keyframes lkdv-map-shimmer {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
.lkdv-map-state {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(300px, calc(100% - 32px));
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 0 0 0.5px rgba(23, 43, 36, 0.14),
    0 8px 22px rgba(23, 43, 36, 0.12);
  text-align: center;
  color: #17402c;
}
.lkdv-map-state b {
  display: block;
  font: 600 15px/1.3 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-state p {
  margin: 4px 0 12px;
  font: 400 12px/1.4 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  color: #365233;
}
.lkdv-map-state a,
.lkdv-map-state button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: rgba(150, 186, 142, 0.5);
  color: #17402c;
  font: 600 13px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .lkdv-map-loading { animation: none; }
}
```

- [ ] **Step 5 : isoler la carte dans le test de bootstrap**

`ProfileDrawerBootstrap.test.tsx` monte la coquille entière dans jsdom, sans
WebGL. Ajouter en tête de fichier :

```ts
vi.mock('@/components/compte/map/CompteMap', () => ({
  CompteMap: () => null,
}));
```

Cela garde le test centré sur le drawer et évite de simuler tout MapLibre.

- [ ] **Step 6 : empêcher l'ancienne initialisation**

Dans `compte-liquid-glass-v8-runtime.js`, remplacer l'appel `setup3DMap();` par :

```js
/* La carte est un îlot React monté dans #lkdv-map-root. */
```

Ne pas supprimer la fonction tout de suite (Task 10). Vérifier qu'aucun
`window.maplibregl` n'est plus requis par la coquille : retirer la ligne
`(window as any).maplibregl = maplibregl;` de `CompteLiquidGlassV8.tsx` et
l'import `maplibregl` devenu inutile.

- [ ] **Step 7 : tests, type-check, commit**

Run:
`npx vitest run src/components/compte/map/__tests__/CompteMapStates.test.tsx`
`npm run type-check`

Expected: PASS.

```bash
git add src/components/compte/map src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/compte-liquid-glass-v8-runtime.js
git commit -m "feat(compte): carte React MapLibre alimentée par les traces réelles"
```

---

### Task 4 — Interface verre : capsules, contrôles, synthèse

**Files :**
- Create: `src/components/compte/map/CompteMapHud.tsx`
- Modify: `src/components/compte/map/compte-map.css`
- Test: `src/components/compte/map/__tests__/CompteMapHud.test.tsx`

**Interfaces :**
- Consumes : `MapModeConfig`, `CompteMapStats`.
- Produces : `<CompteMapHud config stats scale onScale onRecenter onLayers onExpand onLocate />`.

- [ ] **Step 1 : test du HUD**

```tsx
// src/components/compte/map/__tests__/CompteMapHud.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapHud } from '../CompteMapHud';
import { mapModeConfig } from '@/features/compte/map/modes';

const stats = { outings: 12, km: 351, dplus: 20200, massifs: 4, countries: 2 };

describe('CompteMapHud', () => {
  it('affiche la capsule et la synthèse', () => {
    render(
      <CompteMapHud
        config={mapModeConfig('overview')}
        stats={stats}
        scale="globe"
        onScale={vi.fn()}
        onRecenter={vi.fn()}
        onLayers={vi.fn()}
        onExpand={vi.fn()}
        onLocate={vi.fn()}
      />
    );
    expect(screen.getByText('Ta carte')).toBeInTheDocument();
    expect(screen.getByText('12 sorties · 351 km · 4 massifs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recentrer la carte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vue globe' })).toBeInTheDocument();
  });

  it('masque tout pour le mode Compte', () => {
    const { container } = render(
      <CompteMapHud
        config={mapModeConfig('compte')}
        stats={stats}
        scale="globe"
        onScale={vi.fn()}
        onRecenter={vi.fn()}
        onLayers={vi.fn()}
        onExpand={vi.fn()}
        onLocate={vi.fn()}
      />
    );
    expect(container.querySelector('.lkdv-map-hud')).toBeNull();
  });
});
```

- [ ] **Step 2 : implémenter le HUD**

```tsx
'use client';

import React from 'react';
import { Crosshair, Layers, LocateFixed, Maximize2 } from 'lucide-react';
import type { CompteMapStats, MapModeConfig } from '@/features/compte/map/types';

export type MapScale = 'globe' | 'massif' | 'sentier';

export function CompteMapAttribution() {
  return (
    <div className="lkdv-map-attribution">
      <a href="https://www.esri.com" target="_blank" rel="noreferrer noopener">
        Powered by Esri
      </a>
      <span aria-hidden="true"> · </span>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
        © OpenStreetMap
      </a>
    </div>
  );
}

export function CompteMapHud({
  config,
  stats,
  truncated = false,
  scale,
  onScale,
  onRecenter,
  onLayers,
  onExpand,
  onLocate,
}: {
  config: MapModeConfig;
  stats: CompteMapStats;
  truncated?: boolean;
  scale: MapScale;
  onScale: (scale: MapScale) => void;
  onRecenter: () => void;
  onLayers: () => void;
  onExpand: () => void;
  onLocate: () => void;
}) {
  if (config.hud === 'none') return null;

  const summary =
    config.hud === 'outing'
      ? 'Sortie sélectionnée'
      : `${stats.outings} sorties · ${stats.km} km · ${stats.massifs} massifs${
          truncated ? ' · 80 affichées' : ''
        }`;

  return (
    <div className="lkdv-map-hud">
      <div className="lkdv-map-top">
        <div className="lkdv-map-capsule" role="status">
          <span>{config.label}</span>
          <b>{stats.outings}</b>
        </div>
        <div className="lkdv-map-scale" role="group" aria-label="Échelle de la carte">
          {(['globe', 'massif', 'sentier'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={scale === item ? 'active' : ''}
              aria-pressed={scale === item}
              aria-label={
                item === 'globe' ? 'Vue globe' : item === 'massif' ? 'Vue massif' : 'Vue sentier'
              }
              onClick={() => onScale(item)}
            >
              {item === 'globe' ? 'Globe' : item === 'massif' ? 'Massif' : 'Sentier'}
            </button>
          ))}
        </div>
      </div>

      <div className="lkdv-map-controls">
        <button type="button" onClick={onLayers} aria-label="Changer le fond de carte">
          <Layers size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onRecenter} aria-label="Recentrer la carte">
          <Crosshair size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onExpand} aria-label="Agrandir la carte">
          <Maximize2 size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onLocate} aria-label="Ma position">
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="lkdv-map-summary" aria-live="polite">
        {summary}
      </div>
    </div>
  );
}

export default CompteMapHud;
```

- [ ] **Step 3 : CSS verre exact**

```css
.lkdv-map-hud {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  transition: opacity 160ms ease-out;
}
.lkdv-map-hud button {
  pointer-events: auto;
}
.lkdv-map-hud button:focus-visible,
.lkdv-map-callout button:focus-visible {
  outline: 2px solid #17402c;
  outline-offset: 2px;
}
.lkdv-map-scale button,
.lkdv-map-callout-close,
.lkdv-map-callout-cta {
  position: relative;
}
.lkdv-map-scale button::after,
.lkdv-map-callout-close::after,
.lkdv-map-callout-cta::after {
  content: '';
  position: absolute;
  inset: -8px 0;
}
.phone.sheet-open .lkdv-map-hud {
  opacity: 0;
  pointer-events: none;
}
.lkdv-map-top {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lkdv-map-capsule,
.lkdv-map-scale,
.lkdv-map-controls button,
.lkdv-map-summary,
.lkdv-map-attribution {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.486),
    rgba(255, 255, 255, 0.325) 55%,
    rgba(255, 255, 255, 0.404)
  );
  -webkit-backdrop-filter: blur(4px) saturate(1.9) brightness(1.07);
  backdrop-filter: blur(4px) saturate(1.9) brightness(1.07);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px rgba(255, 255, 255, 0.45),
    inset 1px 0 1px rgba(255, 255, 255, 0.28),
    inset -1px 0 1px rgba(255, 255, 255, 0.28),
    inset 0 0 12px rgba(255, 255, 255, 0.14),
    0 0 0 0.5px rgba(23, 43, 36, 0.14),
    0 8px 22px rgba(23, 43, 36, 0.12);
  color: #172b24;
}
.lkdv-map-capsule {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 14px;
  border-radius: 999px;
  font: 600 13px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-capsule b {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}
.lkdv-map-scale {
  display: inline-flex;
  height: 48px;
  padding: 3px;
  border-radius: 999px;
}
.lkdv-map-scale button {
  height: 42px;
  min-width: 64px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: #56665d;
  font: 600 12px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-scale button.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.26));
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 1px rgba(255, 255, 255, 0.5),
    0 0 0 0.5px rgba(23, 43, 36, 0.07),
    0 2px 8px rgba(23, 43, 36, 0.08);
  color: #17402c;
}
.lkdv-map-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lkdv-map-controls button {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  color: #17402c;
  font-size: 18px;
}
.lkdv-map-summary {
  position: absolute;
  left: 10px;
  bottom: 10px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font: 600 11px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-attribution {
  position: absolute;
  right: 10px;
  bottom: 10px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font: 500 10px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  opacity: 0.78;
}
.lkdv-map-attribution a {
  color: inherit;
  text-decoration: none;
}
.lkdv-map-attribution a:focus-visible {
  outline: 2px solid var(--lkv-focus-ring, #17402c);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .lkdv-map-hud * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 4 : intégrer le HUD dans `CompteMap`**

```tsx
import { CompteMapAttribution, CompteMapHud } from './CompteMapHud';

// … dans le rendu :
{ready && authState === 'owner' && !query.isError ? (
  <CompteMapHud
    config={config}
    stats={data?.stats ?? { outings: 0, km: 0, dplus: 0, massifs: 0, countries: 0 }}
    truncated={data?.truncated}
    scale={scale}
    onScale={handleScale}
    onRecenter={handleRecenter}
    onLayers={handleLayers}
    onExpand={handleExpand}
    onLocate={handleLocate}
  />
) : null}
{ready ? <CompteMapAttribution /> : null}
```

- [ ] **Step 5 : tests, type-check, commit**

Run:
`npx vitest run src/components/compte/map/__tests__/CompteMapHud.test.tsx`
`npm run type-check`

```bash
git add src/components/compte/map
git commit -m "feat(compte): interface carte en verre alignée sur la barre du bas"
```

---

### Task 5 — Marqueurs, callout et interactions

**Files :**
- Create: `src/components/compte/map/CompteMapCallout.tsx`
- Modify: `src/components/compte/map/CompteMap.tsx`
- Test: `src/components/compte/map/__tests__/CompteMapCallout.test.tsx`

**Interfaces :**
- Produces : `<CompteMapCallout kind data onClose onOpen />`.
- Consumes : `MapTrack`, `MapMassif`, `MapCarnet`, `MapPoi`.

- [ ] **Step 1 : test du callout**

```tsx
// src/components/compte/map/__tests__/CompteMapCallout.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapCallout } from '../CompteMapCallout';

it('affiche une sortie réelle et son action', () => {
  const onOpen = vi.fn();
  render(
    <CompteMapCallout
      kind="outing"
      data={{
        id: 's1',
        title: 'Lac Blanc',
        startedAt: '2026-09-19T06:00:00Z',
        km: 12.4,
        dplus: 860,
        maxAlt: 2352,
        verified: true,
        photosCount: 3,
        participantsCount: 2,
      }}
      onClose={vi.fn()}
      onOpen={onOpen}
    />
  );
  expect(screen.getByText('Lac Blanc')).toBeInTheDocument();
  expect(screen.getByText(/12,4 km/)).toBeInTheDocument();
  expect(screen.getByText(/860 m/)).toBeInTheDocument();
  screen.getByRole('button', { name: 'Voir la sortie' }).click();
  expect(onOpen).toHaveBeenCalledWith('s1');
});

it('n’affiche pas de faux Massif du Mont-Blanc pour un massif sans nom', () => {
  render(
    <CompteMapCallout
      kind="massif"
      data={{ id: 'm1', name: 'Massif inconnu', outings: 1, verified: false }}
      onClose={vi.fn()}
      onOpen={vi.fn()}
    />
  );
  expect(screen.queryByText('Massif du Mont-Blanc')).toBeNull();
});
```

- [ ] **Step 2 : implémenter le callout**

```tsx
'use client';

import React from 'react';
import type { MapCarnet, MapMassif, MapPoi, MapTrack } from '@/features/compte/map/types';

type Base = { onOpen: (id: string) => void; onClose: () => void };
type Props =
  | (Base & {
      kind: 'outing';
      data: Pick<
        MapTrack,
        'id' | 'title' | 'startedAt' | 'km' | 'dplus' | 'maxAlt' | 'verified' | 'photosCount' | 'participantsCount'
      >;
    })
  | (Base & { kind: 'massif'; data: Pick<MapMassif, 'id' | 'name' | 'outings' | 'verified'> })
  | (Base & { kind: 'carnet'; data: Pick<MapCarnet, 'id' | 'title' | 'outingId'> })
  | (Base & { kind: 'poi'; data: Pick<MapPoi, 'id' | 'label' | 'outingId'> });

const NUMBER = new Intl.NumberFormat('fr-FR');

function meta(props: Props): string {
  if (props.kind === 'outing') {
    const row = props.data;
    const extras = [
      row.photosCount > 0 ? `${row.photosCount} photo(s)` : '',
      row.participantsCount > 0 ? `${row.participantsCount} compagnon(s)` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return `${NUMBER.format(row.km)} km · +${NUMBER.format(row.dplus)} m${
      row.maxAlt ? ` · ${NUMBER.format(row.maxAlt)} m` : ''
    }${extras ? ` · ${extras}` : ''}`;
  }
  if (props.kind === 'massif') return `${props.data.outings} sortie(s)`;
  if (props.kind === 'carnet') return 'Carnet lié à une sortie';
  return 'Point de la sortie';
}

export function CompteMapCallout(props: Props) {
  const title =
    props.kind === 'outing'
      ? props.data.title
      : props.kind === 'massif'
        ? props.data.name
        : props.kind === 'carnet'
          ? props.data.title
          : props.data.label;
  const action =
    props.kind === 'carnet'
      ? 'Ouvrir le carnet'
      : props.kind === 'massif'
        ? 'Voir les sorties'
        : 'Voir la sortie';
  const target =
    props.kind === 'carnet'
      ? props.data.id
      : props.kind === 'poi'
        ? props.data.outingId
        : props.data.id;
  const date =
    props.kind === 'outing' && props.data.startedAt
      ? new Date(props.data.startedAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';

  return (
    <div className="lkdv-map-callout">
      <button type="button" className="lkdv-map-callout-close" aria-label="Fermer" onClick={props.onClose}>
        ×
      </button>
      <b>{title}</b>
      {props.kind === 'outing' && props.data.verified ? (
        <span className="lkdv-map-callout-badge">Trace GPS vérifiée</span>
      ) : null}
      <p>
        {date ? `${date} · ` : ''}
        {meta(props)}
      </p>
      <button type="button" className="lkdv-map-callout-cta" onClick={() => props.onOpen(target)}>
        {action}
      </button>
    </div>
  );
}

export default CompteMapCallout;
```

- [ ] **Step 3 : marqueurs DOM et Popup dans `CompteMap`**

Ajouter :

```tsx
import { Marker, Popup } from 'maplibre-gl';
import { CompteMapCallout } from './CompteMapCallout';

const markerRefs = useRef<Marker[]>([]);
const [selected, setSelected] = useState<
  | { kind: 'outing'; id: string }
  | { kind: 'massif'; id: string }
  | { kind: 'carnet'; id: string }
  | { kind: 'poi'; id: string }
  | null
>(null);
```

Dans un effet dépendant de `data` et `ready` :

```tsx
for (const marker of markerRefs.current) marker.remove();
markerRefs.current = [];

(data.massifs ?? []).forEach((massif) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'lkdv-map-massif';
  element.setAttribute('aria-label', `${massif.name}, ${massif.outings} sorties`);
  element.innerHTML = `<span>${massif.name}</span><b>${massif.outings}</b>`;
  element.addEventListener('click', () => select({ kind: 'massif', id: massif.id }));
  const marker = new Marker({ element, anchor: 'bottom' })
    .setLngLat([massif.center.lng, massif.center.lat])
    .addTo(map);
  markerRefs.current.push(marker);
});
```

Ajouter les départs et arrivées comme couches GeoJSON :

```tsx
if (!map.getSource('compte-track-starts')) {
  map.addSource('compte-track-starts', {
    type: 'geojson',
    data: pointsCollection(data.tracks.map((track) => ({ id: track.id, position: track.start }))),
  });
  map.addLayer({
    id: 'compte-track-starts-dot',
    type: 'circle',
    source: 'compte-track-starts',
    paint: {
      'circle-radius': 5,
      'circle-color': '#17402C',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
  map.on('click', 'compte-track-starts-dot', (event) => {
    const id = event.features?.[0]?.properties?.id;
    if (id) select({ kind: 'outing', id: String(id) });
  });
}

if (!map.getSource('compte-track-ends')) {
  map.addSource('compte-track-ends', {
    type: 'geojson',
    data: pointsCollection(data.tracks.map((track) => ({ id: track.id, position: track.end }))),
  });
  map.addLayer({
    id: 'compte-track-ends-dot',
    type: 'circle',
    source: 'compte-track-ends',
    paint: {
      'circle-radius': 4,
      'circle-color': '#fff',
      'circle-stroke-color': '#17402C',
      'circle-stroke-width': 2,
    },
  });
}
```

Ajouter les carnets liés et les POI comme couches GeoJSON (pas des marqueurs
DOM : ils peuvent être nombreux) :

```tsx
function pointsCollection(
  rows: Array<{ id: string; position: { lng: number; lat: number } }>
) {
  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => ({
      type: 'Feature' as const,
      properties: { id: row.id },
      geometry: {
        type: 'Point' as const,
        coordinates: [row.position.lng, row.position.lat],
      },
    })),
  };
}

if (!map.getSource('compte-carnets')) {
  map.addSource('compte-carnets', { type: 'geojson', data: pointsCollection(data.carnets) });
  map.addLayer({
    id: 'compte-carnets-dot',
    type: 'circle',
    source: 'compte-carnets',
    paint: {
      'circle-radius': 5,
      'circle-color': '#C89A3B',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
  map.on('click', 'compte-carnets-dot', (event) => {
    const id = event.features?.[0]?.properties?.id;
    if (id) select({ kind: 'carnet', id: String(id) });
  });
}

if (!map.getSource('compte-pois')) {
  map.addSource('compte-pois', { type: 'geojson', data: pointsCollection(data.pois) });
  map.addLayer({
    id: 'compte-pois-dot',
    type: 'circle',
    source: 'compte-pois',
    paint: {
      'circle-radius': 3.5,
      'circle-color': '#4B6B7C',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
  });
  map.on('click', 'compte-pois-dot', (event) => {
    const id = event.features?.[0]?.properties?.id;
    if (id) select({ kind: 'poi', id: String(id) });
  });
}
```

Visibilité par mode :

```tsx
for (const [layer, visible] of [
  ['compte-carnets-dot', config.layers.carnets],
  ['compte-pois-dot', config.layers.pois],
  ['compte-track-starts-dot', config.layers.outingPins],
  ['compte-track-ends-dot', config.layers.tracks !== 'none'],
  ['compte-tracks-glow', config.layers.tracks !== 'none'],
  ['compte-tracks-line', config.layers.tracks !== 'none'],
] as const) {
  if (map.getLayer(layer)) {
    map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
  }
}
```

`select` mémorise la sélection :

```tsx
function select(next: NonNullable<typeof selected>) {
  setSelected(next);
}
```

Un composant `CompteMapPopupHost` reçoit `map`, `data`, `selected`, `onClose`,
`onOpen`. Il crée un `Popup` (`closeButton: false`, `closeOnClick: false`,
`offset: 14`, `maxWidth: '280px'`, `className: 'lkdv-map-popup'`), appelle
`setDOMContent(node)` et monte `CompteMapCallout` dans `node` avec
`createPortal`. `resolveSelected(data, selected)` renvoie `{ position, data }` :

- `outing` → `track.start` ;
- `massif` → `massif.center` ;
- `carnet` → `carnet.position` ;
- `poi` → `poi.position`.

Le clic sur l'action appelle :

```ts
function openSelected(kind: 'outing' | 'massif' | 'carnet' | 'poi', id: string) {
  if (kind === 'carnet') {
    window.location.assign(`/carnets/${encodeURIComponent(id)}`);
    return;
  }
  if (kind === 'massif') {
    window.__lkdvOpenSlot?.('souvenirs');
    return;
  }
  window.__lkdvCompteMapOpenOuting?.(id);
}
```

`__lkdvCompteMapOpenOuting` déclenche `window.__lkdvCompteAct?.('openOutingDrawer', id)`.

- [ ] **Step 4 : CSS marqueurs et popup**

```css
.lkdv-map-massif {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
  box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23, 43, 36, 0.12), 0 4px 12px rgba(23, 43, 36, 0.1);
  color: #17402c;
  font: 600 11px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  cursor: pointer;
}
.lkdv-map-massif b {
  font-variant-numeric: tabular-nums;
  color: #5b7f55;
}
.lkdv-map-root .maplibregl-popup-content {
  background: transparent;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
}
.lkdv-map-callout {
  position: relative;
  width: 240px;
  padding: 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12);
  color: #17402c;
}
.lkdv-map-callout b {
  display: block;
  padding-right: 22px;
  font: 600 13px/1.3 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-callout-badge {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(61, 122, 82, 0.14);
  color: #2f6b45;
  font: 600 10px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-callout p {
  margin: 3px 0 10px;
  font: 400 11px/1.4 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  color: #365233;
}
.lkdv-map-callout-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: rgba(23, 43, 36, 0.06);
  color: #17402c;
}
.lkdv-map-callout-cta {
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(150, 186, 142, 0.5);
  color: #17402c;
  font: 600 12px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
```

- [ ] **Step 5 : tests et commit**

Run:
`npx vitest run src/components/compte/map/__tests__/CompteMapCallout.test.tsx`
`npm run type-check`

```bash
git add src/components/compte/map
git commit -m "feat(compte): marqueurs et fiches verre de la carte"
```

---

### Task 6 — Caméra, échelles et mouvement

**Files :**
- Create: `src/features/compte/map/camera.ts`
- Test: `src/features/compte/map/__tests__/camera.test.ts`
- Modify: `src/components/compte/map/CompteMap.tsx`

**Interfaces :**
- Produces :
  - `type MapScale = 'globe' | 'massif' | 'sentier'`
  - `cameraForScale(scale, focus): { center; zoom; pitch; bearing }`
  - `paddingForViewport(rect, options): { top; bottom; left; right }`
  - `fitIntentForMode(mode, data, selectedId): CameraIntent | null`

- [ ] **Step 1 : tests**

```ts
// src/features/compte/map/__tests__/camera.test.ts
import { describe, expect, it } from 'vitest';
import { cameraForScale, paddingForViewport } from '../camera';

describe('cameraForScale', () => {
  it('globe : pitch 0', () => {
    expect(cameraForScale('globe', { lng: 6.8, lat: 45.9 }).pitch).toBe(0);
  });
  it('massif : pitch 30', () => {
    expect(cameraForScale('massif', { lng: 6.8, lat: 45.9 }).pitch).toBe(30);
  });
  it('sentier : pitch 55', () => {
    expect(cameraForScale('sentier', { lng: 6.8, lat: 45.9 }).pitch).toBe(55);
  });
});

describe('paddingForViewport', () => {
  it('ajoute la barre du bas et la capsule', () => {
    expect(
      paddingForViewport({ width: 430, height: 335 }, { sheetOpen: false, mapbig: false })
    ).toEqual({ top: 64, bottom: 76, left: 16, right: 16 });
  });
  it('plein écran : tient compte du haut et de la barre', () => {
    expect(
      paddingForViewport({ width: 430, height: 932 }, { sheetOpen: false, mapbig: true })
    ).toEqual({ top: 100, bottom: 84, left: 16, right: 16 });
  });
});
```

- [ ] **Step 2 : implémenter**

```ts
// src/features/compte/map/camera.ts
import type { CompteMapMode, CompteMapPayload, MapBounds } from './types';
import { mergeBounds } from './geometry';
import { filterTracksForMode } from './modes';

export type MapScale = 'globe' | 'massif' | 'sentier';
export interface CameraFocus {
  lng: number;
  lat: number;
}
export interface CameraPose {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export function cameraForScale(scale: MapScale, focus: CameraFocus): CameraPose {
  if (scale === 'globe') {
    return { center: [focus.lng, focus.lat], zoom: 2.2, pitch: 0, bearing: 0 };
  }
  if (scale === 'massif') {
    return { center: [focus.lng, focus.lat], zoom: 8.5, pitch: 30, bearing: -15 };
  }
  return { center: [focus.lng, focus.lat], zoom: 12.8, pitch: 55, bearing: -25 };
}

export function paddingForViewport(
  rect: { width: number; height: number },
  options: { sheetOpen: boolean; mapbig: boolean }
): { top: number; bottom: number; left: number; right: number } {
  if (options.mapbig) return { top: 100, bottom: 84, left: 16, right: 16 };
  if (options.sheetOpen) return { top: 56, bottom: 56, left: 16, right: 16 };
  return { top: 64, bottom: 76, left: 16, right: 16 };
}

export function centerOfBounds(bounds: MapBounds): CameraFocus {
  return {
    lng: (bounds[0] + bounds[2]) / 2,
    lat: (bounds[1] + bounds[3]) / 2,
  };
}

export function fitIntentForMode(
  mode: CompteMapMode,
  data: CompteMapPayload,
  selectedId?: string | null
): { bounds: MapBounds; maxZoom: number } | null {
  if (mode === 'sortie') {
    const track = data.tracks.find((entry) => entry.id === selectedId);
    return track ? { bounds: track.bounds, maxZoom: 14 } : null;
  }
  if (mode === 'prets' || mode === 'compte' || mode === 'reseau') return null;
  if (mode === 'kit' || mode === 'communaute' || mode === 'souvenirs') {
    const visible = filterTracksForMode(data.tracks, mode, selectedId);
    const bounds = mergeBounds(visible.map((track) => track.bounds));
    return bounds ? { bounds, maxZoom: 12 } : null;
  }
  if (data.bounds) return { bounds: data.bounds, maxZoom: 11 };
  return null;
}
```

- [ ] **Step 3 : intégrer les échelles et le fit**

Dans `CompteMap` :

```tsx
const [scale, setScale] = useState<MapScale>('globe');

const handleScale = (next: MapScale) => {
  setScale(next);
  const map = mapRef.current;
  if (!map) return;
  const focus = data?.tracks[0]?.start ?? (data?.massifs[0]?.center ?? { lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] });
  const pose = cameraForScale(next, focus);
  map.flyTo({
    center: pose.center,
    zoom: pose.zoom,
    pitch: pose.pitch,
    bearing: pose.bearing,
    duration: prefersReducedMotion() ? 0 : next === 'globe' ? 1800 : 1200,
    essential: true,
  });
};

const handleRecenter = () => {
  const map = mapRef.current;
  if (!map || !data) return;
  if (data.bounds) {
    map.fitBounds(
      [[data.bounds[0], data.bounds[1]], [data.bounds[2], data.bounds[3]]],
      {
        padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
          sheetOpen: false,
          mapbig: map.getContainer().clientHeight > 500,
        }),
        maxZoom: 11,
        duration: prefersReducedMotion() ? 0 : 900,
        essential: true,
      }
    );
  }
};

const [tileMode, setTileMode] = useState<'satellite' | 'topo'>('satellite');

const handleLayers = () => {
  const map = mapRef.current;
  if (!map) return;
  const next = tileMode === 'satellite' ? 'topo' : 'satellite';
  map.setLayoutProperty('atlas-tile-satellite', 'visibility', next === 'satellite' ? 'visible' : 'none');
  map.setLayoutProperty('atlas-tile-topo', 'visibility', next === 'topo' ? 'visible' : 'none');
  setTileMode(next);
};

const handleExpand = () => {
  (window as unknown as { __lkdvCompteAct?: (action: string) => void }).__lkdvCompteAct?.('mapbig');
};

const handleLocate = () => {
  const map = mapRef.current;
  if (!map || typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      map.flyTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: 13,
        duration: prefersReducedMotion() ? 0 : 900,
        essential: true,
      });
    },
    () => {
      /* Refus ou indisponible : aucun point inventé, aucune erreur affichée. */
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
};

/* Un seul endroit décide du cadrage : le mode courant. */
useEffect(() => {
  const map = mapRef.current;
  if (!map || !data || !ready) return;
  const intent = fitIntentForMode(context.mode, data, context.outingId);
  if (!intent) return;
  const reduced = prefersReducedMotion();
  map.fitBounds(
    [
      [intent.bounds[0], intent.bounds[1]],
      [intent.bounds[2], intent.bounds[3]],
    ],
    {
      padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
        sheetOpen: context.mode !== 'overview',
        mapbig: map.getContainer().clientHeight > 500,
      }),
      maxZoom: intent.maxZoom,
      duration: reduced ? 0 : context.mode === 'sortie' ? 1200 : 800,
      essential: true,
    }
  );
  if (context.mode === 'sortie' && !reduced) {
    map.easeTo({ pitch: 45, duration: 1200, essential: true });
  }
}, [context.mode, context.outingId, data, ready]);
```

- [ ] **Step 4 : mouvement et reduced motion**

Ajouter dans `compte-map.css` :

```css
.lkdv-map-massif,
.lkdv-map-callout,
.lkdv-map-capsule,
.lkdv-map-scale,
.lkdv-map-controls button {
  transition: transform 180ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out;
}
.lkdv-map-massif:active,
.lkdv-map-controls button:active {
  transform: scale(0.94);
}
.lkdv-map-root[data-map-ready='false'] .lkdv-map-massif {
  opacity: 0;
  transform: translateY(6px);
}
@media (prefers-reduced-motion: reduce) {
  .lkdv-map-massif,
  .lkdv-map-callout,
  .lkdv-map-capsule,
  .lkdv-map-scale,
  .lkdv-map-controls button {
    transition: none;
  }
}
```

- [ ] **Step 5 : tests, type-check, commit**

Run:
`npx vitest run src/features/compte/map/__tests__/camera.test.ts`
`npm run type-check`

```bash
git add src/features/compte/map src/components/compte/map
git commit -m "feat(compte): caméra et échelles de la carte"
```

---

### Task 7 — Pont runtime et contextes des drawers

**Files :**
- Create: `src/components/compte/map/useCompteMapContext.ts`
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.d.ts`
- Test: `src/features/compte/map/__tests__/modes.test.ts` (déjà couvert)

**Interfaces :**
- Produces :
  - `window.__lkdvCompteMapContext(ctx)`
  - `window.__lkdvCompteMapState`
  - `window.__lkdvCompteMapAction(action, id?)`
  - `useCompteMapContext(): { mode, outingId }`

- [ ] **Step 1 : déclarer les globals**

```ts
// src/components/compte/compte-liquid-glass-v8-runtime.d.ts
export {};

declare global {
  interface Window {
    __lkdvCompteMapContext?: (ctx: {
      kind: string | null;
      step: number;
      slot: string | null;
      detent: string;
      outingId: string | null;
    }) => void;
    __lkdvCompteMapState?: {
      kind: string | null;
      step: number;
      slot: string | null;
      detent: string;
      outingId: string | null;
    };
    __lkdvCompteMapAction?: (action: 'recenter' | 'fit-outing' | 'fit-massif', id?: string) => void;
    __lkdvCompteMapOpenOuting?: (id: string) => void;
    __lkdvCompteMapReady?: boolean;
    __lkdvOpenSlot?: (slotId: string) => void;
  }
}
```

- [ ] **Step 2 : émettre le contexte depuis le runtime**

Ajouter près de `applyMapContext` :

```js
function currentMapContext() {
  const sh = S.sh;
  if (!sh) return { kind: null, step: S.step || 0, slot: S.slot || null, detent: "closed", outingId: null };
  return {
    kind: sh.k || null,
    step: Number(S.step || 0),
    slot: sh.k === "step" && S.step === 0 ? slotIdOf(S.slot) : null,
    detent: sh.det || "card",
    outingId: sh.outingId || (sh.extra && sh.extra.outingId) || null,
  };
}

function notifyMapContext() {
  const ctx = currentMapContext();
  window.__lkdvCompteMapState = ctx;
  if (typeof window.__lkdvCompteMapContext === "function") {
    try { window.__lkdvCompteMapContext(ctx); } catch (_) {}
  }
}
```

Appeler `notifyMapContext()` :

- dans la branche `if (!S.sh)` de `renderSheet()` (fermeture) ;
- à la fin de `renderSheet()` (après le montage du drawer et `applyMapContext`) ;
- dans `setDet()` après la mise à jour de `data-det` ;
- dans `finishClose()` après `applyMapContext()` ;
- une fois au démarrage, après `initCompteLiquidGlassRuntime`.

- [ ] **Step 3 : hook React**

```ts
// src/components/compte/map/useCompteMapContext.ts
'use client';

import { useEffect, useState } from 'react';
import { resolveSheetMode } from '@/features/compte/map/modes';
import type { CompteMapMode, CompteMapSheet } from '@/features/compte/map/types';

const EMPTY: CompteMapSheet = {
  kind: null,
  step: 0,
  slot: null,
  detent: 'closed',
  outingId: null,
};

export function useCompteMapContext(): { mode: CompteMapMode; outingId: string | null } {
  const [sheet, setSheet] = useState<CompteMapSheet>(() =>
    typeof window !== 'undefined' && window.__lkdvCompteMapState
      ? window.__lkdvCompteMapState
      : EMPTY
  );

  useEffect(() => {
    const previous = window.__lkdvCompteMapContext;
    window.__lkdvCompteMapContext = (next) => {
      setSheet(next);
      previous?.(next);
    };
    return () => {
      window.__lkdvCompteMapContext = previous;
    };
  }, []);

  return { mode: resolveSheetMode(sheet), outingId: sheet.outingId };
}
```

- [ ] **Step 4 : brancher dans `CompteLiquidGlassV8`**

```tsx
const mapContext = useCompteMapContext();
```

Passer `context={mapContext}` à `CompteMap`. La carte filtre alors la source
selon le mode :

```tsx
useEffect(() => {
  const map = mapRef.current;
  if (!map || !data || !ready) return;
  const visible = filterTracksForMode(data.tracks, context.mode, context.outingId);
  const source = map.getSource('compte-tracks') as GeoJSONSource | undefined;
  source?.setData(tracksFeatureCollection(visible));
  (map.getSource('compte-track-starts') as GeoJSONSource | undefined)?.setData(
    pointsCollection(visible.map((track) => ({ id: track.id, position: track.start })))
  );
  (map.getSource('compte-track-ends') as GeoJSONSource | undefined)?.setData(
    pointsCollection(visible.map((track) => ({ id: track.id, position: track.end })))
  );
  const showMassifs = mapModeConfig(context.mode).layers.massifs;
  for (const marker of markerRefs.current) {
    marker.getElement().style.display = showMassifs ? '' : 'none';
  }
}, [context.mode, context.outingId, data, ready]);
```

Au montage de la carte, exposer :

```tsx
useEffect(() => {
  window.__lkdvCompteMapOpenOuting = (id: string) => {
    (window as any).__lkdvCompteAct?.('openOutingDrawer', id);
  };
  return () => {
    delete window.__lkdvCompteMapOpenOuting;
  };
}, []);
```

- [ ] **Step 5 : vérifier les contextes**

Run:
`npx vitest run src/features/compte/map/__tests__/modes.test.ts`
`npm run type-check`

Manuel sur preview : ouvrir chaque drawer, vérifier
`document.querySelector('.lkdv-map-root').dataset.mapMode` :

- aucun drawer → `overview` ;
- Vitrine → `vitrine` ;
- Kit → `kit` ;
- Prêts → `prets` ;
- Souvenirs → `souvenirs` ;
- Communauté → `communaute` ;
- Compte → `compte` ;
- Réseau → `reseau` ;
- Sortie → `sortie`.

```bash
git add src/components/compte/map src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/compte-liquid-glass-v8-runtime.js src/components/compte/compte-liquid-glass-v8-runtime.d.ts
git commit -m "feat(compte): contexte carte synchronisé avec chaque drawer"
```

---

### Task 8 — États invité, vide, erreur, WebGL et hors ligne

**Files :**
- Create: `src/components/compte/map/CompteMapFallback.tsx`
- Modify: `src/components/compte/map/CompteMap.tsx`
- Modify: `src/components/compte/map/compte-map.css`
- Test: `src/components/compte/map/__tests__/CompteMapStates.test.tsx`

**Interfaces :**
- Produces : `<CompteMapFallback tracks massifs />`.

- [ ] **Step 1 : fallback SVG réel**

```tsx
'use client';

import React from 'react';
import { boundsOf } from '@/features/compte/map/geometry';
import type { MapMassif, MapTrack } from '@/features/compte/map/types';

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 16;

/** Une seule projection pour toutes les traces : deux sorties ne doivent pas
    être étirées chacune dans leur propre cadre. */
function projector(tracks: MapTrack[], massifs: MapMassif[]) {
  const all = [
    ...tracks.flatMap((track) => track.coordinates),
    ...massifs.map((massif) => massif.center),
  ];
  const bounds = boundsOf(all) ?? [-5, 41, 10, 51];
  const [west, south, east, north] = bounds;
  const dx = Math.max(east - west, 1e-6);
  const dy = Math.max(north - south, 1e-6);
  return (point: { lng: number; lat: number }) => ({
    x: PAD + ((point.lng - west) / dx) * (WIDTH - PAD * 2),
    y: HEIGHT - PAD - ((point.lat - south) / dy) * (HEIGHT - PAD * 2),
  });
}

export function CompteMapFallback({
  tracks,
  massifs,
}: {
  tracks: MapTrack[];
  massifs: MapMassif[];
}) {
  const project = projector(tracks, massifs);
  return (
    <div className="lkdv-map-fallback" role="img" aria-label="Carte simplifiée de tes sorties">
      <svg viewBox="0 0 320 180" aria-hidden="true">
        <defs>
          <linearGradient id="lkdv-fallback-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#16241b" />
            <stop offset="1" stopColor="#0b101b" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill="url(#lkdv-fallback-bg)" />
        {tracks.map((track) => {
          const points = track.coordinates.map(project);
          return (
            <polyline
              key={track.id}
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#A6C1A0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          );
        })}
        {massifs.map((massif) => {
          const { x, y } = project(massif.center);
          return <circle key={massif.id} cx={x} cy={y} r="3" fill="#C89A3B" stroke="#fff" strokeWidth="1" />;
        })}
      </svg>
      <span>Carte simplifiée</span>
    </div>
  );
}

export default CompteMapFallback;
```

- [ ] **Step 2 : détecter WebGL et basculer**

```tsx
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
```

Dans `CompteMap`, avant `new Map` :

```tsx
if (!hasWebGL()) {
  setFallback(true);
  setReady(true);
  return;
}
```

Rendu (remplace l'ancien `CompteMapState kind="fallback"` de la Task 3) :

```tsx
{fallback || styleFailed ? (
  <CompteMapFallback tracks={data?.tracks ?? []} massifs={data?.massifs ?? []} />
) : null}
```

- [ ] **Step 3 : états hors ligne et 401**

```tsx
const [online, setOnline] = useState(true);
useEffect(() => {
  const update = () => setOnline(navigator.onLine);
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}, []);
```

- Si `!online` : afficher `data-offline="true"` et un badge « Hors ligne » ;
  ne pas lancer de refetch.
- Si la requête renvoie 401 : passer en état invité (pas une erreur brute).

- [ ] **Step 4 : CSS fallback et badge**

```css
.lkdv-map-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #0b101b;
}
.lkdv-map-fallback svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.lkdv-map-fallback span {
  position: relative;
  z-index: 1;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #17402c;
  font: 600 11px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
}
.lkdv-map-offline {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(200, 154, 59, 0.85);
  color: #fff;
  font: 600 10px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  display: inline-flex;
  align-items: center;
}
```

- [ ] **Step 5 : tests et commit**

Run:
`npx vitest run src/components/compte/map/__tests__/CompteMapStates.test.tsx`
`npm run type-check`

```bash
git add src/components/compte/map
git commit -m "feat(compte): états invité, vide, erreur et fallback réel de la carte"
```

---

### Task 9 — Année, sortie sélectionnée et actions

**Files :**
- Modify: `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- Modify: `src/components/compte/map/CompteMap.tsx`
- Test: `src/components/compte/map/__tests__/CompteMapStates.test.tsx`

**Interfaces :**
- Produces : événement `lkdv:compte-map-year` (`detail: number | null`).
- Consumes : `/api/compte/sorties/[id]` pour une sortie hors des 80 récentes.

- [ ] **Step 1 : émettre l'année depuis Souvenirs**

Dans `MemoriesSlot`, au changement de `selectedYear` (ajouter `useEffect` à
l'import React s'il n'y est pas) :

```ts
useEffect(() => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('lkdv:compte-map-year', {
      detail: selectedYear === 'all' ? null : selectedYear,
    })
  );
}, [selectedYear]);
```

- [ ] **Step 2 : écouter dans `CompteMap`**

```tsx
const [year, setYear] = useState<number | null>(null);
useEffect(() => {
  const handler = (event: Event) => {
    const value = (event as CustomEvent<number | null>).detail;
    setYear(typeof value === 'number' ? value : null);
  };
  window.addEventListener('lkdv:compte-map-year', handler);
  return () => window.removeEventListener('lkdv:compte-map-year', handler);
}, []);
```

Filtrer les traces :

```tsx
const visibleTracks = data?.tracks.filter((track) => !year || track.year === year) ?? [];
```

- [ ] **Step 3 : sortie hors payload**

Si `context.mode === 'sortie'` et `context.outingId` absent de `data.tracks` :

```tsx
const outingQuery = useQuery({
  queryKey: ['compte-map-outing', context.outingId],
  enabled: context.mode === 'sortie' && Boolean(context.outingId),
  queryFn: async () => {
    const response = await fetch(`/api/compte/sorties/${context.outingId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('outing_unavailable');
    return (await response.json()) as { points: Array<{ lat: number; lng: number }>; title: string; km: number; dplus: number };
  },
});
```

Construire une trace temporaire avec `simplifyTrack(outingQuery.data.points.map(...))`,
puis la passer à la caméra et au calque `selected`.

- [ ] **Step 4 : actions**

```tsx
const openOuting = (id: string) => {
  window.__lkdvCompteMapOpenOuting?.(id);
};
const openCarnet = (id: string) => {
  window.location.assign(`/carnets/${encodeURIComponent(id)}`);
};
```

- [ ] **Step 5 : test de la sélection**

Ajouter un test de `filterTracksForMode` pour `sortie` :

```ts
it('ne garde que la sortie sélectionnée', () => {
  const tracks = [
    { id: 'a' } as never,
    { id: 'b' } as never,
  ];
  expect(filterTracksForMode(tracks, 'sortie', 'b').map((t) => t.id)).toEqual(['b']);
});
```

- [ ] **Step 6 : tests et commit**

Run:
`npx vitest run src/features/compte/map/__tests__/modes.test.ts src/components/compte/map/__tests__`
`npm run type-check`

```bash
git add src/components/compte/map src/components/compte/drawer/slots/MemoriesSlot.tsx src/features/compte/map
git commit -m "feat(compte): année et sortie sélectionnée sur la carte"
```

---

### Task 10 — Retrait de l'ancienne carte

**Files :**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Modify: `src/components/compte/drawer/SlotShell.tsx`
- Test: `src/components/compte/__tests__/ProfileDrawerBootstrap.test.tsx`

- [ ] **Step 1 : supprimer l'initialisation et les contrôles**

- Supprimer la fonction `setup3DMap()` et son appel.
- Supprimer `#tm`, `#mctl`, `.map-scale-selector`, `#mopts`, `#mgrab` du HTML.
- Supprimer `drawMap()`, `applyMapContextLayers()`, `restoreMapContextLayers()`,
  `mapContextLayers`, `renderMopts()`, `renderMctl()`.
- Remplacer chaque appel `applyMapContext()` par `notifyMapContext()` (le pont
  React), puis supprimer `applyMapContext()` elle-même.
- Conserver `S.map.acc` et `applyShell()` pour la barre accessoire.
- Supprimer l'import `maplibregl` de `CompteLiquidGlassV8.tsx`.
- Supprimer le badge `.lkdv-map-context-badge` et le filtre
  `.mapzone[data-map-context]` de `SlotShell.tsx`.

- [ ] **Step 2 : vérifier qu'aucune référence ne reste**

Run:
`grep -rn "setup3DMap\|drawMap\|mapContextLayers\|renderMopts\|renderMctl\|lkdv-map-context-badge" src/components/compte`
Expected: aucune sortie.

Run:
`grep -rn "__lkdvCompteMap3D" src`
Expected: aucune sortie (le nom appartient à l'ancien runtime).

- [ ] **Step 3 : tests de non-régression**

Run:
`npx vitest run src/components/compte`
`npm run type-check`
`npm run build`

Expected: PASS.

- [ ] **Step 4 : commit**

```bash
git add src/components/compte
git commit -m "refactor(compte): retrait de la carte maquette et de ses contrôles"
```

---

### Task 11 — E2E, visuel et vérification production

**Files :**
- Create: `tests/e2e/compte-map.spec.ts`
- Create: `tests/visual/compte-map.spec.ts`
- Modify: `playwright.config.ts` (testMatch)
- Modify: `playwright.visual.config.ts` (si nécessaire)

- [ ] **Step 1 : inscrire la spec dans Playwright**

Dans `playwright.config.ts`, ajouter `'tests/e2e/compte-map.spec.ts'` à
`testMatch` (à côté de `tests/e2e/compte-drawer-v2.spec.ts`).

- [ ] **Step 2 : E2E invité**

```ts
import { test, expect } from '@playwright/test';

test('invité : carte neutre, CTA, aucun appel données', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/compte/map')) calls.push(request.url());
  });
  await page.goto('/compte');
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-ready', 'true');
  await expect(page.getByText('Connecte-toi pour voir ta carte.')).toBeVisible();
  await expect(page.locator('.lkdv-map-massif')).toHaveCount(0);
  expect(calls).toHaveLength(0);
});
```

- [ ] **Step 3 : E2E vide (route API stub) et erreur**

```ts
test('vide : un seul message, zéro marqueur', async ({ page }) => {
  await page.route('**/api/compte/map', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tracks: [], massifs: [], carnets: [], pois: [],
        stats: { outings: 0, km: 0, dplus: 0, massifs: 0, countries: 0 },
        bounds: null, truncated: false, generatedAt: new Date().toISOString(),
      }),
    })
  );
  await page.goto('/compte');
  await expect(page.getByText('Ta carte se dessine à ta première sortie.')).toBeVisible();
  await expect(page.locator('.lkdv-map-massif')).toHaveCount(0);
});

test('erreur API : carte d’erreur + réessayer', async ({ page }) => {
  await page.route('**/api/compte/map', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/compte');
  await expect(page.getByText('Impossible de charger ta carte.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});
```

Note : ces deux tests ne s'exécutent que si le compte est authentifié
(`LKDV_E2E_AUTH=1`) ; sinon ils se sautent, comme les tests Compte existants.
Pour le mode invité, le test s'exécute toujours.

- [ ] **Step 4 : E2E propriétaire avec données**

```ts
test('propriétaire : traces, massifs et contextes', async ({ page }) => {
  test.skip(process.env.LKDV_E2E_AUTH !== '1', 'session Supabase requise');
  await login(page);
  await page.goto('/compte');
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.lkdv-map-massif').first()).toBeVisible();

  await page.evaluate(() => window.__lkdvOpenSlot?.('souvenirs'));
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-mode', 'souvenirs');

  await page.evaluate(() => window.__lkdvOpenSlot?.('prets'));
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-mode', 'prets');
  await expect(page.getByText('Les prêts n’ont pas de position.')).toBeVisible();
});
```

- [ ] **Step 5 : captures visuelles**

```ts
// tests/visual/compte-map.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Compte — carte', () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test('invité', async ({ page }) => {
    await page.goto('/compte');
    await expect(page.getByText('Connecte-toi pour voir ta carte.')).toBeVisible();
    await expect(page).toHaveScreenshot('compte-map-guest-430.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

Ajouter les variantes 390 × 844 et les états vide/erreur avec les stubs de
route. Mettre à jour les snapshots avec `npm run test:visual:update` après
inspection visuelle.

- [ ] **Step 6 : vérification production**

1. `npm run type-check`
2. `npx vitest run src/features/compte/map src/components/compte/map`
3. `npm run build`
4. Déployer sur Vercel preview, puis stable.
5. Sur le domaine stable, compte réel :
   - `data-map-ready="true"` ;
   - `map.isStyleLoaded() === true` ;
   - au moins un `.lkdv-map-massif` ;
   - console 0 erreur ;
   - aucun appel `/api/compte/map` en invité.
6. Tester les 8 contextes et noter `data-map-mode`.
7. Vérifier `prefers-reduced-motion` (aucun vol).
8. Mesurer le payload (`/api/compte/map` < 250 Ko) et le temps d'interactivité.

- [ ] **Step 7 : commit final**

```bash
git add tests/e2e/compte-map.spec.ts tests/visual/compte-map.spec.ts playwright.config.ts
git commit -m "test(compte): couverture E2E et visuelle de la carte"
```

---

## Auto-relecture du plan

- **Couverture de la spec** : les causes 1 à 5 sont traitées (worker + readiness
  Task 3, données réelles Task 2, contextes Task 7, verre Task 4, contrôles
  Task 4/10). Les états sont Task 8. Les animations Task 6. Le retrait de la
  maquette Task 10. Les tests Task 11.
- **Pas de placeholder** : chaque tâche contient les fichiers, les contrats,
  les tests et les commandes. Les icônes du HUD viennent de `lucide-react`,
  déjà installé.
- **Cohérence des types** : `CompteMapMode`, `MapTrack`, `MapBounds`,
  `MapScale`, `CompteMapSheet` sont définis une fois et réutilisés.
- **Ordre** : chaque tâche laisse le dépôt vert et peut être testée seule.
  La Task 10 ne démarre qu'après la validation de la nouvelle carte.
