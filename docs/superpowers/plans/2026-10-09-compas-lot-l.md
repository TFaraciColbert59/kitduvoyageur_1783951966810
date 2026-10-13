# Compas lot L — fiabilité à 0 € : MET Norway, limites, erreurs serveur, cookies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer quatre cases de `docs/compas/PLAN-100.md` sans rien payer : MET Norway respecté (1.8), limite sur les actions qui appellent la carte et l'IA (2.2), journal d'erreurs serveur sans donnée personnelle avec alertes du rapport quotidien (2.9), cookies de session `SameSite=Lax` (2.11).

**Architecture:** Un seul point d'accès MET Norway (`src/lib/weather/metnoRequest.ts`) qui étale les départs et garde le cache au-delà d'`Expires`. Les deux actions coûteuses du Compas passent par `enforceRateLimit` (déjà distribué en base). Un enregistreur `reportServerError` écrit chaque erreur serveur du Compas, rédigée, dans une table `app_errors` lisible par la seule clé de service ; le rapport quotidien les compte et lève des alertes. Les cookies Supabase du navigateur passent en `Lax` sauf dans un cadre d'un autre site.

**Tech Stack:** Next.js 15 (server actions), TypeScript strict, Vitest, Supabase (Postgres, RLS), `@supabase/ssr`.

**Spec:** `docs/compas/PLAN-100.md` (cases 1.8, 2.2, 2.9, 2.11) ; règles du dépôt dans `CLAUDE.md`.

## Global Constraints

- Budget 0 € : aucune dépendance nouvelle, aucun service payant.
- Commentaires et messages en français, au tutoiement côté écran (« patiente », « réessaie »), comme le code voisin.
- Aucune donnée personnelle stockée : ni e-mail, ni identifiant, ni adresse IP, ni coordonnée précise dans `app_errors`.
- Toute table nouvelle : RLS activée, `revoke all … from anon, authenticated`.
- Ne jamais pousser (`git push`) ni appliquer de migration en base : le contrôleur s'en charge.
- Chaque commit se termine par ces deux lignes exactes :
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ`
- Vérifications avant chaque commit : `npx vitest run <fichiers de test touchés>`, `npx tsc --noEmit -p tsconfig.json`, `npx eslint <fichiers touchés>` — tout propre.
- Couleur `#E4501C` interdite ; jetons `--lkv-*` (aucun écran modifié dans ce lot).

---

### Task 1: MET Norway — un seul point d'accès, 20 requêtes/s, cache au-delà d'`Expires` (plan 1.8)

Contexte mesuré le 9 oct. : `api.met.no` répond `expires` 31 min 55 s après `date` ; le cache actuel (`revalidate: 1800`) peut donc redemander avant `Expires`. Les conditions de MET Norway : User-Agent identifiant (déjà fait par `appUserAgent`), 20 requêtes par seconde au plus, ne pas redemander avant `Expires`.

