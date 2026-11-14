# Adversarial Challenge Report — Lot 3 R2 (challenger_lot3_r2_2)

**Role**: Lot 3 R2 Adversarial Challenger 2  
**Date**: 2026-11-14T01:22:00Z  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### A. Dead Link Eradication in `src/`
1. Executed: `grep -rnE 'href=["'"'"']/pays|href=["'"'"']/classements|revalidatePath\([^)]*\/pays' src/`
   - **Result**: Exit code 1 (0 matches found).
2. Executed: `grep -rnE 'href=["'"'"'`]*/(pays|classements|segments|heatmaps|planification|rankings|live-segments|accessibilite|carbone)' src/`
   - **Result**: Exit code 1 (0 matches found).
3. Inspected previously flagged references:
   - `src/components/leaderboards/LeaderboardScreen.tsx:157`: `<Link className="lkb-back" href="/explorer">` (Verified clean).
   - `src/components/leaderboards/LeaderboardSummaryList.tsx:20`: `<Link className="lkb-card" href="/explorer">` (Verified clean).
   - `src/components/pays/MobileCountryDetailView.tsx:78`: `<Link href="/explorer"` (Verified clean).
   - `src/features/compas/server/bottleActions.ts:93`: `revalidatePath('/explorer')` (Verified clean).

### B. Service Worker Offline Caches (`public/sw-v18.js` & `ios/App/App/public/sw-v18.js`)
1. Executed: `diff public/sw-v18.js ios/App/App/public/sw-v18.js`
   - **Result**: 0 differences (files are 100% identical).
2. Executed: `grep -rn "pays" public/sw-v18.js ios/App/App/public/sw-v18.js`
   - **Result**: Exactly line 61 in both files: `'/api/pays/'` under `PUBLIC_API_PREFIXES`.
3. Verified `PUBLIC_NAV_PATHS` and `PUBLIC_NAV_PREFIXES`:
   - Neither `/pays` nor `/pays/` nor any other deleted UI route (`/classements`, `/carbone`, `/accessibilite`, etc.) appears. Only legitimate, active public routes are present.

### C. Database Integrity Verification on `icxyvwzfjbflcbqukpfz`
1. **Demo Account Status**:
   - `auth.users` row:
     ```json
     {
       "id": "d5451f35-db9f-4575-9114-6d3b79550bbc",
       "email": "demo@lkdv.app",
       "created_at": "2026-08-21T00:24:22.702Z",
       "last_sign_in_at": "2026-11-13T18:40:09.848Z"
     }
     ```
   - `public.user_profiles` row:
     ```json
     {
       "id": "d5451f35-db9f-4575-9114-6d3b79550bbc",
       "handle": "lea.fontaine",
       "full_name": "Léa Fontaine",
       "role": "user"
     }
     ```
   - **Result**: Demo account is intact and healthy.
2. **Purged Items Status**:
   - Club Judisid (`e96aed5c-bb20-4728-bbb0-5912af26f5ed`): 0 rows.
   - Fake demo events (`Rencontre Japon...`, `Soirée Népal...`): 0 rows.
   - Accounts matching `%jdjd%`, `%bdjd%`: 0 rows.
