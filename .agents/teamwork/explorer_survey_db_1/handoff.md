# Database & Security Architectural Survey Report (Requirements R1 & R2)

**Explorer**: Database & Security Explorer (`explorer_survey_db_1`)  
**Project**: Le Kit du Voyageur (LKDV)  
**Date**: 2026-10-03  
**Status**: Completed (Read-Only Exploration)

---

## 1. Observation

### 1.1 Supabase Migrations & Baseline Structure
- **Active migration directory**: `supabase/migrations/` contains **252 migration files**.
  - Earliest migration: `20260710110000_admin_tables.sql`
  - Latest migration: `20261003090000_hiking_route_sources_and_revisions.sql`
- **Baseline dump**: `supabase/baseline/prod_schema_20260911.sql` (573,651 bytes, 16,813 lines), recording production database state as of 2026-09-11.
- **Deferred migrations**: `supabase/migrations_deferred/20260922000000_claim_revoke_after_app_deploy.sql` (unapplied migration intended to revoke `EXECUTE` on `claim_reward_points` from `authenticated`).
- **Database test suite**: `supabase/tests/database/` contains **49 pgTAP test suites** validating migrations, RLS, progression, and security policies.

---

### 1.2 Audit of `claim_reward_points` & Privileged RPC Functions
- **Original Definition**: `supabase/migrations/20260816001000_reward_functions.sql` (lines 7–213):
  ```sql
  CREATE OR REPLACE FUNCTION public.claim_reward_points(
    p_user_id UUID,
    p_action_type TEXT,
    p_target_id UUID,
    p_target_type TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
  )
  RETURNS UUID AS $$
  ...
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```
- **State in Baseline**: `supabase/baseline/prod_schema_20260911.sql`:
  - Line 599: function definition.
  - Line 15013–15015:
    ```sql
    GRANT ALL ON FUNCTION "public"."claim_reward_points"(...) TO "anon";
    GRANT ALL ON FUNCTION "public"."claim_reward_points"(...) TO "authenticated";
    GRANT ALL ON FUNCTION "public"."claim_reward_points"(...) TO "service_role";
    ```
- **Phase 1 Fixes**: `supabase/migrations/20260917010000_phase1_security_fixes.sql`:
  - Line 33: `REVOKE EXECUTE ON FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) FROM anon;`
  - Line 161: `ALTER FUNCTION public.claim_reward_points(uuid, text, uuid, text, jsonb) SET search_path = public, extensions;`
- **Phase Hardening Note**: `supabase/migrations/20260920110000_hardening.sql` (lines 210–215):
  ```sql
  -- NOTE séquencement : le REVOKE de `claim_reward_points` est volontairement
  -- différé dans `20260922000000_claim_revoke_after_app_deploy.sql`. L'ancienne
  -- route `/api/rewards/claim` (app déployée) l'appelle avec une session
  -- utilisateur ; la révocation doit suivre le déploiement de la nouvelle route
  -- (service role) pour ne pas interrompre les récompenses pendant la fenêtre.
  ```
- **Test Evidence of Active Grant**: `supabase/tests/database/progression_hardening.test.sql` (lines 54–55):
  ```sql
  SELECT is((SELECT has_function_privilege('authenticated', 'public.claim_reward_points(uuid,text,uuid,text,jsonb)', 'EXECUTE')), true,
    '10b. claim_reward_points conserve EXECUTE pour authenticated pendant la phase de transition');
  ```
- **Current App Server Route**: `src/app/api/rewards/claim/route.ts` (lines 42–52):
  ```typescript
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }
  const { data: contributionId, error } = await service.rpc('claim_reward_points', {
    p_user_id: user.id,
    p_action_type: action_type,
    p_target_id: target_id,
    p_target_type: target_type,
    p_metadata: metadata
  });
  ```
- **Audited Vulnerabilities in `claim_reward_points`**:
  1. **Parameter Spoofing / Missing Identity Verification**: The function receives `p_user_id UUID` as a parameter. There is **no verification** that `auth.uid() = p_user_id`. An attacker calling `supabase.rpc('claim_reward_points', ...)` directly via the Supabase client using an `authenticated` JWT can pass any arbitrary `p_user_id`.
  2. **Non-Compliant `search_path`**: Currently configured with `SET search_path = public, extensions`. Requirement R1 explicitly mandates `SET search_path = public, pg_temp;`.
  3. **No Defense-in-Depth for Unauthenticated Context**: If called without authentication where `auth.uid()` is NULL, it does not verify whether the caller role is `service_role`.
  4. **Target Existence Bypass**: Self-actions are blocked (e.g. self-like lines 62–64), but non-existent target IDs can still be inserted into `pending_contributions` because there is no foreign key verification before insertion.

