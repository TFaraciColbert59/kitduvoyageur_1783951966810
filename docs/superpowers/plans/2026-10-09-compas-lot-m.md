# Compas lot M — le temps juste (PLAN-100 §4.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Compas tells the time right everywhere: « aujourd'hui » is the traveller's (browser) date, sun times and the advised departure are in the destination's time zone, winter follows the hemisphere, and a tropical destination missing from the dry-season table gets its driest month from NASA POWER normals instead of no period at all.

**Architecture:** A new pure module `src/features/compas/engine/zone.ts` (no server import, no `tz-lookup`) owns « aujourd'hui » and zone checks; the browser sends its IANA zone to the two server actions that need a date; the server alone resolves the destination zone with `tz-lookup` (`server/weather.ts`) and hands it to the screen as `CompasData.zone`. Sun-time consumers read `"HH:MM"` through one pure parser (`clockMinutes`). Seasons: `projectContext` shifts winter by six months south of the equator; `bestPeriod` accepts optional precipitation normals fetched server-side from the NASA POWER climatology endpoint.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript strict, zod, Vitest (+ jsdom / Testing Library for screen tests), `@photostructure/tz-lookup` and `suncalc` (already installed).

**Spec:** `docs/compas/PLAN-100.md` §4.7 + `.superpowers/sdd/2026-10-09-compas-lot-m/scope.md`

## Global Constraints

- No new npm dependency.
- `@photostructure/tz-lookup` never imported from a client component (`'use client'` file or anything they import). It stays in `src/features/compas/server/weather.ts` (and `src/lib/weather/metnoFetch.ts`). `engine/zone.ts` must never import it, nor `server-only`, nor any `server/*` module.
- UI text in French, tutoiement, no new colour literal and never `#E4501C`.
- Mobile views use inline styles (no Tailwind).
- Every server action input validated with zod.
- Tests with Vitest (`npx vitest run <path>`), never skip/disable a test. Updating an existing assertion to a new, intended contract is allowed and is called out explicitly in the steps.
- `npx tsc --noEmit -p tsconfig.json` clean.
- Commit messages in French, conventional prefix (`feat(compas): …`, `fix(compas): …`, `test(compas): …`, `docs(compas): …`), each ending with the two lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ`
- Never push (the controller pushes). Never chmod tracked files.
- Out of scope, do not touch: trip origin « depuis X », airports, 3 h day-trip warning, account timezone setting, `server/resaActions.ts:269`, `server/officialAlerts.ts`.
- `DEFAULT_TRAVELLER_ZONE = 'Europe/Paris'` is used ONLY when the client sent no valid zone (old clients, tests) or when the destination is not placed on the map yet.

## Notes on the scope

Facts checked against the code on 9 Oct. (HEAD `4cc6f2e`); where the code differs from the exploration report, the code wins:

1. **Two client callers of `compasInterpretAction`**, not one: `components/CompasScreen.tsx:590` (phrase kept from `CompasStart`) and `components/CompasDisLe.tsx:53` (« Dis-le » field). Both send the zone.
2. **Nothing is persisted for an autofill resumption besides `PendingRun`** (`server/autofillState.ts:13-24`: runId, stepIds, routeSet, notes, datesSet, restAt, stagesFallback). `from` and `phase` are never stored: every (re)launch comes from `CompasScreen.tsx:387` through `compasAutofillStartAction`, which hands `parsed.data` to `compasAutofillAction`. Passing `timeZone` through the schema is therefore enough; nothing new is written to `trips.metadata`.
3. **`compasModel.ts` already uses `input.timeZone` for daylight, and only there** (`engine/compasModel.ts:419-430`). The fix is upstream: `getCompasData` now passes the destination zone as `input.timeZone` (plus a doc comment on the field); the model code itself does not change.
4. **The first `resolveProjectContext` in `autofillActions.ts` (line 867) runs before the anchor is resolved (line 880+).** It receives the stored anchor's latitude (`readAnchor(meta)?.lat`, a pure read already in the file); the second call (`nightCtx`, line 1484, after the anchor is known) receives `anchor.lat`.
5. **NASA POWER credit:** credited in `src/app/mentions-legales/page.tsx:59-61`, `src/components/legal/PrivacyPolicySections.tsx:44` and the Quand calendar legend (`CompasOuFlows.tsx:789`), but **not in the Compas « Sources » list** (`CompasSheets.tsx:2962-2971`, `SourcesFlow`). Task 3 adds the chip there, the way MET Norway is credited.
6. **Three existing screen assertions compare exact call arguments** and must now include `timeZone` (`__tests__/compasScreen.test.tsx:759`, `:1436`, `:1510`). To keep them deterministic on any machine, the screen test mocks `browserTimeZone` to `'Europe/Paris'`.
7. **`QuandFlow` keeps `weather?.calendar[0]?.date` first** for its minimum date (that is now the destination's « aujourd'hui », the zone the trip dates are written in) and only replaces the `todayParis()` fallback by `browserToday()`.
8. **Docs are folded into Task 3** (its last steps, separate `docs(compas)` commit): the §4.7 evidence lines quote test files from all three tasks, so they are written once everything exists. The plan therefore has 3 tasks.
9. The NASA POWER climatology response was re-checked on 9 Oct. for Manaus (`latitude=-3.12&longitude=-60.02`): `PRECTOTCORR` = JAN 7.24, FEB 8.36, MAR 8.63, APR 8.72, MAY 6.62, JUN 3.97, JUL 2.44, AUG 1.61, SEP 2.26, OCT 3.33, NOV 4.5, DEC 6.87, ANN 5.36 (mm/day), `header.fill_value` = -999.0. These exact numbers are the test fixture.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/features/compas/engine/zone.ts` (new) | Pure: `DEFAULT_TRAVELLER_ZONE`, `localToday`, `safeTimeZone`, `travellerToday`, `browserTimeZone`, `browserToday`, `differentClock` | 1, 2 |
| `src/features/compas/server/weather.ts` | Re-exports `localToday`; `destinationZone`; weather « aujourd'hui » in the destination zone; NASA POWER normals fetch | 1, 3 |
| `src/features/compas/server/compasActions.ts` | `compasInterpretAction` takes `timeZone` | 1 |
| `src/features/compas/server/autofillActions.ts` | Autofill schema takes `timeZone`; hemisphere latitude to project context; normals for `bestPeriod` | 1, 3 |
| `src/features/compas/components/CompasScreen.tsx`, `CompasDisLe.tsx` | Send the browser zone | 1 |
| `src/features/compas/components/CompasStart.tsx`, `CompasSheets.tsx`, `CompasOuFlows.tsx` | Browser-local « aujourd'hui »; destination sun times + « heure locale »; NASA POWER source chip | 1, 2, 3 |
| `src/features/compas/engine/sun.ts` | `clockMinutes` | 2 |
| `src/features/compas/engine/kitRules.ts`, `engine/danger.ts` | Read `"HH:MM"` sun times | 2 |
| `src/features/compas/engine/weather.ts` | `departureAdvice` first-light rule | 2 |
| `src/features/compas/server/getCompasData.ts` | Destination zone → model + `CompasData.zone`; latitude to project context | 2, 3 |
| `src/features/compas/engine/compasModel.ts` | Doc of `CompasInput.timeZone` (destination zone) | 2 |
| `src/features/compas/engine/projectContext.ts` | Hemisphere-aware winter | 3 |
| `src/features/compas/engine/period.ts` | `driestMonth`, `needsDryNormals`, `NORMALS_WHY`, `bestPeriod` normals | 3 |
| `src/features/compas/engine/metno.ts` | `powerClimatology` (pure parse) | 3 |
| `docs/compas/PLAN-100.md`, `docs/compas/ETAT.md` | §4.7 boxes, lot M line | 3 |

---

### Task 1: « Aujourd'hui » du voyageur (navigateur) et de la destination (météo)

**Files:**
- Create: `src/features/compas/engine/zone.ts`
- Modify: `src/features/compas/server/weather.ts:1-12` (imports), `:66-77` (`localToday` moved out, re-exported), `:101-108` (add `destinationZone` after `zoneAt`), `:150-157` (`getCompasWeather` « aujourd'hui »)
- Modify: `src/features/compas/server/compasActions.ts:47` (import), `:1668-1671` (`interpretSchema`), `:1685-1686` (destructure), `:1706` (`today`)
- Modify: `src/features/compas/server/autofillActions.ts:105` (import), `:181-182` (schema), `:793` (destructure), `:838` (`today`)
- Modify: `src/features/compas/components/CompasScreen.tsx:42` (import), `:387` (autofill start call), `:590` (interpret call)
- Modify: `src/features/compas/components/CompasDisLe.tsx:6` (import), `:53` (interpret call)
- Modify: `src/features/compas/components/CompasStart.tsx:12` (import), `:47` (`today`)
- Modify: `src/features/compas/components/CompasSheets.tsx:81` (import), `:3575` (`today`)
- Modify: `src/features/compas/components/CompasOuFlows.tsx:24` (import), `:579-596` (`todayParis` removed)
- Create: `src/features/compas/__tests__/zone.test.ts`, `src/features/compas/__tests__/compasWeather.test.ts`
- Modify (tests): `src/features/compas/__tests__/actionLimits.test.ts:1` and end of file, `src/features/compas/__tests__/autofillStart.test.ts` (end of the `describe`), `src/features/compas/__tests__/compasScreen.test.tsx:17` (zone mock), `:759-764`, `:1436`, `:1510-1513`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (later tasks rely on these exact names):
  - `src/features/compas/engine/zone.ts` (pure, importable by client and server):
    - `export const DEFAULT_TRAVELLER_ZONE = 'Europe/Paris'`
    - `export function localToday(timeZone: string, now?: Date): string` — `AAAA-MM-JJ` in that zone, UTC date if the zone is unreadable.
    - `export function safeTimeZone(z: unknown): string | null` — a real IANA zone (≤ 64 chars) or `null`.
    - `export function travellerToday(timeZone: unknown, now?: Date): string` — `localToday(safeTimeZone(timeZone) ?? DEFAULT_TRAVELLER_ZONE, now)`.
    - `export function browserTimeZone(): string | null` — browser zone (call only from client code).
    - `export function browserToday(now?: Date): string` — browser-local date.
  - `src/features/compas/server/weather.ts` (server only): `export { localToday }` (re-export) and `export function destinationZone(point: { lat: number; lon: number } | null, fallback: string): string`.
  - `compasInterpretAction(input: { tripId: string; text: string; timeZone?: string })` and `compasAutofillStartAction` / `compasAutofillAction(input: { tripId; tripSlug; from; phase?; timeZone?: string })`; `timeZone` is `z.string().max(64).optional()`.
  - `getCompasWeather` keeps its signature; its `timeZone` is now only the fallback when the place gives no zone.

- [ ] **Step 1: Write the failing pure tests for `engine/zone.ts`**

Create `src/features/compas/__tests__/zone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAVELLER_ZONE,
  browserTimeZone,
  browserToday,
  localToday,
  safeTimeZone,
  travellerToday,
} from '../engine/zone';

/** 9 oct. 13 h UTC : 10 oct. 2 h à Auckland, 9 oct. 6 h à Los Angeles, 9 oct. 15 h à Paris. */
const AT = new Date('2026-10-09T13:00:00Z');

/** Le fuseau du processus, le temps d'un appel (Node relit `TZ` à chaque changement). */
function withTz<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

describe('« aujourd’hui » selon le fuseau', () => {
  it('localToday : la date du calendrier dans le fuseau donné', () => {
    expect(localToday('Pacific/Auckland', AT)).toBe('2026-10-10');
    expect(localToday('America/Los_Angeles', AT)).toBe('2026-10-09');
  });

  it('safeTimeZone : un fuseau IANA réel, sinon null', () => {
    expect(safeTimeZone('Pacific/Auckland')).toBe('Pacific/Auckland');
    expect(safeTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(safeTimeZone('Mars/Olympus')).toBeNull();
    expect(safeTimeZone('')).toBeNull();
    expect(safeTimeZone(42)).toBeNull();
    expect(safeTimeZone(undefined)).toBeNull();
    expect(safeTimeZone(`Europe/${'x'.repeat(60)}`)).toBeNull();
  });

  it('travellerToday : le fuseau envoyé par le navigateur, Paris seulement sans lui', () => {
    expect(travellerToday('Pacific/Auckland', AT)).toBe('2026-10-10');
    expect(travellerToday('America/Los_Angeles', AT)).toBe('2026-10-09');
    // 22 h 30 UTC : déjà le 10 à Paris, encore le 9 à Los Angeles.
    const late = new Date('2026-10-09T22:30:00Z');
    expect(DEFAULT_TRAVELLER_ZONE).toBe('Europe/Paris');
    expect(travellerToday(undefined, late)).toBe('2026-10-10');
    expect(travellerToday('Mars/Olympus', late)).toBe('2026-10-10');
    expect(travellerToday('America/Los_Angeles', late)).toBe('2026-10-09');
  });

  it('browserToday et browserTimeZone : la date et le fuseau du navigateur, pas ceux d’UTC', () => {
    expect(withTz('Pacific/Auckland', () => browserToday(AT))).toBe('2026-10-10');
    expect(withTz('America/Los_Angeles', () => browserToday(AT))).toBe('2026-10-09');
    expect(withTz('Pacific/Auckland', () => browserTimeZone())).toBe('Pacific/Auckland');
  });
});
```

- [ ] **Step 2: Write the failing weather test (« aujourd'hui » of the destination)**

Create `src/features/compas/__tests__/compasWeather.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// MET Norway passe par son point d'accès unique (limites, cache en base) : remplacé ici, sans réseau.
vi.mock('@/lib/weather/metnoRequest', () => ({
  metnoForecastUrl: (lat: number, lon: number) => `https://api.met.no/test?lat=${lat}&lon=${lon}`,
  metnoGet: vi.fn(async () => null),
}));

