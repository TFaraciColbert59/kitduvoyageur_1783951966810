# A15 — Runbook de rollout progressif (paliers, seuils d'arrêt, rollback)

Date : 2026-09-11 · Script : `scripts/ops/a15_rollout.mjs` · Tests : `tests/ops/a15-rollout.spec.ts`
Preuve machine : `docs/reports/A15_ROLLOUT_VERIFY.json` (généré, non retouché).

> Toutes les commandes de ce runbook s'exécutent **en local ou sur l'environnement de
> test uniquement**. Le script refuse tout DSN non local (`A15_ROLLOUT_ALLOW_REMOTE=1`
> pour un test distant assumé). Aucune écriture production dans ce runbook : en
> production, la bascule se fait par `UPDATE feature_flags.enabled` / cohorte avec
> validation humaine (ADR-AI-008).

## 1. Pré-requis

- Base d'essai avec la migration A11 (`feature_flag_cohorts`, `current_feature_flags_for`).
- DSN local par défaut : `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- `npm run test` vert, `A15_LOCAL_INTEGRATION=1` pour les tests d'intégration locale.

## 2. Paliers A9 et contrôles

| Palier | Population | Contrôles A9 avant passage | Vérification automatisée |
|---|---|---|---|
| 0 — Interne | équipe (allowlist) | pgTAP, revue sécurité | `--verify` borne 0 % + allowlist/exclusion |
| 1 — 1 % | cohorte aléatoire | erreurs < baseline, pas d'ETA dangereuse | taux observé ±4 pts sur 1 000 UUID |
| 2 — 5 % | + cohorte | qualité map-matching, agrégats ≥ seuil | idem + critères d'arrêt |
| 3 — 20 % | + cohorte | faux signalements, modération | idem + critère 4 |
| 4 — 50 % | moitié | batterie, coûts, sync offline | idem + critères 5-7 |
| 5 — 100 % | tous | validation humaine explicite | idem + 7 jours sans déclencheur |

## 3. Preuve d'exécution locale (2026-09-11)

Commande : `node scripts/ops/a15_rollout.mjs --verify --json --out docs/reports/A15_ROLLOUT_VERIFY.json`

| Palier | Attendu | Observé (1 000 UUID) | Buckets SQL↔TS divergents | Verdict |
|---|---|---|---|---|
| 1 % | 1 % | 1,70 % | 0 | PASS |
| 5 % | 5 % | 4,90 % | 0 | PASS |
| 20 % | 20 % | 21,80 % | 0 | PASS |
| 50 % | 50 % | 50,10 % | 0 | PASS |
| 100 % | 100 % | 100,00 % | 0 | PASS |
| 0 % + allowlist/exclusion | allowlist seule | 0 % + 2/2 cas conformes | 0 | PASS |

État restauré en fin de test : `restored: true`, `initialEnabled: false`, flag OFF.
Tests : `TEST-A15-ROLL-01..07` + `TEST-A15-ROLL-INT-01..04` (11 tests verts avec
`A15_LOCAL_INTEGRATION=1`).

## 4. Critères d'arrêt automatisés (A9 → `evaluateStopCriteria`)

Entrées (fichier JSON ou métriques locales) — un champ `null`/absent produit
`insufficient_data`, jamais un faux « continue » :

```json
{
  "requests24h": 5000,
  "errorRate24h": 0.01,
  "baselineErrorRate24h": 0.01,
  "etaCoverageP90": 0.9,
  "etaSampleSize": 120,
  "terrainCriticalFalseReports": 0,
  "moderationFailure": false,
  "batteryPctPerHour": 2,
  "debounceOk": true,
  "monthlyCostOverBudget": false,
  "sessionCorruption": false,
  "offlineSyncDestructive": false
}
```

| Critère A9 | Règle automatisée | Seuil |
|---|---|---|
| 1. Fuite / RLS critique | booléen | tout `true` ⇒ arrêt |
| 2. Erreurs > 2× baseline 24 h | ratio | `errorRate24h > 2 × baselineErrorRate24h`, échantillon ≥ 1 000 |
| 3. ETA dangereuse | couverture P90 | `< 0,75` avec ≥ 30 paires prédiction/réel |
| 4. Faux signalements | compteur | `≥ 3` ou défaut de modération |
| 5. Batterie/anti-rebond | %/h + booléen | `> 5 %/h` ou anti-rebond 60 s KO |
| 6. Budget IA/tuiles | booléen | dépassement ⇒ arrêt |
| 7. Session/offline | booléen | corruption/sync destructive ⇒ arrêt |

Commandes :

```bash
node scripts/ops/a15_rollout.mjs --check-stop --metrics <metriques.json>   # exit 3 si arrêt
node scripts/ops/a15_rollout.mjs --check-stop                              # métriques locales réelles
```

Exécution locale réelle : décision `INSUFFICIENT_DATA` (23 runs moteurs, ETA P90
et batterie non mesurées localement) — les critères 3 et 5 exigent la campagne
terrain (`A12_LOAD_AND_DEVICE_TEST_PLAN.md`) et les métriques de production.
Fixture dégradée (`tests/ops/fixtures/a15-rollout-metrics-degraded.json`) :
décision `STOP` sur 6 lignes, exit 3 — la détection fonctionne.

## 5. Procédure de bascule (test/staging)

1. Capturer l'état : le script le fait (`snapshotFlag`) avant toute écriture.
2. Appliquer le palier :
   `node scripts/ops/a15_rollout.mjs --verify` (démonstration locale) ou, pour un
   environnement de test, appliquer la cohorte :
   ```sql
   INSERT INTO feature_flag_cohorts (flag_id, percentage, allowlist, exclusions)
   VALUES ('terrain_live', 5, '{}', '{}')
   ON CONFLICT (flag_id) DO UPDATE SET percentage = 5, updated_at = now();
   UPDATE feature_flags SET enabled = true WHERE id = 'terrain_live';
   ```
3. Vérifier : `SELECT public.current_feature_flags_for('<uuid-test>');`
4. Observer 7 jours (erreurs, ETA, terrain, batterie, coûts) puis passer au palier suivant.

## 6. Rollback immédiat

```sql
UPDATE feature_flags SET enabled = false WHERE id = '<flag>';
-- optionnel : DELETE FROM feature_flag_cohorts WHERE flag_id = '<flag>';
```

Aucun `DROP` : migrations additives, base compatible V1 (cf. `A9_ROLLOUT.md`).
Consigner l'incident + métriques dans `docs/reports/`.

## 7. Limites / dépendances externes

- Les paliers de ce runbook sont **prouvés localement** ; la bascule réelle en
  production reste une action humaine explicite (ADR-AI-008).
- Les critères 2 (baseline), 3 (ETA réelle) et 5 (batterie) ne sont pas
  mesurables dans l'environnement local : sans données de production/terrain,
  le calcul reste `insufficient_data` — il ne vaut pas autorisation de passage.
- L'application réelle des cohortes en production nécessite le(s) flag(s)
  concernés **câblés** (A9 §Flags consommés) : `performance_profile_v2` n'a pas
  encore de consommateur moteur.
