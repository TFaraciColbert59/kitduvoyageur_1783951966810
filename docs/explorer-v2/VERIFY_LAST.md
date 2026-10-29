# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-29T19:09:49.213Z
- Mode : courant (--only=vitest,grep,rls)
- Résultat : ❌ ÉCHEC — test d’intrusion RLS rouge (scripts/explorer-v2/test-rls-intrusion.mjs)

## Étapes

| Étape | Code | Durée |
|---|---|---|
| vitest | 0 | 2.5 s |
| grep:couleur #E4501C | 0 | 0.0 s |
| grep:TODO/FIXME/lorem/EXAMPLE_TRAIL/mock | 0 | 0.0 s |
| grep:SERVICE_ROLE côté client | 0 | 0.0 s |
| grep:projet Supabase fantôme | 0 | 0.0 s |
| rls | 0 | 0.7 s |
| rls | 1 | 1.6 s |

## Journal

```
# Explorer v2 · verify-all
- racine : /Users/fr168256/Desktop/lkdv-explorer-v2
- date : 2026-10-29T19:09:39.381Z
⏭  type-check (ignoré)
⏭  lint (ignoré)

▶ vitest : npx vitest run --reporter=dot explorer-v2

[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m[33m[39m[32m·[39m

[2m Test Files [22m [1m[32m7 passed[39m[22m[90m (7)[39m
[2m      Tests [22m [1m[32m71 passed[39m[22m[90m (71)[39m
[2m   Start at [22m 20:09:40
[2m   Duration [22m 1.13s[2m (transform 854ms, setup 1.05s, import 830ms, tests 220ms, environment 720ms)[22m

[33m(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.[39m
(node:22984) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22988) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22986) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22985) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22983) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22987) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22982) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ vitest (2.5 s)
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
✘ geo_pois lisible publiquement (anon) — HTTP 401
✔ country_practical lisible publiquement — HTTP 200
✔ osm_poi_cache fermé au public — HTTP 200

10/11 contrôles verts
✘ rls — code 1

✘ ÉCHEC : test d’intrusion RLS rouge (scripts/explorer-v2/test-rls-intrusion.mjs)
```