---

### 1.3 Inventory of All `SECURITY DEFINER` Functions
Scanning all 252 migrations and baseline uncovered **147 unique functions** with `SECURITY DEFINER`.
Audit breakdown (`security_definer_full_audit.csv`):
- **`public, pg_temp` (Strict target)**: **55 functions** (e.g., `is_admin`, `is_moderateur`, `is_group_member`, `guard_user_profile_privileged_columns`, `get_route_cache`, `set_route_cache`).
- **`public, extensions` (Phase 1 legacy)**: **34 functions** (e.g., `claim_reward_points`, `can_user_bid`, `place_bid`, `set_auto_bid`, `increment_stock`, `request_withdrawal`, `process_pending_contribution`, `finalize_reward_period`, `process_withdrawal`, `toggle_community_post_like`).
- **`public` only**: **32 functions**.
- **`public AS` (Parsing artifact)**: **18 functions** (e.g., `award_progression_gain`).
- **`MISSING search_path`**: **5 functions** (e.g., `decrement_stock_on_order` in `20260715240000_inventory_stock_orders.sql`).

Key Social & Financial RPCs Audited:
| Function | Current `search_path` | `anon` EXECUTE | `authenticated` EXECUTE | `auth.uid()` Verified? |
|---|---|---|---|---|
| `claim_reward_points` | `public, extensions` | Revoked | **Granted (VULNERABLE)** | **NO (`auth.uid() = p_user_id` missing)** |
| `toggle_community_post_like` | `public, extensions` | Revoked | Granted | Yes (`v_user_id := auth.uid()`) |
| `request_withdrawal` | `public, extensions` | Revoked | Granted | Yes (`v_user_id := auth.uid()`) |
| `award_progression_gain` | `public` | Revoked | Revoked | Yes (`auth.uid() <> p_user_id` check) |
| `update_loyalty_points` | `public, extensions` | Revoked | Revoked (deferred) | No (revoked from client) |
| `process_pending_contribution`| `public, extensions` | Revoked | Granted | Admin check (`is_admin()`) |

---

### 1.4 Schema Mapping of Existing Social & Community Tables

#### `community_posts`
- **Location**: Created in `20260713120000_community_features.sql`, updated in `20260713210000`, `20260911500000`, `20260911530000`.
- **Columns**: `id`, `author_id`, `content`, `image_url`, `image_alt`, `post_type`, `linked_carnet_id`, `likes_count`, `comments_count`, `shares_count`, `is_trending`, `title`, `correlation_id`, `snapshot_payload`, `snapshot_at`, `snapshot_exclude_location`, `created_at`, `updated_at`.
- **Foreign Keys**: `author_id -> user_profiles(id) ON DELETE CASCADE`, `linked_carnet_id -> carnets(id) ON DELETE SET NULL`.
- **RLS**: SELECT `true`; INSERT/UPDATE/DELETE `author_id = (select auth.uid())`.

#### `post_likes`
- **Location**: `20260713120000_community_features.sql`.
- **Columns**: `id UUID PRIMARY KEY`, `post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE`, `user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ`.
- **Constraints**: `UNIQUE (post_id, user_id)`.
- **Limitation**: Binary like only. No reaction type column.

#### `carnets`
- **Location**: `20260713120000_community_features.sql`, `20260713230000`, `20260911530000`.
- **Columns**: `id`, `author_id`, `title`, `destination`, `description`, `cover_image`, `visibility` (defaults to `'private'` as of Phase 7), `map_points`, `likes_count`, `comments_count`, `favorites_count`, `views_count`, `trip_id`, `correlation_id`, `created_at`.
- **RLS**: Public read only if `visibility = 'public'` OR `author_id = (select auth.uid())`.

