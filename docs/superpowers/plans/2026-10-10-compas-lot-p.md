# Compas lot P — le contexte voyageur (PLAN-100 §4.1, domicile §4.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Compas knows who travels when the person tells it — nationality, country of residence, currency, language, time zone and home town, in a private profile asked once (« Passer » always visible) and editable in `/compte/voyageur` — uses the home as the trip's departure after a said origin and before the device position, and, without a known nationality, never asserts anything that depends on it (no « voyageur français » papers, formalities, plugs or AI rule).

**Architecture:** A new private table `public.user_traveller` (RLS of the person alone, no grant to `anon`, trial sessions refused, home rounded to 0,01° by its column type) is read and written only by `server/traveller.ts` (`server-only`, the person's own Supabase client). A pure `engine/traveller.ts` (`TravellerContext`, every field `null` = unknown; validators and form lists from `Intl`) is the only shape engines receive: `autofillActions.ts` reads the context once, beside `readProfile`, and passes it to `travelOrigin` (home), `travelPapers` / `abroadCosts` (nationality, residence, currency) and `buildCompasAutofillSystem` (one derived fact: French nationality yes/no). The person writes the profile through server actions (`server/travellerActions.ts`: zod, session, trial refused, home geocoded once through the existing place search moved to `server/placeSearch.ts`, `compas-destination` limit, `isHomePlace`, `coarsePosition`) from one card (`src/components/identity/TravellerCard.tsx`) mounted in the empty Compas and on `/compte/voyageur`. A file-walk lock (`scripts/verify/traveller_privacy.mjs`) breaks `prebuild`, CI Gate 0 and `npm test` if the table, the reader, the actions or the card leak anywhere else.

**Tech Stack:** Next.js 15 App Router (server components, server actions), React 19, TypeScript strict, zod 4, Vitest 4 (+ Testing Library, jsdom), Supabase Postgres (RLS, PostgREST), Node 22 (`Intl`).

**Spec:** `docs/compas/PLAN-100.md` §4.1 (two boxes) + §4.3 box 1 (« domicile du profil ») + `.superpowers/sdd/2026-10-10-compas-lot-p/scope.md`

## Global Constraints

- Stack: Next.js 15 App Router, React 19, TypeScript strict, Vitest; French UI texts, tutoiement; never `#E4501C`; colours only via `--lkv-*` tokens (`src/styles/tokens.css`); mobile views use inline styles (no Tailwind).
- Tests: Vitest has a network guard (`tests/setup/networkGuard.ts`): mock at the seam, no public network.
- Never store/echo/commit secrets; no model identifiers in commits/PRs/code comments beyond the commit trailers.
- Supabase project `icxyvwzfjbflcbqukpfz` only (never `lwrmuggefbmboikjgudc`); RLS mandatory; destructive SQL is Tony's, additive migrations are ours.
- Push only to `claude/optimistic-albattani-i06ge7`; no PR created by implementers (the controller opens it).
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ`.
- Verify before DONE: `npx vitest run src/features/compas src/lib/ai`, `npx tsc --noEmit -p .`, `npx eslint <touched files>`.
- No new npm dependency. Every server action input validated with zod.
- The literal `user_traveller` appears in `src/` ONLY in `src/features/compas/server/traveller.ts` and `src/server/gdprExport.ts` (tests excepted) — not even in a comment elsewhere. Task 3's lock fails the build otherwise.
- Nationality, residence and home never go to a log (`console.*`), `app_errors`, the AI prompt, `trips.metadata`, `trip_expenses` or any shared/public screen. The AI receives at most « nationalité française : oui/non », as the wording of rule 8a, never a code or a place.
- The migration is applied to production by the controller only, after review, with the Supabase MCP `apply_migration` (never `supabase db push`: `20261009100000_app_errors_purge.sql` is in the repo but not in production, and must not be dragged in). Implementers only run the rolled-back probe (Task 1).
- Exact texts (copy them verbatim):
  - generic papers line: `Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`
  - plug fact line: `Prises de type ${plug} (${where}) : vérifie que tes chargeurs s’y branchent.`
  - home note: `Trajet chiffré depuis ton domicile (ton profil voyageur) : écris « depuis Lyon » dans ta demande pour partir d’ailleurs.`
  - home departure on screen: `ton domicile` (line « … (depuis ton domicile) »); AI fact: `domicile de la personne (ville non transmise)`
  - card titles: `Pour des conseils justes` (asked once), `Ce que le Compas sait de toi` (`/compte/voyageur`), page title `Profil voyageur`
  - action errors: `Profil invalide`, `Connecte-toi pour enregistrer ton profil voyageur.`, `Crée ton compte pour enregistrer ton profil voyageur.`, `« X » introuvable sur la carte.`, `« X » n’est pas une ville ou un village : écris ta commune (« Lyon »).`, `Impossible d’enregistrer ton profil voyageur.`, `Erreur serveur`
  - settings toast: `Réglages enregistrés sur cet appareil.`
- Tests: `npx vitest run <path>`; never skip or disable a test. Updating an existing assertion to a new, intended contract is allowed only where a step says so explicitly.
- Commit messages in French, conventional prefix (`feat(compas): …`, `fix(compte): …`, `test(compas): …`, `docs(compas): …`), each ending with the two trailer lines above.
- Out of scope, do not touch: the passport × destination table (lot Q), budget in destination or traveller currency and any default of `trips.budget_currency` (lot R), UI translation (phase 6), imperial units (§6.3), `getCompasData.ts`, `compasInterpretAction`, the anchor fallback when no destination is said (`autofillActions.ts`, blocks `if (!anchor && saidOrigin)` and `if (!anchor && from)`), `ProjectBasis` / `tripBasis`, the country page `/api/pays/[code]`.

## Notes on the scope

Facts checked against the code at HEAD `3b96d58` and against production in SELECT only (10 Oct.). Where `scope.md` and the code disagree, the code wins and the choice is listed in « Rulings needed » at the end.

1. **Account settings (decision 6): nothing server-side exists.** `src/components/compte/ParametresCompteCard.tsx` keeps language, units, currency, time zone and first day of week only in `localStorage['user_account_settings_v1']`, never read anywhere in `src/`, and its button toasts « Tous vos réglages ont été enregistrés et sauvegardés en base ! ». `user_profiles` has no such column (production columns listed); `notification_prefs` is read by no file of `src/`. So this lot reads only what it stores. Task 5 removes the two local fields the profile now owns (currency, time zone), links them to `/compte/voyageur` and makes the toast true (`Réglages enregistrés sur cet appareil.`). Language of the interface, units and first day stay local (phase 6, §6.3).
2. **« Asked once » has no existing mount.** `OrientationCard`'s `collect` mode is mounted nowhere (only `mode="edit"` in `ParametresCompteCard`), its « Passer » does nothing without `onPasser`, and mobile `/compte` (`MobileCompteV2`) has no access to settings at all. This lot: one card with a `collect` mode, shown in the empty Compas (`CompasStart`, after the request card) to a signed-in, non-trial person who has no row; « Passer » stores an empty row (row exists = asked, no extra column). `/compte/voyageur` is a new page for desktop and phone, linked from the desktop settings (Profil section) and from the mobile sheet « Paramètres & Navigation ».
3. **Writing goes through server actions**, not the browser upsert of `OrientationCard`: geocoding, rounding and the limit need the server. `resolveDestination` and `placeSearchLimitError` are private to the `'use server'` file `compasActions.ts` (which may only export async actions): Task 4 moves the name → place chain and the limit to `server/placeSearch.ts` (plain server module), with unchanged behaviour for the destination and the said origin (their tests stay green).
4. **RLS.** Four own policies as on `user_orientation`, written `user_id = (select auth.uid())` (same rows, evaluated once per statement — the form recent migrations use, and what the Supabase advisor asks), plus one RESTRICTIVE insert policy `NOT public.is_anonymous_session()`: trial sessions run as `authenticated`, and the scope wants them « tout inconnu ». `numeric(4,2)` / `numeric(5,2)` make the database itself round a home written straight through PostgREST. `GRANT … TO authenticated` + `REVOKE ALL … FROM anon` (without the REVOKE a new `public` table inherits Supabase's default grants — production shows `user_orientation` with no anon grant only because of it).
5. **RLS proof.** Vitest cannot prove RLS (the fakes apply none). Task 1 ships `scripts/verify/user_traveller_rls_probe.sql`: ONE `DO` statement that always ends with an exception, so everything it writes is rolled back on success and on failure; the error message IS the result (« 16 contrôles passés »). Before application it is sent by MCP `execute_sql` inside ONE enclosing `DO` block that first executes the migration text, so nothing can be committed whatever the tool's transaction handling; after application (by the controller) it is sent alone. While writing this plan both modes were replayed on a local PostgreSQL 16 with Supabase-like roles (`anon`, `authenticated`, `auth.uid()`, `auth.jwt()`, default grants): « 16 contrôles passés (tout est annulé) » and the table absent afterwards; migration replayable twice, then the probe alone, same result; « ÉCHEC 2 — droit accordé à anon » when the `REVOKE` is removed.
6. **The home name never lands on the trip (decision 3 vs decision 7).** Notes, `autofill_result.summary.transport.departure/basis`, `trip_expenses.metadata.basis` and `autofill.basis` are stored on the trip, read by every collaborator and, for a public/unlisted trip, by anyone (`can_read_trip`). So the persisted departure is `ton domicile`, the line reads « … (depuis ton domicile) », and the one note is the home note above. The AI gets `Départ de la personne : domicile de la personne (ville non transmise).` next to the already derived `Voyage à l’étranger : oui|non|inconnu.` The home is not put in `ProjectBasis` (it would depend on the reader and leak `name@lat,lon`). Ruling 1.
7. **The home is the travel-leg origin only** (« 5. Venir »), never the anchor of a trip without a destination: the anchor's name goes to the AI facts and to the shared base-itinerary prompt, and preparing a trip around someone's home without asking is a guess. Ruling 2.
8. **`getCompasData` is not wired.** Nothing on the Compas screen depends on the traveller in this lot (papers, formalities and the AI only run in `autofillActions.ts`), and `CompasData` is serialised to the browser. The empty Compas page reads `asked` itself (`readTravellerState`). `compasInterpretAction` keeps `travellerToday(timeZone)`: the screen always sends the browser zone there.
9. **Currency (decision 5)** is stored, shown, and used only to keep a right AI money tip (`keepAiNote`). Trip creation keeps `budget_currency: 'EUR'`: the budget engine sums euro amounts without converting (`compasModel.ts` only labels them with `trip.budgetCurrency`), so a USD default would show euros as dollars. Ruling 3.
10. **Nationality audit (decision 4)** — every place found (the code wins over the scope's list):

| Place | Before | After: unknown / other nationality / French |
|---|---|---|
| `src/lib/ai/features/compasAutofill.ts` rule 8a | « VRAI pour une personne qui part de France » (always) | neutral rule / neutral rule / « de nationalite francaise » (never « part de France » again: the departure is no longer France by default) |
| same, rule 8b | destination rule, example « en France » | unchanged (no claim about the person; « visa » is already silenced by 8a) |
| same, base-itinerary rule 11 (shared cache key) | « pour un voyageur francais, souvent le versant francais » | removed for everyone (one new cache key for base itineraries, once) |
| `engine/papers.ts` papers | French ID-card list, passport + visa, France Diplomatie (always) | generic line, or nothing for one's own country or a departure already in the country / same / unchanged |
| `engine/papers.ts` plugs | « adaptateur à prévoir » relative to French plugs (always) | residence in France (or French nationality without a residence): unchanged; otherwise the plug fact line |
| `keepAiNote` | drops euro-zone money tips and plug tips whenever French plugs are known | money tip kept when the known currency is not EUR; plug tip kept when the rule does not know; papers always to the rule |
| `engine/costs.ts` `entryFees` + `engine/travel.ts` `abroadCosts` + budget line « Formalités » | « voyageur français » barème whenever `abroad !== false` | only for a known French nationality (the `abroad !== false` gate is kept); basis says « ressortissant français » |
| `engine/advice.ts` (112, BERA / Météo-France), `offline/snapshot.ts`, official alerts | by destination | unchanged (no nationality claim) |
| `engine/costs.ts` « prix français » price index, fuel price, `fr-FR` formats, geocoder language | a reference basis or a format | unchanged (lot R, phase 6) |
| `/api/pays/[code]` (`nationalite = 'France'`), `features/trips/.../tripBriefExtractor.ts` (`homeAirports ['PAR']`) | outside the Compas | unchanged, to flag for lot Q |

  Visible effect without a profile (every account today, every trial): Nepal loses the « Formalités » line (−45 € per person) and shows the generic papers line; Portugal shows the generic line instead of « carte d’identité … sans visa »; with « depuis Lyon », a profile home in France or a shared position in France, a trip in France shows no papers line (no border crossed).
11. **GDPR.** `user_traveller` holds personal data: added to `GDPR_USER_TABLES` (`src/server/gdprExport.ts`, used by the export and by the post-deletion count in `gdprDelete.ts`), with TEST-A14-GDPR-EXPORT-01 updated in the same task. Deletion: `ON DELETE CASCADE` from `auth.users`.
12. **The lock (decision 7).** `scripts/verify/identity_compliance.mjs` runs only in CI Gate 0 (via `ci_invariants.mjs`), not in `npm run build`, and its `rg` rule passes silently when `rg` is missing. The new lock is a Node file walk (no `rg`), run by `prebuild` (so `npm run build` and the Vercel build break), by `identity_compliance.mjs` (Gate 0) and by a Vitest spec under `src/features/compas/__tests__` (Gate 3 and the lot command).
13. **Whole plan checked.** All seven tasks were applied, in order, to a scratch copy of HEAD `3b96d58`: `npx vitest run src/features/compas src/lib/ai` (94 files, 2 199 tests), `tests/security/a14-gdpr-account.spec.ts`, `npx tsc --noEmit -p .`, `eslint` on every touched file (no new warning), `node scripts/verify/traveller_privacy.mjs` and `node scripts/verify/identity_compliance.mjs` — all green. The full `npx vitest run` fails only on the 8 Playwright specs that need a Chromium binary, exactly as on the untouched repository.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20261010100000_user_traveller.sql` (new) | Private table, RLS, trial refusal, grants | 1 |
| `scripts/verify/user_traveller_rls_probe.sql` (new) | Rolled-back RLS probe for the MCP | 1 |
| `src/features/compas/__tests__/travellerMigration.test.ts` (new) | Migration text guard | 1 |
| `src/server/gdprExport.ts`, `tests/security/a14-gdpr-account.spec.ts` | GDPR export list | 1 |
| `src/features/compas/engine/traveller.ts` (new) | `TravellerContext`, row reader, validators, form lists | 2 |
| `src/features/compas/engine/intentWords.ts` | export `isoCurrencyCodes` / `knownIsoCode` | 2 |
| `src/features/compas/engine/zone.ts` | `travellerToday(timeZone, now, profileZone)` | 2 |
| `src/features/compas/server/traveller.ts` (new) | The only reader/writer of the table | 2 |
| `src/features/compas/__tests__/traveller.test.ts`, `travellerReader.test.ts` (new) | Pure + reader tests | 2 |
| `scripts/verify/traveller_privacy.mjs` (new) | Privacy lock (file walk) | 3 |
| `scripts/verify/identity_compliance.mjs`, `package.json` | Lock in Gate 0 and `prebuild` | 3 |
| `src/features/compas/__tests__/travellerPrivacy.test.ts` (new) | Lock spec + leak fixtures | 3 |
| `src/features/compas/server/placeSearch.ts` (new) | Name → place chain + `compas-destination` limit | 4 |
| `src/features/compas/server/compasActions.ts` | uses `placeSearch.ts` | 4 |
| `src/features/compas/engine/places.ts` | `isHomePlace` | 4 |
| `src/features/compas/server/travellerActions.ts` (new) | `saveTravellerAction`, `skipTravellerAction` | 4 |
| `src/features/compas/__tests__/travellerActions.test.ts` (new) | Action tests | 4 |
| `src/components/identity/TravellerCard.tsx` (new) | The card (collect / edit) | 5 |
| `src/app/compte/voyageur/page.tsx` (new) | Profile page (desktop + phone) | 5 |
| `src/app/compas/page.tsx`, `src/features/compas/components/CompasStart.tsx` | Asked once in the empty Compas | 5 |
| `src/components/compte/ParametresCompteCard.tsx`, `src/components/compte/MobileCompteV2.tsx` | Links, no duplicate local fields, true toast | 5 |
| `src/features/compas/__tests__/travellerCard.test.tsx` (new) | Card tests | 5 |
| `src/features/compas/engine/travel.ts` | Home origin (`source: 'domicile'`), texts | 6, 7 |
| `src/features/compas/server/autofillActions.ts` | Reads the context; home; papers; formalities; AI rule | 6, 7 |
| `src/features/compas/__tests__/travelHome.test.ts` (new) | Home origin tests | 6 |
| `src/features/compas/engine/papers.ts` | Papers, plugs, money by traveller | 7 |
| `src/features/compas/engine/costs.ts` | Barème named « ressortissant français » | 7 |
| `src/lib/ai/features/compasAutofill.ts` | Rule 8a by nationality, rule 11 neutral | 7 |
| `src/features/compas/__tests__/papers.test.ts`, `travel.test.ts`, `nationalityPrompt.test.ts` (new) | Audit tests | 7 |
| `docs/compas/PLAN-100.md`, `docs/compas/ETAT.md` | Boxes, lot P line, lot N production proof | 7 |

---

### Task 1: La table privée `user_traveller` (migration, sonde RLS, export RGPD)

**Files:**
- Create: `supabase/migrations/20261010100000_user_traveller.sql`
- Create: `scripts/verify/user_traveller_rls_probe.sql`
- Create: `src/features/compas/__tests__/travellerMigration.test.ts`
- Modify: `src/server/gdprExport.ts` (end of `GDPR_USER_TABLES`)
- Modify: `tests/security/a14-gdpr-account.spec.ts` (TEST-A14-GDPR-EXPORT-01 list)

**Interfaces:**
- Consumes: `public.is_anonymous_session()` (migration `20261008165901_anonymous_trial_sessions.sql`, recorded in production).
- Produces: table `public.user_traveller` with columns `user_id uuid PK → auth.users ON DELETE CASCADE`, `nationality text`, `residence_country text`, `currency text`, `language text`, `time_zone text`, `home_name text`, `home_lat numeric(4,2)`, `home_lon numeric(5,2)`, `home_country text`, `updated_at timestamptz NOT NULL DEFAULT now()`; policies `traveller_select_own`, `traveller_insert_own`, `traveller_update_own`, `traveller_delete_own`, `traveller_essai_sans_ecriture` (restrictive insert). `GDPR_USER_TABLES` gains `{ table: 'user_traveller', userColumn: 'user_id' }`.

- [ ] **Step 1: Write the failing migration test**

Create `src/features/compas/__tests__/travellerMigration.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le profil voyageur est privé par la base elle-même : RLS de la personne seule,
 * aucun droit pour anon, aucun essai sans compte, domicile arrondi par le type.
 * La preuve en base est la sonde `scripts/verify/user_traveller_rls_probe.sql`.
 */
const SQL = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010100000_user_traveller.sql'), 'utf8');
/** Le SQL sans ses commentaires : un mot dans un commentaire ne prouve rien. */
const code = SQL.replace(/--.*$/gm, '');
const policy = (name: string) => code.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;`))?.[0] ?? '';

describe('migration user_traveller : privée, additive, rejouable', () => {
  it('une ligne par personne, effacée avec le compte', () => {
    expect(code).toContain('CREATE TABLE IF NOT EXISTS public.user_traveller (');
    expect(code).toMatch(/user_id\s+uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  });

  it('formats contrôlés par la base, domicile arrondi à 0,01° par son type', () => {
    expect(code).toMatch(/nationality\s+text CHECK \(nationality ~ '\^\[A-Z\]\{2\}\$'\)/);
    expect(code).toMatch(/residence_country\s+text CHECK \(residence_country ~ '\^\[A-Z\]\{2\}\$'\)/);
    expect(code).toMatch(/currency\s+text CHECK \(currency ~ '\^\[A-Z\]\{3\}\$'\)/);
    expect(code).toMatch(/home_lat\s+numeric\(4,2\) CHECK \(home_lat BETWEEN -90 AND 90\)/);
    expect(code).toMatch(/home_lon\s+numeric\(5,2\) CHECK \(home_lon BETWEEN -180 AND 180\)/);
    expect(code).toContain('CONSTRAINT user_traveller_home_complete CHECK');
  });

  it('RLS : la personne seule, pour les quatre gestes, chaque policy rejouable', () => {
    expect(code).toContain('ALTER TABLE public.user_traveller ENABLE ROW LEVEL SECURITY;');
    for (const op of ['select', 'insert', 'update', 'delete']) {
      const p = policy(`traveller_${op}_own`);
      expect(p, op).toContain(`FOR ${op.toUpperCase()}`);
      expect(p, op).toContain('TO authenticated');
      expect(p, op).toContain('user_id = (select auth.uid())');
      expect(code).toContain(`DROP POLICY IF EXISTS "traveller_${op}_own" ON public.user_traveller;`);
    }
  });

  it('essai sans compte (session anonyme) : aucune écriture', () => {
    expect(policy('traveller_essai_sans_ecriture')).toMatch(
      /AS RESTRICTIVE\s+FOR INSERT\s+TO authenticated\s+WITH CHECK \(NOT public\.is_anonymous_session\(\)\)/
    );
    expect(code).toContain('DROP POLICY IF EXISTS "traveller_essai_sans_ecriture" ON public.user_traveller;');
  });

  it('aucune policy ni aucun droit pour anon ou public', () => {
    expect(code).not.toMatch(/\bTO\s+(anon|public)\b/i);
    expect(code).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_traveller TO authenticated;');
    expect(code).toContain('REVOKE ALL ON public.user_traveller FROM anon;');
    expect(code.match(/CREATE POLICY/g)).toHaveLength(5);
  });

  it('additive : rien de détruit, rien d’ajouté au profil public', () => {
    expect(code).not.toMatch(/\b(DROP TABLE|TRUNCATE|DELETE FROM|DROP COLUMN)\b/i);
    expect(code).not.toMatch(/user_profiles|public_profiles/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/compas/__tests__/travellerMigration.test.ts`
Expected: FAIL — `ENOENT: no such file or directory … 20261010100000_user_traveller.sql`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261010100000_user_traveller.sql`:

```sql
-- ============================================================================
-- Compas, lot P (PLAN-100 4.1) — user_traveller : PROFIL VOYAGEUR PRIVÉ.
-- ----------------------------------------------------------------------------
--  Nationalité, pays de résidence, devise, langue, fuseau, domicile (ville).
--  Facultatif de bout en bout : chaque champ peut rester NULL (= inconnu ; le
--  Compas n'affirme alors rien qui en dépende). Une ligne toute vide veut dire
--  « Passer » : la question n'est plus reposée.
--  RLS STRICTE, patron de user_orientation (ADR-010) : lecture ET écriture par
--  la personne seule ; AUCUNE policy publique ; aucun droit pour anon. Un essai
--  sans compte (session anonyme, rôle authenticated) n'écrit rien :
--  public.is_anonymous_session() (migration 20261008165901).
--  Domicile rangé à 0,01° près (~1 km) : numeric(4,2) / numeric(5,2), la base
--  arrondit elle-même ce qu'on lui donne, même écrit sans passer par l'application.
--  Additive et rejouable : IF NOT EXISTS, DROP POLICY IF EXISTS ; aucune donnée
--  existante n'est touchée. Application en production : par le contrôleur, après
--  revue (MCP apply_migration), sonde : scripts/verify/user_traveller_rls_probe.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_traveller (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nationality       text CHECK (nationality ~ '^[A-Z]{2}$'),
  residence_country text CHECK (residence_country ~ '^[A-Z]{2}$'),
  currency          text CHECK (currency ~ '^[A-Z]{3}$'),
  language          text CHECK (char_length(language) <= 35 AND language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  time_zone         text CHECK (char_length(time_zone) <= 64 AND time_zone ~ '^[A-Za-z][A-Za-z0-9_+/-]*$'),
  home_name         text CHECK (char_length(btrim(home_name)) BETWEEN 1 AND 80),
  home_lat          numeric(4,2) CHECK (home_lat BETWEEN -90 AND 90),
  home_lon          numeric(5,2) CHECK (home_lon BETWEEN -180 AND 180),
  home_country      text CHECK (home_country ~ '^[A-Z]{2}$'),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_traveller_home_complete CHECK (
    (home_name IS NULL AND home_lat IS NULL AND home_lon IS NULL AND home_country IS NULL)
    OR (home_name IS NOT NULL AND home_lat IS NOT NULL AND home_lon IS NOT NULL)
  )
);

COMMENT ON TABLE public.user_traveller IS
  'Profil voyageur privé (PLAN-100 4.1) : lu et écrit par la personne seule (RLS), jamais public.';

ALTER TABLE public.user_traveller ENABLE ROW LEVEL SECURITY;

-- Lecture : soi-même uniquement.
DROP POLICY IF EXISTS "traveller_select_own" ON public.user_traveller;
CREATE POLICY "traveller_select_own"
  ON public.user_traveller
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Écriture (insert/update) : soi-même uniquement.
DROP POLICY IF EXISTS "traveller_insert_own" ON public.user_traveller;
CREATE POLICY "traveller_insert_own"
  ON public.user_traveller
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "traveller_update_own" ON public.user_traveller;
CREATE POLICY "traveller_update_own"
  ON public.user_traveller
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Effacer son profil : soi-même uniquement (la ligne suit aussi auth.users en cascade).
DROP POLICY IF EXISTS "traveller_delete_own" ON public.user_traveller;
CREATE POLICY "traveller_delete_own"
  ON public.user_traveller
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Essai sans compte : jamais de profil voyageur (tout reste inconnu).
DROP POLICY IF EXISTS "traveller_essai_sans_ecriture" ON public.user_traveller;
CREATE POLICY "traveller_essai_sans_ecriture"
  ON public.user_traveller
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_anonymous_session());

-- Data API : la personne connectée seule (RLS ci-dessus = garde de lignes,
-- GRANT = accès à la table). Aucun accès anon : sans ce REVOKE, une table
-- nouvelle de public hérite des droits par défaut de Supabase.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_traveller TO authenticated;
REVOKE ALL ON public.user_traveller FROM anon;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/compas/__tests__/travellerMigration.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: The GDPR export lists the table (failing first)**

In `tests/security/a14-gdpr-account.spec.ts`, TEST-A14-GDPR-EXPORT-01 (explicitly allowed change: a new personal-data table joins the locked list), replace:

```ts
      'user_territory_private',
    ]);
```

with:

```ts
      'user_territory_private',
      'user_traveller',
    ]);
```

Run: `npx vitest run tests/security/a14-gdpr-account.spec.ts`
Expected: FAIL in TEST-A14-GDPR-EXPORT-01 (`'user_traveller'` missing from the received list).

- [ ] **Step 6: Add the table to `GDPR_USER_TABLES`**

In `src/server/gdprExport.ts`, replace:

```ts
  { table: 'user_territory_private', userColumn: 'user_id' },
] as const;
```

with:

```ts
  { table: 'user_territory_private', userColumn: 'user_id' },
  // Profil voyageur du Compas (migration 20261010100000, PLAN-100 4.1) : nationalité,
  // résidence, domicile arrondi — données de la personne, rendues à elle seule.
  { table: 'user_traveller', userColumn: 'user_id' },
] as const;
```

Run: `npx vitest run tests/security/a14-gdpr-account.spec.ts`
Expected: PASS (10 tests).

- [ ] **Step 7: Write the RLS probe**

Create `scripts/verify/user_traveller_rls_probe.sql`:

```sql
-- Sonde RLS de public.user_traveller (Compas, lot P, PLAN-100 4.1).
--
-- UNE seule instruction (bloc DO) qui finit TOUJOURS par une exception : tout ce
-- qu'elle a écrit est annulé, en cas de succès comme d'échec. Le message rendu
-- EST le résultat :
--   « SONDE user_traveller : 16 contrôles passés (tout est annulé) » → conforme ;
--   « SONDE user_traveller : ÉCHEC n — … »                          → non conforme.
-- À lancer par le MCP Supabase (execute_sql), projet icxyvwzfjbflcbqukpfz SEULEMENT :
--   - avant application : UNE instruction, un DO englobant qui exécute la migration
--     puis ce bloc (construit par la commande du plan du lot P, tâche 1 ; ce fichier ne
--     doit donc contenir aucune balise dollar autre que celle du bloc) : l'exception
--     finale annule tout, quel que soit le mode de transaction de l'outil ; ensuite
--     `select to_regclass('public.user_traveller');` doit rendre null ;
--   - après application (par le contrôleur) : ce bloc seul.
-- Deux comptes réels (non anonymes) prêtent leur identifiant aux jetons simulés ;
-- rien d'autre n'est lu, et rien n'est gardé.
do $sonde$
declare
  a uuid;
  b uuid;
  c uuid := gen_random_uuid();
  n integer;
  lat numeric;
  passed integer := 0;