3. **Parasitic Test Accounts Discrepancy**:
   - `auth.users` currently contains **93 accounts**.
   - Breakdown of accounts:
     - 50 seeded voyageur profiles (`@voyageurs.lkdv.app`)
     - 10 seeded accounts (`@kitduvoyageur.fr`, `aa000001-...`)
     - 8 seeded accounts (`@email.fr`)
     - 7 system/staff accounts (`admin@lekitduvoyageur.fr`, `superadmin@lekitduvoyageur.fr`, `y-coequipier@lekitduvoyageur.fr`, `y-peer1@...`, `y-peer2@...`, `y-peer3@...`, `lkdv-studio@lekitduvoyageur.com`)
     - 1 official demo account (`demo@lkdv.app`)
     - 6 legitimate developer accounts (`tony.faraci@altiore-patrimoine.com`, `tonyfaracip@gmail.com`, `faracitonyp@gmail.com`, `faracitony@gmail.com`, `faracitergeonyp@gmail.com`, `gasbayart@gmail.com`)
     - **11 parasitic / test accounts remain in `auth.users`**:
       1. `461b9ed2-da23-4424-a8f4-6424e5ddf973` : `compas.demo@lekitduvoyageur.fr` (Secondary demo account created today 2026-11-14T01:03:19Z during test runs)
       2. `33564951-2e03-49f0-8e84-74ac3fd1ae42` : `faracitonyp@gmail.comfudiidjd` (Invalid email domain `.comfudiidjd`, profile full_name: 'Jdidkd')
       3. `72b284cd-affe-40de-a1ad-7810f6471a59` : `faracitonyp@gmail.comyehhdhs` (Invalid email domain `.comyehhdhs`)
       4. `e3b74626-0d47-4f5c-873d-ebe7a771b48f` : `faracitonypdbdj@gmail.com` (Keyboard mash `dbdj`, created 2026-08-17)
       5. `074919d6-ea20-49ff-be3c-a0d18fcc9586` : `faracitoezfzezefnyp@gmail.com` (Keyboard mash `ezfzezef`, created 2026-10-18)
       6. `c041a5d3-5b58-4c52-acba-650aac516d36` : `faracitonyefzfzfezefp@gmail.com` (Keyboard mash `efzfzfezef`, created 2026-10-18)
       7. `8bdfabd3-1452-4fc2-9267-53ab5521417e` : `faracitonypvzheh@gmail.com` (Keyboard mash `vzheh`, created 2026-10-18)
       8. `3c453b0d-78ee-44af-8426-41ea79886ca3` : `faracitdbdfdbonyp@gmail.com` (Keyboard mash `dbdfdb`, created 2026-10-04)
       9. `f521bbb7-b40f-440b-9ab5-7af18a4e7acb` : `sldnfozie@gmail.com` (Keyboard mash `sldnfozie`, created 2026-08-14)
       10. `dc1e9824-d0c9-49e4-aa69-63ad85baf606` : `faracitony456p@gmail.com` (Throwaway numbered account)
       11. `a658382e-8c1d-4d6e-a731-015152058d03` : `faracitonyp2@gmail.com` (Throwaway numbered account)
   - Dry-run cascade test executed: all 11 accounts own 0 carnets, 0 clubs, 0 messages, 0 conversations. Deleting them cascades to 30 notifications and cleanly commits without trigger errors.

### D. Test Executions
1. `npx vitest run tests/features/discovery/wiring.spec.ts`
   - **Result**: PASS (1 file passed, 3 tests passed in 121ms).
2. `npx vitest run tests/mobile-layout.spec.ts src/components/mobile-nav/__tests__/ tests/native/ tests/adversarial-lot2-web-primitives.test.tsx`
   - **Result**: PASS (12 files passed, 143 tests passed in 2.35s).
3. `src/app/api/` test suite:
   - **Result**: PASS (24 files passed, 154 tests passed in 1.77s).
4. `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
   - **Result**: PASS (0 typecheck errors, exit code 0).
5. `npx vitest run tests/design/`:
   - **Result**: 1 failed | 47 passed (48 files), 1 failed | 512 passed (513 tests).
   - Failed test: `tests/design/adversarial-club-liquid-glass-stress.spec.tsx:124`:
     - Expected text: `Aucun défi collectif actif pour le moment.`
     - Actual rendered text in `src/components/clubs/drawer/ClubDrawerHost.tsx:1421`: `Aucun défi actif pour le moment.`

---

## 2. Logic Chain

1. **Dead Links and Service Workers**:
   - The worker correctly retargeted obsolete hrefs to `/explorer` in `LeaderboardScreen.tsx`, `LeaderboardSummaryList.tsx`, `MobileCountryDetailView.tsx`, and `bottleActions.ts`.
   - The service worker offline caches in both `public/` and `ios/App/App/public/` have removed `/pays` and `/pays/`, keeping only `/api/pays/`.
   - Verification commands confirm 0 dead navigation links in `src/` and 0 dead routes in service workers.
2. **Database Integrity**:
   - Worker executed the 55-account purge provided by the reviewer, which removed 55 accounts.
   - However, the mission statement specifically directs: "check that 0 parasitic test accounts exist".
   - Our direct interrogation of `auth.users` on `icxyvwzfjbflcbqukpfz` revealed that 11 parasitic accounts were not covered by the previous pattern (e.g., `faracitonypdbdj` contains `dbdj` not `bdjd`; `faracitonyp@gmail.comfudiidjd` has invalid domain; `compas.demo@lekitduvoyageur.fr` was generated right before R2).
   - These 11 accounts are non-production test noise that must be purged to reach true 0 parasitic accounts.
3. **Design Test Failure**:
   - `tests/design/adversarial-club-liquid-glass-stress.spec.tsx` was introduced to stress-test empty states across all tabs of `ClubDrawerHost`.
   - Line 124 fails because of a single-word discrepancy: `Aucun défi collectif actif pour le moment.` vs `Aucun défi actif pour le moment.` in `src/components/clubs/drawer/ClubDrawerHost.tsx:1421`.
   - Aligning this string will bring `tests/design/` to 100% green (48/48 test files, 513/513 tests).

---

## 3. Caveats

- Device-level visual testing on physical iPhone 16 Pro will take place in Lot 5.
- The 11 remaining parasitic accounts were tested in a transactional dry-run with rollback; no production data was altered during this review.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Two concrete action items remain for complete Lot 3 signoff:

1. **Purge the remaining 11 parasitic accounts** from `icxyvwzfjbflcbqukpfz` using the tested SQL transaction below.
2. **Align the empty state string** in `src/components/clubs/drawer/ClubDrawerHost.tsx:1421` to read `Aucun défi collectif actif pour le moment.` (or adjust the assertion in `tests/design/adversarial-club-liquid-glass-stress.spec.tsx:124`) to ensure `npx vitest run tests/design/` passes 100%.

### Ready-to-Execute SQL Remediation Script

```sql
BEGIN;

