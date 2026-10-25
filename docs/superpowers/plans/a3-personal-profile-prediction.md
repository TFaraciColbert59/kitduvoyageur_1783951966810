# A3 — Profil Terrain, difficulté et prédictions personnelles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD strict.

**Goal:** Profil Terrain appris, difficulté personnelle, ETA segment/route avec fallback sûr.

**Spec:** `docs/superpowers/specs/2026-09-11-a3-personal-profile-prediction-design.md`
**Contraintes:** ADR-AI-004/005/008 · aucune donnée santé · moteurs purs · flags a3.

## Global Constraints

- Aucune donnée santé connectée. Seules les observations Phase 2 + déclaratif.
- Moteurs purs sans I/O ; tests `tests/adventure-intelligence/*.spec.ts`, IDs `TEST-A3-*`.
- Réutiliser les types A1 : `PerformanceProfile`, `SegmentPrediction`, `RoutePrediction`,
  `Confidence`, `makeConfidence`, `CALIBRATION_LEVELS`, `TrackQuality`.
- Ne pas casser `CopilotEngine` : intégration optionnelle, défaut inchangé (15 min/km).
- `npm run test`, `npm run type-check` verts. Ne pas lancer `npm run build`.

---

### Task 1 — Profil de performance appris

**Files:** Create `src/features/adventure-intelligence/domain/performanceProfile.ts` ;
Test `tests/adventure-intelligence/performance-profile.spec.ts`.

**Interfaces (exact):**
```ts
export interface ProfileObservation { observedAt: string; distanceM: number; durationS: number; movingS?: number | null;
  gainM?: number | null; lossM?: number | null; meanGradePct?: number | null; surface?: string | null;
  packWeightKg?: number | null; quality?: number | null; declaredFatigue?: number | null; perceivedDifficulty?: number | null; }
export interface BuildProfileOptions { now?: string; halfLifeDays?: number; minQuality?: number; }
export function buildPerformanceProfile(observations: ProfileObservation[], options?: BuildProfileOptions): PerformanceProfile & { personalized: boolean };
export function weightedMedian(entries: { value: number; weight: number }[]): number | null;
export function rejectOutliersMAD(entries: { value: number; weight: number }[], threshold?: number): { value: number; weight: number }[];
export const CALIBRATION_THRESHOLDS = { calibration: 3, personalization: 10, contextualization: 20 };
```
Séparation plat/montée/descente : `meanGradePct` ∈ [-3,3] plat, > 3 montée, < -3 descente.
Allure = `distanceM / movingS` ; montée/descente en `m/h` = `gainM / movingS * 3600`.
Poids : `recency = 0.5 ^ (ageDays / halfLifeDays)` (défaut 90 j) × `quality ?? 0.5` ; profil froid si moins de 3 observations exploitables.
`confidence`: `makeConfidence({ score: … , sampleCount, method: 'weighted_median_a3' })` ;
score = f(sampleCount, dispersion) plafonné 0.95 ; `personalized = calibrationLevel !== 'cold'`.
Fatigue curve, pause model, pack response : modèles simples paramétriques (décroissance
exponentielle horaire, pauses = médiane des arrêts par heure, portage = régression linéaire
sur poids déclaré si ≥ 5 points sinon neutre). `modelVersion = 'a3-v1'`.

- [ ] Step 1 tests rouges `TEST-A3-PROF-01..08` (médiane pondérée, MAD, séparation plat/montée/descente, récence, profil froid, calibration 3/10, portage neutre sans données, confiance bornée).
- [ ] Step 2 implémenter. **Step 3** vert + type-check. **Step 4** commit `feat(a3): profil terrain appris (mediane ponderee, MAD, calibrations)`.

---

### Task 2 — Fatigue sans santé et résolution d'allure

**Files:** Create `domain/fatigue.ts`, `domain/paceResolver.ts` ;
Test `tests/adventure-intelligence/pace-resolver.spec.ts`.

**Interfaces (exact):**
```ts
export interface FatigueInput { activeDurationS: number; gainM: number; lossM: number; technicalClass?: number | null;
  packWeightKg?: number | null; pausesCount?: number; recentLoadS?: number | null; declaredFatigue?: number | null; }
export function computeFatigue(input: FatigueInput): { score: number; components: { label: string; value: number }[] }; // score 0..100
export interface ResolvedPace { paceMinPerKm: number; source: 'profile'|'generic'|'standard'; personalized: boolean; confidence: Confidence; }
export function resolvePace(input: { distanceM: number; gainM: number; lossM: number; surface?: string | null;
  profile?: PerformanceProfile | null; confidence?: Confidence | null; flagEnabled: boolean; }): ResolvedPace;
export const STANDARD_PACE_MIN_PER_KM = 15;
export const GENERIC_PACE_MIN_PER_KM = 13.5;
```
Cascade : flag désactivé ou profil absent/froid/confiance < 0.5 → `generic` si des données
génériques existent, sinon `standard` (15). Ajustement pente : +1 min/km par 100 m D+/km
(profil) ou +0.8 (générique), descente technique +0.4.