#### `carnet_likes`
- **Location**: `20260713120000_community_features.sql`.
- **Columns**: `id`, `carnet_id`, `user_id`, `reaction TEXT DEFAULT 'useful' CHECK (reaction IN ('useful','security','bag','fire','heart'))`, `created_at`.
- **Constraints**: `UNIQUE (carnet_id, user_id)`.

#### `carnet_favorites`
- **Location**: `20260713120000_community_features.sql`, `20260713230000`.
- **Columns**: `id`, `carnet_id UUID REFERENCES carnets(id) ON DELETE CASCADE`, `user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ`.
- **Constraints**: `UNIQUE (carnet_id, user_id)`.

#### `user_follows`
- **Location**: `20260713120000_community_features.sql`.
- **Columns**: `id`, `follower_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE`, `following_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ`.
- **Constraints**: `UNIQUE (follower_id, following_id)`.
- **Gaps**: Lacks `CHECK (follower_id <> following_id)` to forbid self-following.

#### `comment_reports`
- **Location**: `20260814000000_comment_reports_table.sql`.
- **Columns**: `id`, `comment_id UUID`, `reporter_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL`, `reason TEXT`, `table_name TEXT DEFAULT 'post_comments'`, `status TEXT CHECK (status IN ('pending','reviewed','dismissed'))`, `created_at`.
- **Current frontend behavior**: `CommunityPostCard.tsx` (lines 1194–1199) inserts post reports into `comment_reports` with `comment_id: post.id` and `table_name: 'community_posts'`.

---

### 1.5 Missing Models for Requirement R2
1. **`post_saves` DOES NOT EXIST**:
   - `CommunityPostCard.tsx` lines 346–350:
     ```typescript
     const handleToggleSave = () => {
       setIsSaved(!isSaved);
       setShowMoreMenu(false);
       showToast(isSaved ? 'Retiré de vos favoris' : 'Enregistré dans vos favoris ⭐');
     };
     ```
     The UI is currently a **pure client-side state mock** (`useState(post.user_saved)`). There is no persistence table or backend endpoint.
2. **`content_feedback` DOES NOT EXIST**:
   - In `CommunityPostCard.tsx` lines 352–356:
     ```typescript
     const handleHidePost = () => {
       setIsHidden(true);
       setShowMoreMenu(false);
       showToast('Publication masquée de votre fil.');
     };
     ```
     Hiding posts is purely in-memory. Negative signals ("Moins comme ceci", "Pas intéressé", hide author, hide post) cannot be persisted or fed to the Feed V1 recommendation pipeline.
3. **Semantic reactions on posts DO NOT EXIST**:
   - While `carnet_likes` has a `reaction` column (`useful`, `security`, etc.), `post_likes` only records binary likes.
4. **Missing TypeScript Types**:
   - `src/lib/supabase/types.ts` does NOT define `community_posts`, `post_likes`, `carnet_likes`, `user_follows`, `post_saves`, or `content_feedback`.

---

## 2. Logic Chain

```
[Observation 1.2: claim_reward_points allows authenticated EXECUTE and has no auth.uid() = p_user_id check]
    ↓
(Step 1: Any authenticated user calling supabase.rpc('claim_reward_points', { p_user_id: <any_id>, ... }) bypasses RLS and triggers points/contributions for arbitrary users or self-forged claims.)
    ↓
[Observation 1.2: src/app/api/rewards/claim/route.ts verifies session user.id and executes via service_role]
    ↓
(Step 2: The client frontend route is already converted to server-side service_role execution. The transition phase documented in 20260920110000_hardening.sql line 210 is complete.)
    ↓
(Step 3: Therefore, claim_reward_points must be hardened in two layers:
  Layer A: Inside function body: Enforce IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Non autorisé: usurpation d''identité interdite' USING ERRCODE = '42501'; END IF;
  Layer B: If auth.uid() IS NULL, require auth.role() = 'service_role' (or current_setting('request.jwt.claim.role', true) = 'service_role').
  Layer C: SET search_path = public, pg_temp;
  Layer D: Incorporate deferred migration 20260922000000: REVOKE ALL ON FUNCTION public.claim_reward_points FROM authenticated, anon; GRANT EXECUTE TO service_role;)
    ↓
[Observation 1.3: 34 functions have search_path = public, extensions and 5 have no search_path]
    ↓
(Step 4: All target privileged and social functions must be updated with ALTER FUNCTION ... SET search_path = public, pg_temp;.)
    ↓
[Observation 1.5: post_saves and content_feedback do not exist; frontend uses local state mocks]
    ↓
(Step 5: Requirements R2, R3, and R4 require concrete persistent tables post_saves and content_feedback with strict RLS (select auth.uid() = user_id), foreign keys, and indexes for Feed V1 filtering and UI persistence.)
```

