# A15 — Échelle & lancement · Rapport d'exécution (preuves réelles, local/test uniquement)

Date : 2026-09-11 · Worktree : `worktrees/ai-finalization` (branche `audit/adventure-intelligence`)
Environnement : Supabase local Docker (PostgreSQL 17.6, 127.0.0.1:54322/54321) + Next local
(`next start -p 4028`, build production). **Aucune production, aucun secret commité, flags OFF
en fin de session.**

## Statut global

| Livrable | Statut | Preuve principale |
|---|---|---|
| 1. Tests de charge locaux (3 scénarios) | Fait | `scripts/ops/a15_load_test.mjs` exécuté : 76 764 / 5 272 / 82 190 requêtes, p95 142 / 71 / 4,3 ms, 0 4xx/5xx ; `docs/reports/A15_LOAD_TEST.md` + JSON machine |
| 2. Budgets/coûts | Fait (inventaire) + externes identifiés | `docs/reports/A15_COSTS.md` : compteurs locaux mesurés (0 appel IA, 0 objet, 0 transaction), hypothèses marquées |
| 3. Builds mobiles | Web/Capacitor fait ; natif bloqué externe | `npm run mobile:build` OK (build 19,7 s, 77 pages, sync android/ios, 9 plugins) ; `gradlew assembleDebug` échoue (JDK 8 vs ≥ 11) ; `docs/reports/A15_MOBILE_BUILDS.md` |
| 4. Rollout automatisé (paliers + seuils A9) | Fait | `scripts/ops/a15_rollout.mjs` + `TEST-A15-ROLL-01..07` / `INT-01..04` (11 verts) : paliers 1/5/20/50/100 observés 1,7/4,9/21,8/50,1/100 %, 0 divergence bucket, état restauré ; `docs/reports/A15_ROLLOUT_RUNBOOK.md` |
| 5. Risques & dépendances externes | Documenté | `docs/reports/A15_LAUNCH_READINESS.md` : prérequis exacts, commande qui échoue, propriétaire, impact |

## Vérifications finales (exécutées)

```text
npm run test              → 281 fichiers passés / 2027 tests passés / 20 skippés (intégration gatée env)
npm run type-check        → exit 0
npm run lint              → exit 0 (warnings préexistants uniquement)
npm run verify:invariants → SUCCÈS (tous les invariants)
flags                     → 0 flag actif ; feature_flag_cohorts vide ; 0 terrain_reports ;
                            0 utilisateur jetable ; 0 plan de test résiduel
```

## Détail des preuves exécutées

1. **Charge proximité** : 2 000 signalements synthétiques + RPC réelle
   `a5_terrain_reports_near` via PostgREST, autocannon 8 (API programmatique) :
   76 764 req / 5 118 req/s, p50 75 ms, p95 142 ms, 100 % de 200, aucun 4xx/5xx.
2. **Charge conditions** : route Next réelle `GET /api/terrain/conditions` avec
   session `authenticated` générée localement (cookie `@supabase/ssr`), flag
   `terrain_live` ON pendant le test puis OFF : 5 272 req / 350,8 req/s, p95
   71 ms, 100 % de 200.
3. **Charge lecture plan** : benchmark SQL direct des 3 requêtes `getAdventurePlan` :
   82 190 opérations / 5 475,9 req/s, p95 4,3 ms, 0 erreur.
4. **Rollout réel** : `--verify` sur la base locale — palier 1 % → 1,7 %, 5 % →
   4,9 %, 20 % → 21,8 %, 50 % → 50,1 %, 100 % → 100 % ; borne allowlist/exclusion
   conforme ; buckets SQL ↔ TS identiques sur 1 000 UUID ; restauration `restored:true`.
5. **Critères d'arrêt** : `--check-stop` sur métriques locales réelles →
   `INSUFFICIENT_DATA` (23 runs < 1 000, ETA P90 et batterie absentes — honnête) ;
   fixture dégradée → `STOP` sur 6 critères, exit 3.

## Limites / actions humaines

- Les chiffres de charge sont **locaux** (Docker, sans TLS/CDN/pooler) : re-mesure
  obligatoire sur l'environnement de test distant avant palier ≥ 20 %.
- Calibration terrain : **0 paire prédiction/réel** en base de test → critère ETA
  P90 non validable (20 sorties réelles minimum, A12 §4).
- Batterie/appareils : campagne humaine requise (iOS compact + récent, Android
  milieu/haut, tablette).
- Juridique RGPD/AIPD/DPO : checkpoint humain (héritage A14).
- Secrets manquants : URL DB du projet de test + service key côté CI, 6 price IDs
  Stripe, plan Supabase prod, fournisseur de tuiles, budget/quota OpenRouter.

## Commits

1. `f2a05208` — feat(ops): A15 tests de charge locaux proximity/conditions/plan (preuves)
2. `dcee4a0e` — feat(ops): A15 rollout cohortes 1/5/20/50/100 et seuils d arret A9 automatises
3. `docs(a15): budgets, builds mobiles et readiness de lancement` (ce rapport)

## Fichiers livrés

- `scripts/ops/a15_load_test.mjs`, `scripts/ops/a15_rollout.mjs`, `scripts/ops/a15_rollout.d.mts`
- `tests/ops/a15-rollout.spec.ts`, `tests/ops/fixtures/a15-rollout-metrics-{healthy,degraded}.json`
- `docs/reports/A15_{LOAD_TEST,COSTS,MOBILE_BUILDS,ROLLOUT_RUNBOOK,LAUNCH_READINESS}.md`
- `docs/reports/A15_{LOAD_TEST,ROLLOUT_VERIFY}.json`