begin
  select id into a from auth.users where coalesce(is_anonymous, false) = false order by created_at limit 1;
  select id into b from auth.users where coalesce(is_anonymous, false) = false and id <> a order by created_at limit 1;
  if a is null or b is null then
    raise exception 'SONDE user_traveller : ÉCHEC 0 — deux comptes réels nécessaires';
  end if;

  -- 1. RLS activée.
  if not coalesce((select relrowsecurity from pg_class where oid = 'public.user_traveller'::regclass), false) then
    raise exception 'SONDE user_traveller : ÉCHEC 1 — RLS désactivée';
  end if;
  passed := passed + 1;

  -- 2. Aucun droit pour anon.
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'user_traveller' and grantee = 'anon'
  ) then
    raise exception 'SONDE user_traveller : ÉCHEC 2 — droit accordé à anon';
  end if;
  passed := passed + 1;

  -- 3. Cinq policies, toutes réservées à authenticated (aucune publique).
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'user_traveller';
  if n <> 5 or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_traveller' and roles <> array['authenticated']::name[]
  ) then
    raise exception 'SONDE user_traveller : ÉCHEC 3 — % policies, ou une policy hors authenticated', n;
  end if;
  passed := passed + 1;

  -- 4-5. anon : ni lecture, ni écriture.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform 1 from public.user_traveller;
    raise exception 'SONDE user_traveller : ÉCHEC 4 — anon lit la table';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;
  begin
    insert into public.user_traveller (user_id, nationality) values (a, 'FR');
    raise exception 'SONDE user_traveller : ÉCHEC 5 — anon écrit dans la table';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;
  execute 'reset role';

  -- 6. A écrit sa ligne ; la base arrondit le domicile à 0,01°.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.user_traveller
    (user_id, nationality, residence_country, currency, language, time_zone, home_name, home_lat, home_lon, home_country)
  values (a, 'FR', 'FR', 'EUR', 'fr', 'Europe/Paris', 'Lyon', 45.7578, 4.8320, 'FR')
  on conflict (user_id) do update set
    nationality = excluded.nationality, residence_country = excluded.residence_country,
    currency = excluded.currency, language = excluded.language, time_zone = excluded.time_zone,
    home_name = excluded.home_name, home_lat = excluded.home_lat, home_lon = excluded.home_lon,
    home_country = excluded.home_country;
  select home_lat into lat from public.user_traveller where user_id = a;
  if lat is distinct from 45.76 then
    raise exception 'SONDE user_traveller : ÉCHEC 6 — domicile non arrondi (%)', lat;
  end if;
  passed := passed + 1;

  -- 7. A n'écrit pas la ligne de B.
  begin
    insert into public.user_traveller (user_id, nationality) values (b, 'DE');
    raise exception 'SONDE user_traveller : ÉCHEC 7 — A écrit la ligne de B';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;

  -- 8-11. Formats refusés par la base.
  begin
    update public.user_traveller set nationality = 'fra' where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 8 — nationalité « fra » acceptée';
  exception when check_violation then
    passed := passed + 1;
  end;
  begin
    update public.user_traveller set currency = 'eur' where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 9 — devise « eur » acceptée';
  exception when check_violation then
    passed := passed + 1;
  end;
  begin
    update public.user_traveller set home_lat = 91 where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 10 — latitude 91 acceptée';
  exception when check_violation then
    passed := passed + 1;
  end;
  begin
    update public.user_traveller set home_name = null where user_id = a;
    raise exception 'SONDE user_traveller : ÉCHEC 11 — domicile sans nom accepté';
  exception when check_violation then
    passed := passed + 1;
  end;

  -- 12-14. B ne voit, ne change ni n'efface la ligne de A.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.user_traveller where user_id = a;
  if n <> 0 then
    raise exception 'SONDE user_traveller : ÉCHEC 12 — B voit la ligne de A';
  end if;
  passed := passed + 1;
  update public.user_traveller set nationality = 'DE' where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'SONDE user_traveller : ÉCHEC 13 — B modifie la ligne de A';
  end if;
  passed := passed + 1;
  delete from public.user_traveller where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'SONDE user_traveller : ÉCHEC 14 — B efface la ligne de A';
  end if;
  passed := passed + 1;

  -- 15. Essai sans compte (jeton anonyme) : aucune écriture, même sur sa propre ligne.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    insert into public.user_traveller (user_id, nationality) values (c, 'DE');
    raise exception 'SONDE user_traveller : ÉCHEC 15 — un essai sans compte écrit un profil';
  exception when insufficient_privilege then
    passed := passed + 1;
  end;

  -- 16. A efface sa propre ligne.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.user_traveller where user_id = a;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'SONDE user_traveller : ÉCHEC 16 — A n’efface pas sa ligne';
  end if;
  passed := passed + 1;
  execute 'reset role';

  raise exception 'SONDE user_traveller : % contrôles passés (tout est annulé)', passed;