---

## 3. Caveats
1. **Transition Compatibility**: Older mobile app builds still in cache might fail if client-side RPC calls to `claim_reward_points` are revoked abruptly before all clients route through `/api/rewards/claim`. However, hardening `claim_reward_points` with `auth.uid() = p_user_id` allows legitimate client calls for own `user_id` while immediately blocking spoofing attacks.
2. **Post Reaction Granularity**: Two migration options exist for semantic reactions:
   - Option A: Add a `reaction` column to `post_likes` (`DEFAULT 'like' CHECK (reaction IN ('like', 'useful', 'security', 'practical', 'inspiring'))`).
   - Option B: Create a distinct `post_reactions` table.
   *Assessment*: Option A maintains backward compatibility with existing `likes_count` triggers and `toggle_community_post_like` while enabling semantic categorization. Option B separates simple likes from multi-signal ratings. A migration combining both or extending `post_likes` with an RPC helper is recommended.
3. **External PostGIS/Geo Database Extensions**: `public, pg_temp` is strictly valid for standard schema objects. If PostGIS functions (`ST_DWithin`, etc.) are invoked inside a function, `SET search_path = public, extensions, pg_temp` might be required for spatial functions if PostGIS is installed in `extensions`. In LKDV, atlas and geospatial queries use `public, pg_temp` successfully because PostGIS objects reside in `public` or are fully qualified.

---

## 4. Conclusion & Recommended Migration Strategy

To fulfill Requirements R1 and R2 with zero defect:

### A. Requirement R1: Security Hardening Migration
Create migration `20261003180000_r1_reward_rpc_security_hardening.sql`:
1. **Redefine `claim_reward_points`**:
   - `SET search_path = public, pg_temp`
   - Explicit identity authentication guard:
     ```sql
     IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
       RAISE EXCEPTION 'Non autorisé: l''utilisateur ne peut réclamer des points que pour son propre compte'
         USING ERRCODE = '42501';
     ELSIF auth.uid() IS NULL AND COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
       RAISE EXCEPTION 'Authentification requise pour l''attribution de récompenses'
         USING ERRCODE = '42501';
     END IF;
     ```
   - Target existence check on `community_posts` / `carnets` before contribution insertion.
   - Restrict permissions: `REVOKE ALL ON FUNCTION public.claim_reward_points FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.claim_reward_points TO service_role;` (with server API route `/api/rewards/claim` as sole caller).
2. **Strict `search_path` on all target RPCs**:
   - Apply `ALTER FUNCTION ... SET search_path = public, pg_temp;` to:
     - `public.toggle_community_post_like(uuid)`
     - `public.request_withdrawal(numeric, text, text, jsonb)`
     - `public.process_withdrawal(uuid, boolean, text, text)`
     - `public.process_pending_contribution(uuid, boolean, text)`
     - `public.finalize_reward_period(text, numeric)`
     - `public.decrement_stock_on_order(uuid, integer, text, uuid)`
     - `public.increment_stock(uuid, integer, text, text, uuid, text)`
     - `public.can_user_bid(uuid)`
     - `public.place_bid(uuid, uuid, integer, boolean)`
     - `public.set_auto_bid(uuid, uuid, integer)`
     - `public.trg_on_community_post_like()`
     - `public.trg_on_community_post_comment()`
     - `public.trg_on_carnet_like()`
     - `public.trg_on_carnet_comment()`

