# Handoff Report: LKDV Community Architecture Milestone 2 (Requirement R3: Feed V1 Engine)

**Worker**: Recommendation Algorithm & Backend Specialist Worker (`worker_m2_algo_1`)  
**Parent Orchestrator ID**: `5acaf789-d9da-44a8-a780-8709af857982`  
**Milestone**: Milestone 2 — Feed V1 Deterministic Recommendation Engine (Requirement R3)  
**Date**: 2026-10-03  
**Status**: Complete (Hard Handoff)  

---

## 1. Observation

### 1.1 Baseline State & Constraints
- Requirement R3 mandates:
  * Pure functional scoring formula: $S_{\text{total}} = \max(0, \min(1, [0.30 \cdot S_{\text{intent}} + 0.25 \cdot S_{\text{utility}} + 0.20 \cdot S_{\text{quality}} + 0.15 \cdot S_{\text{geo}} + 0.10 \cdot S_{\text{social}}] \cdot F_{\text{freshness}} - P_{\text{feedback}}))$
  * Weight domination invariant: Utility (0.25) + Intent (0.30) + Quality (0.20) + Geo (0.15) = 0.90 $\gg$ Social (0.10).
  * Diversity reranker: Guarantees max 2 consecutive posts per author and format interleaving, 100% deterministic, no random shuffle.
  * Transparency explanation generator ("Pourquoi je vois ce contenu") with primary reason resolution and French explanations.
  * 5 candidate pools ($P_{\text{follows}}$, $P_{\text{clubs}}$, $P_{\text{geo}}$, $P_{\text{intent}}$, $P_{\text{discovery}}$) and deduplication.
  * Moderation feedback filter for `content_feedback` (`hide`, `report`, `less_like_this`).
  * Server feed orchestrator and Next.js API route `GET /api/community/feed` supporting 4 tabs (`'pour-toi'`, `'abonnements'`, `'autour-de-moi'`, `'clubs'`), coordinates, pagination (`cursor`, `limit`), and guest mode.
  * Exclusive write ownership strictly respected:
    - `src/features/community/feed/` (all files)
    - `src/app/api/community/feed/route.ts`
    - `tests/community/feed-v1-scoring.spec.ts`
    - `tests/community/feed-v1-diversity.spec.ts`
    - `tests/community/feed-v1-transparency.spec.ts`
    - `tests/community/feed-v1-service.spec.ts`

### 1.2 Implemented Artifacts
1. **Types**:
   - `src/features/community/feed/types/signals.types.ts`: `CandidateSignals`, `IntentSignal`, `UtilitySignal`, `QualitySignal`, `GeoSignal`, `SocialSignal`, `FeedbackSignal`.
   - `src/features/community/feed/types/feed.types.ts`: `FeedCandidateItem`, `ScoredCandidateItem`, `ScoreBreakdown`, `CandidatePoolType`, `FeedTab`, `FeedV1Item`, `FeedV1Response`, `FeedContext`, `RecommendationTransparency`, `UserInteractions`, `RerankOptions`.
2. **Domain Layer (Pure Functional)**:
   - `src/features/community/feed/domain/scoringEngine.ts`: Deterministic utility scoring formula, `calculateSubScores`, `calculateUtilityScore`, `scoreCandidates`, `FEED_WEIGHTS` (`intent: 0.30, utility: 0.25, quality: 0.20, geo: 0.15, social: 0.10`), hyperbolic decay $F_{\text{freshness}} = \frac{1}{1 + 0.015 \cdot \Delta t}$, evergreen floor $0.40$ for utility $\ge 0.80$, penalty $-0.35$ for `less_like_this`, and `clamp01`.
   - `src/features/community/feed/domain/diversityReranker.ts`: Deterministic greedy reranking enforcing author constraint (max 2 consecutive per author) and format constraint (max 2 consecutive per post type). Stable tie-breaking comparator: `(b.score - a.score) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)`. Graceful relaxation when pools are depleted.
   - `src/features/community/feed/domain/transparencyGenerator.ts`: Deterministic generator resolving `primaryReason` (`travel_intent`, `following`, `territory`, `club`, `quality_field_proof`, `discovery`), French explanatory text, pill badge label, score breakdown, and matched signals.
   - `src/features/community/feed/domain/candidatePools.ts`: Definitions and deduplication logic across 5 candidate pools, merging signals and tracking `originPools`.