**Files:**
- Create: `src/lib/weather/metnoRequest.ts`
- Modify: `src/lib/weather/metnoFetch.ts` (l'appel `fetch` vers `FORECAST`)
- Modify: `src/features/compas/server/weather.ts` (les appels de `getJson` dont l'URL vient de `forecastUrl(...)` ; NASA POWER garde `getJson`)
- Test: `tests/lib/metno-request.spec.ts`

**Interfaces:**
- Produces: `METNO_MAX_PER_SECOND = 20`, `METNO_REVALIDATE_S = 2700`, `metnoSlot(now?, sleep?): Promise<void>`, `resetMetnoSlots(): void`, `metnoGet(url: string, opts: { purpose: string; timeoutMs?: number; signal?: AbortSignal }): Promise<unknown | null>`.

- [ ] **Step 1: Write the failing test** — `tests/lib/metno-request.spec.ts`

```ts
/**
 * Plan 1.8 : MET Norway — 20 requêtes par seconde au plus, jamais avant
 * `Expires` (cache de 45 min, Expires mesuré à ~32 min), User-Agent du site.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { METNO_MAX_PER_SECOND, METNO_REVALIDATE_S, metnoGet, metnoSlot, resetMetnoSlots } from '@/lib/weather/metnoRequest';

afterEach(() => {
  resetMetnoSlots();
  vi.unstubAllGlobals();
});

describe('rythme MET Norway', () => {
  it('20 départs par seconde au plus : le 21e attend la fin de la fenêtre', async () => {
    let t = 0;
    const waits: number[] = [];
    const now = () => t;
    const sleep = async (ms: number) => {
      waits.push(ms);
      t += ms;
    };
    for (let i = 0; i < METNO_MAX_PER_SECOND; i += 1) await metnoSlot(now, sleep);
    expect(waits).toEqual([]);
    await metnoSlot(now, sleep);
    expect(waits.length).toBe(1);
    expect(t).toBeGreaterThanOrEqual(1000);
  });
});

describe('requête MET Norway', () => {
  it('cache de 45 min (au-delà d’Expires) et User-Agent du site', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = await metnoGet('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=45.90&lon=6.13', {
      purpose: 'meteo',
    });
    expect(body).toEqual({ ok: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } };
    expect(init.next?.revalidate).toBe(METNO_REVALIDATE_S);
    expect(METNO_REVALIDATE_S).toBeGreaterThan(32 * 60);
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('koosmoweb.fr');
  });

  it('réponse en erreur ou réseau coupé : null, jamais d’exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await metnoGet('https://api.met.no/x', { purpose: 'meteo' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau'); }));
    expect(await metnoGet('https://api.met.no/x', { purpose: 'meteo' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/metno-request.spec.ts`
Expected: FAIL (module `@/lib/weather/metnoRequest` introuvable).

- [ ] **Step 3: Write minimal implementation** — `src/lib/weather/metnoRequest.ts`

```ts
import { appUserAgent } from '@/lib/userAgent';

/**
 * MET Norway (plan 1.8), le seul point d'accès du site. Conditions d'usage :
 * User-Agent qui identifie l'application, 20 requêtes par seconde au plus,
 * ne pas redemander une prévision avant son `Expires`.
 *
 * - Rythme : au plus 20 départs dans toute fenêtre d'une seconde, par instance
 *   de fonction. À l'échelle du site, le cache de données partagé de Vercel
 *   absorbe les répétitions (même point arrondi à 0,01°, même URL).
 * - Cache : `Expires` tombe ~32 min après la réponse (mesuré le 9 oct.) ; le
 *   cache garde 45 min, donc rien n'est redemandé avant `Expires`.
 */
export const METNO_MAX_PER_SECOND = 20;
export const METNO_REVALIDATE_S = 2700;

let sent: number[] = [];

/** Attend, si besoin, qu'un départ soit permis par la fenêtre glissante d'une seconde. */
export async function metnoSlot(
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<void> {
  for (;;) {
    const t = now();
    sent = sent.filter((s) => t - s < 1000);
    if (sent.length < METNO_MAX_PER_SECOND) {
      sent.push(t);
      return;
    }
    await sleep(1000 - (t - sent[0]) + 1);
  }
}

/** Remet la fenêtre à zéro (tests). */
export function resetMetnoSlots(): void {
  sent = [];
}

/** GET JSON vers MET Norway ; null si la réponse n'est pas exploitable. */
export async function metnoGet(
  url: string,
  opts: { purpose: string; timeoutMs?: number; signal?: AbortSignal }
): Promise<unknown | null> {
  await metnoSlot();
  try {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 6000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const res = await fetch(url, {
      headers: { 'User-Agent': appUserAgent(opts.purpose), Accept: 'application/json' },
      next: { revalidate: METNO_REVALIDATE_S },
      signal,
    } as RequestInit);
    if (!res.ok) {
      console.warn('[meteo] MET Norway', res.status);
      return null;
    }
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Route the two callers through `metnoGet`**

In `src/lib/weather/metnoFetch.ts`, replace the `fetch(...)`/`res.ok`/`res.json()` block with:

```ts
  const json = await metnoGet(`${FORECAST}?lat=${la}&lon=${lo}`, {
    purpose: 'meteo',
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  });
  return json ? metnoToOpenMeteo(json, zone) : null;
```

(remove the now-unused `USER_AGENT` constant and `appUserAgent` import; keep the comment, updated to say the cache follows `METNO_REVALIDATE_S`). In `src/features/compas/server/weather.ts`, every call `getJson(forecastUrl(...), <revalidate>, <timeout?>)` becomes `metnoGet(forecastUrl(...), { purpose: 'Compas, meteo', timeoutMs: <timeout or 6000> })`; `getJson` stays for NASA POWER (`trendUrl`). Update the module comment line on MET Norway's cache accordingly.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/lib/metno-request.spec.ts src/features/compas/__tests__/weather.test.ts src/features/compas/__tests__/metno.test.ts src/features/adventure-prep/__tests__/h6-zero-fallback.test.ts`
Expected: PASS (adapt a mock only if it asserted the old `revalidate: 1800` value — never delete an assertion).

- [ ] **Step 6: Commit**

```bash
git add src/lib/weather/metnoRequest.ts src/lib/weather/metnoFetch.ts src/features/compas/server/weather.ts tests/lib/metno-request.spec.ts
git commit -m "fix(meteo): MET Norway par un seul point, 20 req/s, jamais avant Expires (plan 1.8)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ"
```

---

### Task 2: Limite sur la destination et la compréhension de la phrase (plan 2.2)

`compasSetDestinationAction` appelle la carte (Photon, LocationIQ, Geoapify) et parfois l'IA ; `compasInterpretAction` appelle l'IA et les taux de change. Aucune n'a de limite par personne.

**Files:**
- Modify: `src/features/compas/server/compasActions.ts` (`compasSetDestinationAction` vers la ligne 597, `compasInterpretAction` vers la ligne 1659)
- Test: `src/features/compas/__tests__/actionLimits.test.ts`

**Interfaces:**
- Consumes: `enforceRateLimit(identifier, { scope, limit, windowMs, failMode })` de `@/lib/rate-limit/routes` (rend `null` ou une `Response` 429/503).
- Produces: scopes `compas-destination` (20 par 10 min par personne) et `compas-interpret` (30 par 10 min par personne).

- [ ] **Step 1: Write the failing test** — `src/features/compas/__tests__/actionLimits.test.ts`, on the mocking pattern of `src/features/compas/__tests__/autofillLimits.test.ts` (mock `server-only`, `@/lib/rate-limit/routes`, `../server/compasServer` `requireEditor`). Also mock `../server/placeLookup` (every exported lookup as `vi.fn` returning null) and `@/lib/ai/askAI` (`askAI` as `vi.fn`). Cases:

```ts
it('destination : limite atteinte → message clair, aucune recherche sur la carte', async () => {
  h.refuse = { scope: 'compas-destination', status: 429 };
  const res = await compasSetDestinationAction({ tripId: TRIP, place: 'Vercors' });
  expect(res).toEqual({ success: false, error: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.' });
  expect(lookupDestination).not.toHaveBeenCalled();
});
it('destination : compteur indisponible → refus dit, aucune recherche', async () => {
  h.refuse = { scope: 'compas-destination', status: 503 };
  const res = await compasSetDestinationAction({ tripId: TRIP, place: 'Vercors' });
  expect(res).toEqual({ success: false, error: 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.' });
});
it('destination : compte 20 par 10 min par personne', async () => {
  await compasSetDestinationAction({ tripId: TRIP, place: 'Vercors' });
  expect(h.calls).toContainEqual({ identifier: 'u1', scope: 'compas-destination', limit: 20 });
});
it('phrase : limite atteinte → message clair, aucune IA', async () => {
  h.refuse = { scope: 'compas-interpret', status: 429 };
  const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors' });
  expect(res).toEqual({ success: false, error: 'Trop de demandes d’affilée : patiente quelques minutes.' });
  expect(askAI).not.toHaveBeenCalled();
});
it('phrase : compte 30 par 10 min par personne', async () => {
  // askAI mocké : rend { degraded: true, provider: 'fallback', text: '{}' }
  await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors' });
  expect(h.calls).toContainEqual({ identifier: 'u1', scope: 'compas-interpret', limit: 30 });
});
```

Read the real input schemas (`destinationSchema`, the interpret schema) and the real auth call in each action first: if `compasInterpretAction` authenticates another way than `requireEditor`, mock that instead and keep the same assertions. `windowMs` is `600_000` for both (the `h.calls` record above deliberately omits it).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/compas/__tests__/actionLimits.test.ts`
Expected: FAIL (no `compas-destination` / `compas-interpret` call recorded).

- [ ] **Step 3: Write minimal implementation**

In `compasSetDestinationAction`, right after the `requireEditor` check:

```ts
    // La carte (Photon, LocationIQ, Geoapify) et parfois l'IA : comptées par personne (plan 2.2).
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
```

In `compasInterpretAction`, right after the authentication succeeds (before any `parseIntentRules`/`askAI` call), the same block with `scope: 'compas-interpret'`, `limit: 30`, and messages `'Trop de demandes d’affilée : patiente quelques minutes.'` (429) / `'Compréhension indisponible pour le moment : réessaie dans un instant.'` (503). Use the user id variable the action already has.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/compas/__tests__/actionLimits.test.ts src/features/compas/__tests__/autofillLimits.test.ts src/features/compas/__tests__/compasScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/compas/server/compasActions.ts src/features/compas/__tests__/actionLimits.test.ts
git commit -m "fix(compas): limite par personne sur la destination et la phrase (plan 2.2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ"
```

---

### Task 3: Erreurs serveur journalisées sans donnée personnelle, alertes du rapport (plan 2.9 et 1.1)

**Files:**
- Create: `supabase/migrations/20261009090000_app_errors.sql`
- Create: `src/lib/observability/appErrors.ts` (NOT re-exported from `src/lib/observability/index.ts`, which is imported client-side)
- Modify: `src/features/compas/server/compasActions.ts`, `src/features/compas/server/autofillActions.ts`, `src/features/compas/server/getCompasData.ts` — every catch-block line of the exact form `console.error('[compas] <label>', err);` (second argument = the caught error variable) becomes `await reportServerError('compas.<label>', err);` with `<label>` unchanged. Other `console.error` lines (Supabase `{code, message}` logs) stay as they are.
- Test: `tests/observability/app-errors.spec.ts`

**Interfaces:**
- Produces: `appErrorRow(scope: string, err: unknown): { scope: string; code: string | null; message: string }`, `reportServerError(scope: string, err: unknown): Promise<void>` (never throws; keeps the original `console.error(\`[${scope}]\`, err)`).
- Consumes: `redactString` from `src/lib/observability/logger.ts`; `getServiceSupabase` from `@/lib/ai/serviceClient` (as in `src/features/compas/server/opsEvents.ts`).

- [ ] **Step 1: Write the failing test** — `tests/observability/app-errors.spec.ts`

```ts
/** Plan 2.9 : erreurs serveur gardées sans donnée personnelle, jamais bloquantes. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], fail: false as false | 'insert' | 'client' }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () =>
    h.fail === 'client'
      ? null
      : {
          from: () => ({
            insert: async (row: unknown) => {
              if (h.fail === 'insert') return { error: { code: '42501' } };
              h.rows.push(row);
              return { error: null };
            },
          }),
        },
}));

import { appErrorRow, reportServerError } from '@/lib/observability/appErrors';

beforeEach(() => {
  h.rows = [];
  h.fail = false;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('ligne d’erreur', () => {
  it('ni e-mail, ni identifiant, ni adresse IP ; message tronqué à 300', () => {
    const err = new Error(
      `échec pour tony@example.com trip 11111111-1111-4111-8111-111111111111 depuis 203.0.113.7 ${'x'.repeat(400)}`
    );
    const row = appErrorRow('compas.compasInterpretAction', err);
    expect(row.message).not.toContain('tony@example.com');
    expect(row.message).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(row.message).not.toContain('203.0.113.7');
    expect(row.message.length).toBeLessThanOrEqual(300);
    expect(row.scope).toBe('compas.compasInterpretAction');
  });

  it('code : celui de l’erreur s’il existe, sinon son nom', () => {
    expect(appErrorRow('s', Object.assign(new Error('x'), { code: 'PGRST116' })).code).toBe('PGRST116');
    expect(appErrorRow('s', new TypeError('x')).code).toBe('TypeError');
    expect(appErrorRow('s', 'texte').code).toBeNull();
  });
});

describe('enregistrement', () => {
  it('écrit la ligne rédigée', async () => {
    await reportServerError('compas.test', new Error('boum'));
    expect(h.rows).toEqual([{ scope: 'compas.test', code: 'Error', message: 'boum' }]);
  });

  it('table ou clé indisponible : jamais d’exception', async () => {
    h.fail = 'insert';
    await expect(reportServerError('compas.test', new Error('boum'))).resolves.toBeUndefined();
    h.fail = 'client';
    await expect(reportServerError('compas.test', new Error('boum'))).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/observability/app-errors.spec.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation** — `src/lib/observability/appErrors.ts`

```ts
import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { redactString } from './logger';

/**
 * Erreurs serveur (plan 2.9), à 0 € : une ligne par erreur dans `app_errors`,
 * écrite avec la clé de service, lue par le rapport quotidien. Rien de la
 * personne : le lieu du code (`scope`), un code, un message rédigé (e-mails,
 * jetons, identifiants, adresses IP retirés) et tronqué à 300 caractères.
 */
export interface AppErrorRow {
  scope: string;
  code: string | null;
  message: string;
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

export function appErrorRow(scope: string, err: unknown): AppErrorRow {
  const e = (err && typeof err === 'object' ? err : null) as { name?: unknown; code?: unknown; message?: unknown } | null;
  const code =
    typeof e?.code === 'string' || typeof e?.code === 'number'
      ? String(e.code).slice(0, 40)
      : typeof e?.name === 'string'
        ? e.name.slice(0, 40)
        : null;
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : typeof e?.message === 'string' ? e.message : 'erreur';
  const message = redactString(raw).replace(UUID, '[id]').replace(IPV4, '[ip]').slice(0, 300) || 'erreur';
  return { scope: scope.slice(0, 60), code, message };
}

/** Journal Vercel (inchangé) + ligne `app_errors`. Ne lève jamais. */
export async function reportServerError(scope: string, err: unknown): Promise<void> {
  console.error(`[${scope}]`, err);
  try {
    const client = getServiceSupabase();
    if (!client) return;
    const { error } = await client.from('app_errors').insert(appErrorRow(scope, err));
    if (error) console.warn('[app_errors]', error.code);
  } catch {
    // Journal seulement : une erreur d'enregistrement ne s'ajoute jamais à l'erreur d'origine.
  }
}
```

Note: `appErrorRow('s', 'texte').code` must be `null` (a string has no `name`/`code`), and `new Error('boum')` yields `code: 'Error'` (its `name`).

- [ ] **Step 4: Migration** — `supabase/migrations/20261009090000_app_errors.sql`

```sql
-- Plan 2.9 : erreurs serveur du Compas, sans donnée personnelle (lieu du code,
-- code, message rédigé et tronqué). Écrites par le serveur seul (clé de
-- service) ; aucune lecture ni écriture depuis le navigateur. Purge à 30 jours :
-- avec les purges planifiées à lancer par Tony (aucune suppression ici).
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  scope text not null check (char_length(scope) between 1 and 60),
  code text check (code is null or char_length(code) <= 40),
  message text not null check (char_length(message) between 1 and 300)
);
create index if not exists app_errors_at_idx on public.app_errors (at);
alter table public.app_errors enable row level security;
revoke all on table public.app_errors from anon, authenticated;

-- Rapport quotidien (plan 1.1) : erreurs de la veille et alertes de seuil.
alter table public.ops_daily_reports
  add column if not exists app_errors integer not null default 0,
  add column if not exists alerts text[] not null default '{}';

create or replace function public.ops_daily_report()
returns public.ops_daily_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := date_trunc('day', now() - interval '1 day');
  v_until timestamptz := date_trunc('day', now());
  v_bytes bigint := pg_database_size(current_database());
  v_ok integer;
  v_failed integer;
  v_errors integer;
  v_alerts text[] := '{}';
  r public.ops_daily_reports;
begin
  select count(*) filter (where e.kind = 'ok'), count(*) filter (where e.kind = 'failed')
    into v_ok, v_failed
    from public.ops_preparation_events e
   where e.at >= v_since and e.at < v_until;
  select count(*) into v_errors
    from public.app_errors a
   where a.at >= v_since and a.at < v_until;
  if v_bytes > 430::bigint * 1024 * 1024 then
    v_alerts := v_alerts || 'base au-dessus de 430 Mo';
  end if;
  if v_ok + v_failed >= 10 and v_failed * 10 > v_ok + v_failed then
    v_alerts := v_alerts || 'plus de 10 % de préparations échouées';
  end if;
  if v_errors >= 50 then
    v_alerts := v_alerts || 'au moins 50 erreurs serveur';
  end if;

  insert into public.ops_daily_reports as o (
    day, db_bytes, geo_cache_rows, route_cache_rows, rate_limit_rows,
    anonymous_users, preparations_ok, preparations_failed, app_errors, alerts
  )
  select
    (now() - interval '1 day')::date,
    v_bytes,
    (select count(*) from public.geo_cache),
    (select count(*) from public.route_cache),
    (select count(*) from public.rate_limit_windows),
    (select count(*) from auth.users u where u.is_anonymous),
    v_ok,
    v_failed,
    v_errors,
    v_alerts
  on conflict (day) do update set
    db_bytes = excluded.db_bytes,
    geo_cache_rows = excluded.geo_cache_rows,
    route_cache_rows = excluded.route_cache_rows,
    rate_limit_rows = excluded.rate_limit_rows,
    anonymous_users = excluded.anonymous_users,
    preparations_ok = excluded.preparations_ok,
    preparations_failed = excluded.preparations_failed,
    app_errors = excluded.app_errors,
    alerts = excluded.alerts,
    created_at = now()
  returning * into r;
  return r;
end;
$$;

revoke all on function public.ops_daily_report() from public, anon, authenticated;
```

- [ ] **Step 5: Wire the Compas catch blocks** — in the three files listed, replace each `console.error('[compas] <label>', err);` (exact two-argument form, `err` being the caught variable, whatever its name) by `await reportServerError('compas.<label>', err);` and add `import { reportServerError } from '@/lib/observability/appErrors';`. Count the replacements and state the number in the report.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/observability src/features/compas`
Expected: PASS (tests that spy on `console.error` still see the same first argument shape only if they assert it — adapt such a spy to the new `[compas.<label>]` prefix, never delete an assertion).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261009090000_app_errors.sql src/lib/observability/appErrors.ts tests/observability/app-errors.spec.ts src/features/compas/server/compasActions.ts src/features/compas/server/autofillActions.ts src/features/compas/server/getCompasData.ts
git commit -m "feat(observabilite): erreurs serveur du Compas en base, sans donnée personnelle, et alertes du rapport (plan 2.9)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ"
```

---

### Task 4: Cookies de session `SameSite=Lax` (plan 2.11)

Le client Supabase du navigateur (`src/lib/supabase/client.ts`) écrit les cookies de session avec `SameSite=None; Secure` partout : envoyés aussi par les requêtes venues d'autres sites. `Lax` partout, sauf quand la page est ouverte dans un cadre d'un autre site (là, seul `None` fonctionne). Les autres cookies du site sont déjà `Lax` (`lkdv_kit_ref`, aventure active, langue).

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Test: `tests/lib/supabase-cookie-attrs.spec.ts`

**Interfaces:**
- Produces: `export function sessionCookieAttrs(ctx: { crossSiteFrame: boolean; https: boolean }): string` and `export function inCrossSiteFrame(): boolean` in `src/lib/supabase/client.ts`.

- [ ] **Step 1: Write the failing test** — `tests/lib/supabase-cookie-attrs.spec.ts`

```ts
/** Plan 2.11 : cookies de session Lax, None seulement dans un cadre d'un autre site. */
import { describe, expect, it } from 'vitest';
import { sessionCookieAttrs } from '@/lib/supabase/client';

describe('attributs des cookies de session', () => {
  it('page normale en HTTPS : Lax et Secure', () => {
    expect(sessionCookieAttrs({ crossSiteFrame: false, https: true })).toBe('SameSite=Lax; Secure');
  });
  it('développement en HTTP : Lax sans Secure', () => {
    expect(sessionCookieAttrs({ crossSiteFrame: false, https: false })).toBe('SameSite=Lax');
  });
  it('cadre d’un autre site : None et Secure (seul cas où Lax ne marche pas)', () => {
    expect(sessionCookieAttrs({ crossSiteFrame: true, https: true })).toBe('SameSite=None; Secure');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/supabase-cookie-attrs.spec.ts`
Expected: FAIL (`sessionCookieAttrs` is not exported).

- [ ] **Step 3: Write minimal implementation** — in `src/lib/supabase/client.ts`, add after `const PFX = 'sb_';`:

```ts
/**
 * Plan 2.11 : cookies de session `SameSite=Lax` (jamais envoyés par une requête
 * venue d'un autre site), sauf dans un cadre d'un autre site, où seul `None`
 * fonctionne. `Secure` dès que la page est en HTTPS.
 */
export function sessionCookieAttrs(ctx: { crossSiteFrame: boolean; https: boolean }): string {
  if (ctx.crossSiteFrame) return 'SameSite=None; Secure';
  return ctx.https ? 'SameSite=Lax; Secure' : 'SameSite=Lax';
}

/** La page est-elle ouverte dans un cadre d'un autre site ? (accès refusé = autre site) */
export function inCrossSiteFrame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.top !== window.self && window.top?.location.origin !== window.location.origin;
  } catch {
    return true;
  }
}

const cookieAttrs = () =>
  sessionCookieAttrs({
    crossSiteFrame: inCrossSiteFrame(),
    https: typeof location !== 'undefined' && location.protocol === 'https:',
  });
```

Then use `cookieAttrs()` in `canUseCookies` (both test-cookie lines) and in `setCookie` (in place of the literal `SameSite=None; Secure`). Leave `deleteCookie` unchanged (it already clears both the `Lax` and the `None` variants, so existing `None` session cookies get removed on sign-out).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/supabase-cookie-attrs.spec.ts tests/lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/client.ts tests/lib/supabase-cookie-attrs.spec.ts
git commit -m "fix(securite): cookies de session SameSite=Lax hors cadre d'un autre site (plan 2.11)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ"
```

---

## Après les tâches (contrôleur)

1. Appliquer `20261009090000_app_errors.sql` par le connecteur Supabase (`apply_migration`), renommer le fichier à la version enregistrée.
2. `PLAN-100.md` (1.1 alertes, 1.8, 2.2, 2.9, 2.11 cookies) et `ETAT.md` ; ajouter la purge d'`app_errors` à 30 jours à la liste de Tony.
3. PR, CI verte, revue Codex traitée, fusion, preuve en production : `select public.ops_daily_report()` (colonnes `app_errors`, `alerts`), cookie `sb-…` en `SameSite=Lax` après « Essayer sans compte », une erreur provoquée visible dans `app_errors` sans donnée personnelle.