import { destinationZone, getCompasWeather, localToday } from '../server/weather';

/** 9 oct. 13 h UTC : déjà le 10 à Auckland, encore le 9 à Paris et à Los Angeles. */
const NOW = new Date('2026-10-09T13:00:00Z');
const TONGARIRO = { lat: -39.2, lon: 175.58 };
const YOSEMITE = { lat: 37.75, lon: -119.59 };

describe('météo du Compas : « aujourd’hui » de la destination', () => {
  afterEach(() => vi.restoreAllMocks());

  it('destinationZone : le fuseau du lieu, sinon le repli', () => {
    expect(destinationZone(TONGARIRO, 'Europe/Paris')).toBe('Pacific/Auckland');
    expect(destinationZone(YOSEMITE, 'Europe/Paris')).toBe('America/Los_Angeles');
    expect(destinationZone(null, 'Europe/Paris')).toBe('Europe/Paris');
  });

  it('localToday reste importable depuis le serveur météo', () => {
    expect(localToday('Pacific/Auckland', NOW)).toBe('2026-10-10');
  });

  it('calendrier daté au fuseau du départ, pas de Paris', async () => {
    // NASA POWER : réponse vide (tendance inconnue), aucun appel réseau réel.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    const nz = await getCompasWeather({ origin: TONGARIRO, tripDays: [], timeZone: 'Europe/Paris', now: NOW });
    expect(nz?.calendar[0]?.date).toBe('2026-10-10');
    expect(nz?.horizon).toBe('2026-10-19');
    // 10 oct. 3 h UTC : 20 h le 9 en Californie, alors que Paris est déjà au 10.
    const us = await getCompasWeather({
      origin: YOSEMITE,
      tripDays: [],
      timeZone: 'Europe/Paris',
      now: new Date('2026-10-10T03:00:00Z'),
    });
    expect(us?.calendar[0]?.date).toBe('2026-10-09');
  });

  it('le premier jour du voyage donne le fuseau, avant le point de départ', async () => {
    const w = await getCompasWeather({
      origin: null,
      tripDays: [{ day: 1, date: '2026-10-10', ...TONGARIRO }],
      timeZone: 'Europe/Paris',
      now: NOW,
    });
    expect(w?.horizon).toBe('2026-10-19');
  });
});
```

- [ ] **Step 3: Write the failing server-action tests**

In `src/features/compas/__tests__/actionLimits.test.ts`, replace line 1:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
```

and append at the very end of the file (after the last `});`):

```ts

describe('phrase : « aujourd’hui » au fuseau du voyageur (lot M)', () => {
  beforeEach(() => {
    h.calls = [];
    h.refuse = null;
    h.denied = false;
    vi.clearAllMocks();
    // 10 oct. 3 h UTC : déjà le 10 à Paris et à Auckland, encore le 9 (20 h) à Los Angeles.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T03:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  /** Première ligne de la consigne envoyée à l'IA : « Date du jour : … ». */
  const dayLine = async (timeZone?: string) => {
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors', timeZone });
    expect(res.success).toBe(true);
    return vi.mocked(askAI).mock.calls[0][0].prompt.split('\n')[0];
  };

  it('le fuseau du navigateur fait la date du jour', async () => {
    expect(await dayLine('America/Los_Angeles')).toBe('Date du jour : 2026-10-09 (vendredi).');
  });

  it('même instant, autre fuseau : autre date', async () => {
    expect(await dayLine('Pacific/Auckland')).toBe('Date du jour : 2026-10-10 (samedi).');
  });

  it('sans fuseau ou fuseau inconnu : Paris (repli des anciens écrans)', async () => {
    expect(await dayLine()).toBe('Date du jour : 2026-10-10 (samedi).');
    vi.mocked(askAI).mockClear();
    expect(await dayLine('Mars/Olympus')).toBe('Date du jour : 2026-10-10 (samedi).');
  });

  it('un fuseau démesuré est refusé par la validation', async () => {
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours', timeZone: 'x'.repeat(65) });
    expect(res).toEqual({ success: false, error: 'Phrase trop courte ou trop longue' });
    expect(askAI).not.toHaveBeenCalled();
  });
});
```

In `src/features/compas/__tests__/autofillStart.test.ts`, replace the end of the last test and the closing of the `describe`:

```ts
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token })).outcome).toMatchObject({
      success: false,
      error: expect.stringMatching(/arrêtée en cours de route/),
    });
  });
});
```

with:

```ts
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token })).outcome).toMatchObject({
      success: false,
      error: expect.stringMatching(/arrêtée en cours de route/),
    });
  });

  it('le fuseau du navigateur est accepté ; un fuseau démesuré est refusé (lot M)', async () => {
    const ok = await compasAutofillStartAction({
      tripId: TRIP,
      tripSlug: 'x',
      from: null,
      phase: 'all',
      timeZone: 'Pacific/Auckland',
    });
    expect(ok.success).toBe(true);
    const bad = await compasAutofillStartAction({
      tripId: TRIP,
      tripSlug: 'x',
      from: null,
      phase: 'all',
      timeZone: 'x'.repeat(65),
    });
    expect(bad).toEqual({ success: false, error: 'Requête invalide' });
  });
});
```

- [ ] **Step 4: Update the screen test to the new call contract (the browser zone is sent)**

In `src/features/compas/__tests__/compasScreen.test.tsx`, after line 17:

```tsx
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));
```

insert:

```tsx
// Fuseau du navigateur fixé : les appels comparés plus bas ne dépendent pas de la machine.
vi.mock('../engine/zone', async (orig) => ({
  ...(await orig<typeof import('../engine/zone')>()),
  browserTimeZone: () => 'Europe/Paris',
}));
```

Then update the three exact-argument assertions (intended contract change: the screen now sends `timeZone`). Replace:

```tsx
      expect(autofill.compasAutofillAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        from: null,
        phase: 'all',
      })
```

with:

```tsx
      expect(autofill.compasAutofillAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        from: null,
        phase: 'all',
        timeZone: 'Europe/Paris',
      })
```

Replace:

```tsx
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({ tripId: TRIP, text: 'rando à 4' })
```

with:

```tsx
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({
        tripId: TRIP,
        text: 'rando à 4',
        timeZone: 'Europe/Paris',
      })
```

Replace:

```tsx
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({
        tripId: TRIP,
        text: 'à 4, tranquille, 50 €',
      })
```

with:

```tsx
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({
        tripId: TRIP,
        text: 'à 4, tranquille, 50 €',
        timeZone: 'Europe/Paris',
      })
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/zone.test.ts src/features/compas/__tests__/compasWeather.test.ts src/features/compas/__tests__/actionLimits.test.ts src/features/compas/__tests__/autofillStart.test.ts src/features/compas/__tests__/compasScreen.test.tsx`

Expected: FAIL — `zone.test.ts` and `compasScreen.test.tsx` cannot resolve `../engine/zone`; `compasWeather.test.ts` fails with `destinationZone is not a function` (and the calendar dates are Paris dates); `actionLimits.test.ts` gets `Date du jour : 2026-10-10 (samedi).` for Los Angeles and a success for the 65-char zone; `autofillStart.test.ts` gets `success: true` for the 65-char zone.

- [ ] **Step 6: Create `src/features/compas/engine/zone.ts`**

```ts
/**
 * Compas — « aujourd'hui » et fuseaux horaires. Module PUR : aucun réseau,
 * aucune dépendance serveur ; lu par le serveur ET par le navigateur.
 *
 * - « Aujourd'hui » du voyageur : le fuseau de SON navigateur, envoyé par
 *   l'écran avec la phrase et la préparation (`browserTimeZone`). Paris
 *   (`DEFAULT_TRAVELLER_ZONE`) n'est qu'un repli, quand rien de valable n'est
 *   envoyé (ancien écran, tests).
 * - Les dates de la météo et du soleil sont celles de la DESTINATION : son
 *   fuseau se retrouve côté serveur (`destinationZone`, `server/weather.ts`).
 *   `@photostructure/tz-lookup` n'entre jamais ici (poids du navigateur).
 */

/** Repli quand le navigateur n'a envoyé aucun fuseau valable. */
export const DEFAULT_TRAVELLER_ZONE = 'Europe/Paris';

/** Date du jour (AAAA-MM-JJ) dans un fuseau IANA ; date UTC si le fuseau est illisible. */
export function localToday(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Un fuseau IANA réel (64 caractères au plus), sinon null : jamais une valeur forgée. */
export function safeTimeZone(z: unknown): string | null {
  if (typeof z !== 'string') return null;
  const zone = z.trim();
  if (!zone || zone.length > 64) return null;
  try {
    return Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone || zone;
  } catch {
    return null;
  }
}

/** « Aujourd'hui » du voyageur : le fuseau envoyé par son navigateur, sinon Paris. */
export function travellerToday(timeZone: unknown, now = new Date()): string {
  return localToday(safeTimeZone(timeZone) ?? DEFAULT_TRAVELLER_ZONE, now);
}

/** Fuseau du navigateur (null s'il est illisible). À n'appeler que côté navigateur. */
export function browserTimeZone(): string | null {
  try {
    return safeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}

/** Date du jour du navigateur (AAAA-MM-JJ), jamais celle d'UTC. */
export function browserToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
```

- [ ] **Step 7: `server/weather.ts` — re-export, `destinationZone`, « aujourd'hui » of the destination**

Replace the import block end (line 12):

```ts
import { metnoForecastUrl, metnoGet } from '@/lib/weather/metnoRequest';
```

with:

```ts
import { metnoForecastUrl, metnoGet } from '@/lib/weather/metnoRequest';
import { localToday } from '../engine/zone';
```

Replace lines 66-77:

```ts
export function localToday(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
```

with:

```ts
/** « Aujourd'hui » dans un fuseau : vit dans `engine/zone.ts` (module pur), réexporté ici. */
export { localToday };
```

Replace `zoneAt` (lines 101-108):

```ts
/** Fuseau horaire du lieu (hors ligne) ; celui de l'app si la mer ou l'erreur l'empêche. */
export function zoneAt(lat: number, lon: number, fallback: string): string {
  try {
    return tzLookup(lat, lon) || fallback;
  } catch {
    return fallback;
  }
}
```

with:

```ts
/** Fuseau horaire du lieu (hors ligne) ; celui de l'app si la mer ou l'erreur l'empêche. */
export function zoneAt(lat: number, lon: number, fallback: string): string {
  try {
    return tzLookup(lat, lon) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fuseau de la destination : celui du point donné (premier jour du voyage,
 * sinon le départ), le repli sans point. Côté serveur seulement (tz-lookup).
 */
export function destinationZone(point: { lat: number; lon: number } | null, fallback: string): string {
  return point ? zoneAt(point.lat, point.lon, fallback) : fallback;
}
```

Replace the head of `getCompasWeather` (lines 150-157):

```ts
export async function getCompasWeather(input: {
  origin: { lat: number; lon: number } | null;
  tripDays: Array<{ day: number; date: string; lat: number; lon: number }>;
  timeZone: string;
  now?: Date;
}): Promise<CompasWeather | null> {
  if (!input.origin && input.tripDays.length === 0) return null;
  const today = localToday(input.timeZone, input.now);
```

