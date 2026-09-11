# A11 — Backtesting réel : harnais, seuils et exécution

Constats audit : **#35** (aucun backtesting réel livré) et **#41** (calibration
terrain). Le moteur pur existe dans
[`src/features/adventure-intelligence/domain/backtesting.ts`](../../src/features/adventure-intelligence/domain/backtesting.ts)
(`runBacktest`, `residualAnomalies`) ; ce lot livre le **dataset**, l'**exécution**,
le **rapport chiffré** et un seuil validé.

## Composants livrés

| Fichier | Rôle |
| --- | --- |
| `scripts/ai/a11_backtest.ts` | Harnais CLI : lecture JSON, `runBacktest`, rapport français, code de sortie. |
| `scripts/ai/fixtures/backtest-sample.json` | 48 échantillons réalistes (4 buckets × 12), couverture P90 93,8 %. |
| `tests/adventure-intelligence/backtest-harness.spec.ts` | `TEST-A11-BT-01..03` : fixture, seuil, rapport, CLI args. |

## Utilisation

```bash
npx tsx scripts/ai/a11_backtest.ts scripts/ai/fixtures/backtest-sample.json
npx tsx scripts/ai/a11_backtest.ts export-backtest.json --min-coverage=0.90
```

Sortie (fixture de référence) :

```text
=== Rapport de backtesting A11 ===
Échantillons analysés : 48
MAE médiane : 9.01 %
MAE moyenne : 11.71 %
P90 des erreurs absolues : 32.99 %
Couverture P90 : 93.8 % (cible ≥ 85.0 %) — OK
MAE difficulté : 0.75
Dérive par bucket (signée, % vs P50) :
  - flat : -1.92 % (surestimation)
  - ascent : +4.34 % (sous-estimation)
  - descent : +2.33 % (sous-estimation)
  - technical : +3.75 % (sous-estimation)
Anomalies (seuil 30 %) : 5
```

## Seuils

| Seuil | Valeur | Constante | Comportement |
| --- | --- | --- | --- |
| Couverture P90 minimale | **0,85** | `P90_COVERAGE_TARGET` | Code de sortie **1** si `p90Coverage < seuil` ou entrée vide. |
| Anomalie résiduelle | **30 %** | `DEFAULT_ANOMALY_THRESHOLD_PCT` | Listées dans le rapport, ne changent pas le code de sortie. |
| Seuil CLI | `--min-coverage=` | — | Borné 0..1 ; toute valeur invalide retombe sur 0,85. |

Autres règles : un fichier absent, un JSON illisible, un tableau vide ou un
échantillon non numérique ⇒ **sortie 1** avec message français. Aucune donnée
n'est inventée : le harnais ne fait que mesurer ce que contient le fichier.

## Exécution sur un export réel anonymisé (dès accès DB)

Prérequis : accès à la base (service role ou rôle lecture) et données
`route_predictions` confrontables aux sorties réelles. L'export doit rester
**anonymisé** : durées, difficultés et bucket uniquement, aucun identifiant.

1. Export brut de la base :

```bash
supabase link --project-ref <ref>
supabase db dump --data-only --schema public -f supabase_dump.sql
```

2. Transformation en tableau `BacktestSample` (une ligne JSON par échantillon).
   Requête à adapter au lien réel `plan ↔ sortie` (le map-matching #13 n'est pas
   encore branché, la jointure ci-dessous agrège par utilisateur et fenêtre) :

```sql
SELECT jsonb_agg(jsonb_build_object(
  'predictedP50Seconds', rp.total_duration_p50_s,
  'predictedP90Seconds', rp.total_duration_p90_s,
  'actualSeconds',       hs.duration_seconds,
  'predictedDifficulty', NULL,  -- à remplir via segment_predictions si disponible
  'feltDifficulty',      NULL,  -- à remplir via la difficulté ressentie déclarée
  'terrainBucket',       NULL   -- à remplir via le bucket de terrain du segment
))
FROM public.route_predictions rp
JOIN public.hike_sessions hs
  ON  hs.user_id = rp.user_id
  AND hs.ended_at >= rp.computed_at
  AND hs.duration_seconds BETWEEN rp.total_duration_p50_s * 0.5 AND rp.total_duration_p50_s * 2
WHERE rp.strategy = 'recommended'
  AND rp.computed_at >= now() - interval '180 days';
```

3. Exécution du harnais :

```bash
psql "$DATABASE_URL" -t -A -c "<requête ci-dessus>" > export-backtest.json
npx tsx scripts/ai/a11_backtest.ts export-backtest.json --min-coverage=0.85
```

Une couverture P90 inférieure au seuil doit **bloquer la promotion** de la
version de prédiction concernée (critère de rollout A9/A11).

## Déférés

- Historique des résultats et comparaison V1/V2 : aucune table de résultats
  n'est créée dans ce lot (le harnais est sans écriture).
- Remplissage réel de `predictedDifficulty` / `feltDifficulty` / `terrainBucket`
  dépend du map-matching (#13) et de la difficulté ressentie persistée.
- Biais montée/descente saisonniers complets (#41) : nécessite un export
  pluriannuel une fois la base disponible.
