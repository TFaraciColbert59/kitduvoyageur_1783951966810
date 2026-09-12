# Refonte cockpit Départ + robustesse explorer mobile/natif — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le cockpit Départ chaotique par le flux canonique du hub (desktop + `DepartMobileExperience`), lier `?route=X` au sentier choisi, puis fiabiliser `/explorer` sur mobile/natif.

**Architecture:** Desktop = flux de sections dans la colonne centre du hub (zéro sidebar dupliquée) ; mobile = `DepartMobileExperience` calquée sur `SafetyMobileExperience`. Logique métier conservée, extraite en hooks purs. Volet 2 : correctifs isolés par cause racine (systematic-debugging).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, classes `glass-*` de `src/styles/liquid-glass.css`, Vitest (`renderToStaticMarkup`), Playwright (e2e + captures).

**Spec:** `docs/superpowers/specs/2026-09-12-refonte-cockpit-depart-design.md`

## Global Constraints

- Tokens `--lkv-*` et classes `.glass*` uniquement. Interdits : `rose-*`, `sand-*`, `forest-*`, `bg-white/60`, `bg-white/90`, `dark:` (cf. `docs/Design-tokens.md:27-38`).
- Bascule mobile/desktop à **`lg`** (1024 px) — jamais `md` seul pour le contenu.
- Aucun `env(safe-area-inset-*)` dans les pages/composants : rôle d'`AppShell`/`BottomTabBar`.
- Overlays = `GlassDrawer` (`z-[10000]/[10001]`) ou `GlassModal` — plus aucun `fixed inset-0 z-50` maison.
- Aucune migration DB, aucun changement du flag `explorer_unified_map_enabled`.
- Conservé à l'identique : moteur d'alertes `generateSmartPrompts`, `DepartChecklist`, `DepartEquipmentHub`, `DepartWeightBreakdown`, `DepartMap`, `DepartWeather`, `DepartParticipants`, calculs poids.
- Testids stables à préserver : `vital-alert-action`, `vital-alert-dismiss`. Nouveaux : `depart-cockpit` (desktop), `depart-mobile-experience` (mobile).
- Tests composants = `renderToStaticMarkup` (pas de jsdom/RTL). Gates = `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.
- Un commit par task. Branche volet 1 : `chantier/depart-refonte` ; volet 2 : `chantier/explorer-mobile-native`.

---

## Volet 1 — Cockpit Départ

### Task 1: `resolveDepartIdentity` + identité sentier dans `getDepartDetail`

**Files:**
- Create: `src/features/materiel/domain/departIdentity.ts`
- Create: `tests/materiel/depart-identity.spec.ts`
- Modify: `src/features/materiel/services/getDepartDetail.ts` (branche showcase ~L272-304 et ~L370-383)

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  export interface DepartIdentityInput { destination?: string | null; trailName?: string | null; }
  export interface DepartIdentity { title: string; subtitle: string | null; fromTrail: boolean; }
  export function resolveDepartIdentity(input: DepartIdentityInput): DepartIdentity;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/materiel/depart-identity.spec.ts
import { describe, it, expect } from 'vitest';
import { resolveDepartIdentity } from '@/features/materiel/domain/departIdentity';

describe('resolveDepartIdentity', () => {
  it('sentier explicite ⇒ titre = sentier, sous-titre = destination', () => {
    expect(resolveDepartIdentity({ destination: 'Tour du Mont-Blanc — 4j Bivouac', trailName: 'GR 128 Flandres' }))
      .toEqual({ title: 'GR 128 Flandres', subtitle: 'Tour du Mont-Blanc — 4j Bivouac', fromTrail: true });
  });
  it('sans sentier ⇒ destination telle quelle', () => {
    expect(resolveDepartIdentity({ destination: 'Kit été' }))
      .toEqual({ title: 'Kit été', subtitle: null, fromTrail: false });
  });
  it('sentier identique à la destination ⇒ pas de sous-titre redondant', () => {
    expect(resolveDepartIdentity({ destination: 'GR 128', trailName: 'GR 128' }).subtitle).toBeNull();
  });
  it('tout vide ⇒ « Prochain départ »', () => {
    expect(resolveDepartIdentity({}).title).toBe('Prochain départ');
    expect(resolveDepartIdentity({ destination: '  ', trailName: null }).title).toBe('Prochain départ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/materiel/depart-identity.spec.ts`
Expected: FAIL — cannot resolve `@/features/materiel/domain/departIdentity`

- [ ] **Step 3: Implement the helper**

