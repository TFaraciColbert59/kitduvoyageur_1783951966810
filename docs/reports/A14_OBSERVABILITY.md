# A14 — Observabilité (preuves exécutées)

Date : 2026-09-11 · Environnement : **base Supabase locale** `supabase_db_ai-finalization`
(conteneur Docker, port 54322) — **aucune donnée de production, aucun PII exporté**.
Script : `scripts/ops/a14_healthcheck.mjs` · Tests : `tests/ops/a14-healthcheck.spec.ts` (7 tests verts).

## 1. Ce qui existe (a11) et ce qui a été complété (a14)

- `adventure_engine_runs` : corrélation déjà livrée en a11 (`correlation_id`,
  `pipeline_version`, `external_calls`, `fallback_count`) — **vérifiée sur données
  réelles** ci-dessous.
- a14 ajoute la **supervision exploitable** : `scripts/ops/a14_healthcheck.mjs`
  interroge la base locale (lecture seule), calcule profondeur des files, âge des
  éléments en retard, ratio d'échecs des moteurs et latence RPC réelle, puis sort
  **0 (sain) / 1 (dégradé) / 2 (connexion) — jamais un faux « sain »**.
- Garde-fou anti-production intégré : un DSN non local est **refusé** sauf
  `A14_HEALTHCHECK_ALLOW_REMOTE=1` (test TEST-A14-OPS-HEALTH-04).

## 2. Requêtes de contrôle réelles exécutées (base locale)

Commande exécutée :

```text
node scripts/ops/a14_healthcheck.mjs
```

Sortie réelle (2026-09-11T20:34:20Z, exit 0) :

```text
=== A14 healthcheck Adventure Intelligence (base locale) ===
Généré : 2026-09-11T20:34:20.439Z
Runs moteurs : total=23, 24h=23 (succès=17, échecs=0, skipped=6, durée moy=1 ms, p95=2 ms)
File événements domaine : attente=0, échec=0, plus vieil en attente=0 min
File générations : attente=0, plus ancienne=0 min
Latence RPC current_feature_flags : moy=0.59 ms (n=5)
RÉSULTAT : SAIN (tous les seuils respectés).
5xx HTTP : non mesurable localement — seuils documentés (prod) : alerte > 1 % sur 15 min, page > 5 %.
```

Requêtes SQL de contrôle exécutées directement (sorties réelles) :

```text
SELECT status, count(*) AS runs, round(avg(duration_ms),1) AS avg_ms, round(max(duration_ms)) AS max_ms
FROM public.adventure_engine_runs GROUP BY status ORDER BY runs DESC;
 status    | runs | avg_ms | max_ms
-----------+------+--------+--------
 succeeded |   17 |    1.3 |      5
 skipped   |    6 |    0.3 |      1

SELECT count(*) FILTER (WHERE correlation_id IS NOT NULL) AS runs_correles,
       count(*) FILTER (WHERE pipeline_version IS NOT NULL) AS runs_versionnes, ...
 runs_correles | runs_versionnes | runs_avec_appels_externes
---------------+-----------------+---------------------------
            22 |              22 |                          0
```

## 3. Alerte réellement testée en local (dégradé puis retour sain)

Injection réelle de 60 événements en attente vieux de 90 min dans la base locale
(jetable, supprimés ensuite) :

```text
INSERT 0 60
...
File événements domaine : attente=60, échec=0, plus vieil en attente=90 min
ÉCHEC : file événements domaine : 60 en attente > 50
ÉCHEC : file événements domaine : plus vieil élément en attente depuis 90.0 min > 60
RÉSULTAT : DÉGRADÉ (2 seuil(s) dépassé(s)).
EXIT_DEGRADED=1
```

Après `DELETE` des 60 lignes de test : `RÉSULTAT : SAIN` — **exit 0**.
Les codes de sortie sont aussi verrouillés par tests (`--snapshot`) :
TEST-A14-OPS-HEALTH-01 (0), -02 (1), -03 (2).

## 4. Seuils (documentés, mesurables localement)

| Contrôle | Seuil alerte | Source | Action |
|---|---|---|---|
| `adventure_engine_runs` échecs 24 h | ratio > 20 % (si ≥ 10 runs) | local | investiguer `error`, couper le flag concerné |
| File `adventure_domain_events` en attente | > 50 | local | vérifier cron `process-adventure-events`, dead-letter (attempts ≥ 5) |
| Âge du plus vieux `pending` | > 60 min | local | reprise cron / dead-letter |
| File `adventure_generation_requests` en attente | > 20 | local | vérifier `process-ai-jobs`/`run-adventure-shadows` |
| Âge plus ancienne génération en attente | > 30 min | local | idem |
| Latence RPC `current_feature_flags()` | moyenne > 250 ms | local | vérifier charge Postgres / index |
| Erreurs API 5xx | > 1 % sur 15 min (alerte), > 5 % (page) | **non mesurable localement** (plateforme d'hébergement) | gel du rollout (A9_ROLLOUT) |

## 5. Dashboards & alertes — définition opérationnelle (à provisionner côté plateforme)

Les définitions ci-dessous sont la spécification des tableaux de bord ; la partie
**vérifiable en local** est le healthcheck ci-dessus (exécuté, exit 0/1 prouvés).

| Dashboard | Panneau | Requête | Seuil |
|---|---|---|---|
| Adventure Ops | Runs moteurs par statut (24 h) | `adventure_engine_runs` groupé `status` | échecs > 20 % |
| Adventure Ops | Profondeur files | counts `pending` ci-dessus | cf. §4 |
| Adventure Ops | Latence RPC | chrono `current_feature_flags` / `a5_terrain_reports_near` | p95 > 300 ms |
| Adventure Ops | Corrélation d'une génération | `WHERE correlation_id = <id>` (tous les runs d'un plan) | — |
| API Health | 5xx par route (15 min) | logs plateforme | > 1 % alerte, > 5 % page |
| Coûts IA | `ai_usage_daily` vs budget | table `ai_usage_daily` | dépassement budget |

Exemple de requête de corrélation (disponible localement) :

```sql
SELECT engine_id, status, duration_ms, started_at
FROM public.adventure_engine_runs
WHERE correlation_id = :correlation
ORDER BY started_at;
```

## 6. Limites assumées

- 5xx et RUM ne sont pas mesurables sur la base locale : seuils documentés,
  instrumentation plateforme requise (ticket humain, non bloquant pour a14 code).
- Le healthcheck est un outil d'exploitation ponctuel (CI/astreinte), pas un
  service temps réel : la supervision continue reste à brancher sur la plateforme.
