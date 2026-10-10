# Handoff Report — Recommendation Engine & Feed V1 Architectural Survey (Requirement R3)

**Author:** Recommendation Engine Explorer (`explorer_survey_algo_1`)  
**Target:** Orchestrator & Backend Implementation Specialist  
**Working Directory:** `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_survey_algo_1`  
**Date:** 2026-10-03  
**Handoff Type:** Hard (Survey Complete)

---

## 1. Observation

Direct observations from examining the codebase, database schemas, existing components, and test infrastructure:

### 1.1 Existing Feed Implementations & Post Retrieval Logic
1. **Frontend Hub Page (`src/app/communaute/page.tsx:115-120`)**:
   Post retrieval is purely unpersonalized, chronological, and hardcoded to a limit of 20 items:
   ```typescript
   // src/app/communaute/page.tsx lines 115-120
   const [postsRes, carnetsRes, clubsRes, groupsRes, eventsRes] = await Promise.allSettled([
     supabase
       .from('community_posts')
       .select('*')
       .order('created_at', { ascending: false })
       .limit(20),
     ...
   ]);
   ```
   There is **no scoring**, **no candidate filtering**, **no diversity check**, and **no personalization**.
2. **Mock Feed Page (`src/app/feed/page.tsx:12-15`)**:
   Contains a static, hardcoded array `const JOURNALS = [...]` with 2 mock entries and client-side filtering (`j.verified`, `j.gpsTrace`). It is completely detached from the database and not connected to user accounts or social graphs.
3. **API Routes (`src/app/api`)**:
   There is **no feed API route** (`src/app/api/feed` or `src/app/api/community/feed` does not exist). The only carnet-related route is `src/app/api/carnets/[id]/publish/route.ts` which handles progression reward triggers.
4. **Post Card Interaction State (`src/components/communaute/CommunityPostCard.tsx:109-110, 346-356`)**:
   - `isSaved` (`user_saved`) and `isHidden` are stored purely in local React component state (`useState`).
   - Toggling save (`handleToggleSave()`) and hiding a post (`handleHidePost()`) merely alter component state and display a toast:
     ```typescript
     // src/components/communaute/CommunityPostCard.tsx lines 346-356
     const handleToggleSave = () => {
       setIsSaved(!isSaved);
       setShowMoreMenu(false);
       showToast(isSaved ? 'Retiré de vos favoris' : 'Enregistré dans vos favoris ⭐');
     };

     const handleHidePost = () => {
       setIsHidden(true);
       setShowMoreMenu(false);
       showToast('Publication masquée de votre fil.');
     };
     ```
   - Neither action writes to Supabase or impacts future post retrieval.
5. **Post Publication (`src/app/communaute/publier/page.tsx:312-323`)**:
   Inserts directly into `community_posts` with fields: `author_id`, `content`, `post_type` (`question`, `event`, or `share`), `likes_count: 0`, `comments_count: 0`, `image_url`, `linked_carnet_id`, and `correlation_id`.

### 1.2 Database Schemas & Candidate Signal Sources
1. **`community_posts` Table (`supabase/migrations/20260713120000_community_features.sql`, `20260911500000_phase2_chain_integrity.sql`, `20260911530000_phase7_carnet_private_default.sql`)**:
   - Columns: `id (uuid)`, `author_id (uuid)`, `content (text)`, `image_url (text)`, `image_alt (text)`, `post_type (text: 'post','tip','question','share')`, `linked_carnet_id (uuid)`, `likes_count (int)`, `comments_count (int)`, `shares_count (int)`, `is_trending (bool)`, `correlation_id (uuid)`, `snapshot_payload (jsonb)`, `snapshot_at (timestamptz)`, `snapshot_exclude_location (bool)`, `created_at (timestamptz)`, `updated_at (timestamptz)`.
2. **`user_follows` Table (`supabase/migrations/20260713120000_community_features.sql:253-260`)**:
   - Columns: `id (uuid)`, `follower_id (uuid)`, `following_id (uuid)`, `created_at (timestamptz)`.
   - Index: `UNIQUE INDEX idx_user_follows_unique ON public.user_follows(follower_id, following_id)`.
3. **`club_members` Table (`supabase/migrations/20260713120000_community_features.sql:110-118`)**:
   - Columns: `id (uuid)`, `club_id (uuid)`, `user_id (uuid)`, `role (text)`, `status (text: 'active','banned','pending')`.
   - Index: `UNIQUE INDEX idx_club_members_unique ON public.club_members(club_id, user_id)`.
