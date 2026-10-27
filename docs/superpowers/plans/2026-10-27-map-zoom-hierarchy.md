# Hiérarchie cartographique par zoom — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les traces, massifs, carnets, extrémités et POI selon quatre bandes de zoom, avec des tailles stables et une priorité de clic explicite.

**Architecture:** Un module pur `zoomHierarchy.ts` centralise seuils, visibilité, styles et priorités. `CompteMap.tsx` applique cette configuration aux couches MapLibre et au calque DOM de marqueurs. La CSS est pilotée par `data-zoom-band`, sans `transform: scale()` sur les marqueurs.

**Tech Stack:** Next.js, React, MapLibre GL JS, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-map-zoom-hierarchy-design.md`

## Global Constraints

- Ne jamais modifier la base de données ni les API.
- Seuils : Monde `< 4.5`, Pays `4.5–6.5`, Région `6.5–10`, Lieu `>= 10`.
- Taille des points fixe par bande ; aucun agrandissement au dézoom.
- POI visibles uniquement en bande `place`, dans le viewport + 24 px.
- Agrégation des massifs au rayon écran de 40 px.
- Priorité : sélection > POI > carnet > massif > extrémité > trace.
- Aucun nouveau fetch.
- `prefers-reduced-motion` respecté.
- Tests obligatoires avant chaque commit.

---

### Task 1: Module de résolution des bandes

**Files:**
- Create: `src/features/compte/map/zoomHierarchy.ts`
- Test: `src/features/compte/map/__tests__/zoomHierarchy.test.ts`

**Interfaces:**
- Produces:
  - `type MapZoomBand = 'world' | 'country' | 'region' | 'place'`
  - `interface MapZoomConfig`
  - `resolveMapZoomConfig(zoom: number): MapZoomConfig`
  - `MAP_ZOOM_PRIORITY: readonly ['selected','poi','carnet','massif','endpoint','track']`

- [ ] **Step 1: Écrire les tests de seuils**

```ts
import { describe, expect, it } from 'vitest';
import { resolveMapZoomConfig } from '../zoomHierarchy';

