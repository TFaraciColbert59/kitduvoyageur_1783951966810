## 2026-11-14T01:04:12Z

You are worker_lot3_r2 (role: 'Lot 3 Remediation Worker').

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/worker_lot3_r2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context and References to Read First:
1. ORIGINAL_REQUEST.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
2. Scope Document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
3. Reviewer Lot 3 Handoff: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot3/handoff.md
4. Challenger Lot 3 Handoff: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot3/handoff.md
5. Auditor Lot 3 Handoff: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_auditor_lot3/handoff.md

Your Assigned Remediation Tasks:

Task 1: Execute Targeted Database Purge on Supabase (`icxyvwzfjbflcbqukpfz`):
- Reviewer Lot 3 identified exactly 55 remaining parasitic test accounts in auth.users (including `jdjdjdk@gmail.cim` / `6d6dc76c-5146-4c5a-8064-b1718daca07f` and `faracitonypbdjd@gmail.com` / `940b68bb-5d40-433d-ae34-d09750aadab8`).
- Execute the tested SQL transaction provided in `teamwork_reviewer_lot3/handoff.md §3` lines 135-165 using Node.js script with `pg` and `process.env.DATABASE_URL` (loaded from `.env.local`).
- STRICTLY PRESERVE the official demo account: `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app` / `lea.fontaine`) and legitimate developer accounts (`faracitonyp@gmail.com`, `faracitergeonyp@gmail.com`, `tonyfaracip@gmail.com`, `gasbayart@gmail.com`).
- Verify post-purge:
  - `SELECT count(*) FROM auth.users WHERE id = 'd5451f35-db9f-4575-9114-6d3b79550bbc'` must equal 1.
  - `SELECT count(*) FROM auth.users WHERE email ILIKE '%jdjdjdk%'` must equal 0.
  - No foreign key trigger errors.

Task 2: Purge Remaining Mock Datasets in `src/components/clubs/ClubLiquidGlassV8.tsx`:
- Lines 97–312 contain 8 hardcoded `INITIAL_*` mock datasets:
  - `INITIAL_CLUBS_DIRECTORY`
  - `INITIAL_CLUB_POSTS`
  - `INITIAL_CLUB_MEMBERS` (which contains 5 Unsplash URLs)
  - `INITIAL_CLUB_OUTINGS`
  - `INITIAL_VAULT_GEAR`
  - `INITIAL_STANDARD_KITS`
  - `INITIAL_CHALLENGES`
  - `INITIAL_CHAT_MESSAGES`
- Replace them with empty arrays (`[]`) and/or dynamic fallback so that `ClubDrawerHost` displays honest empty states.
- Ensure 0 Unsplash URLs remain in `src/components/clubs/ClubLiquidGlassV8.tsx`.

Task 3: Fix Dead Route References:
- `src/components/leaderboards/LeaderboardScreen.tsx:157`: update `<Link href="/classements">` to redirect/link to `/explorer` or `/communaute`.
- `src/components/leaderboards/LeaderboardSummaryList.tsx:20`: update `<Link href="/classements/...">` to redirect/link to `/explorer`.
- `src/components/pays/MobileCountryDetailView.tsx:78`: update `<Link href="/pays">` to `/explorer`.
- `src/features/compas/server/bottleActions.ts:94`: remove `revalidatePath('/pays/${country}')` or make safe.

Task 4: Fix `tests/features/discovery/wiring.spec.ts`:
- Update or retire the 2 failing tests that assert on deleted `/pays` files (`CountryDetailClient.tsx`) and deleted navigation plateau tabs, as `/pays` UI has been deleted per plan.
- Ensure `npx vitest run tests/features/discovery/wiring.spec.ts` passes 100%.

Task 5: Clean Service Worker Cache Manifests:
- `public/sw-v18.js`: remove `'/pays'` from `PUBLIC_NAV_PATHS` (line ~35) and `'/pays/'` from `PUBLIC_NAV_PREFIXES` (line ~50).
- `ios/App/App/public/sw-v18.js`: do the same.

Verification Requirements:
Run all the following commands and report exact results in your `handoff.md`:
1. `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
2. `npx vitest run tests/design/`
3. `npx vitest run src/app/api/`
4. `npx vitest run tests/features/discovery/wiring.spec.ts`
5. `npx vitest run tests/mobile-layout.spec.ts src/components/mobile-nav/__tests__/ tests/native/ tests/adversarial-lot2-web-primitives.test.tsx`
6. Run database verification script to prove demo user is preserved and parasitic accounts are purged.

Deliverable:
Write a comprehensive `handoff.md` in your state folder `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/worker_lot3_r2/handoff.md`.
Then send a completion message to the orchestrator.
