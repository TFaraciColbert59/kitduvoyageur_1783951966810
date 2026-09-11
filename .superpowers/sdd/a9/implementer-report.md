# A9 — Hardening, bêta et production — Rapport implémenteur (commit 1)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Spec normative : `docs/superpowers/specs/2026-09-11-a9-hardening-beta-production-design.md` (9.3 / 9.4)
- Périmètre : **commit 1 uniquement** — 2 modules domaine purs + 2 fichiers de tests
- Contraintes respectées : aucune I/O / supabase / fetch dans le domaine, **`npm run build` jamais exécuté**, seuls les 4 fichiers du commit ont été créés et commités (rapport non commité).

## Commit

`1b1cfd99` — `feat(a9): backtesting des predictions et comparaison shadow`

## Fichiers

| Fichier | Lignes | Contenu |
| --- | --- | --- |
| `src/features/adventure-intelligence/domain/backtesting.ts` | 174 | `runBacktest`, `residualAnomalies`, types `BacktestSample`/`BacktestMetrics`/`ResidualAnomaly`, constantes `P90_COVERAGE_TARGET`, `DEFAULT_ANOMALY_THRESHOLD_PCT`, `TERRAIN_BUCKETS` |
| `src/features/adventure-intelligence/domain/shadowMode.ts` | 115 | `SHADOW_FLAGS` (4 flags exacts de la spec), `compareShadow`, `summarizeShadow`, `DEFAULT_SHADOW_TOLERANCE_PCT = 15` |
| `tests/adventure-intelligence/backtesting.spec.ts` | 124 | `TEST-A9-BT-01..05` (5 tests, describe FR) |
| `tests/adventure-intelligence/shadow-mode.spec.ts` | 106 | `TEST-A9-SH-01..04` (4 tests, describe FR) |

Interfaces conformes à la spec au caractère près (`BacktestSample`, `BacktestMetrics`, `ShadowComparison`, signatures `runBacktest`, `residualAnomalies`, `compareShadow`, `summarizeShadow`, `SHADOW_FLAGS`). Types additionnels exportés (compatibles structurellement) : `TerrainBucket`, `ResidualAnomaly`, `ShadowFlag`, `ShadowSummary`, `ShadowComparisonInput`.

## TDD — Preuve RED / GREEN

**RED** (avant création des modules) :

```
RUN v4.1.11
 ❯ tests/adventure-intelligence/backtesting.spec.ts (0 test)
 ❯ tests/adventure-intelligence/shadow-mode.spec.ts (0 test)
Error: Cannot find package '@/features/adventure-intelligence/domain/backtesting' imported from tests/adventure-intelligence/backtesting.spec.ts
Error: Cannot find package '@/features/adventure-intelligence/domain/shadowMode' imported from tests/adventure-intelligence/shadow-mode.spec.ts
Test Files  2 failed (2) · Tests  no tests
```

**GREEN** (après implémentation) :

```
npx vitest run tests/adventure-intelligence/backtesting.spec.ts tests/adventure-intelligence/shadow-mode.spec.ts
 ✓ tests/adventure-intelligence/shadow-mode.spec.ts (4 tests)
 ✓ tests/adventure-intelligence/backtesting.spec.ts (5 tests)
Test Files  2 passed (2) · Tests  9 passed (9)
```

**Répertoire complet** : `npx vitest run tests/adventure-intelligence` → **42 fichiers / 263 tests passés**, 0 échec (A8 laissait 40/254).

**Gate qualité** :
- `npm run type-check` : exit 0.
- `npm run lint` : exit 0 ; **zéro occurrence** des 4 nouveaux fichiers dans la sortie (avertissements préexistants ailleurs uniquement).
- `npm run build` : **jamais exécuté**.

## Décisions de formules (backtesting)

