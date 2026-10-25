# A9 — Hardening, bêta et mise en production — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Contraintes : toutes les phases précédentes ; ADR-AI-008 (shadow/rollout)

## Vision

Valider le système avant généralisation : audit sécurité, performance, backtesting,
shadow mode, rollout progressif et critères d'arrêt. Aucune nouvelle fonctionnalité
produit — durcissement et mesure.

## 9.1 Sécurité — audit systématique

Checklist exécutée et documentée dans `docs/reports/A9_SECURITY_AUDIT.md` :
RLS (toutes les tables du domaine), API (auth, zod, erreurs), rate limiting (Terrain Live),
upload photo (URL uniquement, taille), GeoJSON malformé (A2, taille max), fonctions SQL
(`SECURITY DEFINER` + search_path + REVOKE), service role (inventaire des usages),
secrets (aucune clé en dur), journalisation (aucune donnée santé), suppression utilisateur
(cascades vérifiées).

## 9.2 Performance

- Migration `20260911190000_a9_performance_indexes.sql` : index manquants justifiés
  (passages par segment+entrée, événements par acteur, observations par qualité) —
  additifs, partiels quand pertinent.
- Requêtes `EXPLAIN ANALYZE` documentées pour : proximité Terrain Live (GiST),
  agrégation collectives (seuil), prédictions par utilisateur, file d'événements (SKIP LOCKED).
- Budgets : taille pack offline (Dexie), fréquence des crons, coût IA (cache/fallback),
  batterie (recalcul avec anti-rebond 60 s).

## 9.3 Backtesting — `domain/backtesting.ts` (pur)

```ts
export interface BacktestSample { predictedP50Seconds: number; predictedP90Seconds: number; actualSeconds: number; predictedDifficulty: number | null; feltDifficulty: number | null; terrainBucket?: 'flat'|'ascent'|'descent'|'technical'|null; }
export interface BacktestMetrics { sampleCount: number; medianAbsErrorPct: number; meanAbsErrorPct: number; p90ErrorPct: number; p90Coverage: number; difficultyMae: number | null; driftByBucket: Record<string, number>; }
export function runBacktest(samples: BacktestSample[]): BacktestMetrics;
export function residualAnomalies(samples: BacktestSample[], thresholdPct?: number): { index: number; errorPct: number; reason: string }[];
```
Calibration : `p90Coverage` = part des `actualSeconds ≤ predictedP90` (cible ≥ 0.85).
`difficultyMae` seulement si les deux difficultés sont présentes.

## 9.4 Shadow mode — `domain/shadowMode.ts` (pur)

```ts
export const SHADOW_FLAGS = ['performance_profile_v2_shadow','route_prediction_v2_shadow','collective_intelligence_shadow','terrain_auto_detection_shadow'] as const;
export interface ShadowComparison { primary: number | null; shadow: number | null; deltaPct: number | null; agreement: boolean; }
export function compareShadow(input: { primary: number | null; shadow: number | null; tolerancePct?: number }): ShadowComparison;
export function summarizeShadow(comparisons: ShadowComparison[]): { count: number; agreementRate: number; medianDeltaPct: number | null };
```
Tolérance par défaut 15 %. Aucun effet utilisateur : comparaison uniquement.

## 9.5/9.6 Rollout et critères d'arrêt

`docs/reports/A9_ROLLOUT.md` : paliers interne → 1 → 5 → 20 → 50 → 100 %, critères d'arrêt
(fuite de données, erreur RLS critique, hausse d'erreurs, ETA dangereuse, faux signalements,
batterie, coûts, corruption, sync destructive), procédure de rollback (flags OFF, migration
additive réversible par feature flag, pas de DROP).

Migration `20260911200000_a9_domain_flags.sql` : seed idempotent des flags de domaine
(`performance_profile_v2`, `route_prediction_v2`, `collective_intelligence`, `terrain_live`,
+ les 4 `*_shadow`), tous `false`.

## 9.7 Vérification finale

- `npm run lint`, `type-check`, `test`, `build`, `verify:invariants`, `verify:icons`.
- `test:a11y`, `test:e2e`, `test:visual` : nécessitent un serveur — exécutés si l'environnement
  le permet, sinon gate manuelle documentée avec commandes exactes.
- Revue finale de branche (subagent-driven) sur l'ensemble `b67bf401..HEAD`.

## Tests (IDs)

- `TEST-A9-BT-01..05` : MAE médiane, couverture P90, tri par bucket, anomalie résiduelle,
  échantillon vide.
- `TEST-A9-SH-01..04` : accord/désaccord avec tolérance, delta null si données manquantes,
  résumé taux d'accord, aucune écriture (pureté).

## Commits

1. `feat(a9): backtesting des predictions et comparaison shadow`
2. `feat(db): a9 index de performance et flags de domaine`
3. `docs(a9): audit securite, rollout et rapport de verification`

## Gate de sortie

Tests complets verts ; migrations additives validées statiquement ; rollback documenté ;
observabilité listée ; critères d'arrêt publiés ; validation humaine avant généralisation.
