## 2026-11-14T01:27:12Z

You are worker_lot3_r3 (role: 'Lot 3 Final Polish Worker').

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/worker_lot3_r3

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context and References to Read:
1. ORIGINAL_REQUEST.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
2. Scope Document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
3. Challenger 2 Handoff: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/challenger_lot3_r2_2/handoff.md

Your Assigned Tasks:

Task 1: Execute Targeted Database Purge of the 11 Remaining Parasitic Accounts on `icxyvwzfjbflcbqukpfz`:
- Challenger 2 identified exactly 11 remaining parasitic / throwaway test accounts in `auth.users`:
  - `461b9ed2-da23-4424-a8f4-6424e5ddf973` (`compas.demo@lekitduvoyageur.fr`)
  - `33564951-2e03-49f0-8e84-74ac3fd1ae42` (`faracitonyp@gmail.comfudiidjd`)
  - `72b284cd-affe-40de-a1ad-7810f6471a59` (`faracitonyp@gmail.comyehhdhs`)
  - `e3b74626-0d47-4f5c-873d-ebe7a771b48f` (`faracitonypdbdj@gmail.com`)
  - `074919d6-ea20-49ff-be3c-a0d18fcc9586` (`faracitoezfzezefnyp@gmail.com`)
  - `c041a5d3-5b58-4c52-acba-650aac516d36` (`faracitonyefzfzfezefp@gmail.com`)
  - `8bdfabd3-1452-4fc2-9267-53ab5521417e` (`faracitonypvzheh@gmail.com`)
  - `3c453b0d-78ee-44af-8426-41ea79886ca3` (`faracitdbdfdbonyp@gmail.com`)
  - `f521bbb7-b40f-440b-9ab5-7af18a4e7acb` (`sldnfozie@gmail.com`)
  - `dc1e9824-d0c9-49e4-aa69-63ad85baf606` (`faracitony456p@gmail.com`)
  - `a658382e-8c1d-4d6e-a731-015152058d03` (`faracitonyp2@gmail.com`)
- Execute the SQL transaction from Challenger 2 handoff:
  ```sql
  BEGIN;
  CREATE TEMP TABLE target_final_11_parasitic ON COMMIT DROP AS
  SELECT id FROM auth.users
  WHERE id IN (
    '461b9ed2-da23-4424-a8f4-6424e5ddf973',
    '33564951-2e03-49f0-8e84-74ac3fd1ae42',
    '72b284cd-affe-40de-a1ad-7810f6471a59',
    'e3b74626-0d47-4f5c-873d-ebe7a771b48f',
    '074919d6-ea20-49ff-be3c-a0d18fcc9586',
    'c041a5d3-5b58-4c52-acba-650aac516d36',
    '8bdfabd3-1452-4fc2-9267-53ab5521417e',
    '3c453b0d-78ee-44af-8426-41ea79886ca3',
    'f521bbb7-b40f-440b-9ab5-7af18a4e7acb',
    'dc1e9824-d0c9-49e4-aa69-63ad85baf606',
    'a658382e-8c1d-4d6e-a731-015152058d03'
  );
  DELETE FROM public.messages WHERE sender_id IN (SELECT id FROM target_final_11_parasitic);
  DELETE FROM public.conversation_members WHERE user_id IN (SELECT id FROM target_final_11_parasitic);
  DELETE FROM public.conversations WHERE created_by IN (SELECT id FROM target_final_11_parasitic);
  DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM target_final_11_parasitic) OR actor_id IN (SELECT id FROM target_final_11_parasitic);
  DELETE FROM auth.users WHERE id IN (SELECT id FROM target_final_11_parasitic);
  COMMIT;
  ```
- STRICTLY PRESERVE official demo user `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app`).
- Verify post-purge: user count drops from 93 to 82, demo user exists, 0 parasitic accounts.

Task 2: Update `src/components/leaderboards/__tests__/LeaderboardsIndexScreen.test.tsx`:
- Line 28: update assertion from `expect(screen.getByRole('link').getAttribute('href')).toBe('/classements/seg-col-1');` to `expect(screen.getByRole('link').getAttribute('href')).toBe('/explorer');` because `LeaderboardSummaryList.tsx` correctly retargeted links to `/explorer` per the deletion of `/classements`.

Verification Requirements:
1. `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
2. `npx vitest run tests/design/`
3. `npx vitest run src/components/leaderboards/`
4. `npx vitest run src/app/api/`
5. Database query check proving demo account is intact and user count is 82.

Deliverable:
Write report to `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/worker_lot3_r3/handoff.md`.
Then send completion message.