- [ ] Step 1 tests rouges `TEST-A3-PACE-01..07` (cascade profil/générique/standard, profil froid → non personnalisé, D+ augmente le temps, confiance propagée, source explicite).
- [ ] Step 2 implémenter. **Step 3** vert + type-check. **Step 4** commit `feat(a3): fatigue sans sante et cascade d'allure profil-generique-standard`.

---

### Task 3 — Prédiction segment et route

**Files:** Create `domain/prediction.ts` ; Test `tests/adventure-intelligence/prediction-a3.spec.ts`.

**Interfaces (exact):**
```ts
export const STRATEGIES = ['comfort','recommended','fast'] as const;
export function predictSegment(input: { segmentId: number; distanceM: number; gainM: number; lossM: number;
  meanGradePct?: number | null; technicalClass?: number | null; surface?: string | null; packWeightKg?: number | null;
  fatigueBefore?: number | null; }, profile: PerformanceProfile | null, confidence: Confidence | null,
  options?: { pace?: ResolvedPace }): SegmentPrediction;
export function predictRoute(input: { segments: { segmentId: number; distanceM: number; gainM: number; lossM: number; technicalClass?: number | null; }[];
  startAt: string; profile: PerformanceProfile | null; confidence: Confidence | null; packWeightKg?: number | null;
  turnaroundAfterS?: number | null; }, strategy: (typeof STRATEGIES)[number]): RoutePrediction;
```
P50 = durée segment via `resolvePace` ; P90 = P50 × facteur d'incertitude qui **augmente quand
la confiance baisse** (ex. `1.05 + 0.35 * (1 - score)`) ; la stratégie multiplie la vitesse
(`comfort 0.92`, `recommended 1.0`, `fast 1.12`) ; fatigue cumulée décroît l'allure au fil de
la route (`computeFatigue` par segment) ; `turnaroundTime` = début + `turnaroundAfterS` si fourni ;
`criticalSegmentIds` = top 3 difficulté ; facteurs explicables (`PredictionFactor[]` :
pente, technicité, portage, fatigue, confiance). Invariants de la spec vérifiés ici.

- [ ] Step 1 tests rouges `TEST-A3-PRED-01..10` (les 5 invariants + P90 ≥ P50 + stratégie rapide ≥ confort en vitesse + segments critiques + facteurs présents + pause recommandée proportionnelle + turnaround).
- [ ] Step 2 implémenter. **Step 3** vert + type-check. **Step 4** commit `feat(a3): predictions segment et route avec intervalles de confiance`.

---

### Task 4 — Flags, persistance du profil, intégration copilote

**Files:** Create `supabase/migrations/20260911150000_a3_feature_flags.sql`,
`server/featureFlags.ts`, `server/buildUserProfile.ts` ;
modify `src/features/hiking/copilot/CopilotEngine.ts` (optionnel, rétrocompatible) ;
Tests `tests/adventure-intelligence/build-profile.server.spec.ts`, `tests/adventure-intelligence/copilot-pace.spec.ts`.

**Interfaces (exact):**
```ts
export const A3_FLAGS = { performance_profile_v2: false, route_prediction_v2: false };
export async function currentAdventureFeatureFlags(): Promise<typeof A3_FLAGS>;
export interface ProfileBuildClient { getObservations(userId: string, limit?: number): Promise<ProfileObservation[]>;
  upsertProfile(row: unknown): Promise<{ id: string }>; insertProfileVersion(row: unknown): Promise<void>; }
export async function buildUserProfile(userId: string, client: ProfileBuildClient): Promise<{ status: 'built'|'cold'; sampleCount: number }>;
```
- Migration : insert idempotent des 2 flags (`ON CONFLICT (id) DO NOTHING`), aucun autre changement.
- `buildUserProfile` : idempotent par `modelVersion` (`a3-v1`), écrit le profil (upsert unique
  `user_id+activity_type`) puis une version snapshot ; profil vide → statut `cold`.
- Copilote : ajouter un paramètre optionnel de résolution d'allure (`resolvePace` injectable) ;
  sans paramètre, le comportement actuel (15 min/km) reste identique (test de non-régression).

- [ ] Step 1 tests rouges `TEST-A3-FLAG-01..02`, `TEST-A3-BUILD-01..04`, `TEST-A3-COP-01..02` (mocks client injecté + `vi.mock('@/lib/supabase/server')` pour les flags).
- [ ] Step 2 implémenter. **Step 3** `npx vitest run tests/adventure-intelligence src/features/hiking` + type-check.
- [ ] Step 4 commit `feat(a3): flags, persistance profil versionne et integration copilote optionnelle`.

---

### Task 5 — Vérification, rapport, tag

- [ ] Step 1 `npm run test`, `npm run type-check`, `npm run lint`, `npm run verify:invariants` verts.
- [ ] Step 2 `docs/reports/A3_VERIFICATION.md` + commit `docs(a3): rapport de verification phase 3` + `git tag a3-done`.

## Self-Review

- Couverture 3.1-3.7 : moteur V2 (T1), profil (T1/T4), calibration (T1), fatigue sans santé (T2),
  prédiction segment (T3), route (T3), remplacement 15 min/km (T2/T4). ✅
- Fallback sûr : cascade explicite + flag désactivé par défaut. ✅
- Aucune donnée santé. ✅