### B. Requirement R2: Social Schema & Persistent Interactions Migration
Create migration `20261003181000_r2_social_interactions_persistence.sql`:
1. **Create `public.post_saves`**:
   ```sql
   CREATE TABLE IF NOT EXISTS public.post_saves (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
     post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT post_saves_user_post_unique UNIQUE (user_id, post_id)
   );
   CREATE INDEX IF NOT EXISTS idx_post_saves_user_id ON public.post_saves (user_id);
   CREATE INDEX IF NOT EXISTS idx_post_saves_post_id ON public.post_saves (post_id);
   CREATE INDEX IF NOT EXISTS idx_post_saves_user_created ON public.post_saves (user_id, created_at DESC);
   ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
   CREATE POLICY post_saves_select_own ON public.post_saves FOR SELECT TO authenticated
     USING (user_id = (SELECT auth.uid()));
   CREATE POLICY post_saves_insert_own ON public.post_saves FOR INSERT TO authenticated
     WITH CHECK (user_id = (SELECT auth.uid()));
   CREATE POLICY post_saves_delete_own ON public.post_saves FOR DELETE TO authenticated
     USING (user_id = (SELECT auth.uid()));
   ```
2. **Create `public.content_feedback`**:
   ```sql
   CREATE TABLE IF NOT EXISTS public.content_feedback (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
     target_type TEXT NOT NULL CHECK (target_type IN ('post', 'carnet', 'author', 'club')),
     target_id UUID NOT NULL,
     feedback_type TEXT NOT NULL CHECK (feedback_type IN ('not_interested', 'seen_too_much', 'irrelevant_location', 'hide_author', 'hide_post')),
     reason TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT content_feedback_user_target_unique UNIQUE (user_id, target_type, target_id, feedback_type)
   );
   CREATE INDEX IF NOT EXISTS idx_content_feedback_user_id ON public.content_feedback (user_id);
   CREATE INDEX IF NOT EXISTS idx_content_feedback_target ON public.content_feedback (target_type, target_id);
   ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;
   CREATE POLICY content_feedback_select_own ON public.content_feedback FOR SELECT TO authenticated
     USING (user_id = (SELECT auth.uid()));
   CREATE POLICY content_feedback_insert_own ON public.content_feedback FOR INSERT TO authenticated
     WITH CHECK (user_id = (SELECT auth.uid()));
   CREATE POLICY content_feedback_delete_own ON public.content_feedback FOR DELETE TO authenticated
     USING (user_id = (SELECT auth.uid()));
   ```
3. **Add Semantic Reactions to Posts**:
   - Extend `public.post_likes` with `reaction TEXT NOT NULL DEFAULT 'like' CHECK (reaction IN ('like', 'useful', 'security', 'practical', 'inspiring'))`
   - Or create `public.post_reactions` for multi-signal scores.
4. **Harden `public.user_follows`**:
   - Add constraint `CHECK (follower_id <> following_id)`.
   - Update RLS to use cached `(SELECT auth.uid())`.
5. **Create RPC Helper Functions**:
   - `toggle_post_save(p_post_id UUID)`
   - `submit_content_feedback(p_target_type TEXT, p_target_id UUID, p_feedback_type TEXT, p_reason TEXT)`
   - Both defined as `SECURITY DEFINER SET search_path = public, pg_temp;` with caller identity checks.

---

## 5. Verification Method

### 5.1 Independent SQL Audit Queries
Execute these queries in the Supabase SQL editor or via `psql`:

1. **Verify `claim_reward_points` permissions & search path**:
   ```sql
   SELECT p.proname, p.prosecdef, pg_get_functiondef(p.oid) LIKE '%search_path = public, pg_temp%' AS is_strict_sp,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_exec,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_exec
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'claim_reward_points';
   -- Expected after fix: is_strict_sp = true, anon_can_exec = false, auth_can_exec = false.
   ```

2. **Verify missing tables creation and RLS enablement**:
   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND relname IN ('post_saves', 'content_feedback', 'post_likes', 'user_follows');
   -- Expected: All rows present with relrowsecurity = true.
   ```

3. **Verify RLS initplan optimization (no un-cached `auth.uid()` calls)**:
   ```sql
   SELECT tablename, policyname, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('post_saves', 'content_feedback', 'post_likes', 'user_follows')
     AND (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%');
   -- Expected: 0 rows returned.
   ```

### 5.2 Automated pgTAP Test File
Create a new test file `supabase/tests/database/r1_r2_community_security.test.sql` and run:
```bash
supabase test db
```
The test suite should verify:
- Anonymous RPC rejection.
- Cross-user identity spoofing rejection (`auth.uid() <> user_id` raises exception).
- Service-role attribution success.
- `post_saves` RLS isolation (User A cannot view User B's saves).
- `content_feedback` RLS isolation.
- `user_follows` self-follow prevention.