4. **`carnets` Table (`supabase/migrations/20260713120000_community_features.sql:8-31`)**:
   - Columns: `id (uuid)`, `author_id (uuid)`, `title (text)`, `destination (text)`, `description (text)`, `route_rating (numeric)`, `visibility (text: 'public','private','friends')`, `tags (text[])`, `map_points (jsonb)`, `verified (bool)`.
5. **`trips` Table (`supabase/migrations/20260904050000_trips_core.sql:44-69`)**:
   - Columns: `id (uuid)`, `user_id (uuid)`, `destination_country_code (text)`, `destination_name (text)`, `start_date (date)`, `end_date (date)`, `status (trip_status)`, `primary_activity (trip_activity_type: 'hiking','trekking',...)`.
6. **`public_profiles` View (`src/lib/queries/publicProfilesCore.ts:19-22`)**:
   - Fields: `id`, `full_name`, `avatar_url`, `trust_score (number | null)`, `bio`, `location`, `website`, `loyalty_points`, `loyalty_level`, `xp`, `level`.

### 1.3 Testing Infrastructure
1. **Vitest Configuration (`vitest.config.ts`)**:
   - Environment: `node`
   - Include: `['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx']`
   - Path aliases: `@` mapped to `src/`, `server-only` mocked for test environment via `tests/mocks/server-only.ts`.
2. **Command Verification**:
   - Ran `npx vitest run tests/community/phase7-private-defaults.spec.ts`: exited with **code 0** in **161ms** (5 passed).
   - Ran `npm run type-check`: exited with **code 0** (`tsc --noEmit` passed with 0 errors).
3. **Domain Engine Reference Patterns (`src/features/adventure-intelligence/domain/affiliationRanking.ts` & `candidates.ts`)**:
   - Pure functional domain scoring engines with strict TypeScript types, deterministic calculations, zero side-effects, and isolated unit test suites in `tests/adventure-intelligence/affiliation-ranking.spec.ts`.

---

## 2. Logic Chain

From the observations above, we establish the following architectural reasoning:

1. **Why Current Retrieval Fails Requirement R3**:
   - `src/app/communaute/page.tsx:117-120` retrieves the latest 20 rows from `community_posts` ordered by `created_at DESC` unconditionally.
   - If an author publishes 4 posts in 10 minutes, those 4 posts dominate the top of every user's feed (zero author diversity).
   - A superficial 1-sentence post scores identically to a 15-day verified expedition journal containing GPS traces, safety notes, and gear reviews.
   - A user preparing an upcoming trek in "Chartreuse" receives no boost for Chartreuse-specific terrain updates, despite that being the core value proposition of LKDV ("vérifié par les données de terrain").
2. **Candidate Generation Partitioning (Multi-Pool Architecture)**:
   - Running a massive SQL JOIN with complex scoring at query time across millions of rows causes high latency and unpredictable query planning.
   - The industry-standard and robust approach is **two-stage retrieval**:
     - **Stage 1 (Candidate Generation)**: Retrieve small, high-recall candidate sets ($K \approx 10-30$ items per pool) across 5 specialized pools:
       - $P_{\text{follows}}$: Recent posts from authors in `user_follows`.
       - $P_{\text{clubs}}$: Posts published by members of user's active clubs (`club_members`).
       - $P_{\text{geo}}$: Posts tagged or located in user's home territory or preferred massifs.
       - $P_{\text{intent}}$: Posts matching destinations or activities of user's upcoming active `trips`.
       - $P_{\text{discovery}}$: Verified carnets, trending posts (`is_trending`), and high-trust author tips.
     - **Stage 2 (Deduplication & Union)**: Merge pool outputs into a candidate set $\mathcal{C}$ (typical size: 50–100 items).
3. **Utility-First Scoring Formulation**:
   - To fulfill the mandate *"Utility > simple engagement"*, the scoring formula must heavily penalize clickbait while rewarding real adventure preparation, mountain safety, and verified gear/GPS proofs.
   - Social signals (likes/follows) are kept at a modest weight ($0.10$).
   - Utility ($0.25$), Intent ($0.30$), Quality ($0.20$), and Geographic Proximity ($0.15$) represent $90\%$ of the total base weight.
   - Hard negative filters (`post_saves` vs `content_feedback` from R2) instantly exclude masked/hidden posts and blocked authors.
