## 2026-10-03T17:29:48Z

You are the Database & Security Specialist Worker for LKDV Community Architecture Milestone 1 (R1 & R2).

Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m1_db_1
Project root: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810
Original user request path: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Project specification: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md
Survey findings report: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_survey_db_1\handoff.md

Domain Skills to consult:
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\skills\supabase-postgres-best-practices\SKILL.md
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\skills\supabase-postgis\SKILL.md

Exclusive Write Ownership:
- supabase/migrations/20261003120000_r1_reward_rpc_security_hardening.sql
- supabase/migrations/20261003121000_r2_social_interactions_persistence.sql
- src/lib/supabase/types.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission Objectives:
1. Implement Migration 1 (supabase/migrations/20261003120000_r1_reward_rpc_security_hardening.sql):
   - Redefine claim_reward_points function with:
     * SET search_path = public, pg_temp; (immutable)
     * Enforce strict caller validation:
       IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Non autorisé: usurpation d''identité interdite' USING ERRCODE = '42501'; END IF;
     * When auth.uid() IS NULL, verify that the caller is service_role:
       IF auth.uid() IS NULL AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN RAISE EXCEPTION 'Non autorisé: appel anonyme interdit' USING ERRCODE = '42501'; END IF;
     * Target verification: ensure target exists before proceeding.
     * Revoke all execute privileges on claim_reward_points from anon and authenticated.
     * Grant execute to service_role only.
   - Harden search_path on all identified SECURITY DEFINER functions (set search_path = public, pg_temp; for the 34 legacy functions identified in explorer_survey_db_1/handoff.md).

2. Implement Migration 2 (supabase/migrations/20261003121000_r2_social_interactions_persistence.sql):
   - Create post_saves table:
     * id UUID PRIMARY KEY DEFAULT gen_random_uuid()
     * post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE
     * user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE
     * created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
     * CONSTRAINT uq_post_saves_post_user UNIQUE (post_id, user_id)
     * Indexes on post_id, user_id, created_at DESC.
     * RLS enabled with watertight policies:
       SELECT for authenticated where user_id = (SELECT auth.uid())
       INSERT for authenticated with check user_id = (SELECT auth.uid())
       DELETE for authenticated where user_id = (SELECT auth.uid())
   - Create content_feedback table:
     * id UUID PRIMARY KEY DEFAULT gen_random_uuid()
     * user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE
     * target_type TEXT NOT NULL CHECK (target_type IN ('post', 'author', 'carnet'))
     * target_id UUID NOT NULL
     * feedback_type TEXT NOT NULL CHECK (feedback_type IN ('hide', 'less_like_this', 'report'))
     * reason TEXT
     * created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
     * CONSTRAINT uq_content_feedback UNIQUE (user_id, target_type, target_id, feedback_type)
     * Indexes on (user_id, feedback_type), (target_type, target_id).
     * RLS enabled with watertight policies:
       SELECT for authenticated where user_id = (SELECT auth.uid())
       INSERT for authenticated with check user_id = (SELECT auth.uid())
       DELETE for authenticated where user_id = (SELECT auth.uid())
   - Extend post_likes or create semantic reactions:
     * Add reaction column if not present with check (reaction IN ('like', 'useful', 'security', 'bag', 'heart', 'fire')).
   - Fix user_follows:
     * Add CHECK (follower_id <> following_id) if missing.

3. Update src/lib/supabase/types.ts:
   - Add TypeScript database definitions for post_saves, content_feedback, and updated post_likes / claim_reward_points RPC signature.

4. Verification:
   - Run npm run type-check and ensure 0 errors.
   - Run npm run lint and ensure 0 errors.
   - Document verification commands and exact terminal outputs in your handoff.md.

Deliverable:
Write your full report to c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m1_db_1\handoff.md and notify the orchestrator via send_message when complete.