1. **Erreur signée** : `errorPct = (actualSeconds − predictedP50Seconds) / predictedP50Seconds × 100`. Positive = sous-estimation (le réel dépasse le P50). Un `predictedP50Seconds <= 0` ou non fini rend l'échantillon inexplotable (exclu des agrégats, `sampleCount` reste la taille d'entrée).
2. **`medianAbsErrorPct`** : médiane des erreurs absolues ; moyenne des deux valeurs centrales si n pair (convention identique à `multiDayTrek`).
3. **`meanAbsErrorPct`** : moyenne arithmétique des erreurs absolues.
4. **`p90ErrorPct`** : 90e percentile des erreurs **absolues**, méthode du rang le plus proche `sorted[ceil(0.9 × n) − 1]` — choix retenu car la couverture P90 est déjà une métrique séparée ; l'erreur P90 mesure donc la queue des écarts de durée. Documenté dans le module.
5. **`p90Coverage`** : `actualSeconds <= predictedP90Seconds` (inclusif), dénominateur = échantillons avec P90 et réel exploitables (sinon `samples.length`) ; `P90_COVERAGE_TARGET = 0.85` exporté.
6. **`difficultyMae`** : MAE `|predictedDifficulty − feltDifficulty|` **uniquement** sur les paires où les deux sont non nulles et finies ; `null` si aucune paire.
7. **`driftByBucket`** : moyenne **signée** `errorPct` par bucket non nul, clés dans l'ordre canonique `flat, ascent, descent, technical` (déterminisme), buckets absents omis.
8. **`residualAnomalies`** : seuil par défaut `DEFAULT_ANOMALY_THRESHOLD_PCT = 30` (la spec ne le fixe pas ; constante exportée), comparaison stricte `|errorPct| > threshold`, sortie triée par index d'entrée, raison FR avec direction (`sous-estimation` / `surestimation`), valeur arrondie et seuil.
9. **Arrondis** : pourcentages à 2 décimales, `p90Coverage`/`agreementRate` à 4 décimales — évite tout flottant parasite sans masquer les écarts.

## Décisions de formules (shadow)

1. **`deltaPct`** : `(shadow − primary) / |primary| × 100` (dénominateur en valeur absolue pour garder un signe lisible si `primary < 0`).
2. **Accord** : `|deltaPct| <= tolerancePct`, évalué sur la valeur **non arrondie**, tolérance par défaut 15 %, tolérance invalide/négative → défaut.
3. **Données manquantes** : `primary` ou `shadow` null (ou non fini) ⇒ `deltaPct: null`, `agreement: false` ; les deux null ⇒ idem.
4. **`primary === 0`** : `shadow === 0` ⇒ delta 0 et accord ; sinon delta indéfini (`null`) et désaccord.
5. **`summarizeShadow`** : `count` = total des comparaisons (y compris deltas null, comptés comme désaccords) ; `agreementRate = accords / count` (0 si vide, jamais `NaN`) ; `medianDeltaPct` = médiane des deltas **non nuls**, `null` si aucun.
6. **Pureté** : aucun état module, aucun accès flag, aucun I/O — seuls des objets neufs sont retournés (test `SH-04` avec `Object.freeze` et snapshot JSON).

## Couverture des cas limites exigés

- Échantillon vide : `runBacktest([])` → `{ sampleCount: 0, medianAbsErrorPct: 0, meanAbsErrorPct: 0, p90ErrorPct: 0, p90Coverage: 0, difficultyMae: null, driftByBucket: {} }`, assertions `Number.isNaN === false` (BT-05) ; `residualAnomalies([])` → `[]`.
- Paires de difficulté nulles : exclues de `difficultyMae` (BT-01 : paires (3,null) et (null,4) ignorées ; (2,2) et (4,6) → MAE 1) ; aucune paire → `null` (BT-05).
- Shadow/primary manquant : delta `null`, accord `false` (SH-02, les 3 combinaisons).
- Bucket null/absent : exclu de `driftByBucket` (BT-03).

## Concerns

1. **`p90ErrorPct` est ambigu dans la spec** (aucune formule donnée) : j'ai opté pour le 90e percentile des erreurs absolues, la couverture P90 couvrant déjà la calibration. Si le contrôleur attend `(actual − predictedP90)/predictedP90`, seule la fonction `runBacktest` est à ajuster — les tests BT-01 sont les seuls impactés.
2. **`DEFAULT_ANOMALY_THRESHOLD_PCT = 30` est un choix d'implémenteur** (non spécifié). Exporté et verrouillé par BT-04 ; ajustable sans changement d'API.
3. **`sampleCount` = taille d'entrée**, y compris les échantillons inexplotables (P50 ≤ 0/non fini) exclus des agrégats : choix de transparence. Aucun cas de test ne couvre ce chemin (les prédictions valides dominent).
4. **`primary === 0`** : convention delta `null`/désaccord sauf `0 vs 0` ; la spec ne tranche pas, documenté dans le module.
5. **`SHADOW_FLAGS` n'est pas consommé** par le module (pas de lecture de flags, pas d'effet utilisateur) : conforme 9.4 ; le rollout (commit 2, seed migration) et l'observabilité restent côté contrôleur.
6. **Aucun adaptateur** : les deux modules sont purs, sans persistance ni lecture d'observations réelles ; le branchement sur les données de session (collecte + stockage des paires prédit/réel) n'existe pas dans ce commit et devra être câblé lors du rollout ou d'une phase ultérieure.
