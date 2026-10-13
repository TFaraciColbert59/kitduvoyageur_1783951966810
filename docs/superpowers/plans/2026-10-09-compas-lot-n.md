# Compas lot N — d'où l'on part (PLAN-100 §4.3, §4.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Compas knows where the traveller leaves from: « depuis Lyon » is understood and stored, the travel leg uses the said origin, then the GPS, never France or Paris by default (without origin nothing is priced and the screen says so), flights go from the nearest airport to the nearest airport (OurAirports), and a one-day outing with more than 3 h of travel each way is flagged.

**Architecture:** A new intent action `set_origin` is read by the rules (and may come from the AI), applied through the existing apply pipeline (`planApplication` → `runOps` → new server action `compasSetOriginAction`, same geocoding and `compas-destination` limit as the destination) into `trips.metadata.compas.origin`. The travel leg (« 5. Venir ») moves into a pure, dependency-injected planner `engine/travel.ts` (`planTravelLeg`), so every decision (origin precedence, no default, airports, day-trip note) is unit-tested with fakes; `autofillActions.ts` only wires the real routing and airport lookup into it. Airports come from a generated, committed JSON (`src/features/compas/data/airports.json`, built by `scripts/compas/build-airports.mjs`), read only by `server/airports.ts` (`import 'server-only'`), with the pure scorer in `engine/airports.ts`.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript strict, zod, Vitest, Node 22 (build script, no dependency).

**Spec:** `docs/compas/PLAN-100.md` §4.3 + §4.4 + `.superpowers/sdd/2026-10-09-compas-lot-n/scope.md`

## Global Constraints

- No new npm dependency.
- The airports JSON (`src/features/compas/data/airports.json`) and `src/features/compas/server/airports.ts` are never imported from a client component (`'use client'` file or anything they import). `server/airports.ts` starts with `import 'server-only'`. Only `server/airports.ts` (and tests) import the JSON. A test guards this (Task 3).
- UI text in French, tutoiement, no new colour literal and never `#E4501C`.
- Mobile views use inline styles (no Tailwind).
- Every server action input validated with zod.
- No France/Paris default for the origin anywhere in the travel leg (no `'FR'` fallback for the origin country, no Paris coordinates, no « depuis la France » text, no « France (position non partagée) » AI fact).
- Exact texts (copy them verbatim):
  - note without origin: `Point de départ inconnu : écris « depuis Lyon » dans ta demande ou partage ta position pour chiffrer le trajet.`
  - AI fact without origin: `Départ de la personne : inconnu.`
  - screen line without origin: `Trajet non chiffré : point de départ inconnu`
  - day-trip note: `N h MM de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.` (e.g. `3 h 20 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.`)
  - intent label: `Départ : X`
- Tests with Vitest (`npx vitest run <path>`), never skip/disable a test. Updating an existing assertion to a new, intended contract is allowed only where a step says so explicitly.
- `npx tsc --noEmit -p tsconfig.json` clean.
- Commit messages in French, conventional prefix (`feat(compas): …`, `fix(compas): …`, `test(compas): …`, `docs(compas): …`), each ending with the two lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ`
- Never push (the controller pushes). Never chmod tracked files.
- Lot M (time zones) lands BEFORE this lot on the same branch: it edits `compasActions.ts` (`interpretSchema`, `today`), `autofillActions.ts` (schema, `today`, `resolveProjectContext` calls, `bestPeriod`), `CompasScreen.tsx` (autofill start and interpret calls), `CompasSheets.tsx` (`SourcesFlow` chip), `getCompasData.ts` (zone). Never rely on line numbers in those files: every edit below quotes the exact old snippet; if a quoted snippet is not found verbatim, search for its first line and adapt only the surrounding whitespace, never the logic lot M added.
- Out of scope, do not touch: profile home city (§4.1), train outside the 10 rail countries, « sans voiture » preference, booking (`server/resaActions.ts`), the « près de chez toi » anchor fallback that uses the GPS when no destination is said (`autofillActions.ts`, block `if (!anchor && from)`).

## Notes on the scope

Facts checked against the code on 9 Oct. (first at HEAD `1b42ca5`, then re-checked at HEAD `6fce2dd` with lot M Tasks 1-3 committed: every quoted snippet of Tasks 1-5 applies verbatim, and with all five tasks applied in a scratch copy `npx vitest run src/features/compas src/lib/ai` (81 files, 1 732 tests), `npx tsc --noEmit` and `eslint` are green). Where the code differs from the exploration report, the code wins:

1. **Proposals are applied on the client**, not in a server « apply » action: `planApplication` (`engine/intent.ts`) turns ticked actions into `ApplyOp`s, `runOps` (`components/compasApply.ts`) calls one server action per op (`compasSetDestinationAction` for `op: 'destination'`, `server/compasActions.ts`). `set_origin` follows the same path: new op `{ op: 'origin'; place: string | null }` and new server action `compasSetOriginAction`, which reuses `resolveDestination` (exact map name → specialist base → natural place → loose) and the `compas-destination` limit (20 / 10 min, `failMode: 'closed'`) with the same messages. `inverseOps` gets an inverse for `origin` (the screen's « Annuler »), which needs the current said origin on the screen: `CompasData.originName` (read in `compasPlan`).
2. **`notAPlace` treated any name STARTING like a month as a month** (`monthOf` matches prefixes: « Marseille » → `mars`, « Juillac » → `juil`, « Octon » → `oct`). « week-end à Marseille » gave no destination, and « en partant de Marseille » would give no origin. Task 1 fixes it (whole month word only); all existing tests still pass with the fix.
3. **The destination name ran into « depuis »**: « rando 3 jours dans le Vercors depuis Lyon » gave `set_destination` « Vercors depuis Lyon » and `search_route` « Vercors depuis Lyon » (the end-of-name break list had no « depuis », `upToBreak` neither). Task 1 adds the origin phrases to both.
4. **The travel leg moves into a pure planner** (`engine/travel.ts`, `planTravelLeg` with injected routing and airport lookup). The block in `autofillActions.ts` called the router, the train rule, the flight rule and the notes inline with `from`, so none of the required behaviours (no default origin, said > GPS, airports, day-trip note) was testable without mocking the whole preparation. Behaviour with a known origin is unchanged except the airports (Task 4) and the day-trip note (Task 5).
5. **`abroad` becomes `boolean | null`** (null = unknown origin country). Entry formalities (`entryFees`, a table « pour un voyageur français » of non-French destinations) are kept when `abroad !== false` (unknown origin still lists the Nepal visa, as before); travel insurance at the « abroad » rate only when `abroad === true` (otherwise only the altitude rule adds it).
6. **OurAirports types today**: Olbia (OLB) and Cagliari (CAG) are `large_airport` in the current CSV (the brief said medium); Alghero (AHO) and Chambéry (CMF) are `medium_airport`. Tests use the real types and coordinates (checked on the downloaded CSV, 9 Oct.: 3 244 airports kept, 233 countries, 1 150 large). Node 22 `fetch` ignores `HTTPS_PROXY`: the build script is run with `NODE_USE_ENV_PROXY=1` (checked working in this container), or on a CSV downloaded with `curl`.
7. **Airport names are not displayed anywhere today**: the flight basis text lands in `trip_expenses.metadata.basis` and `summary.transport.basis`, which no component renders (`grep basis` in `*.tsx`: nothing). The screen line shows the IATA pair instead (« vol LYS → OLB à prévoir », Task 4), and OurAirports is credited in the site's data-source list (`src/app/mentions-legales/page.tsx`, `DATA_SOURCES`) — the Compas « Sources » sheet lists per-trip sources from `CompasData` and is edited by lot M; it is left alone. Airport names are used verbatim from the dataset (« Lyon Saint-Exupéry Airport »), as decision 5 says.
8. **Changing the origin after a preparation re-adapts the travel leg**: `ProjectBasis` gets `origin` (« Lyon@45.76,4.84 », ~1 km) with dependencies `transport` and `budget` (Task 2). An older basis without the field never triggers anything (existing rule of `changedFields`).
9. **Day trip**: `days <= 1` (a one-day `journee` has `modules.transport = true` → measured car or train minutes; a `sortie` has no transport module → straight-line × 1.3 at 80 km/h, nothing priced). A flight has no known one-way time (`minutes: 0`): no note.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/features/compas/engine/intent.ts` | `set_origin` schema, rule reading (`readOrigin`, `PLACE_END`), destination never takes the origin, month fix, label, grounding, merge guard; `ApplyOp` `origin` + `planApplication` | 1, 2 |
| `src/lib/ai/features/compasIntent.ts` | AI contract lists `set_origin` | 1 |
| `src/features/compas/server/compasActions.ts` | `RULES_FIRST` + `set_origin`; `compasSetOriginAction` | 1, 2 |
| `src/features/compas/engine/tripContext.ts` | `originOf` (pure reader of `metadata.compas.origin`) | 2 |
| `src/features/compas/engine/dependencies.ts`, `server/compasServer.ts` | `ProjectBasis.origin` → transport + budget | 2 |
| `src/features/compas/components/compasApply.ts` | `runOps` / `inverseOps` for `origin` | 2 |
| `src/features/compas/server/getCompasData.ts` | `CompasData.originName` | 2 |
| `scripts/compas/build-airports.mjs` (new) | Downloads/reads OurAirports CSV, writes the JSON + meta | 3 |
| `src/features/compas/data/airports.json`, `airports.meta.json` (new, generated) | 3 244 served airports | 3 |
| `src/features/compas/engine/airports.ts` (new) | Pure scorer `nearestAirportIn` | 3 |
| `src/features/compas/server/airports.ts` (new) | `import 'server-only'`; `nearestAirport(lat, lon, opts?)` | 3 |
| `src/features/compas/engine/travel.ts` (new) | Origin precedence, `planTravelLeg`, flight via airports, texts, screen digest, day-trip note | 4, 5 |
| `src/features/compas/server/autofillActions.ts` | « 5. Venir » wired to `planTravelLeg`; AI facts; flight km; abroad tri-state; summary flag | 4 |
| `src/features/compas/components/CompasScreen.tsx` | Transport line from `travelDigest` | 4 |
| `src/app/mentions-legales/page.tsx` | OurAirports credit | 5 |
| `docs/compas/PLAN-100.md`, `docs/compas/ETAT.md` | §4.3 three boxes, §4.4 third box, lot N line | 5 |

---

### Task 1: Comprendre « depuis X » (`set_origin`)

**Files:**
- Modify: `src/features/compas/engine/intent.ts` (schema ~line 92, `upToBreak` ~291, `notAPlace` ~308, `COMMON_PLACE_WORDS` ~348, `parseIntentRules` destination blocks ~691-829, `groundingIssue` ~918, `actionLabel` ~994, `mergeActions` ~1039)
- Modify: `src/lib/ai/features/compasIntent.ts` (`CONTRACT` ~112, `buildCompasIntentSystem` ~128)
- Modify: `src/features/compas/server/compasActions.ts` (`RULES_FIRST`, just after `compasInterpretAction`)
- Create: `src/features/compas/__tests__/intentOrigin.test.ts`
- Create: `src/features/compas/__tests__/originInterpret.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `CompasIntentAction` gains the member `{ type: 'set_origin'; place: string }` (zod: `z.string().trim().min(1).max(80)`), exported through `intentActionSchema` / `CompasIntentAction` in `engine/intent.ts`.
  - `parseIntentRules(text, today)` may return `{ type: 'set_origin', place }` (pushed just before the destination actions).
  - `actionLabel({ type: 'set_origin', place: 'Lyon' })` → `'Départ : Lyon'`.
  - `groundingIssue` refuses a `set_origin` absent from the phrase with `'Lieu absent de ta phrase'`.
  - `mergeActions(ai, rules)` drops an AI `set_destination` whose place equals (normalised) a rules `set_origin` place.
  - `RULES_FIRST` (private, `server/compasActions.ts`) contains `'set_origin'`.
  - `planApplication` ignores `set_origin` in this task (Task 2 adds the op).

- [ ] **Step 1: Write the failing rule and contract tests**

Create `src/features/compas/__tests__/intentOrigin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  groundingIssue,
  intentActionSchema,
  mergeActions,
  parseIntentRules,
  validateActions,
  type IntentContext,
} from '../engine/intent';
import { buildCompasIntentSystem, parseCompasIntentOutput } from '@/lib/ai/features/compasIntent';

// Vendredi 9 octobre 2026.
const TODAY = '2026-10-09';
const ctx: IntentContext = {
  today: TODAY,
  startDate: null,
  endDate: null,
  engaged: 0,
  currency: 'EUR',
  avoid: [],
  wishes: [],
};
/** Départ et destination lus par les règles, dans l'ordre. */
const places = (text: string) =>
  parseIntentRules(text, TODAY).filter((a) => a.type === 'set_origin' || a.type === 'set_destination');

describe('« depuis X » : le lieu de départ, jamais la destination', () => {
  it('« rando 3 jours dans le Vercors depuis Lyon » : destination Vercors, départ Lyon', () => {
    const a = parseIntentRules('rando 3 jours dans le Vercors depuis Lyon', TODAY);
    expect(a).toContainEqual({ type: 'set_destination', place: 'Vercors' });
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(a).not.toContainEqual({ type: 'set_destination', place: 'Lyon' });
    expect(a).not.toContainEqual({ type: 'set_destination', place: 'Vercors depuis Lyon' });
    expect(a).toContainEqual({ type: 'search_route', query: 'Vercors' });
  });

  it('« au départ de Genève » → départ Genève, aucune destination', () => {
    expect(places('au départ de Genève')).toEqual([{ type: 'set_origin', place: 'Genève' }]);
  });

  it('le dernier recours ne prend plus le lieu de départ pour la destination', () => {
    expect(places('rando 3 jours depuis Lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('ski 2 jours depuis Lyon avec Paul')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('les quatre tournures, l’article et l’élision', () => {
    expect(places('trek 5 jours en Sardaigne au départ de Lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Sardaigne' },
    ]);
    expect(places('week-end en Corse en partant de Marseille')).toEqual([
      { type: 'set_origin', place: 'Marseille' },
      { type: 'set_destination', place: 'Corse' },
    ]);
    expect(places('on part de Grenoble pour 2 jours dans le Vercors')).toEqual([
      { type: 'set_origin', place: 'Grenoble' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places("rando dans le Vercors au départ d'Annecy")).toEqual([
      { type: 'set_origin', place: 'Annecy' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places('trek en Islande depuis la Suisse')).toEqual([
      { type: 'set_origin', place: 'Suisse' },
      { type: 'set_destination', place: 'Islande' },
    ]);
    expect(places('rando au départ du Grand-Bornand')).toEqual([{ type: 'set_origin', place: 'Grand-Bornand' }]);
    expect(places('depuis Lyon, 3 jours en Ardèche')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Ardèche' },
    ]);
  });

  it('phrase tapée sans majuscule : « depuis lyon » ; « depuis longtemps » n’est pas un lieu', () => {
    expect(places('rando 3 jours dans le vercors depuis lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places('rando dans les vosges depuis longtemps')).toEqual([
      { type: 'set_destination', place: 'Vosges' },
    ]);
  });

  it('CONTRE-EXEMPLES : « depuis 3 ans », « depuis Noël » ne sont pas des départs', () => {
    expect(places('depuis 3 ans je rêve du Népal')).toEqual([{ type: 'set_destination', place: 'Népal' }]);
    expect(places('rando depuis Noël')).toEqual([]);
  });

  it('un nom qui commence comme un mois reste un lieu (« Marseille », « Octon »), un mois non', () => {
    expect(places('week-end à Marseille')).toEqual([{ type: 'set_destination', place: 'Marseille' }]);
    expect(places('trek à Octon')).toEqual([{ type: 'set_destination', place: 'Octon' }]);
    expect(places('5 jours en avril à 3')).toEqual([]);
  });
});

describe('l’action set_origin', () => {
  it('schéma : un nom de 1 à 80 caractères', () => {
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'Lyon' }).success).toBe(true);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: ' ' }).success).toBe(false);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'x'.repeat(81) }).success).toBe(false);
  });

  it('libellé « Départ : X », proposé tel quel', () => {
    expect(actionLabel({ type: 'set_origin', place: 'Lyon' })).toBe('Départ : Lyon');
    const [p] = validateActions([{ action: { type: 'set_origin', place: 'Genève' }, source: 'regles' }], ctx);
    expect(p).toMatchObject({ ok: true, label: 'Départ : Genève', reason: null });
  });

  it('ancrage : un départ absent de la phrase est refusé', () => {
    expect(groundingIssue({ type: 'set_origin', place: 'Lyon' }, 'rando depuis Lyon')).toBeNull();
    expect(groundingIssue({ type: 'set_origin', place: 'Paris' }, 'rando depuis Lyon')).toBe('Lieu absent de ta phrase');
  });

  it('l’IA ne fait pas du lieu de départ dit la destination', () => {
    const rules = parseIntentRules('rando 3 jours depuis Lyon', TODAY);
    const merged = mergeActions([{ type: 'set_destination', place: 'Lyon' }], rules).map((m) => m.action);
    expect(merged).not.toContainEqual({ type: 'set_destination', place: 'Lyon' });
    expect(merged).toContainEqual({ type: 'set_origin', place: 'Lyon' });
  });
});

describe('contrat de l’IA', () => {
  it('liste set_origin et dit que « depuis Lyon » est un départ', () => {
    const system = buildCompasIntentSystem();
    expect(system).toContain('{"type": "set_origin", "place":');
    expect(system).toMatch(/« depuis Lyon ».*= set_origin/);
    expect(parseCompasIntentOutput({ actions: [{ type: 'set_origin', place: 'Lyon' }] })).toEqual([
      { type: 'set_origin', place: 'Lyon' },
    ]);
  });
});
```

- [ ] **Step 2: Write the failing server test (rules first for the origin)**

Create `src/features/compas/__tests__/originInterpret.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « depuis X » de bout en bout dans la compréhension : les règles lisent le
 * départ, l'IA ne le remplace pas (RULES_FIRST) et ne le prend pas pour la
 * destination.
 */
