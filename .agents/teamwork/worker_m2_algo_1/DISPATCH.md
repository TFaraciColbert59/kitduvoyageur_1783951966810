## 2026-10-03T17:51:00Z
You are the Recommendation Algorithm & Backend Specialist Worker for LKDV Community Architecture Milestone 2 (R3: Feed V1 Engine).

Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_algo_1
Project root: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810
Original user request path: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Project specification: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md
Explorer survey report: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_survey_algo_1\handoff.md
M1 database handoff: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m1_db_1\handoff.md

Domain Skills to consult:
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agent\skills\typescript-advanced-types\SKILL.md
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agent\skills\javascript-testing-patterns\SKILL.md

Exclusive Write Ownership:
- src/features/community/feed/ (all files)
- src/app/api/community/feed/route.ts
- tests/community/feed-v1-scoring.spec.ts
- tests/community/feed-v1-diversity.spec.ts
- tests/community/feed-v1-transparency.spec.ts
- tests/community/feed-v1-service.spec.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission Objectives:
1. Implement the complete, deterministic Feed V1 engine in `src/features/community/feed/`:
   - `types/feed.types.ts` & `types/signals.types.ts`: Complete types for candidates, scored items, candidate pools, user signals, feed context, transparency metadata, and feed responses.
   - `domain/scoringEngine.ts`: Pure functional scoring formula:
     * Formula: S_total = max(0, min(1, [0.30 * S_intent + 0.25 * S_utility + 0.20 * S_quality + 0.15 * S_geo + 0.10 * S_social] * F_freshness - P_feedback))
     * Intent (0.30): matches active/upcoming trips, destination, primary activity, imminence multiplier.
     * Utility (0.25): verified linked carnet, GPS track, tip/safety notes, verified gear.
     * Quality (0.20): author trust score, loyalty level (ambassadeur/guide/expert), substantial content.
     * Geo (0.15): proximity to user location or active basecamp.
     * Social (0.10): author followed, club affiliation.
     * Freshness decay and feedback penalty from content_feedback (hide, less_like_this).
     * Utility + Intent + Quality + Geo = 0.90 >> Social (0.10).
   - `domain/diversityReranker.ts`: Pure functional diversity reranker:
     * Guarantees max 2 consecutive posts per author.
     * Enforces format/typology interleaving (tips, questions, verified carnets, shares).
     * 100% deterministic, no random shuffle.
   - `domain/transparencyGenerator.ts`: Deterministic transparency explanation generator:
     * Resolves primary contributing factor and returns human-readable French explanation ("Pourquoi je vois ce contenu").
     * Full score breakdown factors.
   - `domain/candidatePools.ts`: Candidate pool definitions and union/deduplication logic across the 5 pools:
     * P_follows (user follows)
     * P_clubs (user joined clubs)
     * P_geo (territory/massif proximity)
     * P_intent (upcoming trips & active adventure intentions)
     * P_discovery (trending, verified carnets, high-trust tips)
   - `server/feedbackFilter.ts`: Filters out posts/authors marked with 'hide' or 'report' in `content_feedback`, and applies penalties for 'less_like_this'.
   - `server/feedService.ts`: Server-side orchestrator querying Supabase client (using existing types from `src/lib/supabase/types.ts`) or generating feed from candidates, applying privacy filters, scoring, diversity reranking, and transparency metadata.
   - `index.ts`: Clean public exports.
2. Next.js Server Route:
   - `src/app/api/community/feed/route.ts`:
     * Handles GET request with query params: `tab` ('pour-toi' | 'abonnements' | 'autour-de-moi' | 'clubs'), `lat`, `lng`, `limit`, `cursor`.
     * Validates session user (or handles guest mode gracefully).
     * Returns structured `FeedV1Response`.
3. Comprehensive Vitest Unit Tests:
   - `tests/community/feed-v1-scoring.spec.ts`: Test scoring formula, weight domination (utility > social), freshness decay, penalty.
   - `tests/community/feed-v1-diversity.spec.ts`: Test max 2 consecutive author constraint, format interleaving, stability.
   - `tests/community/feed-v1-transparency.spec.ts`: Test explanation generation and reason resolution accuracy.
   - `tests/community/feed-v1-service.spec.ts`: Test server feed service pipeline.
4. Verification:
   - Run `npx vitest run tests/community/feed-v1*.spec.ts` (100% pass required).
   - Run `npm run type-check` (0 errors required).
   - Run `npm run lint` (0 errors required).
   - Document commands, outputs, and files created in your handoff.md.

Deliverable:
Write your full report to c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_algo_1\handoff.md and notify the orchestrator via send_message when complete.