CREATE TEMP TABLE target_final_11_parasitic ON COMMIT DROP AS
SELECT id FROM auth.users
WHERE id IN (
  '461b9ed2-da23-4424-a8f4-6424e5ddf973', -- compas.demo@lekitduvoyageur.fr
  '33564951-2e03-49f0-8e84-74ac3fd1ae42', -- faracitonyp@gmail.comfudiidjd
  '72b284cd-affe-40de-a1ad-7810f6471a59', -- faracitonyp@gmail.comyehhdhs
  'e3b74626-0d47-4f5c-873d-ebe7a771b48f', -- faracitonypdbdj@gmail.com
  '074919d6-ea20-49ff-be3c-a0d18fcc9586', -- faracitoezfzezefnyp@gmail.com
  'c041a5d3-5b58-4c52-acba-650aac516d36', -- faracitonyefzfzfezefp@gmail.com
  '8bdfabd3-1452-4fc2-9267-53ab5521417e', -- faracitonypvzheh@gmail.com
  '3c453b0d-78ee-44af-8426-41ea79886ca3', -- faracitdbdfdbonyp@gmail.com
  'f521bbb7-b40f-440b-9ab5-7af18a4e7acb', -- sldnfozie@gmail.com
  'dc1e9824-d0c9-49e4-aa69-63ad85baf606', -- faracitony456p@gmail.com
  'a658382e-8c1d-4d6e-a731-015152058d03'  -- faracitonyp2@gmail.com
);

DELETE FROM public.messages WHERE sender_id IN (SELECT id FROM target_final_11_parasitic);
DELETE FROM public.conversation_members WHERE user_id IN (SELECT id FROM target_final_11_parasitic);
DELETE FROM public.conversations WHERE created_by IN (SELECT id FROM target_final_11_parasitic);
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM target_final_11_parasitic) OR actor_id IN (SELECT id FROM target_final_11_parasitic);

DELETE FROM auth.users WHERE id IN (SELECT id FROM target_final_11_parasitic);

COMMIT;
```

---

## 5. Verification Method

1. **Verify Dead Links & Service Workers**:
   ```bash
   grep -rnE 'href=["'"'"']/pays|href=["'"'"']/classements|revalidatePath\([^)]*\/pays' src/
   grep -rn "pays" public/sw-v18.js ios/App/App/public/sw-v18.js
   ```
   *Expected: 0 matches in src/, only line 61 (`/api/pays/`) in service workers.*

2. **Verify Database Integrity on `icxyvwzfjbflcbqukpfz`**:
   ```bash
   node -e "
   const { Client } = require('pg');
   require('dotenv').config({ path: '.env.local' });
   const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
   c.connect().then(async () => {
     const total = await c.query('SELECT count(*) FROM auth.users');
     const demo = await c.query('SELECT id, email FROM auth.users WHERE id = \$1', ['d5451f35-db9f-4575-9114-6d3b79550bbc']);
     console.log({ totalUsers: total.rows[0].count, demoUser: demo.rows[0] });
     await c.end();
   });
   "
   ```
   *Expected after purge: `totalUsers: '82'`, `demoUser` intact (`d5451f35-db9f-4575-9114-6d3b79550bbc`).*

3. **Verify Vitest Suites**:
   ```bash
   npx vitest run tests/features/discovery/wiring.spec.ts
   npx vitest run tests/mobile-layout.spec.ts src/components/mobile-nav/__tests__/ tests/native/ tests/adversarial-lot2-web-primitives.test.tsx
   npx vitest run tests/design/adversarial-club-liquid-glass-stress.spec.tsx
   ```
   *Expected: All pass 100%.*