with:

```ts
export async function getCompasWeather(input: {
  origin: { lat: number; lon: number } | null;
  tripDays: Array<{ day: number; date: string; lat: number; lon: number }>;
  /** Repli quand le lieu ne donne aucun fuseau. */
  timeZone: string;
  now?: Date;
}): Promise<CompasWeather | null> {
  if (!input.origin && input.tripDays.length === 0) return null;
  // Les dates du calendrier et des jours du voyage sont celles de la
  // DESTINATION : « aujourd'hui » s'y lit aussi (premier jour, sinon départ).
  const zone = destinationZone(input.tripDays[0] ?? input.origin, input.timeZone);
  const today = localToday(zone, input.now);
```

- [ ] **Step 8: `compasInterpretAction` takes the browser zone**

In `src/features/compas/server/compasActions.ts`, replace line 47:

```ts
import { localToday } from './weather';
```

with:

```ts
import { travellerToday } from '../engine/zone';
```

Replace the schema (lines 1668-1671):

```ts
const interpretSchema = z.object({
  tripId: uuid,
  text: z.string().trim().min(2).max(MAX_INTENT_CHARS),
});
```

with:

```ts
const interpretSchema = z.object({
  tripId: uuid,
  text: z.string().trim().min(2).max(MAX_INTENT_CHARS),
  /** Fuseau du navigateur (IANA) : « aujourd'hui » du voyageur. */
  timeZone: z.string().max(64).optional(),
});
```

Replace (lines 1685-1686):

```ts
  if (!parsed.success) return { success: false, error: 'Phrase trop courte ou trop longue' };
  const { tripId, text } = parsed.data;
```

with:

```ts
  if (!parsed.success) return { success: false, error: 'Phrase trop courte ou trop longue' };
  const { tripId, text, timeZone } = parsed.data;
```

Replace line 1706:

```ts
    const today = localToday('Europe/Paris');
```

with:

```ts
    // « Aujourd'hui » du voyageur : le fuseau de son navigateur (Paris sans lui).
    const today = travellerToday(timeZone);
```

- [ ] **Step 9: The autofill takes the browser zone (nothing persisted: every relaunch comes from the screen)**

In `src/features/compas/server/autofillActions.ts`, replace line 105:

```ts
import { localToday } from './weather';
```

with:

```ts
import { travellerToday } from '../engine/zone';
```

Replace the end of the schema (lines 181-182):

```ts
  phase: z.enum(['steps', 'rest', 'all']).default('all'),
});
```

with:

```ts
  phase: z.enum(['steps', 'rest', 'all']).default('all'),
  /**
   * Fuseau du navigateur (IANA) : « aujourd'hui » du voyageur (meilleure
   * période, date des dépenses prévues). Rien n'est gardé pour une reprise :
   * chaque relance vient de l'écran, avec son fuseau.
   */
  timeZone: z.string().max(64).optional(),
});
```

Replace line 793:

```ts
  const { tripId, from, phase } = parsed.data;
```

with:

```ts
  const { tripId, from, phase, timeZone } = parsed.data;
```

Replace line 838:

```ts
    const today = localToday('Europe/Paris');
```

with:

```ts
    const today = travellerToday(timeZone);
```

- [ ] **Step 10: The screen sends the browser zone**

In `src/features/compas/components/CompasScreen.tsx`, replace line 42:

```tsx
import { compasClearStartSayAction, compasInterpretAction } from '../server/compasActions';
```

with:

```tsx
import { compasClearStartSayAction, compasInterpretAction } from '../server/compasActions';
import { browserTimeZone } from '../engine/zone';
```

Replace line 387:

```tsx
        const started = await compasAutofillStartAction({ tripId: model.tripId, tripSlug: model.slug, from, phase: 'all' });
```

with:

```tsx
        // Fuseau du navigateur : « aujourd'hui » du voyageur côté serveur.
        const started = await compasAutofillStartAction({
          tripId: model.tripId,
          tripSlug: model.slug,
          from,
          phase: 'all',
          timeZone: browserTimeZone() ?? undefined,
        });
```

Replace line 590:

```tsx
        const res = await compasInterpretAction({ tripId: model.tripId, text: say });
```

with:

```tsx
        const res = await compasInterpretAction({
          tripId: model.tripId,
          text: say,
          timeZone: browserTimeZone() ?? undefined,
        });
```

In `src/features/compas/components/CompasDisLe.tsx`, replace line 6:

```tsx
import { compasClearStartSayAction, compasInterpretAction } from '../server/compasActions';
```

with:

```tsx
import { compasClearStartSayAction, compasInterpretAction } from '../server/compasActions';
import { browserTimeZone } from '../engine/zone';
```

and replace line 53:

```tsx
      const res = await compasInterpretAction({ tripId: ctl.data.model.tripId, text: phrase });
```

with:

```tsx
      const res = await compasInterpretAction({
        tripId: ctl.data.model.tripId,
        text: phrase,
        timeZone: browserTimeZone() ?? undefined,
      });
```

- [ ] **Step 11: Browser-local « aujourd'hui » in `CompasStart`, the inventory list and the Quand calendar**

In `src/features/compas/components/CompasStart.tsx`, replace line 12:

```tsx
import { activityLabel } from '../engine/format';
```

with:

```tsx
import { activityLabel } from '../engine/format';
import { browserToday } from '../engine/zone';
```

and replace line 47:

```tsx
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
```

with:

```tsx
  // La date du navigateur (pas celle d'UTC) : « demain » dit à 23 h reste demain.
  const today = useMemo(() => browserToday(), []);
```

In `src/features/compas/components/CompasSheets.tsx`, replace:

```tsx
import { KIT_THRESHOLDS } from '../engine/kitRules';
```

with:

```tsx
import { KIT_THRESHOLDS } from '../engine/kitRules';
import { browserToday } from '../engine/zone';
```

and replace line 3575:

```tsx
  const today = new Date().toISOString().slice(0, 10);
```

with:

```tsx
  // Entretien et péremption : la date du jour du navigateur, pas celle d'UTC.
  const today = browserToday();
```

In `src/features/compas/components/CompasOuFlows.tsx`, replace line 24:

```tsx
import { daylightClock } from '../engine/sun';
```

with:

```tsx
import { daylightClock } from '../engine/sun';
import { browserToday } from '../engine/zone';
```

and replace lines 579-596:

```tsx
function todayParis(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function QuandFlow({ ctl, hint }: { ctl: CompasCtl; hint?: FlowHint }) {
  const { data } = ctl;
  const m = data.model;
  const weather = data.weather;
  const today = weather?.calendar[0]?.date ?? todayParis();
```

with:

```tsx
export function QuandFlow({ ctl, hint }: { ctl: CompasCtl; hint?: FlowHint }) {
  const { data } = ctl;
  const m = data.model;
  const weather = data.weather;
  // Premier jour du calendrier (date de la destination), sinon le jour du navigateur.
  const today = weather?.calendar[0]?.date ?? browserToday();
```

(`const TIME_ZONE = 'Europe/Paris';` at line 49 stays for now: `DayDetail` still uses it until Task 2.)

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/zone.test.ts src/features/compas/__tests__/compasWeather.test.ts src/features/compas/__tests__/actionLimits.test.ts src/features/compas/__tests__/autofillStart.test.ts src/features/compas/__tests__/compasScreen.test.tsx`

Expected: PASS (all files).

Then the whole Compas suite, for regressions: `npx vitest run src/features/compas`

Expected: PASS.

- [ ] **Step 13: Type-check and the client-bundle guard**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

Run: `grep -rn "tz-lookup" src/features/compas/engine src/features/compas/components`
Expected: no output (tz-lookup stays in `server/weather.ts`).

Run: `npx eslint src/features/compas/engine/zone.ts src/features/compas/server/weather.ts src/features/compas/server/compasActions.ts src/features/compas/server/autofillActions.ts src/features/compas/components/CompasScreen.tsx src/features/compas/components/CompasDisLe.tsx src/features/compas/components/CompasStart.tsx src/features/compas/components/CompasSheets.tsx src/features/compas/components/CompasOuFlows.tsx`
Expected: no error (warnings already present in these files before the change may remain).

- [ ] **Step 14: Commit**

```bash
git add src/features/compas/engine/zone.ts \
  src/features/compas/server/weather.ts \
  src/features/compas/server/compasActions.ts \
  src/features/compas/server/autofillActions.ts \
  src/features/compas/components/CompasScreen.tsx \
  src/features/compas/components/CompasDisLe.tsx \
  src/features/compas/components/CompasStart.tsx \
  src/features/compas/components/CompasSheets.tsx \
  src/features/compas/components/CompasOuFlows.tsx \
  src/features/compas/__tests__/zone.test.ts \
  src/features/compas/__tests__/compasWeather.test.ts \
  src/features/compas/__tests__/actionLimits.test.ts \
  src/features/compas/__tests__/autofillStart.test.ts \
  src/features/compas/__tests__/compasScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat(compas): « aujourd'hui » au fuseau du voyageur

Le navigateur envoie son fuseau avec la phrase et la préparation ; Paris
n'est plus qu'un repli quand rien de valable n'arrive. Calendrier et
fiche de départ : la date du navigateur, plus celle d'UTC. Météo :
« aujourd'hui » se lit au fuseau de la destination (tz-lookup, côté
serveur seulement). Module pur engine/zone.ts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
EOF
)"
```

---

### Task 2: Soleil au fuseau de la destination, `clockMinutes`, départ à la première lumière

**Files:**
- Modify: `src/features/compas/engine/sun.ts:71-75` (add `clockMinutes` after `formatClock`)
- Modify: `src/features/compas/engine/kitRules.ts:10-11` (import), `:133-138` (« Lampe frontale » rule)
- Modify: `src/features/compas/engine/danger.ts:16-17` (import), `:104-111` (`minutesBetween`)
- Modify: `src/features/compas/engine/weather.ts:335-337` (`DepartureAdvice.start` doc), `:372-375` (`departureAdvice` start)
- Modify: `src/features/compas/engine/zone.ts` (created in Task 1: add an import at the top, append `differentClock`)
- Modify: `src/features/compas/engine/compasModel.ts:176-179` (doc of `CompasInput.timeZone`)
- Modify: `src/features/compas/server/getCompasData.ts:40` (import), `:126-127` (`CompasData.zone`), `:148` (doc), `:456-460` (destination zone), `:506-508` (weather fallback), `:602-604` (return `zone`), before `:626` (two private helpers)
- Modify: `src/features/compas/components/CompasOuFlows.tsx:3` (react import), `:24-25` (zone import from Task 1), `:49-50` (`TIME_ZONE` removed, `useBrowserZone` added), `DayDetail` (`:860-879` in the original file, ~12 lines higher after Task 1), « Lumière » row (`:957-964` originally)
- Create: `src/features/compas/__tests__/sun.test.ts`
- Modify (tests): `src/features/compas/__tests__/zone.test.ts` (import + new `describe`), `kitRules.test.ts` (after the frontale test, line ~101), `danger.test.ts` (after line ~62), `weather.test.ts` (after line ~184), `compasModel.test.ts` (line 8 import, after line ~248), `compasScreen.test.tsx` (import line 7, two tests before the « Parcours : chercher un lieu » test)

Line numbers are those of the file before this task; Task 1 shifted `CompasOuFlows.tsx` (−12 lines after line 579). Always match on the quoted snippet, not on the number.

**Interfaces:**
- Consumes (from Task 1): `DEFAULT_TRAVELLER_ZONE`, `safeTimeZone(z: unknown): string | null`, `browserTimeZone(): string | null`, `browserToday(now?: Date): string` from `src/features/compas/engine/zone.ts`; `destinationZone(point: { lat: number; lon: number } | null, fallback: string): string` from `src/features/compas/server/weather.ts`. In `CompasOuFlows.tsx`, Task 1 left the line `import { browserToday } from '../engine/zone';` right after `import { daylightClock } from '../engine/sun';`, and `const TIME_ZONE = 'Europe/Paris';` at line 49 used only by `DayDetail`. `compasScreen.test.tsx` already mocks `../engine/zone` so that `browserTimeZone()` returns `'Europe/Paris'`.
- Produces:
  - `src/features/compas/engine/sun.ts`: `export function clockMinutes(s: string | null | undefined): number | null` — minutes since midnight from `"HH:MM"` or an ISO stamp `"AAAA-MM-JJTHH:MM…"` (clock read as written), `null` otherwise.
  - `src/features/compas/engine/zone.ts`: `export function differentClock(a: string | null | undefined, b: string | null | undefined, at: Date): boolean` — true only when both zones are valid and show a different UTC offset at `at`.
  - `CompasData.zone?: string` (`src/features/compas/server/getCompasData.ts`) — destination IANA zone computed server-side; `CompasInput.timeZone` (model) now receives that destination zone.
  - Private helpers in `getCompasData.ts`: `firstGeoPoint(steps: CompasInput['steps']): { lat: number; lon: number } | null` and `anchorPoint(metadata: unknown): { lat: number; lon: number } | null` (Task 3 calls `anchorPoint`).
  - `departureAdvice` keeps its signature; new rule: start at `ceil15(sunrise)` when `comfortStart + total > deadline` and `ceil15(sunrise) + total <= deadline`.

- [ ] **Step 1: Write the failing pure tests**

Create `src/features/compas/__tests__/sun.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clockMinutes, daylightClock } from '../engine/sun';