```ts
// src/features/materiel/domain/departIdentity.ts
export interface DepartIdentityInput { destination?: string | null; trailName?: string | null; }
export interface DepartIdentity { title: string; subtitle: string | null; fromTrail: boolean; }

export function resolveDepartIdentity(input: DepartIdentityInput): DepartIdentity {
  const destination = input.destination?.trim() || null;
  const trailName = input.trailName?.trim() || null;
  if (trailName) {
    return { title: trailName, subtitle: destination && destination !== trailName ? destination : null, fromTrail: true };
  }
  return { title: destination ?? 'Prochain départ', subtitle: null, fromTrail: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/materiel/depart-identity.spec.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Branch `getShowcaseDepart` sur l'identité réelle**

Dans `src/features/materiel/services/getDepartDetail.ts` :
1. Signature `getShowcaseDepart(kitId?: string, customTrail?: MapTrail | null, destinationOverride?: string | null)`.
2. Ligne ~274 : `destination: destinationOverride ?? (isVercors ? 'Grande Traversée du Vercors' : isBelledonne ? 'Traversée hivernale de Belledonne' : 'Tour du Mont-Blanc — 4j Bivouac')`.
3. Ligne ~285 : `name: isVercors ? 'Kit Vercors Ultra' : isBelledonne ? 'Kit Belledonne Hiver' : customTrail ? 'Kit de départ' : 'Kit Tour du Mont-Blanc'`.
4. Branche showcase (~L376-383) : `const explicitRoute = Boolean(selectedRouteId)` ; calculer
   ```ts
   const identity = resolveDepartIdentity({
     destination: id === 'vercors-ultra' ? 'Grande Traversée du Vercors' : id === 'belledonne-winter' ? 'Traversée hivernale de Belledonne' : 'Tour du Mont-Blanc — 4j Bivouac',
     trailName: explicitRoute ? trailData?.name ?? null : null,
   });
   return getShowcaseDepart(id, trailData, identity.title);
   ```
   Idem au fallback « pas de kit » (~L429-432, `explicitRoute` recalculé avec `selectedRouteId`).

- [ ] **Step 6: Run the full unit suite**

Run: `npx vitest run tests/materiel tests/mobile-layout.spec.ts`
Expected: PASS — aucune régression sur les tests matières existants.

- [ ] **Step 7: Commit**

```bash
git add src/features/materiel/domain/departIdentity.ts tests/materiel/depart-identity.spec.ts src/features/materiel/services/getDepartDetail.ts
git commit -m "feat(depart): identite de depart liee au sentier choisi (route=X), fin du demo TMB"
```

---

### Task 2: `CountdownLive` partagé + `DepartHeroCard`

**Files:**
- Create: `src/features/materiel/components/depart/hero/DepartHeroCard.tsx`
- Create: `tests/materiel/depart-hero-card.spec.ts`
- Modify: `src/features/materiel/components/depart/DepartRightSidebar.tsx` (extraire `CountdownLive` si défini là)

**Interfaces:**
- Consumes: `DepartDetail`, `resolveDepartIdentity` (Task 1), `BudgetRing` (`src/features/hub/components/mobile/budget/BudgetRing.tsx`, props `{ pct, over?, size?, stroke?, children? }`).
- Produces:
  ```ts
  export interface DepartHeroCardProps {
    depart: DepartDetail;
    identity: DepartIdentity;
    kits?: { id: string; name: string }[];
    isOnline?: boolean;
    onOpenSheet: () => void;
    onShare: () => void;
    onSelectKit?: (kitId: string) => void;
  }
  export function DepartHeroCard(props: DepartHeroCardProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test (markup statique + garde design system)**

```ts
// tests/materiel/depart-hero-card.spec.ts
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartHeroCard } from '@/features/materiel/components/depart/hero/DepartHeroCard';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const depart = {
  id: 'none', destination: 'GR 128 Flandres', status: 'draft',
  readinessScore: { pct: 64 }, baseWeightG: 4100, consumablesWeightG: 8900, totalPackWeightG: 13900,
  assignedKit: { id: 'k', name: 'Kit de départ', totalWeightG: 4100, items: [] },
  weightBreakdown: [], checklistPct: 64, checklistSections: [], checklistItems: [],
  durationDays: 4, consumables: {}, trail: null, participants: [], emergencyContact: null,
  startsAt: new Date('2026-09-20T08:00:00Z').toISOString(),
} as unknown as DepartDetail;

describe('DepartHeroCard', () => {
  const html = renderToStaticMarkup(
    React.createElement(DepartHeroCard, {
      depart,
      identity: { title: 'GR 128 Flandres', subtitle: null, fromTrail: true },
      isOnline: true,
      onOpenSheet: () => {},
      onShare: () => {},
    })
  );
  it('affiche identité, statut et CTA canoniques', () => {
    expect(html).toContain('GR 128 Flandres');
    expect(html).toContain('Ouvrir la fiche');
    expect(html).toContain('Partager');
    expect(html).toContain('Prêt');
  });
  it('respecte le design system (aucune classe interdite)', () => {
    for (const forbidden of ['rose-', 'sand-', 'forest-', 'bg-white/60', 'bg-white/90', 'dark:']) {
      expect(html).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/materiel/depart-hero-card.spec.ts`
Expected: FAIL — module introuvable

- [ ] **Step 3: Implement**

Structure exacte (classes canoniques, cf. `SafetyMobileExperience.tsx:198-241`) :
```tsx
<section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Départ">
  {/* header : eyebrow + glass-pill statut ; h2 font-display font-bold text-[17px] ; ligne méta (date FR + CountdownLive + activité) */}
  {/* body : flex gap-4 items-center — <BudgetRing pct={depart.readinessScore.pct} size={96} stroke={9}>
       <span className="font-display text-2xl font-extrabold leading-none">{pct} %</span>
       <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">Prêt</span>
       </BudgetRing>
       + grid grid-cols-3 gap-2 — 3 tuiles `glass-sub-card rounded-2xl p-2.5 text-center` :
       poids total (kg), manquants (départ.checklistItems.filter(i => !i.done).length), distance (trail?.distance_km) */}
  {/* actions : mt-4 flex gap-2 — « Ouvrir la fiche de départ » glass-capsule-btn primary min-h-[44px] flex-1 !py-3 text-sm font-bold
       + « Partager » glass-capsule-btn min-h-[44px] !px-3 text-xs font-bold */}
  {/* footer discret : pastille ÉCO (si depart.status) + Wi-Fi (isOnline) + sélecteur kit (kits?.length > 1 → <select className="glass-sub-card ...">) — text-[10px] uppercase tracking-[0.14em] */}
</section>
```
Extraire `CountdownLive` (aujourd'hui dans `DepartRightSidebar.tsx`) vers `hero/CountdownLive.tsx` (export nommé), ré-importer dans les deux usages. Haptique `triggerHaptic('light')` sur les deux CTA.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/materiel/depart-hero-card.spec.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/features/materiel/components/depart/hero tests/materiel/depart-hero-card.spec.ts src/features/materiel/components/depart/DepartRightSidebar.tsx
git commit -m "feat(depart): hero canonique partage (identite, jauge, stats, CTA, eco/wifi/kit)"
```

---

### Task 3: `DepartAlertsBanner` unifié

**Files:**
- Create: `src/features/materiel/components/depart/DepartAlertsBanner.tsx`
- Create: `tests/materiel/depart-alerts-banner.spec.ts`
- Reuse: `src/features/materiel/components/mobile/MobileVitalAlertBanner.tsx` (ne pas modifier, testids conservés)

**Interfaces:**
- Consumes: `ActionableAlert` (`services/generateSmartPrompts.ts`).
- Produces: `export function DepartAlertsBanner({ alerts, onAction, onDismiss }: { alerts: ActionableAlert[]; onAction: (a: ActionableAlert) => void; onDismiss: (id: string) => void }): JSX.Element | null;`

- [ ] **Step 1: Write failing test**

```ts
// tests/materiel/depart-alerts-banner.spec.ts
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartAlertsBanner } from '@/features/materiel/components/depart/DepartAlertsBanner';
import type { ActionableAlert } from '@/features/materiel/services/generateSmartPrompts';

vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ haptic: vi.fn(), triggerHaptic: vi.fn(), vibrate: vi.fn() }) }));
vi.mock('framer-motion', async () => ({ ...(await vi.importActual('framer-motion')), useReducedMotion: () => false }));