4. **Diversity Reranking Guarantee**:
   - Requirement R3 explicitly mandates: *Max 2 consecutive items per author* and *typology/format interleaving*.
   - A greedy reranking algorithm operating over the scored candidate array can enforce these constraints deterministically without backtracking or stochastic shuffle, ensuring 100% testable reproducibility.
5. **Transparency Metadata Generation**:
   - For every item in the final feed, the engine must inspect which signal contributed most to its ranking and return an explicit `RecommendationTransparency` payload explaining "Pourquoi je vois ceci" in clean French.

---

## 3. Caveats

1. **Dependency on R2 Schema Migrations**:
   - `post_saves` and `content_feedback` tables are being specified by `explorer_survey_db_1` under Requirement R2.
   - The Feed V1 query builder must be designed defensively: if `content_feedback` is temporarily empty or not yet migrated, the feedback filter gracefully returns an empty set of hidden IDs without throwing exceptions.
2. **Guest / Unauthenticated User State**:
   - When `user_id` is `null` (unauthenticated visitor):
     - $P_{\text{follows}}$, $P_{\text{clubs}}$, and $P_{\text{intent}}$ are empty sets.
     - The engine falls back gracefully to $P_{\text{geo}}$ (if location cookie/header present) and $P_{\text{discovery}}$.
     - Author trust and verified carnet utility signals continue to function identically.
3. **Location Coordinate Privacy**:
   - `community_posts.snapshot_exclude_location` (`20260911530000_phase7_carnet_private_default.sql:60`) is `true` when an author chooses to withhold exact coordinates.
   - In such cases, distance calculation ($S_{\text{geo}}$) must use regional/massif name matching rather than coordinate distance, and transparency metadata must not reveal coordinates.

---

## 4. Conclusion & Complete Feed V1 Architecture Design

### 4.1 Module Structure & Location
In accordance with LKDV feature architecture (`src/features/`), the feed engine is organized as follows:

```
src/features/community/feed/
├── types/
│   ├── feed.types.ts             # CandidateItem, ScoredItem, FeedV1Item, FeedContext, TransparencyMetadata
│   └── signals.types.ts          # IntentSignal, GeoSignal, QualitySignal, UtilitySignal, SocialSignal
├── domain/
│   ├── scoringEngine.ts          # Pure function: calculatePostUtilityScore(post, context)
│   ├── diversityReranker.ts      # Pure function: rerankWithDiversity(scoredCandidates, options)
│   ├── transparencyGenerator.ts  # Pure function: generateTransparencyMetadata(post, scoreBreakdown)
│   └── candidatePools.ts         # Pool definitions & deduplication logic
├── server/
│   ├── feedService.ts            # Server orchestrator: queries Supabase -> runs domain pipeline
│   ├── queries/
│   │   ├── followPoolQuery.ts    # Stage 1: Fetches candidates from user_follows
│   │   ├── clubPoolQuery.ts      # Stage 1: Fetches candidates from user's clubs
│   │   ├── geoPoolQuery.ts       # Stage 1: Fetches candidates from territory/massif
│   │   ├── intentPoolQuery.ts    # Stage 1: Fetches candidates matching user's active trips
│   │   └── discoveryPoolQuery.ts # Stage 1: Fetches verified, trending & educational posts
│   └── feedbackFilter.ts         # Applies user's content_feedback (hidden, less_like_this)
└── index.ts                      # Barrel export
```

### 4.2 Multi-Pool Candidate Generation Architecture

| Candidate Pool | Source Tables / Query | Target Size ($K$) | Target Content |
|---|---|---|---|
| **1. Follows ($P_{\text{follows}}$)** | `user_follows` JOIN `community_posts` | 20 | Posts published by authors the user follows. |
| **2. Clubs ($P_{\text{clubs}}$)** | `club_members` JOIN `community_posts` (matching club or club members) | 15 | Collective updates and discussions within joined clubs. |
| **3. Géo / Territoire ($P_{\text{geo}}$)** | `carnets.destination` or `content ILIKE %massif%` | 20 | Field reports located in user's home department/massif. |
| **4. Voyage / Intention ($P_{\text{intent}}$)** | `trips` (`destination_country_code`, `destination_name`, `primary_activity`) JOIN `community_posts` / `carnets` | 20 | Posts directly relevant to user's planned adventures in the next 90 days. |
| **5. Découverte ($P_{\text{discovery}}$)** | `community_posts.is_trending = true` OR `carnets.verified = true` OR `post_type = 'tip'` | 25 | High-utility, safety-critical mountain tips and verified GPS proofs. |

