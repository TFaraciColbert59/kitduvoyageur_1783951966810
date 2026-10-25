# SLO & alertes comme code (Phase 10)

## 1. SLO versionnés

Source unique : `src/lib/observability/slo.ts` (`PHASE10_SLOS`), reprise du
tableau §Phase 10 de `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`.

| SLO | Cible | Comparateur | Mesurable aujourd'hui |
|---|---:|---|---|
| Disponibilité API principale | 99,9 % | ≥ | non (plateforme) |
| Lecture API p95 | < 300 ms | ≤ | proxy local A15 |
| Écriture API p95 | < 500 ms | ≤ | non (pas de scénario d'écriture) |
| Erreurs 5xx | < 1 % | ≤ | proxy local A15 |
| Synchronisations destructives | 0 | = | non (compteur ops à instrumenter) |
| Violations RLS | 0 | = | non (pgTAP + journaux DB) |
| Perte d'entrée carnet | 0 | = | non (réconciliation à instrumenter) |
| Jobs en attente (file domaine) | ≤ 50 | ≤ | **oui** (A14, base locale) |
| Retard max d'un job | ≤ 60 min | ≤ | **oui** (A14, base locale) |

Seuils « jobs » issus d'A14 (`DEFAULT_THRESHOLDS`) et documentés dans
`docs/reports/A14_OBSERVABILITY.md` §4.

## 2. Évaluation

Fonctions pures testées (`tests/observability/slo.spec.ts`) :

- `evaluateSlo(definition, mesures)` → `pass` | `fail` | `insufficient_data` ;
- `evaluatePhase10Slos(mesures)` → rapport (échecs, mesures manquantes, alertes) ;
- `alertDecision(rapport)` → `none` | `incomplete` (`page:false`) | `alert`
  (`page:true`).

Règle structurante : **une mesure absente n'est jamais un `pass`**. Un rapport
`ok: true` avec des mesures manquantes n'est pas « complet » ; il déclenche des
messages « instrumentation requise », pas un acquittement.

## 3. Commande de vérification

```powershell
# 1. Healthcheck A14 sur la base locale (lecture seule)
node scripts/ops/a14_healthcheck.mjs --json > docs/reports/PHASE_10_HEALTHCHECK.json

# 2. Vérification SLO (proxy local A15 + file domaine A14)
npm run ops:slo-check -- `
  --health docs/reports/PHASE_10_HEALTHCHECK.json `
  --load docs/reports/A15_LOAD_TEST.json `
  --ai-usage docs/reports/PHASE_10_AI_USAGE.json `
  --out docs/reports/PHASE_10_SLO_CHECK.json
```

Codes de sortie : `0` aucun SLO en échec (des mesures peuvent manquer),
`1` au moins un SLO en échec, `2` entrée illisible/configuration.

## 4. Alertes : évaluables ici, destinataire = item humain/ops

Le code produit des messages d'alerte déterministes :

```text
[SLO rls_violations] Violations RLS : observé 1 vs cible = 0 (source : …)
[SLO non mesuré] api_availability_ratio — instrumentation requise (…)
```

**Aucun destinataire réel n'est branché** (pas de compte pager/Slack/e-mail
provisionné dans ce dépôt). Tant que ce branchement n'est pas fait par un
humain/ops, les alertes restent locales et l'item correspondant est
`INSUFFICIENT_DATA` — jamais `PASS`.

Recommandation ops :

1. exécuter `ops:healthcheck` + `ops:slo-check` toutes les 5 minutes sur un
   runner distant ;
2. router `level=alert` vers la page d'astreinte et `level=incomplete` vers un
   canal de suivi d'instrumentation ;
3. conserver les rapports JSON (A14/A15/SLO) comme preuves horodatées.

## 5. Budget IA

`src/lib/observability/aiBudget.ts` (`evaluateAiBudget`) agrège
`ai_usage_daily` et compare :

- les plafonds réels par utilisateur (20 heavy / 100 fast par jour) — OK ;
- un plafond global de requêtes/jour — **non configuré** (`null`) ;
- un budget monétaire + coût unitaire — **non configurés** (`null`, modèles
  `:free`).

Résultat attendu en l'état : `insufficient_data` si aucun dépassement, avec la
raison exacte. Le trou (barème monétaire, budget global, alerte OpenRouter) est
un item humain/ops documenté dans `docs/reports/A15_COSTS.md` §4.