describe('clockMinutes', () => {
  it('« HH:MM » (format réel des prévisions du Compas)', () => {
    expect(clockMinutes('07:40')).toBe(460);
    expect(clockMinutes('19:00')).toBe(1140);
    expect(clockMinutes('00:00')).toBe(0);
  });

  it('horodatage ISO : l’heure telle qu’écrite', () => {
    expect(clockMinutes('2026-10-12T07:40')).toBe(460);
    expect(clockMinutes('2026-10-12T19:00:00+02:00')).toBe(1140);
  });

  it('illisible : null, jamais NaN', () => {
    expect(clockMinutes('25:00')).toBeNull();
    expect(clockMinutes('07:60')).toBeNull();
    expect(clockMinutes('7h40')).toBeNull();
    expect(clockMinutes('')).toBeNull();
    expect(clockMinutes(null)).toBeNull();
    expect(clockMinutes(undefined)).toBeNull();
  });
});

describe('daylightClock au fuseau de la destination', () => {
  it('Tongariro, 12 octobre : lever vers 6 h 36 à Auckland, pas 19 h 36 (heure de Paris)', () => {
    expect(daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland').sunrise).toMatch(/^06:/);
    expect(daylightClock(-39.2, 175.58, '2026-10-12', 'Europe/Paris').sunrise).toMatch(/^19:/);
  });
});
```

In `src/features/compas/__tests__/zone.test.ts` (created in Task 1), replace the import block:

```ts
import {
  DEFAULT_TRAVELLER_ZONE,
  browserTimeZone,
  browserToday,
  localToday,
  safeTimeZone,
  travellerToday,
} from '../engine/zone';
```

with:

```ts
import {
  DEFAULT_TRAVELLER_ZONE,
  browserTimeZone,
  browserToday,
  differentClock,
  localToday,
  safeTimeZone,
  travellerToday,
} from '../engine/zone';
```

and append at the end of the file:

```ts

describe('même heure ou pas (« heure locale »)', () => {
  const at = new Date('2026-10-12T12:00:00Z');

  it('deux fuseaux à la même heure ce jour-là : pas de mention', () => {
    expect(differentClock('Europe/Paris', 'Europe/Brussels', at)).toBe(false);
    expect(differentClock('Europe/Paris', 'Europe/Paris', at)).toBe(false);
  });

  it('une autre heure : la mention', () => {
    expect(differentClock('Pacific/Auckland', 'Europe/Paris', at)).toBe(true);
    expect(differentClock('Europe/London', 'Europe/Paris', at)).toBe(true);
  });

  it('un fuseau inconnu : jamais de mention', () => {
    expect(differentClock(undefined, 'Europe/Paris', at)).toBe(false);
    expect(differentClock('Pacific/Auckland', null, at)).toBe(false);
    expect(differentClock('Mars/Olympus', 'Europe/Paris', at)).toBe(false);
  });
});
```

In `src/features/compas/__tests__/kitRules.test.ts`, replace:

```ts
  it('marche plus longue que le jour : frontale', () => {
    expect(run([], fc(), plan({ walkMin: 700 })).some((x) => x.need === 'frontale')).toBe(true);
  });
```

with:

```ts
  it('marche plus longue que le jour : frontale', () => {
    expect(run([], fc(), plan({ walkMin: 700 })).some((x) => x.need === 'frontale')).toBe(true);
  });

  it('lever et coucher en « HH:MM » (format réel des prévisions) : la frontale part aussi', () => {
    const hhmm = fc({ sunrise: '07:40', sunset: '19:00' });
    expect(run([], hhmm, plan({ walkMin: 700 })).some((x) => x.need === 'frontale')).toBe(true);
    expect(run([], hhmm, plan({ walkMin: 300 })).some((x) => x.need === 'frontale')).toBe(false);
  });
```

In `src/features/compas/__tests__/danger.test.ts`, replace:

```ts
  it('marche plus longue que le jour : vigilance physique datée et sourcée', () => {
    const d = run(plan({ walkMin: 700 }), forecast());
    const s = d.signals.find((x) => x.id === 'physique-light-1');
    expect(s?.severity).toBe('warn');
    expect(s?.asOf).toBe('2026-10-12');
    expect(s?.source).toContain('DIN 33466');
    expect(s?.label).toContain('11 h 40');
  });
```

with:

```ts
  it('marche plus longue que le jour : vigilance physique datée et sourcée', () => {
    const d = run(plan({ walkMin: 700 }), forecast());
    const s = d.signals.find((x) => x.id === 'physique-light-1');
    expect(s?.severity).toBe('warn');
    expect(s?.asOf).toBe('2026-10-12');
    expect(s?.source).toContain('DIN 33466');
    expect(s?.label).toContain('11 h 40');
  });

  it('lever et coucher en « HH:MM » (format réel) : « X de marche pour Y de jour »', () => {
    const d = run(plan({ walkMin: 700 }), forecast({ sunrise: '07:40', sunset: '19:00' }));
    expect(d.signals.find((x) => x.id === 'physique-light-1')?.label).toBe(
      'Jour 1 : 11 h 40 de marche pour 11 h 20 de jour'
    );
  });
```

In `src/features/compas/__tests__/weather.test.ts`, replace:

```ts
  it('prévient quand l’étape dépasse la lumière du jour', () => {
    const a = departureAdvice({
      walkMin: 700,
      sunrise: '07:58',
      sunset: '19:12',
      hours: hoursOf('2026-10-10'),
    });
    expect(a.warning).toMatch(/lumière du jour/);
  });
```

with:

```ts
  it('prévient quand l’étape dépasse la lumière du jour', () => {
    const a = departureAdvice({
      walkMin: 700,
      sunrise: '07:58',
      sunset: '19:12',
      hours: hoursOf('2026-10-10'),
    });
    expect(a.warning).toMatch(/lumière du jour/);
  });

  it('tropiques : départ à la première lumière quand 7 h ne laisse plus arriver de jour', () => {
    // 560 min de marche, +15 % = 644 min ; arrivée au plus tard 17 h 30 (coucher − 30 min).
    const a = departureAdvice({
      walkMin: 560,
      sunrise: '05:45',
      sunset: '18:00',
      hours: hoursOf('2026-10-10'),
    });
    expect(a.start).toBe('05:45');
    expect(a.arrival).toBe('16:29');
    expect(a.warning).toBeNull();
    expect(a.latestStart).toBe('06:45');
  });

  it('confort de 7 h gardé quand l’étape tient ; avertissement quand même l’aube ne suffit pas', () => {
    const short = departureAdvice({
      walkMin: 300,
      sunrise: '05:45',
      sunset: '18:00',
      hours: hoursOf('2026-10-10'),
    });
    expect(short.start).toBe('07:00');
    const long = departureAdvice({
      walkMin: 700,
      sunrise: '05:45',
      sunset: '18:00',
      hours: hoursOf('2026-10-10'),
    });
    expect(long.start).toBe('07:00');
    expect(long.warning).toMatch(/lumière du jour/);
  });
```

In `src/features/compas/__tests__/compasModel.test.ts`, replace line 8:

```ts
import { sunTimes } from '../engine/sun';
```

with:

```ts
import { daylightClock, sunTimes } from '../engine/sun';
```

and replace:

```ts
    expect(m.dates.label).toBe('Dates à choisir');
    expect(m.daylight).toBeNull();
    expect(m.verdict.level).toBe('incomplet');
    expect(m.nextDecision?.step).toBe('ou');
  });
```

with:

```ts
    expect(m.dates.label).toBe('Dates à choisir');
    expect(m.daylight).toBeNull();
    expect(m.verdict.level).toBe('incomplet');
    expect(m.nextDecision?.step).toBe('ou');
  });

  it('lumière du jour à l’heure de la destination (fuseau donné par le serveur)', () => {
    const tongariro = {
      ...baseInput().steps[0],
      title: 'Tongariro',
      locationName: 'Tongariro',
      lat: -39.2,
      lon: 175.58,
    };
    const m = buildCompasModel(baseInput({ steps: [tongariro], timeZone: 'Pacific/Auckland' }));
    expect(m.daylight).toMatchObject({
      date: '2026-10-12',
      ...daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland'),
    });
    expect(m.daylight?.sunrise).toMatch(/^06:/);
  });