const h = vi.hoisted(() => ({ aiText: '{"actions": []}' }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  const supabase = { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) };
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase,
      userId: 'u1',
      trip: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'u1',
        title: 'Rando · nouvelle aventure',
        start_date: null,
        end_date: null,
        party_size: 1,
        budget_currency: 'EUR',
        metadata: {},
      },
    })),
  };
});
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({ text: h.aiText, model: 'x', degraded: false, cached: false, provider: 'nvidia' })),
}));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));

import { compasInterpretAction } from '../server/compasActions';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('compréhension : « depuis X »', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
  });

  it('sans IA utile : départ Lyon et destination Vercors, proposés et valides', async () => {
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors depuis Lyon' });
    if (!res.success) throw new Error(res.error);
    const ok = res.proposals.filter((p) => p.ok).map((p) => p.action);
    expect(ok).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(ok).toContainEqual({ type: 'set_destination', place: 'Vercors' });
    expect(res.proposals.find((p) => p.action.type === 'set_origin')?.label).toBe('Départ : Lyon');
  });

  it('l’IA ne remplace pas le départ lu par les règles, ni n’en fait la destination', async () => {
    h.aiText = JSON.stringify({
      actions: [
        { type: 'set_origin', place: 'Paris' },
        { type: 'set_destination', place: 'Lyon' },
      ],
    });
    const res = await compasInterpretAction({
      tripId: TRIP,
      text: 'rando 3 jours dans le Vercors depuis Lyon, retour à Paris',
    });
    if (!res.success) throw new Error(res.error);
    const actions = res.proposals.map((p) => p.action);
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(actions.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Vercors' }]);
  });
});
```

(After lot M, `compasInterpretAction` also accepts an optional `timeZone`; these calls omit it on purpose — the default zone applies.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/intentOrigin.test.ts src/features/compas/__tests__/originInterpret.test.ts`
Expected: FAIL — `set_origin` is not in the schema (safeParse false, no `set_origin` action), « Vercors depuis Lyon » is read as the destination, « Lyon » is taken by the last-resort fallback, « Marseille » is read as a month.

- [ ] **Step 4: Schema — add `set_origin`**

In `src/features/compas/engine/intent.ts`, replace:

```ts
  z.object({ type: z.literal('set_destination'), place: label }),
```

with:

```ts
  z.object({ type: z.literal('set_destination'), place: label }),
  /** Lieu d'où l'on part (« depuis Lyon ») : le trajet d'approche se chiffre depuis là. */
  z.object({ type: z.literal('set_origin'), place: z.string().trim().min(1).max(80) }),
```

- [ ] **Step 5: `upToBreak` stops at « depuis »**

In the same file, replace:

```ts
    /\s(?:et|puis|mais|pour|avec|sans|en|dans|du|le|la|a|au|à|on|depart|départ|des|dès)\s|\s(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|ce|cette|prochain|prochaine)(?=\s|$)|[,.;!?]|\d/i
```

with:

```ts
    /\s(?:et|puis|mais|pour|avec|sans|en|dans|du|le|la|a|au|à|on|depart|départ|des|dès|depuis)\s|\s(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|ce|cette|prochain|prochaine)(?=\s|$)|[,.;!?]|\d/i
```

- [ ] **Step 6: `notAPlace` — a whole month word only**

Replace:

```ts
/** Un mois, un jour de la semaine ou une fête n'est jamais une destination (« à Noël »). */
function notAPlace(name: string): boolean {
  const plain = plainOf(name);
  return monthOf(plain) != null || WEEKDAYS.includes(plain) || HOLIDAY_WORD.test(plain);
}
```

with:

```ts
/**
 * Un mois, un jour de la semaine ou une fête n'est jamais une destination
 * (« à Noël »). Le mois entier seulement : « Marseille », « Juillac » ou
 * « Octon » commencent comme un mois et restent des lieux.
 */
const MONTH_ONLY = new RegExp(`^${MONTH_RE}$`);
function notAPlace(name: string): boolean {
  const plain = plainOf(name);
  return MONTH_ONLY.test(plain) || WEEKDAYS.includes(plain) || HOLIDAY_WORD.test(plain);
}
```

- [ ] **Step 7: `PLACE_END`, `ORIGIN_LEAD`, `readOrigin`**

Replace the `COMMON_PLACE_WORDS` declaration:

```ts
const COMMON_PLACE_WORDS =
  /^(?:bois|foret|forets|montagnes?|campagne|nature|mer|plage|plages|neige|environs|alentours|coin|region|parc|fjords?|calanques?|lacs?|riviere|vallee|ville|famille|couple|groupe|solo|van|velo|pied|cheval|ski|bord|mer|lac|journee|semaine|soiree|matinee|apres-?midi|hiver|ete|automne|printemps)$/;
```

with (`depart|partant` added at the end of the list, then the new declarations):

```ts
const COMMON_PLACE_WORDS =
  /^(?:bois|foret|forets|montagnes?|campagne|nature|mer|plage|plages|neige|environs|alentours|coin|region|parc|fjords?|calanques?|lacs?|riviere|vallee|ville|famille|couple|groupe|solo|van|velo|pied|cheval|ski|bord|mer|lac|journee|semaine|soiree|matinee|apres-?midi|hiver|ete|automne|printemps|depart|partant)$/;

/**
 * Fin d'un nom de lieu : un mot qui ouvre une autre idée (durée, date,
 * compagnie, lieu de départ). « du », « le », « la » ne coupent que devant un
 * nombre (« Afrique du Sud », mais « Vercors du 3 au 10 juin »).
 */
const PLACE_END =
  /\s(?:(?:du|le|la|les)(?=\s+(?:\d|mois\b|semaine\b|prochaine?\b))|pour|avec|en|a|à|à partir|pendant|durant|sur|et|sans|budget|plage|plages|temples?|musees?|fjords?|autour|via|pas|safari|un|une|deux|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|cette|ce|tout|toute|semaines?|jours?|nuits?|days?|weeks?|nights?|for|from|to|until|week[- ]?end|début|debut|mi|fin|noël|noel|pâques|paques|toussaint|demain|après-demain|apres-demain|aujourd['’]hui|prochain|prochaine|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|depuis|au départ|au depart|en partant|on part|je pars|nous partons)(?=[\s-]|$)/i;

/** Ce qui annonce le lieu de départ : « depuis Lyon », « au départ de Genève », « en partant d'Annecy ». */
const ORIGIN_LEAD =
  /(?:^|[\s,(])(?:depuis|(?:au depart|en partant|on part|je pars|nous partons) (?:de|du|des|d'))(?:\s+|(?<='))/g;

/** Après « depuis » dans une phrase sans majuscule : un moment ou un déterminant, pas un lieu. */
const NOT_ORIGIN =
  /^(?:longtemps|toujours|hier|chez|que|qu|quand|ici|maison|debut|peu|des|plusieurs|quelques|ce|cet|cette|ces|mon|ma|mes|notre|nos|la|le|les)$/;

/**
 * Lieu de départ dit dans la phrase (« depuis Lyon », « depuis la Suisse »,
 * « au départ du Grand-Bornand ») et sa place dans `src`, pour que la
 * destination ne le reprenne jamais. Nom propre seulement ; dans une phrase
 * tapée sans majuscule, le mot qui suit s'il n'est ni un moment ni un nom commun.
 * `plain` est `src` normalisé, aux mêmes positions.
 */
function readOrigin(src: string, plain: string): { place: string; start: number; end: number } | null {
  const lower = !/\p{Lu}/u.test(src);
  for (const m of plain.matchAll(ORIGIN_LEAD)) {
    let at = (m.index ?? 0) + m[0].length;
    // « depuis la Suisse » : l'article en minuscule tombe ; « depuis Le Puy » le garde.
    const article = /^(?:(?:la|le|les)\s+|l['’]\s*)/.exec(src.slice(at));
    if (article && !/^\p{Lu}/u.test(src.slice(at))) at += article[0].length;
    const original = src.slice(at, at + 60);
    if (properLead(original)) {
      // « depuis GR20 » : un code de sentier, pas un lieu de départ.
      if (/^\p{Lu}{1,4}\s?\d/u.test(original)) continue;
      const place = clean(original.split(/[,.;!?\d]/)[0].split(PLACE_END)[0], 50).replace(
        /\s+(?:dans|in|sur|vers|près|pres)$/i,
        ''
      );
      if (place.length >= 2 && !notAPlace(place)) return { place, start: at, end: at + place.length };
      continue;
    }
    if (!lower) continue;
    const low = /^([a-z][a-z'-]{2,}(?:\s(?!(?:pour|avec|en|a|et|du|de|des|le|la|les|sans|dans|ce|cet|cette|demain|apres-demain|aujourd'hui|prochain|prochaine|matin|soir|vers|depuis)\b)[a-z][a-z'-]{2,})?)/.exec(
      plain.slice(at, at + 60)
    );
    const words = low ? low[1].trim() : '';
    const first = words.split(/\s/)[0];
    if (!words || NOT_ORIGIN.test(first) || COMMON_PLACE_WORDS.test(first) || toNumber(first) != null || notAPlace(words))
      continue;
    return { place: words.split(/\s/).map(capitalized).join(' '), start: at, end: at + words.length };
  }
  return null;
}
```

- [ ] **Step 8: Read the origin first; the destination never takes it**

In `parseIntentRules`, replace:

```ts
  /* Destination : « au Népal », « en Islande », « à Chamonix » (nom propre) */
```

with:

```ts
  /* Lieu de départ : « depuis Lyon », « au départ de Genève ». Lu avant la
     destination, qui ne le reprend jamais (« rando dans le Vercors depuis Lyon »). */
  const origin = readOrigin(src, plain);
  const inOrigin = (i: number) => origin != null && i >= origin.start && i < origin.end;
  if (origin) out.push({ type: 'set_origin', place: origin.place });

  /* Destination : « au Népal », « en Islande », « à Chamonix » (nom propre) */
```

Then, in the destination loop right below, replace:

```ts
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original)) continue;
    // « sur le GR20 » : un code de sentier, pas une destination.
```

with:

```ts
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original) || inOrigin(at)) continue;
    // « sur le GR20 » : un code de sentier, pas une destination.
```

and replace the inline end-of-name split (same loop):

```ts
    const place = clean(
      original.split(/[,.;!?\d]/)[0].split(
        // Fin du nom : un mot qui ouvre une autre idée (durée, date, compagnie).
        // « du », « le », « la » ne coupent que devant un nombre (« Afrique du Sud »,
        // mais « Vercors du 3 au 10 juin »).
        /\s(?:(?:du|le|la|les)(?=\s+(?:\d|mois\b|semaine\b|prochaine?\b))|pour|avec|en|a|à|à partir|pendant|durant|sur|et|sans|budget|plage|plages|temples?|musees?|fjords?|autour|via|pas|safari|un|une|deux|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|cette|ce|tout|toute|semaines?|jours?|nuits?|days?|weeks?|nights?|for|from|to|until|week[- ]?end|début|debut|mi|fin|noël|noel|pâques|paques|toussaint|demain|après-demain|apres-demain|aujourd['’]hui|prochain|prochaine|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?=[\s-]|$)/i
      )[0],
      50
    )
```

with:

```ts
    // Coupé au premier mot d'une autre idée (`PLACE_END`), « depuis Lyon » compris.
    const place = clean(original.split(/[,.;!?\d]/)[0].split(PLACE_END)[0], 50)
```

(the two lines that follow — the « Norvège dans les fjords » comment and `.replace(/\s+(?:dans|in|sur|vers|près|pres)$/i, '');` — stay as they are).

In the « Dernier recours » block, replace:

```ts
    for (const m of src.matchAll(/(?<!\b(?:avec|et|chez|pour|par|mon|ma|mes|ton|ta|copain|copine|ami|amie)\s)(?<=\s)(\p{Lu}[\p{L}'’-]+(?:[\s-]+\p{Lu}[\p{L}'’-]+)*)/gu)) {
      const name = clean(m[1], 50);
```

with:

```ts
    for (const m of src.matchAll(/(?<!\b(?:avec|et|chez|pour|par|mon|ma|mes|ton|ta|copain|copine|ami|amie)\s)(?<=\s)(\p{Lu}[\p{L}'’-]+(?:[\s-]+\p{Lu}[\p{L}'’-]+)*)/gu)) {
      // Le lieu de départ n'est jamais la destination (« rando 3 jours depuis Lyon »).
      if (inOrigin(m.index ?? 0)) continue;
      const name = clean(m[1], 50);
```

In the « Phrase tapée sans majuscule » block, replace:

```ts
    const low = /\b(?:dans l'\s*|(?:dans les|dans le|dans la|en|au|aux|a|vers|pres de)\s+)([a-z][a-z'-]{2,}(?:\s(?!(?:pour|avec|en|a|et|du|de|des|le|la|les|sans|dans|ce|cet|cette|demain|apres-demain|aujourd'hui|prochain|prochaine|matin|soir)\b)[a-z][a-z'-]{2,})?)/.exec(plain);
```

with (`|depuis` added to the negative list):

```ts
    const low = /\b(?:dans l'\s*|(?:dans les|dans le|dans la|en|au|aux|a|vers|pres de)\s+)([a-z][a-z'-]{2,}(?:\s(?!(?:pour|avec|en|a|et|du|de|des|le|la|les|sans|dans|ce|cet|cette|demain|apres-demain|aujourd'hui|prochain|prochaine|matin|soir|depuis)\b)[a-z][a-z'-]{2,})?)/.exec(plain);
```

In the « Lieu → recherche de parcours » loop, replace:

```ts
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original)) continue;
    const lead = /^\p{Lu}/u.test(original) ? '' : (PLACE_NOUN.exec(original)?.[0] ?? '');
```

with:

```ts
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original) || inOrigin(at)) continue;
    const lead = /^\p{Lu}/u.test(original) ? '' : (PLACE_NOUN.exec(original)?.[0] ?? '');
```

- [ ] **Step 9: Grounding, label, merge guard**

In `groundingIssue`, replace:

```ts
    case 'set_destination':
      return tokensIn(text, action.place) ? null : 'Lieu absent de ta phrase';
```

with:

```ts
    case 'set_destination':
    case 'set_origin':
      return tokensIn(text, action.place) ? null : 'Lieu absent de ta phrase';
```

In `actionLabel`, replace:

```ts
    case 'set_destination':
      return `Destination : ${action.place}`;
```

with:

```ts
    case 'set_destination':
      return `Destination : ${action.place}`;
    case 'set_origin':
      return `Départ : ${action.place}`;
```

In `mergeActions`, replace:

```ts
  const placed = ai.map((a) => (a.type === 'set_destination' ? { ...a, place: trailRegion(a.place) ?? a.place } : a));
```

with:

```ts
  // Le lieu de départ lu par les règles (« depuis Lyon ») n'est jamais la
  // destination, même si l'IA le donne comme tel.
  const origins = new Set(rules.filter((a) => a.type === 'set_origin').map((a) => plainOf((a as { place: string }).place)));
  const placed = ai
    .filter((a) => !(a.type === 'set_destination' && origins.has(plainOf(a.place))))
    .map((a) => (a.type === 'set_destination' ? { ...a, place: trailRegion(a.place) ?? a.place } : a));
```

- [ ] **Step 10: AI contract**

In `src/lib/ai/features/compasIntent.ts`, replace:

```ts
  '  {"type": "set_destination", "place": "pays, region, massif ou ville ou l on part, tel qu ecrit dans la phrase"}',
```

with:

```ts
  '  {"type": "set_destination", "place": "pays, region, massif ou ville ou l on va, tel qu ecrit dans la phrase"},',
  '  {"type": "set_origin", "place": "ville ou lieu d ou la personne part, tel qu ecrit dans la phrase"}',
```

and replace:

```ts
    '7. Phrase vide de demande : {"actions": []}.',
```

with:

```ts
    '7. « depuis Lyon », « au depart de Geneve », « en partant d Annecy » = set_origin (le lieu d ou l on part), jamais set_destination.',
    '8. Phrase vide de demande : {"actions": []}.',
```

- [ ] **Step 11: Rules first for the origin**

In `src/features/compas/server/compasActions.ts`, replace:

```ts
 * exact, celui du modèle non (« dans 3 semaines » posé au 23 octobre au lieu
 * du 30, aperçu du 9 oct.).
 */
const RULES_FIRST = new Set<CompasIntentAction['type']>(['set_activity', 'set_duration', 'set_budget', 'set_dates']);
```

with:

```ts
 * exact, celui du modèle non (« dans 3 semaines » posé au 23 octobre au lieu
 * du 30, aperçu du 9 oct.). Le lieu de départ : « depuis Lyon » lu par les
 * règles n'est jamais remplacé par une ville que le modèle aurait choisie.
 */
const RULES_FIRST = new Set<CompasIntentAction['type']>(['set_activity', 'set_duration', 'set_budget', 'set_dates', 'set_origin']);
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/intentOrigin.test.ts src/features/compas/__tests__/originInterpret.test.ts`
Expected: PASS (12 + 2 tests).

