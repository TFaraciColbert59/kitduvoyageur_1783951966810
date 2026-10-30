# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-30T08:23:46.055Z
- Mode : courant (--only=type-check,lint,vitest,grep,rls)
- Résultat : ✅ OK

## Étapes

| Étape | Code | Durée |
|---|---|---|
| type-check | 0 | 5.8 s |
| lint | 0 | 2.5 s |
| vitest | 0 | 1.5 s |
| grep:couleur #E4501C | 0 | 0.0 s |
| grep:TODO/FIXME/lorem/EXAMPLE_TRAIL/mock | 0 | 0.0 s |
| grep:SERVICE_ROLE côté client | 0 | 0.0 s |
| grep:projet Supabase fantôme | 0 | 0.0 s |
| rls | 0 | 0.4 s |
| rls | 0 | 1.2 s |

## Journal

```
# Explorer v2 · verify-all
- racine : /Users/fr168256/Desktop/lkdv-explorer-v2
- date : 2026-10-30T08:23:30.893Z

▶ type-check : npx tsc --noEmit
✔ type-check (5.8 s)

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
✔ lint (2.5 s)

▶ vitest : npx vitest run --reporter=dot explorer-v2

[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m

[2m Test Files [22m [1m[32m7 passed[39m[22m[90m (7)[39m
[2m      Tests [22m [1m[32m74 passed[39m[22m[90m (74)[39m
[2m   Start at [22m 09:23:40
[2m   Duration [22m 594ms[2m (transform 256ms, setup 331ms, import 357ms, tests 103ms, environment 323ms)[22m

[33m(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.[39m
(node:41512) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41510) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41508) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41509) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41507) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41511) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41506) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ vitest (1.5 s)
⏭  build (ignoré)
… First Load JS /explorer introuvable dans le log de build (toléré hors phase 9)
✔ serveur de recette prêt sur :4028
⏭  playwright (ignoré)
⏭  playwright (ignoré)
⏭  clicks (mesure de couverture réservée au mode --final)
⏭  a11y (ignoré)
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
✔ rls (0.4 s)

▶ rls : node scripts/explorer-v2/test-rls-intrusion.mjs
✔ A lit sa propre session live — 1 ligne(s)
✔ anon ne lit aucune session — HTTP 200, 0 ligne(s)
✔ B (abonné mutuel) lit la session live partagée de A — 1 ligne(s)
✔ B ne lit aucun point GPS de A — 0 point(s)
✔ A lit ses propres points GPS — 41 point(s)
✔ B ne peut pas modifier la session de A — HTTP 200, 0 ligne(s)
✔ B ne peut pas créer une session au nom de A — HTTP 403
✔ B ne lit aucune alerte SOS — 0 ligne(s)
✔ geo_pois fermé au public en direct (invariant Compas) — HTTP 401
✔ RPC explorer_pois lisible publiquement (anon) — HTTP 200, 3 POI(s)
✔ country_practical lisible publiquement — HTTP 200
✔ osm_poi_cache fermé au public — HTTP 200

12/12 contrôles verts
✔ rls (1.2 s)
… checklist : 114/135 cases cochées, 21 restantes
```
