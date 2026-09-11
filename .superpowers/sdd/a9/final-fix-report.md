# A9 — Final-review fixes — Rapport

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Commit : `bb66bd69` — `fix(a9): gating par flags, server-only adaptateurs et rapport A7`
- Périmètre : 22 fichiers (2 nouveaux), 215 insertions, 12 suppressions

## Fix 1 — Rapport A7 manquant

- Créé `docs/reports/A7_VERIFICATION.md` (français, style A6/A8) : livrables `domain/cockpit.ts`,
  `domain/recalcTriggers.ts`, `offline/db.ts`, `offline/operations.ts`, `ui/*` ; preuve
  `tests/adventure-intelligence` **35 fichiers / 233 tests** à la livraison + suite complète verte
  à l'époque ; revue **Approved, 0 Critical/Important**, correctif a11y `97e5ddcc` (`role="group"`) ;
  gate (cockpit borné, anti-rebond 60 s, offline V2 idempotent, UI prête à monter — montage +
  Playwright différés) ; mineurs différés (null-guards cockpit, `bg-white/60` non tokenisé, contrat
  heuristique de pause, Dexie non testé en Node). Aucun chiffre inventé.

## Fix 2 — Flags de domaine consommés

- `server/featureFlags.ts` : `currentAdventureFeatureFlags()` renvoie désormais aussi
  `collective_intelligence` et `terrain_live` (optionnels ; `undefined` si absents de la RPC ⇒
  traités comme désactivés). `A3_FLAGS` et le comportement des tests A3 existants sont inchangés.
- `POST /api/terrain/reports`, `POST /api/terrain/reports/[id]/confirm`, `GET /api/terrain/conditions` :
  `terrain_live !== true` ⇒ `503 { error: 'Fonctionnalité non activée' }` sans traitement.
- `POST /api/cron/aggregate-segments` : `collective_intelligence !== true` ⇒
  `200 { skipped: 'flag_disabled' }` sans agrégation.
- `POST /api/adventure/generate` : lit les flags et les passe à `generateAdventure`
  (`AdventureGenerationInput.featureFlags` optionnel) → injectés dans `AdventureExecutionContext`.
  `predictionAdapter` et `difficultyAdapter` transmettent `route_prediction_v2` via
  `routePredictionEnabled(context)` (`predictRoute` accepte `flagEnabled`, défaut `true`).
  Contexte sans flags (tests/appels internes) ⇒ comportement rétrocompatible inchangé.
- Non gatés (conforme) : `process-hike-sessions`, `expire-terrain-reports` (maintenance privée).

## Fix 3 — `import 'server-only'`

- Ajouté aux **11** fichiers de `src/features/adventure-intelligence/server/adapters/*.ts`
  (adapterSupport, budget, coherence, difficulty, gear, index, intent, prediction, route, safety,
  skipped) — aucun import client (vérifié : seuls `generateAdventure.ts` et la route API les importent).

## Fix 4 — Exactitude `docs/reports/A9_ROLLOUT.md`

- Nouvelle table « Flags consommés (état à la livraison A9) » : `terrain_live` (APIs terrain),
  `collective_intelligence` (cron d'agrégation), `route_prediction_v2` (contexte injecté →
  prediction/difficulty), `performance_profile_v2` (déclaré/injecté, pas de consommateur moteur),
  `*_shadow` (aucun runner shadow livré).
- Rollback : précise que `enabled = false` n'agit que sur les flags câblés ; les flags non câblés
  restent inertes. Shadow mode : plus de claim d'exécution silencieuse effective.

## Preuves (avant commit)

| Commande | Résultat |
|---|---|
| `npx vitest run tests/adventure-intelligence` | ✅ 43 fichiers, 265 tests, 0 échec (dont `terrain-flag-gating.spec.ts`, 2 tests) |
| `npm run test` (suite complète) | ✅ 242 fichiers, 1786 tests, 0 échec |
| `npm run type-check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 (avertissements préexistants uniquement, aucun sur les fichiers modifiés) |

## Non câblé / limites assumées

- `performance_profile_v2` : lu et injecté dans le contexte, mais aucun moteur ne le consomme
  aujourd'hui (le profil est fourni aux adaptateurs par l'appelant) — documenté dans A9_ROLLOUT.
- `route_prediction_v2` : consommé par `predictionAdapter`/`difficultyAdapter` ; le flux
  `/api/adventure/generate` ne fournit pas encore de profil, donc l'effet runtime est limité aux
  appels directs avec profil (gate néanmoins effective).
- `*_shadow` : déclarés, aucun runner shadow — documenté.