```

(This model test and the `daylightClock` block of `sun.test.ts` already pass: they pin the contract `getCompasData` now relies on — the model reads the zone it is given.)

- [ ] **Step 2: Write the failing screen tests (« heure locale »)**

In `src/features/compas/__tests__/compasScreen.test.tsx`, replace line 7:

```tsx
import { assessDanger } from '../engine/danger';
```

with:

```tsx
import { assessDanger } from '../engine/danger';
import { daylightClock } from '../engine/sun';
```

and replace:

```tsx
  it('Parcours : chercher un lieu, voir la communauté, choisir découpé sur les dates', async () => {
```

with:

```tsx
  it('Quand : lever et coucher à l’heure de la destination, « heure locale » quand elle diffère du navigateur', async () => {
    const data = makeData({
      steps: [
        {
          id: 's1',
          dayNumber: 1,
          orderIndex: 0,
          title: 'Tongariro',
          locationName: 'Tongariro',
          lat: -39.2,
          lon: 175.58,
          distanceKm: 19.4,
          elevationGainM: 800,
          elevationLossM: 1100,
          accommodationName: null,
          transportMode: 'foot',
          startTime: null,
        },
      ],
    });
    data.zone = 'Pacific/Auckland';
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    const sun = daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland');
    expect(sun.sunrise).toMatch(/^06:/);
    expect(within(sheet).getByText(`${sun.sunrise} – ${sun.sunset} · heure locale`)).toBeTruthy();
  });

  it('Quand : destination à la même heure que le navigateur, aucune mention', async () => {
    const data = makeData();
    data.zone = 'Europe/Paris';
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    const sun = daylightClock(42.73, -0.01, '2026-10-12', 'Europe/Paris');
    expect(within(sheet).getByText(`${sun.sunrise} – ${sun.sunset}`)).toBeTruthy();
    expect(within(sheet).queryByText(/heure locale/)).toBeNull();
  });

  it('Parcours : chercher un lieu, voir la communauté, choisir découpé sur les dates', async () => {
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/sun.test.ts src/features/compas/__tests__/zone.test.ts src/features/compas/__tests__/kitRules.test.ts src/features/compas/__tests__/danger.test.ts src/features/compas/__tests__/weather.test.ts src/features/compas/__tests__/compasModel.test.ts src/features/compas/__tests__/compasScreen.test.tsx`

Expected: FAIL — `clockMinutes is not a function`, `differentClock is not a function`; the `"HH:MM"` frontale test finds no `frontale`; the danger test finds no `physique-light-1` signal (it gets the « long » signal instead); the tropical departure gets `start: '07:00'`; the Tongariro screen test cannot find `… · heure locale` (the sun is still computed at Paris time, `19:36 – 08:32`). The compasModel guard, the `daylightClock` block and the « aucune mention » screen test already pass.

- [ ] **Step 4: `clockMinutes` in `engine/sun.ts`**

Replace:

```ts
/** Formate des minutes locales en « HH:MM ». */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
```

with:

```ts
/** Formate des minutes locales en « HH:MM ». */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Minutes depuis minuit d'une heure « HH:MM » (format des prévisions du
 * Compas, heure locale du lieu) ou d'un horodatage ISO « AAAA-MM-JJTHH:MM… »
 * (heure lue telle qu'écrite, décalage ignoré). null si illisible, jamais NaN.
 */
export function clockMinutes(s: string | null | undefined): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(?:\d{4}-\d{2}-\d{2}T)?(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(
    s.trim()
  );
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}
```

- [ ] **Step 5: The « Lampe frontale » rule and the danger read `"HH:MM"`**

In `src/features/compas/engine/kitRules.ts`, replace:

```ts
import type { CompasDayPlan, CompasKitLine } from './compasModel';
import type { DayForecast } from './weather';
```

with:

```ts
import type { CompasDayPlan, CompasKitLine } from './compasModel';
import { clockMinutes } from './sun';
import type { DayForecast } from './weather';
```

and replace:

```ts
  const dark = input.dayPlans.find((p) => {
    const f = days.find((d) => d.day === p.day)?.forecast;
    if (!f?.sunrise || !f.sunset || p.walkMin == null) return false;
    const light = Math.round((Date.parse(f.sunset) - Date.parse(f.sunrise)) / 60000);
    return Number.isFinite(light) && p.walkMin > light;
  });
```

with:

```ts
  const dark = input.dayPlans.find((p) => {
    const f = days.find((d) => d.day === p.day)?.forecast;
    // Lever et coucher arrivent en « HH:MM » (heure locale du lieu) : lus par
    // `clockMinutes` (`Date.parse` rendait NaN et la règle ne partait jamais).
    const rise = clockMinutes(f?.sunrise);
    const set = clockMinutes(f?.sunset);
    if (rise == null || set == null || set <= rise || p.walkMin == null) return false;
    return p.walkMin > set - rise;
  });
```

In `src/features/compas/engine/danger.ts`, replace:

```ts
import type { CompasDayPlan } from './compasModel';
import type { DayForecast } from './weather';
```

with:

```ts
import type { CompasDayPlan } from './compasModel';
import { clockMinutes } from './sun';
import type { DayForecast } from './weather';
```

and replace:

```ts
function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isFinite(ta) && Number.isFinite(tb) && tb > ta
    ? Math.round((tb - ta) / 60000)
    : null;
}
```

with:

```ts
/** Durée du jour entre lever et coucher (« HH:MM » ou ISO), en minutes ; null si illisible. */
function minutesBetween(a: string | null, b: string | null): number | null {
  const ta = clockMinutes(a);
  const tb = clockMinutes(b);
  return ta != null && tb != null && tb > ta ? tb - ta : null;
}
```

- [ ] **Step 6: `departureAdvice` leaves at first light when the day needs it**

In `src/features/compas/engine/weather.ts`, replace:

```ts
export interface DepartureAdvice {
  /** Départ conseillé : dès qu'il fait jour (pas avant 7 h). */
  start: string | null;
```

with:

```ts
export interface DepartureAdvice {
  /**
   * Départ conseillé : dès qu'il fait jour, pas avant 7 h par confort ; à la
   * première lumière quand l'étape ne tiendrait plus de jour en partant à 7 h.
   */
  start: string | null;
```

and replace:

```ts
  const total = Math.round(input.walkMin * 1.15);
  const deadline = Math.min(sunset - 30, stormFrom != null ? stormFrom - 30 : Infinity);
  const start = Math.ceil(Math.max(sunrise, 7 * 60) / 15) * 15;
  const arrival = start + total;
```

with:

```ts
  const total = Math.round(input.walkMin * 1.15);
  const deadline = Math.min(sunset - 30, stormFrom != null ? stormFrom - 30 : Infinity);
  // 7 h par confort ; mais sous les tropiques (lever vers 5 h 45) ou par jour
  // court, partir à 7 h peut faire arriver de nuit quand l'aube suffisait.
  const comfort = Math.ceil(Math.max(sunrise, 7 * 60) / 15) * 15;
  const firstLight = Math.ceil(sunrise / 15) * 15;
  const start = comfort + total > deadline && firstLight + total <= deadline ? firstLight : comfort;
  const arrival = start + total;
```

- [ ] **Step 7: `differentClock` in `engine/zone.ts`**

In `src/features/compas/engine/zone.ts`, replace:

```ts
/** Repli quand le navigateur n'a envoyé aucun fuseau valable. */
export const DEFAULT_TRAVELLER_ZONE = 'Europe/Paris';
```

with:

```ts
import { tzOffsetMinutes } from './sun';

/** Repli quand le navigateur n'a envoyé aucun fuseau valable. */
export const DEFAULT_TRAVELLER_ZONE = 'Europe/Paris';
```

and append at the end of the file:

```ts

/**
 * Deux fuseaux qui n'affichent pas la même heure ce jour-là (heure d'été
 * comprise) : l'écran précise alors « heure locale ». Un fuseau inconnu ne
 * déclenche jamais la mention.
 */
export function differentClock(
  a: string | null | undefined,
  b: string | null | undefined,
  at: Date
): boolean {
  const za = safeTimeZone(a);
  const zb = safeTimeZone(b);
  if (!za || !zb || za === zb) return false;
  return tzOffsetMinutes(za, at) !== tzOffsetMinutes(zb, at);
}
```

- [ ] **Step 8: The server computes the destination zone once and hands it to the model and the screen**

In `src/features/compas/engine/compasModel.ts`, replace (end of `CompasInput`, lines 176-179):

```ts
  viewerId: string | null;
  now: Date;
  timeZone: string;
}
```

with:

```ts
  viewerId: string | null;
  now: Date;
  /**
   * Fuseau IANA de la DESTINATION (lever et coucher du soleil), retrouvé par le
   * serveur (`destinationZone`, tz-lookup) ; `Europe/Paris` seulement tant que
   * le lieu n'est pas placé sur la carte.
   */
  timeZone: string;
}
```

In `src/features/compas/server/getCompasData.ts`, replace line 40:

```ts
import { getCompasWeather, type CompasWeather } from './weather';
```

with:

```ts
import { destinationZone, getCompasWeather, type CompasWeather } from './weather';
```

Replace:

```ts
  /** Point de départ (première étape géolocalisée), pour chercher autour. */
  origin: { lat: number; lon: number } | null;
```

with:

```ts
  /** Point de départ (première étape géolocalisée), pour chercher autour. */
  origin: { lat: number; lon: number } | null;
  /**
   * Fuseau IANA de la destination (première étape géolocalisée, sinon le lieu
   * retrouvé sur la carte), calculé ici : tz-lookup n'entre jamais dans le
   * navigateur. Absent (écran plus ancien, tests) : Paris, sans mention.
   */
  zone?: string;
```

Replace line 148:

```ts
const TIME_ZONE = 'Europe/Paris';
```

with:

```ts
/** Repli tant que la destination n'est pas placée sur la carte. */
const TIME_ZONE = 'Europe/Paris';
```

Replace (end of the `input` literal, lines 457-460):

```ts
    timeZone: TIME_ZONE,
  };

  const points: CompasPoint[] = [
```

with:

```ts
    timeZone: TIME_ZONE,
  };
  // Lever et coucher du soleil, et « aujourd'hui » de la météo : à l'heure de la
  // destination (tz-lookup, côté serveur seulement), plus à celle de Paris.
  const zone = destinationZone(firstGeoPoint(input.steps) ?? anchorPoint(trip.metadata), TIME_ZONE);
  input.timeZone = zone;

  const points: CompasPoint[] = [
```

Replace (the `getCompasWeather` call, lines 505-508):

```ts
          lon: d.lon as number,
        })),
      timeZone: TIME_ZONE,
    }),
```

with:

```ts
          lon: d.lon as number,
        })),
      timeZone: zone,
    }),
```

Replace (returned object, lines 602-604):

```ts
    route: { id: routeId, name: hub.hiking?.routeName ?? null },
    origin,
    pendingInvites,
```

with:

```ts
    route: { id: routeId, name: hub.hiking?.routeName ?? null },
    origin,
    zone,
    pendingInvites,
```

Replace:

```ts
function autofillStale(trip: TripFull): AutofillPart[] {
```

with:

```ts
/** Première étape géolocalisée, dans l'ordre du voyage. */
function firstGeoPoint(steps: CompasInput['steps']): { lat: number; lon: number } | null {
  const s = [...steps]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
    .find((x) => x.lat != null && x.lon != null);
  return s ? { lat: s.lat as number, lon: s.lon as number } : null;
}

/** Destination retrouvée sur la carte (Dis-le), quand aucune étape n'est placée. */
function anchorPoint(metadata: unknown): { lat: number; lon: number } | null {
  const compas =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).compas : null;
  const a = compas && typeof compas === 'object' ? (compas as Record<string, unknown>).anchor : null;
  if (!a || typeof a !== 'object') return null;
  const lat = num((a as Record<string, unknown>).lat);
  const lon = num((a as Record<string, unknown>).lon);
  return lat != null && lon != null ? { lat, lon } : null;
}