### 4.3 Multi-Signal Utility Scoring Formula

The total utility score $S_{\text{total}} \in [0.0, 1.0]$ is computed as:

$$S_{\text{total}} = \max\left(0, \min\left(1, \left[ w_{\text{intent}} \cdot S_{\text{intent}} + w_{\text{utility}} \cdot S_{\text{utility}} + w_{\text{quality}} \cdot S_{\text{quality}} + w_{\text{geo}} \cdot S_{\text{geo}} + w_{\text{social}} \cdot S_{\text{social}} \right] \cdot F_{\text{freshness}} - P_{\text{feedback}} \right)\right)$$

#### Weight Distribution:
- $w_{\text{intent}} = 0.30$ (Travel Intent & Adventure Preparation)
- $w_{\text{utility}} = 0.25$ (Practical Field Utility, GPS proof & Safety)
- $w_{\text{quality}} = 0.20$ (Author Trust Score & Loyalty Level)
- $w_{\text{geo}} = 0.15$ (Geographic & Regional Proximity)
- $w_{\text{social}} = 0.10$ (Follows & Social Graph)
- **Total Base Weights = $1.00$** (Utility + Intent + Quality + Geo = $0.90 \gg$ Social $0.10$).

#### Detailed Sub-Scores:
1. **$S_{\text{intent}} \in [0, 1]$**:
   - Destination string or country code matches upcoming trip: $+0.70$
   - Activity matches planned trip activity (e.g., trekking, bivouac): $+0.30$
   - Imminence multiplier: If trip starts within 14 days, multiply by $1.2$ (capped at $1.0$).
2. **$S_{\text{utility}} \in [0, 1]$**:
   - Post has verified linked carnet (`linked_carnet_id != null` and `verified = true`): $+0.40$
   - Post includes GPS track (`snapshot_payload.map_points` or `gps_trace`): $+0.25$
   - Post type is `'tip'` (conseil terrain) or contains weather/safety notes: $+0.20$
   - Post mentions verified gear or packlist: $+0.15$
3. **$S_{\text{quality}} \in [0, 1]$**:
   - Author trust score: $(\text{trust\_score} / 100) \times 0.60$ (defaults to $0.50$ if unknown)
   - Author loyalty level:
     - `ambassadeur`: $+0.25$
     - `expert`: $+0.15$
     - `guide`: $+0.25$
     - Other / standard: $+0.05$
   - Substantial content ($\ge 150$ characters or high-res photo): $+0.15$
4. **$S_{\text{geo}} \in [0, 1]$**:
   - Explicit massif match (e.g. Chartreuse, Vercors, Mont-Blanc): $1.00$
   - Regional match (same mountain zone): $0.60$
   - Distance decay (if coordinates available and not stripped): $\exp(-d / 100\text{ km})$
5. **$S_{\text{social}} \in [0, 1]$**:
   - Author is followed: $+0.70$
   - Shared club membership: $+0.30$
6. **Freshness Decay Factor $F_{\text{freshness}}$**:
   $$F_{\text{freshness}}(\Delta t_{\text{hours}}) = \frac{1}{1 + 0.015 \cdot \Delta t_{\text{hours}}}$$
   - At 24h: $0.735$
   - At 72h: $0.481$
   - At 7 days (168h): $0.284$
   - Note: Evergreen carnets with high utility ($S_{\text{utility}} \ge 0.8$) retain a minimum freshness floor of $0.40$.
7. **Negative Feedback Penalty $P_{\text{feedback}}$**:
   - Hard filter: `post.id` in `user_hidden_ids` or `author_id` in `user_blocked_ids` $\implies$ Discarded prior to scoring.
   - Soft penalty: User previously indicated "Moins comme ceci" on same author or category: $P_{\text{feedback}} = 0.35$.

### 4.4 Diversity Reranking Algorithm