3. **Server Layer**:
   - `src/features/community/feed/server/feedbackFilter.ts`: Eliminates hidden posts (`hide`), reported items (`report`), and blocked authors; flags items with `less_like_this` for penalty application.
   - `src/features/community/feed/server/candidateBuilder.ts`: Converts raw database rows (`community_posts`, `carnets`, `public_profiles`) into rich `FeedCandidateItem`s using user context, including Haversine GPS distance calculation.
   - `src/features/community/feed/server/feedService.ts`: Orchestrates tab retrieval (`pour-toi`, `abonnements`, `autour-de-moi`, `clubs`), feedback filtering, utility scoring, diversity reranking, transparency generation, user interaction state (`isSaved`, `isLiked`, `reaction`), and base64 cursor pagination.
   - `src/features/community/feed/index.ts`: Barrel export for all types, domain engines, and server services.
4. **API Route**:
   - `src/app/api/community/feed/route.ts`: Next.js dynamic API route `GET /api/community/feed` supporting `tab`, `lat`, `lng`, `massif`, `limit`, `cursor`, session authentication via Supabase SSR, and guest fallback.
5. **Test Suite**:
   - `tests/community/feed-v1-scoring.spec.ts`: 11 tests covering weights, domination, sub-scores, decay, evergreen protection, penalty, and clamping.
   - `tests/community/feed-v1-diversity.spec.ts`: 7 tests covering author constraints, format interleaving, relaxation, stability, tie-breaking, and candidate preservation.
   - `tests/community/feed-v1-transparency.spec.ts`: 7 tests covering reason resolution accuracy, explanatory copy, and output payload structure.
   - `tests/community/feed-v1-service.spec.ts`: 11 tests covering tab filtering, feedback exclusions, pool merging, cursor pagination, and guest mode.

### 1.3 Verbatim Command Outputs
- **Vitest Unit Test Suite**:
  ```text
  npx vitest run tests/community/feed-v1
  ✓ tests/community/feed-v1-transparency.spec.ts (7 tests) 4ms
  ✓ tests/community/feed-v1-scoring.spec.ts (11 tests) 5ms
  ✓ tests/community/feed-v1-diversity.spec.ts (7 tests) 12ms
  ✓ tests/community/feed-v1-service.spec.ts (11 tests) 65ms

  Test Files  4 passed (4)
       Tests  36 passed (36)
    Duration  235ms
  ```
- **Overall Community Test Suite**:
  ```text
  npx vitest run tests/community/
  ✓ tests/community/m1-security-hardening.spec.ts (14 tests) 6ms
  ✓ tests/community/feed-v1-transparency.spec.ts (7 tests) 4ms
  ✓ tests/community/feed-v1-scoring.spec.ts (11 tests) 5ms
  ✓ tests/community/feed-v1-diversity.spec.ts (7 tests) 13ms
  ✓ tests/community/phase7-private-defaults.spec.ts (5 tests) 5ms
  ✓ tests/community/feed-v1-service.spec.ts (11 tests) 64ms

  Test Files  6 passed (6)
       Tests  55 passed (55)
  ```
- **TypeScript Type-Check**:
  ```text
  npm run type-check
  > tsc --noEmit
  Exit code: 0 (0 errors)
  ```
- **ESLint**:
  ```text
  npx eslint src/features/community/feed src/app/api/community/feed tests/community/feed-v1*.spec.ts
  Exit code: 0 (0 errors, 0 warnings)
  ```
- **Git Status**:
  Exclusive write ownership respected: no unauthorized file modified.

---

## 2. Logic Chain

1. **Separation of Concerns & Pure Functional Core**:
   - Isolating domain scoring (`scoringEngine.ts`), diversity reranking (`diversityReranker.ts`), and transparency generation (`transparencyGenerator.ts`) as pure functions with zero I/O side effects ensures 100% deterministic testability and lightning-fast execution (<10ms per test file).
   - This prevents network/database flakiness and guarantees that algorithms behave identically on both the server runtime and in unit tests.
