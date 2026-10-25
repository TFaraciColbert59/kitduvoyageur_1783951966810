# Mon Matériel — Final Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining gaps of the "Mon Matériel" Liquid Glass cockpit — per-kit history, participant add UI, mobile grid reorder, and a verified Playwright + build pass.

**Architecture:** Server-rendered App Router pages (`src/app/materiel/**`) backed by Supabase API routes (`src/app/api/materiel/**`) and reusable widgets (`src/features/materiel/components/**`). Logic is isolated in pure, testable modules under `src/lib/materiel/**` covered by Vitest (`tests/**`). Remaining work is incremental: add one API route + one client widget per concern, verify with `tsc --noEmit`, Vitest, and HTTP smoke tests.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind, Supabase (RLS), Zod, Zustand, framer-motion, Vitest, Playwright.

**Spec:** `PROMPT_ULTIME_MON_MATERIEL_REBUILD (1).md`

## Global Constraints

- Route path is `/materiel` (App Router under `src/app/`), alias `@/*` → `./src/*`.
- Supabase prod project only: `icxyvwzfjbflcbqukpfz`. Never the ghost project `lwrmuggefbmboikjgudc`.
- Schema tables (RLS by `auth.uid()`): `materiel_kits`, `materiel_kit_items`, `materiel_kit_history`, `product_ownership`, `alerts`, `materiel_loans`, `depart_participants`, `share_tokens`.
- Never `#E4501C`; palette Sage/Stone/Ink only. No glass-on-glass (one glass sheet per card).
- Server Components by default; `'use client'` only for local interactivity. Zod on every server input.
- Prefer the existing Supabase server client: `createClient()` from `@/lib/supabase/server` (async).
- Tests: Vitest (`npm run test`), Playwright (`npm run test:e2e`), type-check (`npm run type-check`).

---

### Task 1: Kit history — per-selected-kit fetch route + label helper

**Files:**
- Create: `src/app/api/materiel/kits/[id]/history/route.ts`
- Create: `src/lib/materiel/history.ts`
- Modify: `src/features/materiel/components/kits/KitHistoryTimeline.tsx` (use a real `action` → label map)
- Test: `tests/materiel/history.spec.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`; `materiel_kit_history` table.
- Produces:
  - `export function historyLabel(action: string): string` — returns a human label.
  - `export function historyTone(action: string): 'sage' | 'info' | 'warn' | 'danger' | 'stone'`.
  - `GET /api/materiel/kits/[id]/history` → `{ entries: { id, action, payload, created_at }[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/materiel/history.spec.ts
import { describe, it, expect } from 'vitest';
import { historyLabel, historyTone } from '@/lib/materiel/history';

describe('history', () => {
  it('labels known actions', () => {
    expect(historyLabel('created')).toBe('Création');
    expect(historyLabel('deleted')).toBe('Suppression');
    expect(historyLabel('forked')).toBe('Fork');
  });
  it('falls back to the raw action', () => {
    expect(historyLabel('unknown')).toBe('unknown');
  });
  it('maps tones', () => {
    expect(historyTone('deleted')).toBe('danger');
    expect(historyTone('created')).toBe('sage');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/materiel/history.spec.ts`
