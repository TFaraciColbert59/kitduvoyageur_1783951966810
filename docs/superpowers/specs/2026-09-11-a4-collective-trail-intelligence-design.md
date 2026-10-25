# A4 — Intelligence collective des sentiers — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Contraintes : ADR-AI-003 (4 niveaux), ADR-AI-005 (moteurs purs), ADR-AI-006 (jobs idempotents)

## Vision

Fusionner les passages de plusieurs utilisateurs en difficulté collective par segment,
**normalisée par personne** (jamais de moyenne de vitesses brutes), avec seuils de
confidentialité stricts. Migrer le prototype `TrailIntelligenceEngine` (route-level,
`Math.random()`, client, non persistant) vers le calcul serveur déterministe et versionné.

## Pipeline

```text
passages éligibles (consentement collectif_terrain actif + session terminée
  + qualité GPS/map-matching + comportement plausible)
→ ratio_normalisé = temps_observé / temps_attendu_pour_cette_personne (profil A3)
→ buckets de conditions (sec/humide/neige/glace/jour/nuit/montée/descente/sac léger/lourd)
→ agrégation robuste (médiane pondérée, P25/P50/P75/P90, MAD, qualité, récence, diversité)
→ scores (effort, technicité, fatigue, orientation, ralentissement, difficulté collective, confiance)
→ seuil de publication : ≥ 5 utilisateurs distincts, confiance suffisante, récence suffisante
→ upsert segment_collective_aggregates (idempotent, processor_version a4-v1)
```

## Moteurs purs

`src/features/adventure-intelligence/domain/collectiveIntelligence.ts` :

```ts
export interface CollectivePassage {
  passageId: string; userIdHash: string; segmentId: number; direction: 'forward'|'reverse';
  observedDurationS: number; expectedDurationS: number; quality: number; observedAt: string;
  conditionBucket: ConditionBucket; uturnDetected: boolean; offRoute: boolean;
}
export interface CollectiveAggregate {
  segmentId: number; conditionBucket: ConditionBucket; direction: 'forward'|'reverse';
  passageCount: number; distinctUserCount: number;
  weightedMedianSlowdown: number; p25: number; p50: number; p75: number; p90: number;
  effortScore: number; technicalScore: number; fatigueScore: number; orientationScore: number;
  slowdownScore: number; collectiveDifficulty: number; confidence: Confidence;
}
export function normalizedSlowdown(observedDurationS: number, expectedDurationS: number): number; // observed/expected, expected<=0 => 1
export function isPublishable(a: { distinctUserCount: number; confidence: Confidence; computedAt: string }, options?): boolean;
export function aggregateCollective(passages: CollectivePassage[], options?: AggregateOptions): CollectiveAggregate[];
export function weightedMedian(values: { value: number; weight: number }[]): number | null;
export function percentile(values: number[], p: number): number | null;
export function detectAnomalies(values: { value: number; weight: number }[], madThreshold?: number): { kept: ...; rejected: ... };
export function assignConditionBucket(input: { surface?: ...; weather?: ...; isNight?: boolean; isAscent?: boolean; packWeightKg?: number | null }): ConditionBucket;
```

Règles :
- Pondération : `quality × récence (demi-vie 180 j) × winsorisation [0.25, 4]`.
- Anomalies : MAD, seuil 3,5 (jamais la médiane seule).
- `slowdownScore` = clamp((médiane − 1) × 50 + 50, 0, 100) ;
  `effortScore` = f(médiane, variance) ; `technicalScore` = f(uturns, offRoute, variance) ;
  `fatigueScore` = f(durée observée > attendue aux heures tardives) ; `orientationScore` = f(offRoute ratio) ;
  `collectiveDifficulty` = combinaison pondérée (effort 0,4, technique 0,25, fatigue 0,2, orientation 0,15).
- Confiance : `makeConfidence({ score: f(distinctUsers, passages, dispersion), sampleCount: passages, method: 'collective_weighted_median_a4' })`.
- **Non publiable** si `distinctUserCount < 5` OU confiance < 0.5 OU dernière observation > 730 j.

`domain/collectiveEligibility.ts` :

```ts
export interface EligibilityInput { consentCollective: boolean; sessionFinished: boolean;
  gpsQuality: number; mapMatchQuality: number; plausibleMovement: boolean; passageQuality: number; }
export function collectiveEligibility(input: EligibilityInput): { eligible: boolean; reasons: string[] };
```
Seuils : gps ≥ 0.6, mapMatch ≥ 0.6, plausibleMovement `true`, passageQuality ≥ 0.5 ;
reasons explicites pour chaque refus.

## Serveur

- `server/aggregateSegments.ts` — client injecté :
  `getEligiblePassages(segmentIds, sinceDays)`, `getConsents(userIds)`, `getExpectedDurations(passages)`,
  `upsertAggregates(rows)`. Construit les `CollectivePassage`, agrège, filtre les non publiables,
  persiste (idempotent `processor_version = 'a4-v1'`, `onConflict: segment_id,condition_bucket,direction,processor_version`).
- `src/app/api/cron/aggregate-segments/route.ts` — POST, `CRON_SECRET`, `force-dynamic`,
  lots de segments récents, résumé JSON. Aucune donnée individuelle dans la réponse.
- Migration `20260911160000_a4_aggregation_support.sql` :
  index `performance_observations (user_id, observed_at)` déjà présent ;
  ajout d'un index partiel passages `(segment_id, observed_at)` sur `eligible_for_collective = true` ;
  RPC `a4_recent_eligible_segments(p_since interval, p_limit int)` (service_role, STABLE) —
  segments avec passages éligibles récents. Additif, idempotent.

## Migration du prototype

`src/features/hiking/intelligence/TrailIntelligenceEngine.ts` :
- suppression de `Math.random()` → identifiants déterministes (`segmentId` + hash stable) ;
- entrée par segment (agrégats A4) au lieu de route-level ;
- délégation au moteur pur `aggregateCollective` quand des passages sont fournis ;
- conservation d'une façade rétrocompatible pour les appelants existants (tests hiking verts).

## Tests (IDs)

- `TEST-A4-AGG-01..10` : ratio normalisé (pas de vitesse brute), médiane pondérée vs moyenne,
  percentiles, MAD (outlier rejeté), buckets de conditions séparés, sens séparés, plancher de
  publication `< 5` utilisateurs, confiance faible non publiable, ancienneté non publiable, scores bornés.
- `TEST-A4-ELIG-01..05` : consentement requis, session terminée, qualités minimales, plausible, raisons.
- `TEST-A4-SRV-01..04` : client factice — passages consentis uniquement, upsert idempotent, filtre seuil, aucune donnée individuelle dans la sortie.
- `TEST-A4-LEG-01..02` : `TrailIntelligenceEngine` sans `Math.random()` (résultats identiques sur
  appels répétés), façade rétrocompatible.

## Commits

1. `feat(a4): agregation collective robuste (mediane ponderee, buckets, seuils)`
2. `feat(a4): eligibilite collective — consentement et qualites`
3. `feat(db): a4 support d'agregation (index partiel + RPC segments eligibles)`
4. `feat(a4): orchestrateur serveur + cron d'agregation`
5. `refactor(a4): TrailIntelligenceEngine deterministe par segment (Math.random supprime)`

## Gate de sortie

- difficulté collective par segment ; seuil de confidentialité ; confiance ; conditions ;
  aucune donnée individuelle publique ; carte de données agrégées (vue A1) ; prototype migré.