The reranker enforces two strict invariants deterministically:
1. **Author Constraint**: No more than **2 consecutive items** from the same author.
2. **Format/Typology Constraint**: No more than **2 consecutive items** of the exact same `post_type` (e.g. interleave photos, billets, tips, and carnet shares).
3. **Deterministic Tie-Breaking**:
   $$\text{Comparator}(A, B): (B.\text{score} - A.\text{score}) \parallel B.\text{created\_at}.\text{localeCompare}(A.\text{created\_at}) \parallel A.\text{id}.\text{localeCompare}(B.\text{id})$$

```typescript
export interface RerankOptions {
  maxConsecutivePerAuthor?: number; // default 2
  maxConsecutivePerFormat?: number; // default 2
}

export function rerankWithDiversity<T extends { id: string; authorId: string; postType: string; score: number; createdAt: string }>(
  candidates: T[],
  options: RerankOptions = {}
): T[] {
  const maxAuthor = options.maxConsecutivePerAuthor ?? 2;
  const maxFormat = options.maxConsecutivePerFormat ?? 2;

  // Step 1: Initial deterministic sort
  const remaining = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.createdAt !== a.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return a.id.localeCompare(b.id);
  });

  const result: T[] = [];

  while (remaining.length > 0) {
    let selectedIndex = -1;

    // Check candidate that satisfies both author and format constraints
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const recentAuthors = result.slice(-maxAuthor).map((r) => r.authorId);
      const recentFormats = result.slice(-maxFormat).map((r) => r.postType);

      const violatesAuthor = recentAuthors.length === maxAuthor && recentAuthors.every((a) => a === item.authorId);
      const violatesFormat = recentFormats.length === maxFormat && recentFormats.every((f) => f === item.postType);

      if (!violatesAuthor && !violatesFormat) {
        selectedIndex = i;
        break;
      }
    }

    // Fallback 1: Relax format constraint if pool is exhausted
    if (selectedIndex === -1) {
      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const recentAuthors = result.slice(-maxAuthor).map((r) => r.authorId);
        const violatesAuthor = recentAuthors.length === maxAuthor && recentAuthors.every((a) => a === item.authorId);
        if (!violatesAuthor) {
          selectedIndex = i;
          break;
        }
      }
    }

    // Fallback 2: Take top remaining if all remaining are from same author
    if (selectedIndex === -1) {
      selectedIndex = 0;
    }

    const [chosen] = remaining.splice(selectedIndex, 1);
    result.push(chosen);
  }

  return result;
}
```

### 4.5 Transparency Metadata Schema ("Pourquoi je vois ceci")

Every recommended item exposes a `transparency` object:

```typescript
export interface RecommendationTransparency {
  primaryReason:
    | 'following'
    | 'travel_intent'
    | 'territory'
    | 'club'
    | 'quality_field_proof'
    | 'discovery';
  explanation: string; // Explanatory text in French
  badgeLabel?: string;  // Short pill badge e.g. "Projet Chartreuse", "Abonnement", "Tracé vérifié"
  scoreBreakdown: {
    total: number;
    intent: number;
    utility: number;
    quality: number;
    geo: number;
    social: number;
  };
  matchedSignals: {
    tripDestination?: string;
    massif?: string;
    clubName?: string;
    isVerifiedCarnet?: boolean;
    authorTrustScore?: number;
  };
}
```

#### Deterministic Selection Rules for Primary Reason:
- If $S_{\text{intent}} \ge 0.60$ and $S_{\text{intent}} = \max(S_{\text{intent}}, S_{\text{geo}}, S_{\text{social}})$:
  - `primaryReason`: `'travel_intent'`
  - `explanation`: `"Recommandé pour préparer votre projet de voyage (${destination})."`
  - `badgeLabel`: `"Projet ${destination}"`
- Else if $S_{\text{social}} \ge 0.60$ with following:
  - `primaryReason`: `'following'`
  - `explanation`: `"Publié par un auteur que vous suivez."`
  - `badgeLabel`: `"Abonnement"`
- Else if $S_{\text{geo}} \ge 0.60$:
  - `primaryReason`: `'territory'`
  - `explanation`: `"Écho récent dans votre massif (${massif})."`
  - `badgeLabel`: `"Autour de vous"`
- Else if post has shared club:
  - `primaryReason`: `'club'`
  - `explanation`: `"Partagé au sein du club ${clubName}."`
  - `badgeLabel`: `"Club"`