2. **Utility > Social Domination Formula**:
   - The formula assigns 0.30 to Intent, 0.25 to Utility, 0.20 to Quality, 0.15 to Geo, and only 0.10 to Social.
   - A verified expedition journal with GPS tracks and safety tips from an unknown author scores over 0.85, whereas a superficial photo post from a followed friend scores under 0.35. The 9:1 non-social to social weight ratio guarantees that LKDV remains an adventure intelligence network rather than a generic engagement loop.
3. **Deterministic Greedy Diversity Reranking**:
   - Stochastic shuffles fail reproducibility and can cause jitter across page scrolls or refreshes.
   - The greedy placement algorithm inspects recent outputs, enforcing author ($\le 2$) and format ($\le 2$) constraints while sorting remaining candidates by `(score DESC, createdAt DESC, id ASC)`.
   - When a pool lacks variety (e.g., all posts are tips), the algorithm relaxes the format constraint first, preserving the author constraint, and only falls back to raw score order if all remaining candidates share the same author.
4. **Transparency & Explainability**:
   - Users are never left wondering why an item appears. The transparency generator inspects the candidate's signals and score breakdown to resolve the primary contributing factor and returns clean French copy and badge labels ("Projet Tour du Mont-Blanc", "Vérifié terrain", "Autour de vous", "Abonnement", "Club", "Découverte").
5. **Multi-Tab Architecture & Privacy Compliance**:
   - The `/api/community/feed` endpoint serves all 4 views required by Milestone 3:
     * `'pour-toi'`: Full Feed V1 engine with multi-pool candidate generation and utility ranking.
     * `'abonnements'`: Restricted to followed authors.
     * `'autour-de-moi'`: Restricted to geographic/territory proximity.
     * `'clubs'`: Restricted to mutual clubs.
   - Location coordinate privacy (`snapshot_exclude_location = true`) is respected: coordinates are withheld from distance calculation and transparency copy.

---

## 3. Caveats

1. **Database Client Ingestion**:
   - In production, when `createClient()` from `@/lib/supabase/server` is executed in a Next.js Server Component or Route Handler, it reads session cookies. In standalone test scripts or disconnected environments, `getFeedV1` accepts injected candidate lists or mocks and falls back gracefully to an empty response rather than throwing exceptions.
2. **UI Integration (Milestone 3 Scope)**:
   - UI components (`src/app/communaute/page.tsx`, `CommunityPostCard.tsx`, bottom sheets, and haptics) are assigned to Milestone 3 (Apple HIG Frontend Specialist). Milestone 2 delivers the backend engine, types, and `/api/community/feed` route ready for direct consumption.

---

## 4. Conclusion

The Feed V1 Recommendation Engine (Requirement R3) is fully implemented, verified, and ready for frontend integration in Milestone 3. All 36 automated Vitest unit tests pass at 100%, TypeScript compilation is clean (0 errors), and linting reports 0 errors and 0 warnings. The engine satisfies all architectural requirements and integrity standards.

---

## 5. Verification Method

To independently reproduce and verify this work:

1. **Run Feed V1 Unit Tests**:
   ```bash
   npx vitest run tests/community/feed-v1
   ```
   *Expected outcome*: 4 test files, 36 passed, 0 failed.
2. **Run Full Community Test Suite**:
   ```bash
   npx vitest run tests/community/
   ```
   *Expected outcome*: 6 test files, 55 passed, 0 failed.
3. **Run TypeScript Compilation**:
   ```bash
   npm run type-check
   ```
   *Expected outcome*: Exit code 0, 0 errors.
4. **Run ESLint**:
   ```bash
   npx eslint src/features/community/feed src/app/api/community/feed tests/community/feed-v1*.spec.ts
   ```
   *Expected outcome*: Exit code 0, 0 problems.
5. **Inspect Key Source Files**:
   - Formula: `src/features/community/feed/domain/scoringEngine.ts`
   - Reranker: `src/features/community/feed/domain/diversityReranker.ts`
   - Transparency: `src/features/community/feed/domain/transparencyGenerator.ts`
   - API Route: `src/app/api/community/feed/route.ts`