end
$sonde$;
```

- [ ] **Step 8: Prove the RLS (rolled back, nothing applied)**

Build ONE statement that creates the table and runs the probe inside an enclosing `DO` block (the probe's final exception then rolls everything back, whatever the tool's transaction mode — even if it ran statements one by one, there is only one). `$SCRATCH` is your scratchpad directory:

```bash
node -e "const fs=require('fs');process.stdout.write('do \$avant\$\nbegin\n  execute \$migration\$\n'+fs.readFileSync('supabase/migrations/20261010100000_user_traveller.sql','utf8')+'\n\$migration\$;\n  execute \$probe\$\n'+fs.readFileSync('scripts/verify/user_traveller_rls_probe.sql','utf8')+'\n\$probe\$;\nend\n\$avant\$;\n')" > "$SCRATCH/user_traveller_probe_before.sql"
head -3 "$SCRATCH/user_traveller_probe_before.sql"
```

Expected: `do $avant$`, `begin`, `  execute $migration$`. (Neither file may contain another dollar tag than the probe's `$sonde$`: the probe header says so.)

If the Supabase MCP is available to you, call `execute_sql` on project `icxyvwzfjbflcbqukpfz` ONCE with the full content of `$SCRATCH/user_traveller_probe_before.sql` as the query.
Expected: the call returns an ERROR whose message is exactly `SONDE user_traveller : 16 contrôles passés (tout est annulé)`. A message containing `ÉCHEC` is a failure: stop and report it. A message `cannot execute … in a read-only transaction` means the MCP is read-only: use the local replay below.

Then call `execute_sql` with `select to_regclass('public.user_traveller') as t;`
Expected: one row, `t` = `null` (nothing was kept).

Never call `apply_migration` (the controller applies after review) and never `supabase db push`.

If the MCP is not available (or read-only), replay locally — no production involved: a throwaway PostgreSQL 16 owned by the `postgres` system user, with this scaffolding (Supabase-like roles, default grants and auth helpers, two real accounts and one trial account) saved as `$SCRATCH/supa.sql`:

```sql
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;
create schema auth;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false, created_at timestamptz not null default now());
grant usage on schema auth to anon, authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create or replace function public.is_anonymous_session() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
insert into auth.users (id, created_at) values ('00000000-0000-4000-8000-00000000000a', now() - interval '2 days'), ('00000000-0000-4000-8000-00000000000b', now() - interval '1 day');
insert into auth.users (id, is_anonymous) values ('00000000-0000-4000-8000-0000000000cc', true);
```

```bash
P=/var/lib/postgresql/lotp
su postgres -c "rm -rf $P && mkdir -p $P && /usr/lib/postgresql/16/bin/initdb -D $P/data -A trust -U postgres >/dev/null && /usr/lib/postgresql/16/bin/pg_ctl -D $P/data -o '-p 54331 -k $P' -l $P/log start"
psql -h $P -p 54331 -U postgres -q -f "$SCRATCH/supa.sql"
psql -h $P -p 54331 -U postgres -f "$SCRATCH/user_traveller_probe_before.sql" 2>&1 | grep ERROR
psql -h $P -p 54331 -U postgres -Atc "select coalesce(to_regclass('public.user_traveller')::text, 'absente')"
psql -h $P -p 54331 -U postgres -q -f supabase/migrations/20261010100000_user_traveller.sql
psql -h $P -p 54331 -U postgres -q -f supabase/migrations/20261010100000_user_traveller.sql
psql -h $P -p 54331 -U postgres -f scripts/verify/user_traveller_rls_probe.sql 2>&1 | grep ERROR
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $P/data stop" && su postgres -c "rm -rf $P"
```

Expected, in order: `… ERROR:  SONDE user_traveller : 16 contrôles passés (tout est annulé)`, then `absente`, then (migration applied twice locally: replayable, only `NOTICE … skipping` lines) the probe alone again `… ERROR:  SONDE user_traveller : 16 contrôles passés (tout est annulé)`. Say in your report which proof you ran; the production probe after application stays the controller's (see « After the lot »).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261010100000_user_traveller.sql scripts/verify/user_traveller_rls_probe.sql src/features/compas/__tests__/travellerMigration.test.ts src/server/gdprExport.ts tests/security/a14-gdpr-account.spec.ts
git commit -m "$(cat <<'MSG'
feat(compas): table privée user_traveller (profil voyageur, PLAN-100 4.1)

Nationalité, résidence, devise, langue, fuseau et domicile, tous facultatifs.
RLS de la personne seule (lecture, écriture, effacement), aucune policy publique,
aucun droit pour anon, essai sans compte refusé (policy restrictive), domicile
arrondi à 0,01° par le type de colonne. Sonde RLS annulée par construction
(scripts/verify/user_traveller_rls_probe.sql) ; table ajoutée à l'export RGPD.
Migration additive, à appliquer par le contrôleur après revue.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 2: Le contexte voyageur pur et son lecteur serveur

**Files:**
- Create: `src/features/compas/engine/traveller.ts`
- Create: `src/features/compas/server/traveller.ts`
- Modify: `src/features/compas/engine/intentWords.ts` (`knownIsoCode`, ~line 170)
- Modify: `src/features/compas/engine/zone.ts` (`travellerToday`, ~line 45)
- Create: `src/features/compas/__tests__/traveller.test.ts`
- Create: `src/features/compas/__tests__/travellerReader.test.ts`

**Interfaces:**
- Consumes (Task 1): table `public.user_traveller` and its nine data columns.
- Produces:
  - `engine/intentWords.ts`: `export function isoCurrencyCodes(): ReadonlySet<string>`, `export function knownIsoCode(code: string): boolean` (same behaviour as before, now exported).
  - `engine/zone.ts`: `travellerToday(timeZone: unknown, now = new Date(), profileZone: unknown = null): string` — browser zone, else profile zone, else `Europe/Paris`.
  - `engine/traveller.ts`: `interface TravellerHome { name: string; lat: number; lon: number; countryCode: string | null }`, `interface TravellerContext { nationality; residenceCountry; currency; language; timeZone: string | null; home: TravellerHome | null }`, `const UNKNOWN_TRAVELLER: TravellerContext`, `interface TravellerView { nationality; residenceCountry; currency; language; timeZone; homeName: string | null }`, `interface TravellerFields { nationality; residenceCountry; currency; language; timeZone; home: string | null }`, `interface TravellerOption { value: string; label: string }`, `isCountryCode(v: unknown): v is string`, `isCurrencyCode(v: unknown): v is string`, `languageTag(v: unknown): string | null`, `travellerFromRow(raw: unknown): TravellerContext`, `travellerView(t: TravellerContext): TravellerView`, `cleanTravellerFields(input: Partial<Record<keyof TravellerFields, string | null | undefined>>): TravellerFields | null`, `isFrenchNational(t: Pick<TravellerContext, 'nationality'>): boolean`, `countryOptions(): TravellerOption[]`, `currencyOptions(): TravellerOption[]`, `LANGUAGE_CODES`, `languageOptions(current: string | null): TravellerOption[]`, `timeZoneOptions(current: string | null): TravellerOption[]`.
  - `server/traveller.ts` (`server-only`): `interface TravellerState { asked: boolean; traveller: TravellerContext }`, `readTravellerState(supabase: { from: Supa['from'] } | Supa, userId: string | null): Promise<TravellerState>`, `readTraveller(supabase, userId): Promise<TravellerContext>`, `writeTraveller(supabase: Supa, userId: string, fields: Omit<TravellerFields, 'home'>, home: TravellerHome | null): Promise<boolean>`, `markTravellerAsked(supabase: Supa, userId: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing pure tests**

Create `src/features/compas/__tests__/traveller.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_TRAVELLER,
  cleanTravellerFields,
  countryOptions,
  currencyOptions,
  isCountryCode,
  isCurrencyCode,
  isFrenchNational,
  languageOptions,
  languageTag,
  timeZoneOptions,
  travellerFromRow,
  travellerView,
} from '../engine/traveller';
import { travellerToday } from '../engine/zone';

const ROW = {
  user_id: 'u1',
  nationality: 'FR',
  residence_country: 'FR',
  currency: 'EUR',
  language: 'fr',
  time_zone: 'Europe/Paris',
  home_name: 'Lyon',
  home_lat: 45.76,
  home_lon: 4.83,
  home_country: 'FR',
};

describe('contexte voyageur : tout inconnu par défaut, jamais deviné', () => {
  it('sans ligne : chaque champ vaut null', () => {
    expect(UNKNOWN_TRAVELLER).toEqual({
      nationality: null,
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: null,
    });
    expect(travellerFromRow(null)).toEqual(UNKNOWN_TRAVELLER);
    expect(travellerFromRow('FR')).toEqual(UNKNOWN_TRAVELLER);
    expect(travellerFromRow([ROW])).toEqual(UNKNOWN_TRAVELLER);
  });

  it('ligne complète lue telle quelle', () => {
    expect(travellerFromRow(ROW)).toEqual({
      nationality: 'FR',
      residenceCountry: 'FR',
      currency: 'EUR',
      language: 'fr',
      timeZone: 'Europe/Paris',
      home: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' },
    });
  });

  it('lecture défensive : un champ invalide vaut null', () => {
    expect(
      travellerFromRow({
        ...ROW,
        nationality: 'fra',
        residence_country: 'UK',
        currency: 'EURO',
        language: 'français',
        time_zone: 'Mars/Olympus',
        home_country: 'ZZ',
      })
    ).toEqual({
      nationality: null,
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: null },
    });
    // Un faux client qui rend une autre ligne (`{ metadata }`) : rien.
    expect(travellerFromRow({ metadata: {}, updated_at: 'x' })).toEqual(UNKNOWN_TRAVELLER);
  });

  it('domicile : nom et position obligatoires, position à 0,01° (texte numérique accepté)', () => {
    expect(travellerFromRow({ ...ROW, home_lat: '45.757', home_lon: '4.832' }).home).toEqual({
      name: 'Lyon',
      lat: 45.76,
      lon: 4.83,
      countryCode: 'FR',
    });
    expect(travellerFromRow({ ...ROW, home_lat: null }).home).toBeNull();
    expect(travellerFromRow({ ...ROW, home_lat: 91 }).home).toBeNull();
    expect(travellerFromRow({ ...ROW, home_lon: '' }).home).toBeNull();
    expect(travellerFromRow({ ...ROW, home_name: '  ' }).home).toBeNull();
  });

  it('ce que la personne voit d’elle-même : jamais de coordonnées', () => {
    expect(travellerView(travellerFromRow(ROW))).toEqual({
      nationality: 'FR',
      residenceCountry: 'FR',
      currency: 'EUR',
      language: 'fr',
      timeZone: 'Europe/Paris',
      homeName: 'Lyon',
    });
  });

  it('nationalité française connue, et seulement elle', () => {
    expect(isFrenchNational(travellerFromRow(ROW))).toBe(true);
    expect(isFrenchNational(UNKNOWN_TRAVELLER)).toBe(false);
    expect(isFrenchNational({ nationality: 'BE' })).toBe(false);
  });
});

describe('formats (Intl, aucune liste inventée)', () => {
  it('pays ISO 3166-1 alpha-2 en majuscules, Kosovo compris ; ni UK, ni EU, ni ZZ', () => {
    for (const cc of ['FR', 'GB', 'XK', 'RU', 'MC', 'HK']) expect(isCountryCode(cc), cc).toBe(true);
    for (const cc of ['UK', 'EU', 'ZZ', 'QO', 'fr', 'FRA', '', null, 12]) expect(isCountryCode(cc), String(cc)).toBe(false);
  });

  it('devise ISO 4217 connue', () => {
    for (const c of ['EUR', 'CHF', 'USD', 'JPY']) expect(isCurrencyCode(c), c).toBe(true);
    for (const c of ['eur', 'EURO', 'ZZZ', '', null]) expect(isCurrencyCode(c), String(c)).toBe(false);
  });

  it('langue BCP 47 canonique et connue', () => {
    expect(languageTag('fr')).toBe('fr');
    expect(languageTag('pt-br')).toBe('pt-BR');
    expect(languageTag('EN')).toBe('en');
    expect(languageTag('français')).toBeNull();
    expect(languageTag('zz')).toBeNull();
    expect(languageTag('x'.repeat(40))).toBeNull();
  });

  it('saisie nettoyée ; un seul champ invalide et rien n’est gardé', () => {
    expect(
      cleanTravellerFields({
        nationality: ' fr ',
        residenceCountry: '',
        currency: 'chf',
        language: 'pt-br',
        timeZone: 'europe/paris',
        home: '  Lyon ',
      })
    ).toEqual({ nationality: 'FR', residenceCountry: null, currency: 'CHF', language: 'pt-BR', timeZone: 'Europe/Paris', home: 'Lyon' });
    expect(cleanTravellerFields({})).toEqual({
      nationality: null,
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: null,
    });
    for (const bad of [
      { nationality: 'UK' },
      { residenceCountry: 'FRA' },
      { currency: 'EURO' },
      { language: 'klingon!' },
      { timeZone: 'Mars/Olympus' },
      { home: 'L' },
      { home: 'x'.repeat(81) },
    ])
      expect(cleanTravellerFields(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('listes du formulaire', () => {
  it('pays : noms français, triés, sans code qui n’est pas un pays', () => {
    const list = countryOptions();
    expect(list.find((o) => o.value === 'FR')?.label).toBe('France');
    expect(list.find((o) => o.value === 'XK')?.label).toBe('Kosovo');
    expect(list.some((o) => ['UK', 'EU', 'ZZ'].includes(o.value))).toBe(false);
    expect(list.every((o) => isCountryCode(o.value))).toBe(true);
    expect([...list].sort((x, y) => x.label.localeCompare(y.label, 'fr'))).toEqual(list);
  });

  it('devises : nom français et code', () => {
    expect(currencyOptions().find((o) => o.value === 'EUR')?.label).toBe('Euro (EUR)');
    expect(currencyOptions().find((o) => o.value === 'CHF')?.label).toBe('Franc suisse (CHF)');
  });

  it('langues : les six de /compte, plus celle déjà rangée', () => {
    expect(languageOptions(null).map((o) => o.value)).toEqual(['fr', 'en', 'de', 'it', 'es', 'ca']);
    expect(languageOptions(null)[0].label).toBe('Français');
    expect(languageOptions('pt-BR').map((o) => o.value)).toContain('pt-BR');
  });

  it('fuseaux : ceux d’Intl, plus celui déjà rangé', () => {
    expect(timeZoneOptions(null).map((o) => o.value)).toContain('Europe/Paris');
    expect(timeZoneOptions('UTC').map((o) => o.value)).toContain('UTC');
  });
});

describe('« aujourd’hui » : le navigateur, puis le profil, puis Paris', () => {
  // 22 h 30 UTC : déjà le 10 à Paris, encore le 9 à Los Angeles.
  const late = new Date('2026-10-09T22:30:00Z');

  it('le fuseau du profil ne sert que si le navigateur n’en envoie aucun de valable', () => {
    expect(travellerToday('Europe/Paris', late, 'America/Los_Angeles')).toBe('2026-10-10');
    expect(travellerToday(undefined, late, 'America/Los_Angeles')).toBe('2026-10-09');
    expect(travellerToday('Mars/Olympus', late, 'America/Los_Angeles')).toBe('2026-10-09');
    expect(travellerToday(undefined, late, 'Mars/Olympus')).toBe('2026-10-10');
    expect(travellerToday(undefined, late, null)).toBe('2026-10-10');
  });
});
```

- [ ] **Step 2: Write the failing reader tests**

Create `src/features/compas/__tests__/travellerReader.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readTraveller, readTravellerState } from '../server/traveller';
import { UNKNOWN_TRAVELLER } from '../engine/traveller';

const COLUMNS =
  'nationality, residence_country, currency, language, time_zone, home_name, home_lat, home_lon, home_country';

/** Faux client : garde chaque lecture (table, colonnes, filtre) et rend `result`. */
function fake(result: { data: unknown; error: unknown } | Error) {
  const reads: Array<{ table: string; columns: string; column: string; value: string }> = [];
  const supabase = {
    from: vi.fn((table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            reads.push({ table, columns, column, value });
            if (result instanceof Error) throw result;
            return result;
          },
        }),
      }),
    })),
  };
  return { supabase, reads };
}

const ROW = {
  nationality: 'FR',
  residence_country: 'FR',
  currency: 'EUR',
  language: 'fr',
  time_zone: 'Europe/Paris',
  home_name: 'Lyon',
  home_lat: 45.76,
  home_lon: 4.83,
  home_country: 'FR',
};

describe('lecteur du profil voyageur (sa ligne, par la RLS)', () => {
  it('sans personne : tout inconnu, jamais demandé, aucune requête', async () => {
    const { supabase } = fake({ data: ROW, error: null });
    expect(await readTravellerState(supabase as never, null)).toEqual({ asked: false, traveller: UNKNOWN_TRAVELLER });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sa ligne : les neuf colonnes, filtrée sur la personne', async () => {
    const { supabase, reads } = fake({ data: ROW, error: null });
    const state = await readTravellerState(supabase as never, 'u1');
    expect(reads).toEqual([{ table: 'user_traveller', columns: COLUMNS, column: 'user_id', value: 'u1' }]);
    expect(state).toEqual({
      asked: true,
      traveller: {
        nationality: 'FR',
        residenceCountry: 'FR',
        currency: 'EUR',
        language: 'fr',
        timeZone: 'Europe/Paris',
        home: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' },
      },
    });
    expect(await readTraveller(supabase as never, 'u1')).toEqual(state.traveller);
  });

  it('aucune ligne : jamais demandé, tout inconnu', async () => {
    const { supabase } = fake({ data: null, error: null });
    expect(await readTravellerState(supabase as never, 'u1')).toEqual({ asked: false, traveller: UNKNOWN_TRAVELLER });
  });

  it('ligne vide (« Passer ») : demandé, tout inconnu', async () => {
    const empty = Object.fromEntries(Object.keys(ROW).map((k) => [k, null]));
    const { supabase } = fake({ data: empty, error: null });
    expect(await readTravellerState(supabase as never, 'u1')).toEqual({ asked: true, traveller: UNKNOWN_TRAVELLER });
  });

  it('lecture en échec ou en panne : on ne redemande pas, tout reste inconnu', async () => {
    const failed = fake({ data: null, error: { message: 'refusé' } });
    expect(await readTravellerState(failed.supabase as never, 'u1')).toEqual({ asked: true, traveller: UNKNOWN_TRAVELLER });
    const broken = fake(new Error('réseau'));
    expect(await readTravellerState(broken.supabase as never, 'u1')).toEqual({ asked: true, traveller: UNKNOWN_TRAVELLER });
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/traveller.test.ts src/features/compas/__tests__/travellerReader.test.ts`
Expected: FAIL — `Failed to resolve import "../engine/traveller"` and `"../server/traveller"`.

- [ ] **Step 4: Export the currency list from `intentWords.ts`**

In `src/features/compas/engine/intentWords.ts`, replace:

```ts
let isoCodes: Set<string> | null = null;
function knownIsoCode(code: string): boolean {
  if (!isoCodes) {
    try {
      isoCodes = new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('currency'));
    } catch {
      isoCodes = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD', 'NZD', 'NOK', 'SEK', 'DKK', 'ISK', 'MAD', 'THB']);
    }
  }
  return isoCodes.has(code);
}
```

with:

```ts
let isoCodes: Set<string> | null = null;
/** Codes ISO 4217 connus du moteur `Intl` (repli : 14 devises courantes s'il ne les liste pas). */
export function isoCurrencyCodes(): ReadonlySet<string> {
  if (!isoCodes) {
    try {
      isoCodes = new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('currency'));
    } catch {
      isoCodes = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD', 'NZD', 'NOK', 'SEK', 'DKK', 'ISK', 'MAD', 'THB']);
    }
  }
  return isoCodes;
}
export function knownIsoCode(code: string): boolean {
  return isoCurrencyCodes().has(code);
}
```

- [ ] **Step 5: The profile time zone as a fallback for « aujourd'hui »**

In `src/features/compas/engine/zone.ts`, replace:

```ts
/** « Aujourd'hui » du voyageur : le fuseau envoyé par son navigateur, sinon Paris. */
export function travellerToday(timeZone: unknown, now = new Date()): string {
  return localToday(safeTimeZone(timeZone) ?? DEFAULT_TRAVELLER_ZONE, now);
}
```

with:

```ts
/**
 * « Aujourd'hui » du voyageur : le fuseau envoyé par son navigateur ; celui de
 * son profil (PLAN-100 4.1) seulement quand le navigateur n'en envoie aucun de
 * valable ; Paris en dernier repli.
 */
export function travellerToday(timeZone: unknown, now = new Date(), profileZone: unknown = null): string {
  return localToday(safeTimeZone(timeZone) ?? safeTimeZone(profileZone) ?? DEFAULT_TRAVELLER_ZONE, now);
}
```

- [ ] **Step 6: The pure module**

Create `src/features/compas/engine/traveller.ts`:

```ts
/**
 * Compas — le contexte du voyageur (PLAN-100 4.1) : nationalité, pays de
 * résidence, devise, langue, fuseau, domicile. Module PUR : aucun réseau, aucune
 * base ; lu par le serveur ET par le navigateur (listes du formulaire).
 *
 * Chaque champ vaut null quand il est inconnu (sans profil, essai sans compte) :
 * alors rien d'affirmé qui en dépende. Les moteurs reçoivent ce contexte en
 * argument ; seul `server/traveller.ts` le lit en base, par la RLS de la personne.
 * Les listes viennent de `Intl` (aucune liste inventée) ; la base revérifie les
 * formats (CHECK).
 */

import { isoCurrencyCodes, knownIsoCode } from './intentWords';
import { safeTimeZone } from './zone';

export interface TravellerHome {
  /** Nom du lieu tel que la carte l'a retrouvé (« Lyon »), 80 caractères au plus. */
  name: string;
  /** Arrondis à 0,01° (~1 km) : jamais un point plus fin. */
  lat: number;
  lon: number;
  countryCode: string | null;
}

export interface TravellerContext {
  /** ISO 3166-1 alpha-2 en majuscules (« FR »). */
  nationality: string | null;
  residenceCountry: string | null;
  /** ISO 4217 en majuscules (« EUR »). */
  currency: string | null;
  /** BCP 47 canonique (« fr », « pt-BR »). */
  language: string | null;
  /** Fuseau IANA (« Europe/Paris »). */
  timeZone: string | null;
  home: TravellerHome | null;
}

export const UNKNOWN_TRAVELLER: TravellerContext = Object.freeze({
  nationality: null,
  residenceCountry: null,
  currency: null,
  language: null,
  timeZone: null,
  home: null,
});

/** Ce que la personne voit d'elle-même (/compte, Compas) : jamais de coordonnées. */
export interface TravellerView {
  nationality: string | null;
  residenceCountry: string | null;
  currency: string | null;
  language: string | null;
  timeZone: string | null;
  homeName: string | null;
}

/** Saisie nettoyée ; le domicile est encore un texte, retrouvé sur la carte par le serveur. */
export interface TravellerFields {
  nationality: string | null;
  residenceCountry: string | null;
  currency: string | null;
  language: string | null;
  timeZone: string | null;
  home: string | null;
}

export interface TravellerOption {
  value: string;
  label: string;
}

/**
 * Codes de région que `Intl` nomme mais qui ne sont pas des pays ISO 3166-1
 * (CLDR : réservés, périmés, macro-régions, pseudo-régions).
 */
const NOT_COUNTRIES = new Set(
  'AC AN BU CP CS DD DG DY EA EU EZ FX HV IC NH QO RH SU TA TP UK UN VD XA XB YD YU ZR ZZ'.split(' ')
);

const names: Partial<Record<'region' | 'language' | 'currency', Intl.DisplayNames>> = {};

/** Nom français d'un code (`Intl`), null s'il ne le connaît pas. */
function displayName(kind: 'region' | 'language' | 'currency', code: string): string | null {
  try {
    const dn = (names[kind] ??= new Intl.DisplayNames(['fr'], { type: kind, fallback: 'none' }));
    return dn.of(code) ?? null;
  } catch {
    return null;
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Code pays ISO 3166-1 alpha-2 en majuscules (Kosovo `XK` compris) ; jamais `UK`, `EU` ni `ZZ`. */
export function isCountryCode(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Z]{2}$/.test(v) && !NOT_COUNTRIES.has(v) && displayName('region', v) != null;
}

/** Code de devise ISO 4217 en majuscules, connu de `Intl` (même liste que la lecture des montants). */
export function isCurrencyCode(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v) && knownIsoCode(v);
}

/** Langue BCP 47 canonique et connue (« pt-br » → « pt-BR »), sinon null. */
export function languageTag(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const raw = v.trim();
  if (!raw || raw.length > 35) return null;
  let tag: string;
  try {
    tag = Intl.getCanonicalLocales(raw)[0] ?? '';
  } catch {
    return null;
  }
  if (!/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/.test(tag)) return null;
  return displayName('language', tag) ? tag : null;
}

/** Un nombre (ou son texte, la base rend parfois `numeric` en texte), arrondi à 0,01°, sinon null. */
function coord(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 100) / 100 : null;
}

/** Ligne du profil voyageur lue défensivement : chaque champ invalide vaut null (inconnu), jamais deviné. */
export function travellerFromRow(raw: unknown): TravellerContext {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...UNKNOWN_TRAVELLER };
  const r = raw as Record<string, unknown>;
  const country = (v: unknown) => (isCountryCode(v) ? v : null);
  const name = typeof r.home_name === 'string' ? r.home_name.trim().slice(0, 80) : '';
  const lat = coord(r.home_lat, 90);
  const lon = coord(r.home_lon, 180);
  return {
    nationality: country(r.nationality),
    residenceCountry: country(r.residence_country),
    currency: isCurrencyCode(r.currency) ? r.currency : null,
    language: languageTag(r.language),
    timeZone: safeTimeZone(r.time_zone),
    home: name && lat != null && lon != null ? { name, lat, lon, countryCode: country(r.home_country) } : null,
  };
}

export function travellerView(t: TravellerContext): TravellerView {
  return {
    nationality: t.nationality,
    residenceCountry: t.residenceCountry,
    currency: t.currency,
    language: t.language,
    timeZone: t.timeZone,
    homeName: t.home?.name ?? null,
  };
}

/**
 * Saisie du formulaire nettoyée (casse, espaces, formes canoniques) ; null si un
 * seul champ est invalide : rien n'est enregistré à moitié. Vide = inconnu.
 */
export function cleanTravellerFields(input: Partial<Record<keyof TravellerFields, string | null | undefined>>): TravellerFields | null {
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const nationality = text(input.nationality)?.toUpperCase() ?? null;
  const residenceCountry = text(input.residenceCountry)?.toUpperCase() ?? null;
  const currency = text(input.currency)?.toUpperCase() ?? null;
  const languageRaw = text(input.language);
  const language = languageRaw ? languageTag(languageRaw) : null;
  const zoneRaw = text(input.timeZone);
  const timeZone = zoneRaw ? safeTimeZone(zoneRaw) : null;
  const home = text(input.home);
  if (nationality && !isCountryCode(nationality)) return null;
  if (residenceCountry && !isCountryCode(residenceCountry)) return null;
  if (currency && !isCurrencyCode(currency)) return null;
  if (languageRaw && !language) return null;
  if (zoneRaw && !timeZone) return null;
  if (home && (home.length < 2 || home.length > 80)) return null;
  return { nationality, residenceCountry, currency, language, timeZone, home };
}

/** Nationalité française connue : seul cas où le Compas garde ses règles « ressortissant français ». */
export function isFrenchNational(t: Pick<TravellerContext, 'nationality'>): boolean {
  return t.nationality === 'FR';
}

/** Pays nommés en français, triés : tous les codes que `Intl` connaît comme pays. */
export function countryOptions(): TravellerOption[] {
  const out: TravellerOption[] = [];
  for (let a = 65; a <= 90; a += 1)
    for (let b = 65; b <= 90; b += 1) {
      const code = String.fromCharCode(a, b);
      if (isCountryCode(code)) out.push({ value: code, label: displayName('region', code) as string });
    }
  return out.sort((x, y) => x.label.localeCompare(y.label, 'fr'));
}

/** Devises ISO 4217 connues, nom français et code (« Franc suisse (CHF) »). */
export function currencyOptions(): TravellerOption[] {
  return [...isoCurrencyCodes()]
    .map((code) => ({ value: code, label: `${capitalize(displayName('currency', code) ?? code)} (${code})` }))
    .sort((x, y) => x.label.localeCompare(y.label, 'fr'));
}

/** Les six langues proposées par /compte (« Langue de l'interface »), plus celle déjà rangée. */
export const LANGUAGE_CODES = ['fr', 'en', 'de', 'it', 'es', 'ca'] as const;

export function languageOptions(current: string | null): TravellerOption[] {
  const codes: string[] = [...LANGUAGE_CODES];
  if (current && !codes.includes(current)) codes.push(current);
  return codes.map((code) => ({ value: code, label: capitalize(displayName('language', code) ?? code) }));
}

/** Fuseaux que `Intl` liste, plus celui déjà rangé (un alias comme « UTC » n'y est pas toujours). */
export function timeZoneOptions(current: string | null): TravellerOption[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  const all = new Set(zones);
  if (current) all.add(current);
  return [...all].sort().map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}
```

- [ ] **Step 7: The server reader (the only module that names the table)**

Create `src/features/compas/server/traveller.ts`:

```ts
import 'server-only';
import type { Supa } from './compasServer';
import {
  UNKNOWN_TRAVELLER,
  travellerFromRow,
  type TravellerContext,
  type TravellerFields,
  type TravellerHome,
} from '../engine/traveller';

/**
 * Profil voyageur de la personne connectée (table `user_traveller`, PLAN-100 4.1).
 *
 * Seul module qui nomme cette table, avec l'export RGPD de la personne (verrou
 * `scripts/verify/traveller_privacy.mjs`) : toujours avec le client de la personne
 * (RLS : sa ligne seule), jamais un client service, jamais pour quelqu'un d'autre.
 * Aucun journal : ni nationalité, ni domicile.
 */

const COLUMNS =
  'nationality, residence_country, currency, language, time_zone, home_name, home_lat, home_lon, home_country';

type Reader = { from: Supa['from'] } | Supa;

export interface TravellerState {
  /** Une ligne existe (remplie, ou « Passer ») : la question n'est plus posée. */
  asked: boolean;
  traveller: TravellerContext;
}

/**
 * Sa ligne, sinon tout inconnu. Sans personne (essai sans compte compris quand
 * l'appelant passe null) : aucune requête. Lecture en échec : on ne redemande pas
 * (jamais une carte qui insiste) et tout reste inconnu.
 */
export async function readTravellerState(supabase: Reader, userId: string | null): Promise<TravellerState> {
  if (!userId) return { asked: false, traveller: { ...UNKNOWN_TRAVELLER } };
  try {
    const { data, error } = await (supabase as Supa).from('user_traveller').select(COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) return { asked: true, traveller: { ...UNKNOWN_TRAVELLER } };
    return { asked: data != null, traveller: travellerFromRow(data) };
  } catch {
    return { asked: true, traveller: { ...UNKNOWN_TRAVELLER } };
  }
}

/** Le contexte voyageur seul, pour les moteurs (tout inconnu sans ligne). */
export async function readTraveller(supabase: Reader, userId: string | null): Promise<TravellerContext> {
  return (await readTravellerState(supabase, userId)).traveller;
}

/** Remplace tout le profil de la personne ; le domicile est déjà retrouvé et arrondi. */
export async function writeTraveller(
  supabase: Supa,
  userId: string,
  fields: Omit<TravellerFields, 'home'>,
  home: TravellerHome | null
): Promise<boolean> {
  const { error } = await supabase.from('user_traveller').upsert(
    {
      user_id: userId,
      nationality: fields.nationality,
      residence_country: fields.residenceCountry,
      currency: fields.currency,
      language: fields.language,
      time_zone: fields.timeZone,
      home_name: home?.name ?? null,
      home_lat: home?.lat ?? null,
      home_lon: home?.lon ?? null,
      home_country: home?.countryCode ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  return !error;
}

/** « Passer » : une ligne vide, jamais par-dessus un profil déjà rempli. */
export async function markTravellerAsked(supabase: Supa, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_traveller')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  return !error;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/traveller.test.ts src/features/compas/__tests__/travellerReader.test.ts src/features/compas/__tests__/zone.test.ts src/features/compas/__tests__/intent*.test.ts`
Expected: PASS (6 files; the existing `zone.test.ts` and intent tests unchanged).

Run: `npx tsc --noEmit -p .`
Expected: no error.

- [ ] **Step 9: Commit**

```bash
git add src/features/compas/engine/traveller.ts src/features/compas/server/traveller.ts src/features/compas/engine/intentWords.ts src/features/compas/engine/zone.ts src/features/compas/__tests__/traveller.test.ts src/features/compas/__tests__/travellerReader.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): contexte voyageur pur et lecteur serveur du profil

TravellerContext (tout inconnu par défaut) lu défensivement, formats vérifiés par
Intl (pays ISO sans UK/EU/ZZ, devises, langues BCP 47, fuseaux), listes du
formulaire ; lecteur server-only par la RLS de la personne, « demandé » = une
ligne existe ; fuseau du profil en repli de « aujourd'hui », après le navigateur.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 3: Le verrou de vie privée (build, CI, tests)

**Files:**
- Create: `scripts/verify/traveller_privacy.mjs`
- Create: `src/features/compas/__tests__/travellerPrivacy.test.ts`
- Modify: `scripts/verify/identity_compliance.mjs` (header, imports, new rule 4 before « Résultat »)
- Modify: `package.json` (`prebuild`)

**Interfaces:**
- Consumes (Task 2): paths `src/features/compas/server/traveller.ts`, `src/features/compas/engine/traveller.ts`.
- Produces: `export function travellerPrivacyViolations(root?: string): string[]` (`scripts/verify/traveller_privacy.mjs`, `[]` when compliant). Allow-lists that later tasks MUST respect: the table literal only in `src/features/compas/server/traveller.ts` and `src/server/gdprExport.ts`; the reader imported only from `src/features/compas/server/**`, `src/app/compas/page.tsx`, `src/app/compte/voyageur/page.tsx` (never a `'use client'` file); `src/features/compas/server/travellerActions` imported only from `src/components/identity/**`; `src/components/identity/TravellerCard` imported only by `src/app/compte/voyageur/page.tsx` and `src/features/compas/components/CompasStart.tsx`; `engine/traveller` never imported under `src/lib/ai/`, `src/features/kits/`, `src/features/trips/`, `src/app/k/`, `src/app/profil/`, `src/app/api/`; no `console.` in `server/traveller.ts` or `server/travellerActions.ts`.

- [ ] **Step 1: Write the failing lock spec**

Create `src/features/compas/__tests__/travellerPrivacy.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { travellerPrivacyViolations } from '../../../../scripts/verify/traveller_privacy.mjs';

/**
 * Verrou de vie privée du profil voyageur (PLAN-100 4.1) : le dépôt est conforme,
 * et chaque fuite possible casse le verrou (dépôts factices dans un dossier temporaire).
 */
const roots: string[] = [];
function repo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lkdv-traveller-'));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const READ = "import { readTraveller } from '@/features/compas/server/traveller';\n";

describe('verrou de vie privée du profil voyageur', () => {
  it('le dépôt est conforme', () => {
    expect(travellerPrivacyViolations(process.cwd())).toEqual([]);
  });

  it('un composant public qui importe le lecteur casse le verrou', () => {
    expect(travellerPrivacyViolations(repo({ 'src/components/profil/PublicCard.tsx': READ }))).toEqual([
      'lecteur du profil voyageur importé par src/components/profil/PublicCard.tsx',
    ]);
  });

  it('même dans le Compas, un fichier « use client » ne lit jamais le profil', () => {
    const root = repo({ 'src/features/compas/components/Leak.tsx': `'use client';\nimport { readTraveller } from '../server/traveller';\n` });
    expect(travellerPrivacyViolations(root)).toEqual(['lecteur du profil voyageur importé par src/features/compas/components/Leak.tsx']);
  });

  it('le serveur du Compas et les deux pages du profil peuvent le lire', () => {
    const root = repo({
      'src/features/compas/server/autofillActions.ts': `'use server';\nimport { readTraveller } from './traveller';\n`,
      'src/app/compas/page.tsx': READ,
      'src/app/compte/voyageur/page.tsx': `${READ}import TravellerCard from '@/components/identity/TravellerCard';\n`,
      'src/components/identity/TravellerCard.tsx': `'use client';\nimport { saveTravellerAction } from '@/features/compas/server/travellerActions';\n`,
      'src/features/compas/components/CompasStart.tsx': `'use client';\nimport TravellerCard from '@/components/identity/TravellerCard';\n`,
      'src/server/gdprExport.ts': "const t = 'user_traveller';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });

  it('la table nommée ailleurs, une réexportation des actions, la carte montée ailleurs : refusées', () => {
    const root = repo({
      'src/features/trips/server/joinActivity.ts': "await service.from('user_traveller').select('*');\n",
      'src/components/profil/actions.ts': "export * from '../../features/compas/server/travellerActions';\n",
      'src/app/profil/[id]/page.tsx': "import TravellerCard from '@/components/identity/TravellerCard';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'carte du profil voyageur montée dans src/app/profil/[id]/page.tsx',
      'actions du profil voyageur importées par src/components/profil/actions.ts',
      'table user_traveller nommée hors du lecteur : src/features/trips/server/joinActivity.ts',
    ]);
  });

  it('l’IA et les partages ne reçoivent jamais le contexte voyageur brut', () => {
    const root = repo({
      'src/lib/ai/features/compasAutofill.ts': "import type { TravellerContext } from '@/features/compas/engine/traveller';\n",
      'src/app/k/[token]/page.tsx': "import { travellerView } from '@/features/compas/engine/traveller';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'contexte voyageur importé par src/app/k/[token]/page.tsx',
      'contexte voyageur importé par src/lib/ai/features/compasAutofill.ts',
    ]);
  });

  it('aucun journal dans le lecteur ni dans les actions', () => {
    const root = repo({ 'src/features/compas/server/travellerActions.ts': "'use server';\nconsole.info('profil', 1);\n" });
    expect(travellerPrivacyViolations(root)).toEqual(['journal interdit dans src/features/compas/server/travellerActions.ts']);
  });

  it('les tests ne comptent pas', () => {
    const root = repo({ 'src/features/compas/__tests__/x.test.ts': READ, 'src/components/x.spec.tsx': READ });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/compas/__tests__/travellerPrivacy.test.ts`
Expected: FAIL — `Failed to resolve import "../../../../scripts/verify/traveller_privacy.mjs"`.

- [ ] **Step 3: Write the lock**

Create `scripts/verify/traveller_privacy.mjs`:

```js
#!/usr/bin/env node
/**
 * VERROU DE VIE PRIVÉE — profil voyageur du Compas (PLAN-100 4.1, lot P)
 * =====================================================================
 * Nationalité, pays de résidence et domicile ne sortent jamais du serveur, sauf
 * vers la personne elle-même. Ce verrou casse le build (`prebuild`), la CI (Gate 0,
 * via identity_compliance.mjs) et `npm test` (travellerPrivacy.test.ts) si :
 *   1. la table user_traveller est nommée hors du lecteur et de l'export RGPD ;
 *   2. le lecteur `server/traveller` est importé hors du serveur du Compas et des
 *      deux pages serveur qui montrent le profil à la personne (jamais par un
 *      fichier 'use client') ;
 *   3. les actions `server/travellerActions` sont importées hors de src/components/identity ;
 *   4. la carte `TravellerCard` est montée ailleurs que /compte/voyageur et le Compas vide ;
 *   5. l'IA, les kits, les voyages partagés, les profils publics ou les routes API
 *      importent le contexte voyageur (`engine/traveller`) ;
 *   6. le lecteur ou les actions écrivent dans la console (aucun journal).
 * Marche de fichiers en Node, sans `rg` : un outil absent ne fait jamais passer à vide.
 *
 * Usage : node scripts/verify/traveller_privacy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TABLE = 'user_traveller';
const READER = 'src/features/compas/server/traveller';
const ACTIONS = 'src/features/compas/server/travellerActions';
const CARD = 'src/components/identity/TravellerCard';
const ENGINE = 'src/features/compas/engine/traveller';

const TABLE_ALLOWED = new Set(['src/features/compas/server/traveller.ts', 'src/server/gdprExport.ts']);
const READER_PAGES = new Set(['src/app/compas/page.tsx', 'src/app/compte/voyageur/page.tsx']);
const CARD_ALLOWED = new Set(['src/app/compte/voyageur/page.tsx', 'src/features/compas/components/CompasStart.tsx']);
const ENGINE_FORBIDDEN = ['src/lib/ai/', 'src/features/kits/', 'src/features/trips/', 'src/app/k/', 'src/app/profil/', 'src/app/api/'];
const SILENT = new Set(['src/features/compas/server/traveller.ts', 'src/features/compas/server/travellerActions.ts']);

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const TEST_FILE = /\.(?:test|spec)\.[jt]sx?$/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(abs, out);
    } else if (CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

/** Module visé par un import, sans extension (« @/x » = « src/x ») ; null pour un paquet. */
function target(file, spec) {
  let t;
  if (spec.startsWith('@/')) t = `src/${spec.slice(2)}`;
  else if (spec.startsWith('./') || spec.startsWith('../')) t = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  else return null;
  return t.replace(/\.(?:tsx?|jsx?|mjs)$/, '').replace(/\/index$/, '');
}

/** Les violations du verrou sous `root/src` (chemins relatifs à `root`), [] si conforme. */
export function travellerPrivacyViolations(root = process.cwd()) {
  const out = [];
  for (const abs of walk(path.join(root, 'src'), []).sort()) {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');
    const client = /^\s*['"]use client['"]/.test(text);
    if (text.includes(TABLE) && !TABLE_ALLOWED.has(file)) out.push(`table ${TABLE} nommée hors du lecteur : ${file}`);
    if (SILENT.has(file) && /\bconsole\./.test(text)) out.push(`journal interdit dans ${file}`);
    for (const m of text.matchAll(IMPORT_RE)) {
      const t = target(file, m[1]);
      if (!t) continue;
      const serverSide = file.startsWith('src/features/compas/server/') || READER_PAGES.has(file);
      if (t === READER && (client || !serverSide)) out.push(`lecteur du profil voyageur importé par ${file}`);
      if (t === ACTIONS && !file.startsWith('src/components/identity/')) out.push(`actions du profil voyageur importées par ${file}`);
      if (t === CARD && !CARD_ALLOWED.has(file)) out.push(`carte du profil voyageur montée dans ${file}`);
      if (t === ENGINE && ENGINE_FORBIDDEN.some((p) => file.startsWith(p))) out.push(`contexte voyageur importé par ${file}`);
    }
  }
  return [...new Set(out)];
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const violations = travellerPrivacyViolations();
  if (violations.length) {
    for (const v of violations) console.error(`✗ ${v}`);
    console.error(`\n✗ VIE PRIVÉE : ${violations.length} violation(s) du profil voyageur.`);
    process.exit(1);
  }
  console.info('✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).');
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx vitest run src/features/compas/__tests__/travellerPrivacy.test.ts`
Expected: PASS (8 tests).

Run: `node scripts/verify/traveller_privacy.mjs; echo "exit $?"`
Expected: `✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).` then `exit 0`.

- [ ] **Step 5: Wire it into Gate 0 (`identity_compliance.mjs`)**

In `scripts/verify/identity_compliance.mjs`, replace:

```js
 *   3. Les fichiers du chantier (features/identity, components/identity) n'utilisent
 *      QUE la palette autorisée (ink/sage) — pas d'hex hors norme, pas d'emerald/red.
```

with:

```js
 *   3. Les fichiers du chantier (features/identity, components/identity) n'utilisent
 *      QUE la palette autorisée (ink/sage) — pas d'hex hors norme, pas d'emerald/red.
 *   4. Le profil voyageur du Compas reste confiné (lecteur, actions, carte) :
 *      scripts/verify/traveller_privacy.mjs, marche de fichiers sans rg.
```

replace:

```js
import { execSync } from 'node:child_process';
```

with:

```js
import { execSync } from 'node:child_process';
import { travellerPrivacyViolations } from './traveller_privacy.mjs';
```

and replace:

```js
// --- Résultat ----------------------------------------------------------------
```

with:

```js
// --- 4. profil voyageur confiné (PLAN-100 4.1, lot P) — marche de fichiers, sans rg
const travellerLeaks = travellerPrivacyViolations(root);
if (travellerLeaks.length) {
  travellerLeaks.forEach((v) => fail(v));
} else {
  ok('profil voyageur confiné : lecteur, actions et carte à leur seule place');
}

// --- Résultat ----------------------------------------------------------------
```

Run: `node scripts/verify/identity_compliance.mjs | tail -3`
Expected: the line `✓ profil voyageur confiné : lecteur, actions et carte à leur seule place`, then `✓ ANTI-DÉRIVE : toutes les contraintes durables sont respectées.`

- [ ] **Step 6: Wire it into the build (`prebuild`)**

In `package.json`, replace:

```json
    "prebuild": "node scripts/icons/build-sprite.mjs && node scripts/icons/build-heroicons-map.mjs && node scripts/atlas/copy-maplibre-worker.mjs",
```

with:

```json
    "prebuild": "node scripts/icons/build-sprite.mjs && node scripts/icons/build-heroicons-map.mjs && node scripts/atlas/copy-maplibre-worker.mjs && node scripts/verify/traveller_privacy.mjs",
```

Run: `node -e "const s=require('./package.json').scripts.prebuild; if(!s.endsWith('node scripts/verify/traveller_privacy.mjs')) process.exit(1)" && echo ok`
Expected: `ok`.

- [ ] **Step 7: Lint and commit**

Run: `npx eslint scripts/verify/traveller_privacy.mjs src/features/compas/__tests__/travellerPrivacy.test.ts`
Expected: no error (no warning on these two files).

```bash
git add scripts/verify/traveller_privacy.mjs scripts/verify/identity_compliance.mjs package.json src/features/compas/__tests__/travellerPrivacy.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): verrou de vie privée du profil voyageur au build

Marche de fichiers sans rg (un outil absent ne fait plus passer à vide) : la
table nommée hors du lecteur, le lecteur importé hors du serveur ou par un
fichier « use client », les actions hors d'identity, la carte montée ailleurs,
le contexte importé par l'IA, les kits, les partages ou les profils publics,
un journal dans le lecteur : le prebuild, la CI (Gate 0) et npm test cassent.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 4: Enregistrer le profil (actions serveur, domicile retrouvé une fois)

**Files:**
- Create: `src/features/compas/server/placeSearch.ts`
- Modify: `src/features/compas/server/compasActions.ts` (imports ~line 14; `resolveDestination` and `placeSearchLimitError` ~lines 583-622)
- Modify: `src/features/compas/engine/places.ts` (after `isDeparturePlace`, ~line 355)
- Create: `src/features/compas/server/travellerActions.ts`
- Create: `src/features/compas/__tests__/travellerActions.test.ts`

**Interfaces:**
- Consumes (Task 2): `cleanTravellerFields`, `isCountryCode`, `travellerView`, `TravellerHome`, `TravellerView` (`engine/traveller.ts`); `readTravellerState`, `writeTraveller`, `markTravellerAsked` (`server/traveller.ts`). Existing: `coarsePosition` (`engine/privacy.ts`), `samePlaceName`, `isDeparturePlace`, `CompasPlace` (`engine/places.ts`), `enforceRateLimit` (`@/lib/rate-limit/routes`), `lookupDestination` / `lookupNatural` / `lookupLoose` (`server/placeLookup.ts`), `reportServerError`.
- Produces:
  - `server/placeSearch.ts` (`server-only`, NOT an action): `placeSearchLimitError(userId: string): Promise<string | null>` (scope `compas-destination`, 20 per 600 000 ms, `failMode: 'closed'`, same two messages as before), `resolvePlaceByName(query: string, specialist?: (query: string) => Promise<CompasPlace | null>): Promise<CompasPlace | null>`.
  - `engine/places.ts`: `isHomePlace(place: CompasPlace): boolean`.
  - `server/travellerActions.ts` (`'use server'`): `type TravellerSaveResult = { success: true; view: TravellerView } | { success: false; error: string }`, `saveTravellerAction(input: { nationality?: string | null; residenceCountry?: string | null; currency?: string | null; language?: string | null; timeZone?: string | null; home?: string | null }): Promise<TravellerSaveResult>` (full replacement of the profile), `skipTravellerAction(): Promise<{ success: boolean }>`.

- [ ] **Step 1: Write the failing action tests**

Create `src/features/compas/__tests__/travellerActions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompasPlace } from '../engine/places';

/**
 * Profil voyageur enregistré par la personne : formats vérifiés, domicile retrouvé
 * UNE fois sur la carte (même limite que « depuis Lyon ») et rangé à 0,01°, essai
 * sans compte refusé, « Passer » rangé sans rien effacer, rien de la saisie dans un journal.
 */
const h = vi.hoisted(() => ({
  user: { id: 'u1', is_anonymous: false } as { id: string; is_anonymous?: boolean } | null,
  row: null as Record<string, unknown> | null,
  upserts: [] as Array<{ row: Record<string, unknown>; options: unknown }>,
  calls: [] as Array<{ scope: string; limit: number; windowMs: number; failMode?: string }>,
  refuse: null as null | number,
  failWrite: false,
  found: {} as Record<string, unknown>,
  throwOn: null as string | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
    from: (table: string) => {
      if (table !== 'user_traveller') throw new Error(`table inattendue : ${table}`);
      return {
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => ({ data: h.row && h.row.user_id === id ? { ...h.row } : null, error: null }),
          }),
        }),
        upsert: async (row: Record<string, unknown>, options: { onConflict?: string; ignoreDuplicates?: boolean }) => {
          h.upserts.push({ row, options });
          if (h.failWrite) return { error: { code: '23514', message: 'refusé' } };
          if (!(options.ignoreDuplicates && h.row)) h.row = { ...row };
          return { error: null };
        },
      };
    },
  }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string; limit: number; windowMs: number; failMode?: string }) => {
    h.calls.push({ scope: config.scope, limit: config.limit, windowMs: config.windowMs, failMode: config.failMode });
    return h.refuse ? new Response(null, { status: h.refuse }) : null;
  }),
}));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) => {
    if (h.throwOn === q) throw new Error(`Photon en panne pour « ${q} »`);
    return (h.found[q] as CompasPlace | undefined) ?? null;
  }),
  lookupNatural: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));

import { saveTravellerAction, skipTravellerAction } from '../server/travellerActions';
import { lookupDestination } from '../server/placeLookup';
import { reportServerError } from '@/lib/observability/appErrors';
import { isHomePlace } from '../engine/places';

const place = (name: string, kind: string, settlement: boolean, lat: number, lon: number): CompasPlace => ({
  name,
  lat,
  lon,
  countryCode: 'FR',
  country: 'France',
  kind,
  settlement,
  extent: null,
});
const LYON = place('Lyon', 'city', true, 45.757813, 4.832011);
const FULL = { nationality: 'fr', residenceCountry: 'FR', currency: 'eur', language: 'pt-br', timeZone: 'Europe/Paris', home: 'Lyon' };
const STORED = {
  user_id: 'u1',
  nationality: 'FR',
  residence_country: null,
  currency: null,
  language: null,
  time_zone: null,
  home_name: 'Lyon',
  home_lat: 45.76,
  home_lon: 4.83,
  home_country: 'FR',
};
const LIMIT = { scope: 'compas-destination', limit: 20, windowMs: 600_000, failMode: 'closed' };

beforeEach(() => {
  h.user = { id: 'u1', is_anonymous: false };
  h.row = null;
  h.upserts = [];
  h.calls = [];
  h.refuse = null;
  h.failWrite = false;
  h.throwOn = null;
  h.found = {
    Lyon: LYON,
    'Camping des Pins': place('Camping des Pins', 'camp_site', false, 44.1, 3.2),
    Bretagne: place('Bretagne', 'state', false, 48.2, -2.9),
  };
  vi.clearAllMocks();
});

describe('saveTravellerAction', () => {
  it('range le profil nettoyé et le domicile arrondi à 0,01°, rend la vue sans coordonnées', async () => {
    expect(await saveTravellerAction(FULL)).toEqual({
      success: true,
      view: { nationality: 'FR', residenceCountry: 'FR', currency: 'EUR', language: 'pt-BR', timeZone: 'Europe/Paris', homeName: 'Lyon' },
    });
    expect(h.upserts).toEqual([
      {
        row: {
          user_id: 'u1',
          nationality: 'FR',
          residence_country: 'FR',
          currency: 'EUR',
          language: 'pt-BR',
          time_zone: 'Europe/Paris',
          home_name: 'Lyon',
          home_lat: 45.76,
          home_lon: 4.83,
          home_country: 'FR',
          updated_at: expect.any(String),
        },
        options: { onConflict: 'user_id' },
      },
    ]);
  });

  it('domicile cherché une seule fois, avec la limite des lieux : 20 par 10 min, fermée', async () => {
    await saveTravellerAction(FULL);
    expect(h.calls).toEqual([LIMIT]);
    expect(lookupDestination).toHaveBeenCalledTimes(1);
  });

  it('même domicile qu’avant : ni recherche, ni comptage, position gardée', async () => {
    h.row = { ...STORED };
    expect(await saveTravellerAction({ nationality: 'BE', home: 'lyon' })).toMatchObject({
      success: true,
      view: { nationality: 'BE', homeName: 'Lyon' },
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expect(h.upserts[0].row).toMatchObject({ nationality: 'BE', home_name: 'Lyon', home_lat: 45.76, home_lon: 4.83, home_country: 'FR' });
  });

  it('sans domicile : rien de cherché, le domicile est effacé', async () => {
    h.row = { ...STORED };
    expect(await saveTravellerAction({ nationality: 'FR', home: '  ' })).toMatchObject({ success: true, view: { homeName: null } });
    expect(h.calls).toEqual([]);
    expect(h.upserts[0].row).toMatchObject({ home_name: null, home_lat: null, home_lon: null, home_country: null });
  });

  it('limite atteinte : message clair, rien cherché ni écrit', async () => {
    h.refuse = 429;
    expect(await saveTravellerAction(FULL)).toEqual({
      success: false,
      error: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.',
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.upserts).toEqual([]);
  });

  it('lieu inconnu de la carte : refusé, jamais deviné', async () => {
    expect(await saveTravellerAction({ home: 'Atlantide' })).toEqual({
      success: false,
      error: '« Atlantide » introuvable sur la carte.',
    });
    expect(h.upserts).toEqual([]);
  });

  it('un camping ou une région ne sont pas un domicile', async () => {
    for (const name of ['Camping des Pins', 'Bretagne'])
      expect(await saveTravellerAction({ home: name })).toEqual({
        success: false,
        error: `« ${name} » n’est pas une ville ou un village : écris ta commune (« Lyon »).`,
      });
    expect(h.upserts).toEqual([]);
  });

  it('formats refusés avant toute recherche : nationalité, pays, devise, langue, fuseau, domicile', async () => {
    for (const bad of [
      { nationality: 'UK' },
      { nationality: 'FRA' },
      { residenceCountry: 'ZZ' },
      { currency: 'EURO' },
      { language: 'klingon!' },
      { timeZone: 'Mars/Olympus' },
      { home: 'L' },
      { home: 'x'.repeat(81) },
    ])
      expect(await saveTravellerAction(bad), JSON.stringify(bad)).toEqual({ success: false, error: 'Profil invalide' });
    expect(await saveTravellerAction({ nationality: 42 } as never)).toEqual({ success: false, error: 'Profil invalide' });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expect(h.upserts).toEqual([]);
  });

  it('sans session, ou essai sans compte : refusé avant toute recherche', async () => {
    h.user = null;
    expect(await saveTravellerAction(FULL)).toEqual({ success: false, error: 'Connecte-toi pour enregistrer ton profil voyageur.' });
    h.user = { id: 'u9', is_anonymous: true };
    expect(await saveTravellerAction(FULL)).toEqual({ success: false, error: 'Crée ton compte pour enregistrer ton profil voyageur.' });
    expect(h.calls).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.upserts).toEqual([]);
  });

  it('écriture refusée par la base : un message fixe, sans la valeur', async () => {
    h.failWrite = true;
    expect(await saveTravellerAction({ nationality: 'FR' })).toEqual({
      success: false,
      error: 'Impossible d’enregistrer ton profil voyageur.',
    });
  });

  it('panne de la carte : « Erreur serveur », et rien de la saisie dans le journal', async () => {
    h.throwOn = 'Lyon';
    expect(await saveTravellerAction(FULL)).toEqual({ success: false, error: 'Erreur serveur' });
    expect(reportServerError).toHaveBeenCalledTimes(1);
    const [scope, err] = vi.mocked(reportServerError).mock.calls[0];
    expect(scope).toBe('compas.saveTravellerAction');
    expect((err as Error).message).not.toContain('Lyon');
  });
});

describe('skipTravellerAction', () => {
  it('« Passer » range une ligne vide : la question n’est plus posée', async () => {
    expect(await skipTravellerAction()).toEqual({ success: true });
    expect(h.upserts).toEqual([{ row: { user_id: 'u1' }, options: { onConflict: 'user_id', ignoreDuplicates: true } }]);
    expect(h.row).toEqual({ user_id: 'u1' });
  });

  it('un profil déjà rempli n’est jamais effacé par « Passer »', async () => {
    h.row = { ...STORED };
    await skipTravellerAction();
    expect(h.row).toEqual(STORED);
  });

  it('sans session ou essai sans compte : rien d’écrit', async () => {
    h.user = null;
    expect(await skipTravellerAction()).toEqual({ success: false });
    h.user = { id: 'u9', is_anonymous: true };
    expect(await skipTravellerAction()).toEqual({ success: false });
    expect(h.upserts).toEqual([]);
  });
});

describe('isHomePlace', () => {
  it('une ville ou un village ; jamais un camping, un sommet, une région ni un pays', () => {
    expect(isHomePlace(place('Lyon', 'city', true, 45, 5))).toBe(true);
    expect(isHomePlace(place('Méaudre', 'village', true, 45, 5))).toBe(true);
    expect(isHomePlace(place('Annecy', 'town', false, 45, 6))).toBe(true);
    for (const kind of ['camp_site', 'peak', 'state', 'region', 'county', 'province', 'country'])
      expect(isHomePlace(place('X', kind, false, 45, 5)), kind).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/travellerActions.test.ts`
Expected: FAIL — `Failed to resolve import "../server/travellerActions"`.

- [ ] **Step 3: Move the place search out of the action file**

Create `src/features/compas/server/placeSearch.ts`:

```ts
import 'server-only';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { lookupDestination, lookupLoose, lookupNatural } from './placeLookup';
import type { CompasPlace } from '../engine/places';

/**
 * Recherche d'un lieu par son nom, partagée par les actions qui en cherchent un
 * (destination, départ « depuis Lyon », domicile du profil voyageur). Module serveur
 * ordinaire, PAS une action : rien ici n'est appelable depuis le navigateur.
 */

/**
 * La carte (Photon, LocationIQ, Geoapify) et parfois l'IA : chaque recherche de
 * lieu (destination, départ, domicile) est comptée par personne (plan 2.2). Le
 * message à montrer si la limite est atteinte ou le compteur indisponible, sinon null.
 */
export async function placeSearchLimitError(userId: string): Promise<string | null> {
  const limited = await enforceRateLimit(userId, {
    scope: 'compas-destination',
    limit: 20,
    windowMs: 600_000,
    failMode: 'closed',
  });
  if (!limited) return null;
  return limited.status === 429
    ? 'Trop de lieux cherchés d’affilée : patiente quelques minutes.'
    : 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.';
}

/**
 * Le nom exact sur la carte ; sinon, s'il est donné, le spécialiste (ville de base
 * d'un massif, d'un parc, d'un sentier) ; sinon le lieu naturel qui porte le nom
 * (« Calanques » : le parc national, pas le récif de Piana en Corse, premier venu
 * de la carte) ; sinon le premier lieu habité du nom. Sans spécialiste : un lieu de
 * départ ou un domicile, où une ville de base inventée serait un faux départ.
 */
export async function resolvePlaceByName(
  query: string,
  specialist?: (query: string) => Promise<CompasPlace | null>
): Promise<CompasPlace | null> {
  const exact = await lookupDestination(query);
  if (exact) return exact;
  const based = specialist ? await specialist(query) : null;
  if (based) return based;
  const natural = await lookupNatural(query, null).catch(() => null);
  if (natural) return { ...natural, name: query.trim().slice(0, 80) };
  return lookupLoose(query);
}
```

In `src/features/compas/server/compasActions.ts`, replace:

```ts
import { lookupBase, lookupDestination, lookupLoose, lookupNatural } from './placeLookup';
```

with:

```ts
import { lookupBase, lookupDestination } from './placeLookup';
import { placeSearchLimitError, resolvePlaceByName } from './placeSearch';
```

and replace (the body of `resolveDestination` and the whole `placeSearchLimitError` with its comment; the doc comment above `resolveDestination` stays):

```ts
async function resolveDestination(
  query: string,
  userId: string,
  opts: { ai?: boolean } = {}
): Promise<CompasPlace | null> {
  const exact = await lookupDestination(query);
  if (exact) return exact;
  const based = opts.ai === false ? null : await baseFromSpecialist(query, userId);
  if (based) return based;
  // Sans réponse du spécialiste : le lieu naturel qui porte le nom (« Calanques » :
  // le parc national, pas le récif de Piana en Corse, premier venu de la carte).
  const natural = await lookupNatural(query, null).catch(() => null);
  if (natural) return { ...natural, name: query.trim().slice(0, 80) };
  return lookupLoose(query);
}

/**
 * La carte (Photon, LocationIQ, Geoapify) et parfois l'IA : chaque recherche de
 * lieu (destination, départ) est comptée par personne (plan 2.2). Le message à
 * montrer si la limite est atteinte ou le compteur indisponible, sinon null.
 */
async function placeSearchLimitError(userId: string): Promise<string | null> {
  const limited = await enforceRateLimit(userId, {
    scope: 'compas-destination',
    limit: 20,
    windowMs: 600_000,
    failMode: 'closed',
  });
  if (!limited) return null;
  return limited.status === 429
    ? 'Trop de lieux cherchés d’affilée : patiente quelques minutes.'
    : 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.';
}
```

with:

```ts
async function resolveDestination(
  query: string,
  userId: string,
  opts: { ai?: boolean } = {}
): Promise<CompasPlace | null> {
  return resolvePlaceByName(query, opts.ai === false ? undefined : (q) => baseFromSpecialist(q, userId));
}
```

(`enforceRateLimit` stays imported: five other actions of the file use it.)

- [ ] **Step 4: A home is a town, never a region or a country**

In `src/features/compas/engine/places.ts`, replace:

```ts
export function isDeparturePlace(place: CompasPlace): boolean {
  return Boolean(place.settlement) || ADMIN_KINDS.has(place.kind) || BROAD.has(place.kind);
}
```

with:

```ts
export function isDeparturePlace(place: CompasPlace): boolean {
  return Boolean(place.settlement) || ADMIN_KINDS.has(place.kind) || BROAD.has(place.kind);
}

/**
 * Un domicile (profil voyageur, PLAN-100 4.1) : un lieu d'où l'on part
 * (`isDeparturePlace`) qui soit une ville ou un village, jamais une région, une
 * province ni un pays (le trajet serait chiffré depuis leur centre).
 */
export function isHomePlace(place: CompasPlace): boolean {
  return isDeparturePlace(place) && !BROAD.has(place.kind) && place.kind !== 'province';
}
```

- [ ] **Step 5: The actions**

Create `src/features/compas/server/travellerActions.ts`:

```ts
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/observability/appErrors';
import { coarsePosition } from '../engine/privacy';
import { isHomePlace, samePlaceName } from '../engine/places';
import { cleanTravellerFields, isCountryCode, travellerView, type TravellerHome, type TravellerView } from '../engine/traveller';
import { placeSearchLimitError, resolvePlaceByName } from './placeSearch';
import { markTravellerAsked, readTravellerState, writeTraveller } from './traveller';

/**
 * Profil voyageur (PLAN-100 4.1) : enregistré par la personne elle-même, jamais
 * exigé, jamais pour un essai sans compte. Le domicile est retrouvé sur la carte
 * UNE fois, ici (même recherche et même limite que le départ « depuis Lyon »), puis
 * rangé arrondi à 0,01° : aucune préparation ne le recherche. Rien de la saisie
 * n'entre dans un journal ni dans `app_errors` (messages fixes).
 */

export type TravellerSaveResult = { success: true; view: TravellerView } | { success: false; error: string };

const text = (max: number) => z.string().max(max).nullable().optional();
const travellerSchema = z.object({
  nationality: text(8),
  residenceCountry: text(8),
  currency: text(8),
  language: text(35),
  timeZone: text(64),
  /** Ville tapée ; 80 caractères au plus une fois nettoyée (`cleanTravellerFields`). */
  home: text(120),
});

const INVALID = 'Profil invalide';

/** Une panne n'est jamais rapportée avec son message (il peut contenir le domicile tapé). */
const quiet = (err: unknown) => new Error(err instanceof Error ? err.name : 'erreur');

export async function saveTravellerAction(input: z.input<typeof travellerSchema>): Promise<TravellerSaveResult> {
  const parsed = travellerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: INVALID };
  const fields = cleanTravellerFields(parsed.data);
  if (!fields) return { success: false, error: INVALID };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour enregistrer ton profil voyageur.' };
    if (user.is_anonymous === true)
      return { success: false, error: 'Crée ton compte pour enregistrer ton profil voyageur.' };
    let home: TravellerHome | null = null;
    if (fields.home) {
      const kept = (await readTravellerState(supabase, user.id)).traveller.home;
      if (kept && samePlaceName(kept.name, fields.home)) home = kept;
      else {
        const limitError = await placeSearchLimitError(user.id);
        if (limitError) return { success: false, error: limitError };
        const found = await resolvePlaceByName(fields.home);
        if (!found) return { success: false, error: `« ${fields.home} » introuvable sur la carte.` };
        if (!isHomePlace(found))
          return { success: false, error: `« ${fields.home} » n’est pas une ville ou un village : écris ta commune (« Lyon »).` };
        const at = coarsePosition({ lat: found.lat, lon: found.lon });
        if (!at) return { success: false, error: INVALID };
        home = {
          name: found.name.slice(0, 80),
          lat: at.lat,
          lon: at.lon,
          countryCode: isCountryCode(found.countryCode) ? found.countryCode : null,
        };
      }
    }
    if (!(await writeTraveller(supabase, user.id, fields, home)))
      return { success: false, error: 'Impossible d’enregistrer ton profil voyageur.' };
    return { success: true, view: travellerView({ ...fields, home }) };
  } catch (err) {
    await reportServerError('compas.saveTravellerAction', quiet(err));
    return { success: false, error: 'Erreur serveur' };
  }
}

/** « Passer » : la réponse est rangée (une ligne vide), la question n'est plus posée. */
export async function skipTravellerAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous === true) return { success: false };
    return { success: await markTravellerAsked(supabase, user.id) };
  } catch (err) {
    await reportServerError('compas.skipTravellerAction', quiet(err));
    return { success: false };
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass, and the neighbours stay green**

Run: `npx vitest run src/features/compas/__tests__/travellerActions.test.ts src/features/compas/__tests__/originAction.test.ts src/features/compas/__tests__/originInterpret.test.ts src/features/compas/__tests__/limitBypass.test.ts`
Expected: PASS (4 files; the destination/origin limit `compas-destination` 20 / 600 000 / `closed` and its messages unchanged).

Run: `npx tsc --noEmit -p .`
Expected: no error.

Run: `node scripts/verify/traveller_privacy.mjs`
Expected: `✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).`

- [ ] **Step 7: Commit**

```bash
git add src/features/compas/server/placeSearch.ts src/features/compas/server/compasActions.ts src/features/compas/engine/places.ts src/features/compas/server/travellerActions.ts src/features/compas/__tests__/travellerActions.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): enregistrer le profil voyageur, domicile retrouvé une fois

Actions serveur (zod, session, essai sans compte refusé) ; le domicile est cherché
sur la carte à l'enregistrement seulement, avec la limite des lieux
(compas-destination), refusé s'il n'est pas une ville ou un village, rangé à
0,01° ; même nom qu'avant : ni recherche ni comptage. « Passer » range une ligne
vide sans jamais effacer un profil. Aucune saisie dans un journal. La recherche
de lieux et sa limite passent dans server/placeSearch.ts (inchangées).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 5: Demandé une fois, modifiable dans `/compte` (carte « Passer », page profil)

**Files:**
- Create: `src/components/identity/TravellerCard.tsx`
- Create: `src/app/compte/voyageur/page.tsx`
- Modify: `src/app/compas/page.tsx` (imports, `start()`)
- Modify: `src/features/compas/components/CompasStart.tsx` (imports, props, end of `.cp-top`)
- Modify: `src/components/compte/ParametresCompteCard.tsx` (imports, Langue & Région state/load/save/export, toast, Profil section, Devise and Fuseau fields)
- Modify: `src/components/compte/MobileCompteV2.tsx` (sheet « Paramètres & Navigation », ~line 1136)
- Create: `src/features/compas/__tests__/travellerCard.test.tsx`

**Interfaces:**
- Consumes (Task 2): `countryOptions`, `currencyOptions`, `languageOptions`, `timeZoneOptions`, `TravellerOption`, `TravellerView`, `travellerView` (`engine/traveller.ts`); `readTravellerState` (`server/traveller.ts`). (Task 4): `saveTravellerAction`, `skipTravellerAction`.
- Produces:
  - `src/components/identity/TravellerCard.tsx`: `export default function TravellerCard(props: { mode?: 'collect' | 'edit'; initial?: TravellerView | null; onDone?: () => void; className?: string })`. `collect`: Nationalité + Ville de domicile, « Passer » always visible, the card renders nothing after a successful « Enregistrer » or after « Passer ». `edit`: the six fields, no « Passer », status `Profil voyageur enregistré.` after saving.
  - `CompasStart` prop `askTraveller?: boolean` (default `false`).
  - Route `/compte/voyageur` (server page, `dynamic = 'force-dynamic'`).

- [ ] **Step 1: Write the failing card tests**

Create `src/features/compas/__tests__/travellerCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  saveTravellerAction: vi.fn(),
  skipTravellerAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/travellerActions', () => actions);

import TravellerCard from '@/components/identity/TravellerCard';

const SAVED = { nationality: 'FR', residenceCountry: null, currency: null, language: null, timeZone: null, homeName: 'Lyon' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('profil voyageur demandé une fois (Compas vide)', () => {
  it('nationalité et domicile seulement, « Passer » toujours visible', () => {
    render(<TravellerCard mode="collect" />);
    expect(screen.getByRole('heading', { name: 'Pour des conseils justes' })).toBeTruthy();
    expect(screen.getByLabelText('Nationalité')).toBeTruthy();
    expect(screen.getByLabelText('Ville de domicile')).toBeTruthy();
    expect(screen.queryByLabelText('Devise')).toBeNull();
    expect(screen.queryByLabelText('Pays de résidence')).toBeNull();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeTruthy();
  });

  it('« Enregistrer » envoie tout le profil, puis la carte se retire', async () => {
    actions.saveTravellerAction.mockResolvedValueOnce({ success: true, view: SAVED });
    const onDone = vi.fn();
    const { container } = render(<TravellerCard mode="collect" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Nationalité'), { target: { value: 'FR' } });
    fireEvent.change(screen.getByLabelText('Ville de domicile'), { target: { value: ' Lyon ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(actions.saveTravellerAction).toHaveBeenCalledWith({
      nationality: 'FR',
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: 'Lyon',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('« Passer » range la réponse et la carte se retire, sans rien enregistrer d’autre', async () => {
    const onDone = vi.fn();
    const { container } = render(<TravellerCard mode="collect" onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(actions.skipTravellerAction).toHaveBeenCalledTimes(1);
    expect(actions.saveTravellerAction).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('un refus est dit ; la carte reste, « Passer » aussi', async () => {
    actions.saveTravellerAction.mockResolvedValueOnce({ success: false, error: '« Atlantide » introuvable sur la carte.' });
    const onDone = vi.fn();
    render(<TravellerCard mode="collect" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Ville de domicile'), { target: { value: 'Atlantide' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect((await screen.findByRole('alert')).textContent).toBe('« Atlantide » introuvable sur la carte.');
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeTruthy();
  });
});

describe('profil voyageur dans /compte', () => {
  it('tout le profil, prérempli, sans « Passer »', () => {
    render(
      <TravellerCard
        mode="edit"
        initial={{ nationality: 'FR', residenceCountry: 'CH', currency: 'CHF', language: 'fr', timeZone: 'Europe/Zurich', homeName: 'Genève' }}
      />
    );
    expect(screen.getByRole('heading', { name: 'Ce que le Compas sait de toi' })).toBeTruthy();
    expect((screen.getByLabelText('Nationalité') as HTMLSelectElement).value).toBe('FR');
    expect((screen.getByLabelText('Pays de résidence') as HTMLSelectElement).value).toBe('CH');
    expect((screen.getByLabelText('Devise') as HTMLSelectElement).value).toBe('CHF');
    expect((screen.getByLabelText('Langue') as HTMLSelectElement).value).toBe('fr');
    expect((screen.getByLabelText('Fuseau horaire') as HTMLSelectElement).value).toBe('Europe/Zurich');
    expect((screen.getByLabelText('Ville de domicile') as HTMLInputElement).value).toBe('Genève');
    expect(screen.queryByRole('button', { name: 'Passer' })).toBeNull();
  });

  it('enregistré : la carte le dit et reste ouverte', async () => {
    actions.saveTravellerAction.mockResolvedValueOnce({ success: true, view: SAVED });
    render(<TravellerCard mode="edit" initial={SAVED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    // (le bouton en attente montre aussi un indicateur `status` : on cherche le texte)
    expect((await screen.findByText('Profil voyageur enregistré.')).getAttribute('role')).toBe('status');
    expect(screen.getByLabelText('Nationalité')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/travellerCard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/identity/TravellerCard"`.

- [ ] **Step 3: The card**

Create `src/components/identity/TravellerCard.tsx`:

```tsx
'use client';

/**
 * PROFIL VOYAGEUR — d'où tu viens, où tu vis (PLAN-100 4.1, lot P)
 * =================================================================
 * Facultatif de bout en bout : rien dans le Compas n'attend ce profil, et sans
 * lui le Compas n'affirme rien qui dépende de la nationalité.
 *  - `collect` : demandé UNE fois, dans le Compas vide ; nationalité et domicile
 *    seulement ; « Passer » toujours visible (la réponse est rangée, la question
 *    n'est plus posée) ; la carte se retire après « Enregistrer » ou « Passer ».
 *  - `edit` : tout le profil, depuis /compte/voyageur.
 * Privé : écrit par une action serveur pour la personne seule, montré à elle seule,
 * sans coordonnées. Styles en ligne sur les jetons `--lkv-*` (aucune classe
 * utilitaire) : la même carte vit dans le Compas et dans /compte.
 */

import { useId, useMemo, useState, useTransition, type ChangeEvent, type CSSProperties } from 'react';
import { Button } from '@/components/ui';
import {
  countryOptions,
  currencyOptions,
  languageOptions,
  timeZoneOptions,
  type TravellerOption,
  type TravellerView,
} from '@/features/compas/engine/traveller';
import { saveTravellerAction, skipTravellerAction } from '@/features/compas/server/travellerActions';

const EMPTY: TravellerView = {
  nationality: null,
  residenceCountry: null,
  currency: null,
  language: null,
  timeZone: null,
  homeName: null,
};

const FIELD: CSSProperties = {
  width: '100%',
  minHeight: 'var(--lkv-touch-min)',
  borderRadius: 'var(--lkv-radius-control)',
  border: '1px solid var(--lkv-field-border)',
  background: 'var(--lkv-field-bg)',
  color: 'var(--lkv-text-primary)',
  padding: '10px var(--space-3)',
  fontSize: 16,
};
const LABEL: CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontSize: 'var(--lkv-text-caption)',
  fontWeight: 600,
  color: 'var(--lkv-text-primary)',
};
const MUTED: CSSProperties = { margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-muted)' };

type SelectKey = 'nationality' | 'residenceCountry' | 'currency' | 'language' | 'timeZone';

export interface TravellerCardProps {
  mode?: 'collect' | 'edit';
  /** Profil déjà rangé (page /compte/voyageur) ; rien pour la question posée une fois. */
  initial?: TravellerView | null;
  /** Après « Enregistrer » réussi ou « Passer ». */
  onDone?: () => void;
  /** Classes du cadre, données par l'écran hôte (`cp-card` dans le Compas). */
  className?: string;
}

export default function TravellerCard({ mode = 'collect', initial = null, onDone, className }: TravellerCardProps) {
  const id = useId();
  const edit = mode === 'edit';
  const [view, setView] = useState<TravellerView>(initial ?? EMPTY);
  const [home, setHome] = useState(initial?.homeName ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const countries = useMemo(() => countryOptions(), []);
  const currencies = useMemo(() => (edit ? currencyOptions() : []), [edit]);
  const languages = useMemo(() => (edit ? languageOptions(view.language) : []), [edit, view.language]);
  const zones = useMemo(() => (edit ? timeZoneOptions(view.timeZone) : []), [edit, view.timeZone]);

  if (done) return null;

  const choose = (key: SelectKey) => (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setView((v) => ({ ...v, [key]: value }));
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(null);
      const res = await saveTravellerAction({
        nationality: view.nationality,
        residenceCountry: view.residenceCountry,
        currency: view.currency,
        language: view.language,
        timeZone: view.timeZone,
        home: home.trim() || null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setView(res.view);
      setHome(res.view.homeName ?? '');
      onDone?.();
      if (edit) setSaved('Profil voyageur enregistré.');
      else setDone(true);
    });

  // « Passer » : rangé côté serveur ; un échec ne bloque rien, la carte se retire.
  const skip = () =>
    startTransition(async () => {
      await skipTravellerAction().catch(() => null);
      onDone?.();
      setDone(true);
    });

  const select = (key: SelectKey, label: string, empty: string, options: TravellerOption[]) => (
    <div>
      <label htmlFor={`${id}-${key}`} style={LABEL}>
        {label}
      </label>
      <select id={`${id}-${key}`} style={FIELD} value={view[key] ?? ''} onChange={choose(key)} disabled={pending}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className={className} aria-labelledby={`${id}-title`}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div>
          <h2
            id={`${id}-title`}
            style={{ margin: 0, fontSize: 'var(--lkv-text-body-sm)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}
          >
            {edit ? 'Ce que le Compas sait de toi' : 'Pour des conseils justes'}
          </h2>
          <p style={MUTED}>
            {edit
              ? 'Privé : toi seul·e le vois. Sans réponse, le Compas n’affirme rien qui dépende de ta nationalité.'
              : 'Ta nationalité règle les papiers, ton domicile chiffre le trajet. Privé, jamais montré aux autres ; tu peux passer.'}
          </p>
        </div>
        {select('nationality', 'Nationalité', 'Non renseignée', countries)}
        {edit && select('residenceCountry', 'Pays de résidence', 'Non renseigné', countries)}
        <div>
          <label htmlFor={`${id}-home`} style={LABEL}>
            Ville de domicile
          </label>
          <input
            id={`${id}-home`}
            style={FIELD}
            value={home}
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Lyon"
            disabled={pending}
            onChange={(e) => setHome(e.target.value)}
          />
          <p style={{ ...MUTED, marginTop: 'var(--space-1)' }}>Retrouvée une fois sur la carte, gardée à 1 km près.</p>
        </div>
        {edit && select('currency', 'Devise', 'Non renseignée', currencies)}
        {edit && select('language', 'Langue', 'Non renseignée', languages)}
        {edit && select('timeZone', 'Fuseau horaire', 'Non renseigné', zones)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button type="button" loading={pending} onClick={save}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {!edit && (
            <Button type="button" variant="secondary" disabled={pending} onClick={skip}>
              Passer
            </Button>
          )}
        </div>
        {saved && (
          <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-primary)' }}>
            {saved}
          </p>
        )}
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-danger-dark)' }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the card tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/travellerCard.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: The profile page `/compte/voyageur`**

Create `src/app/compte/voyageur/page.tsx` (one responsive layout: `AppShell` handles the safe areas and the bottom bar, inline styles on `--lkv-*` tokens):

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { Card } from '@/components/ui';
import TravellerCard from '@/components/identity/TravellerCard';
import { createClient } from '@/lib/supabase/server';
import { travellerView } from '@/features/compas/engine/traveller';
import { readTravellerState } from '@/features/compas/server/traveller';

/**
 * Profil voyageur (PLAN-100 4.1) : nationalité, pays de résidence, devise, langue,
 * fuseau, domicile. Privé (la personne seule), facultatif ; lu ici côté serveur et
 * rendu à la seule personne concernée, sans coordonnées. Un essai sans compte n'en
 * a pas. Une seule mise en page (AppShell gère les zones sûres et la navigation).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profil voyageur',
  robots: { index: false, follow: false },
};

export default async function TravellerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent('/compte/voyageur')}`);
  const trial = user.is_anonymous === true;
  const view = trial ? null : travellerView((await readTravellerState(supabase, user.id)).traveller);

  return (
    <AppShell hasBottomNav videoBackground={false}>
      <main
        style={{
          width: '100%',
          maxWidth: 640,
          margin: '0 auto',
          padding: 'var(--space-4) 16px',
          boxSizing: 'border-box',
          display: 'grid',
          gap: 'var(--space-4)',
        }}
      >
        <Link
          href="/compte"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--lkv-touch-min)',
            fontSize: 'var(--lkv-text-caption)',
            color: 'var(--lkv-text-muted)',
          }}
        >
          ← Mon compte
        </Link>
        <h1 style={{ margin: 0, fontSize: 'var(--lkv-text-title-md)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
          Profil voyageur
        </h1>
        <Card variant="featured" style={{ padding: 'var(--space-4)' }}>
          {view ? (
            <TravellerCard mode="edit" initial={view} />
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--lkv-text-body-sm)', color: 'var(--lkv-text-primary)' }}>
              Crée ton compte pour garder un profil voyageur : un essai sans compte ne garde rien.
            </p>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 6: Asked once in the empty Compas**

In `src/app/compas/page.tsx`, replace:

```tsx
import { listMyTripInvitations } from '@/features/compas/server/invitationActions';
```

with:

```tsx
import { listMyTripInvitations } from '@/features/compas/server/invitationActions';
import { readTravellerState } from '@/features/compas/server/traveller';
```

and replace:

```tsx
    const invitations = user ? await listMyTripInvitations() : [];
    return (
      <AppShell hasBottomNav videoBackground={false}>
        <CompasLightTheme />
        <CompasStart signedIn={Boolean(user)} invitations={invitations} />
      </AppShell>
    );
```

with:

```tsx
    const invitations = user ? await listMyTripInvitations() : [];
    // Profil voyageur demandé une fois (PLAN-100 4.1) : jamais à un essai sans compte.
    const traveller = user && user.is_anonymous !== true ? await readTravellerState(supabase, user.id) : null;
    return (
      <AppShell hasBottomNav videoBackground={false}>
        <CompasLightTheme />
        <CompasStart
          signedIn={Boolean(user)}
          invitations={invitations}
          askTraveller={traveller != null && !traveller.asked}
        />
      </AppShell>
    );
```

In `src/features/compas/components/CompasStart.tsx`, replace:

```tsx
import { ACTIVITY_FIRST, ACTIVITY_META, ACTIVITY_ORDER } from './CompasOuFlows';
```

with:

```tsx
import { ACTIVITY_FIRST, ACTIVITY_META, ACTIVITY_ORDER } from './CompasOuFlows';
import TravellerCard from '@/components/identity/TravellerCard';
```

replace:

```tsx
export function CompasStart({
  signedIn,
  invitations = [],
}: {
  signedIn: boolean;
  /** Invitations reçues : on peut rejoindre un voyage au lieu d'en créer un. */
  invitations?: TripInvitationView[];
}) {
```

with:

```tsx
export function CompasStart({
  signedIn,
  invitations = [],
  askTraveller = false,
}: {
  signedIn: boolean;
  /** Invitations reçues : on peut rejoindre un voyage au lieu d'en créer un. */
  invitations?: TripInvitationView[];
  /** Profil voyageur jamais demandé (compte réel) : la question est posée une fois, « Passer » visible. */
  askTraveller?: boolean;
}) {
```

and replace:

```tsx
          {!signedIn && (
            <p className="cp-note">
              <Link href={`/connexion?next=${encodeURIComponent('/compas')}`}>Connecte-toi</Link>{' '}
              pour enregistrer ton aventure.
            </p>
          )}
        </section>
      </div>
```

with:

```tsx
          {!signedIn && (
            <p className="cp-note">
              <Link href={`/connexion?next=${encodeURIComponent('/compas')}`}>Connecte-toi</Link>{' '}
              pour enregistrer ton aventure.
            </p>
          )}
        </section>

        {askTraveller && <TravellerCard mode="collect" className="cp-card cp-sheet-glass" />}
      </div>
```

- [ ] **Step 7: `/compte` — one place for currency and time zone, a true toast, the links**

In `src/components/compte/ParametresCompteCard.tsx` (desktop settings; Tailwind as the rest of the file), make these seven replacements.

Replace:

```tsx
import Image from 'next/image';
```

with:

```tsx
import Image from 'next/image';
import Link from 'next/link';
```

Delete these two lines (Langue & Région state):

```tsx
  const [currency, setCurrency] = useState('EUR');
  const [timezone, setTimezone] = useState('Europe/Paris');
```

Delete these two lines (reading `localStorage`):

```tsx
        if (parsed.currency) setCurrency(parsed.currency);
        if (parsed.timezone) setTimezone(parsed.timezone);
```

In `handleSaveAll`, replace:

```tsx
      unitSystem,
      currency,
      timezone,
      firstDayOfWeek,
```

with:

```tsx
      unitSystem,
      firstDayOfWeek,
```

In `handleExportData`, replace:

```tsx
        locale: { language, unitSystem, currency, timezone, firstDayOfWeek },
```

with:

```tsx
        locale: { language, unitSystem, firstDayOfWeek },
```

Replace the toast:

```tsx
      if (onSave) onSave('Tous vos réglages ont été enregistrés et sauvegardés en base !');
```

with:

```tsx
      // Ces réglages restent dans ce navigateur (rien n'est en base) : dit tel quel.
      if (onSave) onSave('Réglages enregistrés sur cet appareil.');
```

In the Profil section, replace:

```tsx
              {/* Ta pratique (orientation) — modifiable depuis /compte (ADR-010, Lot B) */}
              <OrientationCard mode="edit" />
```

with:

```tsx
              {/* Ta pratique (orientation) — modifiable depuis /compte (ADR-010, Lot B) */}
              <OrientationCard mode="edit" />

              {/* Profil voyageur (PLAN-100 4.1) : sa page, lue par le Compas. */}
              <Link
                href="/compte/voyageur"
                className="flex min-h-[var(--lkv-touch-min)] items-center justify-between gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-4)] text-[color:var(--lkv-text-primary)]"
              >
                <span>
                  <span className="block text-[length:var(--lkv-text-body-sm)] font-semibold">Profil voyageur</span>
                  <span className="block text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                    Nationalité, domicile, devise, fuseau : privé, lu par le Compas.
                  </span>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
```

Finally, in the « Units & Currency » grid, replace the whole « Devise » block and the whole « Fuseau horaire » block — i.e. everything from the line `                <div>` that is immediately followed by `<label … >Devise</label>` up to (not including) the `                <div>` whose label is `Premier jour de la semaine` — with:

```tsx
                <div>
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Devise et fuseau</span>
                  <Link
                    href="/compte/voyageur"
                    className="inline-flex min-h-[var(--lkv-touch-min)] items-center text-[color:var(--lkv-text-primary)] underline"
                  >
                    Dans ton profil voyageur
                  </Link>
                </div>

```

(The removed span is exactly the two `<div>…</div>` blocks holding `<select value={currency}` with the options EUR/USD/CHF/GBP and `<select value={timezone}` with Europe/Paris, Europe/London, America/New_York.)

Run: `grep -n "currency\|timezone\|setCurrency\|setTimezone\|sauvegardés en base" src/components/compte/ParametresCompteCard.tsx`
Expected: no output.

In `src/components/compte/MobileCompteV2.tsx` (phone: the sheet « Paramètres & Navigation »), replace:

```tsx
            { label: 'Modifier mon profil', icon: '👤', href: '/compte/modifier' },
```

with:

```tsx
            { label: 'Modifier mon profil', icon: '👤', href: '/compte/modifier' },
            { label: 'Profil voyageur (nationalité, domicile)', icon: '🧭', href: '/compte/voyageur' },
```

- [ ] **Step 8: Run the checks**

Run: `npx vitest run src/features/compas/__tests__/travellerCard.test.tsx src/features/compas/__tests__/travellerPrivacy.test.ts`
Expected: PASS (2 files).

Run: `npx tsc --noEmit -p .`
Expected: no error.

Run: `node scripts/verify/traveller_privacy.mjs && node scripts/verify/identity_compliance.mjs | tail -1`
Expected: `✓ VIE PRIVÉE : …` then `✓ ANTI-DÉRIVE : toutes les contraintes durables sont respectées.` (the card lives in `src/components/identity`: no hex, no default Tailwind colour).

Run: `npx eslint src/components/identity/TravellerCard.tsx src/app/compte/voyageur/page.tsx src/app/compas/page.tsx src/features/compas/components/CompasStart.tsx src/components/compte/ParametresCompteCard.tsx src/components/compte/MobileCompteV2.tsx src/features/compas/__tests__/travellerCard.test.tsx`
Expected: no error; only the warnings these two `compte` files already had before the change (`following`, `currentPassword`, `react/no-unescaped-entities`).

- [ ] **Step 9: Commit**

```bash
git add src/components/identity/TravellerCard.tsx src/app/compte/voyageur/page.tsx src/app/compas/page.tsx src/features/compas/components/CompasStart.tsx src/components/compte/ParametresCompteCard.tsx src/components/compte/MobileCompteV2.tsx src/features/compas/__tests__/travellerCard.test.tsx
git commit -m "$(cat <<'MSG'
feat(compas): profil voyageur demandé une fois, modifiable dans /compte

Carte « Pour des conseils justes » dans le Compas vide (nationalité, domicile,
« Passer » toujours visible, jamais à un essai sans compte) ; page
/compte/voyageur pour le bureau et le téléphone (lien dans Paramètres et dans le
menu mobile). Devise et fuseau ne sont plus des champs locaux de /compte, et le
message « sauvegardés en base » (faux) devient « Réglages enregistrés sur cet
appareil. ».

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 6: Le domicile comme départ (dit > domicile > position > aucun)

**Files:**
- Modify: `src/features/compas/engine/travel.ts` (header comment, `TravelOrigin.source`, constants after `GPS_DEPARTURE`, `travelOrigin`, `originFact`, `departureOf`, `planTravelLeg`)
- Modify: `src/features/compas/server/autofillActions.ts` (imports ~line 59; `today` ~line 841; `Promise.all` ~line 863; step « 5. Venir » ~line 1564)
- Create: `src/features/compas/__tests__/travelHome.test.ts`

**Interfaces:**
- Consumes (Task 2): `readTraveller(supabase, userId)` → `TravellerContext` (`.home`, `.timeZone`); `travellerToday(timeZone, now, profileZone)`. Existing: `requireEditor` returns `anonymous` (`server/compasServer.ts`).
- Produces:
  - `engine/travel.ts`: `TravelOrigin.source: 'dit' | 'domicile' | 'gps'`; `travelOrigin(said, gps, home: { name: string; lat: number; lon: number; countryCode: string | null } | null = null)` (precedence said > home > gps); `export const HOME_ORIGIN_NOTE`; `originFact` returns `'domicile de la personne (ville non transmise)'` for a home; the persisted departure for a home is `'ton domicile'`; `planTravelLeg` pushes `HOME_ORIGIN_NOTE` once when the origin is the home and a transport is priced.
  - `server/autofillActions.ts`: a local `traveller: TravellerContext` read in `compasAutofillAction` (used again by Task 7), `today` computed after it.

- [ ] **Step 1: Write the failing tests**

Create `src/features/compas/__tests__/travelHome.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import {
  HOME_ORIGIN_NOTE,
  originFact,
  planTravelLeg,
  travelDigest,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
} from '../engine/travel';

/**
 * Domicile du profil voyageur (PLAN-100 4.3, lot P) : départ après le départ dit,
 * avant la position ; « ton domicile » dans ce qui est rangé sur le voyage, jamais
 * le nom ; rien pour l'IA.
 */
const ROWS: AirportRow[] = [
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
];
/** Un domicile au nom distinct de tout aéroport, pour vérifier qu'il ne sort jamais. */
const HOME = { name: 'Villeurbanne', lat: 45.76, lon: 4.84, countryCode: 'FR' };
const SAID = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR' };
const GPS = { lat: 48.86, lon: 2.35, name: 'Paris', country: 'France', countryCode: 'FR' };
const VERCORS = { lat: 45.07, lon: 5.55 };
const SARDAIGNE = { lat: 40.08, lon: 9.03 };

const deps = (car: CarRouteResult): TravelDeps => ({
  carRoute: async () => car,
  walkKm: async () => 0,
  airport: (p, country) => nearestAirportIn(ROWS, p.lat, p.lon, { country }),
});
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(null, GPS, HOME),
  target: VERCORS,
  destination: { name: 'Vercors', countryCode: 'FR' },
  days: 3,
  party: 2,
  transport: true,
  ...over,
});
const leaks = (value: unknown) => JSON.stringify(value).includes('Villeurbanne');

describe('d’où l’on part : dit, puis domicile, puis position', () => {
  it('le départ dit passe avant le domicile, le domicile avant la position', () => {
    expect(travelOrigin(SAID, GPS, HOME)).toMatchObject({ name: 'Grenoble', source: 'dit' });
    expect(travelOrigin(null, GPS, HOME)).toEqual({
      name: 'Villeurbanne',
      country: null,
      countryCode: 'FR',
      lat: 45.76,
      lon: 4.84,
      source: 'domicile',
    });
    expect(travelOrigin(null, GPS, null)).toMatchObject({ name: 'Paris', source: 'gps' });
    expect(travelOrigin(null, GPS)).toMatchObject({ source: 'gps' });
    expect(travelOrigin(null, null, null)).toBeNull();
  });

  it('pour l’IA, le domicile n’a pas de nom', () => {
    const fact = originFact(travelOrigin(null, null, HOME));
    expect(fact).toBe('domicile de la personne (ville non transmise)');
    expect(fact).not.toContain('Villeurbanne');
  });
});

describe('le trajet depuis le domicile', () => {
  it('route : « (depuis ton domicile) », une note, jamais le nom', async () => {
    const leg = await planTravelLeg(input({}), deps({ km: 110, minutes: 95, end: VERCORS }));
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 110, departure: 'ton domicile' });
    expect(leg.abroad).toBe(false);
    expect(leg.notes).toEqual([HOME_ORIGIN_NOTE]);
    expect(travelDigest(leg.transport)).toBe('110 km de route (depuis ton domicile)');
    expect(leaks([leg.transport, leg.notes, leg.flight])).toBe(false);
  });

  it('avion : d’aéroport à aéroport depuis « ton domicile », à l’étranger', async () => {
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } }),
      deps({ km: 1100, minutes: 840, end: null })
    );
    expect(leg.abroad).toBe(true);
    expect(leg.transport).toMatchObject({ mode: 'avion', route: 'LYS → CAG', departure: 'ton domicile' });
    expect(leg.transport?.basis).toBe(
      'vol aller-retour depuis ton domicile, LYS → CAG (Lyon Saint-Exupéry Airport → Cagliari Elmas Airport), environ 790 km'
    );
    expect(travelDigest(leg.transport)).toBe('vol LYS → CAG à prévoir (depuis ton domicile)');
    expect(leaks([leg.transport, leg.notes, leg.flight])).toBe(false);
  });

  it('un départ dit l’emporte : ni note de domicile, ni « ton domicile »', async () => {
    const leg = await planTravelLeg(
      input({ origin: travelOrigin(SAID, GPS, HOME) }),
      deps({ km: 60, minutes: 55, end: VERCORS })
    );
    expect(leg.transport).toMatchObject({ departure: 'Grenoble' });
    expect(leg.notes).not.toContain(HOME_ORIGIN_NOTE);
  });

  it('rien de chiffré (sortie de quelques heures) : pas de note de domicile', async () => {
    const leg = await planTravelLeg(input({ transport: false, days: 1 }), deps({ km: 110, minutes: 95, end: VERCORS }));
    expect(leg.transport).toBeNull();
    expect(leg.notes).not.toContain(HOME_ORIGIN_NOTE);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/travelHome.test.ts`
Expected: FAIL — `HOME_ORIGIN_NOTE` is not exported, and `travelOrigin(null, GPS, HOME)` returns the GPS origin.

- [ ] **Step 3: The home in the travel planner**

In `src/features/compas/engine/travel.ts`, replace:

```ts
 * D'où l'on part : le lieu dit (« depuis Lyon »), sinon la position de
 * l'appareil ; sinon personne ne le sait et rien n'est chiffré, l'écran le
 * dit. Jamais la France ni Paris par défaut. Puis la route mesurée si elle
```

with:

```ts
 * D'où l'on part : le lieu dit (« depuis Lyon »), sinon le domicile du profil
 * voyageur, sinon la position de l'appareil ; sinon personne ne le sait et rien
 * n'est chiffré, l'écran le dit. Jamais la France ni Paris par défaut. Le nom du
 * domicile ne quitte jamais ce module : « ton domicile » dans ce qui est rangé
 * sur le voyage (partagé), rien pour l'IA. Puis la route mesurée si elle
```

replace:

```ts
  /** « dit » (« depuis Lyon ») ou position de l'appareil. */
  source: 'dit' | 'gps';
```

with:

```ts
  /** « dit » (« depuis Lyon »), domicile du profil voyageur, ou position de l'appareil. */
  source: 'dit' | 'domicile' | 'gps';
```

replace:

```ts
/** Le départ quand il vient de l'appareil. */
const GPS_DEPARTURE = 'ta position';

/** Départ dit (`metadata.compas.origin`) d'abord, puis la position de l'appareil, sinon aucun. */
export function travelOrigin(
  said: { name: string; lat: number; lon: number; countryCode: string | null } | null,
  gps: (TravelPoint & { name: string | null; country: string | null; countryCode: string | null }) | null
): TravelOrigin | null {
  if (said)
    return { name: said.name, country: null, countryCode: said.countryCode, lat: said.lat, lon: said.lon, source: 'dit' };
  if (gps)
```

with:

```ts
/** Le départ quand il vient de l'appareil. */
const GPS_DEPARTURE = 'ta position';
/** Le départ quand il vient du profil : jamais le nom du domicile sur le voyage, qui se partage. */
const HOME_DEPARTURE = 'ton domicile';
/** Dit une fois quand le trajet part du domicile du profil. */
export const HOME_ORIGIN_NOTE =
  'Trajet chiffré depuis ton domicile (ton profil voyageur) : écris « depuis Lyon » dans ta demande pour partir d’ailleurs.';

/**
 * D'où l'on part : le départ dit (`metadata.compas.origin`), puis le domicile du
 * profil voyageur (déjà arrondi à 0,01°), puis la position de l'appareil ; sinon aucun.
 */
export function travelOrigin(
  said: { name: string; lat: number; lon: number; countryCode: string | null } | null,
  gps: (TravelPoint & { name: string | null; country: string | null; countryCode: string | null }) | null,
  home: { name: string; lat: number; lon: number; countryCode: string | null } | null = null
): TravelOrigin | null {
  if (said)
    return { name: said.name, country: null, countryCode: said.countryCode, lat: said.lat, lon: said.lon, source: 'dit' };
  if (home)
    return { name: home.name, country: null, countryCode: home.countryCode, lat: home.lat, lon: home.lon, source: 'domicile' };
  if (gps)
```

replace:

```ts
export function originFact(origin: TravelOrigin | null): string {
  if (!origin) return 'inconnu';
```

with:

```ts
export function originFact(origin: TravelOrigin | null): string {
  if (!origin) return 'inconnu';
  // Le domicile ne part jamais en clair vers l'IA (PLAN-100 4.1) : seul « à l'étranger » est dit à côté.
  if (origin.source === 'domicile') return 'domicile de la personne (ville non transmise)';
```

replace:

```ts
/** D'où le trajet est chiffré, pour l'écran : le lieu dit, sinon « ta position ». */
function departureOf(origin: TravelOrigin): string {
  return origin.source === 'dit' && origin.name ? origin.name : GPS_DEPARTURE;
}
```

with:

```ts
/** D'où le trajet est chiffré, pour l'écran : le lieu dit, « ton domicile », sinon « ta position ». */
function departureOf(origin: TravelOrigin): string {
  if (origin.source === 'domicile') return HOME_DEPARTURE;
  return origin.source === 'dit' && origin.name ? origin.name : GPS_DEPARTURE;
}
```

and replace:

```ts
export async function planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
  const leg = await chooseLeg(input, deps);
```

with:

```ts
export async function planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
  const leg = await chooseLeg(input, deps);
  // Départ pris au profil : dit une fois, sans le nom du domicile.
  if (input.origin?.source === 'domicile' && leg.transport) leg.notes.push(HOME_ORIGIN_NOTE);
```

- [ ] **Step 4: Run the planner tests to verify they pass**

Run: `npx vitest run src/features/compas/__tests__/travelHome.test.ts src/features/compas/__tests__/travel.test.ts src/features/compas/__tests__/dayTrip.test.ts`
Expected: PASS (3 files; `travel.test.ts` and `dayTrip.test.ts` unchanged — `travelOrigin` keeps working with two arguments).

- [ ] **Step 5: Read the context once in the preparation, use the home in « 5. Venir »**

In `src/features/compas/server/autofillActions.ts`, replace:

```ts
import { compasMeta, readProfile, requireEditor, resplitSteps, tripBasis, tripPartySize, updateTripMetadata, type Supa } from './compasServer';
```

with:

```ts
import { compasMeta, readProfile, requireEditor, resplitSteps, tripBasis, tripPartySize, updateTripMetadata, type Supa } from './compasServer';
import { readTraveller } from './traveller';
```

replace:

```ts
    const runId = resume?.runId ?? randomUUID();
    const today = travellerToday(timeZone);
    const startedAt = Date.now();
```

with:

```ts
    const runId = resume?.runId ?? randomUUID();
    const startedAt = Date.now();
```

replace:

```ts
    const [{ data: tripRow }, profile] = await Promise.all([
      supabase.from('trips').select('primary_activity, estimated_budget').eq('id', tripId).maybeSingle(),
      readProfile(supabase, userId),
    ]);
```

with:

```ts
    // Profil voyageur (PLAN-100 4.1) : la ligne de la personne qui lance, par la RLS ;
    // un essai sans compte n'en a pas (tout inconnu, sans requête).
    const [{ data: tripRow }, profile, traveller] = await Promise.all([
      supabase.from('trips').select('primary_activity, estimated_budget').eq('id', tripId).maybeSingle(),
      readProfile(supabase, userId),
      readTraveller(supabase, auth.anonymous ? null : userId),
    ]);
    // « Aujourd'hui » : le fuseau du navigateur (lot M) ; celui du profil seulement
    // quand le navigateur n'en envoie aucun de valable ; Paris en dernier.
    const today = travellerToday(timeZone, new Date(), traveller.timeZone);
```

(`today` is only used later, by `bestPeriod` and `expense_date`.)

and replace:

```ts
    /* 5. Venir : d'où l'on part (« depuis X » dit, sinon la position, jamais la
       France par défaut), puis la route mesurée, le train ou l'avion d'aéroport
       à aéroport (`engine/travel.ts`). Sans point de départ, rien n'est chiffré. */
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    // La commune, pas le lieu le plus proche du point (« depuis Chantier Hotel
    // de Ville » au lieu d'Annecy, 8 oct.) ; inutile quand le départ est dit.
    const near = !saidOrigin && from ? await lookupReverse(from.lat, from.lon) : null;
    const travelLeg = await planTravelLeg(
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
```

with:

```ts
    /* 5. Venir : d'où l'on part (« depuis X » dit, sinon le domicile du profil,
       sinon la position, jamais la France par défaut), puis la route mesurée, le
       train ou l'avion d'aéroport à aéroport (`engine/travel.ts`). Sans point de
       départ, rien n'est chiffré. */
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    // Domicile du profil (PLAN-100 4.3) : après le départ dit, avant la position ;
    // rangé à 0,01° au profil, jamais recherché ici.
    const home = saidOrigin ? null : traveller.home;
    // La commune, pas le lieu le plus proche du point (« depuis Chantier Hotel
    // de Ville » au lieu d'Annecy, 8 oct.) ; inutile quand le départ est dit ou le domicile connu.
    const near = !saidOrigin && !home && from ? await lookupReverse(from.lat, from.lon) : null;
    const travelLeg = await planTravelLeg(
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
            : null,
          home
        ),
```

- [ ] **Step 6: Run the checks**

Run: `npx vitest run src/features/compas src/lib/ai`
Expected: PASS (every file; the autofill harnesses have no traveller row: `memorySupabase` creates the table empty, and the `autofillLimits` fake answers `{ metadata, updated_at }`, which `travellerFromRow` reads as all unknown).

Run: `npx tsc --noEmit -p .`
Expected: no error.

Run: `grep -n "traveller\.home\|readTraveller(" src/features/compas/server/autofillActions.ts`
Expected: exactly two lines — `readTraveller(supabase, auth.anonymous ? null : userId),` and `const home = saidOrigin ? null : traveller.home;` (the anchor fallback blocks `if (!anchor && saidOrigin)` / `if (!anchor && from)` are untouched).

Run: `node scripts/verify/traveller_privacy.mjs`
Expected: `✓ VIE PRIVÉE : …`

- [ ] **Step 7: Commit**

```bash
git add src/features/compas/engine/travel.ts src/features/compas/server/autofillActions.ts src/features/compas/__tests__/travelHome.test.ts
git commit -m "$(cat <<'MSG'
feat(compas): le trajet part du domicile du profil, après le départ dit

Ordre : départ dit, domicile du profil, position, sinon rien de chiffré. Le nom
du domicile ne quitte jamais le serveur : « (depuis ton domicile) » et une note
sur le voyage, « domicile de la personne (ville non transmise) » pour l'IA ;
aucune recherche inverse de la position quand le domicile est connu. Le fuseau
du profil sert de repli à « aujourd'hui » quand le navigateur n'en envoie aucun.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

---

### Task 7: Rien de « voyageur français » sans nationalité connue ; PLAN-100 et ETAT

**Files:**
- Modify (full replacement): `src/features/compas/engine/papers.ts`
- Modify: `src/features/compas/engine/costs.ts` (two comments, ~lines 60 and 166)
- Modify: `src/features/compas/engine/travel.ts` (import; `abroadCosts`)
- Modify: `src/lib/ai/features/compasAutofill.ts` (stages rule 11; `buildCompasAutofillSystem`, rule 8a)
- Modify: `src/features/compas/server/autofillActions.ts` (import; AI system call ~line 1792; papers ~line 1803; formalities ~line 1840; « Formalités » basis ~line 1939)
- Modify (full replacement, FR cases kept word for word): `src/features/compas/__tests__/papers.test.ts`
- Modify: `src/features/compas/__tests__/travel.test.ts` (the `abroadCosts` test, ~line 539)
- Create: `src/features/compas/__tests__/nationalityPrompt.test.ts`
- Modify: `docs/compas/PLAN-100.md` (§4.1, §4.2, §4.3), `docs/compas/ETAT.md` (lot N line, new lot P line)

**Interfaces:**
- Consumes (Task 2): `TravellerContext`, `UNKNOWN_TRAVELLER`, `isFrenchNational`. (Task 6): the local `traveller` in `compasAutofillAction`; `abroad` from `travelLeg` (lot N).
- Produces:
  - `engine/papers.ts`: `type PapersKind = 'domestique' | 'carte' | 'passeport' | 'a_verifier' | 'sur_place'`; `interface TravelPapers { papers; euro: boolean | null; sameMoney: boolean | null; plugs: 'dit' | 'compatibles' | null; notes: string[] }` (`frenchPlugs` is gone — read nowhere else, grep-checked); `travelPapers(countryCode, countryName?, traveller: TravellerContext = UNKNOWN_TRAVELLER, abroad: boolean | null = null): TravelPapers`; `keepAiNote(note, rules)` (same signature).
  - `engine/travel.ts`: `abroadCosts(abroad: boolean | null, traveller: Pick<TravellerContext, 'nationality'>): { formalities: boolean; insurance: boolean }` (formalities only for `nationality === 'FR'`).
  - `src/lib/ai/features/compasAutofill.ts`: `buildCompasAutofillSystem(frenchNational = false): string`.

- [ ] **Step 1: Rewrite the papers tests (explicitly allowed: the French cases stay word for word, now with a French traveller; unknown and other nationalities are new)**

Replace the whole content of `src/features/compas/__tests__/papers.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { keepAiNote, travelPapers } from '../engine/papers';
import { UNKNOWN_TRAVELLER, type TravellerContext } from '../engine/traveller';

const who = (over: Partial<TravellerContext>): TravellerContext => ({ ...UNKNOWN_TRAVELLER, ...over });
const FR = who({ nationality: 'FR' });
const DE = who({ nationality: 'DE', residenceCountry: 'DE', currency: 'EUR' });
const US = who({ nationality: 'US', residenceCountry: 'US', currency: 'USD' });
const NONE = UNKNOWN_TRAVELLER;
const GENERIC = (where: string) =>
  `Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`;

describe('travelPapers — ressortissant français : les règles d’avant le profil, inchangées', () => {
  it('Portugal : carte d’identité, euro, prises européennes', () => {
    const p = travelPapers('PT', 'Portugal', FR);
    expect(p.papers).toBe('carte');
    expect(p.euro).toBe(true);
    expect(p.plugs).toBe('compatibles');
    expect(p.notes).toEqual(['Papiers : carte d’identité ou passeport en cours de validité, sans visa (Portugal).']);
  });

  it('France et outre-mer : rien à dire', () => {
    expect(travelPapers('FR', 'France', FR).notes).toEqual([]);
    expect(travelPapers('RE', 'La Réunion', FR).papers).toBe('domestique');
  });

  it('visa connu : passeport et formalité nommée', () => {
    expect(travelPapers('NP', 'Népal', FR).notes[0]).toBe(
      'Papiers : passeport + visa népalais (30 jours) + permis de trek TIMS, conditions à vérifier sur France Diplomatie avant de partir.'
    );
  });

  it('hors d’Europe sans formalité connue : passeport, à vérifier', () => {
    const p = travelPapers('PE', 'Pérou', FR);
    expect(p.papers).toBe('passeport');
    expect(p.notes[0]).toBe('Papiers : passeport (Pérou), conditions d’entrée à vérifier sur France Diplomatie avant de partir.');
  });

  it('Maroc : passeport même tout près', () => {
    expect(travelPapers('MA', 'Maroc', FR).papers).toBe('passeport');
  });

  it('Europe hors liste sûre (Turquie) : rien d’affirmé, à vérifier', () => {
    const p = travelPapers('TR', 'Turquie', FR);
    expect(p.papers).toBe('a_verifier');
    expect(p.notes[0]).toBe('Papiers : conditions d’entrée (Turquie) à vérifier sur France Diplomatie avant de partir.');
  });

  it('prises différentes : adaptateur annoncé (Royaume-Uni, Irlande, États-Unis)', () => {
    expect(travelPapers('GB', 'Royaume-Uni', FR).notes).toContain('Prises de type G : adaptateur à prévoir.');
    expect(travelPapers('IE', 'Irlande', FR).notes).toContain('Prises de type G : adaptateur à prévoir.');
    expect(travelPapers('US', 'États-Unis', FR).notes).toContain('Prises de type A/B : adaptateur à prévoir.');
    expect(travelPapers('IE', 'Irlande', FR).euro).toBe(true);
  });

  it('pays inconnu : rien d’affirmé', () => {
    expect(travelPapers(null, null, FR)).toMatchObject({ papers: null, euro: null, plugs: null, notes: [] });
  });
});

describe('travelPapers — nationalité inconnue : rien d’affirmé', () => {
  it('Népal : une ligne honnête, ni passeport, ni visa, ni France Diplomatie', () => {
    const p = travelPapers('NP', 'Népal', NONE);
    expect(p.papers).toBe('a_verifier');
    expect(p.notes).toEqual([GENERIC('Népal')]);
  });

  it('Portugal : aucune carte d’identité ni « sans visa » affirmés', () => {
    expect(travelPapers('PT', 'Portugal', NONE).notes).toEqual([GENERIC('Portugal')]);
  });

  it('France sans départ connu : la même ligne, jamais « rien à dire » supposé', () => {
    expect(travelPapers('FR', 'France', NONE).notes).toEqual([GENERIC('France')]);
  });

  it('départ déjà dans le pays : aucune frontière, rien à dire, et les papiers restent à la règle', () => {
    const p = travelPapers('FR', 'France', NONE, false);
    expect(p).toMatchObject({ papers: 'sur_place', notes: [] });
    expect(keepAiNote('Prends ta carte d’identité.', p)).toBe(false);
  });

  it('« France Diplomatie » n’apparaît jamais', () => {
    for (const cc of ['NP', 'PE', 'TR', 'MA', 'PT', 'US', 'FR'])
      expect(travelPapers(cc, cc, NONE).notes.join(' '), cc).not.toContain('France Diplomatie');
  });

  it('prises : le type du pays, un fait ; jamais « adaptateur à prévoir »', () => {
    const gb = travelPapers('GB', 'Royaume-Uni', NONE);
    expect(gb.notes).toContain('Prises de type G (Royaume-Uni) : vérifie que tes chargeurs s’y branchent.');
    expect(gb.notes.join(' ')).not.toContain('adaptateur');
    expect(travelPapers('PT', 'Portugal', NONE).plugs).toBeNull();
  });
});

describe('travelPapers — autre nationalité connue : aucune règle « ressortissant français »', () => {
  it('Allemand au Népal : la ligne générique', () => {
    expect(travelPapers('NP', 'Népal', DE).notes).toEqual([GENERIC('Népal')]);
  });

  it('dans son propre pays : rien à dire', () => {
    expect(travelPapers('DE', 'Allemagne', DE)).toMatchObject({ papers: 'domestique', notes: [], sameMoney: true });
  });

  it('nationalité américaine, résidence en France : l’adaptateur vers le Royaume-Uni est dit', () => {
    expect(travelPapers('GB', 'Royaume-Uni', who({ nationality: 'US', residenceCountry: 'FR' })).notes).toEqual([
      GENERIC('Royaume-Uni'),
      'Prises de type G : adaptateur à prévoir.',
    ]);
  });

  it('Française résidant au Royaume-Uni : papiers français, prises sans affirmation', () => {
    expect(travelPapers('IE', 'Irlande', who({ nationality: 'FR', residenceCountry: 'GB' })).notes).toEqual([
      'Papiers : carte d’identité ou passeport en cours de validité, sans visa (Irlande).',
      'Prises de type G (Irlande) : vérifie que tes chargeurs s’y branchent.',
    ]);
  });
});

describe('keepAiNote — l’IA ne double ni ne contredit une règle', () => {
  it('Portugal, Français : passeport, change et adaptateur écartés, le reste gardé', () => {
    const pt = travelPapers('PT', 'Portugal', FR);
    expect(keepAiNote('Pense à ton passeport valide pour le Portugal.', pt)).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', pt)).toBe(false);
    expect(keepAiNote('Change tes euros en escudos au bureau de change.', pt)).toBe(false);
    expect(keepAiNote('Réserve les nuits de juillet en avance : la côte est très fréquentée.', pt)).toBe(true);
  });

  it('hors zone euro : le change reste un conseil possible', () => {
    const ma = travelPapers('MA', 'Maroc', FR);
    expect(keepAiNote('Retire des dirhams sur place : la monnaie locale ne s’exporte pas.', ma)).toBe(true);
    expect(keepAiNote('Un visa est nécessaire pour le Maroc.', ma)).toBe(false);
  });

  it('les papiers sont toujours dits par la règle, même en France', () => {
    expect(keepAiNote('Prends ta carte d’identité.', travelPapers('FR', 'France', FR))).toBe(false);
  });

  it('« change » au sens courant n’est pas écarté', () => {
    expect(keepAiNote('Prévois des vêtements de rechange pour le soir.', travelPapers('PT', 'Portugal', FR))).toBe(true);
  });

  it('pays inconnu : l’IA n’est pas filtrée', () => {
    expect(keepAiNote('Pense à ton passeport.', travelPapers(null, null, NONE))).toBe(true);
  });

  it('nationalité inconnue : les papiers restent à la règle', () => {
    expect(keepAiNote('Pense à ton passeport.', travelPapers('NP', 'Népal', NONE))).toBe(false);
  });

  it('zone euro, devise connue autre que l’euro : le conseil de change est gardé', () => {
    const note = 'Passe au bureau de change avant le départ : tes francs suisses n’ont pas cours au Portugal.';
    expect(keepAiNote(note, travelPapers('PT', 'Portugal', who({ currency: 'CHF' })))).toBe(true);
    expect(keepAiNote(note, travelPapers('PT', 'Portugal', who({ currency: 'EUR' })))).toBe(false);
    expect(keepAiNote(note, travelPapers('PT', 'Portugal', NONE))).toBe(false);
  });

  it('prises : écartées quand la règle en parle ou les sait compatibles, gardées quand elle ne sait pas', () => {
    expect(keepAiNote('Prévois un adaptateur de prise.', travelPapers('GB', 'Royaume-Uni', NONE))).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', travelPapers('PT', 'Portugal', FR))).toBe(false);
    expect(keepAiNote('Prévois un adaptateur de prise.', travelPapers('PT', 'Portugal', US))).toBe(true);
  });
});
```

- [ ] **Step 2: Update the `abroadCosts` test (explicitly allowed: formalities now need a known French nationality)**

In `src/features/compas/__tests__/travel.test.ts`, replace:

```ts
    it('le budget : formalités gardées tant qu’on ne sait pas, assurance voyage seulement si on le sait', () => {
      expect(abroadCosts(null)).toEqual({ formalities: true, insurance: false });
      expect(abroadCosts(true)).toEqual({ formalities: true, insurance: true });
      expect(abroadCosts(false)).toEqual({ formalities: false, insurance: false });
    });
```

with:

```ts
    it('le budget : formalités (ressortissant français) gardées tant qu’on ne sait pas, assurance voyage seulement si on le sait', () => {
      const fr = { nationality: 'FR' };
      expect(abroadCosts(null, fr)).toEqual({ formalities: true, insurance: false });
      expect(abroadCosts(true, fr)).toEqual({ formalities: true, insurance: true });
      expect(abroadCosts(false, fr)).toEqual({ formalities: false, insurance: false });
    });

    it('nationalité inconnue ou autre : aucune formalité chiffrée (rien d’affirmé), l’assurance ne change pas', () => {
      expect(abroadCosts(true, { nationality: null })).toEqual({ formalities: false, insurance: true });
      expect(abroadCosts(null, { nationality: null })).toEqual({ formalities: false, insurance: false });
      expect(abroadCosts(true, { nationality: 'DE' })).toEqual({ formalities: false, insurance: true });
    });
```

- [ ] **Step 3: Write the failing prompt test**

Create `src/features/compas/__tests__/nationalityPrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCompasAutofillSystem, buildCompasStagesSystem } from '@/lib/ai/features/compasAutofill';

/**
 * Consignes de l'IA (PLAN-100 4.1, 4.2) : rien de « voyageur français » sans
 * nationalité connue, et jamais un départ de France supposé. L'itinéraire de base
 * (cache partagé entre comptes) ne dépend de personne.
 */
const rule = (system: string, id: string) => system.split('\n').find((l) => l.startsWith(`${id}. `)) ?? '';

const NEUTRAL_8A =
  '8a. Chaque conseil doit etre VRAI quelle que soit la nationalite de la personne : n ecris aucun conseil qui depende de sa nationalite, de son pays de residence ou de sa monnaie. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.';

describe('consignes de l’IA : rien de français sans nationalité connue', () => {
  it('sans profil ou autre nationalité : 8a neutre, ni France ni nationalité supposées', () => {
    expect(rule(buildCompasAutofillSystem(), '8a')).toBe(NEUTRAL_8A);
    expect(buildCompasAutofillSystem(false)).toBe(buildCompasAutofillSystem());
    expect(buildCompasAutofillSystem()).not.toMatch(/part de France|nationalite francaise/);
  });

  it('nationalité française connue : 8a la dit, jamais un départ de France', () => {
    expect(rule(buildCompasAutofillSystem(true), '8a')).toBe(
      '8a. Chaque conseil doit etre VRAI pour une personne de nationalite francaise. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.'
    );
    expect(buildCompasAutofillSystem(true)).not.toContain('part de France');
  });

  it('8b inchangée : aucune obligation inventée pour CE pays', () => {
    expect(rule(buildCompasAutofillSystem(), '8b')).toContain('N invente aucune obligation (permis, licence, visa, certificat)');
  });

  it('itinéraire de base (cache partagé) : aucun voyageur français supposé', () => {
    const s = buildCompasStagesSystem();
    expect(s).not.toMatch(/voyageur francais|versant francais/);
    expect(rule(s, '11')).toBe(
      '11. Un massif ou une chaine a cheval sur une frontiere (Pyrenees, Alpes, Andes, Himalaya) : le pays donne n est qu un indice ; prends le versant le plus pertinent pour l activite ou passe d un versant a l autre.'
    );
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npx vitest run src/features/compas/__tests__/papers.test.ts src/features/compas/__tests__/travel.test.ts src/features/compas/__tests__/nationalityPrompt.test.ts`
Expected: FAIL — `plugs` / `sameMoney` undefined and the unknown traveller still gets « France Diplomatie » (papers), `abroadCosts(true, { nationality: null })` gives `formalities: true` (travel), rule 8a still says « part de France » and rule 11 « voyageur francais » (prompt).

- [ ] **Step 5: Papers, plugs and money by traveller**

Replace the whole content of `src/features/compas/engine/papers.ts` with:

```ts
/**
 * Compas — papiers, monnaie et prises, par règles, selon le voyageur (PLAN-100 4.1, 4.2).
 *
 * L'IA écrivait « pense à ton passeport » pour le Portugal : les papiers sont
 * décidés ici, sur des listes sûres, et chaque affirmation dépend de ce qu'on SAIT
 * de la personne (profil voyageur) :
 *  - papiers et formalités : sa NATIONALITÉ. Française : les listes ci-dessous et
 *    France Diplomatie (règles d'avant le profil, inchangées). Inconnue ou autre :
 *    rien d'affirmé, une seule ligne qui renvoie au service officiel de son pays
 *    (la vraie table passeport × destination est le lot Q) ; rien quand aucune
 *    frontière n'est passée (son propre pays, ou départ déjà dans le pays) ;
 *  - prises : son PAYS DE RÉSIDENCE (ses appareils). En France (ou nationalité
 *    française sans résidence dite) : l'adaptateur est dit ; sinon seulement le
 *    type de prise du pays, un fait ;
 *  - change : sa DEVISE. En zone euro, les conseils de change de l'IA ne sont
 *    gardés que pour une personne dont la devise connue n'est pas l'euro.
 * Les conseils de l'IA qui doublent une règle sont écartés (`keepAiNote`).
 */

import { entryFees } from './costs';
import { UNKNOWN_TRAVELLER, type TravellerContext } from './traveller';

/** `sur_place` : aucune frontière à passer (départ déjà dans le pays), rien à dire. */
export type PapersKind = 'domestique' | 'carte' | 'passeport' | 'a_verifier' | 'sur_place';

export interface TravelPapers {
  papers: PapersKind | null;
  /** Euro sur place, null si le pays est inconnu. */
  euro: boolean | null;
  /** Zone euro : la devise connue de la personne est l'euro (vrai) ou une autre (faux) ; null sinon. */
  sameMoney: boolean | null;
  /** Prises : une ligne en parle (`dit`), rien à dire (`compatibles`), ou inconnu (null). */
  plugs: 'dit' | 'compatibles' | null;
  notes: string[];
}

const set = (codes: string) => new Set(codes.split(' '));

/** France et outre-mer. */
const DOMESTIC = set('FR RE GP MQ GF YT PM BL MF NC PF WF');

/** La carte d'identité française suffit : UE, EEE, Suisse, micro-États, Balkans occidentaux. */
const ID_CARD = set(
  'AT BE BG HR CY CZ DK EE FI DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH AD MC SM VA AL BA ME MK RS'
);

/** Europe hors des listes sûres : on n'affirme rien, on renvoie à France Diplomatie. */
const EUROPE_TO_CHECK = set('TR GE MD UA BY RU AM AZ XK FO GL GI IM JE GG SJ');

/** Euro (Bulgarie depuis le 1er janvier 2026). */
const EURO = set(
  'FR RE GP MQ GF YT PM BL MF AT BE BG HR CY EE FI DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'
);

/** Prises incompatibles avec celles de France (C, E, F) : le type du pays. */
const PLUGS: Record<string, string> = {
  GB: 'G', IE: 'G', MT: 'G', CY: 'G',
  US: 'A/B', CA: 'A/B', MX: 'A/B', JP: 'A/B',
  AU: 'I', NZ: 'I',
};

/** Prises C, E, F : rien à dire à des appareils de France, et l'IA ne doit pas parler d'adaptateur. */
const FRENCH_PLUGS = set(
  'FR RE GP MQ GF YT PM BL MF AT BE BG HR CZ DK EE FI DE GR HU IT LV LT LU NL PL PT RO SK SI ES SE IS LI NO CH AD MC SM VA AL BA ME MK RS MA TN DZ TR'
);

/**
 * Papiers, monnaie et prises pour CE voyageur. `abroad` : faux quand le départ est
 * déjà dans le pays de destination (`abroadOf`), null quand on ne sait pas.
 */
export function travelPapers(
  countryCode: string | null | undefined,
  countryName?: string | null,
  traveller: TravellerContext = UNKNOWN_TRAVELLER,
  abroad: boolean | null = null
): TravelPapers {
  const cc = (countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return { papers: null, euro: null, sameMoney: null, plugs: null, notes: [] };
  const where = countryName || cc;
  const notes: string[] = [];
  const papers =
    traveller.nationality === 'FR'
      ? frenchPapers(cc, where, notes)
      : otherPapers(cc, where, traveller.nationality, abroad, notes);
  const plug = PLUGS[cc];
  let plugs: TravelPapers['plugs'];
  if (frenchDevices(traveller)) {
    if (plug) notes.push(`Prises de type ${plug} : adaptateur à prévoir.`);
    plugs = plug ? 'dit' : FRENCH_PLUGS.has(cc) ? 'compatibles' : null;
  } else {
    if (plug) notes.push(`Prises de type ${plug} (${where}) : vérifie que tes chargeurs s’y branchent.`);
    plugs = plug ? 'dit' : null;
  }
  const euro = EURO.has(cc);
  return {
    papers,
    euro,
    sameMoney: euro && traveller.currency ? traveller.currency === 'EUR' : null,
    plugs,
    notes,
  };
}

/** Ressortissant français : listes sûres, formalités connues, France Diplomatie. */
function frenchPapers(cc: string, where: string, notes: string[]): PapersKind {
  if (DOMESTIC.has(cc)) return 'domestique';
  if (ID_CARD.has(cc)) {
    notes.push(`Papiers : carte d’identité ou passeport en cours de validité, sans visa (${where}).`);
    return 'carte';
  }
  const fee = entryFees(cc);
  if (fee) {
    notes.push(`Papiers : passeport + ${fee.detail}, conditions à vérifier sur France Diplomatie avant de partir.`);
    return 'passeport';
  }
  if (EUROPE_TO_CHECK.has(cc)) {
    notes.push(`Papiers : conditions d’entrée (${where}) à vérifier sur France Diplomatie avant de partir.`);
    return 'a_verifier';
  }
  notes.push(`Papiers : passeport (${where}), conditions d’entrée à vérifier sur France Diplomatie avant de partir.`);
  return 'passeport';
}

/**
 * Nationalité inconnue ou autre : rien d'affirmé. Son propre pays, ou un départ déjà
 * dans le pays : aucune frontière, rien à dire. Sinon une seule ligne, la même pour
 * tous (dédoublonnée par `orderNotes`), qui renvoie au service officiel de son pays.
 */
function otherPapers(
  cc: string,
  where: string,
  nationality: string | null,
  abroad: boolean | null,
  notes: string[]
): PapersKind {
  if (nationality === cc) return 'domestique';
  if (abroad === false) return 'sur_place';
  notes.push(`Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`);
  return 'a_verifier';
}

/** Appareils de France : résidence en France (outre-mer compris), ou nationalité française sans résidence dite. */
function frenchDevices(t: TravellerContext): boolean {
  return t.residenceCountry ? DOMESTIC.has(t.residenceCountry) : t.nationality === 'FR';
}

const PAPERS_RE = /passeport|carte d[’']identit|\bvisas?\b|e-visa|formalit|autorisation (de voyage|électronique)/i;
const PAPERS_ACRONYM_RE = /\b(ESTA|ETA|eTA|NZeTA|AVE)\b/;
const MONEY_RE = /bureau de change|taux de change|devises?\b|monnaie locale|changer (de l[’'])?argent|changer (tes |vos |des )?euros|change tes euros|change vos euros/i;
const PLUG_RE = /adaptateur|prises? (électriques?|de type)/i;

/** Un conseil de l'IA est gardé s'il ne contredit pas, ou ne double pas, une règle connue. */
export function keepAiNote(note: string, rules: TravelPapers): boolean {
  if (rules.papers == null) return true;
  // Les papiers restent à la règle, même quand elle se tait (rien d'affirmé par l'IA).
  if (PAPERS_RE.test(note) || PAPERS_ACRONYM_RE.test(note)) return false;
  // Change : écarté en zone euro, sauf pour une personne dont la devise connue est autre.
  if (rules.euro && rules.sameMoney !== false && MONEY_RE.test(note)) return false;
  if (rules.plugs != null && PLUG_RE.test(note)) return false;
  return true;
}
```

- [ ] **Step 6: The formalities barème is named for what it is**

In `src/features/compas/engine/costs.ts`, replace:

```ts
/** Formalités d'entrée connues pour un voyageur français (€ par personne, hors permis locaux). */
```

with:

```ts
/**
 * Formalités d'entrée connues pour un ressortissant français (€ par personne, hors
 * permis locaux). Jamais appliquées à une autre nationalité ni sans nationalité
 * connue (`abroadCosts`, `travelPapers`) : la table passeport × destination est le lot Q.
 */
```

and replace:

```ts
/** Formalités d'entrée connues (visa, autorisation, permis principal), sinon null. */
```

with:

```ts
/** Formalités d'entrée connues d'un ressortissant français (visa, autorisation, permis principal), sinon null. */
```

In `src/features/compas/engine/travel.ts`, replace:

```ts
import { trainTrip, type TrainTrip } from './rail';
```

with:

```ts
import { trainTrip, type TrainTrip } from './rail';
import type { TravellerContext } from './traveller';
```

and replace:

```ts
/**
 * Ce que « à l'étranger » change au budget : les formalités d'entrée (barème pour
 * un voyageur français) restent tant qu'on n'est pas SÛR d'être déjà dans le pays
 * (départ inconnu compris) ; l'assurance voyage n'est ajoutée que si on sait.
 */
export function abroadCosts(abroad: boolean | null): { formalities: boolean; insurance: boolean } {
  return { formalities: abroad !== false, insurance: abroad === true };
}
```

with:

```ts
/**
 * Ce que « à l'étranger » change au budget. Les formalités d'entrée sont un barème
 * pour un ressortissant français (`entryFees`) : chiffrées seulement pour une
 * nationalité française connue (sinon rien d'affirmé, PLAN-100 4.1), et tant qu'on
 * n'est pas SÛR d'être déjà dans le pays (départ inconnu compris). L'assurance
 * voyage n'est ajoutée que si on sait que le voyage passe une frontière.
 */
export function abroadCosts(
  abroad: boolean | null,
  traveller: Pick<TravellerContext, 'nationality'>
): { formalities: boolean; insurance: boolean } {
  return { formalities: abroad !== false && traveller.nationality === 'FR', insurance: abroad === true };
}
```

- [ ] **Step 7: The AI rules**

In `src/lib/ai/features/compasAutofill.ts`, replace:

```ts
    '11. Un massif ou une chaine a cheval sur une frontiere (Pyrenees, Alpes, Andes, Himalaya) : le pays donne n est qu un indice ; prends le versant le plus pertinent pour l activite (pour un voyageur francais, souvent le versant francais) ou passe d un versant a l autre.',
```

with:

```ts
    '11. Un massif ou une chaine a cheval sur une frontiere (Pyrenees, Alpes, Andes, Himalaya) : le pays donne n est qu un indice ; prends le versant le plus pertinent pour l activite ou passe d un versant a l autre.',
```

replace:

```ts
export function buildCompasAutofillSystem(): string {
  return [
```

with:

```ts
/**
 * `frenchNational` : nationalité française CONNUE (profil voyageur). C'est le seul
 * fait sur la personne que l'IA reçoit, sous la forme d'une règle (8a), jamais un
 * code ni un lieu : sans profil, ou pour une autre nationalité, la règle est neutre.
 * Appel sans cache partagé (`cacheTtlSeconds: 0`) : rien ne passe d'un compte à l'autre.
 */
export function buildCompasAutofillSystem(frenchNational = false): string {
  return [
```

and replace:

```ts
    '8a. Chaque conseil doit etre VRAI pour une personne qui part de France. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.',
```

with:

```ts
    frenchNational
      ? '8a. Chaque conseil doit etre VRAI pour une personne de nationalite francaise. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.'
      : '8a. Chaque conseil doit etre VRAI quelle que soit la nationalite de la personne : n ecris aucun conseil qui depende de sa nationalite, de son pays de residence ou de sa monnaie. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.',
```

(Rule 11 lives in `buildCompasStagesSystem`, whose text is part of the shared base-itinerary cache key: every base itinerary is recomputed once after deploy, then shared again. Never put anything about the person in `buildCompasStagesSystem` / `buildCompasStagesPrompt` / `buildCompasIntentPrompt`.)

- [ ] **Step 8: Wire the context in the preparation**

In `src/features/compas/server/autofillActions.ts`, replace:

```ts
import { keepAiNote, travelPapers } from '../engine/papers';
```

with:

```ts
import { keepAiNote, travelPapers } from '../engine/papers';
import { isFrenchNational } from '../engine/traveller';
```

replace:

```ts
      : await askJson(
          userId,
          buildCompasAutofillSystem(),
```

with:

```ts
      : await askJson(
          userId,
          buildCompasAutofillSystem(isFrenchNational(traveller)),
```

replace:

```ts
    // Papiers, change et prises : la règle parle, l'IA se tait sur ces sujets.
    // Le tutoiement aussi est une règle : un conseil qui vouvoie encore est écarté.
    const papers = travelPapers(anchor.countryCode, anchor.country);
```

with:

```ts
    // Papiers, change et prises : la règle parle, l'IA se tait sur ces sujets ; ce que
    // la règle affirme dépend du voyageur (nationalité, résidence, devise : PLAN-100 4.1).
    // Le tutoiement aussi est une règle : un conseil qui vouvoie encore est écarté.
    const papers = travelPapers(anchor.countryCode, anchor.country, traveller, abroad);
```

replace:

```ts
    // Formalités (barème pour un voyageur français) : gardées tant qu'on ne sait pas
    // que la personne est déjà dans le pays ; départ inconnu = pays de départ inconnu.
    const abroadFor = abroadCosts(abroad);
```

with:

```ts
    // Formalités (barème pour un ressortissant français) : seulement pour une nationalité
    // française connue, et tant qu'on ne sait pas que la personne est déjà dans le pays.
    const abroadFor = abroadCosts(abroad, traveller);
```

and replace:

```ts
            basis: `barème Compas ${COSTS_VERSION} · tarif officiel connu, à vérifier avant de partir`,
```

with:

```ts
            basis: `barème Compas ${COSTS_VERSION} · ressortissant français, tarif officiel connu, à vérifier avant de partir`,
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/features/compas src/lib/ai`
Expected: PASS (every file; `costs.test.ts` unchanged: `entryFees` keeps its signature).

Run: `npx tsc --noEmit -p .`
Expected: no error.

Run: `grep -rn "frenchPlugs\|part de France\|voyageur francais" src | grep -v __tests__`
Expected: no output.

Run: `grep -rn "France Diplomatie" src/features/compas src/lib/ai/features | grep -v __tests__`
Expected: six lines, all in `src/features/compas/engine/papers.ts` (header comment, `EUROPE_TO_CHECK` comment, `frenchPapers` comment and its three `notes.push` lines).

- [ ] **Step 10: Commit the code**

```bash
git add src/features/compas/engine/papers.ts src/features/compas/engine/costs.ts src/features/compas/engine/travel.ts src/lib/ai/features/compasAutofill.ts src/features/compas/server/autofillActions.ts src/features/compas/__tests__/papers.test.ts src/features/compas/__tests__/travel.test.ts src/features/compas/__tests__/nationalityPrompt.test.ts
git commit -m "$(cat <<'MSG'
fix(compas): rien de « voyageur français » sans nationalité connue

Papiers et formalités suivent la nationalité du profil : française, les règles
d'avant (France Diplomatie, barème) ; inconnue ou autre, une ligne « à vérifier
auprès du service officiel de ton pays », ou rien sans frontière à passer, et
aucune formalité chiffrée. Prises selon la résidence, conseil de change gardé
pour une autre devise. Consigne 8a de l'IA neutre (plus jamais « part de
France »), règle 11 de l'itinéraire sans « voyageur français ».

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

- [ ] **Step 11: PLAN-100 — §4.1 (two boxes), §4.2 (three boxes touched), §4.3 box 1**

In `docs/compas/PLAN-100.md`, replace:

```markdown
- [ ] Profil : nationalité, pays de résidence, devise, langue, fuseau, domicile (ville) ;
      demandé une fois, modifiable dans `/compte` ; les réglages du compte (unités,
      devise, fuseau) enfin lus.
- [ ] Sans profil : rien d'affirmé qui dépende de la nationalité.
```

with:

```markdown
- [x] Profil : nationalité, pays de résidence, devise, langue, fuseau, domicile (ville) ;
      demandé une fois, modifiable dans `/compte` ; les réglages du compte (unités,
      devise, fuseau) enfin lus. Lot P : table privée `user_traveller` (RLS de la personne
      seule, aucun droit pour anon, essai sans compte refusé, domicile à 0,01° par la base),
      question posée une fois dans le Compas vide (« Passer » range une ligne vide) et page
      `/compte/voyageur` (bureau et téléphone). Aucun réglage du compte n'existait côté
      serveur (devise et fuseau de `/compte` restaient dans le navigateur, jamais relus) :
      ils passent au profil, le fuseau sert de repli à « aujourd'hui » ; unités : 6.3
      (`traveller.test.ts`, `travellerActions.test.ts`, `travellerCard.test.tsx`, sonde
      `scripts/verify/user_traveller_rls_probe.sql`).
- [x] Sans profil : rien d'affirmé qui dépende de la nationalité. Lot P : papiers,
      formalités, prises, change et consignes de l'IA lisent le profil ; sans nationalité
      connue, une ligne « à vérifier auprès du service officiel de ton pays », ni France
      Diplomatie, ni formalités chiffrées, ni « adaptateur à prévoir » (`papers.test.ts`,
      `nationalityPrompt.test.ts`, `travel.test.ts`).
```

replace:

```markdown
- [ ] Prises et change selon le pays de résidence ; « France Diplomatie » pour les
      Français seulement, le service officiel du pays sinon.
- [ ] `keepAiNote` ne retire plus les conseils justes pour un non-Français.
```

with:

```markdown
- [~] Prises et change selon le pays de résidence ; « France Diplomatie » pour les
      Français seulement, le service officiel du pays sinon. Lot P : France Diplomatie et
      « adaptateur à prévoir » seulement pour une nationalité ou une résidence françaises
      connues ; ailleurs le type de prise du pays, un fait. **Pas fait** : prises et change
      d'une résidence hors de France (table des prises par pays, lot Q).
- [~] `keepAiNote` ne retire plus les conseils justes pour un non-Français. Lot P : le change
      est gardé pour une devise connue autre que l'euro, les prises quand la règle ne sait
      pas ; les papiers restent à la règle (`papers.test.ts`).
```

replace:

```markdown
- [ ] Hypothèses « voyageur français » encore en place, jusqu'au profil (4.1), à ne pas
      confondre avec le départ, qui ne vaut plus la France par défaut (4.3) : le prompt
      système de l'IA (`src/lib/ai/features/compasAutofill.ts`, règles 8a et 8b ; la 8a
      écrit « une personne qui part de France ») et le barème `entryFees` (« voyageur
      français », `engine/costs.ts`).
```

with:

```markdown
- [x] Hypothèses « voyageur français » encore en place, jusqu'au profil (4.1), à ne pas
      confondre avec le départ, qui ne vaut plus la France par défaut (4.3) : le prompt
      système de l'IA (`src/lib/ai/features/compasAutofill.ts`, règles 8a et 8b ; la 8a
      écrit « une personne qui part de France ») et le barème `entryFees` (« voyageur
      français », `engine/costs.ts`). Lot P : 8a neutre sans nationalité française connue,
      plus jamais « part de France » ; règle 11 de l'itinéraire sans « voyageur français » ;
      `entryFees` réservé aux ressortissants français (`nationalityPrompt.test.ts`,
      `travel.test.ts`).
```

and replace:

```markdown
- [~] Origine = ville dite (« depuis Lyon »), domicile du profil ou GPS ; **jamais la
      France par défaut** ; sans origine, le trajet n'est pas chiffré (dit à l'écran).
      Lot N : départ dit (`metadata.compas.origin`) > GPS > aucun ; plus de Paris ni de
      « depuis la France » ; sans départ, rien de chiffré et « Trajet non chiffré : point de
      départ inconnu » (`travel.test.ts`). **Pas fait : le domicile du profil**, il attend
      le profil (4.1).
```

with:

```markdown
- [x] Origine = ville dite (« depuis Lyon »), domicile du profil ou GPS ; **jamais la
      France par défaut** ; sans origine, le trajet n'est pas chiffré (dit à l'écran).
      Lot N : départ dit (`metadata.compas.origin`) > GPS > aucun ; plus de Paris ni de
      « depuis la France » ; sans départ, rien de chiffré et « Trajet non chiffré : point de
      départ inconnu » (`travel.test.ts`). Lot P : domicile du profil après le départ dit et
      avant la position, rangé à 0,01° et cherché une seule fois, à l'enregistrement ;
      « (depuis ton domicile) » et une note, jamais le nom du domicile sur le voyage ni pour
      l'IA (`travelHome.test.ts`).
```

- [ ] **Step 12: ETAT.md — the lot N production proof and one lot P line**

In `docs/compas/ETAT.md`, the lot N line (it starts with `Lot N (plan \`docs/superpowers/plans/2026-10-09-compas-lot-n.md\``) ends with the text below; replace that ending:

```markdown
« 5 jours depuis Lyon en Corse » garde départ Lyon et destination Corse (la carte tranche, `settleLinkedOrigin`).
```

with (the production proof appended to the lot N line, then the lot P line right after it, before the blank line that precedes `**À faire par Tony**`):

```markdown
« 5 jours depuis Lyon en Corse » garde départ Lyon et destination Corse (la carte tranche, `settleLinkedOrigin`). **En production** (PR #87, `3b96d58`, alias `kitduvoyageur-1783951966810-ruddy.vercel.app`), relu en base le 10 oct. : « 5 jours en Sardaigne depuis Lyon » → départ Lyon, « vol aller-retour depuis Lyon, LYS → CAG (…), environ 790 km » ; « rando 3 jours depuis Bourg en Bresse » → départ « Bourg-en-Bresse », sans destination parasite ; 0 erreur serveur (`app_errors`).
Lot P (plan `docs/superpowers/plans/2026-10-10-compas-lot-p.md`, PLAN-100 4.1 et 4.3) : profil voyageur privé (`user_traveller` : RLS de la personne seule, aucun droit pour anon, essai sans compte refusé) demandé une fois dans le Compas vide (« Passer » toujours visible) et modifiable dans `/compte/voyageur` ; trajet depuis le domicile du profil après le départ dit et avant la position, sans jamais ranger le nom du domicile sur le voyage ; sans nationalité connue, plus aucune règle « voyageur français » (papiers renvoyés au service officiel du pays, ni France Diplomatie, ni formalités chiffrées, consignes de l'IA neutres) ; verrou de vie privée au build ; tests verts, migration à appliquer par le contrôleur puis à prouver sur l'aperçu.
```

- [ ] **Step 13: Final checks**

Run: `npx vitest run src/features/compas src/lib/ai tests/security/a14-gdpr-account.spec.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no error.

Run: `npx eslint src/features/compas/engine/traveller.ts src/features/compas/server/traveller.ts src/features/compas/engine/intentWords.ts src/features/compas/engine/zone.ts src/features/compas/server/placeSearch.ts src/features/compas/server/compasActions.ts src/features/compas/engine/places.ts src/features/compas/server/travellerActions.ts src/components/identity/TravellerCard.tsx src/app/compte/voyageur/page.tsx src/app/compas/page.tsx src/features/compas/components/CompasStart.tsx src/components/compte/ParametresCompteCard.tsx src/components/compte/MobileCompteV2.tsx src/features/compas/engine/travel.ts src/features/compas/server/autofillActions.ts src/features/compas/engine/papers.ts src/features/compas/engine/costs.ts src/lib/ai/features/compasAutofill.ts src/server/gdprExport.ts scripts/verify/traveller_privacy.mjs`
Expected: no error; the only warnings are those `ParametresCompteCard.tsx` and `MobileCompteV2.tsx` already had before the lot.

Run: `node scripts/verify/traveller_privacy.mjs && node scripts/verify/identity_compliance.mjs | tail -1`
Expected: `✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).` then `✓ ANTI-DÉRIVE : toutes les contraintes durables sont respectées.`

Run: `grep -rln "user_traveller" src --include=*.ts --include=*.tsx | grep -v __tests__`
Expected: exactly `src/features/compas/server/traveller.ts` and `src/server/gdprExport.ts`.

- [ ] **Step 14: Commit the docs**

```bash
git add docs/compas/PLAN-100.md docs/compas/ETAT.md
git commit -m "$(cat <<'MSG'
docs(compas): lot P, PLAN-100 4.1 et 4.3 cochées, preuve en production du lot N

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CK6EkLmQ7GZaXBvCMSdiuQ
MSG
)"
```

**After the lot (controller, not implementers):** apply `supabase/migrations/20261010100000_user_traveller.sql` to `icxyvwzfjbflcbqukpfz` with MCP `apply_migration` (name `user_traveller`), run `scripts/verify/user_traveller_rls_probe.sql` alone through `execute_sql` (expected error message `SONDE user_traveller : 16 contrôles passés (tout est annulé)`), read `select tablename, policyname, roles, cmd, permissive from pg_policies where tablename = 'user_traveller'` (5 rows, all `{authenticated}`, one `RESTRICTIVE`) and `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'user_traveller' and grantee in ('anon','authenticated')` (4 rows, `authenticated` only). Then prove on the preview: a signed-in account answers the card in the empty Compas (France, « Villeurbanne »), « 5 jours en Sardaigne » without « depuis » and without position gives « vol LYS → CAG à prévoir (depuis ton domicile) », and the trip's metadata and expenses contain no « Villeurbanne » (read in the database).

---

## Self-review (done while writing)

- **Spec coverage.** §4.1 box 1 (profile fields, asked once, editable in `/compte`, account settings read) → Tasks 1 (storage), 2 (reader, time-zone fallback), 4 (writing), 5 (asked once in the empty Compas with « Passer », `/compte/voyageur` for desktop and phone, the local-only settings said as such); « unités » stay §6.3 (stated in the box). §4.1 box 2 (nothing nationality-dependent without a profile) → Task 7 (papers, plugs, money, formalities, rules 8a/11) with the full audit in « Notes on the scope », item 10. §4.3 box 1 (home of the profile) → Task 6. Decision 1 (table, columns, CHECKs, RLS, no anon grant, additive idempotent file, MCP rolled-back proof, controller applies) → Task 1. Decision 2 → Task 5. Decision 3 (said > home > GPS > none, one note, « (depuis … ) », home rounded to 0,01°, geocoded once at save with `compas-destination` and the departure filter) → Tasks 4 and 6, with the home name replaced by « ton domicile » (Ruling 1). Decision 5 (pure `TravellerContext`, server reader, engines take arguments, browser zone first) → Tasks 2 and 6; currency stored, budget untouched (Ruling 3). Decision 6 → Notes item 1 and Task 5. Decision 7 (lock that breaks the build; no raw value in logs, `app_errors`, AI, exports) → Task 3, `quiet()` errors in Task 4, `originFact` in Task 6, 8a wording in Task 7. Decision 8 (PLAN-100 boxes, one ETAT line, lot N production proof) → Task 7, Steps 11-12.
- **Placeholder scan.** Every new file is given in full, every edit quotes the exact current text (copied from HEAD `3b96d58`) and its replacement; every test has its full code and exact strings; the only « choose » left to the implementer is which RLS proof they can run (MCP or local replay), with both procedures written out.
- **Type consistency.** `TravellerContext { nationality, residenceCountry, currency, language, timeZone, home }`, `TravellerHome { name, lat, lon, countryCode }`, `TravellerView { …, homeName }`, `TravellerFields { …, home: string | null }`, `TravellerOption { value, label }`, `UNKNOWN_TRAVELLER`, `isFrenchNational` (Task 2, consumed by 4-7); `readTravellerState` / `readTraveller` / `writeTraveller` / `markTravellerAsked` (Task 2, consumed by 4, 5, 6); `placeSearchLimitError`, `resolvePlaceByName`, `isHomePlace`, `saveTravellerAction`, `skipTravellerAction`, `TravellerSaveResult` (Task 4, consumed by 5); `TravellerCard` props `{ mode, initial, onDone, className }`, `CompasStart` prop `askTraveller` (Task 5); `travelOrigin(said, gps, home)`, `TravelOrigin.source 'domicile'`, `HOME_ORIGIN_NOTE` (Task 6); `TravelPapers { papers, euro, sameMoney, plugs, notes }`, `travelPapers(cc, name, traveller, abroad)`, `abroadCosts(abroad, traveller)`, `buildCompasAutofillSystem(frenchNational)` (Task 7). The lock's allow-lists (Task 3) name exactly the paths Tasks 4-6 create.
- **Applied end to end.** See « Notes on the scope », item 13 (scratch copy of HEAD, all seven tasks, suites, `tsc`, `eslint`, both locks; probe replayed on PostgreSQL 16).
- **Not covered by an automated test (review by reading):** the two server pages (`src/app/compas/page.tsx` reads `asked` only for a non-trial account; `src/app/compte/voyageur/page.tsx` redirects without a session and shows the trial message), the `ParametresCompteCard` / `MobileCompteV2` links, and the wiring lines in `autofillActions.ts` (`readTraveller(… auth.anonymous ? null : userId)`, `today` after the read, `home` only without a said origin, no reverse geocoding when the home is known, `travelPapers(…, traveller, abroad)`, `abroadCosts(abroad, traveller)`, `buildCompasAutofillSystem(isFrenchNational(traveller))`). Each decision those lines delegate to is unit-tested (`travelHome`, `papers`, `travel`, `nationalityPrompt`, `traveller`), and Steps 6 / 9 of Tasks 6-7 grep the wiring. The preview proof listed after Task 7 covers the rest, read in the database.

## Rulings needed

Decisions `scope.md` does not settle, or where the code contradicts it. The plan implements the recommendation; each one is cheap to reverse.

1. **The home's name on the trip.** Decision 3 asks for « préparé autour de X, ton domicile » and « (depuis X) »; decision 7 says the home never leaves the person's own screens, and every trip text is persisted on the shared trip (collaborators; anyone for a public/unlisted trip). Recommendation (implemented): « ton domicile » / « (depuis ton domicile) » and the neutral note. Cost if wrong: the person reads « ton domicile » instead of « Villeurbanne »; showing the name to its owner later is a display-time substitution in the Compas (one small task, nothing to clean in the database). The opposite mistake would write home towns into every shared trip and expense, and need a data clean-up.
2. **The home as the anchor of a trip without a destination.** Not done: the anchor name goes to the AI facts and to the shared base-itinerary prompt, and preparing around one's home is a guess. Recommendation: keep the home for the travel leg only. Cost if wrong: a signed-in person with a home, no destination, no « depuis » and no shared position still gets « Dis-moi où tu pars » (one more sentence); adding it later needs a neutral destination fact for the AI and bypassing the shared stages cache for that anchor.
3. **`trips.budget_currency` from the profile (decision 5, « may »).** Not done: the budget engine sums euro amounts without conversion and only labels them with the trip currency, so a USD default would show euros as dollars. Recommendation: lot R. Cost if wrong: none visible; done now, every budget of a non-euro profile would be mislabelled.
4. **Where « asked once » lives.** The empty Compas only (`CompasStart`), « Passer » = an empty row; not after sign-up in `/compte` (sign-up lands there) and no `asked_at` column. Recommendation: keep (the question comes when it matters). Cost if wrong: a person who never opens a new adventure is never asked (they still have `/compte/voyageur`); another mount is one line plus one server read.
5. **Home strictness.** `isHomePlace` refuses a region, a province or a country (stricter than decision 3's `isDeparturePlace`): a trip priced from the centre of « Bretagne » would be wrong. Cost if wrong: someone typing a region is asked for a town; relaxing is one condition.
6. **RLS beyond « exactly like `user_orientation` ».** The own policies use `(select auth.uid())` (same rows) and a RESTRICTIVE insert refuses trial sessions (`is_anonymous_session()`), which the plain pattern would let write. Cost if wrong: none for real accounts; without the restrictive policy a trial could store a profile that the trial purge deletes later.
7. **Changing the home does not mark the trip as « à réadapter ».** The home is kept out of `ProjectBasis` (it would depend on the reader and persist `name@lat,lon`). Cost: a prepared trip keeps its « depuis ton domicile » line until the person re-adapts or relaunches; a hashed token in the basis is one later task.
8. **Airports near the home stay in the flight basis** (« vol aller-retour depuis ton domicile, LYS → CAG (Lyon Saint-Exupéry Airport → …) »): they reveal a region, not the town, and explain the price. Recommendation: accept. Cost if wrong: keep only IATA codes in `fly()`'s basis (small change, `travel.test.ts` strings).
9. **Unknown nationality, destination France, departure unknown** shows the generic papers line (honest, odd for a French user without profile). Recommendation: keep (decision 4 forbids a claim; one answer to the card removes it, and a said origin, a home or a position in France already silences it). Cost: one extra line on some French trips until the person answers.
10. **PLAN-100 §4.2.** Beyond decision 8's list, the plan ticks the last §4.2 box (its text says « jusqu'au profil (4.1) ») and marks two §4.2 boxes `[~]` with what lot P did. Cost if wrong: revert three lines.
11. **`/compte` local settings.** The plan removes the local currency and time-zone selects (now in the profile; two sources of truth otherwise) and replaces the false « sauvegardés en base » toast. Cost if wrong: re-add two selects that nothing reads.
12. **Language choices.** The six languages already offered by `/compte` (fr, en, de, it, es, ca) plus the stored value; nothing reads the language yet (phase 6). Cost: someone wanting « pt-BR » waits for phase 6 to widen the list.

## Conflict scan

| Shared file or interface | Produced by | Also written or consumed by | Note |
|---|---|---|---|
| `engine/traveller.ts` (`TravellerContext`, `UNKNOWN_TRAVELLER`, `TravellerHome`, `TravellerView`, `TravellerFields`, `TravellerOption`, validators, `travellerFromRow`, `travellerView`, `cleanTravellerFields`, `isFrenchNational`, option lists) | Task 2 | Task 4 (clean, `isCountryCode`, view, home type), Task 5 (options, view), Task 6 (via `readTraveller`), Task 7 (`TravellerContext`, `UNKNOWN_TRAVELLER`, `isFrenchNational`) | no later task edits it |
| `server/traveller.ts` (`readTravellerState`, `readTraveller`, `writeTraveller`, `markTravellerAsked`) | Task 2 | Task 4 (write, mark, read state), Task 5 (two server pages), Task 6 (preparation) | the only file naming the table besides `gdprExport.ts` |
| `engine/zone.ts` `travellerToday(timeZone, now, profileZone)` | Task 2 | Task 6 | `compasActions.ts:1828` keeps two arguments |
| `engine/intentWords.ts` `isoCurrencyCodes` / `knownIsoCode` | Task 2 | Task 2 (`engine/traveller.ts`) | intent parsing unchanged |
| `scripts/verify/traveller_privacy.mjs` allow-lists | Task 3 | Tasks 4-6 create files at the allowed paths (`server/travellerActions.ts`, `components/identity/TravellerCard.tsx`, `app/compte/voyageur/page.tsx`, `CompasStart.tsx`, `app/compas/page.tsx`, `autofillActions.ts`) | renaming any of them breaks the lock |
| `package.json` `prebuild`, `identity_compliance.mjs` | Task 3 | — | — |
| `server/placeSearch.ts` (`placeSearchLimitError`, `resolvePlaceByName`) | Task 4 | Task 4 (`compasActions.ts`, `travellerActions.ts`) | destination/origin behaviour unchanged |
| `server/compasActions.ts` | Task 4 (imports, `resolveDestination`, `placeSearchLimitError` removed) | Task 5 only imports `compasCreateTripAction` (unchanged, via `CompasStart`) | — |
| `engine/places.ts` `isHomePlace` | Task 4 | Task 4 | — |
| `server/travellerActions.ts` | Task 4 | Task 5 (`TravellerCard`) | — |
| `components/identity/TravellerCard.tsx` | Task 5 | Task 5 (`CompasStart`, `/compte/voyageur`) | — |
| `engine/travel.ts` | Task 6 (header, `TravelOrigin.source`, `HOME_DEPARTURE`, `HOME_ORIGIN_NOTE`, `travelOrigin`, `originFact`, `departureOf`, `planTravelLeg`) | Task 7 (import of `TravellerContext`, `abroadCosts`) | different hunks; Task 7 after Task 6 |
| `server/autofillActions.ts` | Task 6 (import `readTraveller`, `today`, `Promise.all` → `traveller`, step « 5. Venir ») | Task 7 (import `isFrenchNational`, AI system, papers, formalities, basis), using Task 6's `traveller` and lot N's `abroad` | Task 7 after Task 6; the anchor blocks stay untouched |
| `__tests__/travel.test.ts` | — | Task 7 (the `abroadCosts` test) | Task 6 adds a separate `travelHome.test.ts`: no overlap |
| `engine/papers.ts` (`TravelPapers` without `frenchPlugs`, with `plugs` / `sameMoney`) | Task 7 | read only by `keepAiNote` and `papers.test.ts` (grep) | — |
| `src/server/gdprExport.ts` + `tests/security/a14-gdpr-account.spec.ts` | Task 1 | `gdprDelete.ts` iterates the list (no change needed) | — |
| `docs/compas/PLAN-100.md`, `docs/compas/ETAT.md` | Task 7 | — | — |
