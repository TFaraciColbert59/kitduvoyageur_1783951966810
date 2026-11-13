# Kit Sub-drawer & Post Actions Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Kit sub-drawer into a three-state, full-height card with real product data, and align the post action pill/menu with the requested Instagram/Apple-style interactions.

**Architecture:** `KitCard` owns the three-state local pager, the expanded-height mode and the kit action bubbles. `KitSlot` measures the available drawer viewport and passes `expandedHeight` to each card. The post action pill stays in `PostDrawer`, with styling moved to `compte-overlay.css`. Real kit products/outings already come from the bootstrap; no new endpoint is introduced.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, CSS-in-JS string constants, Vitest + Testing Library, Playwright, Supabase.

**Spec:** `docs/superpowers/specs/2026-10-24-kit-post-refinement-design.md`

## Global Constraints

- Mobile reference: 430×932; the card must not shift the drawer header.
- Real data only: `materiel_kits`, `materiel_kit_items`, `product_ownership`, `hike_sessions.kit_id`.
- No invented product photo: `photo_url` → catalog `kit_items.image` → `generatedProductImage`.
- No new npm dependency.
- All animations must respect `prefers-reduced-motion`.
- Existing kit actions must remain functional: fork, share, sheet, royalties, history, discovery.
- Post action icons must all render at exactly 16×16 CSS pixels.
- Use the existing glass tokens; do not introduce new colors.

---

## File Map

- `src/components/compte/drawer/cards/KitCard.tsx` — three states, geometry, menu, card CSS.
- `src/components/compte/drawer/slots/KitSlot.tsx` — available-height measurement, `expandedHeight` prop.
- `src/components/compte/overlay/PostDrawer.tsx` — action pill markup only if a size/order fix is needed.
- `src/components/compte/overlay/compte-overlay.css` — post action pill CSS.
- `src/components/compte/drawer/__tests__/KitSlot.test.tsx` — replace obsolete expectations; add new state/menu tests.
- `src/components/compte/overlay/__tests__/PostDrawer.actions.test.tsx` — new Playwright-oriented unit test for the pill counts.

---

### Task 1: Lock the new KitCard contract with tests

**Files:**
- Modify: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`
- Test: same file

**Interfaces:**
- Consumes: `KitSlot` props `{ kits, lens, payload }`.
- Produces: test fixtures using `KitEntry.products`, `KitEntry.quantity`, `KitEntry.outings`.

- [ ] **Step 1: Replace the obsolete kit tests**

Replace the first four `it` blocks in `KitSlot.test.tsx` with:

```tsx
const PRODUCT = {
  id: 'p1',
  name: 'Frontale Petzl Actik Core',
  category: 'Lampes & Éclairage',
  weightG: 75,
  quantity: 1,
  condition: null,
  priority: 'recommended',
  vital: false,
  brand: null,
  description: null,
  image: null,
};

const KIT = {
  id: 'k1',
  n: 'Ultralight week-end',
  w: 3505,
  quantity: 11,
  outings: 3,
  products: [PRODUCT],
};

it('affiche nom, poids, quantité et usure réelle', () => {
  render(<KitSlot lens="kits" kits={[KIT]} />);
  expect(screen.getByRole('heading', { name: 'Ultralight week-end' })).toBeTruthy();
  expect(screen.getByText('3,5 kg')).toBeTruthy();
  expect(screen.getByText('11 pièces')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: /Usure du kit/ })).toHaveAttribute('aria-valuenow', '10');
});

