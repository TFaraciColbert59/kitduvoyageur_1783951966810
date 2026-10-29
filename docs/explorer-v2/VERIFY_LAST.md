# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-29T10:47:47.583Z
- Mode : courant
- Résultat : ❌ ÉCHEC — Playwright mobile-chromium rouge

## Étapes

| Étape | Code | Durée |
|---|---|---|
| type-check | 0 | 7.1 s |
| lint | 0 | 2.6 s |
| vitest | 0 | 2.0 s |
| build | 0 | 168.1 s |
| playwright | 1 | 536.8 s |

## Journal

```
# Explorer v2 · verify-all
- racine : /Users/fr168256/Desktop/lkdv-explorer-v2
- date : 2026-10-29T10:35:29.109Z

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
✔ lint (2.6 s)

▶ vitest : npx vitest run --reporter=dot explorer-v2
RUN  v4.1.11 /Users/fr168256/Desktop/lkdv-explorer-v2

··············································

 Test Files  3 passed (3)
      Tests  46 passed (46)
   Start at  11:35:39
   Duration  1.03s (transform 280ms, setup 253ms, import 379ms, tests 126ms, environment 552ms)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
(node:73683) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:73682) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:73681) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ vitest (2.0 s)

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
(node:74027) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:74078) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ build (168.1 s)
… First Load JS /explorer introuvable dans le log de build (toléré hors phase 9)
✔ serveur de recette prêt sur :4028

▶ playwright : /Users/fr168256/Desktop/lkdv-explorer-v2/node_modules/.bin/playwright test --grep @explorer-v2 --project=mobile-chromium --reporter=line --workers=1
✘ playwright — code 1

✘ ÉCHEC : Playwright mobile-chromium rouge
```