Run the neighbouring suites (the destination reader is shared): `npx vitest run src/features/compas/__tests__/intent.test.ts src/features/compas/__tests__/universal.test.ts src/features/compas/__tests__/fuzz.test.ts src/features/compas/__tests__/intentWords.test.ts src/features/compas/__tests__/projectContext.test.ts src/features/compas/__tests__/activities.test.ts src/features/compas/__tests__/request.test.ts src/features/compas/__tests__/actionLimits.test.ts`
Expected: PASS, no existing assertion changed.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no error (the new union member is handled by every exhaustive `switch`: `actionLabel` has its case; `groundingIssue`, `key`, `planApplication` have a `default`).

- [ ] **Step 13: Commit**

```bash
git add src/features/compas/engine/intent.ts src/lib/ai/features/compasIntent.ts src/features/compas/server/compasActions.ts src/features/compas/__tests__/intentOrigin.test.ts src/features/compas/__tests__/originInterpret.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): « depuis X » compris comme lieu de départ (set_origin)

Les règles lisent « depuis Lyon », « au départ de Genève », « en partant
de », « on part de » ; la destination ne reprend plus ce lieu (« Vercors
depuis Lyon », dernier recours). Un nom qui commence comme un mois reste
un lieu (Marseille). Contrat de l'IA et RULES_FIRST à jour.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 2: Appliquer le départ dit (`metadata.compas.origin`)

**Files:**
- Modify: `src/features/compas/engine/tripContext.ts` (new `TripOrigin` + `originOf`, before `TripContextInput`)
- Modify: `src/features/compas/engine/dependencies.ts` (`ProjectBasis`, `DEPENDS`, `projectBasis`)
- Modify: `src/features/compas/server/compasServer.ts` (import, `tripBasis`)
- Modify: `src/features/compas/engine/intent.ts` (`ApplyOp`, `planApplication`)
- Modify: `src/features/compas/server/compasActions.ts` (import `coarsePosition`; new `compasSetOriginAction` before `spanSchema`)
- Modify: `src/features/compas/components/compasApply.ts` (import, `runOps`, `inverseOps`)
- Modify: `src/features/compas/server/getCompasData.ts` (import, `CompasData.originName`, `compasPlan`)
- Create: `src/features/compas/__tests__/originApply.test.ts`
- Create: `src/features/compas/__tests__/originAction.test.ts`

**Interfaces:**
- Consumes (Task 1): intent action `{ type: 'set_origin'; place: string }`.
- Produces:
  - `engine/tripContext.ts`: `export interface TripOrigin { name: string; lat: number; lon: number; countryCode: string | null; source: 'dit' }` and `export function originOf(raw: unknown): TripOrigin | null` (reads `metadata.compas.origin`; null when name empty, lat/lon missing or out of range; `countryCode` upper-cased, null unless 2 letters).
  - Stored shape: `trips.metadata.compas.origin = { name, lat, lon, countryCode, source: 'dit' }`, lat/lon rounded to 0.01° by `coarsePosition`.
  - `server/compasActions.ts`: `export async function compasSetOriginAction(input: { tripId: string; tripSlug: string; place: string | null }): Promise<CompasActionResult>`.
  - `engine/intent.ts`: `ApplyOp` member `{ op: 'origin'; place: string | null }`; `planApplication` pushes it for a `set_origin` action.
  - `engine/dependencies.ts`: `ProjectBasis.origin: string | null` (`"Name@lat.toFixed(2),lon.toFixed(2)"`), `projectBasis` input `origin?: { name: string; lat: number; lon: number } | null`, `DEPENDS.origin = ['transport', 'budget']`.
  - `server/getCompasData.ts`: `CompasData.originName?: string | null`.

- [ ] **Step 1: Write the failing pure tests**

Create `src/features/compas/__tests__/originApply.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { originOf } from '../engine/tripContext';
import { projectBasis, staleParts } from '../engine/dependencies';
import { parseIntentRules, planApplication, type ApplyCurrent } from '../engine/intent';
import { inverseOps } from '../components/compasApply';
import type { CompasCtl } from '../components/compasTypes';

const current: ApplyCurrent = {
  startDate: null,
  endDate: null,
  days: null,
  shortHours: null,
  preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
  hasRoute: false,
};

describe('lieu de départ rangé sur le voyage', () => {
  it('lecture défensive de metadata.compas.origin', () => {
    expect(originOf({ name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'fr', source: 'dit' })).toEqual({
      name: 'Lyon',
      lat: 45.76,
      lon: 4.83,
      countryCode: 'FR',
      source: 'dit',
    });
    expect(originOf({ name: 'Lyon', lat: 45.76, lon: 4.83 })).toMatchObject({ countryCode: null });
    expect(originOf(null)).toBeNull();
    expect(originOf({ name: '', lat: 45.76, lon: 4.83 })).toBeNull();
    expect(originOf({ name: 'Lyon', lat: null, lon: 4.83 })).toBeNull();
    expect(originOf({ name: 'Lyon', lat: 145, lon: 4.83 })).toBeNull();
    expect(originOf('Lyon')).toBeNull();
  });
});

describe('appliquer « depuis Lyon »', () => {
  it('une opération « origin » à côté de la destination', () => {
    const ops = planApplication(parseIntentRules('rando 3 jours dans le Vercors depuis Lyon', '2026-10-09'), current);
    expect(ops[0]).toEqual({ op: 'destination', place: 'Vercors' });
    expect(ops).toContainEqual({ op: 'origin', place: 'Lyon' });
    expect(ops.filter((o) => o.op === 'destination')).toHaveLength(1);
  });

  it('« Annuler » rétablit le départ d’avant, ou l’efface s’il n’y en avait pas', () => {
    const ctl = (originName: string | null) =>
      ({
        data: {
          originName,
          model: { dates: { start: null, end: null, hours: null, days: null }, preferences: current.preferences },
        },
      }) as unknown as CompasCtl;
    expect(inverseOps(ctl('Grenoble'), [{ op: 'origin', place: 'Lyon' }])).toEqual([{ op: 'origin', place: 'Grenoble' }]);
    expect(inverseOps(ctl(null), [{ op: 'origin', place: 'Lyon' }])).toEqual([{ op: 'origin', place: null }]);
  });
});

