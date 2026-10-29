# VERIFY_LAST · Explorer v2

> **Deux exécutions consécutives vertes** (P10-07) :
> - run A : 2026-10-29 14:05–14:25 → ✅ `verify-all : toutes les étapes vertes`
> - run B : 2026-10-29 14:27–14:37 → ✅ `verify-all : toutes les étapes vertes`
> Le détail ci-dessous est celui du run B (le plus récent).

- Exécuté : 2026-10-29T13:34:34.457Z
- Mode : courant
- Résultat : ✅ OK

## Étapes

| Étape | Code | Durée |
|---|---|---|
| type-check | 0 | 7.1 s |
| lint | 0 | 2.9 s |
| vitest | 0 | 1.5 s |
| build | 0 | 79.8 s |
| playwright | 0 | 179.6 s |
| playwright | 0 | 141.2 s |
| a11y | 0 | 5.3 s |
| grep:couleur #E4501C | 0 | 0.0 s |
| grep:TODO/FIXME/lorem/EXAMPLE_TRAIL/mock | 0 | 0.0 s |
| grep:SERVICE_ROLE côté client | 0 | 0.0 s |
| grep:projet Supabase fantôme | 0 | 0.0 s |
| rls | 0 | 0.5 s |
| rls | 0 | 1.8 s |

## Journal

```
# Explorer v2 · verify-all
- racine : /Users/fr168256/Desktop/lkdv-explorer-v2
- date : 2026-10-29T13:27:31.351Z

▶ type-check : npx tsc --noEmit
✔ type-check (7.1 s)

▶ lint : npx next lint
22:7  Warning: 'PREMIER_JOUR' is assigned a value but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/adventure-prep/engine/aiItinerary.ts
4:3  Warning: 'itineraryOutputSchema' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/adventure-prep/engine/consumablesBySegment.ts
70:10  Warning: 'closingRefill' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/adventure-prep/engine/generation.ts
3:3  Warning: 'AdventurePrepDraft' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/adventure-prep/engine/itineraryEngine.ts
300:3  Warning: 'days' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/adventure-prep/engine/itineraryPhases.ts
2:41  Warning: 'PHASE_IDS' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars
5:10  Warning: 'locatedStepCount' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/booking/server/routeStackBookingProvider.ts
23:3  Warning: 'CheckoutContext' is defined but never used. Allowed unused vars must match /^_/u.  @typescript-eslint/no-unused-vars

./src/features/boo`next lint` is deprecated and will be removed in Next.js 16.
For new projects, use create-next-app to choose your preferred linter.
For existing projects, migrate to the ESLint CLI:
npx @next/codemod@canary next-lint-to-eslint-cli .
✔ lint (2.9 s)

▶ vitest : npx vitest run --reporter=dot explorer-v2
RUN  v4.1.11 /Users/fr168256/Desktop/lkdv-explorer-v2

··············································

 Test Files  3 passed (3)
      Tests  46 passed (46)
   Start at  14:27:42
   Duration  585ms (transform 133ms, setup 130ms, import 227ms, tests 81ms, environment 321ms)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
(node:93282) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:93283) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:93281) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ vitest (1.5 s)

▶ build : npx next build
├ ƒ /recompenses                                7.91 kB         266 kB
├ ƒ /rejoindre/[slug]                             169 B         109 kB
├ ƒ /rejoindre/[slug]/accepter                    854 B         106 kB
├ ○ /robots.txt                                   854 B         106 kB
├ ƒ /sitemap.xml                                  854 B         106 kB
├ ƒ /trajectoire                                14.2 kB         171 kB
├ ƒ /voyages/[slug]                             10.5 kB         454 kB
└ ƒ /voyages/[slug]/[section]                   1.88 kB         119 kB
+ First Load JS shared by all                    105 kB
  ├ chunks/31255-a1628e6ad4057a1a.js              46 kB
  ├ chunks/4bd1b696-bad92808725a934a.js         54.2 kB
  └ other shared chunks (total)                  4.7 kB


ƒ Middleware                                    98.8 kB

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand

 ⚠ Using edge runtime on a page currently disables static generation for that page
(node:93359) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:93366) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ build (79.8 s)
… First Load JS /explorer introuvable dans le log de build (toléré hors phase 9)
✔ serveur de recette prêt sur :4028

▶ playwright : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test --grep @explorer-v2 --project=mobile-chromium --reporter=line --workers=1
✔ playwright (179.6 s)

▶ playwright : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test --grep @explorer-v2 --project=mobile-webkit --reporter=line --workers=1
✔ playwright (141.2 s)
⏭  clicks (mesure de couverture réservée au mode --final)

▶ a11y : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test tests/explorer-v2/explorer-v2.e2e.spec.ts --project=mobile-webkit -g a11y --reporter=line --workers=1
✔ a11y (5.3 s)
✔ grep « couleur #E4501C » vierge
✔ grep « TODO/FIXME/lorem/EXAMPLE_TRAIL/mock » vierge
✔ grep « SERVICE_ROLE côté client » vierge
✔ grep « projet Supabase fantôme » vierge

▶ rls : node .agents/test_rls_intrusion.mjs
--- STARTING RLS INTRUSION TESTS (CLIENT-SIDE) ---

[TEST 1] Attempting direct insert into reward_transactions...
✅ PASS: Direct insert rejected. Error: permission denied for table reward_transactions

[TEST 2] Attempting direct update of reward_accounts...
✅ PASS (or RLS Blocked): Update executed but either returned no rows or rejected. Error: null

[TEST 3] Attempting direct insert into reward_withdrawals...
✅ PASS: Direct insert rejected. Error: new row violates row-level security policy for table "reward_withdrawals"

[TEST 4] Attempting to read all reward accounts...
✅ PASS: Read returned 0 records. (Should be 0 for anon): []

--- RLS INTRUSION TESTS COMPLETED ---
✔ rls (0.5 s)

▶ rls : node scripts/explorer-v2/test-rls-intrusion.mjs
✔ A lit sa propre session live — 1 ligne(s)
✔ anon ne lit aucune session — HTTP 200, 0 ligne(s)
✔ B (abonné mutuel) lit la session live partagée de A — 1 ligne(s)
✔ B ne lit aucun point GPS de A — 0 point(s)
✔ A lit ses propres points GPS — 41 point(s)
✔ B ne peut pas modifier la session de A — HTTP 200, 0 ligne(s)
✔ B ne peut pas créer une session au nom de A — HTTP 403
✔ B ne lit aucune alerte SOS — 0 ligne(s)
✔ geo_pois lisible publiquement (anon) — HTTP 200
✔ country_practical lisible publiquement — HTTP 200
✔ osm_poi_cache fermé au public — HTTP 200

11/11 contrôles verts
✔ rls (1.8 s)
… checklist : 104/135 cases cochées, 31 restantes
```