Expected: FAIL with "Cannot find module '@/lib/materiel/history'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/materiel/history.ts
const LABELS: Record<string, string> = {
  created: 'Création', updated: 'Mise à jour', deleted: 'Suppression', restored: 'Restauré',
  forked: 'Fork', optimized: 'Optimisé', compared: 'Comparé',
};
const TONES: Record<string, 'sage' | 'info' | 'warn' | 'danger' | 'stone'> = {
  created: 'sage', updated: 'info', deleted: 'danger', restored: 'warn',
  forked: 'stone', optimized: 'sage', compared: 'stone',
};
export function historyLabel(action: string): string { return LABELS[action] ?? action; }
export function historyTone(action: string): 'sage' | 'info' | 'warn' | 'danger' | 'stone' { return TONES[action] ?? 'stone'; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/materiel/history.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the per-kit history route**

```ts
// src/app/api/materiel/kits/[id]/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { id } = await params;
    const { data, error } = await supabase
      .from('materiel_kit_history')
      .select('id, action, payload, created_at')
      .eq('kit_id', id).eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Refactor `KitHistoryTimeline` to use the helpers**

In `src/features/materiel/components/kits/KitHistoryTimeline.tsx`, replace the local `ACTION_LABEL`/`ACTION_TONE` maps with imports from `@/lib/materiel/history` and use `historyLabel(h.action)` / `historyTone(h.action)`.

- [ ] **Step 7: Verify + commit**

Run: `npm run type-check` then `npm run test`
Expected: type-check 0 errors; Vitest all green.
```bash
git add tests/materiel/history.spec.ts src/lib/materiel/history.ts src/app/api/materiel/kits/[id]/history/route.ts src/features/materiel/components/kits/KitHistoryTimeline.tsx
git commit -m "feat(materiel): per-kit history route + reusable history label helpers"
```

---

### Task 2: Participants — add UI (insert route + form)

**Files:**
- Create: `src/app/api/materiel/participants/route.ts`
- Modify: `src/features/materiel/components/depart/ParticipantsEmergency.tsx` (add "Ajouter" + form + remove)
- Test: `tests/schemas/participant.spec.ts`

**Interfaces:**
- Consumes: `depart_participants` table; `DepartDetail.participants: Participant[]`.
- Produces:
  - `export const participantSchema = z.object({ kit_id: z.string().uuid(), name: z.string().min(1).max(80), is_emergency_contact: z.boolean().default(false), contact: z.string().max(160).nullable().optional() })`.
  - `POST /api/materiel/participants` (body `participantSchema`) → `{ participant }`.

- [ ] **Step 1: Write the failing schema test**

```ts
// tests/schemas/participant.spec.ts
import { describe, it, expect } from 'vitest';
import { participantSchema } from '@/lib/schemas/materiel';

describe('participantSchema', () => {
  it('accepts a valid participant', () => {
    const r = participantSchema.safeParse({ kit_id: '11111111-1111-1111-1111-111111111111', name: 'Marie' });
    expect(r.success).toBe(true);
  });
  it('rejects an empty name', () => {
    const r = participantSchema.safeParse({ kit_id: '11111111-1111-1111-1111-111111111111', name: '' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schemas/participant.spec.ts`
Expected: FAIL — `participantSchema` not exported from `@/lib/schemas/materiel`.

- [ ] **Step 3: Add `participantSchema` to `src/lib/schemas/materiel.ts`**

```ts
export const participantSchema = z.object({
  kit_id: z.string().uuid('Identifiant de kit invalide'),
  name: z.string().min(1, 'Nom requis').max(80),
  is_emergency_contact: z.boolean().default(false),
  contact: z.string().max(160).nullable().optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schemas/participant.spec.ts`
Expected: PASS

- [ ] **Step 5: Add the insert route**

```ts
// src/app/api/materiel/participants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { participantSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const parsed = participantSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalide' }, { status: 400 });
    const { data, error } = await supabase
      .from('depart_participants')
      .insert({ user_id: user.id, ...parsed.data })
      .select('*').single();
    if (error) throw error;
    return NextResponse.json({ participant: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Add the "Ajouter" UI to `ParticipantsEmergency`**

`ParticipantsEmergency.tsx` is already `'use client'`. Add `kitId?: string` prop. When `kitId` present, render a small inline form (name input + "Ajouter" button) that POSTs to `/api/materiel/participants` with `{ kit_id: kitId, name }`, then `router.refresh()`. Show a `useToast` success/error.

- [ ] **Step 7: Wire `kitId` from the depart page**

In `src/app/materiel/depart/[id]/page.tsx`, pass `kitId={depart.id}` to `<ParticipantsEmergency participants={depart.participants} emergencyContact={depart.emergencyContact} kitId={depart.id} />`.

- [ ] **Step 8: Verify + commit**

Run: `npm run type-check`, `npm run test`, then `curl http://localhost:4000/materiel/depart/test-id` → 200.
```bash
git add tests/schemas/participant.spec.ts src/lib/schemas/materiel.ts src/app/api/materiel/participants/route.ts src/features/materiel/components/depart/ParticipantsEmergency.tsx src/app/materiel/depart/[id]/page.tsx
git commit -m "feat(materiel): participants — insert route + add UI"
```

---

### Task 3: Mobile grid reorder with persistence

**Files:**
- Create: `src/features/materiel/store/useMaterielOrder.ts`
- Modify: `src/features/materiel/components/MaterielGrid.tsx` (reorderable on mobile)
- Test: `tests/materiel/order.spec.ts`

**Interfaces:**
- Consumes: `materiel` grid areas: `['depart','forget','kits','inventaire','alertes','dispo']`.
- Produces:
  - `export const DEFAULT_ORDER = ['depart','forget','kits','inventaire','alertes','dispo'] as const;`
  - `export function normalizeOrder(order: string[]): string[]` — keeps known areas, appends missing ones, dedupes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/materiel/order.spec.ts
import { describe, it, expect } from 'vitest';
import { normalizeOrder, DEFAULT_ORDER } from '@/features/materiel/store/useMaterielOrder';

describe('normalizeOrder', () => {
  it('keeps a valid order', () => {
    expect(normalizeOrder(['kits', 'depart', 'inventaire', 'forget', 'alertes', 'dispo']))
      .toEqual(['kits', 'depart', 'inventaire', 'forget', 'alertes', 'dispo']);
  });
  it('appends missing and dedupes', () => {
    expect(normalizeOrder(['kits', 'kits'])).toEqual(['kits', ...DEFAULT_ORDER.filter((a) => a !== 'kits')]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/materiel/order.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store + normalize**

```ts
// src/features/materiel/store/useMaterielOrder.ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_ORDER = ['depart', 'forget', 'kits', 'inventaire', 'alertes', 'dispo'] as const;

export function normalizeOrder(order: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...order, ...DEFAULT_ORDER]) {
    if (DEFAULT_ORDER.includes(a as (typeof DEFAULT_ORDER)[number]) && !seen.has(a)) { seen.add(a); out.push(a); }
  }
  return out;
}

interface OrderState { order: string[]; setOrder: (o: string[]) => void; }
export const useMaterielOrder = create<OrderState>()(
  persist((set) => ({ order: [...DEFAULT_ORDER], setOrder: (o) => set({ order: normalizeOrder(o) }) }),
    { name: 'lkdv-materiel-order' })
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/materiel/order.spec.ts`
Expected: PASS

- [ ] **Step 5: Wire the reorder UI**

Make `src/features/materiel/components/MaterielGrid.tsx` read `useMaterielOrder` and, on mobile (`max-md`), render the 6 cards from `order` with up/down arrows to reorder (calls `setOrder`). On desktop keep the CSS named-area grid. Keep a single glass sheet; arrow buttons use `bg-white/20`.

- [ ] **Step 6: Verify + commit**

Run: `npm run type-check`, `npm run test`, `curl http://localhost:4000/materiel` → 200.
```bash
git add tests/materiel/order.spec.ts src/features/materiel/store/useMaterielOrder.ts src/features/materiel/components/MaterielGrid.tsx
git commit -m "feat(materiel): grille mobile reordonnable persistante (Zustand)"
```

---

### Task 4: Playwright e2e — run and green

**Files:**
- Modify: `scripts/e2e/materiel.spec.ts` (already exists; extend with CRUD + axe on fullscreens)

**Interfaces:**
- Consumes: dev/prod server on `http://localhost:4028` (`npm run start`), or `PW_BASE_URL`.

- [ ] **Step 1: Write/confirm the e2e spec**

`scripts/e2e/materiel.spec.ts` already asserts grid render + nav + axe. Extend with:
```ts
test('depart cockpit — axe + retour', async ({ page }) => {
  await page.goto('/materiel/depart/test-id');
  await expect(page.getByRole('link', { name: /Retour/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 2: Build and run e2e**

Run: `npm run build` then `npm run test:e2e`
Expected: all Playwright tests pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e/materiel.spec.ts
git commit -m "test(materiel): e2e cockpit + axe"
```

---

### Task 5: Final verification + docs + re-push

**Files:**
- Modify: `MISSION_LOG.md`, `docs/materiel-liquid-glass.md`

- [ ] **Step 1: Run all proof gates**

Run:
- `npm run type-check` → 0 errors
- `npm run test` → all green
- `npm run build` → success
- HTTP sweep: `/materiel`, `/materiel/kits`, `/materiel/inventaire`, `/materiel/alertes`, `/materiel/disponibilite`, `/materiel/forget`, `/materiel/depart/test-id` → 200

- [ ] **Step 2: Update docs**

Append a "Final Completion" section to `MISSION_LOG.md` listing Tasks 1–5 and their verification output. Update `docs/materiel-liquid-glass.md` routes/API tables for `/api/materiel/participants` and `/api/materiel/kits/[id]/history`.

- [ ] **Step 3: Commit + push**

```bash
git add MISSION_LOG.md docs/materiel-liquid-glass.md
git commit -m "docs(materiel): final completion — history, participants, mobile order, e2e"
git push origin feat/materiel-rebuild-liquid-glass
```

---

## Self-Review

- **Spec coverage:** Tasks 1–2 close the remaining widget gaps (history per-kit, participants add); Task 3 delivers the prompt's mobile reorderable grid (4.1); Task 4 runs the Phase-8 Playwright gate; Task 5 is the Phase-9 verification + delivery. Missing from this plan (already implemented earlier in the session): CRUD, fork, ⌘K, weather, conflicts, offline sync — noted as done.
- **Placeholder scan:** Every step has concrete code or an exact command; no TBD/TODO.
- **Type consistency:** `historyLabel`/`historyTone` (Task 1) reused consistently; `participantSchema` (Task 2) exported from `@/lib/schemas/materiel`; `normalizeOrder`/`DEFAULT_ORDER`/`useMaterielOrder` (Task 3) names consistent across task and tests.
