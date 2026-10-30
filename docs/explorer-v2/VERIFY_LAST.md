# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-30T08:09:24.973Z
- Mode : courant (--only=type-check,lint,vitest,grep,rls)
- Résultat : ❌ ÉCHEC — test d’intrusion RLS rouge (scripts/explorer-v2/test-rls-intrusion.mjs)

## Étapes

| Étape | Code | Durée |
|---|---|---|
| type-check | 0 | 410.0 s |
| lint | 0 | 4.0 s |
| vitest | 0 | 2.4 s |
| grep:couleur #E4501C | 0 | 0.0 s |
| grep:TODO/FIXME/lorem/EXAMPLE_TRAIL/mock | 0 | 0.0 s |
| grep:SERVICE_ROLE côté client | 0 | 0.0 s |
| grep:projet Supabase fantôme | 0 | 0.0 s |
| rls | 0 | 54.2 s |
| rls | 1 | 0.1 s |

## Journal

```
# Explorer v2 · verify-all
- racine : /Users/fr168256/Desktop/lkdv-explorer-v2
- date : 2026-10-30T07:46:34.135Z

▶ type-check : npx tsc --noEmit
✔ type-check (410.0 s)

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
✔ lint (4.0 s)

▶ vitest : npx vitest run --reporter=dot explorer-v2

[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m

[2m Test Files [22m [1m[32m7 passed[39m[22m[90m (7)[39m
[2m      Tests [22m [1m[32m74 passed[39m[22m[90m (74)[39m
[2m   Start at [22m 08:53:29
[2m   Duration [22m 1.02s[2m (transform 408ms, setup 429ms, import 642ms, tests 199ms, environment 535ms)[22m

[33m(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.[39m
(node:40307) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:40308) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:40310) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:40309) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:40312) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:40311) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:40306) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ vitest (2.4 s)
⏭  build (ignoré)
… First Load JS /explorer introuvable dans le log de build (toléré hors phase 9)
… serveur de recette non détecté — PW_BASE_URL conservé
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
✅ PASS: Direct insert rejected. Error: TypeError: fetch failed

[TEST 2] Attempting direct update of reward_accounts...
✅ PASS: Direct update rejected. Error: TypeError: fetch failed

[TEST 3] Attempting direct insert into reward_withdrawals...
✅ PASS: Direct insert rejected. Error: TypeError: fetch failed

[TEST 4] Attempting to read all reward accounts...
✅ PASS: Read rejected. Error: TypeError: fetch failed

--- RLS INTRUSION TESTS COMPLETED ---
✔ rls (54.2 s)

▶ rls : node scripts/explorer-v2/test-rls-intrusion.mjs
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

[TypeError: fetch failed] {
  [cause]: Error: getaddrinfo ENOTFOUND icxyvwzfjbflcbqukpfz.supabase.co
      at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26) {
    errno: -3008,
    code: 'ENOTFOUND',
    syscall: 'getaddrinfo',
    hostname: 'icxyvwzfjbflcbqukpfz.supabase.co'
  }
}

Node.js v26.8.2
✘ rls — code 1

✘ ÉCHEC : test d’intrusion RLS rouge (scripts/explorer-v2/test-rls-intrusion.mjs)
```