describe('changer de départ refait le trajet et le budget, rien d’autre', () => {
  const basis = (origin: { name: string; lat: number; lon: number } | null) =>
    projectBasis({
      anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 },
      destinationName: 'Vercors',
      days: 3,
      hours: null,
      startDate: '2027-06-01',
      activity: 'hiking',
      partySize: 2,
      prefs: null,
      origin,
    });

  it('empreinte arrondie à ~1 km', () => {
    expect(basis({ name: 'Lyon', lat: 45.7578, lon: 4.832 }).origin).toBe('Lyon@45.76,4.83');
    expect(basis(null).origin).toBeNull();
  });

  it('Lyon → Grenoble, ou départ dit après coup : trajet et budget', () => {
    const lyon = basis({ name: 'Lyon', lat: 45.76, lon: 4.83 });
    expect(staleParts(lyon, basis({ name: 'Grenoble', lat: 45.19, lon: 5.72 }))).toEqual(['transport', 'budget']);
    expect(staleParts(basis(null), lyon)).toEqual(['transport', 'budget']);
    expect(staleParts(lyon, lyon)).toEqual([]);
  });

  it('une empreinte d’avant ce lot (sans départ) ne déclenche rien', () => {
    const old = { ...basis(null) } as Record<string, unknown>;
    delete old.origin;
    expect(staleParts(old, basis({ name: 'Lyon', lat: 45.76, lon: 4.83 }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing server-action test**

Create `src/features/compas/__tests__/originAction.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « depuis Lyon » appliqué : le lieu est retrouvé sur la carte comme la
 * destination (même limite, mêmes messages), rangé arrondi à ~1 km dans
 * `metadata.compas.origin` sans toucher aux autres réglages, et s'efface.
 */
const h = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  calls: [] as Array<{ scope: string; limit: number; windowMs: number; failMode?: string }>,
  refuse: null as null | number,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string; limit: number; windowMs: number; failMode?: string }) => {
    h.calls.push({ scope: config.scope, limit: config.limit, windowMs: config.windowMs, failMode: config.failMode });
    return h.refuse ? new Response(null, { status: h.refuse }) : null;
  }),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase: {},
      userId: 'u1',
      trip: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'u1',
        title: 'Rando · Vercors',
        start_date: null,
        end_date: null,
        party_size: 1,
        budget_currency: 'EUR',
        metadata: h.meta,
      },
    })),
    updateTripMetadata: vi.fn(async (_s: unknown, _id: string, patch: (m: Record<string, unknown>) => Record<string, unknown>) => {
      h.meta = patch(h.meta);
      return { metadata: h.meta, error: null };
    }),
  };
});
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) =>
    q === 'Lyon'
      ? { name: 'Lyon', lat: 45.757813, lon: 4.832011, countryCode: 'FR', country: 'France', kind: 'city', extent: null }
      : null
  ),
  lookupBase: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));

import { compasSetOriginAction } from '../server/compasActions';
import { lookupDestination } from '../server/placeLookup';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('compasSetOriginAction', () => {
  beforeEach(() => {
    h.meta = { route_id: 12, compas: { anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 }, prefs: { pace: 'tranquille' } } };
    h.calls = [];
    h.refuse = null;
    vi.clearAllMocks();
  });

  it('range le départ arrondi à 0,01°, sans toucher au reste des réglages', async () => {
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' })).toEqual({ success: true });
    expect(h.meta).toEqual({
      route_id: 12,
      compas: {
        anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 },
        prefs: { pace: 'tranquille' },
        origin: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' },
      },
    });
  });

  it('même limite que la destination : 20 par 10 min, fermée', async () => {
    await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' });
    expect(h.calls).toEqual([{ scope: 'compas-destination', limit: 20, windowMs: 600_000, failMode: 'closed' }]);
  });

  it('limite atteinte : message clair, aucune recherche, rien d’écrit', async () => {
    h.refuse = 429;
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' })).toEqual({
      success: false,
      error: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.',
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
  });

  it('lieu inconnu de la carte : refusé, jamais deviné', async () => {
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Atlantide' })).toEqual({
      success: false,
      error: '« Atlantide » introuvable sur la carte.',
    });
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
  });

  it('effacer (null ou vide) retire le départ sans rien chercher ni compter', async () => {
    (h.meta.compas as Record<string, unknown>).origin = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: null })).toEqual({ success: true });
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
    expect((h.meta.compas as Record<string, unknown>).anchor).toEqual({ name: 'Vercors', lat: 45.07, lon: 5.55 });
    (h.meta.compas as Record<string, unknown>).origin = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: '  ' })).toEqual({ success: true });
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
    expect(h.calls).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
  });

  it('entrée invalide refusée par le schéma', async () => {
    expect(await compasSetOriginAction({ tripId: 'pas-un-uuid', tripSlug: 'x', place: 'Lyon' })).toEqual({
      success: false,
      error: 'Lieu invalide',
    });
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'x'.repeat(81) })).toEqual({
      success: false,
      error: 'Lieu invalide',
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/originApply.test.ts src/features/compas/__tests__/originAction.test.ts`
Expected: FAIL — `originOf` and `compasSetOriginAction` are not exported, `planApplication` gives no `origin` op, `projectBasis(...).origin` is undefined.

- [ ] **Step 4: `originOf` (pure reader)**

In `src/features/compas/engine/tripContext.ts`, replace:

```ts
export interface TripContextInput {
```

with:

```ts
/** Lieu de départ dit (« depuis Lyon »), rangé dans `metadata.compas.origin`. */
export interface TripOrigin {
  name: string;
  /** Arrondis à 0,01° (~1 km) à l'écriture : jamais un point plus fin. */
  lat: number;
  lon: number;
  countryCode: string | null;
  source: 'dit';
}

/** Départ dit lu depuis `metadata.compas.origin` (lecture défensive), sinon null. */
export function originOf(raw: unknown): TripOrigin | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const lat = Number(o.lat);
  const lon = Number(o.lon);
  if (!name || o.lat == null || o.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const cc = typeof o.countryCode === 'string' ? o.countryCode.trim().toUpperCase() : '';
  return { name: name.slice(0, 80), lat, lon, countryCode: /^[A-Z]{2}$/.test(cc) ? cc : null, source: 'dit' };
}

export interface TripContextInput {
```

- [ ] **Step 5: The origin in the project basis (re-adapt transport + budget)**

In `src/features/compas/engine/dependencies.ts`, replace:

```ts
  terrain: string | null;
  targetKm: number | null;
}
```

with:

```ts
  terrain: string | null;
  targetKm: number | null;
  /** Lieu de départ dit (« Lyon@45.76,4.84 »), null sans départ dit. */
  origin: string | null;
}
```

replace:

```ts
  terrain: ['steps', 'budget'],
  targetKm: ['steps', 'budget'],
};
```

with:

```ts
  terrain: ['steps', 'budget'],
  targetKm: ['steps', 'budget'],
  // Partir d'ailleurs change le trajet d'approche, donc le budget ; rien d'autre.
  origin: ['transport', 'budget'],
};
```

replace:

```ts
    targetKm?: number | null;
  } | null;
}): ProjectBasis {
```

with:

```ts
    targetKm?: number | null;
  } | null;
  /** Lieu de départ dit (`metadata.compas.origin`), s'il y en a un. */
  origin?: { name: string; lat: number; lon: number } | null;
}): ProjectBasis {
```

and replace:

```ts
    terrain: p.terrain ?? null,
    targetKm: p.targetKm ?? null,
  };
}
```

with:

```ts
    terrain: p.terrain ?? null,
    targetKm: p.targetKm ?? null,
    origin: input.origin
      ? `${input.origin.name}@${input.origin.lat.toFixed(2)},${input.origin.lon.toFixed(2)}`
      : null,
  };
}
```

In `src/features/compas/server/compasServer.ts`, replace:

```ts
import { partySizeOf, tripContextFromRow } from '../engine/tripContext';
```

with:

```ts
import { originOf, partySizeOf, tripContextFromRow } from '../engine/tripContext';
```

and in `tripBasis` replace:

```ts
    partySize: trip.party_size,
    prefs: compas.preferences,
  });
}
```

with:

```ts
    partySize: trip.party_size,
    prefs: compas.preferences,
    origin: originOf(compasMeta(meta).origin),
  });
}
```

- [ ] **Step 6: The `origin` apply op**

In `src/features/compas/engine/intent.ts`, replace:

```ts
  | { op: 'destination'; place: string | null }
```

with:

```ts
  | { op: 'destination'; place: string | null }
  /** Lieu de départ dit (« depuis Lyon ») ; null l'efface. */
  | { op: 'origin'; place: string | null }
```

and in `planApplication` replace:

```ts
  if (destination) ops.unshift({ op: 'destination', place: destination.place });
```

with:

```ts
  if (destination) ops.unshift({ op: 'destination', place: destination.place });
  // Le lieu de départ (« depuis Lyon ») : le trajet d'approche se chiffre depuis là.
  const origin = actions.find((a) => a.type === 'set_origin') as
    Extract<CompasIntentAction, { type: 'set_origin' }> | undefined;
  if (origin) ops.push({ op: 'origin', place: origin.place });
```

- [ ] **Step 7: `compasSetOriginAction`**

In `src/features/compas/server/compasActions.ts`, replace:

```ts
import { readCompasMeta } from '../engine/meta';
```

with:

```ts
import { readCompasMeta } from '../engine/meta';
import { coarsePosition } from '../engine/privacy';
```

then replace (the line right after `compasSetDestinationAction`):

```ts
const spanSchema = z.object({
```

with:

```ts
const originSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  /** Lieu de départ tel que dit (« Lyon ») ; null ou vide efface le départ. */
  place: z.string().trim().max(80).nullable(),
});

/**
 * Lieu de départ du voyage (« depuis Lyon »), retrouvé sur la carte comme la
 * destination (même recherche, même limite par personne) et rangé arrondi à
 * ~1 km dans `metadata.compas.origin` : le trajet d'approche se chiffre depuis
 * là, avant la position de l'appareil. Effacer ne cherche rien.
 */
export async function compasSetOriginAction(
  input: z.input<typeof originSchema>
): Promise<CompasActionResult> {
  const parsed = originSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Lieu invalide' };
  const wanted = parsed.data.place || null;
  if (wanted && wanted.length < 2) return { success: false, error: 'Lieu invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    // Même compteur que la destination : la carte (et parfois l'IA) est la même.
    if (wanted) {
      const limited = await enforceRateLimit(auth.userId, {
        scope: 'compas-destination',
        limit: 20,
        windowMs: 600_000,
        failMode: 'closed',
      });
      if (limited)
        return {
          success: false,
          error:
            limited.status === 429
              ? 'Trop de lieux cherchés d’affilée : patiente quelques minutes.'
              : 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.',
        };
    }
    const place = wanted ? await resolveDestination(wanted, auth.userId) : null;
    if (wanted && !place) return { success: false, error: `« ${wanted} » introuvable sur la carte.` };
    const at = place ? coarsePosition({ lat: place.lat, lon: place.lon }) : null;
    const { error } = await updateTripMetadata(auth.supabase, parsed.data.tripId, (m) => {
      const c = compasMeta(m);
      if (place && at)
        c.origin = { name: place.name, lat: at.lat, lon: at.lon, countryCode: place.countryCode, source: 'dit' };
      else delete c.origin;
      return { ...m, compas: c };
    });
    if (error) return { success: false, error: 'Impossible d’enregistrer le lieu de départ.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasSetOriginAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const spanSchema = z.object({
```

(`resolveDestination`, `compasMeta`, `updateTripMetadata`, `enforceRateLimit`, `reportServerError`, `revalidateTrip`, `uuid`, `slug` already exist in this file. `updateTripMetadata` is the lot H atomic write: it re-reads and replays the patch, never overwrites other keys.)

- [ ] **Step 8: Run it from the screen (`runOps`, « Annuler »)**

In `src/features/compas/components/compasApply.ts`, replace:

```ts
  compasSetDestinationAction,
  compasSetSpanAction,
} from '../server/compasActions';
```

with:

```ts
  compasSetDestinationAction,
  compasSetOriginAction,
  compasSetSpanAction,
} from '../server/compasActions';
```

in `runOps` replace:

```ts
      case 'destination':
        res = await compasSetDestinationAction({ tripId, tripSlug: slug, place: op.place });
        break;
```

with:

```ts
      case 'destination':
        res = await compasSetDestinationAction({ tripId, tripSlug: slug, place: op.place });
        break;
      case 'origin':
        res = await compasSetOriginAction({ tripId, tripSlug: slug, place: op.place });
        break;
```

and in `inverseOps` replace:

```ts
      case 'destination':
        out.push({ op: 'destination', place: m.destination ?? null });
        break;
```

with:

```ts
      case 'destination':
        out.push({ op: 'destination', place: m.destination ?? null });
        break;
      case 'origin':
        // Le départ dit d'avant (null : il n'y en avait pas, on l'efface).
        out.push({ op: 'origin', place: ctl.data.originName ?? null });
        break;
```

In `src/features/compas/server/getCompasData.ts`, replace:

```ts
import { partySizeOf, shortHoursOf, tripLengthDays } from '../engine/tripContext';
```

with:

```ts
import { originOf, partySizeOf, shortHoursOf, tripLengthDays } from '../engine/tripContext';
```

replace (in `interface CompasData`):

```ts
  /** Destination retrouvée sur la carte (Dis-le). */
  anchorName?: string | null;
```

with:

```ts
  /** Destination retrouvée sur la carte (Dis-le). */
  anchorName?: string | null;
  /** Lieu de départ dit (« depuis Lyon »), retrouvé sur la carte ; null sans départ dit. */
  originName?: string | null;
```

replace:

```ts
function compasPlan(metadata: unknown): {
  plannedDays: number | null;
  anchorName: string | null;
  startSay: string | null;
} {
```

with:

```ts
function compasPlan(metadata: unknown): {
  plannedDays: number | null;
  anchorName: string | null;
  originName: string | null;
  startSay: string | null;
} {
```

and replace:

```ts
    anchorName: typeof anchor?.name === 'string' ? anchor.name : null,
```

with:

```ts
    anchorName: typeof anchor?.name === 'string' ? anchor.name : null,
    originName: originOf(c.origin)?.name ?? null,
```

(`compasPlan(...)` is already spread into the returned `CompasData`, so `originName` reaches the screen with no other change.)

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/originApply.test.ts src/features/compas/__tests__/originAction.test.ts`
Expected: PASS (12 tests).

Run: `npx vitest run src/features/compas/__tests__/dependencies.test.ts src/features/compas/__tests__/inverseOps.test.ts src/features/compas/__tests__/intent.test.ts src/features/compas/__tests__/universal.test.ts src/features/compas/__tests__/projectContext.test.ts src/features/compas/__tests__/actionLimits.test.ts src/features/compas/__tests__/tripContext.test.ts src/features/compas/__tests__/compasScreen.test.tsx`
Expected: PASS, no existing assertion changed.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no error (`runOps` assigns `res` in every case, `ProjectBasis` literal in `projectBasis` has all fields).

- [ ] **Step 10: Commit**

```bash
git add src/features/compas/engine/tripContext.ts src/features/compas/engine/dependencies.ts src/features/compas/server/compasServer.ts src/features/compas/engine/intent.ts src/features/compas/server/compasActions.ts src/features/compas/components/compasApply.ts src/features/compas/server/getCompasData.ts src/features/compas/__tests__/originApply.test.ts src/features/compas/__tests__/originAction.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): départ dit rangé sur le voyage (metadata.compas.origin)

« depuis Lyon » appliqué : lieu retrouvé sur la carte comme la
destination (même limite compas-destination, mêmes messages), rangé
arrondi à ~1 km par l'écriture atomique, effaçable et annulable.
Changer de départ réadapte le trajet et le budget.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 3: Aéroports desservis (OurAirports) et choix de l'aéroport d'un lieu

**Files:**
- Create: `scripts/compas/build-airports.mjs`
- Create (generated by the script, committed): `src/features/compas/data/airports.json`, `src/features/compas/data/airports.meta.json`
- Create: `src/features/compas/engine/airports.ts`
- Create: `src/features/compas/server/airports.ts`
- Create: `src/features/compas/__tests__/airports.test.ts`

**Interfaces:**
- Consumes: `distanceKm(a, b)` from `src/features/compas/engine/places.ts` (great-circle km, pure, existing).
- Produces:
  - `engine/airports.ts` (pure, client-safe, no data import):
    - `export type AirportRow = readonly [string, string, number, number, string, 'L' | 'M']` — `[iata, name, lat, lon, iso_country, size]`
    - `export interface AirportPick { iata: string; name: string; km: number; country: string; lat: number; lon: number }` (`km` = place → airport, rounded)
    - `export const AIRPORT_RADIUS_KM = 300`, `export const MEDIUM_AIRPORT_FACTOR = 1.6`
    - `export function nearestAirportIn(rows: readonly AirportRow[], lat: number, lon: number, opts?: { maxKm?: number }): AirportPick | null` — candidates within `maxKm` (default 300), score = km × (L ? 1 : 1.6), lowest wins, ties → first row (rows are sorted by IATA), null if none or invalid coordinates.
  - `server/airports.ts` (`import 'server-only'`): `export function nearestAirport(lat: number, lon: number, opts?: { maxKm?: number }): AirportPick | null`.
  - `scripts/compas/build-airports.mjs`: `export const AIRPORTS_URL`, `export function parseCsvLine(line: string): string[]`, `export function buildAirports(csvText: string): Array<[string, string, number, number, string, 'L' | 'M']>`; run as a CLI it writes the two data files.

- [ ] **Step 1: Write the build script**

Create `scripts/compas/build-airports.mjs`:

```js
// Compas — aéroports desservis (OurAirports, domaine public, PLAN-100 4.3).
//
// Lit `airports.csv` d'OurAirports (téléchargé, ou chemin donné en argument),
// garde les aéroports à vols réguliers (`scheduled_service` = yes) avec un
// code IATA, grands ou moyens, et écrit dans `src/features/compas/data/` :
//   - `airports.json` : [iata, nom, lat (3 décimales), lon (3 décimales), pays ISO, 'L' | 'M']
//     trié par code IATA, une ligne par aéroport (diff lisible) ;
//   - `airports.meta.json` : source, adresse, licence, date, nombre.
//
// Usage :
//   NODE_USE_ENV_PROXY=1 node scripts/compas/build-airports.mjs
//   node scripts/compas/build-airports.mjs /chemin/vers/airports.csv
// (Node 22 : `fetch` ne passe par HTTPS_PROXY qu'avec NODE_USE_ENV_PROXY=1.)
// Aucune dépendance.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');
/** En dessous, le fichier lu est tronqué ou n'est pas celui d'OurAirports. */
const MIN_AIRPORTS = 2500;

/** Une ligne CSV (RFC 4180) : champs entre guillemets, guillemets doublés. */
export function parseCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(field);
      field = '';
    } else field += c;
  }
  out.push(field);
  return out;
}

/** Les enregistrements du fichier, sans couper un champ entre guillemets qui contient un saut de ligne. */
function csvRecords(text) {
  const records = [];
  let current = '';
  let quotes = 0;
  for (const line of text.split(/\r?\n/)) {
    current = current ? `${current}\n${line}` : line;
    quotes += (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 0) {
      if (current.trim()) records.push(parseCsvLine(current));
      current = '';
      quotes = 0;
    }
  }
  return records;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/** Aéroports desservis du CSV, triés par code IATA. */
export function buildAirports(text) {
  const [header, ...rows] = csvRecords(text);
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Colonne absente du CSV : ${name}`);
    return i;
  };
  const iType = col('type');
  const iName = col('name');
  const iLat = col('latitude_deg');
  const iLon = col('longitude_deg');
  const iCountry = col('iso_country');
  const iService = col('scheduled_service');
  const iIata = col('iata_code');
  const out = [];
  for (const r of rows) {
    const type = r[iType];
    if (type !== 'large_airport' && type !== 'medium_airport') continue;
    if (r[iService] !== 'yes') continue;
    const iata = (r[iIata] ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(iata)) continue;
    const lat = Number(r[iLat]);
    const lon = Number(r[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push([
      iata,
      (r[iName] ?? '').trim(),
      round3(lat),
      round3(lon),
      (r[iCountry] ?? '').trim().toUpperCase(),
      type === 'large_airport' ? 'L' : 'M',
    ]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

async function main() {
  const file = process.argv[2];
  const text = file
    ? await readFile(file, 'utf8')
    : await fetch(AIRPORTS_URL).then((res) => {
        if (!res.ok) throw new Error(`OurAirports : HTTP ${res.status}`);
        return res.text();
      });
  const airports = buildAirports(text);
  if (airports.length < MIN_AIRPORTS)
    throw new Error(`Seulement ${airports.length} aéroports : fichier tronqué ou inattendu, rien n'est écrit.`);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'airports.json'),
    `[\n${airports.map((a) => JSON.stringify(a)).join(',\n')}\n]\n`
  );
  const meta = {
    source: 'OurAirports',
    url: AIRPORTS_URL,
    licence: 'Public Domain',
    fetched: new Date().toISOString().slice(0, 10),
    count: airports.length,
  };
  await writeFile(path.join(OUT_DIR, 'airports.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`${airports.length} aéroports écrits dans ${path.relative(ROOT, OUT_DIR)}`);
}

// Lancé en ligne de commande (pas importé par un test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run it and look at the output**

Network is available in the container; Node 22's `fetch` only goes through the proxy with `NODE_USE_ENV_PROXY=1`:

Run: `NODE_USE_ENV_PROXY=1 node scripts/compas/build-airports.mjs`
Expected: `3244 aéroports écrits dans src/features/compas/data` (an `EnvHttpProxyAgent is experimental` warning is normal; the count can move by a few units if OurAirports changed since 9 Oct.; anything under 2 500 aborts without writing).

If `fetch` still fails (`getaddrinfo ENOTFOUND`), download with curl into a scratch directory and pass the path:

```bash
mkdir -p /tmp/ourairports && curl -sS -o /tmp/ourairports/airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
node scripts/compas/build-airports.mjs /tmp/ourairports/airports.csv
```

Check:

Run: `ls -la src/features/compas/data && cat src/features/compas/data/airports.meta.json && grep -E '"(LYS|CDG|OLB|CAG)"' src/features/compas/data/airports.json`
Expected: `airports.json` ≈ 200 KB; meta `{ "source": "OurAirports", "url": "https://davidmegginson.github.io/ourairports-data/airports.csv", "licence": "Public Domain", "fetched": "<today>", "count": 3244 }`; four lines such as `["LYS","Lyon Saint-Exupéry Airport",45.726,5.09,"FR","L"]`, `["CDG","Charles de Gaulle International Airport",49.009,2.554,"FR","L"]`, `["OLB","Olbia Costa Smeralda Airport",40.899,9.518,"IT","L"]`, `["CAG","Cagliari Elmas Airport",39.251,9.054,"IT","L"]`.

- [ ] **Step 3: Write the failing tests**

Create `src/features/compas/__tests__/airports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import { nearestAirport } from '../server/airports';
import AIRPORTS from '../data/airports.json';
import META from '../data/airports.meta.json';
import { buildAirports } from '../../../../scripts/compas/build-airports.mjs';

/** Lignes réelles d'OurAirports (coordonnées et catégories du fichier du 9 oct. 2026). */
const ROWS: AirportRow[] = [
  ['AHO', 'Alghero-Fertilia Airport', 40.632, 8.291, 'IT', 'M'],
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['CMF', 'Chambéry Aix les Bains airport', 45.638, 5.88, 'FR', 'M'],
  ['GVA', 'Geneva International Airport', 46.238, 6.109, 'CH', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
];

describe('aéroport d’un lieu (choix pur)', () => {
  it('Lyon : Saint-Exupéry, 20 km', () => {
    expect(nearestAirportIn(ROWS, 45.76, 4.84)).toEqual({
      iata: 'LYS',
      name: 'Lyon Saint-Exupéry Airport',
      km: 20,
      country: 'FR',
      lat: 45.726,
      lon: 5.09,
    });
  });

  it('un aéroport moyen tout près gagne (Chambéry), un grand un peu plus loin aussi (Annecy → Genève)', () => {
    expect(nearestAirportIn(ROWS, 45.57, 5.92)?.iata).toBe('CMF');
    // Annecy : Chambéry à 35 km (moyen, compte 56), Genève à 38 km (grand) → Genève.
    expect(nearestAirportIn(ROWS, 45.9, 6.13)).toMatchObject({ iata: 'GVA', km: 38 });
  });

  it('Sardaigne : Cagliari depuis le centre de l’île, Olbia depuis Nuoro, Alghero sur place', () => {
    expect(nearestAirportIn(ROWS, 40.08, 9.03)).toMatchObject({ iata: 'CAG', km: 92 });
    expect(nearestAirportIn(ROWS, 40.32, 9.33)).toMatchObject({ iata: 'OLB', km: 66 });
    expect(nearestAirportIn(ROWS, 40.56, 8.32)?.iata).toBe('AHO');
  });

  it('rien à moins de 300 km (ou du rayon demandé) : null', () => {
    expect(nearestAirportIn(ROWS, 40, -40)).toBeNull();
    expect(nearestAirportIn(ROWS, 45.76, 4.84, { maxKm: 10 })).toBeNull();
    expect(nearestAirportIn(ROWS, Number.NaN, 4.84)).toBeNull();
    expect(nearestAirportIn([], 45.76, 4.84)).toBeNull();
  });
});

describe('fichier généré (OurAirports)', () => {
  const rows = AIRPORTS as unknown as unknown[];

  it('une ligne [iata, nom, lat, lon, pays, L|M] par aéroport, triée par code', () => {
    expect(rows.length).toBe(META.count);
    expect(rows.length).toBeGreaterThan(3000);
    for (const r of rows) {
      expect(Array.isArray(r) && r.length === 6).toBe(true);
      const [iata, name, lat, lon, country, size] = r as unknown[];
      expect(iata).toMatch(/^[A-Z0-9]{3}$/);
      expect(typeof name === 'string' && name.length > 0).toBe(true);
      expect(typeof lat === 'number' && Math.abs(lat) <= 90).toBe(true);
      expect(typeof lon === 'number' && Math.abs(lon) <= 180).toBe(true);
      expect(country).toMatch(/^[A-Z0-9]{2}$/);
      expect(size === 'L' || size === 'M').toBe(true);
    }
    const codes = rows.map((r) => (r as AirportRow)[0]);
    expect([...codes].sort()).toEqual(codes);
  });

  it('contient Lyon, Paris-Charles de Gaulle et Olbia', () => {
    const byCode = new Map(rows.map((r) => [(r as AirportRow)[0], r as AirportRow]));
    expect(byCode.get('LYS')).toEqual(['LYS', expect.stringMatching(/Lyon/), expect.closeTo(45.726, 1), expect.closeTo(5.09, 1), 'FR', 'L']);
    expect(byCode.get('CDG')).toEqual(['CDG', expect.stringMatching(/Charles de Gaulle/), expect.closeTo(49.009, 1), expect.closeTo(2.554, 1), 'FR', 'L']);
    expect(byCode.get('OLB')).toEqual(['OLB', expect.stringMatching(/Olbia/), expect.closeTo(40.899, 1), expect.closeTo(9.518, 1), 'IT', expect.stringMatching(/^[LM]$/)]);
  });

  it('source, licence et date dites', () => {
    expect(META).toEqual({
      source: 'OurAirports',
      url: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
      licence: 'Public Domain',
      fetched: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      count: rows.length,
    });
  });
});

describe('script de génération', () => {
  it('garde les aéroports desservis, grands ou moyens, avec un code IATA ; lit les guillemets', () => {
    const csv = [
      '"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"',
      '4137,"LFLL","large_airport","Lyon Saint-Exupéry Airport",45.725996,5.090139,821,"EU","FR","FR-ARA","Colombier-Saugnieu, Rhône","yes","LFLL","LYS","LFLL",,,,',
      '4131,"LFLB","medium_airport","Chambéry ""Aix"" les Bains airport",45.6381,5.88023,779,"EU","FR","FR-ARA","Chambéry","yes","LFLB","CMF","LFLB",,,,',
      '1,"XSML","small_airport","Petit terrain",45,5,0,"EU","FR","FR-ARA","Nulle part","yes",,"XSM",,,,,',
      '2,"XNOS","large_airport","Sans vols réguliers",46,6,0,"EU","FR","FR-ARA","Ailleurs","no",,"XNO",,,,,',
      '3,"XNOI","medium_airport","Sans code IATA",47,7,0,"EU","FR","FR-ARA","Là","yes",,,,,,,',
    ].join('\n');
    expect(buildAirports(csv)).toEqual([
      ['CMF', 'Chambéry "Aix" les Bains airport', 45.638, 5.88, 'FR', 'M'],
      ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
    ]);
  });
});

describe('recherche côté serveur', () => {
  it('Lyon → LYS ; Sardaigne → Cagliari ou Olbia ; plein Atlantique → aucun', () => {
    expect(nearestAirport(45.76, 4.84)?.iata).toBe('LYS');
    expect(['CAG', 'OLB']).toContain(nearestAirport(40.08, 9.03)?.iata);
    expect(nearestAirport(40, -40)).toBeNull();
  });
});

describe('le fichier des aéroports ne part jamais dans le navigateur', () => {
  const SRC = path.resolve(__dirname, '..', '..', '..');
  const AIRPORTS_JSON = path.join(SRC, 'features', 'compas', 'data', 'airports.json');
  const AIRPORTS_SERVER = path.join(SRC, 'features', 'compas', 'server', 'airports.ts');
  const directive = (code: string, d: string) =>
    new RegExp(`^(?:\\s|//[^\\n]*\\n|/\\*[\\s\\S]*?\\*/)*['"]${d}['"]`).test(code);
  const files = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files(p, out);
      else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js']) {
      const p = base + ext;
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
    return null;
  };
  // Imports de valeur (un `import type` est effacé à la compilation).
  const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

  it('server/airports.ts commence par import "server-only"', () => {
    expect(readFileSync(AIRPORTS_SERVER, 'utf8')).toMatch(/^import 'server-only';/);
  });

  it('aucun composant client (ni ce qu’il importe) n’atteint le fichier ni sa recherche', () => {
    const all = files(SRC);
    const roots = all.filter((f) => directive(readFileSync(f, 'utf8'), 'use client'));
    expect(roots.length).toBeGreaterThan(10);
    const seen = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
      const f = stack.pop() as string;
      if (seen.has(f)) continue;
      seen.add(f);
      if (f.endsWith('.json')) continue;
      const code = readFileSync(f, 'utf8');
      // Une action serveur reste sur le serveur : le navigateur n'en reçoit qu'une référence.
      if (!roots.includes(f) && directive(code, 'use server')) continue;
      for (const m of code.matchAll(IMPORT)) {
        const next = resolve(f, m[1] ?? m[2]);
        if (next && !seen.has(next)) stack.push(next);
      }
    }
    expect(seen.has(AIRPORTS_JSON)).toBe(false);
    expect(seen.has(AIRPORTS_SERVER)).toBe(false);
  });

  it('seul server/airports.ts importe le fichier', () => {
    const importers = files(SRC).filter((f) => /data\/airports\.json['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([AIRPORTS_SERVER]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/airports.test.ts`
Expected: FAIL — `Cannot find module '../engine/airports'` (and `../server/airports`).

- [ ] **Step 5: The pure scorer**

Create `src/features/compas/engine/airports.ts`:

```ts
import { distanceKm } from './places';

/**
 * Compas — l'aéroport d'un lieu (OurAirports, domaine public, PLAN-100 4.3).
 *
 * Choix PUR : les lignes sont passées en argument. Le fichier des 3 244
 * aéroports desservis (`data/airports.json`, ≈ 200 Ko) n'est lu que côté
 * serveur (`server/airports.ts`) : il n'entre jamais dans le navigateur.
 */

/** [code IATA, nom, latitude, longitude, pays ISO, 'L' grand | 'M' moyen] */
export type AirportRow = readonly [string, string, number, number, string, 'L' | 'M'];

export interface AirportPick {
  iata: string;
  /** Nom tel que dans OurAirports (« Lyon Saint-Exupéry Airport »). */
  name: string;
  /** Vol d'oiseau du lieu à l'aéroport, en km (arrondi). */
  km: number;
  country: string;
  lat: number;
  lon: number;
}

/** Au-delà, un aéroport n'est plus celui du lieu. */
export const AIRPORT_RADIUS_KM = 300;
/** Un aéroport moyen (moins de vols) compte comme 1,6 fois plus loin qu'un grand. */
export const MEDIUM_AIRPORT_FACTOR = 1.6;

/**
 * Aéroport retenu pour un lieu : parmi ceux à moins de `maxKm` (300 km), le
 * plus petit score = distance × (grand ? 1 : 1,6) ; à égalité, le premier
 * code IATA. null si aucun.
 */
export function nearestAirportIn(
  rows: readonly AirportRow[],
  lat: number,
  lon: number,
  opts: { maxKm?: number } = {}
): AirportPick | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const maxKm = opts.maxKm ?? AIRPORT_RADIUS_KM;
  // Un degré de latitude ≈ 111 km : ce qui en est plus loin ne peut pas être dans le rayon.
  const latSpan = maxKm / 111 + 0.1;
  let best: { row: AirportRow; km: number; score: number } | null = null;
  for (const row of rows) {
    if (Math.abs(row[2] - lat) > latSpan) continue;
    const km = distanceKm({ lat, lon }, { lat: row[2], lon: row[3] });
    if (km > maxKm) continue;
    const score = km * (row[5] === 'L' ? 1 : MEDIUM_AIRPORT_FACTOR);
    if (!best || score < best.score) best = { row, km, score };
  }
  if (!best) return null;
  const [iata, name, aLat, aLon, country] = best.row;
  return { iata, name, km: Math.round(best.km), country, lat: aLat, lon: aLon };
}
```

- [ ] **Step 6: The server-only lookup**

Create `src/features/compas/server/airports.ts`:

```ts
import 'server-only';
import AIRPORTS from '../data/airports.json';
import { nearestAirportIn, type AirportPick, type AirportRow } from '../engine/airports';

/**
 * Aéroports desservis (OurAirports, domaine public), lus côté serveur
 * seulement : le fichier (≈ 200 Ko) ne part jamais dans le navigateur.
 * Généré par `scripts/compas/build-airports.mjs` (voir `data/airports.meta.json`).
 */
const ROWS = AIRPORTS as unknown as readonly AirportRow[];

/** Aéroport retenu pour un lieu (à moins de 300 km, les grands d'abord), sinon null. */
export function nearestAirport(lat: number, lon: number, opts?: { maxKm?: number }): AirportPick | null {
  return nearestAirportIn(ROWS, lat, lon, opts);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/airports.test.ts`
Expected: PASS (12 tests). The client-bundle guard walks every `'use client'` file of `src` and what it imports (stopping at `'use server'` files, whose code stays on the server), ≈ 1 s.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no error (`resolveJsonModule` is on; the `.mjs` import is typed by inference, `allowJs`).

- [ ] **Step 8: Commit**

```bash
git add scripts/compas/build-airports.mjs src/features/compas/data/airports.json src/features/compas/data/airports.meta.json src/features/compas/engine/airports.ts src/features/compas/server/airports.ts src/features/compas/__tests__/airports.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): aéroports desservis OurAirports et aéroport d'un lieu

Script sans dépendance (CSV OurAirports, domaine public) : 3 244
aéroports à vols réguliers, grands ou moyens, avec code IATA, en JSON
versionné lu seulement côté serveur. Choix pur : moins de 300 km, un
aéroport moyen compte 1,6 fois sa distance. Test : le fichier n'atteint
jamais un composant client.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 4: Venir — départ dit, puis position, jamais la France ; l'avion d'aéroport à aéroport

**Files:**
- Create: `src/features/compas/engine/travel.ts`
- Create: `src/features/compas/__tests__/travel.test.ts`
- Modify: `src/features/compas/server/autofillActions.ts` (imports from `../engine/autofill`, `../engine/tripContext`, `../engine/rail`; `CompasAutofillSummary`; the whole « 5. Venir » block; AI facts « Départ de la personne » and « Voyage à l’étranger »; flight cost; entry fees; flight and insurance budget lines; returned summary)
- Modify: `src/features/compas/components/CompasScreen.tsx` (import; `autofillDigest`)
- Modify: `src/features/compas/__tests__/compasScreen.test.tsx` (one new test, no existing assertion changed)

**Interfaces:**
- Consumes:
  - Task 2: `originOf(raw: unknown): TripOrigin | null` from `engine/tripContext.ts` (`metadata.compas.origin`).
  - Task 3: `AirportPick` (type) from `engine/airports.ts`; `nearestAirport(lat, lon, opts?): AirportPick | null` from `server/airports.ts` (server only — imported by `autofillActions.ts`, a `'use server'` file, never by a component).
  - Existing, pure: `approachMode`, `maxDriveMinutes`, `estimateCarTrip`, `FLIGHT_THRESHOLD_KM`, `TransportEstimate` (`engine/autofill.ts`); `trainTrip`, `TrainTrip` (`engine/rail.ts`); `distanceKm` (`engine/places.ts`).
- Produces (`engine/travel.ts`, pure, client-safe — no data or server import):
  - `interface TravelPoint { lat: number; lon: number }`
  - `interface TravelOrigin extends TravelPoint { name: string | null; country: string | null; countryCode: string | null; source: 'dit' | 'gps' }`
  - `interface TravelTransport { mode: 'voiture' | 'avion' | 'train'; km: number; minutes: number; walkKm: number; fuelEur: number; basis: string; route?: string }` (`route` = « LYS → OLB »)
  - `interface TravelFlight { from: AirportPick | null; to: AirportPick | null; km: number }`
  - `interface TravelLeg { origin: TravelOrigin | null; abroad: boolean | null; transport: TravelTransport | null; carFuel: TransportEstimate | null; train: TrainTrip | null; flight: TravelFlight | null; originUnknown: boolean; notes: string[] }`
  - `type CarRouteResult = { km: number; minutes: number; end: TravelPoint | null } | { failure: string | null }`
  - `interface TravelDeps { carRoute(from, to): Promise<CarRouteResult>; walkKm(end, to): Promise<number>; airport(p): AirportPick | null }`
  - `interface TravelLegInput { origin: TravelOrigin | null; target: TravelPoint; destination: { name: string; countryCode: string | null }; days: number; party: number; transport: boolean }`
  - constants `UNKNOWN_ORIGIN_NOTE`, `UNKNOWN_ORIGIN_LINE`, `ON_SITE_NOTE`
  - `travelOrigin(said, gps): TravelOrigin | null` (said > GPS > null), `abroadOf(origin, destinationCountry): boolean | null`, `originFact(origin): string` (`'inconnu'` without origin), `travelDigest(t, originUnknown?): string | null`, `planTravelLeg(input, deps): Promise<TravelLeg>`
  - `CompasAutofillSummary.transport: TravelTransport | null` and new optional `CompasAutofillSummary.originUnknown?: boolean` (`server/autofillActions.ts`).
- Task 5 edits `engine/travel.ts` again (day-trip note): keep the function and constant names above.

- [ ] **Step 1: Write the failing planner tests**

Create `src/features/compas/__tests__/travel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nearestAirportIn, type AirportPick, type AirportRow } from '../engine/airports';
import {
  ON_SITE_NOTE,
  UNKNOWN_ORIGIN_LINE,
  UNKNOWN_ORIGIN_NOTE,
  abroadOf,
  originFact,
  planTravelLeg,
  travelDigest,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
  type TravelPoint,
} from '../engine/travel';

/** Lignes réelles d'OurAirports (fichier du 9 oct. 2026). */
const ROWS: AirportRow[] = [
  ['AHO', 'Alghero-Fertilia Airport', 40.632, 8.291, 'IT', 'M'],
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
];
const LYON = { name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR' };
const PARIS_GPS = { lat: 48.86, lon: 2.35, name: 'Paris', country: 'France', countryCode: 'FR' };
const VERCORS = { lat: 45.07, lon: 5.55 };
const SARDAIGNE = { lat: 40.08, lon: 9.03 };

/** Faux routeur et vraie sélection d'aéroports sur les lignes ci-dessus ; garde les appels. */
function deps(car: CarRouteResult | ((from: TravelPoint) => CarRouteResult), airport?: TravelDeps['airport']) {
  const calls: TravelPoint[][] = [];
  const d: TravelDeps = {
    carRoute: async (from, to) => {
      calls.push([from, to]);
      return typeof car === 'function' ? car(from) : car;
    },
    walkKm: async () => 0,
    airport: airport ?? ((p) => nearestAirportIn(ROWS, p.lat, p.lon)),
  };
  return { d, calls };
}
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(LYON, null),
  target: VERCORS,
  destination: { name: 'Vercors', countryCode: 'FR' },
  days: 3,
  party: 2,
  transport: true,
  ...over,
});

describe('d’où l’on part', () => {
  it('le départ dit passe avant la position ; la position seule ; sinon personne', () => {
    expect(travelOrigin(LYON, PARIS_GPS)).toEqual({ ...LYON, country: null, source: 'dit' });
    expect(travelOrigin(null, PARIS_GPS)).toEqual({ ...PARIS_GPS, source: 'gps' });
    expect(travelOrigin(null, null)).toBeNull();
  });

  it('à l’étranger : oui, non, ou inconnu sans pays de départ', () => {
    expect(abroadOf(travelOrigin(LYON, null), 'IT')).toBe(true);
    expect(abroadOf(travelOrigin(LYON, null), 'FR')).toBe(false);
    expect(abroadOf(null, 'IT')).toBeNull();
    expect(abroadOf(travelOrigin(null, { ...PARIS_GPS, countryCode: null }), 'IT')).toBeNull();
    expect(abroadOf(null, null)).toBe(false);
  });

  it('dit au spécialiste : jamais un pays supposé', () => {
    expect(`Départ de la personne : ${originFact(null)}.`).toBe('Départ de la personne : inconnu.');
    expect(originFact(travelOrigin(null, PARIS_GPS))).toBe('Paris, France');
    expect(originFact(travelOrigin(null, { ...PARIS_GPS, name: null }))).toBe('position partagée, commune inconnue');
    expect(originFact(travelOrigin(LYON, null))).toBe('Lyon');
  });
});

describe('sans point de départ : rien n’est chiffré', () => {
  it('ni route, ni vol, ni train ; une seule note, exacte ; aucun calcul lancé', async () => {
    for (const where of [
      { target: VERCORS, destination: { name: 'Vercors', countryCode: 'FR' } },
      // Avant : vol « depuis la France », distance depuis Paris.
      { target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } },
    ]) {
      const { d, calls } = deps({ km: 120, minutes: 95, end: null });
      const leg = await planTravelLeg(input({ origin: null, ...where }), d);
      expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null, originUnknown: true });
      expect(leg.notes).toEqual([
        'Point de départ inconnu : écris « depuis Lyon » dans ta demande ou partage ta position pour chiffrer le trajet.',
      ]);
      expect(leg.notes).toEqual([UNKNOWN_ORIGIN_NOTE]);
      expect(calls).toEqual([]);
    }
  });

  it('l’écran le dit', () => {
    expect(travelDigest(null, true)).toBe('Trajet non chiffré : point de départ inconnu');
    expect(UNKNOWN_ORIGIN_LINE).toBe('Trajet non chiffré : point de départ inconnu');
    expect(travelDigest(null, false)).toBeNull();
  });

  it('une sortie de quelques heures (pas de module trajet) ne dit rien', async () => {
    const { d, calls } = deps({ km: 120, minutes: 95, end: null });
    const leg = await planTravelLeg(input({ origin: null, transport: false }), d);
    expect(leg).toMatchObject({ transport: null, originUnknown: false, notes: [] });
    expect(calls).toEqual([]);
  });
});

describe('le départ dit passe avant la position', () => {
  it('« depuis Lyon » avec une position à Paris : la route part de Lyon', async () => {
    const { d, calls } = deps({ km: 120, minutes: 95, end: VERCORS });
    const leg = await planTravelLeg(input({ origin: travelOrigin(LYON, PARIS_GPS) }), d);
    expect(calls).toEqual([[{ ...LYON, country: null, source: 'dit' }, VERCORS]]);
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 120, minutes: 95 });
    expect(leg.carFuel?.fuelEur).toBeGreaterThan(0);
    expect(leg.notes).toEqual([]);
  });

  it('déjà sur place : rien à prévoir', async () => {
    const { d } = deps({ km: 1, minutes: 1, end: null });
    const leg = await planTravelLeg(input({ target: { lat: 45.76, lon: 4.84 } }), d);
    expect(leg.transport).toBeNull();
    expect(leg.notes).toEqual([ON_SITE_NOTE]);
  });
});

describe('l’avion d’aéroport à aéroport (OurAirports)', () => {
  it('Lyon → Sardaigne, 3 jours : LYS → CAG, distance entre les deux aéroports', async () => {
    const { d, calls } = deps({ km: 1100, minutes: 840, end: null });
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' }, days: 3 }),
      d
    );
    expect(leg.flight).toMatchObject({ from: { iata: 'LYS' }, to: { iata: 'CAG' }, km: 790 });
    expect(leg.transport).toEqual({
      mode: 'avion',
      km: 790,
      minutes: 0,
      walkKm: 0,
      fuelEur: 0,
      basis: 'vol aller-retour LYS → CAG (Lyon Saint-Exupéry Airport → Cagliari Elmas Airport), environ 790 km',
      route: 'LYS → CAG',
    });
    expect(travelDigest(leg.transport)).toBe('vol LYS → CAG à prévoir');
    expect(leg.abroad).toBe(true);
    // Grande île : ni train ni route mesurée.
    expect(calls).toEqual([]);
  });

  it('sans aéroport connu à un bout : distance du départ au lieu, dite', async () => {
    const { d } = deps({ km: 1100, minutes: 840, end: null }, () => null);
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' }, days: 3 }),
      d
    );
    expect(leg.flight).toEqual({ from: null, to: null, km: 718 });
    expect(leg.transport?.basis).toBe('vol aller-retour depuis Lyon vers Sardaigne, environ 718 km');
    expect(leg.transport?.route).toBeUndefined();
  });

  it('route trop longue pour la durée, rail hors de portée : vol, la raison dite', async () => {
    // Départ à 500 km de la cible, sans pays connu (pas de train), une journée.
    const { d } = deps({ km: 600, minutes: 400, end: null }, (p) =>
      p.lat > 44.5 ? (nearestAirportIn(ROWS, 45.76, 4.84) as AirportPick) : (nearestAirportIn(ROWS, 40.08, 9.03) as AirportPick)
    );
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45, lon: 5, name: 'Ici', country: null, countryCode: null }),
        target: { lat: 43.6, lon: 5 },
        days: 1,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('avion');
    expect(leg.transport?.basis).toMatch(/^7 h de route à l’aller pour 1 jour : vol aller-retour LYS → CAG/);
  });

  it('même aéroport aux deux bouts : pas de vol, la route', async () => {
    const same: AirportPick = { iata: 'XXX', name: 'Milieu', km: 250, country: 'FR', lat: 42.75, lon: 5 };
    const { d } = deps({ km: 600, minutes: 400, end: null }, () => same);
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45, lon: 5, name: 'Nord', country: null, countryCode: null }),
        target: { lat: 40.5, lon: 5 },
        destination: { name: 'Sud', countryCode: null },
        days: 1,
      }),
      d
    );
    expect(leg.flight).toBeNull();
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 600, minutes: 400 });
  });

  it('position sans nom de commune, autre continent : aucun « depuis » inventé', async () => {
    const { d, calls } = deps({ failure: 'off_network' }, () => null);
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45.76, lon: 4.84, name: null, country: null, countryCode: null }),
        target: { lat: 35.68, lon: 139.69 },
        destination: { name: 'Tokyo', countryCode: 'JP' },
        days: 10,
      }),
      d
    );
    expect(leg.transport?.basis).toBe('vol aller-retour vers Tokyo, environ 9892 km');
    expect(leg.flight?.km).toBe(9892);
    expect(leg.abroad).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('route et train (inchangés, depuis le départ retenu)', () => {
  it('route non calculée mais à portée : estimée, dite', async () => {
    const { d } = deps({ failure: 'provider_unavailable' });
    const leg = await planTravelLeg(input({}), d);
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 123, minutes: 92 });
    expect(leg.notes).toEqual([
      'Trajet en voiture estimé (itinéraire routier non calculé : service de calcul injoignable) : à vérifier, traversée en ferry éventuelle non comptée.',
    ]);
  });

  it('Lyon → Bruxelles en 3 jours, 7 h 10 de route : le train', async () => {
    const { d } = deps({ km: 680, minutes: 430, end: null });
    const leg = await planTravelLeg(
      input({ target: { lat: 50.85, lon: 4.35 }, destination: { name: 'Bruxelles', countryCode: 'BE' }, days: 3 }),
      d
    );
    expect(leg.transport).toMatchObject({ mode: 'train', km: 709, minutes: 417 });
    expect(leg.train?.railKm).toBe(709);
    expect(travelDigest(leg.transport)).toBe('train, environ 7 h');
  });
});
```

(The fake airport dependency runs the real scorer `nearestAirportIn` on real OurAirports rows; 790 km = great circle LYS (45.726, 5.09) → CAG (39.251, 9.054); 718 km = Lyon (45.76, 4.84) → centre of Sardinia (40.08, 9.03); 9 892 km = Lyon → Tokyo.)

- [ ] **Step 2: Add the failing screen test**

In `src/features/compas/__tests__/compasScreen.test.tsx`, insert a new test just before the existing test « Préremplissage : limite de fréquence → annoncé, relancé seul à la fin de la fenêtre » — replace:

```tsx
  it('Préremplissage : limite de fréquence → annoncé, relancé seul à la fin de la fenêtre', async () => {
```

with:

```tsx
  it('Préremplissage sans point de départ : le trajet est dit non chiffré', async () => {
    autofill.compasAutofillAction.mockImplementationOnce(async () => ({
      success: true,
      summary: {
        nights: [
          { night: 1, type: 'refuge', place: 'Refuge des Oulettes', reason: 'ton profil : confort' },
          { night: 2, type: 'bivouac', place: null, reason: 'ta préférence' },
        ],
        transport: null,
        originUnknown: true,
        kit: { inventaire: 2, pret: 0, location: 0, achat: 1, a_trouver: 1 },
        budget: [],
        total: 486,
        notes: [],
        usedAi: true,
        stepsCreated: 0,
      },
    }) as never);
    render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
    expect(
      await screen.findByText('1 refuge, 1 bivouac · Trajet non chiffré : point de départ inconnu · 4 objets au kit')
    ).toBeTruthy();
  });

  it('Préremplissage : limite de fréquence → annoncé, relancé seul à la fin de la fenêtre', async () => {
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/travel.test.ts src/features/compas/__tests__/compasScreen.test.tsx`
Expected: FAIL — `Cannot find module '../engine/travel'`; the screen test finds « 1 refuge, 1 bivouac · 4 objets au kit » instead of the « Trajet non chiffré » line.

- [ ] **Step 4: The pure planner**

Create `src/features/compas/engine/travel.ts`:

```ts
import type { AirportPick } from './airports';
import {
  FLIGHT_THRESHOLD_KM,
  approachMode,
  estimateCarTrip,
  maxDriveMinutes,
  type TransportEstimate,
} from './autofill';
import { distanceKm } from './places';
import { trainTrip, type TrainTrip } from './rail';

/**
 * Compas — venir jusqu'au départ (« 5. Venir », PLAN-100 4.3 et 4.4).
 *
 * D'où l'on part : le lieu dit (« depuis Lyon »), sinon la position de
 * l'appareil ; sinon personne ne le sait et rien n'est chiffré, l'écran le
 * dit. Jamais la France ni Paris par défaut. Puis la route mesurée si elle
 * tient dans la durée du voyage, le train si le rail s'y prête, sinon l'avion
 * d'aéroport à aéroport (OurAirports).
 *
 * Pur : la route mesurée et le choix des aéroports sont injectés (le serveur
 * passe le routeur et `server/airports.ts`) ; ce module n'importe aucune donnée.
 */

export interface TravelPoint {
  lat: number;
  lon: number;
}

export interface TravelOrigin extends TravelPoint {
  /** Commune ou lieu dit ; null quand la position n'a pas de nom connu. */
  name: string | null;
  country: string | null;
  countryCode: string | null;
  /** « dit » (« depuis Lyon ») ou position de l'appareil. */
  source: 'dit' | 'gps';
}

/** Le trajet tel que le résumé de la préparation le montre. */
export interface TravelTransport {
  mode: 'voiture' | 'avion' | 'train';
  km: number;
  minutes: number;
  walkKm: number;
  fuelEur: number;
  basis: string;
  /** Vol : « LYS → OLB », quand les deux aéroports sont connus. */
  route?: string;
}

export interface TravelFlight {
  from: AirportPick | null;
  to: AirportPick | null;
  /** Vol d'oiseau d'aéroport à aéroport, sinon du départ au lieu (km, arrondi). */
  km: number;
}

export interface TravelLeg {
  origin: TravelOrigin | null;
  /** Voyage à l'étranger ; null quand le pays de départ n'est pas connu. */
  abroad: boolean | null;
  transport: TravelTransport | null;
  /** Carburant aller-retour, quand on part en voiture. */
  carFuel: TransportEstimate | null;
  train: TrainTrip | null;
  /** Vol à prévoir ; null sans vol. */
  flight: TravelFlight | null;
  /** Aucun point de départ : rien n'est chiffré, l'écran le dit. */
  originUnknown: boolean;
  notes: string[];
}

/** Route mesurée en voiture, ou la raison pour laquelle elle ne l'a pas été. */
export type CarRouteResult = { km: number; minutes: number; end: TravelPoint | null } | { failure: string | null };

export interface TravelDeps {
  /** Itinéraire routier mesuré (km, minutes, dernier point du tracé). */
  carRoute(from: TravelPoint, to: TravelPoint): Promise<CarRouteResult>;
  /** Marche du bout de la route jusqu'au lieu (km ; 0 si la route y arrive). */
  walkKm(end: TravelPoint, to: TravelPoint): Promise<number>;
  /** Aéroport retenu pour un lieu (OurAirports) ; null sans aéroport à moins de 300 km. */
  airport(p: TravelPoint): AirportPick | null;
}

export interface TravelLegInput {
  origin: TravelOrigin | null;
  /** Premier lieu du voyage (première étape placée, sinon la destination). */
  target: TravelPoint;
  destination: { name: string; countryCode: string | null };
  days: number;
  party: number;
  /** Module « trajet » du projet : faux pour une sortie de quelques heures. */
  transport: boolean;
}

export const UNKNOWN_ORIGIN_NOTE =
  'Point de départ inconnu : écris « depuis Lyon » dans ta demande ou partage ta position pour chiffrer le trajet.';
export const UNKNOWN_ORIGIN_LINE = 'Trajet non chiffré : point de départ inconnu';
export const ON_SITE_NOTE = 'Tu es déjà au départ : aucun trajet à prévoir.';

/** Départ dit (`metadata.compas.origin`) d'abord, puis la position de l'appareil, sinon aucun. */
export function travelOrigin(
  said: { name: string; lat: number; lon: number; countryCode: string | null } | null,
  gps: (TravelPoint & { name: string | null; country: string | null; countryCode: string | null }) | null
): TravelOrigin | null {
  if (said)
    return { name: said.name, country: null, countryCode: said.countryCode, lat: said.lat, lon: said.lon, source: 'dit' };
  if (gps)
    return { name: gps.name, country: gps.country, countryCode: gps.countryCode, lat: gps.lat, lon: gps.lon, source: 'gps' };
  return null;
}

/** À l'étranger ? Faux sans pays de destination ; inconnu sans pays de départ. */
export function abroadOf(origin: TravelOrigin | null, destinationCountry: string | null): boolean | null {
  if (!destinationCountry) return false;
  if (!origin?.countryCode) return null;
  return origin.countryCode !== destinationCountry;
}

/** Le départ tel que dit au spécialiste (IA) : jamais un pays supposé. */
export function originFact(origin: TravelOrigin | null): string {
  if (!origin) return 'inconnu';
  if (!origin.name) return 'position partagée, commune inconnue';
  return `${origin.name}${origin.country ? `, ${origin.country}` : ''}`;
}

/** Le trajet en quelques mots pour l'écran (« vol LYS → OLB à prévoir »), null s'il n'y a rien à dire. */
export function travelDigest(t: TravelTransport | null, originUnknown?: boolean): string | null {
  if (t)
    return t.mode === 'avion'
      ? t.route
        ? `vol ${t.route} à prévoir`
        : 'vol à prévoir'
      : t.mode === 'train'
        ? `train, environ ${String(Math.round(t.minutes / 30) / 2).replace('.', ',')} h`
        : `${Math.round(t.km)} km de route`;
  return originUnknown ? UNKNOWN_ORIGIN_LINE : null;
}

const CAR_FAILURE: Record<string, string> = {
  off_network: 'tracé qui n’arrive pas au lieu',
  provider_unavailable: 'service de calcul injoignable',
  rate_limited: 'trop de calculs d’affilée',
};

/**
 * Le trajet d'approche, comme la préparation l'écrit : route mesurée si elle
 * est raisonnable pour la durée, sinon le train (pays reliés, pas d'île),
 * sinon l'avion d'aéroport à aéroport. Sans point de départ : rien.
 */
export async function planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
  const { origin, target, destination, days, party } = input;
  const leg: TravelLeg = {
    origin,
    abroad: abroadOf(origin, destination.countryCode),
    transport: null,
    carFuel: null,
    train: null,
    flight: null,
    originUnknown: false,
    notes: [],
  };
  // Sortie de quelques heures : pas de trajet à chiffrer.
  if (!input.transport) return leg;
  if (!origin) {
    leg.originUnknown = true;
    leg.notes.push(UNKNOWN_ORIGIN_NOTE);
    return leg;
  }
  const straight = distanceKm(origin, target);
  const mode = approachMode({ straightKm: straight, days });
  if (mode === 'sur_place') {
    leg.notes.push(ON_SITE_NOTE);
    return leg;
  }
  const byTrain = (roadKm: number | null) =>
    trainTrip({ fromCountry: origin.countryCode, toCountry: destination.countryCode, straightKm: straight, roadKm, days, to: target });
  const takeTrain = (rail: TrainTrip): TravelLeg => {
    leg.train = rail;
    leg.transport = { mode: 'train', km: rail.railKm, minutes: rail.minutesOneWay, walkKm: 0, fuelEur: 0, basis: rail.basis };
    return leg;
  };
  // L'avion d'aéroport à aéroport ; faux si les deux bouts ont le même aéroport.
  const fly = (why: string | null): boolean => {
    const from = deps.airport(origin);
    const to = deps.airport(target);
    if (from && to && from.iata === to.iata) return false;
    const km = Math.round(from && to ? distanceKm(from, to) : straight);
    const text =
      from && to
        ? `vol aller-retour ${from.iata} → ${to.iata} (${from.name} → ${to.name}), environ ${km} km`
        : `vol aller-retour ${origin.name ? `depuis ${origin.name} ` : ''}vers ${destination.name}, environ ${km} km`;
    leg.flight = { from, to, km };
    leg.transport = {
      mode: 'avion',
      km,
      minutes: 0,
      walkKm: 0,
      fuelEur: 0,
      basis: why ? `${why} : ${text}` : text,
      ...(from && to ? { route: `${from.iata} → ${to.iata}` } : {}),
    };
    return true;
  };

  if (mode === 'avion') {
    // Trop loin pour la route vu la durée : le train si le rail s'y prête (route
    // mesurée pour écarter une île), sinon l'avion.
    if (byTrain(straight)) {
      const car = await deps.carRoute(origin, target).catch(() => null);
      const rail = car && 'km' in car ? byTrain(car.km) : null;
      if (rail) return takeTrain(rail);
    }
    if (fly(null)) return leg;
    // Même aéroport aux deux bouts : la route, comme pour un trajet proche.
  }

  const car = await deps.carRoute(origin, target).catch((): CarRouteResult => ({ failure: null }));
  if ('km' in car) {
    const walkKm = car.end ? await deps.walkKm(car.end, target) : 0;
    const limit = maxDriveMinutes(days);
    if (car.minutes > limit) {
      const rail = byTrain(car.km);
      if (rail) return takeTrain(rail);
      // Route trop longue pour la durée du voyage, rail hors de portée : l'avion.
      if (fly(`${Math.round(car.minutes / 60)} h de route à l’aller pour ${days} jour${days > 1 ? 's' : ''}`)) return leg;
    }
    leg.carFuel = estimateCarTrip({ oneWayKm: car.km, oneWayMin: car.minutes, partySize: party });
    if (leg.carFuel)
      leg.transport = {
        mode: 'voiture',
        km: leg.carFuel.oneWayKm,
        minutes: leg.carFuel.oneWayMin,
        walkKm: Math.round(walkKm * 10) / 10,
        fuelEur: leg.carFuel.fuelEur,
        basis: leg.carFuel.basis,
      };
    return leg;
  }
  if (straight <= FLIGHT_THRESHOLD_KM) {
    // Itinéraire non calculé (panne, débit, tracé qui n'arrive pas pile au
    // lieu) mais destination à portée de route : trajet estimé (vol
    // d'oiseau × 1,3 à 80 km/h), jamais un vol à 450 km.
    const km = Math.round(straight * 1.3);
    leg.carFuel = estimateCarTrip({ oneWayKm: km, oneWayMin: Math.round((km / 80) * 60), partySize: party });
    if (leg.carFuel) {
      leg.transport = {
        mode: 'voiture',
        km: leg.carFuel.oneWayKm,
        minutes: leg.carFuel.oneWayMin,
        walkKm: 0,
        fuelEur: leg.carFuel.fuelEur,
        basis: leg.carFuel.basis,
      };
      leg.notes.push(
        `Trajet en voiture estimé (itinéraire routier non calculé : ${CAR_FAILURE[car.failure ?? ''] ?? 'raison inconnue'}) : à vérifier, traversée en ferry éventuelle non comptée.`
      );
    }
    return leg;
  }
  // Pas de route (île, autre continent) : l'avion ou le bateau s'imposent.
  fly('aucune route praticable');
  return leg;
}
```

Behaviour kept from the old inline block when an origin is known: same mode choice (`approachMode`), same « train first » check for a plane (`trainTrip` after a measured road to rule out an island), same road / train / plane thresholds (`maxDriveMinutes`, `maxTrainMinutes`), same estimated road (× 1.3 at 80 km/h) and its note, same « déjà au départ » note. New: no origin → nothing priced + `UNKNOWN_ORIGIN_NOTE`; the origin country is never assumed (`trainTrip` gets `origin.countryCode`, null → no train); a flight goes airport to airport, and the same airport on both ends falls back to the road.

- [ ] **Step 5: Wire it into the preparation (`autofillActions.ts`)**

All replacements below are in `src/features/compas/server/autofillActions.ts`; none of them touches the lines lot M changed (`travellerToday`, `timeZone`, `bestPeriod`, `resolveProjectContext`).

Imports — `estimateCarTrip` moves to the planner. Replace:

```ts
  budgetTotal,
  estimateCarTrip,
  gearForNights,
```

with:

```ts
  budgetTotal,
  gearForNights,
```

Replace:

```ts
  sourceGear,
  approachMode,
  maxDriveMinutes,
  FLIGHT_THRESHOLD_KM,
  fuelForKm,
```

with:

```ts
  sourceGear,
  fuelForKm,
```

Replace:

```ts
import { shortHoursOf, tripLengthDays } from '../engine/tripContext';
```

with:

```ts
import { originOf, shortHoursOf, tripLengthDays } from '../engine/tripContext';
```

Replace (the planner and the airport lookup replace the direct use of the rail rule):

```ts
import { trainTrip, type TrainTrip } from '../engine/rail';
```

with:

```ts
import { originFact, planTravelLeg, travelOrigin, type TravelTransport } from '../engine/travel';
import { nearestAirport } from './airports';
```

In `CompasAutofillSummary`, replace:

```ts
  transport: {
    mode: 'voiture' | 'avion' | 'train';
    km: number;
    minutes: number;
    walkKm: number;
    fuelEur: number;
    basis: string;
  } | null;
  kit: Record<GearSource, number>;
```

with:

```ts
  transport: TravelTransport | null;
  /** Aucun point de départ (ni « depuis X », ni position) : trajet non chiffré, dit à l'écran. */
  originUnknown?: boolean;
  kit: Record<GearSource, number>;
```

Replace the whole « 5. Venir » block (from `lap('5');` to the `sur_place` line, just before `const motorLegs`):

```ts
    lap('5');
    /* 5. Venir : route mesurée si c'est raisonnable, sinon avion (chiffré par le spécialiste). */
    let transport: CompasAutofillSummary['transport'] = null;
    let carFuel: ReturnType<typeof estimateCarTrip> = null;
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    const near = from ? await lookupReverse(from.lat, from.lon) : null;
    // La commune, pas le lieu le plus proche du point (« depuis Chantier Hotel
    // de Ville » au lieu d'Annecy, 8 oct.).
    const origin = near ? { ...near, name: near.locality ?? near.name } : null;
    const abroad =
      anchor.countryCode != null && (origin?.countryCode ?? 'FR') !== anchor.countryCode;
    let flightNeeded = false;
    // Train plutôt qu'avion quand la route est trop longue mais le rail à portée (Ardennes, Bruges).
    let trainNeeded = null as TrainTrip | null;
    const byTrain = (roadKm: number | null) =>
      from ? trainTrip({ fromCountry: origin?.countryCode ?? 'FR', toCountry: anchor.countryCode, straightKm: distanceKm(from, target), roadKm, days, to: target }) : null;
    const takeTrain = (rail: TrainTrip) => {
      trainNeeded = rail;
      transport = { mode: 'train', km: rail.railKm, minutes: rail.minutesOneWay, walkKm: 0, fuelEur: 0, basis: rail.basis };
    };
    // Sortie de quelques heures : pas de trajet à chiffrer (on part de chez soi).
    if (!from && ctx.modules.transport)
      notes.push('Position non partagée : le trajet jusqu’au départ est chiffré depuis la France, à ajuster.');
    const mode = !ctx.modules.transport
      ? 'aucun'
      : from
        ? approachMode({ straightKm: distanceKm(from, target), days })
        : abroad
          ? 'avion'
          : 'route';
    // Trop loin pour la route vu la durée : le train si le rail s'y prête (route
    // mesurée pour écarter une île), sinon l'avion.
    const railFirst =
      mode === 'avion' && byTrain(from ? distanceKm(from, target) : null)
        ? await routeAttempt([from!, target], 'voiture')
            .then((car) => (car.legs?.length ? byTrain(car.legs.reduce((t, l) => t + l.distanceKm, 0)) : null))
            .catch(() => null)
        : null;
    if (railFirst) takeTrain(railFirst);
    else if (mode === 'avion') {
      flightNeeded = true;
      transport = {
        mode: 'avion',
        km: Math.round(from ? distanceKm(from, target) : 0),
        minutes: 0,
        walkKm: 0,
        fuelEur: 0,
        basis: `vol aller-retour ${origin?.name ? `depuis ${origin.name}` : 'depuis la France'} vers ${anchor.name}`,
      };
    } else if (mode === 'route' && from) {
      const car = await routeAttempt([from, target], 'voiture');
      if (car.legs?.length) {
        const km = car.legs.reduce((t, l) => t + l.distanceKm, 0);
        const min = car.legs.reduce((t, l) => t + l.durationMin, 0);
        const last = car.legs[car.legs.length - 1].geometry.at(-1);
        let walkKm = 0;
        if (last) {
          const end = { lat: last[1], lon: last[0] };
          if (haversineKm(end, target) * 1000 > ARRIVAL_TOLERANCE_M) {
            const walk = await routeAttempt([end, target], 'pieton');
            walkKm = walk.legs?.reduce((t, l) => t + l.distanceKm, 0) ?? haversineKm(end, target);
          }
        }
        const rail = min > maxDriveMinutes(days) ? byTrain(km) : null;
        if (rail) takeTrain(rail);
        else if (min > maxDriveMinutes(days)) {
          // Route trop longue pour la durée du voyage, rail hors de portée : l'avion.
          flightNeeded = true;
          transport = {
            mode: 'avion',
            km: Math.round(distanceKm(from, target)),
            minutes: 0,
            walkKm: 0,
            fuelEur: 0,
            basis: `${Math.round(min / 60)} h de route à l’aller pour ${days} jour${days > 1 ? 's' : ''} : vol vers ${anchor.name}`,
          };
        } else {
          carFuel = estimateCarTrip({ oneWayKm: km, oneWayMin: min, partySize: party });
          if (carFuel)
            transport = {
              mode: 'voiture',
              km: carFuel.oneWayKm,
              minutes: carFuel.oneWayMin,
              walkKm: Math.round(walkKm * 10) / 10,
              fuelEur: carFuel.fuelEur,
              basis: carFuel.basis,
            };
        }
      } else if (distanceKm(from, target) <= FLIGHT_THRESHOLD_KM) {
        // Itinéraire non calculé (panne, débit, tracé qui n'arrive pas pile au
        // lieu) mais destination à portée de route : trajet estimé (vol
        // d'oiseau × 1,3 à 80 km/h), jamais un vol à 450 km.
        const km = Math.round(distanceKm(from, target) * 1.3);
        carFuel = estimateCarTrip({ oneWayKm: km, oneWayMin: Math.round((km / 80) * 60), partySize: party });
        if (carFuel) {
          transport = { mode: 'voiture', km: carFuel.oneWayKm, minutes: carFuel.oneWayMin, walkKm: 0, fuelEur: carFuel.fuelEur, basis: carFuel.basis };
          const why: Record<string, string> = {
            off_network: 'tracé qui n’arrive pas au lieu',
            provider_unavailable: 'service de calcul injoignable',
            rate_limited: 'trop de calculs d’affilée',
          };
          console.warn('[compas] trajet d’approche non calculé', car.reason ?? 'inconnu');
          notes.push(
            `Trajet en voiture estimé (itinéraire routier non calculé : ${why[car.reason ?? ''] ?? 'raison inconnue'}) : à vérifier, traversée en ferry éventuelle non comptée.`
          );
        }
      } else {
        // Pas de route (île, autre continent) : l'avion ou le bateau s'imposent.
        flightNeeded = true;
        transport = { mode: 'avion', km: Math.round(distanceKm(from, target)), minutes: 0, walkKm: 0, fuelEur: 0, basis: `aucune route praticable vers ${anchor.name}` };
      }
    } else if (mode === 'sur_place') notes.push('Tu es déjà au départ : aucun trajet à prévoir.');
```

with:

```ts
    lap('5');
    /* 5. Venir : d'où l'on part (« depuis X » dit, sinon la position, jamais la
       France par défaut), puis la route mesurée, le train ou l'avion d'aéroport
       à aéroport (`engine/travel.ts`). Sans point de départ, rien n'est chiffré. */
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    const saidOrigin = originOf(compasMeta(meta).origin);
    // La commune, pas le lieu le plus proche du point (« depuis Chantier Hotel
    // de Ville » au lieu d'Annecy, 8 oct.) ; inutile quand le départ est dit.
    const near = !saidOrigin && from ? await lookupReverse(from.lat, from.lon) : null;
    const leg = await planTravelLeg(
      {
        origin: travelOrigin(
          saidOrigin,
          from
            ? {
                lat: from.lat,
                lon: from.lon,
                name: near ? (near.locality ?? near.name) : null,
                country: near?.country ?? null,
                countryCode: near?.countryCode ?? null,
              }
            : null
        ),
        target,
        destination: { name: anchor.name, countryCode: anchor.countryCode },
        days,
        party,
        transport: ctx.modules.transport,
      },
      {
        carRoute: async (a, b) => {
          const car = await routeAttempt([a, b], 'voiture');
          if (!car.legs?.length) {
            console.warn('[compas] trajet d’approche non calculé', car.reason ?? 'inconnu');
            return { failure: car.reason ?? null };
          }
          const last = car.legs[car.legs.length - 1].geometry.at(-1);
          return {
            km: car.legs.reduce((t, l) => t + l.distanceKm, 0),
            minutes: car.legs.reduce((t, l) => t + l.durationMin, 0),
            end: last ? { lat: last[1], lon: last[0] } : null,
          };
        },
        walkKm: async (end, to) => {
          if (haversineKm(end, to) * 1000 <= ARRIVAL_TOLERANCE_M) return 0;
          const walk = await routeAttempt([end, to], 'pieton');
          return walk.legs?.reduce((t, l) => t + l.distanceKm, 0) ?? haversineKm(end, to);
        },
        airport: (p) => nearestAirport(p.lat, p.lon),
      }
    );
    notes.push(...leg.notes);
    const { origin, abroad, transport, carFuel } = leg;
    const flightNeeded = leg.flight != null;
    // Train plutôt qu'avion quand la route est trop longue mais le rail à portée (Ardennes, Bruges).
    const trainNeeded = leg.train;
```

AI facts (step 7) — replace:

```ts
      `Départ de la personne : ${origin?.name ? `${origin.name}${origin.country ? `, ${origin.country}` : ''}` : 'France (position non partagée)'}.`,
```

with:

```ts
      `Départ de la personne : ${originFact(origin)}.`,
```

and replace:

```ts
      abroad ? 'Voyage à l’étranger : oui.' : 'Voyage à l’étranger : non.',
```

with:

```ts
      abroad === true ? 'Voyage à l’étranger : oui.' : abroad === false ? 'Voyage à l’étranger : non.' : 'Voyage à l’étranger : inconnu.',
```

Budget (step 8) — replace the Paris fallback:

```ts
    // Vol : distance à vol d'oiseau depuis la position partagée, sinon depuis Paris.
    const flightKm = distanceKm(from ?? { lat: 48.8566, lon: 2.3522 }, target);
    const flight = flightRoundTrip(flightKm);
```

with:

```ts
    // Vol : d'aéroport à aéroport (OurAirports), sinon du départ au lieu ; sans départ, aucun vol.
    const flight = leg.flight ? flightRoundTrip(leg.flight.km) : null;
```

Replace:

```ts
    const entry = abroad ? entryFees(anchor.countryCode) : null;
```

with:

```ts
    // Formalités (barème pour un voyageur français) : gardées tant qu'on ne sait pas
    // que la personne est déjà dans le pays ; départ inconnu = pays de départ inconnu.
    const entry = abroad !== false ? entryFees(anchor.countryCode) : null;
```

In the budget lines, replace:

```ts
      flightNeeded
        ? {
            category: 'transport',
            title: `Vol aller-retour × ${party}`,
```

with:

```ts
      flight
        ? {
            category: 'transport',
            title: `Vol aller-retour × ${party}`,
```

Replace:

```ts
      abroad || (maxAltitude ?? 0) >= 2500
        ? {
            category: 'divers',
            title: 'Assurance voyage et rapatriement',
            amount: insurance(days, { abroad, altitudeM: maxAltitude }) * party,
```

with:

```ts
      abroad === true || (maxAltitude ?? 0) >= 2500
        ? {
            category: 'divers',
            title: 'Assurance voyage et rapatriement',
            amount: insurance(days, { abroad: abroad === true, altitudeM: maxAltitude }) * party,
```

In the final `return`, replace:

```ts
      summary: { nights: nightsOut, transport, kit: kitCount, budget: lines, total, notes: orderNotes(essential, notes, aiNotes), usedAi, stepsCreated },
```

with:

```ts
      summary: {
        nights: nightsOut,
        transport,
        ...(leg.originUnknown ? { originUnknown: true } : {}),
        kit: kitCount,
        budget: lines,
        total,
        notes: orderNotes(essential, notes, aiNotes),
        usedAi,
        stepsCreated,
      },
```

(`distanceKm`, `haversineKm`, `routeAttempt`, `ARRIVAL_TOLERANCE_M`, `lookupReverse`, `compasMeta`, `flightRoundTrip`, `entryFees`, `insurance` stay imported: they are still used. `flightNeeded`, `trainNeeded`, `transport`, `carFuel`, `origin`, `abroad` keep their names, so the facts, rental and budget code below step 5 is unchanged apart from the replacements above.)

- [ ] **Step 6: The screen line**

In `src/features/compas/components/CompasScreen.tsx`, replace:

```tsx
import { NIGHT_LABEL } from '../engine/autofill';
```

with:

```tsx
import { NIGHT_LABEL } from '../engine/autofill';
import { travelDigest } from '../engine/travel';
```

and in `autofillDigest` replace:

```tsx
  if (s.transport)
    parts.push(
      s.transport.mode === 'avion'
        ? 'vol à prévoir'
        : s.transport.mode === 'train'
          ? `train, environ ${String(Math.round(s.transport.minutes / 30) / 2).replace('.', ',')} h`
          : `${Math.round(s.transport.km)} km de route`
    );
```

with:

```tsx
  // Le trajet, ou « Trajet non chiffré : point de départ inconnu » (engine/travel.ts).
  const travel = travelDigest(s.transport, s.originUnknown);
  if (travel) parts.push(travel);
```

(`engine/travel.ts` only imports pure engine modules and a type from `engine/airports.ts`; the airports JSON never reaches the client — the Task 3 guard test re-checks it.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/travel.test.ts src/features/compas/__tests__/compasScreen.test.tsx src/features/compas/__tests__/airports.test.ts`
Expected: PASS (the existing screen assertion « 1 refuge, 1 bivouac · 412 km de route · 4 objets au kit » still passes unchanged).

Run: `npx vitest run src/features/compas`
Expected: PASS.

Run: `grep -n -i "48\.8566\|depuis la France\|position non partagée\|?? 'FR'" src/features/compas/server/autofillActions.ts src/features/compas/engine/travel.ts`
Expected: no output (no France/Paris default left in the travel leg or the AI facts).

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no error.

Run: `npx eslint src/features/compas/engine/travel.ts src/features/compas/server/autofillActions.ts src/features/compas/components/CompasScreen.tsx src/features/compas/__tests__/travel.test.ts`
Expected: no error (the removed imports `estimateCarTrip`, `approachMode`, `maxDriveMinutes`, `FLIGHT_THRESHOLD_KM`, `trainTrip`, `TrainTrip` are no longer used in `autofillActions.ts`).

- [ ] **Step 8: Commit**

```bash
git add src/features/compas/engine/travel.ts src/features/compas/__tests__/travel.test.ts src/features/compas/server/autofillActions.ts src/features/compas/components/CompasScreen.tsx src/features/compas/__tests__/compasScreen.test.tsx
git commit -m "$(cat <<'MSG'
fix(compas): trajet depuis le départ dit, jamais la France par défaut

Départ « depuis X » d'abord, puis la position, sinon rien n'est chiffré
et l'écran le dit (« Trajet non chiffré : point de départ inconnu »).
Plus de Paris ni de « depuis la France » dans le trajet ni dans les faits
donnés à l'IA. Vol d'aéroport à aéroport (OurAirports), distance entre
les deux ; même aéroport aux deux bouts : la route. Trajet calculé par
un module pur testé (engine/travel.ts).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 5: Journée à plus de 3 h de trajet signalée, crédit OurAirports, PLAN-100 et ETAT

**Files:**
- Modify: `src/features/compas/engine/travel.ts` (created in Task 4: new `DAY_TRIP_MAX_MINUTES`, `estimatedDriveMinutes`, `dayTripNote`; `planTravelLeg` wraps the former body, renamed `chooseLeg`; sortie branch; estimated road)
- Create: `src/features/compas/__tests__/dayTrip.test.ts`
- Modify: `src/app/mentions-legales/page.tsx` (`DATA_SOURCES`)
- Modify: `docs/compas/PLAN-100.md` (§4.3 three boxes, §4.4 third box)
- Modify: `docs/compas/ETAT.md` (one lot N line)

**Interfaces:**
- Consumes (Task 4, `engine/travel.ts`): `planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg>`, `travelOrigin(said, gps)`, types `TravelLegInput`, `TravelDeps`, `CarRouteResult`; `distanceKm` (already imported there); `estimateCarTrip` (already imported there).
- Produces (`engine/travel.ts`):
  - `export const DAY_TRIP_MAX_MINUTES = 180`
  - `export function estimatedDriveMinutes(straightKm: number): number` — `Math.round((Math.round(straightKm * 1.3) / 80) * 60)`, the same estimate as the road fallback.
  - `export function dayTripNote(days: number, minutesOneWay: number | null): string | null` — `days <= 1` and minutes `> 180` → `` `${h} h ${mm} de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.` `` (minutes on two digits), else null.
  - `planTravelLeg` now appends that note when the chosen car or train time is known (a flight has `minutes: 0` = unknown → no note); with no transport module (`scope: 'sortie'`) and a known origin, it decides from `estimatedDriveMinutes(distanceKm(origin, target))` and prices nothing.
- `autofillActions.ts` needs no change: it already pushes `leg.notes` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `src/features/compas/__tests__/dayTrip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DAY_TRIP_MAX_MINUTES,
  dayTripNote,
  estimatedDriveMinutes,
  planTravelLeg,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
} from '../engine/travel';

const ANNECY = { name: 'Annecy', lat: 45.9, lon: 6.13, countryCode: 'FR' };
const MERCANTOUR = { lat: 44.15, lon: 7.1 };
const deps = (car: CarRouteResult): TravelDeps => ({
  carRoute: async () => car,
  walkKm: async () => 0,
  airport: () => null,
});
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(ANNECY, null),
  target: MERCANTOUR,
  destination: { name: 'Mercantour', countryCode: 'FR' },
  days: 1,
  party: 2,
  transport: true,
  ...over,
});

describe('une journée à plus de 3 h de trajet aller est signalée', () => {
  it('le texte, à la minute', () => {
    expect(DAY_TRIP_MAX_MINUTES).toBe(180);
    expect(dayTripNote(1, 200)).toBe(
      '3 h 20 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.'
    );
    expect(dayTripNote(1, 185)).toBe(
      '3 h 05 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.'
    );
  });

  it('CONTRE-EXEMPLES : 3 h pile, deux jours, temps inconnu', () => {
    expect(dayTripNote(1, 180)).toBeNull();
    expect(dayTripNote(2, 300)).toBeNull();
    expect(dayTripNote(1, null)).toBeNull();
  });

  it('Mercantour depuis Annecy, une journée, 200 min de route mesurée : la note, la route chiffrée', async () => {
    const leg = await planTravelLeg(input({}), deps({ km: 260, minutes: 200, end: null }));
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 260, minutes: 200 });
    expect(leg.notes).toEqual([
      '3 h 20 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
  });

  it('le même trajet sur deux jours : rien à dire', async () => {
    const leg = await planTravelLeg(input({ days: 2 }), deps({ km: 260, minutes: 200, end: null }));
    expect(leg.notes).toEqual([]);
  });

  it('en train aussi (Lyon → Paris, route de 5 h 01 : train de 4 h 58)', async () => {
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR' }, null),
        target: { lat: 48.86, lon: 2.35 },
        destination: { name: 'Paris', countryCode: 'FR' },
      }),
      deps({ km: 465, minutes: 301, end: null })
    );
    expect(leg.transport).toMatchObject({ mode: 'train', km: 491, minutes: 298 });
    expect(leg.notes).toEqual([
      '4 h 58 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
  });

  it('sortie de quelques heures (aucun trajet chiffré) : le temps estimé décide, rien n’est chiffré', async () => {
    // 209 km à vol d'oiseau × 1,3 à 80 km/h = 204 min.
    expect(estimatedDriveMinutes(209)).toBe(204);
    const leg = await planTravelLeg(input({ transport: false }), deps({ km: 260, minutes: 200, end: null }));
    expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null });
    expect(leg.notes).toEqual([
      '3 h 24 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
    // Sans départ connu, ni chiffre ni note.
    expect((await planTravelLeg(input({ transport: false, origin: null }), deps({ failure: null }))).notes).toEqual([]);
  });

  it('un vol n’a pas de durée connue : pas de note', async () => {
    const leg = await planTravelLeg(
      input({ target: { lat: 40.08, lon: 9.03 }, destination: { name: 'Sardaigne', countryCode: 'IT' } }),
      deps({ km: 1100, minutes: 840, end: null })
    );
    expect(leg.transport?.mode).toBe('avion');
    expect(leg.notes).toEqual([]);
  });
});
```

(204 min = 209 km Annecy (45.9, 6.13) → Mercantour (44.15, 7.1) × 1.3 = 272 km at 80 km/h; Lyon → Paris: 392 km straight, the measured road of 301 min is over `maxDriveMinutes(1) = 300`, the train rule gives 491 km of rail and 298 min ≤ `maxTrainMinutes(1) = 330`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/dayTrip.test.ts`
Expected: FAIL — `DAY_TRIP_MAX_MINUTES`, `dayTripNote`, `estimatedDriveMinutes` are not exported; no note is produced.

- [ ] **Step 3: The note in the planner**

In `src/features/compas/engine/travel.ts`, replace:

```ts
/**
 * Le trajet d'approche, comme la préparation l'écrit : route mesurée si elle
 * est raisonnable pour la durée, sinon le train (pays reliés, pas d'île),
 * sinon l'avion d'aéroport à aéroport. Sans point de départ : rien.
 */
export async function planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
```

with:

```ts
/** Au-delà de 3 h de trajet aller, une journée seule ne tient plus (PLAN-100 4.4). */
export const DAY_TRIP_MAX_MINUTES = 180;

/** Route estimée à l'aller : vol d'oiseau × 1,3 à 80 km/h (comme quand l'itinéraire n'est pas calculé). */
export function estimatedDriveMinutes(straightKm: number): number {
  return Math.round((Math.round(straightKm * 1.3) / 80) * 60);
}

/**
 * Une journée (ou moins) à plus de 3 h de trajet aller : « 3 h 20 de trajet
 * aller pour une seule journée : … ». null sinon, ou quand le temps n'est pas connu.
 */
export function dayTripNote(days: number, minutesOneWay: number | null): string | null {
  if (days > 1 || minutesOneWay == null || !(minutesOneWay > DAY_TRIP_MAX_MINUTES)) return null;
  const m = Math.round(minutesOneWay);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.`;
}

/**
 * Le trajet d'approche, comme la préparation l'écrit : route mesurée si elle
 * est raisonnable pour la durée, sinon le train (pays reliés, pas d'île),
 * sinon l'avion d'aéroport à aéroport. Sans point de départ : rien. Une
 * journée à plus de 3 h de trajet aller est signalée (Mercantour depuis Annecy).
 */
export async function planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
  const leg = await chooseLeg(input, deps);
  // Temps connu : route mesurée ou estimée, train ; un vol n'a pas de durée connue.
  const minutes = leg.transport && leg.transport.mode !== 'avion' ? leg.transport.minutes : null;
  const note = dayTripNote(input.days, minutes);
  if (note) leg.notes.push(note);
  return leg;
}

async function chooseLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
```

Then, at the top of `chooseLeg` (the former body), replace the sortie early return:

```ts
  // Sortie de quelques heures : pas de trajet à chiffrer.
  if (!input.transport) return leg;
```

with:

```ts
  // Sortie de quelques heures : rien à chiffrer. Partie de loin (départ connu),
  // le temps de route estimé est dit quand la journée ne tient pas.
  if (!input.transport) {
    const note = origin ? dayTripNote(days, estimatedDriveMinutes(distanceKm(origin, target))) : null;
    if (note) leg.notes.push(note);
    return leg;
  }
```

And in the estimated-road branch (route not computed but within reach), replace:

```ts
    const km = Math.round(straight * 1.3);
    leg.carFuel = estimateCarTrip({ oneWayKm: km, oneWayMin: Math.round((km / 80) * 60), partySize: party });
```

with:

```ts
    leg.carFuel = estimateCarTrip({
      oneWayKm: Math.round(straight * 1.3),
      oneWayMin: estimatedDriveMinutes(straight),
      partySize: party,
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/dayTrip.test.ts src/features/compas/__tests__/travel.test.ts`
Expected: PASS (7 + 15 tests; the Task 4 tests are unchanged — none of their trips is a day trip over 3 h).

Run: `npx vitest run src/features/compas`
Expected: PASS.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no error.

- [ ] **Step 5: Commit the code**

```bash
git add src/features/compas/engine/travel.ts src/features/compas/__tests__/dayTrip.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): journée à plus de 3 h de trajet aller signalée

Une journée (ou une sortie) dont le trajet aller dépasse 3 h, route
mesurée, train ou temps estimé quand rien n'est chiffré : « 3 h 24 de
trajet aller pour une seule journée : prévois une nuit sur place ou
choisis plus près. » (Mercantour depuis Annecy).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

- [ ] **Step 6: Credit OurAirports with the other data sources**

In `src/app/mentions-legales/page.tsx` (list `DATA_SOURCES`, rendered by both the mobile and desktop views), replace:

```tsx
      '), données importées et réduites aux lieux habités.',
    ],
  },
```

with:

```tsx
      '), données importées et réduites aux lieux habités.',
    ],
  },
  {
    label: 'Aéroports',
    parts: [
      { text: 'OurAirports', href: 'https://ourairports.com/data/' },
      ' (domaine public) : aéroports à vols réguliers, pour estimer un vol d’aéroport à aéroport.',
    ],
  },
```

Run: `grep -n "OurAirports" src/app/mentions-legales/page.tsx`
Expected: one line with `{ text: 'OurAirports', href: 'https://ourairports.com/data/' }`.

(`docs/compas/SERVICES-GRATUITS.md` already lists OurAirports — public domain, no attribution required. The Compas « Sources » sheet lists per-trip sources from `CompasData`, which does not carry the preparation summary; see « Notes on the scope », item 7.)

- [ ] **Step 7: Tick PLAN-100 §4.3 and §4.4 (third box), one line of evidence each**

In `docs/compas/PLAN-100.md`, replace:

```markdown
- [ ] Origine = ville dite (« depuis Lyon »), domicile du profil ou GPS ; **jamais la
      France par défaut** ; sans origine, le trajet n'est pas chiffré (dit à l'écran).
- [ ] Action « depuis X » dans la compréhension de la phrase.
- [ ] Aéroport le plus proche de l'origine et de la destination (OurAirports, CC0).
```

with:

```markdown
- [x] Origine = ville dite (« depuis Lyon »), domicile du profil ou GPS ; **jamais la
      France par défaut** ; sans origine, le trajet n'est pas chiffré (dit à l'écran).
      Lot N : départ dit (`metadata.compas.origin`) > GPS > aucun ; plus de Paris ni de
      « depuis la France » ; sans départ, rien de chiffré et « Trajet non chiffré : point de
      départ inconnu » (`travel.test.ts`). Domicile du profil : attend le profil (4.1).
- [x] Action « depuis X » dans la compréhension de la phrase. Lot N : `set_origin` lu par les
      règles (« depuis », « au départ de », « en partant de », « on part de »), jamais pris pour
      la destination, appliqué par la même recherche que la destination
      (`intentOrigin.test.ts`, `originInterpret.test.ts`, `originAction.test.ts`).
- [x] Aéroport le plus proche de l'origine et de la destination (OurAirports, CC0). Lot N :
      3 244 aéroports desservis (domaine public), un aéroport moyen compte 1,6 fois sa
      distance, vol d'aéroport à aéroport (« LYS → CAG », `airports.test.ts`, `travel.test.ts`).
```

and replace:

```markdown
- [ ] Journée à plus de 3 h de trajet signalée (Mercantour depuis Annecy).
```

with:

```markdown
- [x] Journée à plus de 3 h de trajet signalée (Mercantour depuis Annecy). Lot N : route
      mesurée, train, ou temps estimé pour une sortie ; « 3 h 24 de trajet aller pour une
      seule journée : prévois une nuit sur place ou choisis plus près. » (`dayTrip.test.ts`).
```

- [ ] **Step 8: One line in ETAT.md**

In `docs/compas/ETAT.md`, insert this line as the last line of the « Mis à jour » block, i.e. right after the lot M line (`Lot M (plan `docs/superpowers/plans/2026-10-09-compas-lot-m.md`, PLAN-100 4.7) : …`) and before the blank line that precedes `**À faire par Tony** (rien d'autre ne bloque) :`:

```markdown
Lot N (plan `docs/superpowers/plans/2026-10-09-compas-lot-n.md`, PLAN-100 4.3 et 4.4) : « depuis Lyon » compris et rangé sur le voyage, trajet depuis le départ dit puis la position, jamais la France par défaut (sinon non chiffré, dit à l'écran), vol d'aéroport à aéroport (OurAirports, 3 244 aéroports), journée à plus de 3 h de trajet aller signalée ; tests verts, à prouver sur l'aperçu.
```

The block then ends:

```markdown
Lot M (plan `docs/superpowers/plans/2026-10-09-compas-lot-m.md`, PLAN-100 4.7) : « aujourd'hui » au fuseau du navigateur, … ; tests verts, à prouver sur l'aperçu.
Lot N (plan `docs/superpowers/plans/2026-10-09-compas-lot-n.md`, PLAN-100 4.3 et 4.4) : « depuis Lyon » compris et rangé sur le voyage, trajet depuis le départ dit puis la position, jamais la France par défaut (sinon non chiffré, dit à l'écran), vol d'aéroport à aéroport (OurAirports, 3 244 aéroports), journée à plus de 3 h de trajet aller signalée ; tests verts, à prouver sur l'aperçu.

**À faire par Tony** (rien d'autre ne bloque) :
```

- [ ] **Step 9: Final checks**

Run: `npx vitest run src/features/compas src/lib/ai`
Expected: PASS.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no error.

Run: `npx eslint src/features/compas/engine/travel.ts src/features/compas/engine/airports.ts src/features/compas/server/airports.ts src/features/compas/server/autofillActions.ts src/features/compas/components/CompasScreen.tsx src/features/compas/components/compasApply.ts src/features/compas/engine/intent.ts src/features/compas/server/compasActions.ts src/features/compas/server/getCompasData.ts src/features/compas/server/compasServer.ts src/features/compas/engine/tripContext.ts src/features/compas/engine/dependencies.ts src/lib/ai/features/compasIntent.ts src/app/mentions-legales/page.tsx`
Expected: no error.

Run: `grep -rn "from '[./]*\(server/\|data/\)\?airports\(\.json\)\?'" src --include=*.ts --include=*.tsx | grep -v __tests__`
Expected: exactly three lines — `src/features/compas/server/airports.ts` (`import AIRPORTS from '../data/airports.json';`), `src/features/compas/server/autofillActions.ts` (`import { nearestAirport } from './airports';`, a `'use server'` file) and `src/features/compas/engine/travel.ts` (`import type { AirportPick } from './airports';`, the pure engine module). No component appears.

- [ ] **Step 10: Commit the docs**

```bash
git add src/app/mentions-legales/page.tsx docs/compas/PLAN-100.md docs/compas/ETAT.md
git commit -m "$(cat <<'MSG'
docs(compas): lot N, PLAN-100 4.3 et 4.4 (3e case) cochées, OurAirports crédité

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

## Self-review (done while writing)

- **Spec coverage.** Decision 1 (« depuis X » by rules, `set_origin` 1-80 chars in the schema and the AI contract, destination fallback never takes it, `RULES_FIRST`, label « Départ : X ») → Task 1. Decision 2 (same geocoding path and `compas-destination` limit, `metadata.compas.origin = { name, lat, lon, countryCode, source: 'dit' }` rounded by `coarsePosition`, atomic `updateTripMetadata`, clearing) → Task 2 (plus « Annuler » and the re-adapt basis). Decision 3 (said > GPS > none, no FR/Paris anywhere, exact note, AI fact « inconnu », screen line, Paris coordinates deleted) → Task 4 (planner + wiring + grep check). Decision 4 (script, filter, JSON + meta, run once and commit, `server/airports.ts` server-only, pure scorer with rows as argument, 300 km, × 1.6) → Task 3. Decision 5 (airport to airport, km between airports with fallback, basis « vol aller-retour LYS → OLB (… → …), environ N km », same bands, same airport → no flight) → Task 4. Decision 6 (one day or less, known time > 180 min, exact note, `sortie` estimate × 1.3 at 80 km/h, nothing priced) → Task 5. Decision 7 (four PLAN-100 boxes with evidence, « domicile du profil » waiting for 4.1, ETAT line, OurAirports credit) → Task 5. Required test cases: Vercors + Lyon (Task 1 `intentOrigin` and `originInterpret`), « au départ de Genève » (Task 1), no origin prices nothing with the exact note (Task 4 `travel.test.ts`), said origin beats GPS (Task 4), Lyon → Sardaigne names LYS and CAG with airport km (Task 4), one-day trip with 200 min gets the note (Task 5 `dayTrip.test.ts`), generated JSON shape with LYS, CDG, OLB (Task 3).
- **Placeholder scan.** Every code step carries the complete file or the exact old/new snippet (copied from the current code at `6fce2dd`); every test has its full code and its exact expected strings; no « TBD », no « similar to Task N ».
- **Type consistency.** `set_origin { place }` (Tasks 1, 2); `ApplyOp { op: 'origin'; place: string | null }`, `compasSetOriginAction({ tripId, tripSlug, place })`, `CompasData.originName` (Task 2); `TripOrigin`, `originOf(raw)` (Tasks 2, 4); `ProjectBasis.origin` (Task 2); `AirportRow`, `AirportPick { iata, name, km, country, lat, lon }`, `nearestAirportIn(rows, lat, lon, opts?)`, `nearestAirport(lat, lon, opts?)` (Tasks 3, 4); `TravelOrigin`, `TravelTransport` (with `route?`), `TravelFlight`, `TravelLeg`, `CarRouteResult`, `TravelDeps { carRoute, walkKm, airport }`, `TravelLegInput`, `travelOrigin`, `abroadOf`, `originFact`, `travelDigest`, `planTravelLeg`, `UNKNOWN_ORIGIN_NOTE`, `UNKNOWN_ORIGIN_LINE`, `ON_SITE_NOTE` (Tasks 4, 5); `DAY_TRIP_MAX_MINUTES`, `estimatedDriveMinutes`, `dayTripNote` (Task 5); `CompasAutofillSummary.transport: TravelTransport | null`, `originUnknown?: boolean` (Task 4). Same names in every task that produces or consumes them.
- **Client bundle.** `engine/airports.ts` and `engine/travel.ts` are pure (no JSON, no server import); the JSON is imported only by `server/airports.ts` (`import 'server-only'`), itself imported only by `autofillActions.ts` (`'use server'`). Task 3's guard test walks every `'use client'` file and its imports; Task 5 Step 9 greps the three import lines.
- **Not covered by an automated test (review by reading):** the dependency closures inside `autofillActions.ts` (`routeAttempt` → `CarRouteResult`, walk tolerance `ARRIVAL_TOLERANCE_M`, no reverse geocoding when the origin is said, `flightRoundTrip(leg.flight.km)`, `entry` when `abroad !== false`, insurance when `abroad === true`, the two AI-fact lines). The existing autofill harnesses stop before step 5; each decision those lines delegate to is unit-tested in `travel.test.ts` / `dayTrip.test.ts`, and Task 4 Step 7 greps that no France/Paris default is left.