const alert: ActionableAlert = { id: 'a1', category: 'checklist', severity: 'critical', title: '1 équipement vital manquant', message: 'Filtre à eau', actionLabel: "Voir l'article vital", actionType: 'scroll_checklist', targetSection: 'checklist', whyExplanation: 'x' } as ActionableAlert;

describe('DepartAlertsBanner', () => {
  it('aucune alerte ⇒ ligne sobre « Tout est prêt », pas de carte vide', () => {
    const html = renderToStaticMarkup(React.createElement(DepartAlertsBanner, { alerts: [], onAction: () => {}, onDismiss: () => {} }));
    expect(html).toContain('Tout est prêt');
    expect(html).not.toContain('vital-alert-action');
  });
  it('alerte ⇒ une seule surface avec testids stables', () => {
    const html = renderToStaticMarkup(React.createElement(DepartAlertsBanner, { alerts: [alert], onAction: () => {}, onDismiss: () => {} }));
    expect(html).toContain('data-testid="vital-alert-action"');
    expect(html).toContain('data-testid="vital-alert-dismiss"');
    expect(html.match(/data-testid="vital-alert-action"/g)?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run tests/materiel/depart-alerts-banner.spec.ts`

- [ ] **Step 3: Implement** — wrapper mince : rend `<MobileVitalAlertBanner alert={alerts[0]} onAction={onAction} onDismiss={onDismiss} />` si `alerts.length > 0` (réutilise le rendu existant — ne pas créer un second système), sinon `<p className="glass-sub-card rounded-2xl px-3 py-2 text-xs font-medium text-[var(--lkv-text-primary)]/70">Tout est prêt — aucun point bloquant.</p>`. (`DepartAlerts.tsx` n'est plus monté ; le supprimer en Task 8.)

- [ ] **Step 4: Run to verify PASS** + `npx vitest run tests/materiel/mobile-vital-alert.spec.ts` (doit rester vert).

- [ ] **Step 5: Commit**

```bash
git add src/features/materiel/components/depart/DepartAlertsBanner.tsx tests/materiel/depart-alerts-banner.spec.ts
git commit -m "feat(depart): bandeau d'alertes unique (fin du double systeme)"
```

---

### Task 4: `DepartTerrainSection` (carte + météo fusionnées)

**Files:**
- Create: `src/features/materiel/components/depart/DepartTerrainSection.tsx`
- Create: `tests/materiel/depart-terrain-section.spec.ts`
- Modify: `src/features/materiel/components/depart/DepartMap.tsx` (plein écran → `GlassModal variant="sheet"`)

**Interfaces:**
- Consumes: `DepartMap` (`{ trail, height?, className? }`), `DepartWeather` (`{ weather, updatedAt? }`), `GlassModal`.
- Produces: `export function DepartTerrainSection({ trail, weather, updatedAt }: { trail: MapTrail | null; weather: WeatherForecast | null; updatedAt?: string | null }): JSX.Element;`

- [ ] **Step 1: Write failing test** — `renderToStaticMarkup` avec `next/dynamic` mocké (`data-testid="mock-depart-map"`), assert : contient « Terrain », contient la carte mockée quand `trail` non nul, **un seul** nœud `data-testid="mock-depart-map"`, et météo rendue quand `weather` fournie / absente sans bloc vide quand `weather=null` (assert `html` ne contient pas `aria-label="Météo"` si null).

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run tests/materiel/depart-terrain-section.spec.ts`

- [ ] **Step 3: Implement** — `section.glass rounded-[1.75rem] p-4` : header (eyebrow « Terrain », `glass-pill` distance si trail) ; `<DepartMap trail={trail} height="220px" />` ; si `weather` → sous-bloc `<DepartWeather weather={weather} updatedAt={updatedAt} />` sans marge propre. `DepartMap` : remplacer le wrapper `fixed inset-0 z-50` (L255) par `<GlassModal open={fullscreen} onOpenChange={setFullscreen} title="Carte du tracé" variant="sheet"><DepartMap… embedded /></GlassModal>` (prop interne `embedded?: boolean` pour éviter la récursion) ; boutons contrôles restent 44 px.

- [ ] **Step 4: Run to verify PASS** + `npx vitest run tests/materiel`

- [ ] **Step 5: Commit**

```bash
git add src/features/materiel/components/depart/DepartTerrainSection.tsx src/features/materiel/components/depart/DepartMap.tsx tests/materiel/depart-terrain-section.spec.ts
git commit -m "feat(depart): surface terrain unique (carte + meteo), plein ecran via GlassModal"
```

---

### Task 5: Purge du vocabulaire DS des composants réutilisés

> Ruling pré-vol : les tests d'assemblage (T6/T8/T9) scannent les classes interdites ; les composants réutilisés en contiennent encore. Cette task les purge AVANT les assemblages.

**Files:**
- Modify: `src/features/materiel/components/depart/DepartChecklist.tsx`, `DepartWeightBreakdown.tsx`, `DepartWeather.tsx`, `DepartParticipants.tsx`, `DepartEquipmentHub.tsx`, `DepartMap.tsx`, `DepartureSheetModal.tsx`, `src/features/materiel/components/mobile/MobileChecklistItem.tsx`
- Create: `tests/materiel/depart-ds-purge.spec.ts`

**Interfaces:**
- Consumes: rien. Produces: mêmes composants, props inchangées, classes assainies.

- [ ] **Step 1: Write the failing test (analyse statique des sources, pattern `tests/mobile-layout.spec.ts`)**

```ts
// tests/materiel/depart-ds-purge.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES = [
  'src/features/materiel/components/depart/DepartChecklist.tsx',
  'src/features/materiel/components/depart/DepartWeightBreakdown.tsx',
  'src/features/materiel/components/depart/DepartWeather.tsx',
  'src/features/materiel/components/depart/DepartParticipants.tsx',
  'src/features/materiel/components/depart/DepartEquipmentHub.tsx',
  'src/features/materiel/components/depart/DepartMap.tsx',
  'src/features/materiel/components/depart/DepartureSheetModal.tsx',
  'src/features/materiel/components/mobile/MobileChecklistItem.tsx',
];
const FORBIDDEN = [/(?<!lkv-)(?:rose|sand|forest)-\d{2,3}/, /bg-white\/(60|90)/, /dark:/];

describe('DS — composants depart purgés des classes interdites', () => {
  for (const file of FILES) {
    it(file, () => {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(src, `${file} contient ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/materiel/depart-ds-purge.spec.ts`
Expected: FAIL sur plusieurs fichiers (ex. `forest-800`, `bg-white/90`, `rose-50/90`)

- [ ] **Step 3: Purger (remplacements mécaniques, grep-driven)**

`rg -n "(rose|sand|forest)-[0-9]|bg-white/(60|90)|dark:" src/features/materiel/components` puis :
- `rose-*` → `[var(--lkv-danger)]` (fonds `bg-[var(--lkv-danger)]/10`, textes `text-[var(--lkv-danger)]`, bordures `/25`)
- `sand-*` → `[var(--lkv-warning)]` (mêmes recettes)
- `forest-*` → tokens existants : `bg-forest-800` → `bg-[var(--lkv-forest-900)]`, `bg-forest-100`/`text-forest-800` → `bg-[var(--lkv-forest-100)]`/`text-[var(--lkv-forest-900)]`, bordures `border-forest-300` → `border-[var(--lkv-primary)]/30`
- `bg-white/60|90` → `glass-sub-card` (surfaces) ou `bg-white/70` (purement décoratif sur verre)
- `dark:` → supprimer la variante (hub clair)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/materiel/depart-ds-purge.spec.ts` → PASS (8/8) puis `npx vitest run` → aucune nouvelle régression ; `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add tests/materiel/depart-ds-purge.spec.ts src/features/materiel/components
git commit -m "refactor(depart): purge DS des composants reutilises (tokens --lkv, fin rose/sand/forest/dark)"
```

---

### Task 6: `DepartSacSection` (poids + checklist)

**Files:**
- Create: `src/features/materiel/components/depart/DepartSacSection.tsx`
- Create: `tests/materiel/depart-sac-section.spec.ts`

**Interfaces:**
- Consumes: `DepartWeightBreakdown` (`{ breakdown, totalWeightG, baseWeightG?, wornWeightG?, consumablesWeightG?, items?, participants?, comparableTripName? }`), `DepartChecklist` (`{ items, consumables?, participants?, kitId?, isRealKit, className? }`).
- Produces: `export function DepartSacSection({ depart, kitItems, isRealKit }: { depart: DepartDetail; kitItems: ChecklistItem[]; isRealKit: boolean }): JSX.Element;`

- [ ] **Step 1: Write failing test** — assert markup : un seul `section` racine (class `glass`), présence des deux sous-titres (« Analyse du poids », « Checklist »), aucun `rose-/sand-/forest-`.

- [ ] **Step 2: Run FAIL** → **Step 3: Implement** — `section.glass rounded-[1.75rem] p-4 space-y-4` : header (eyebrow « Sac », % + jauge `glass-progress`) ; `<DepartWeightBreakdown … />` ; séparateur `border-t border-[var(--lkv-border-subtle)]` ; `<DepartChecklist items={kitItems} consumables={depart.consumables} participants={depart.participants} kitId={depart.assignedKit.id} isRealKit={isRealKit} />` (le composant garde son propre en-tête interne).

- [ ] **Step 4: Run PASS** → **Step 5: Commit**

```bash
git add src/features/materiel/components/depart/DepartSacSection.tsx tests/materiel/depart-sac-section.spec.ts
git commit -m "feat(depart): surface sac unifiee (poids + checklist)"
```

---

### Task 7: `DepartEquipeSection` + migration overlay fiche officielle

**Files:**
- Create: `src/features/materiel/components/depart/DepartEquipeSection.tsx`
- Create: `tests/materiel/depart-equipe-section.spec.ts`
- Modify: `src/features/materiel/components/depart/DepartureSheetModal.tsx` (conteneur → `GlassDrawer`)

**Interfaces:**
- Produces: `export function DepartEquipeSection({ depart, onOpenSheet }: { depart: DepartDetail; onOpenSheet: () => void }): JSX.Element;`
- `DepartureSheetModal` : props inchangées (`{ depart, weather, isOpen, onClose, isRealKit? }`), conteneur remplacé : `GlassDrawer open={isOpen} onOpenChange={(v) => !v && onClose()} title="Fiche officielle" width={560}`.

- [ ] **Step 1: Write failing test** — markup : surface `glass`, `DepartParticipants` mocké/rendu (assert nom participants), bouton « Fiche officielle » avec `aria-haspopup="dialog"`.

- [ ] **Step 2: Run FAIL** → **Step 3: Implement** + migration `DepartureSheetModal` (conserver `#departure-sheet-title` : le déplacer sur le `Dialog.Title` du drawer).

- [ ] **Step 4: `rg -n "DepartureSheetModal|departure-sheet-title" tests src | rg -v "components/depart/DepartureSheetModal"` puis adapter les tests référents si présents ; run `npx vitest run tests/materiel`** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/materiel/components/depart/DepartEquipeSection.tsx src/features/materiel/components/depart/DepartureSheetModal.tsx tests/materiel/depart-equipe-section.spec.ts
git commit -m "feat(depart): section equipe + fiche officielle en GlassDrawer (z-10000)"
```

---

### Task 8: `DepartDesktopView` (assemblage flux canonique)

**Files:**
- Create: `src/features/materiel/components/depart/DepartDesktopView.tsx`
- Create: `tests/materiel/depart-desktop-view.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-7 + `DepartEquipmentHub` (props complètes conservées, cf. `DepartCockpit.tsx:436-454`).
- Produces: `export function DepartDesktopView(props: DepartCockpitProps & { weather: WeatherForecast | null }): JSX.Element;` (mêmes props que l'actuel `DepartCockpit` : `{ depart, weather, kits, inventory?, loans?, products? }`).

- [ ] **Step 1: Write failing test** — markup : `data-testid="depart-cockpit"` ; présence des eyebrows « Départ », « Terrain », « Sac », « Équipement », « Équipe » ; **aucune** classe `max-w-[1680px]` (fin de la duplication de shell) ; aucun `rose-/sand-/forest-`.

- [ ] **Step 2: Run FAIL** → **Step 3: Implement** :
```tsx
<div data-testid="depart-cockpit" className="flex min-w-0 flex-col gap-5 pb-4">
  <DepartHeroCard … />
  <DepartAlertsBanner alerts={visibleAlerts} … />
  <div className="grid gap-5 xl:grid-cols-2">
    <DepartSacSection … />
    <DepartTerrainSection … />
  </div>
  <section className="glass rounded-[1.75rem] p-4" aria-label="Équipement">
    <DepartEquipmentHub … />
  </section>
  <DepartEquipeSection … />
  <DepartureSheetModal … />
</div>
```
État local : `sheetOpen`, alertes via Task 10 hooks (provisoire : `generateSmartPrompts` direct comme aujourd'hui, migré en Task 10). Scroll vers checklist : `document.getElementById('depart-checklist-heading')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })`.

- [ ] **Step 4: Run PASS** → **Step 5: Commit**

```bash
git add src/features/materiel/components/depart/DepartDesktopView.tsx tests/materiel/depart-desktop-view.spec.ts
git commit -m "feat(depart): vue desktop canonique en flux (hero, sac|terrain xl, equipement, equipe)"
```

---

### Task 9: `DepartMobileExperience`

**Files:**
- Create: `src/features/hub/components/mobile/depart/DepartMobileExperience.tsx`
- Create: `tests/materiel/depart-mobile-experience.spec.ts`

**Interfaces:**
- Consumes: primitives `GroupeRail` `{ title, subtitle?, actionLabel?, onAction?, ariaLabel, children }`, `GroupeChipsRow` `{ chips: GroupeChipDef[] }`, `GroupeDrawer` `{ open, onOpenChange, title, width?, children }`, `GlassDrawer` `{ open, onOpenChange, title, width?, children }`, `DepartChecklist`, `DepartEquipmentHub`, Tasks 1-7.
- Produces: `export function DepartMobileExperience(props: DepartCockpitProps & { weather: WeatherForecast | null }): JSX.Element;`

- [ ] **Step 1: Write failing test** — markup : racine `data-testid="depart-mobile-experience"` avec **exactement** `flex min-w-0 flex-col gap-5 pb-1` ; aucune occurrence `env(safe-area-inset` ni `sticky top-0` ni `md:hidden` ; présence des libellés des rails (« Prochains articles », « Poids par catégorie ») ; chips avec `aria-label`.

- [ ] **Step 2: Run FAIL** → **Step 3: Implement** :
```tsx
<div data-testid="depart-mobile-experience" className="flex min-w-0 flex-col gap-5 pb-1">
  <DepartHeroCard … />
  <DepartAlertsBanner … />
  <GroupeChipsRow chips={[
    { key: 'poids', icon: Weight, value: `${(depart.totalPackWeightG/1000).toFixed(1)} kg`, label: 'Poids porté', tone: total > 15000 ? 'warn' : 'default', onClick: openChecklist },
    { key: 'manquants', icon: AlertTriangle, value: String(missing), label: 'À compléter', tone: missing ? 'warn' : 'accent', onClick: openChecklist },
    { key: 'pret', icon: CheckCircle, value: `${pct} %`, label: 'Prêt', tone: 'accent', onClick: openSheet },
  ]} />
  <GroupeRail title="Prochains articles" subtitle={`${missing} restant(s)`} actionLabel="Tout voir" onAction={openChecklist} ariaLabel="Prochains articles">
    {pending.slice(0, 8).map(item => <li key={…} className="glass flex h-[8.5rem] w-[10.5rem] shrink-0 snap-start flex-col rounded-[1.4rem] p-3">…</li>)}
  </GroupeRail>
  <DepartTerrainSection … />
  <GroupeRail title="Poids par catégorie" ariaLabel="Poids par catégorie">
    {depart.weightBreakdown.slice(0, 8).map(cat => …)}
  </GroupeRail>
  <section className="glass rounded-[1.75rem] p-4" aria-label="Équipement">
    <button className="glass-capsule-btn primary min-h-[44px] w-full !py-3 text-sm font-bold" onClick={openEquipment}>Gérer le matériel</button>
  </section>
  <DepartEquipeSection … />
  <GroupeDrawer open={checklistOpen} onOpenChange={setChecklistOpen} title="Checklist du sac" width={460}>…DepartChecklist…</GroupeDrawer>
  <GlassDrawer open={equipmentOpen} onOpenChange={setEquipmentOpen} title="Parc matériel" width={720}>…DepartEquipmentHub…</GlassDrawer>
  <DepartureSheetModal … />
</div>
```
Aucune safe-area (AppShell s'en charge). Icônes : `lucide-react` (`Weight`, `AlertTriangle`, `CheckCircle2`).

- [ ] **Step 4: Run PASS** + `npx tsc --noEmit` → **Step 5: Commit**

```bash
git add src/features/hub/components/mobile/depart tests/materiel/depart-mobile-experience.spec.ts
git commit -m "feat(depart): experience mobile canonique (hero, chips, rails, drawers)"
```

---

### Task 10: Hooks `useDepartAlerts` + `useDepartOfflineCache`

**Files:**
- Create: `src/features/materiel/domain/departAlerts.ts`, `src/features/materiel/hooks/useDepartAlerts.ts`
- Create: `src/features/materiel/domain/departCache.ts`, `src/features/materiel/hooks/useDepartOfflineCache.ts`
- Create: `tests/materiel/depart-alerts-domain.spec.ts`, `tests/materiel/depart-cache-domain.spec.ts`
- Modify: `DepartDesktopView.tsx`, `DepartMobileExperience.tsx` (consommer les hooks)

**Interfaces:**
- Produces:
  ```ts
  // departAlerts.ts (pur)
  export interface DismissState { [alertId: string]: number } // timestamp
  export function mergeDismissed(state: DismissState, id: string, now: number): DismissState;
  export function isDismissed(state: DismissState, id: string, now: number, ttlMs?: number): boolean; // ttl défaut 24 h
  export function visibleAlerts<T extends { id: string }>(alerts: T[], state: DismissState, now: number): T[];
  // departCache.ts (pur)
  export function encodeDepartCache(payload: unknown): string; // préfixe 'v1:'
  export function decodeDepartCache<T>(raw: string | null): T | null; // null si version/JSON invalide
  ```

- [ ] **Step 1: Tests rouges** — `mergeDismissed` ajoute/écrase ; `isDismissed` vrai à 23 h, faux à 25 h (TTL 24 h) ; `visibleAlerts` filtre ; `decodeDepartCache(encodeDepartCache(x))` round-trip ; `decodeDepartCache('v0:{}')` → null ; `decodeDepartCache('{invalid')` → null.

- [ ] **Step 2: Run FAIL** → `npx vitest run tests/materiel/depart-alerts-domain.spec.ts tests/materiel/depart-cache-domain.spec.ts`

- [ ] **Step 3: Implement** les modules purs, puis les hooks : `useDepartAlerts(alerts)` (localStorage `lkdv_dismissed_depart_alerts_v2`, `now = Date.now()` à l'appel, expose `{ alerts: visible, dismiss }`) ; `useDepartOfflineCache(depart, weather)` (clé `lkdv_depart_cache_${depart.id}`, lit à l'hydratation, écrit sur changement, flush `departOfflineQueue` sur `window online`, expose `{ isOnline }`). Les hooks ne contiennent aucune règle métier (déléguée aux modules purs).

- [ ] **Step 4: Run PASS** + `npx vitest run` complet.

- [ ] **Step 5: Câbler les vues sur les hooks** (remplacer `generateSmartPrompts` direct et les effets localStorage de l'ancien cockpit) ; gate `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add src/features/materiel/domain/departAlerts.ts src/features/materiel/domain/departCache.ts src/features/materiel/hooks/useDepartAlerts.ts src/features/materiel/hooks/useDepartOfflineCache.ts tests/materiel/depart-alerts-domain.spec.ts tests/materiel/depart-cache-domain.spec.ts src/features/materiel/components/depart/DepartDesktopView.tsx src/features/hub/components/mobile/depart/DepartMobileExperience.tsx
git commit -m "refactor(depart): logique alertes/cache extraite en modules purs + hooks testables"
```

---

### Task 11: Câblage page + suppression du cockpit legacy

**Files:**
- Modify: `src/features/hub/components/possession/HubDepartSection.tsx` (rendu `hidden lg:block` / `lg:hidden`)
- Modify: `src/app/hub/[section]/page.tsx` si nécessaire (aucun wrapper spécifique depart — vérifier)
- Delete: `DepartCockpit.tsx`, `DepartHeader.tsx`, `DepartLeftSidebar.tsx`, `DepartRightSidebar.tsx`, `DepartAlerts.tsx`, `MobileFloatingIsland.tsx`, `MobileWeightHeader.tsx`, `CountdownLive` dupliqué restant
- Modify: `tests/mobile-layout.spec.ts` (assertions obsolètes)

**Interfaces:**
- `HubDepartSection` : `Promise.all` inchangé, puis
  ```tsx
  <div className="hidden lg:block"><DepartDesktopView depart={depart} weather={weather} kits={kitList} inventory={inventory} loans={loans} products={products} /></div>
  <div className="lg:hidden"><DepartMobileExperience … /></div>
  ```

- [ ] **Step 1:** `rg -n "DepartCockpit|DepartLeftSidebar|DepartRightSidebar|DepartAlerts|MobileFloatingIsland|MobileWeightHeader|DepartHeader" src tests scripts` → lister tous les usages.
- [ ] **Step 2:** Effectuer le câblage + suppressions ; adapter `tests/mobile-layout.spec.ts` (remplacer les assertions `DepartCockpit` par `DepartMobileExperience` : wrapper canonique, pas de `fixed bottom-4`, pas de safe-area).
- [ ] **Step 3:** `npx vitest run` → 0 échec (hors 4 suites préexistantes documentées) ; `npx tsc --noEmit` → 0.
- [ ] **Step 4:** `npm run build` → 0 (vérifier `/hub/[section]` compile, pas de chunk cassé).
- [ ] **Step 5: Commit**

```bash
git add -A src/features/materiel/components/depart src/features/hub/components/mobile/depart src/features/hub/components/possession/HubDepartSection.tsx src/app/hub tests/mobile-layout.spec.ts
git commit -m "refactor(depart): bascule lg, suppression cockpit legacy et code mort (5 fichiers)"
```

---

### Task 12: e2e + captures visuelles

**Files:**
- Create: `scripts/e2e/depart-cockpit.spec.ts`
- Create: `tests/visual/depart-cockpit.spec.ts`
- Create: `docs/depart/` (captures)

- [ ] **Step 1: e2e (TDD : écrire, run rouge si sélecteurs absents, puis vert)**

```ts
import { test, expect } from '@playwright/test';
// test 1 — desktop : /hub/depart?id=none&route=375 → [data-testid="depart-cockpit"] visible,
//   AUCUN « Tour du Mont-Blanc — 4j Bivouac », et le titre affiche le nom réel du sentier 375 :
//   vérifier d'abord le nom en base (`node -e` avec SUPABASE_SERVICE_ROLE_KEY → hiking_routes id=375)
//   puis figer l'assertion exacte (ex. attendu « Sambre »).
//   Les 5 eyebrows présents ; zéro pageerror.
// test 2 — mobile : page.setViewportSize({ width: 390, height: 844 }) + reload →
//   [data-testid="depart-mobile-experience"] visible ; [data-testid="depart-cockpit"] caché ;
//   bouton « Gérer le matériel » visible.
```

Run: `PW_BASE_URL=http://localhost:4000 npx playwright test --config=playwright.config.ts scripts/e2e/depart-cockpit.spec.ts`
Expected: PASS (2/2).

- [ ] **Step 2: captures visuelles** — test par projet (desktop/iphone/ipad), `page.goto('/hub/depart?id=none&route=375')`, attendre le testid, `page.screenshot({ path: docs/depart/depart-<project>.png, fullPage: false })`, assertions minimales (ready + pas de `pageerror`).
Run: `npx playwright test --config=playwright.visual.config.ts tests/visual/depart-cockpit.spec.ts`
Expected: 3/3 (fichiers `docs/depart/depart-*.png` créés).

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e/depart-cockpit.spec.ts tests/visual/depart-cockpit.spec.ts docs/depart
git commit -m "test(depart): e2e flux complet + captures desktop/mobile du nouveau cockpit"
```

---

### Task 13: Gates + rapport + merge Volet 1

- [ ] **Step 1:** `npx tsc --noEmit` → 0 · `npm run lint` → 0 · `npx vitest run` → seuls les 4 échecs préexistants · `npm run build` → 0.
- [ ] **Step 2:** Suite visuelle complète (3 projets) : `npx playwright test --config=playwright.visual.config.ts` → seuls les 12 snapshots préexistants en échec (documentés) ; e2e atlas + depart verts.
- [ ] **Step 3:** Entrée `MISSION_LOG.md` : causes racines, tasks, sorties brutes (tsc/lint/vitest/build/e2e/captures), rollback.
- [ ] **Step 4:** `git checkout main; git merge --no-ff chantier/depart-refonte; git push origin main`.

---

## Volet 2 — Explorer mobile/natif (systematic-debugging obligatoire)

> Avant CHAQUE correctif E1-E5 : reproduire, prouver la cause racine (captures/logs bruts dans `docs/explorer-mobile/`), correctif minimal, re-prouver. Skill `systematic-debugging` invoqué au démarrage du volet.

### Task 14 (E1): Contrôles carte inutilisables sous le carrousel

**Files:** Modify `src/components/explorer/ExplorerMobileHikeCarousel.tsx` et/ou `src/components/map/UnifiedExplorerMap.tsx` ; Create `docs/explorer-mobile/e1-avant.png`, `e1-apres.png`.

- [ ] **Step 1:** Reproduction : capture 390×844 après « Explorer ma zone » avec carrousel visible → prouver que zoom/CTA sont recouverts (`elementFromPoint` sur les boutons ≠ bouton).
- [ ] **Step 2:** Cause racine : carrousel `z-[800]` vs CTA `z-510`/zoom `z-500` dans un stacking context (`absolute inset-0 z-0`, `ExplorerClient.tsx:486`) ; le carrousel pleine largeur capture les taps.
- [ ] **Step 3:** Correctif minimal au choix selon preuve : relever CTA+zoom au-dessus (`z-[850]`) **ou** réduire la zone interactive du carrousel. Critère : `elementFromPoint` sur zoom + CTA + « Préparer » = le bouton lui-même ; taps réels Playwright verts à 390×844 et 430×932.
- [ ] **Step 4:** Preuves avant/après + entrée `MISSION_LOG.md` + commit.

### Task 15 (E2+E3): Géolocalisation native + repli sans GPS

**Files:** Modify `src/components/explorer/ExplorerClient.tsx` (utiliser `src/lib/native/geolocation.ts`), `ios/App/App/Info.plist` (+`NSLocationWhenInUseUsageDescription`), `android/app/src/main/AndroidManifest.xml` (+`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`), `src/components/map/UnifiedExplorerMap.tsx` (`handleToggleGlobe` : sans position → rester sur le globe + message non bloquant ; réutiliser dernière position si `localStorage`).

- [ ] **Step 1:** Prouver : sans position, « Explorer ma zone » aboutit à bbox sans sentier (Chamonix, `limit 0`) → capture console réseau.
- [ ] **Step 2:** Correctif : wrapper natif + permissions + repli globe (+ message « Position indisponible — déplacez la carte ou activez la localisation »).
- [ ] **Step 3:** Protocole de test manuel téléphone (`docs/explorer-mobile/protocole-native.md`) : build `CAPACITOR_SERVER_URL` requis, test iOS/Android, cases permission accordée/refusée.

### Task 16 (E4+E5): Service worker natif + config serveur native

**Files:** Modify `src/app/layout.tsx` (garde `isNative()` autour de l'enregistrement SW), `docs/mobile/ANDROID_RELEASE.md` + `capacitor.config.ts` (exiger `CAPACITOR_SERVER_URL`).

- [ ] **Step 1:** Prouver que le SW s'enregistre sans garde native (lecture `layout.tsx:221-239` + `isNative()`).
- [ ] **Step 2:** Correctif minimal + doc de build.
- [ ] **Step 3:** Gates + rapport + merge `chantier/explorer-mobile-native`.

---

## Self-Review (fait à la rédaction)

- Couverture spec : §4 architecture → T8/T9/T11 ; §5 contenu → T2-T9 (+ T5 purge DS) ; §6 visuel → T2/T5 (+ gardes tests) ; §7 données → T1 ; §8 exploreur → T14-T16 ; §9 tests → T12/T13. Aucun gap.
- Placeholders : aucun « TBD » ; les composants volumineux sont spécifiés par composition exacte (props + structure + classes), testés par markup statique.
- Cohérence des types : `DepartIdentity` (T1) consommé tel quel en T2/T7/T8 ; `DepartCockpitProps` conservé comme interface des deux vues ; testids constants.