describe('resolveMapZoomConfig', () => {
  it('classe les quatre bandes aux seuils exacts', () => {
    expect(resolveMapZoomConfig(4.49).band).toBe('world');
    expect(resolveMapZoomConfig(4.5).band).toBe('country');
    expect(resolveMapZoomConfig(6.49).band).toBe('country');
    expect(resolveMapZoomConfig(6.5).band).toBe('region');
    expect(resolveMapZoomConfig(9.99).band).toBe('region');
    expect(resolveMapZoomConfig(10).band).toBe('place');
  });

  it('garde des tailles fixes par bande', () => {
    expect(resolveMapZoomConfig(3).trackWidth).toBe(1.5);
    expect(resolveMapZoomConfig(5).trackWidth).toBe(2);
    expect(resolveMapZoomConfig(8).trackWidth).toBe(3.5);
    expect(resolveMapZoomConfig(12).trackWidth).toBe(4);
  });

  it('masque les POI hors de la bande lieu', () => {
    expect(resolveMapZoomConfig(3).pois).toBe('hidden');
    expect(resolveMapZoomConfig(8).pois).toBe('hidden');
    expect(resolveMapZoomConfig(12).pois).toBe('pills');
  });
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter le module**

```ts
export type MapZoomBand = 'world' | 'country' | 'region' | 'place';

export interface MapZoomConfig {
  band: MapZoomBand;
  massifs: 'clustered' | 'individual';
  carnets: 'hidden' | 'dots' | 'pills';
  pois: 'hidden' | 'pills';
  endpoints: 'hidden' | 'dots';
  trackWidth: number;
  trackSimplified: boolean;
  casing: boolean;
  glow: boolean;
  clusterRadiusPx: number;
  viewportMarginPx: number;
}

export const MAP_ZOOM_PRIORITY = [
  'selected', 'poi', 'carnet', 'massif', 'endpoint', 'track',
] as const;

export function resolveMapZoomConfig(zoom: number): MapZoomConfig {
  if (zoom < 4.5) {
    return {
      band: 'world', massifs: 'clustered', carnets: 'hidden',
      pois: 'hidden', endpoints: 'hidden', trackWidth: 1.5,
      trackSimplified: true, casing: false, glow: false,
      clusterRadiusPx: 40, viewportMarginPx: 24,
    };
  }
  if (zoom < 6.5) {
    return {
      band: 'country', massifs: 'clustered', carnets: 'hidden',
      pois: 'hidden', endpoints: 'hidden', trackWidth: 2,
      trackSimplified: true, casing: false, glow: false,
      clusterRadiusPx: 40, viewportMarginPx: 24,
    };
  }
  if (zoom < 10) {
    return {
      band: 'region', massifs: 'individual', carnets: 'dots',
      pois: 'hidden', endpoints: 'dots', trackWidth: 3.5,
      trackSimplified: false, casing: true, glow: true,
      clusterRadiusPx: 40, viewportMarginPx: 24,
    };
  }
  return {
    band: 'place', massifs: 'individual', carnets: 'pills',
    pois: 'pills', endpoints: 'dots', trackWidth: 4,
    trackSimplified: false, casing: true, glow: true,
    clusterRadiusPx: 40, viewportMarginPx: 24,
  };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/map/zoomHierarchy.ts src/features/compte/map/__tests__/zoomHierarchy.test.ts
git commit -m "feat(map): bandes de zoom et configuration"
```

---

### Task 2: Agrégation pure des massifs

**Files:**
- Modify: `src/features/compte/map/zoomHierarchy.ts`
- Modify: `src/features/compte/map/__tests__/zoomHierarchy.test.ts`

**Interfaces:**
- Consumes: `MapZoomConfig.clusterRadiusPx`
- Produces:
  - `interface ScreenPoint { x: number; y: number }`
  - `interface MassifCluster<T> { id: string; items: T[]; x: number; y: number }`
  - `clusterByScreenDistance<T>(items: T[], pointOf: (item: T) => ScreenPoint, radiusPx: number): MassifCluster<T>[]`

- [ ] **Step 1: Ajouter le test d’agrégation**

```ts
import { clusterByScreenDistance } from '../zoomHierarchy';

it('regroupe les points à moins de 40 px', () => {
  const clusters = clusterByScreenDistance(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    (item) => ({ a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, c: { x: 100, y: 0 } }[item.id]!),
    40
  );
  expect(clusters).toHaveLength(2);
  expect(clusters[0].items.map((item) => item.id)).toEqual(['a', 'b']);
  expect(clusters[0].x).toBe(10);
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts -t "regroupe"`
Expected: FAIL, export manquant.

- [ ] **Step 3: Implémenter l’agrégation**

```ts
export interface ScreenPoint { x: number; y: number }
export interface MassifCluster<T> {
  id: string;
  items: T[];
  x: number;
  y: number;
}

export function clusterByScreenDistance<T>(
  items: T[],
  pointOf: (item: T) => ScreenPoint,
  radiusPx: number
): MassifCluster<T>[] {
  const clusters: MassifCluster<T>[] = [];
  for (const item of items) {
    const point = pointOf(item);
    const cluster = clusters.find(
      (candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radiusPx
    );
    if (cluster) {
      cluster.items.push(item);
      cluster.x = cluster.items.reduce((sum, entry) => sum + pointOf(entry).x, 0) / cluster.items.length;
      cluster.y = cluster.items.reduce((sum, entry) => sum + pointOf(entry).y, 0) / cluster.items.length;
    } else {
      clusters.push({ id: `cluster-${clusters.length}`, items: [item], x: point.x, y: point.y });
    }
  }
  return clusters;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/map/zoomHierarchy.ts src/features/compte/map/__tests__/zoomHierarchy.test.ts
git commit -m "feat(map): agrégation écran des massifs"
```

---

### Task 3: Filtre viewport pur

**Files:**
- Modify: `src/features/compte/map/zoomHierarchy.ts`
- Modify: `src/features/compte/map/__tests__/zoomHierarchy.test.ts`

**Interfaces:**
- Produces:
  - `interface ViewportSize { width: number; height: number }`
  - `isInsideViewport(point: ScreenPoint, viewport: ViewportSize, marginPx: number): boolean`

- [ ] **Step 1: Ajouter le test**

```ts
import { isInsideViewport } from '../zoomHierarchy';

it('garde les POI dans le viewport avec 24 px de marge', () => {
  const viewport = { width: 400, height: 600 };
  expect(isInsideViewport({ x: 24, y: 24 }, viewport, 24)).toBe(true);
  expect(isInsideViewport({ x: 23, y: 100 }, viewport, 24)).toBe(false);
  expect(isInsideViewport({ x: 200, y: 590 }, viewport, 24)).toBe(true);
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts -t "viewport"`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
export interface ViewportSize { width: number; height: number }

export function isInsideViewport(
  point: ScreenPoint,
  viewport: ViewportSize,
  marginPx: number
): boolean {
  return (
    point.x >= -marginPx &&
    point.y >= -marginPx &&
    point.x <= viewport.width + marginPx &&
    point.y <= viewport.height + marginPx
  );
}
```

- [ ] **Step 4: Vérifier**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compte/map/zoomHierarchy.ts src/features/compte/map/__tests__/zoomHierarchy.test.ts
git commit -m "feat(map): filtre viewport des points"
```

---

### Task 4: Brancher la bande de zoom dans CompteMap

**Files:**
- Modify: `src/components/compte/map/CompteMap.tsx`

**Interfaces:**
- Consumes: `resolveMapZoomConfig(zoom)`
- Produces: attribut DOM `data-zoom-band` sur `.lkdv-map-root`

- [ ] **Step 1: Ajouter l’état de bande**

Dans `CompteMap`, après `const [scale, setScale]` :

```tsx
const [zoomConfig, setZoomConfig] = useState(() => resolveMapZoomConfig(3));
```

- [ ] **Step 2: Mettre à jour au zoom**

Dans l’effet d’initialisation MapLibre, remplacer le handler `zoomend` existant par :

```tsx
instance.on('zoom', () => {
  const zoom = instance.getZoom();
  setZoomConfig(resolveMapZoomConfig(zoom));
  setScale(zoom < 4 ? 'globe' : zoom < 11 ? 'massif' : 'sentier');
});
```

- [ ] **Step 3: Exposer la bande**

Dans le JSX racine de la carte :

```tsx
<div className="lkdv-map-root" data-zoom-band={zoomConfig.band}>
```

- [ ] **Step 4: Vérifier le build**

Run: `npx tsc --noEmit`
Expected: aucune erreur dans `CompteMap.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/map/CompteMap.tsx
git commit -m "feat(map): exposer la bande de zoom"
```

---

### Task 5: Appliquer les styles de trace par bande

**Files:**
- Modify: `src/components/compte/map/CompteMap.tsx`

**Interfaces:**
- Consumes: `zoomConfig.trackWidth`, `zoomConfig.casing`, `zoomConfig.glow`

- [ ] **Step 1: Mettre à jour les propriétés de peinture**

Dans l’effet de sélection des traces, remplacer les valeurs codées en dur par :

```tsx
map.setPaintProperty('compte-tracks-line', 'line-width', zoomConfig.trackWidth);
map.setPaintProperty('compte-tracks-casing', 'line-width', zoomConfig.trackWidth + 3.5);
map.setPaintProperty('compte-tracks-glow', 'line-width', zoomConfig.trackWidth + 7);
map.setLayoutProperty('compte-tracks-casing', 'visibility', zoomConfig.casing ? 'visible' : 'none');
map.setLayoutProperty('compte-tracks-glow', 'visibility', zoomConfig.glow ? 'visible' : 'none');
```

- [ ] **Step 2: Ajouter la dépendance**

Ajouter `zoomConfig` au tableau de dépendances de l’effet concerné.

- [ ] **Step 3: Vérifier le build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/map/CompteMap.tsx
git commit -m "feat(map): styles de trace par bande"
```

---

### Task 6: Regrouper les massifs au niveau Monde/Pays

**Files:**
- Modify: `src/components/compte/map/CompteMap.tsx`
- Modify: `src/components/compte/map/compte-map.css`

**Interfaces:**
- Consumes: `clusterByScreenDistance`, `zoomConfig.massifs`

- [ ] **Step 1: Calculer les agrégats**

Dans l’effet de marqueurs, après le calcul des entrées massif :

```tsx
const massifEntries = data.massifs.map((massif) => ({
  massif,
  point: map.project([massif.center.lng, massif.center.lat]),
}));
const clusters = zoomConfig.massifs === 'clustered'
  ? clusterByScreenDistance(
      massifEntries,
      (entry) => entry.point,
      zoomConfig.clusterRadiusPx
    )
  : massifEntries.map((entry) => ({
      id: entry.massif.id,
      items: [entry],
      x: entry.point.x,
      y: entry.point.y,
    }));
```

- [ ] **Step 2: Rendre un marqueur par agrégat**

- Si `items.length > 1` : bouton `.lkdv-map-cluster`, texte `${items.length}`, clic → `fitBounds` de l’emprise des massifs.
- Sinon : rendu massif existant via `items[0].massif`.

CSS :

```css
.lkdv-map-cluster {
  width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center;
  background: rgba(47,107,69,.7); color: #fff;
  font: 700 10px var(--sf); border: 1px solid rgba(255,255,255,.5);
}
```

- [ ] **Step 3: Vérifier manuellement**

Ouvrir `/compte` au zoom 3 :
- les massifs proches sont agrégés ;
- un clic sur un agrégat cadre le groupe ;
- un massif seul ouvre sa fiche.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/map/CompteMap.tsx src/components/compte/map/compte-map.css
git commit -m "feat(map): agrégats de massifs"
```

---

### Task 7: Filtrer POI, carnets et extrémités au viewport

**Files:**
- Modify: `src/components/compte/map/CompteMap.tsx`

**Interfaces:**
- Consumes: `isInsideViewport`, `zoomConfig`
- Produces: visibilité effective par entrée

- [ ] **Step 1: Remplacer le test d’appartenance**

Dans la fonction `place`, remplacer :

```tsx
const inside = point.x > 10 && point.x < width - 10 && point.y > 10 && point.y < height - 10;
```

par :

```tsx
const inside = isInsideViewport(point, { width, height }, zoomConfig.viewportMarginPx);
```

- [ ] **Step 2: Appliquer les règles de bande**

```tsx
const visible =
  inside &&
  (!entry.detail || zoomConfig.pois !== 'hidden') &&
  (entry.kind !== 'carnet' || zoomConfig.carnets !== 'hidden');
```

Adapter `Entry` pour porter `kind: 'poi' | 'carnet' | 'massif'`.

- [ ] **Step 3: Vérifier**

Au zoom 3 : aucun POI/carnet.
Au zoom 8 : carnets visibles, POI absents.
Au zoom 12 : POI uniquement dans le viewport.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/map/CompteMap.tsx
git commit -m "feat(map): filtrage local des points"
```

---

### Task 8: Priorité de superposition

**Files:**
- Modify: `src/components/compte/map/CompteMap.tsx`
- Modify: `src/components/compte/map/compte-map.css`

**Interfaces:**
- Consumes: `MAP_ZOOM_PRIORITY`

- [ ] **Step 1: Ajouter les z-index par type**

```css
.lkdv-map-overlay .lkdv-map-massif { z-index: 2; }
.lkdv-map-overlay .lkdv-map-carnet { z-index: 3; }
.lkdv-map-overlay .lkdv-map-poi { z-index: 4; }
.lkdv-map-overlay .is-selected { z-index: 6; }
```

- [ ] **Step 2: Empêcher le clic de la couche basse**

Conserver le garde existant :

```tsx
if (target?.closest?.('.maplibregl-marker, .lkdv-map-overlay')) return;
```

- [ ] **Step 3: Vérifier**

Cliquer sur un POI superposé à un massif : le POI doit gagner.
Cliquer sur un massif seul : le massif doit gagner.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/map/CompteMap.tsx src/components/compte/map/compte-map.css
git commit -m "fix(map): priorité de clic des points"
```

---

### Task 9: Styles CSS par bande

**Files:**
- Modify: `src/components/compte/map/compte-map.css`

- [ ] **Step 1: Supprimer les tailles variables au zoom**

Supprimer toute règle `transform: scale()` sur `.lkdv-map-massif`, `.lkdv-map-poi`, `.lkdv-map-carnet`.

- [ ] **Step 2: Ajouter les styles de bande**

```css
.lkdv-map-root[data-zoom-band="world"] .lkdv-map-poi,
.lkdv-map-root[data-zoom-band="world"] .lkdv-map-carnet { display: none !important; }

.lkdv-map-root[data-zoom-band="region"] .lkdv-map-poi { display: none !important; }

.lkdv-map-root[data-zoom-band="place"] .lkdv-map-poi {
  width: 20px !important;
  height: 20px !important;
}
```

- [ ] **Step 3: Vérifier le rendu**

Captures aux zooms 3, 5, 8, 12 : tailles stables, pas de points géants.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/map/compte-map.css
git commit -m "style(map): rendu par bande de zoom"
```

---

### Task 10: Tests Playwright de la hiérarchie

**Files:**
- Create: `tests/e2e/compte-map-zoom.spec.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { test, expect } from '@playwright/test';

test('la carte respecte les quatre bandes', async ({ page }) => {
  await page.request.post('/api/demo-login');
  await page.goto('/compte');
  await page.waitForSelector('.lkdv-map-root');

  async function zoomTo(zoom: number) {
    await page.evaluate((value) => {
      const map = (window as any).__lkdvCompteMapInstance;
      map.jumpTo({ zoom: value, center: [2.5, 46.5] });
    }, zoom);
    await page.waitForTimeout(400);
  }

  await zoomTo(3);
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'world');
  await expect(page.locator('.lkdv-map-poi:visible')).toHaveCount(0);

  await zoomTo(5);
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'country');

  await zoomTo(8);
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'region');
  await expect(page.locator('.lkdv-map-carnet:visible').first()).toBeVisible();

  await zoomTo(12);
  await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'place');
});
```

- [ ] **Step 2: Lancer le test**

Run: `npx playwright test tests/e2e/compte-map-zoom.spec.ts`
Expected: PASS (adapter le projet Playwright mobile si nécessaire).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/compte-map-zoom.spec.ts
git commit -m "test(map): hiérarchie de zoom"
```

---

### Task 11: Recette et vérification finale

**Files:** aucun.

- [ ] **Step 1: Vérifier les tests unitaires**

Run: `npx vitest run src/features/compte/map/__tests__/zoomHierarchy.test.ts`
Expected: PASS.

- [ ] **Step 2: Vérifier le typage**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Recette mobile**

À 430 × 932 :
- zoom 3 : toutes les traces, agrégats, aucun POI ;
- zoom 5 : massifs et traces ;
- zoom 8 : carnets et extrémités ;
- zoom 12 : POI autour du lieu, clic et fiche.

- [ ] **Step 4: Recette desktop**

À 858 × 506 : mêmes règles, aucun point géant, pas de chevauchement bloquant.

- [ ] **Step 5: Commit final éventuel**

```bash
git add -A
git commit -m "chore(map): recette hiérarchie de zoom"
```

---

## Self-review

- Couverture spec : bandes, visibilité, tailles, agrégation, viewport, priorité, tests.
- Aucun placeholder.
- Types cohérents : `MapZoomConfig`, `ScreenPoint`, `MassifCluster`, `isInsideViewport`.
- Aucun changement BDD/API.