it('affiche les images produits dans le rail et le sélecteur 3 états', () => {
  render(<KitSlot lens="kits" kits={[KIT]} />);
  expect(screen.getByRole('button', { name: 'Frontale Petzl Actik Core' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Vue du kit' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Composition du kit' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Détail du produit' })).toBeTruthy();
});

it('ouvre la composition puis le détail produit', () => {
  render(<KitSlot lens="kits" kits={[KIT]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Composition du kit' }));
  expect(screen.getByRole('button', { name: /Frontale Petzl/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Frontale Petzl/ }));
  expect(screen.getByText('Poids')).toBeTruthy();
  expect(screen.getByText('0,1 kg')).toBeTruthy();
  expect(screen.getByText('Recommandé')).toBeTruthy();
});

it('n’affiche plus la filiation ni l’ancienne jauge détaillée', () => {
  render(<KitSlot lens="kits" kits={[KIT]} />);
  expect(screen.queryByRole('group', { name: /Filiation/ })).toBeNull();
  expect(screen.queryByText(/Entretien/)).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and confirm failures**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`

Expected: FAIL on missing `3,5 kg`, `11 pièces`, progressbar or selector; old tests may still pass until removed.

- [ ] **Step 3: Keep the payload test but update its assertion**

Replace the payload assertion with:

```tsx
expect(screen.getByRole('heading', { name: 'Kit payload' })).toBeTruthy();
```

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "test(compte): contrat des cartes kit 3 états"
```

---

### Task 2: Move the product rail left, selector right, and fix spacing

**Files:**
- Modify: `src/components/compte/drawer/cards/KitCard.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

**Interfaces:**
- Consumes: `.lkdv-kit-base`, `.lkdv-kit-rail`, `.lkdv-kit-base-main`, `.lkdv-kit-selector`.
- Produces: visual geometry; no new public API.

- [ ] **Step 1: Add a DOM-order test**

```tsx
it('place le rail produit avant le contenu dans la grille', () => {
  const { container } = render(<KitSlot lens="kits" kits={[KIT]} />);
  const base = container.querySelector('.lkdv-kit-base');
  const rail = base?.querySelector('.lkdv-kit-rail');
  const main = base?.querySelector('.lkdv-kit-base-main');
  expect(base?.firstElementChild).toBe(rail);
  expect(rail?.nextElementSibling).toBe(main);
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx -t "rail produit"`

Expected: FAIL because `base-main` is first.

- [ ] **Step 3: Reorder the base DOM**

In `KitCard.tsx`, render `.lkdv-kit-rail` before `.lkdv-kit-base-main` inside `.lkdv-kit-base`. Keep the same buttons and product data.

- [ ] **Step 4: Update CSS geometry**

Replace the base CSS block with:

```css
.lkdv-kit-base{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;gap:8px!important;height:100%!important;min-width:0!important;}
.lkdv-kit-base-main{display:flex!important;flex-direction:column!important;justify-content:center!important;gap:7px!important;min-width:0!important;grid-column:2!important;grid-row:1!important;}
.lkdv-kit-rail{grid-column:1!important;grid-row:1!important;display:flex!important;flex-direction:column!important;gap:6px!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding:2px 1px!important;scrollbar-width:none!important;}
.lkdv-kit-pane{padding:11px 11px 48px!important;box-sizing:border-box!important;}
.lkdv-kit-selector{left:auto!important;right:10px!important;bottom:9px!important;}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/compte/drawer/cards/KitCard.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "style(compte): rail kit à gauche et sélecteur à droite"
```

---

### Task 3: Expand composition/product to the available drawer height

**Files:**
- Modify: `src/components/compte/drawer/cards/KitCard.tsx`
- Modify: `src/components/compte/drawer/slots/KitSlot.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

**Interfaces:**
- Produces: `KitCardProps.expandedHeight?: number`.
- Consumes: `KitSlot` measures the nearest `.lkdv-drawer-viewport` or `.lkdv-slot-shell`.

- [ ] **Step 1: Write a failing height test**

```tsx
it('agrandit la carte en composition quand la hauteur est disponible', () => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() { this.cb([{ contentRect: { height: 420 } } as ResizeObserverEntry], this as never); }
    disconnect() {}
  });
  const { container } = render(<KitSlot lens="kits" kits={[KIT]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Composition du kit' }));
  const card = container.querySelector('.lkdv-kit-card') as HTMLElement;
  expect(card.style.height).toBe('404px');
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx -t "agrandit"`

Expected: FAIL because no height is applied.

- [ ] **Step 3: Measure the host in `KitSlot`**

Add imports `useEffect, useRef, useState` and:

```tsx
const rootRef = useRef<HTMLDivElement>(null);
const [availableHeight, setAvailableHeight] = useState(0);

useEffect(() => {
  const root = rootRef.current;
  const host = root?.closest('.lkdv-drawer-viewport, .lkdv-slot-shell') as HTMLElement | null;
  if (!host) return;
  const measure = () => setAvailableHeight(Math.max(260, Math.floor(host.getBoundingClientRect().height) - 16));
  measure();
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
  observer?.observe(host);
  return () => observer?.disconnect();
}, []);
```

Attach `ref={rootRef}` to `.lkdv-kit-slot`, and pass:

```tsx
<KitCard kit={kit} viewer={resolvedViewer} payload={records} expandedHeight={availableHeight || undefined} />
```

- [ ] **Step 4: Apply height in `KitCard`**

Add `expandedHeight?: number` to `KitCardProps`, then:

```tsx
const expanded = view > 0 && expandedHeight;
<article
  style={expanded ? { height: `${expandedHeight}px` } : undefined}
  data-expanded={expanded ? 'true' : 'false'}
  ...
>
```

Add CSS:

```css
.lkdv-kit-card.lkdv-kit-card-v2{transition:height .42s cubic-bezier(.22,1,.36,1)!important;}
.lkdv-kit-card-v2[data-expanded="true"]{min-height:0!important;}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/compte/drawer/cards/KitCard.tsx src/components/compte/drawer/slots/KitSlot.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "feat(compte): déploiement vertical animé des cartes kit"
```

---

### Task 4: Soften the scroll endings and add bottom radii

**Files:**
- Modify: `src/components/compte/drawer/cards/KitCard.tsx`

**Interfaces:**
- Consumes: `.lkdv-kit-comp-scroll`, `.lkdv-kit-product-scroll`, `.lkdv-kit-rail`.
- Produces: no API change.

- [ ] **Step 1: Add the edge CSS**

```css
.lkdv-kit-comp-scroll,
.lkdv-kit-product-scroll,
.lkdv-kit-rail{
  border-radius:14px!important;
  scroll-padding-bottom:48px!important;
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 18px),transparent 100%)!important;
  mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 18px),transparent 100%)!important;
}
.lkdv-kit-comp-scroll,
.lkdv-kit-product-scroll{padding-bottom:48px!important;}
.lkdv-kit-pane{border-radius:0 0 16px 16px!important;overflow:hidden!important;}
```

- [ ] **Step 2: Verify no bottom clipping**

Use Playwright at 430×932: scroll composition to the last row and product to the last fact; screenshot. Expected: last row/fact fully visible, fade at the bottom, no hard cut.

- [ ] **Step 3: Commit**

```bash
git add src/components/compte/drawer/cards/KitCard.tsx
git commit -m "style(compte): adoucir les fins de scroll des kits"
```

---

### Task 5: Replace the kit menu with icon bubbles

**Files:**
- Modify: `src/components/compte/drawer/cards/KitCard.tsx`
- Test: `src/components/compte/drawer/__tests__/KitSlot.test.tsx`

**Interfaces:**
- Consumes: existing `forkKit`, `shareKit`, `openSheet`, `openRoyalties`, `openHistory`, `openDiscovery`.
- Produces: `.lkdv-kit-menu-trigger`, `.lkdv-kit-menu`, `.lkdv-kit-menu-bubble`.

- [ ] **Step 1: Write the menu test**

```tsx
it('ouvre six actions iconiques et bascule le déclencheur en croix', () => {
  render(<KitSlot lens="kits" kits={[KIT]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Composition du kit' }));
  fireEvent.click(screen.getByRole('button', { name: /Frontale Petzl/ }));
  const trigger = screen.getByRole('button', { name: /Actions du kit/ });
  fireEvent.click(trigger);
  expect(screen.getByRole('menu')).toBeTruthy();
  expect(screen.getAllByRole('menuitem')).toHaveLength(6);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.textContent).toBe('');
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx -t "six actions"`

Expected: FAIL because the trigger still contains `•••` text and the menu items contain text.

- [ ] **Step 3: Replace the trigger and menu markup**

Import from `lucide-react`:

```tsx
import { Coins, Compass, FileText, GitFork, History, MoreHorizontal, Share2, X } from 'lucide-react';
```

Trigger:

```tsx
<button
  type="button"
  className={`lkdv-kit-menu-trigger${menuOpen ? ' is-open' : ''}`}
  aria-label={`Actions du kit ${name}`}
  aria-expanded={menuOpen}
  onClick={() => setMenuOpen((open) => !open)}
>
  {menuOpen ? <X size={16} /> : <MoreHorizontal size={16} />}
</button>
```

Menu items (icon only, each with `aria-label` and `title`):

```tsx
<button type="button" role="menuitem" aria-label="Récupérer" title="Récupérer" onClick={() => { setMenuOpen(false); void forkKit(); }}><GitFork size={16} /></button>
<button type="button" role="menuitem" aria-label="Partager" title="Partager" onClick={() => { setMenuOpen(false); void shareKit(); }}><Share2 size={16} /></button>
<button type="button" role="menuitem" aria-label="Fiche" title="Fiche" onClick={() => { setMenuOpen(false); openSheet(); }}><FileText size={16} /></button>
<button type="button" role="menuitem" aria-label="Royalties" title="Royalties" onClick={() => { setMenuOpen(false); void openRoyalties(); }}><Coins size={16} /></button>
<button type="button" role="menuitem" aria-label="Historique" title="Historique" onClick={() => { setMenuOpen(false); void openHistory(); }}><History size={16} /></button>
<button type="button" role="menuitem" aria-label="Découvrir" title="Découvrir" onClick={() => { setMenuOpen(false); void openDiscovery(); }}><Compass size={16} /></button>
```

- [ ] **Step 4: Style the bubbles**

```css
.lkdv-kit-menu-wrap{position:absolute!important;top:8px!important;right:8px!important;z-index:12!important;}
.lkdv-kit-menu{position:absolute!important;top:42px!important;right:0!important;width:auto!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:7px!important;}
.lkdv-kit-menu button{width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border:.5px solid rgba(255,255,255,.82)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(255,255,255,.74),rgba(255,255,255,.46) 55%,rgba(255,255,255,.6))!important;-webkit-backdrop-filter:blur(18px) saturate(1.8)!important;backdrop-filter:blur(18px) saturate(1.8)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.14),0 6px 18px rgba(10,20,14,.16)!important;color:#17402C!important;display:grid!important;place-items:center!important;opacity:0!important;animation:lkdvKitBubbleIn .38s cubic-bezier(.22,1,.36,1) forwards!important;}
.lkdv-kit-menu button:nth-child(1){animation-delay:.02s!important;}
.lkdv-kit-menu button:nth-child(2){animation-delay:.06s!important;}
.lkdv-kit-menu button:nth-child(3){animation-delay:.1s!important;}
.lkdv-kit-menu button:nth-child(4){animation-delay:.14s!important;}
.lkdv-kit-menu button:nth-child(5){animation-delay:.18s!important;}
.lkdv-kit-menu button:nth-child(6){animation-delay:.22s!important;}
.lkdv-kit-menu-trigger.is-open svg{transform:rotate(90deg)!important;}
@keyframes lkdvKitBubbleIn{from{opacity:0;transform:translateY(-8px) scale(.8)}to{opacity:1;transform:none}}
```

- [ ] **Step 5: Test every action route**

Add a test that stubs `fetch` and clicks each menu item, asserting:

- `/api/materiel/fork`
- `/api/materiel/share`
- `/api/kits/${KIT_ID}/refer`
- `/api/kits/${KIT_ID}/sheet`
- `/api/kits/my-royalties`
- `/api/materiel/kits/${KIT_ID}/history`
- `/api/kits/discovery`

Use the existing `jsonResponse` helper. For `shareKit`, stub `navigator.share` and assert it was called.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/compte/drawer/cards/KitCard.tsx src/components/compte/drawer/__tests__/KitSlot.test.tsx
git commit -m "feat(compte): menu kit en bulles iconiques"
```

---

### Task 6: Post action pill — right side, counters, equal icons

**Files:**
- Modify: `src/components/compte/overlay/compte-overlay.css`
- Test: `src/components/compte/overlay/__tests__/PostDrawer.actions.test.tsx` (create)

**Interfaces:**
- Consumes: `.lkdv-post-media-glass`, `.lkdv-post-action-count`.
- Produces: no API change.

- [ ] **Step 1: Write the CSS contract test**

```tsx
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('post action pill CSS', () => {
  const css = readFileSync('src/components/compte/overlay/compte-overlay.css', 'utf8');
  it('positions the pill on the right and fixes all icons at 16px', () => {
    expect(css).toContain('.lkdv-post-drawer .lkdv-post-media-glass{left:auto!important;right:10px!important;');
    expect(css).toContain('.lkdv-post-drawer .lkdv-post-media-glass svg{width:16px!important;height:16px!important;');
  });
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `npx vitest run src/components/compte/overlay/__tests__/PostDrawer.actions.test.tsx`

Expected: FAIL because the pill is still left-aligned.

- [ ] **Step 3: Replace the pill CSS**

```css
.lkdv-post-drawer .lkdv-post-media-glass{left:auto!important;right:10px!important;bottom:10px!important;padding:3px!important;gap:1px!important;border-radius:999px!important;}
.lkdv-post-drawer .lkdv-post-media-glass button{width:auto!important;min-width:46px!important;height:31px!important;padding:0 8px!important;gap:4px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;}
.lkdv-post-drawer .lkdv-post-media-glass svg{width:16px!important;height:16px!important;flex:none!important;display:block!important;stroke-width:2!important;}
.lkdv-post-drawer .lkdv-post-action-count{order:2!important;font:600 10px/1 var(--sf)!important;color:rgba(255,255,255,.94)!important;font-variant-numeric:tabular-nums!important;}
```

- [ ] **Step 4: Verify markup order**

In `PostDrawer.tsx`, confirm each button renders `<Icon />` then `<span className="lkdv-post-action-count">`. If not, reorder to icon first, count second.

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/components/compte/overlay/__tests__/PostDrawer.actions.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/compte/overlay/compte-overlay.css src/components/compte/overlay/PostDrawer.tsx src/components/compte/overlay/__tests__/PostDrawer.actions.test.tsx
git commit -m "style(compte): actions post à droite et icônes homogènes"
```

---

### Task 7: End-to-end verification and deploy

**Files:**
- No source changes.

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: exit 0.

- [ ] **Step 2: Run focused tests**

Run: `npx vitest run src/components/compte/drawer/__tests__/KitSlot.test.tsx src/components/compte/overlay/__tests__/PostDrawer.actions.test.tsx`

Expected: all pass.

- [ ] **Step 3: Build**

Run: `npm run build`

Expected: compiled successfully.

- [ ] **Step 4: Playwright visual checks at 430×932**

- Kit base: rail left, selector right, 48 px bottom space.
- Kit composition: card expands to available height; last row visible; rounded/faded bottom.
- Kit product: facts, French priority, full-height scroll.
- Kit menu: six icon bubbles, X toggle, each action responds.
- Post: pill right, three 16 px icons, counters right of icons.

- [ ] **Step 5: Deploy**

```bash
cd /Users/fr168256/Desktop/kitduvoyageur-deploy-eacd74af
git checkout <commit>
cp /Users/fr168256/Desktop/kitduvoyageur_1783951966810/.env.local .env.local
npx vercel deploy --prod --yes
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test(compte): recette cartes kit et actions post"
```

---

## Self-Review

- Spec coverage: base geometry, left rail, right selector, 48 px spacing, expansion, rounded/faded scroll endings, icon bubble menu, post pill right/counters/icon size are all mapped to tasks.
- Placeholder scan: no TBD/TODO; every task has commands, snippets and expected outcomes.
- Type consistency: `expandedHeight` is defined in Task 3 and consumed in `KitCard`; `KitProductView` fields are used consistently; selector labels match tests.