- Else if $S_{\text{utility}} \ge 0.60$ with verified carnet:
  - `primaryReason`: `'quality_field_proof'`
  - `explanation`: `"Récit d'expédition vérifié avec tracé GPS et données terrain."`
  - `badgeLabel`: `"Vérifié terrain"`
- Else:
  - `primaryReason`: `'discovery'`
  - `explanation`: `"Sélectionné pour la qualité et la pertinence du retour d'expérience."`
  - `badgeLabel`: `"Découverte"`

### 4.6 API Route Contract (`GET /api/feed`)

- **Route**: `GET /api/feed`
- **Query Parameters**:
  - `tab`: `'for_you'` (default) | `'following'` | `'nearby'` | `'clubs'`
  - `cursor`: optional string (ISO timestamp or composite offset)
  - `limit`: optional integer (default 20, max 50)
  - `massif`: optional string filter
- **Response Format**:
  ```json
  {
    "items": [
      {
        "id": "post-uuid",
        "authorId": "author-uuid",
        "content": "...",
        "imageUrl": "https://...",
        "postType": "share",
        "createdAt": "2026-10-02T14:00:00Z",
        "author": {
          "id": "author-uuid",
          "fullName": "Thomas Vernet",
          "avatarUrl": "...",
          "trustScore": 94,
          "loyaltyLevel": "ambassadeur"
        },
        "linkedCarnet": {
          "id": "carnet-uuid",
          "destination": "Circuit des Annapurnas",
          "verified": true
        },
        "score": 0.87,
        "transparency": {
          "primaryReason": "travel_intent",
          "explanation": "Recommandé pour préparer votre projet de voyage (Circuit des Annapurnas).",
          "badgeLabel": "Projet Annapurnas",
          "scoreBreakdown": {
            "total": 0.87,
            "intent": 0.95,
            "utility": 0.85,
            "quality": 0.92,
            "geo": 0.30,
            "social": 0.10
          }
        }
      }
    ],
    "nextCursor": "2026-10-01T12:00:00Z",
    "hasMore": true
  }
  ```

---

## 5. Verification Method & Test Strategy

### 5.1 Vitest Unit Test Suite Structure
Create test files in `tests/community/`:
1. **`tests/community/feed-v1-scoring.spec.ts`**:
   - Verifies all sub-score calculations ($S_{\text{intent}}, S_{\text{utility}}, S_{\text{quality}}, S_{\text{geo}}, S_{\text{social}}$).
   - Verifies intent boost when user has an active trip to the destination.
   - Verifies verified carnet GPS traces receive utility boost over plain photo posts.
   - Verifies time decay behaves according to the half-life curve.
   - Verifies negative feedback penalty is subtracted accurately and clamped to $[0, 1]$.
2. **`tests/community/feed-v1-diversity.spec.ts`**:
   - Verifies author constraint: When author A has 5 posts with top scores, reranker never outputs $>2$ consecutive items for author A.
   - Verifies format constraint: Prevents 3 consecutive posts of the exact same `post_type`.
   - Verifies deterministic tie-breaker produces identical outputs across repeated runs with flipped input orders.
   - Verifies graceful fallback when all remaining candidates are from the same author.
3. **`tests/community/feed-v1-transparency.spec.ts`**:
   - Verifies correct `primaryReason` mapping for each dominant signal.
   - Verifies French explanation text is correctly generated without `undefined` placeholders.
   - Verifies stripped coordinate posts do not expose latitude/longitude.
4. **`tests/community/feed-v1-engine.spec.ts`**:
   - End-to-end pipeline test combining candidate pool unification, scoring, diversity reranking, and transparency attachment on a synthetic dataset.

### 5.2 Independent Verification Commands
```powershell
# 1. Run the community & feed test suites
npx vitest run tests/community/

# 2. Verify TypeScript strict type-checking
npm run type-check

# 3. Verify CI invariants
npm run verify:invariants
```

### 5.3 Invalidation Conditions
This architectural plan would be invalidated if:
1. Candidate generation pools fail to complete within 150ms on a seeded Supabase test instance. (Mitigation: Add composite index `idx_community_posts_author_created` and `idx_community_posts_trending`).
2. Reranking algorithm alters score ordering when diversity constraints are already met. (Mitigation: The algorithm strictly checks constraints before modifying order).
3. Hard feedback filters do not exclude 100% of hidden posts. (Mitigation: Perform hard filtering before passing candidates to the scoring pipeline).

---
*End of Report — Ready for Phase 2 implementation.*
