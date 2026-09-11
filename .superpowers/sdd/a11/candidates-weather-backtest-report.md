# A11 — Plans candidats, météo réelle et harnais de backtesting

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`).
Audit source : `docs/architecture/adventure-intelligence-audit-31bdb279.md`,
constats **#14** (trois variantes ≠ trois plans complets), **#15** (sections
vides / météo), **#35** (aucun backtesting réel), **#40** (sources vivantes).
Aucun flag activé, commentaires/messages en français, Zod 4.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `a199a884` | `feat(a11): trois plans candidats complets` | #14 |
| `0b20cbe6` | `feat(a11): meteo reelle quand les coordonnees existent` | #15, #40 (météo) |
| ce commit | `feat(a11): harnais de backtesting reel` | #35 + ce rapport |

## A. Trois plans candidats complets (`a199a884`)

Fichiers :
- `src/features/adventure-intelligence/domain/candidatePlans.ts` (nouveau)
- `src/features/adventure-intelligence/server/generateAdventure.ts`
- `src/app/api/adventure/[id]/route.ts`, `src/app/api/adventure/generate/route.ts`
- `tests/adventure-intelligence/candidate-plans.spec.ts` (nouveau, CAND-01→06)
- mocks de tests existants complétés (`adventure-api`, `generation-limits`)

Décisions :
- `buildCandidatePlans({ plan, strategyInputs })` retourne **trois
  `AdventurePlan` complets** dans l'ordre canonique comfort → balanced →
  adventure. Chaque plan est un `structuredClone` : aucune référence partagée
  avec le plan de base ni entre candidats (vérifié CAND-01).
- Différenciation déterministe branchée sur `candidates.ts` : facteur distance
  `1 + effortDeltaPct/100` (0,88 / 1,00 / 1,22), facteur jours
  `1 + durationDeltaPct/100`, facteur durée = distance / facteur d'allure A3.
  Stratégie d'allure par défaut : comfort → `comfort`, balanced →
  `recommended`, adventure → `fast` (`CANDIDATE_PACE_STRATEGIES`,
  surchargeable). Totaux distance/durée strictement ordonnés
  confort ≤ équilibré ≤ aventure (CAND-02).
- Sections modifiées : `terrainAnalysis`, `activityRoutes`, `paceStrategies`
  (durées/P90/ETA mis à l'échelle, primaire choisie), `dailyStages`
  (`stageDistanceKm`/`stageDurationH` ajoutés), `budget` (delta publié sur
  total/perPerson/summary), `alternatives` (annotations confort/risque +
  `selected`). Chaque modification ajoute une provenance `estimated`
  (`a11:candidatePlans:<id>`), une hypothèse et fixe `computedAt`/`updatedAt`
  à l'horodatage unique de la variante (CAND-04). La confiance globale gagne
  une raison « Variante … ».
- Persistance sans changement de schéma : `snapshot.candidates` dans la
  version initiale (`versionRow`). `getAdventurePlan` revalide chaque candidat
  via `adventurePlanSchema.array()` et `GET /api/adventure/[id]` renvoie
  `candidates` uniquement quand ils existent (CAND-06). `POST generate` et la
  réponse de réutilisation renvoient aussi `candidatePlans`.
- Immutabilité : test par gel profond + instantané JSON (CAND-05).

## B. Météo réelle quand les coordonnées existent (`0b20cbe6`)

Fichiers :
- `src/features/adventure-intelligence/server/adapters/weatherAdapter.ts` (nouveau)
- `src/features/materiel/services/getWeather.ts` (paramètre `forecastDays` 1..16, défaut 5)
- `server/adapters/skippedAdapters.ts` (retrait de la météo), `server/adapters/index.ts`
- `server/generateAdventure.ts` (`coordinates`/`weatherDays`, `liveConditions`)
- `src/app/api/adventure/generate/route.ts` (Zod borné)
- `tests/adventure-intelligence/weather-adapter.spec.ts` (WX-01→04),
  `tests/adventure-intelligence/adapters.spec.ts` (TEST-A6-ADP-08 adapté)

Décisions :
- Réutilisation stricte du client existant `getWeather` (Open-Meteo), aucune
  nouvelle intégration. `weatherDays` borné 1..7 (défaut 3) côté route ET
  adaptateur ; l'horizon fournisseur est passé à `forecast_days`.
- Coordonnées valides ⇒ `PlanValue` publié dans **`sections.liveConditions`**
  (la liste normative de 19 sections n'a pas de clé `weather`) avec
  `provenance[0] = { source: 'official', sourceRef: 'open-meteo' }`,
  confiance `weather:open-meteo` (0,7) et `computedAt` du contexte (WX-01).
- Sans coordonnées ⇒ skip explicite `weather_no_deterministic_source`, aucun
  appel fournisseur. Erreur/timeout/retour vide ⇒ skip
  `weather_provider_unavailable` (ajouté à `FALLBACK_WARNING_CODES`), jamais
  de fausse prévision (WX-02/03).
- Le fournisseur peut rendre moins de jours que demandé : la série est
  tronquée telle quelle, avertissement `weather_forecast_partial`, aucune
  journée complétée artificiellement (WX-04). Injection de bout en bout dans
  le plan vérifiée (liveConditions + run `weather` succeeded) et absence de
  coordonnées vérifiée (liveConditions null + run skipped).

## C. Harnais de backtesting réel (ce commit)

Fichiers :
- `scripts/ai/a11_backtest.ts` (nouveau, runnable `npx tsx …`)
- `scripts/ai/fixtures/backtest-sample.json` (48 échantillons, 4 buckets × 12)
- `tests/adventure-intelligence/backtest-harness.spec.ts` (BT-01→03)
- `docs/reports/A11_BACKTESTING.md` (usage, seuils, commande export réel)

Décisions :
- Le script réutilise le moteur pur `runBacktest`/`residualAnomalies`
  (aucune duplication de calcul), exporte `buildBacktestReport`,
  `formatBacktestReportFr`, `evaluateBacktestExitCode`, `parseBacktestArgs`
  (importables sans exécuter `main`, garde `a11_backtest*` + comparaison
  `fileURLToPath`).
- Rapport français : nombre d'échantillons, MAE médiane/moyenne, P90 des
  erreurs, couverture P90 vs seuil, MAE difficulté, dérive signée par bucket,
  anomalies résiduelles avec index/erreur/raison.
- Code de sortie : 0 si échantillon non vide et `p90Coverage ≥ seuil`
  (défaut 0,85) ; 1 si entrée vide, fichier illisible/JSON invalide,
  échantillon non numérique ou couverture sous le seuil. Vérifié en CLI :
  fixture ⇒ 0, `--min-coverage=0.99` ⇒ 1, sans argument ⇒ 1.
- Fixture conçue pour passer le seuil : couverture **93,8 %** (45/48), MAE
  médiane 9,01 %, dérives distinctes par bucket, 5 anomalies (> 30 %).

## Preuves TDD / vérifications

- Rouge → vert par lot : CAND (module `candidatePlans` absent puis 6/6),
  WX (module weatherAdapter absent puis 4/4), BT (script/fixture puis 3/3).
- `npx vitest run tests/adventure-intelligence` :
  - après commit A : **62 fichiers, 374 tests verts** ;
  - après commit B : **63 fichiers, 378 tests verts** ;
  - après commit C (avant commit) : **64 fichiers, 381 tests verts**.
- Avant ce commit : `npm run test` complet ⇒ **262 fichiers verts + 1 skip**
  (`countries_geo` sans env, 6 tests), **1 896 tests verts**, 0 échec.
- `npm run type-check` et `npm run lint` : 0 erreur (warnings historiques hors
  périmètre inchangés). Aucun `npm run build`. Aucun fichier
  `src/app/hub/[section]/page.tsx` ni `src/features/hub/mobile/export*` touché.

## Explicitement différé (aucun code dans ce lot)

1. **Groupe / trek / entitlements bout-en-bout** (persistance, endpoints,
   écrans) : nécessite un cycle produit UI, hors périmètre P1 technique.
2. **Réglementations et documents** : toujours `skipped` motivés
   (`regulations_no_deterministic_source`, `documents_no_deterministic_source`)
   faute de source officielle déterministe en scope ; conditions live
   (Terrain Live) non injectées dans le plan au-delà de la météo.
3. **Ops de rollout (observation 20 jours)** : documenté dans
   `A9_ROLLOUT.md` / migration cohortes, non instrumenté ici.
4. **Historique de backtesting et comparaison V1/V2** : le harnais est sans
   écriture, aucune table de résultats livrée.

## Réserves / concerns

1. Aucune base Supabase locale dans cet environnement : les commandes d'export
   du `A11_BACKTESTING.md` sont documentées mais non exécutées ; la jointure
   `route_predictions ↔ hike_sessions` reste approximative tant que le
   map-matching (#13) n'est pas branché.
2. Les plans candidats mettent les distances/dénivelés à l'échelle des deltas
   publiés : ce sont des estimations marquées `estimated` avec provenance
   dédiée, pas une géométrie alternative réelle (pas de trace map-matchée).
3. `weatherAdapter` n'est pas derrière un flag : le déclencheur est la
   présence de coordonnées dans la requête, aucune activation de flag.
4. Le fixture de backtesting est réaliste mais synthétique ; seule sa
   structure et son seuil sont validés, pas une calibration terrain (#41).
