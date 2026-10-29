# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-29T08:55:36.288Z
- Mode : courant
- Résultat : ✅ OK

## Étapes

| Étape | Code | Durée |
|---|---|---|
| type-check | 0 | 8.6 s |
| lint | 0 | 3.0 s |
| vitest | 0 | 1.8 s |
| build | 0 | 129.9 s |
| playwright | 0 | 164.7 s |
| playwright | 0 | 91.9 s |
| a11y | 0 | 6.0 s |
| grep:couleur #E4501C | 0 | 0.0 s |
| grep:TODO/FIXME/lorem/EXAMPLE_TRAIL/mock | 0 | 0.0 s |
| grep:SERVICE_ROLE côté client | 0 | 0.0 s |
| grep:projet Supabase fantôme | 0 | 0.0 s |
| rls | 0 | 0.7 s |
| rls | 0 | 2.5 s |

## Journal

```
# Explorer v2 · verify-all
- racine : /Users/fr168256/Desktop/lkdv-explorer-v2
- date : 2026-10-29T08:48:39.459Z

▶ type-check : npx tsc --noEmit
✔ type-check (8.6 s)

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
✔ lint (3.0 s)

▶ vitest : npx vitest run --reporter=dot explorer-v2
RUN  v4.1.11 /Users/fr168256/Desktop/lkdv-explorer-v2

··············································

 Test Files  3 passed (3)
      Tests  46 passed (46)
   Start at  09:48:52
   Duration  739ms (transform 197ms, setup 159ms, import 337ms, tests 100ms, environment 400ms)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
(node:52392) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:52391) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:52390) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ vitest (1.8 s)

▶ build : npx next build
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

<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (106kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (254kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
 ⚠ Using edge runtime on a page currently disables static generation for that page
(node:52656) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:52718) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ build (129.9 s)
… First Load JS /explorer introuvable dans le log de build (toléré hors phase 9)
✔ serveur de recette prêt sur :4028

▶ playwright : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test --grep @explorer-v2 --project=mobile-chromium --reporter=line --workers=1
✔ playwright (164.7 s)

▶ playwright : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test --grep @explorer-v2 --project=mobile-webkit --reporter=line --workers=1
✔ playwright (91.9 s)
⏭  clicks (mesure de couverture réservée au mode --final)

▶ a11y : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test tests/explorer-v2/explorer-v2.e2e.spec.ts --project=mobile-webkit -g a11y --reporter=line --workers=1
✔ a11y (6.0 s)
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
✔ rls (0.7 s)

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
✔ rls (2.5 s)
… checklist : 0/135 cases cochées, 135 restantes
```