function autofillStale(trip: TripFull): AutofillPart[] {
```

- [ ] **Step 9: The day sheet shows the sun at the destination's time, with « heure locale » when it differs**

In `src/features/compas/components/CompasOuFlows.tsx`, replace line 3:

```tsx
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
```

with:

```tsx
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
```

Replace (import left by Task 1):

```tsx
import { browserToday } from '../engine/zone';
```

with:

```tsx
import { DEFAULT_TRAVELLER_ZONE, browserTimeZone, browserToday, differentClock } from '../engine/zone';
```

Replace (lines 49-50):

```tsx
const TIME_ZONE = 'Europe/Paris';
const staticRow = { cursor: 'default' } as const;
```

with:

```tsx
const staticRow = { cursor: 'default' } as const;

const noSubscribe = () => () => {};
/** Fuseau du navigateur, lu côté navigateur seulement (null au rendu serveur : aucun écart d'hydratation). */
function useBrowserZone(): string | null {
  return useSyncExternalStore(noSubscribe, browserTimeZone, () => null);
}
```

Replace the head of `DayDetail`:

```tsx
function DayDetail({ ctl, day }: { ctl: CompasCtl; day: number }) {
  const m = ctl.data.model;
  const plan = m.route.dayPlans.find((d) => d.day === day);
  const tripDay = ctl.data.weather?.tripDays.find((d) => d.day === day) ?? null;
  const forecast = tripDay?.forecast ?? null;
  const trend = plan?.date
    ? ctl.data.weather?.calendar.find((c) => c.date === plan.date)
    : undefined;

  const light = useMemo(() => {
    if (forecast?.sunrise && forecast.sunset)
      return { sunrise: forecast.sunrise, sunset: forecast.sunset, source: 'calcul astronomique (SunCalc)' };
    if (plan?.date && plan.lat != null && plan.lon != null) {
      return {
        ...daylightClock(plan.lat, plan.lon, plan.date, TIME_ZONE),
        source: 'calcul astronomique',
      };
    }
    return null;
  }, [forecast, plan]);

  if (!plan) return null;
```

with:

```tsx
function DayDetail({ ctl, day }: { ctl: CompasCtl; day: number }) {
  const m = ctl.data.model;
  const plan = m.route.dayPlans.find((d) => d.day === day);
  const tripDay = ctl.data.weather?.tripDays.find((d) => d.day === day) ?? null;
  const forecast = tripDay?.forecast ?? null;
  const trend = plan?.date
    ? ctl.data.weather?.calendar.find((c) => c.date === plan.date)
    : undefined;
  // Heure de la destination (fuseau retrouvé par le serveur), au-delà de la prévision aussi.
  const zone = ctl.data.zone ?? DEFAULT_TRAVELLER_ZONE;
  const here = useBrowserZone();

  const light = useMemo(() => {
    if (forecast?.sunrise && forecast.sunset)
      return { sunrise: forecast.sunrise, sunset: forecast.sunset, source: 'calcul astronomique (SunCalc)' };
    if (plan?.date && plan.lat != null && plan.lon != null) {
      return {
        ...daylightClock(plan.lat, plan.lon, plan.date, zone),
        source: 'calcul astronomique',
      };
    }
    return null;
  }, [forecast, plan, zone]);

  if (!plan) return null;
  // Destination à une autre heure que le navigateur : on le dit (« heure locale »).
  const away = plan.date
    ? differentClock(ctl.data.zone, here, new Date(`${plan.date}T12:00:00Z`))
    : false;
```

Replace the « Lumière » row:

```tsx
            <dt>Lumière</dt>
            <dd>
              {light.sunrise ?? '—'} – {light.sunset ?? '—'}
            </dd>
```

with:

```tsx
            <dt>Lumière</dt>
            <dd>
              {light.sunrise ?? '—'} – {light.sunset ?? '—'}
              {away ? ' · heure locale' : ''}
            </dd>
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/sun.test.ts src/features/compas/__tests__/zone.test.ts src/features/compas/__tests__/kitRules.test.ts src/features/compas/__tests__/danger.test.ts src/features/compas/__tests__/weather.test.ts src/features/compas/__tests__/compasModel.test.ts src/features/compas/__tests__/compasScreen.test.tsx`

Expected: PASS.

Then: `npx vitest run src/features/compas`
Expected: PASS (existing ISO-fed kitRules/danger tests and the 07:58-sunrise departure tests are unchanged).

- [ ] **Step 11: Type-check, lint and the client-bundle guard**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

Run: `grep -rn "tz-lookup\|TIME_ZONE" src/features/compas/engine src/features/compas/components`
Expected: no output.

Run: `npx eslint src/features/compas/engine/sun.ts src/features/compas/engine/zone.ts src/features/compas/engine/kitRules.ts src/features/compas/engine/danger.ts src/features/compas/engine/weather.ts src/features/compas/engine/compasModel.ts src/features/compas/server/getCompasData.ts src/features/compas/components/CompasOuFlows.tsx`
Expected: no error.

- [ ] **Step 12: Commit**

```bash
git add src/features/compas/engine/sun.ts \
  src/features/compas/engine/zone.ts \
  src/features/compas/engine/kitRules.ts \
  src/features/compas/engine/danger.ts \
  src/features/compas/engine/weather.ts \
  src/features/compas/engine/compasModel.ts \
  src/features/compas/server/getCompasData.ts \
  src/features/compas/components/CompasOuFlows.tsx \
  src/features/compas/__tests__/sun.test.ts \
  src/features/compas/__tests__/zone.test.ts \
  src/features/compas/__tests__/kitRules.test.ts \
  src/features/compas/__tests__/danger.test.ts \
  src/features/compas/__tests__/weather.test.ts \
  src/features/compas/__tests__/compasModel.test.ts \
  src/features/compas/__tests__/compasScreen.test.tsx
git commit -m "$(cat <<'EOF'
fix(compas): soleil au fuseau de la destination, départ à la première lumière

Le serveur retrouve le fuseau de la destination (tz-lookup) et le donne
au modèle et à l'écran : lever et coucher justes au-delà de la prévision,
« heure locale » quand il diffère du navigateur. Les règles « Lampe
frontale » et « X de marche pour Y de jour » lisent enfin le format
réel « HH:MM » (clockMinutes ; Date.parse rendait NaN). Départ à l'aube
quand partir à 7 h ferait arriver de nuit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
EOF
)"
```

---

### Task 3: Hiver selon l'hémisphère, saison sèche par les normales NASA POWER, crédit, docs

**Files:**
- Modify: `src/features/compas/engine/projectContext.ts:62-63` (`ContextInput.lat`), `:143` (`WINTER` + helper), `:260` (winter test)
- Modify: `src/features/compas/engine/period.ts:11-21` (`PeriodInput.normals`), `:80-85` (doc), `:120-125` (new exports + `bestPeriod` head)
- Modify: `src/features/compas/engine/metno.ts:266-269` (add `powerClimatology` after `powerToDaily`)
- Modify: `src/features/compas/server/weather.ts:9` (import), `:17-21` (doc), `:33` (constants), after `trendUrl` (`climatologyUrl`), after `getJson` (`getPrecipNormals`)
- Modify: `src/features/compas/server/autofillActions.ts:65` (period import), the `travellerToday` import line added by Task 1 (old line 105), `:867-875` (`ctx`), `:961-964` (normals for `bestPeriod`), `:1484-1490` (`nightCtx`)
- Modify: `src/features/compas/server/getCompasData.ts` (`resolveProjectContext` call, original line 618)
- Modify: `src/features/compas/components/CompasSheets.tsx:2962-2968` (`SourcesFlow`: NASA POWER chip)
- Create: `src/features/compas/__tests__/powerNormals.test.ts`
- Modify (tests): `projectContext.test.ts` (after line ~85), `period.test.ts` (line 2 import + end of file), `metno.test.ts` (line 2 import + end of file), `compasScreen.test.tsx` (two tests before « Parcours : chercher un lieu »)
- Modify (docs): `docs/compas/PLAN-100.md:618-623`, `docs/compas/ETAT.md:37`

Line numbers are those of the original files; Tasks 1 and 2 shifted `autofillActions.ts` (+6 lines after line 182) and `getCompasData.ts`. Match on the quoted snippets.

**Interfaces:**
- Consumes (from Task 1): in `autofillActions.ts`, the line `import { travellerToday } from '../engine/zone';` (it replaced `import { localToday } from './weather';`) and `const today = travellerToday(timeZone);`. In `server/weather.ts`, the private `getJson(url: string, revalidate: number, timeoutMs = 6000): Promise<unknown | null>` and `at2` helper (both pre-existing).
- Consumes (from Task 2): the private helper `anchorPoint(metadata: unknown): { lat: number; lon: number } | null` in `getCompasData.ts`, and the local `origin` variable already present there.
- Produces:
  - `src/features/compas/engine/projectContext.ts`: `ContextInput.lat?: number | null`.
  - `src/features/compas/engine/period.ts`: `PeriodInput.normals?: { precip: number[] } | null`; `export const NORMALS_WHY = 'mois le plus sec selon les normales 2001-2020 (NASA POWER)'`; `export function driestMonth(precip: number[]): number`; `export function needsDryNormals(input: Pick<PeriodInput, 'activity' | 'lat' | 'countryCode'>): boolean`.
  - `src/features/compas/engine/metno.ts`: `export function powerClimatology(payload: unknown): number[] | null`.
  - `src/features/compas/server/weather.ts`: `export function climatologyUrl(lat: number, lon: number): string`; `export async function getPrecipNormals(lat: number, lon: number): Promise<{ precip: number[] } | null>`.

- [ ] **Step 1: Write the failing engine tests**

In `src/features/compas/__tests__/projectContext.test.ts`, replace:

```ts
  it('profil budget (bivouac) en hiver en altitude : un toit, avec la raison', () => {
    const ctx = resolveProjectContext(base({ profile, month: 1, maxAltitudeM: 2200 }));
    expect(ctx.nights).toMatchObject({ value: 'refuge', source: 'defaut' });
    expect(ctx.adaptations).toEqual([
      expect.objectContaining({ field: 'nights', why: 'nuits d’hiver en altitude' }),
    ]);
  });
```

with:

```ts
  it('profil budget (bivouac) en hiver en altitude : un toit, avec la raison', () => {
    const ctx = resolveProjectContext(base({ profile, month: 1, maxAltitudeM: 2200 }));
    expect(ctx.nights).toMatchObject({ value: 'refuge', source: 'defaut' });
    expect(ctx.adaptations).toEqual([
      expect.objectContaining({ field: 'nights', why: 'nuits d’hiver en altitude' }),
    ]);
  });

  it('hiver selon l’hémisphère : juillet est l’hiver au sud, janvier l’été', () => {
    const july = resolveProjectContext(base({ profile, month: 7, lat: -45, maxAltitudeM: 2200 }));
    expect(july.nights).toMatchObject({ value: 'refuge', source: 'defaut' });
    expect(july.adaptations).toEqual([
      expect.objectContaining({ field: 'nights', why: 'nuits d’hiver en altitude' }),
    ]);
    const january = resolveProjectContext(base({ profile, month: 1, lat: -45, maxAltitudeM: 2200 }));
    expect(january.nights).toMatchObject({ value: 'bivouac', source: 'profil' });
    expect(january.adaptations).toEqual([]);
    // Hémisphère nord : inchangé.
    expect(resolveProjectContext(base({ profile, month: 1, lat: 45.9, maxAltitudeM: 2200 })).nights.value).toBe(
      'refuge'
    );
    expect(resolveProjectContext(base({ profile, month: 7, lat: 45.9, maxAltitudeM: 2200 })).nights.value).toBe(
      'bivouac'
    );
  });
```

In `src/features/compas/__tests__/period.test.ts`, replace line 2:

```ts
import { bestPeriod, monthName } from '../engine/period';
```

with:

```ts
import { NORMALS_WHY, bestPeriod, driestMonth, monthName, needsDryNormals } from '../engine/period';
```

and append at the end of the file:

```ts

/** Manaus, normales NASA POWER 2001-2020 (mm/jour, janvier → décembre), relevées le 9 oct. 2026. */
const MANAUS = [7.24, 8.36, 8.63, 8.72, 6.62, 3.97, 2.44, 1.61, 2.26, 3.33, 4.5, 6.87];

describe('Saison sèche par les normales NASA POWER (tropiques hors de la table)', () => {
  it('driestMonth : centre de la fenêtre de trois mois la plus sèche', () => {
    expect(driestMonth(MANAUS)).toBe(8);
    // En boucle sur l'année : décembre-janvier-février → janvier.
    expect(driestMonth([0.5, 0.6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0.4])).toBe(1);
  });

  it('Brésil (absent de la table) : le mois des normales, avec la source', () => {
    expect(
      bestPeriod({ activity: 'hiking', lat: -3.12, countryCode: 'BR', today, days: 7, normals: { precip: MANAUS } })
    ).toEqual({ month: 8, start: '2027-08-07', end: '2027-08-13', why: NORMALS_WHY });
    expect(NORMALS_WHY).toBe('mois le plus sec selon les normales 2001-2020 (NASA POWER)');
  });

  it('sans normales lisibles : toujours aucune période inventée', () => {
    const br = { activity: 'hiking', lat: -3.12, countryCode: 'BR', today, days: 7 };
    expect(bestPeriod(br)).toBeNull();
    expect(bestPeriod({ ...br, normals: null })).toBeNull();
    expect(bestPeriod({ ...br, normals: { precip: MANAUS.slice(0, 11) } })).toBeNull();
    expect(bestPeriod({ ...br, normals: { precip: [...MANAUS.slice(0, 11), Number.NaN] } })).toBeNull();
  });

  it('la table garde la priorité ; hors des tropiques, les normales ne changent rien', () => {
    expect(
      bestPeriod({ activity: 'trekking', lat: -9.2, countryCode: 'PE', today, days: 5, normals: { precip: MANAUS } })
        ?.month
    ).toBe(6);
    expect(bestPeriod({ activity: 'hiking', lat: 51.17, today, days: 7, normals: { precip: MANAUS } })?.month).toBe(9);
  });

  it('needsDryNormals : sous les tropiques, hors de la table, hors ski', () => {
    expect(needsDryNormals({ activity: 'hiking', lat: -3.12, countryCode: 'BR' })).toBe(true);
    expect(needsDryNormals({ activity: 'hiking', lat: -12.46, countryCode: 'au' })).toBe(true);
    expect(needsDryNormals({ activity: 'hiking', lat: -9.2, countryCode: 'PE' })).toBe(false);
    expect(needsDryNormals({ activity: 'hiking', lat: 45, countryCode: 'FR' })).toBe(false);
    expect(needsDryNormals({ activity: 'ski', lat: -3.12, countryCode: 'BR' })).toBe(false);
    expect(needsDryNormals({ activity: 'hiking', lat: null, countryCode: 'BR' })).toBe(false);
  });
});
```

In `src/features/compas/__tests__/metno.test.ts`, replace line 2:

```ts
import { localStamp, parseMetNo, powerToDaily, symbolToWmo } from '../engine/metno';
```

with:

```ts
import { localStamp, parseMetNo, powerClimatology, powerToDaily, symbolToWmo } from '../engine/metno';
```

and append at the end of the file:

```ts

describe('NASA POWER : normales mensuelles (climatologie 2001-2020)', () => {
  /** Réponse réelle pour Manaus (9 oct. 2026), réduite à ce qui est lu. */
  const manaus = {
    properties: {
      parameter: {
        PRECTOTCORR: {
          JAN: 7.24,
          FEB: 8.36,
          MAR: 8.63,
          APR: 8.72,
          MAY: 6.62,
          JUN: 3.97,
          JUL: 2.44,
          AUG: 1.61,
          SEP: 2.26,
          OCT: 3.33,
          NOV: 4.5,
          DEC: 6.87,
          ANN: 5.36,
        } as Record<string, number>,
      },
    },
    header: { fill_value: -999.0 },
  };

  it('douze mois dans l’ordre, la moyenne annuelle ignorée', () => {
    expect(powerClimatology(manaus)).toEqual([7.24, 8.36, 8.63, 8.72, 6.62, 3.97, 2.44, 1.61, 2.26, 3.33, 4.5, 6.87]);
  });

  it('valeur de remplissage (-999) ou mois manquant : null, rien de comblé', () => {
    const filled = structuredClone(manaus);
    filled.properties.parameter.PRECTOTCORR.AUG = -999;
    expect(powerClimatology(filled)).toBeNull();
    const missing = structuredClone(manaus);
    delete missing.properties.parameter.PRECTOTCORR.AUG;
    expect(powerClimatology(missing)).toBeNull();
    expect(powerClimatology(null)).toBeNull();
    expect(powerClimatology({ messages: ['erreur'] })).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing server test (NASA POWER fetch, mocked)**

Create `src/features/compas/__tests__/powerNormals.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Le module météo importe le point d'accès MET Norway (limites en base) : remplacé, sans réseau.
vi.mock('@/lib/weather/metnoRequest', () => ({
  metnoForecastUrl: () => 'https://api.met.no/test',
  metnoGet: vi.fn(async () => null),
}));

import { climatologyUrl, getPrecipNormals } from '../server/weather';

/** Réponse réelle de NASA POWER pour Manaus (climatologie 2001-2020), relevée le 9 oct. 2026. */
const manaus = (aug = 1.61) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-60.02, -3.12, 51.37] },
  properties: {
    parameter: {
      PRECTOTCORR: {
        JAN: 7.24,
        FEB: 8.36,
        MAR: 8.63,
        APR: 8.72,
        MAY: 6.62,
        JUN: 3.97,
        JUL: 2.44,
        AUG: aug,
        SEP: 2.26,
        OCT: 3.33,
        NOV: 4.5,
        DEC: 6.87,
        ANN: 5.36,
      },
    },
  },
  header: { fill_value: -999.0 },
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('normales NASA POWER côté serveur', () => {
  afterEach(() => vi.restoreAllMocks());

  it('URL : climatologie au point arrondi à 0,01°, précipitations seulement', () => {
    expect(climatologyUrl(-3.119, -60.0217)).toBe(
      'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR&community=RE&longitude=-60.02&latitude=-3.12&format=JSON'
    );
  });

  it('lit les douze mois ; réponse gardée 30 jours', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(manaus()));
    expect(await getPrecipNormals(-3.12, -60.02)).toEqual({
      precip: [7.24, 8.36, 8.63, 8.72, 6.62, 3.97, 2.44, 1.61, 2.26, 3.33, 4.5, 6.87],
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(climatologyUrl(-3.12, -60.02));
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(30 * 86_400);
  });

  it('service injoignable ou valeur de remplissage : null, la période reste non proposée', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValueOnce(new Error('réseau coupé'));
    expect(await getPrecipNormals(-3.12, -60.02)).toBeNull();
    fetchSpy.mockImplementationOnce(async () => json(manaus(-999)));
    expect(await getPrecipNormals(-3.12, -60.02)).toBeNull();
  });
});
```

- [ ] **Step 3: Write the failing screen tests (NASA POWER credited in « Sources »)**

In `src/features/compas/__tests__/compasScreen.test.tsx`, replace:

```tsx
  it('Parcours : chercher un lieu, voir la communauté, choisir découpé sur les dates', async () => {
```

with:

```tsx
  const openSources = async () => {
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Sources/ }));
    return sheet;
  };

  it('Sources : NASA POWER cité quand sa tendance sert au calendrier', async () => {
    const data = makeData();
    data.weather = {
      source: 'MET Norway',
      trendSource: 'NASA POWER',
      horizon: '2026-10-21',
      tripDays: [],
      calendar: [
        { date: '2026-10-30', kind: 'tendance' as const, quality: 'bon' as const, reasons: [], tMin: 3, tMax: 12 },
      ],
    };
    render(<CompasScreen data={data} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('NASA POWER (tendance, normales 2001-2020)')).toBeTruthy();
  });

  it('Sources : période tirée des normales (note de la préparation) : NASA POWER cité', async () => {
    const data = makeData();
    data.autofillNotes = [
      'Période proposée : août (mois le plus sec selon les normales 2001-2020 (NASA POWER)). Change-la dans « Quand » si elle ne te va pas.',
    ];
    render(<CompasScreen data={data} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('NASA POWER (tendance, normales 2001-2020)')).toBeTruthy();
  });

  it('Sources : ni tendance ni normales, NASA POWER n’est pas cité', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('Étapes et dépenses du voyage')).toBeTruthy();
    expect(within(sheet).queryByText(/NASA POWER/)).toBeNull();
  });

  it('Parcours : chercher un lieu, voir la communauté, choisir découpé sur les dates', async () => {
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/projectContext.test.ts src/features/compas/__tests__/period.test.ts src/features/compas/__tests__/metno.test.ts src/features/compas/__tests__/powerNormals.test.ts src/features/compas/__tests__/compasScreen.test.tsx`

Expected: FAIL — July at `lat: -45` still gives `bivouac`; `driestMonth is not a function` / `needsDryNormals is not a function`; `powerClimatology is not a function`; `climatologyUrl is not a function`; the two « NASA POWER cité » screen tests cannot find the chip (the « pas cité » one already passes).

- [ ] **Step 5: Hemisphere-aware winter in `engine/projectContext.ts`**

Replace:

```ts
  /** Mois du départ (1-12), si connu. */
  month: number | null;
```

with:

```ts
  /** Mois du départ (1-12), si connu. */
  month: number | null;
  /** Latitude de la destination, si connue : au sud, les saisons sont décalées de six mois. */
  lat?: number | null;
```

Replace:

```ts
const WINTER = new Set([11, 12, 1, 2, 3]);
```

with:

```ts
/** Mois d'hiver dans l'hémisphère nord. */
const WINTER = new Set([11, 12, 1, 2, 3]);

/** Le mois équivalent dans l'hémisphère nord : au sud, six mois de décalage (juillet ↔ janvier). */
function northernEquivalent(month: number, lat: number | null | undefined): number {
  return lat != null && lat < 0 ? ((month + 5) % 12) + 1 : month;
}
```

Replace:

```ts
      const cold = input.month != null && WINTER.has(input.month);
```

with:

```ts
      const cold = input.month != null && WINTER.has(northernEquivalent(input.month, input.lat));
```

- [ ] **Step 6: Callers pass the destination latitude**

In `src/features/compas/server/getCompasData.ts`, replace:

```ts
      month: trip.start_date ? Number(String(trip.start_date).slice(5, 7)) : null,
      maxAltitudeM: elevation?.maxM ?? null,
```

with:

```ts
      month: trip.start_date ? Number(String(trip.start_date).slice(5, 7)) : null,
      // Hiver selon l'hémisphère : latitude du départ, sinon du lieu retrouvé sur la carte.
      lat: origin?.lat ?? anchorPoint(trip.metadata)?.lat ?? null,
      maxAltitudeM: elevation?.maxM ?? null,
```

In `src/features/compas/server/autofillActions.ts`, replace:

```ts
    const ctx = resolveProjectContext({
      activity,
      days,
      hours: shortHoursOf(days, compas.durationHours),
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      project: compas.preferences,
      profile,
    });
```

with:

```ts
    const ctx = resolveProjectContext({
      activity,
      days,
      hours: shortHoursOf(days, compas.durationHours),
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      // Le lieu n'est retrouvé qu'ensuite : la destination déjà gardée sur le voyage, si elle existe.
      lat: readAnchor(meta)?.lat ?? null,
      project: compas.preferences,
      profile,
    });
```

and replace:

```ts
    const nightCtx = resolveProjectContext({
      activity,
      days,
      hours: shortHoursOf(days, compas.durationHours),
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      maxAltitudeM: maxAltitude,
```

with:

```ts
    const nightCtx = resolveProjectContext({
      activity,
      days,
      hours: shortHoursOf(days, compas.durationHours),
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      lat: anchor.lat,
      maxAltitudeM: maxAltitude,
```

(`anchor` is narrowed to non-null there: the function returns at original line 952 when no anchor is found, and `anchor.lat` is already read the same way at original lines 964 and 1004.)

- [ ] **Step 7: Dry season from the normals in `engine/period.ts`**

Replace:

```ts
  /** Aujourd'hui (AAAA-MM-JJ). */
  today: string;
  days: number;
}
```

with:

```ts
  /** Aujourd'hui (AAAA-MM-JJ). */
  today: string;
  days: number;
  /**
   * Normales mensuelles de précipitations (mm/jour, janvier → décembre, NASA
   * POWER 2001-2020) : servent seulement aux tropiques absents de la table.
   */
  normals?: { precip: number[] } | null;
}
```

Replace:

```ts
/**
 * Tropiques : la saison sèche, pays par pays (sources : climats généraux,
 * conseillée par les offices de tourisme), le mois le plus sûr au cœur de
 * cette saison. Un pays absent de la table : aucune période plutôt qu'une
 * fausse certitude.
 */
```

with:

```ts
/**
 * Tropiques : la saison sèche, pays par pays (sources : climats généraux,
 * conseillée par les offices de tourisme), le mois le plus sûr au cœur de
 * cette saison. Un pays absent de la table : le mois le plus sec des normales
 * NASA POWER 2001-2020 au point même (`driestMonth`), sinon aucune période
 * plutôt qu'une fausse certitude. Aucune ligne n'est ajoutée à la main.
 */
```

Replace:

```ts
export function bestPeriod(input: PeriodInput): BestPeriod | null {
  const tropical = input.lat != null && Math.abs(input.lat) < 23.5 && input.activity !== 'ski';
  const dry = tropical ? TROPICAL_DRY[(input.countryCode ?? '').toUpperCase()] : null;
  if (tropical && !dry) return null;
```

with:

```ts
/** Raison affichée quand le mois vient des normales (et non de la table). */
export const NORMALS_WHY = 'mois le plus sec selon les normales 2001-2020 (NASA POWER)';

function isTropical(input: Pick<PeriodInput, 'activity' | 'lat'>): boolean {
  return input.lat != null && Math.abs(input.lat) < 23.5 && input.activity !== 'ski';
}

function dryRow(countryCode: string | null | undefined): { month: number; why: string } | null {
  return TROPICAL_DRY[(countryCode ?? '').toUpperCase()] ?? null;
}

/**
 * Tropiques hors de la table : seules les normales climatiques peuvent dire
 * la saison sèche (le serveur ne les demande que dans ce cas).
 */
export function needsDryNormals(input: Pick<PeriodInput, 'activity' | 'lat' | 'countryCode'>): boolean {
  return isTropical(input) && !dryRow(input.countryCode);
}

/**
 * Mois (1-12) au centre de la fenêtre de trois mois la plus sèche, en boucle
 * sur l'année (décembre-janvier-février compte). À égalité, le premier.
 */
export function driestMonth(precip: number[]): number {
  let best = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 12; i += 1) {
    const sum = precip[(i + 11) % 12] + precip[i] + precip[(i + 1) % 12];
    if (sum < bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  return best + 1;
}

/** Douze valeurs lisibles, sinon rien : aucune normale n'est comblée. */
function usableNormals(normals: PeriodInput['normals']): number[] | null {
  const p = normals?.precip;
  return Array.isArray(p) && p.length === 12 && p.every((v) => Number.isFinite(v) && v >= 0) ? p : null;
}

export function bestPeriod(input: PeriodInput): BestPeriod | null {
  const tropical = isTropical(input);
  // La table garde la priorité ; hors d'elle, le mois le plus sec des normales
  // NASA POWER ; sans normales lisibles, aucune période plutôt qu'une supposition.
  const precip = tropical ? usableNormals(input.normals) : null;
  const dry = tropical
    ? (dryRow(input.countryCode) ?? (precip ? { month: driestMonth(precip), why: NORMALS_WHY } : null))
    : null;
  if (tropical && !dry) return null;
```

(The rest of `bestPeriod` is unchanged: it already uses `dry.month` and `dry.why` and applies no southern shift to a dry-season month.)

- [ ] **Step 8: Pure parse of the climatology in `engine/metno.ts`**

Replace (end of `powerToDaily`):

```ts
      wind_gusts_10m_max: keys.map((k) => read('WS10M_MAX', k, 3.6)),
    },
  };
}
```

with:

```ts
      wind_gusts_10m_max: keys.map((k) => read('WS10M_MAX', k, 3.6)),
    },
  };
}

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

/**
 * NASA POWER, climatologie (normales mensuelles 2001-2020) : précipitations
 * moyennes de janvier à décembre, en mm/jour. Un mois absent, illisible ou
 * égal à la valeur de remplissage (-999) : null, rien n'est comblé.
 */
export function powerClimatology(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as {
    properties?: { parameter?: { PRECTOTCORR?: Record<string, unknown> } };
    header?: { fill_value?: unknown };
  };
  const series = p.properties?.parameter?.PRECTOTCORR;
  if (!series || typeof series !== 'object') return null;
  const fillRaw = p.header?.fill_value;
  const fill = typeof fillRaw === 'number' ? fillRaw : -999;
  const out: number[] = [];
  for (const k of MONTH_KEYS) {
    const v = num(series[k]);
    if (v == null || v === fill || v < 0) return null;
    out.push(v);
  }
  return out;
}
```

(`num(v: unknown): number | null` already exists in `metno.ts`, line 105.)

- [ ] **Step 9: Server fetch in `server/weather.ts` (30-day cache, failure → null)**

Replace line 9:

```ts
import { METNO_SOURCE, POWER_SOURCE, parseMetNo, powerToDaily } from '../engine/metno';
```

with:

```ts
import { METNO_SOURCE, POWER_SOURCE, parseMetNo, powerClimatology, powerToDaily } from '../engine/metno';
```

Replace (module doc, lines 19-21):

```ts
 * - Calendrier des conditions sur 6 semaines au point de départ : prévision
 *   tant qu'elle couvre (~9 jours), puis TENDANCE (moyenne des 5 dernières
 *   années aux mêmes dates, NASA POWER). La tendance est toujours étiquetée.
```

with:

```ts
 * - Calendrier des conditions sur 6 semaines au point de départ : prévision
 *   tant qu'elle couvre (~9 jours), puis TENDANCE (moyenne des 5 dernières
 *   années aux mêmes dates, NASA POWER). La tendance est toujours étiquetée.
 * - Normales mensuelles (NASA POWER, climatologie 2001-2020, gardées 30 jours) :
 *   le mois le plus sec d'une destination tropicale absente de la table des
 *   saisons sèches (`getPrecipNormals`, une demande par préparation).
```

Replace line 33:

```ts
const POWER = 'https://power.larc.nasa.gov/api/temporal/daily/point';
```

with:

```ts
const POWER = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const POWER_CLIMATOLOGY = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
/** Les normales 2001-2020 ne bougent pas : une réponse sert 30 jours. */
const NORMALS_REVALIDATE_S = 30 * 86_400;
```

Replace (end of `trendUrl`):

```ts
    end: end.replaceAll('-', ''),
    format: 'JSON',
  });
  return `${POWER}?${q.toString()}`;
}
```

with:

```ts
    end: end.replaceAll('-', ''),
    format: 'JSON',
  });
  return `${POWER}?${q.toString()}`;
}

/** Normales mensuelles de précipitations (climatologie 2001-2020) au point arrondi à 0,01°. */
export function climatologyUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: 'PRECTOTCORR',
    community: 'RE',
    longitude: at2(lon),
    latitude: at2(lat),
    format: 'JSON',
  });
  return `${POWER_CLIMATOLOGY}?${q.toString()}`;
}
```

Replace (end of `getJson`):

```ts
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}
```

with:

```ts
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Normales mensuelles de précipitations au point (mm/jour, janvier → décembre),
 * ou null (service injoignable, mois manquant) : la période reste alors non
 * proposée, comme avant.
 */
export async function getPrecipNormals(lat: number, lon: number): Promise<{ precip: number[] } | null> {
  const precip = powerClimatology(await getJson(climatologyUrl(lat, lon), NORMALS_REVALIDATE_S, 8000));
  return precip ? { precip } : null;
}
```

- [ ] **Step 10: The preparation asks for the normals only when needed**

In `src/features/compas/server/autofillActions.ts`, replace:

```ts
import { bestPeriod, monthName } from '../engine/period';
```

with:

```ts
import { bestPeriod, monthName, needsDryNormals } from '../engine/period';
```

Replace (line written by Task 1):

```ts
import { travellerToday } from '../engine/zone';
```

with:

```ts
import { travellerToday } from '../engine/zone';
import { getPrecipNormals } from './weather';
```

Replace:

```ts
    if (!trip.start_date && !resume && ctx.scope === 'sejour') {
      const period = bestPeriod({ activity, lat: anchor.lat, countryCode: anchor.countryCode, today, days });
```

with:

```ts
    if (!trip.start_date && !resume && ctx.scope === 'sejour') {
      // Tropiques hors de la table des saisons sèches : le mois le plus sec des
      // normales NASA POWER (une demande par préparation, gardée 30 jours).
      // Service injoignable : aucune période, comme avant.
      const normals = needsDryNormals({ activity, lat: anchor.lat, countryCode: anchor.countryCode })
        ? await getPrecipNormals(anchor.lat, anchor.lon)
        : null;
      const period = bestPeriod({
        activity,
        lat: anchor.lat,
        countryCode: anchor.countryCode,
        today,
        days,
        normals,
      });
```

- [ ] **Step 11: Credit NASA POWER in the Compas « Sources » list**

In `src/features/compas/components/CompasSheets.tsx`, replace:

```tsx
function SourcesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const sources = [
    'Étapes et dépenses du voyage',
    'Ton inventaire',
    m.weather.days.length ? 'MET Norway (météo, CC BY 4.0)' : null,
    m.daylight ? 'Calcul astronomique (lumière)' : null,
```

with:

```tsx
function SourcesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  // NASA POWER (domaine public, citation demandée) : tendance du calendrier au-delà
  // de la prévision, et normales 2001-2020 d'une période proposée par la préparation.
  const usesPower =
    Boolean(ctl.data.weather?.calendar.some((c) => c.kind === 'tendance')) ||
    Boolean(ctl.data.autofillNotes?.some((n) => n.includes('NASA POWER')));
  const sources = [
    'Étapes et dépenses du voyage',
    'Ton inventaire',
    m.weather.days.length ? 'MET Norway (météo, CC BY 4.0)' : null,
    usesPower ? 'NASA POWER (tendance, normales 2001-2020)' : null,
    m.daylight ? 'Calcul astronomique (lumière)' : null,
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/projectContext.test.ts src/features/compas/__tests__/period.test.ts src/features/compas/__tests__/metno.test.ts src/features/compas/__tests__/powerNormals.test.ts src/features/compas/__tests__/compasScreen.test.tsx`

Expected: PASS.

Then: `npx vitest run src/features/compas`
Expected: PASS (the existing `period.test.ts` case « tropiques : … sinon aucune période inventée » still returns null without normals).

- [ ] **Step 13: Type-check, lint, client-bundle guard**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

Run: `grep -rn "tz-lookup\|server/weather" src/features/compas/components src/features/compas/engine`
Expected: no output (the NASA POWER fetch and tz-lookup stay in `server/weather.ts`, imported only by server files).

Run: `npx eslint src/features/compas/engine/projectContext.ts src/features/compas/engine/period.ts src/features/compas/engine/metno.ts src/features/compas/server/weather.ts src/features/compas/server/autofillActions.ts src/features/compas/server/getCompasData.ts src/features/compas/components/CompasSheets.tsx`
Expected: no error.

- [ ] **Step 14: Commit the code**

```bash
git add src/features/compas/engine/projectContext.ts \
  src/features/compas/engine/period.ts \
  src/features/compas/engine/metno.ts \
  src/features/compas/server/weather.ts \
  src/features/compas/server/autofillActions.ts \
  src/features/compas/server/getCompasData.ts \
  src/features/compas/components/CompasSheets.tsx \
  src/features/compas/__tests__/projectContext.test.ts \
  src/features/compas/__tests__/period.test.ts \
  src/features/compas/__tests__/metno.test.ts \
  src/features/compas/__tests__/powerNormals.test.ts \
  src/features/compas/__tests__/compasScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat(compas): hiver selon l'hémisphère, saison sèche par les normales NASA POWER

L'hiver du contexte projet est décalé de six mois au sud. Une destination
tropicale absente de la table des saisons sèches reçoit le mois le plus
sec des normales NASA POWER 2001-2020 au point (une demande par
préparation, gardée 30 jours) ; aucune ligne n'est écrite à la main, et
sans normales lisibles aucune période n'est proposée. NASA POWER est
cité dans les sources du Compas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
EOF
)"
```

- [ ] **Step 15: Tick PLAN-100 §4.7 with one line of evidence each**

In `docs/compas/PLAN-100.md`, replace (lines 618-623):

```markdown
- [ ] « Aujourd'hui » au fuseau du voyageur (navigateur) partout (serveur, calendrier,
      `CompasStart`).
- [ ] Lever et coucher du soleil au fuseau de la destination (`tz-lookup`) au-delà de la
      prévision ; départ conseillé juste.
- [ ] Hiver selon l'hémisphère ; table des saisons sèches complétée (Brésil, nord de
      l'Australie, Caraïbes, Afrique de l'Ouest, Guyane, Mayotte).
```

with:

```markdown
- [x] « Aujourd'hui » au fuseau du voyageur (navigateur) partout (serveur, calendrier,
      `CompasStart`). Lot M : fuseau du navigateur envoyé au serveur (repli Paris), météo
      datée au fuseau de la destination (`zone.test.ts`, `compasWeather.test.ts`).
- [x] Lever et coucher du soleil au fuseau de la destination (`tz-lookup`) au-delà de la
      prévision ; départ conseillé juste. Lot M : « heure locale », départ à l'aube si 7 h
      ne suffit pas, « HH:MM » enfin lu (`sun.test.ts`, `weather.test.ts`, `danger.test.ts`).
- [x] Hiver selon l'hémisphère ; table des saisons sèches complétée (Brésil, nord de
      l'Australie, Caraïbes, Afrique de l'Ouest, Guyane, Mayotte). Lot M : hors table, mois
      le plus sec des normales NASA POWER, sans ligne inventée (`period.test.ts`).
```

- [ ] **Step 16: One line in ETAT.md**

In `docs/compas/ETAT.md`, replace (line 37):

```markdown
serveur en base ; base à 429,4 Mio.
```

with:

```markdown
serveur en base ; base à 429,4 Mio.
Lot M (plan `docs/superpowers/plans/2026-10-09-compas-lot-m.md`, PLAN-100 4.7) : « aujourd'hui » au fuseau du navigateur, soleil et départ au fuseau de la destination, hiver selon l'hémisphère, saison sèche des tropiques hors table par les normales NASA POWER ; tests verts, à prouver sur l'aperçu.
```

- [ ] **Step 17: Commit the docs**

```bash
git add docs/compas/PLAN-100.md docs/compas/ETAT.md
git commit -m "$(cat <<'EOF'
docs(compas): lot M, PLAN-100 4.7 cochée avec ses preuves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
EOF
)"
```

---

## Self-review (done while writing)

- **Spec coverage.** §4.7 box 1 → Task 1 (server actions take the browser zone; `CompasStart`, inventory dates and the Quand fallback use `browserToday`; weather « aujourd'hui » in the destination zone). Box 2 → Task 2 (destination zone computed once server-side, `CompasData.zone`, model daylight and `DayDetail` use it, « heure locale », `departureAdvice` first-light rule) plus the latent `"HH:MM"` bug (`clockMinutes` in `kitRules.ts` and `danger.ts`). Box 3 → Task 3 (`projectContext` hemisphere, NASA POWER normals with `driestMonth`, `bestPeriod` normals, autofill wiring, 30-day cache, attribution chip). Docs → Task 3, steps 15-17.
- **Placeholder scan.** Every code step carries the full code or the exact old/new snippet; no « TBD », no « similar to Task N ».
- **Type consistency.** `travellerToday(timeZone: unknown, now?: Date)`, `browserTimeZone(): string | null`, `browserToday(now?: Date)`, `safeTimeZone(z: unknown)`, `differentClock(a, b, at)`, `destinationZone(point, fallback)`, `clockMinutes(s)`, `CompasData.zone?: string`, `anchorPoint(metadata)`, `ContextInput.lat?: number | null`, `PeriodInput.normals?: { precip: number[] } | null`, `driestMonth(precip: number[])`, `needsDryNormals(...)`, `NORMALS_WHY`, `powerClimatology(payload)`, `climatologyUrl(lat, lon)`, `getPrecipNormals(lat, lon)` — same names and shapes in every task that produces or consumes them.
- **Client bundle.** `engine/zone.ts` imports only `./sun` (pure); `tz-lookup` stays in `server/weather.ts`; client components only import `engine/zone.ts` and the type `CompasData`. Steps 13 (Task 1), 11 (Task 2) and 13 (Task 3) grep for it.
- **Not covered by an automated test (review by reading):** the autofill wiring itself (`needsDryNormals` → `getPrecipNormals` → `bestPeriod`, and `travellerToday(timeZone)` inside `compasAutofillAction`): the existing autofill harnesses stop before the dates step. Each piece is unit-tested; the wiring is three lines.
