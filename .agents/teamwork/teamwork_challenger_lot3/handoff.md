# Handoff Report — Lot 3 Adversarial Challenge

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### A. Route Deletion & Dead Navigation References
1. **Target UI Route Deletion**:
   - Command: `ls -d src/app/{planification,heatmaps,segments,classements,rankings,live-segments,accessibilite,carbone,pays,dev}`
   - Result: All 10 directories are confirmed deleted from `src/app/`.
   - Backend APIs (`src/app/api/{heatmaps,segments,live-segments,rankings,pays,dev}`) are preserved and passing all 154 tests across 24 test suites (`npx vitest run src/app/api/`).
2. **Dead Links in Code**:
   - `src/components/leaderboards/LeaderboardScreen.tsx:157`:
     ```tsx
     <Link className="lkb-back" href="/classements">
       <span aria-hidden="true">←</span> Tous les classements
     </Link>
     ```
     `/classements` UI page was deleted, leading to a dead link.
   - `src/components/leaderboards/LeaderboardSummaryList.tsx:20`:
     ```tsx
     <Link className="lkb-card" href={`/classements/${encodeURIComponent(segment.segmentId)}`}>
     ```
     `/classements/[segmentId]` UI page was deleted, leading to a dead link.
   - `src/components/pays/MobileCountryDetailView.tsx:78`:
     ```tsx
     <Link className="lkb-back" href="/pays">
     ```
     `/pays` UI page was deleted, leading to a dead link.
   - `src/features/compas/server/bottleActions.ts:94`:
     ```ts
     if (country) revalidatePath(`/pays/${country}`);
     ```
     Calls Next.js `revalidatePath` on a deleted UI path.
3. **Failing Vitest Test**:
   - Command: `npx vitest run tests/features/discovery/wiring.spec.ts`
   - Result: 2 failed tests:
     ```text
     FAIL tests/features/discovery/wiring.spec.ts > wiring des sections Pays (desktop) > branche la section Hébergements dans la sidebar et la fiche desktop
     Error: ENOENT: no such file or directory, open '/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/src/app/pays/[code]/CountryDetailClient.tsx'
     
     FAIL tests/features/discovery/wiring.spec.ts > wiring des sections Pays (mobile) > ajoute les onglets correspondants dans la barre mobile
     AssertionError: expected '...' to contain "{ id: 'gastronomie', label: 'Gastronomie' }"
     ```
     The test asserts on deleted `/pays` files and removed navigation plateau tabs, and was neither updated nor retired.

### B. Primitives Eradication
- Command: `git grep -E "(GlassSubCard|GlassPill|GlassCapsuleBtn)" src/`
- Result: 0 occurrences in `src/`. Export references in `src/components/ui/index.ts` are removed.
- Verified passing: `tests/adversarial-lot2-web-primitives.test.tsx` (31 tests passed).

### C. Zero Mock Audit
1. `src/components/clubs/ClubLiquidGlassV8.tsx`:
   Worker claimed:
   > "Removed `CLUB_PRESETS`, `DEMO_CLUBS`, `DEMO_CARNETS`, `DEMO_OUTINGS`, `DEMO_GEAR_ITEMS`, `DEMO_ORDERS`, `DEMO_ACTIVE_LOANS`. Added dynamic Supabase query `supabase.from('clubs').select('*').eq('id', clubId)` with honest empty state on non-match."
   Direct observation:
   - Lines 97–194: `const INITIAL_CLUBS_DIRECTORY: ClubItemData[]` contains 4 hardcoded fake preset clubs (`cl1`, `cl2`, `cl3`, `cl4`) with fake descriptions, outings, weather, and coordinates.
   - Lines 196–270: `const INITIAL_CLUB_POSTS: ClubFeedPostItem[]` contains 3 hardcoded fake posts.
   - Lines 272–278: `const INITIAL_CLUB_MEMBERS: ClubMemberData[]` contains 5 fake members with **5 Unsplash profile picture URLs**:
     - `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`
     - `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150`
     - `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150`
     - `https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150`
     - `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150`
   - Lines 280–287: `const INITIAL_CLUB_OUTINGS: ClubOutingData[]` contains 6 fake outings (`out1` to `out6`).
   - Lines 289–295: `const INITIAL_VAULT_GEAR: ClubGearVaultItem[]` contains 5 fake gear items.
   - Lines 297–300: `const INITIAL_STANDARD_KITS: ClubStandardKit[]` contains 2 fake kits.
   - Lines 302–306: `const INITIAL_CHALLENGES: ClubChallengeItem[]` contains 3 fake challenges.
   - Lines 308–312: `const INITIAL_CHAT_MESSAGES: ClubChatMessage[]` contains 3 fake chat messages.
   - Lines 1111–1119: All 8 fake mock data structures are mounted and passed into `<ClubDrawerHost />`.
2. Verified cleaned areas:
   - `src/app/checkout/page.tsx`: Fake card `•••• 4242` removed; `shippingEur` is 0 when cart is empty.
   - `src/components/profile/publicProfilePayload.ts`: Aggregates dynamic km/D+ from user activities.
   - `src/components/compte/CompteLiquidGlassV8.tsx`: Visitor fallback is an honest guest profile (`isGuest: true`, `isDemo: false`, empty lists `[]`), preserving contract handle `tony_frc`.
   - `public/assets/images/no_image.png`: Replaced with valid 500x500 Light Liquid Glass SVG-derived avatar PNG.

### D. Supabase SQL Purge on `icxyvwzfjbflcbqukpfz`
1. Verified Preserved:
   - Query: `SELECT id, email, created_at FROM auth.users WHERE id = 'd5451f35-db9f-4575-9114-6d3b79550bbc'` -> 1 row (`demo@lkdv.app`).
   - Query: `SELECT id, handle, full_name, role FROM public.user_profiles WHERE id = 'd5451f35-db9f-4575-9114-6d3b79550bbc'` -> 1 row (`lea.fontaine`, `Léa Fontaine`, `user`).
   - Query: `SELECT count(*) FROM public.clubs WHERE id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed'` -> 0 rows (`Judisid` club deleted).
   - Query: `SELECT count(*) FROM public.community_posts WHERE content ILIKE '%Judisid%' OR content ILIKE '%Vidéo d’illustration CC0%'` -> 0 rows.
   - Foreign key integrity: 0 orphan profiles, 0 orphan notifications, 0 orphan messages, 0 orphan club members.
2. Unpurged Parasitic Accounts:
   - The original request explicitly mandated:
     > "Purger par SQL ciblé sur `icxyvwzfjbflcbqukpfz` uniquement les comptes/lignes de test parasites (`ergre`, `Jdjdjd`/`Bdjdjdjd`, `traytest_*`, comptes démo secondaires autres que le compte démo officiel de `/connexion`...)"
   - Query: `SELECT id, email FROM auth.users WHERE email ILIKE '%jdjdjd%'` -> Returned:
     `{ id: '6d6dc76c-5146-4c5a-8064-b1718daca07f', email: 'jdjdjdk@gmail.cim' }`
     This user literally matches the `Jdjdjd` keyword and still exists in `auth.users` and `public.user_profiles`.
   - In total, 68 obvious parasitic / test accounts remain in `auth.users`:
     - Examples: `faracitonypbdjd@gmail.com` (contains `bdjd`), `faracitonypdhjdjd@gmail.com` (contains `jdjd`), `faracitergeonyp@gmail.com` (contains `erge`), `faracitonyp@gmail.comefzfzz`, `lkdv.e2e.*@test.com`, `recette.*`, `perf-bench-1793820729246@example.com`, `audit-v3-*`, `debug.kit.*`.

---

## 2. Logic Chain

1. **Dead Links Invalidation**:
   - The removal of the 10 UI routes left dead links in `LeaderboardScreen.tsx`, `LeaderboardSummaryList.tsx`, and `MobileCountryDetailView.tsx`, plus a phantom `revalidatePath` in `bottleActions.ts`.
   - Clicking these in the application causes a 404 navigation error, and testing discovery wiring fails due to deleted files.
2. **Zero Mock Non-Compliance**:
   - Task 3 and the Master Plan require: "0 mock stories, fake cards, Unsplash URLs, or fake preset clubs in ClubLiquidGlassV8".
   - The worker deleted `CLUB_PRESETS` but retained 8 `INITIAL_*` mock datasets with 5 Unsplash image URLs, wiring them directly into `ClubDrawerHost`.
   - Therefore, the zero mock requirement in `ClubLiquidGlassV8` is not fulfilled.
3. **Database Purge Incompleteness**:
   - The worker stopped after deleting 42 users.
   - User `jdjdjdk@gmail.cim` and 60+ other test accounts directly matching the purge criteria (`Jdjdjd`, `bdjd`, `erge`, `e2e.*@test.com`) were not removed.
4. **Overall Assessment**:
   - Although TypeScript compiles with 0 errors and the design/api suites pass, the presence of hardcoded mock datasets in `ClubLiquidGlassV8`, broken links in leaderboards/pays, a failing vitest test (`tests/features/discovery/wiring.spec.ts`), and unpurged parasitic database records requires changes before Lot 3 can be approved.

---

## 3. Caveats

- We did not execute live Playwright browser tests requiring an active Next.js server (`playwright test`), as headless component and API suites were tested directly.
- No other caveats: All checks were empirically executed directly against the workspace codebase and the live Supabase PostgreSQL database.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Actionable remediation required for Lot 3:
1. **Clean `ClubLiquidGlassV8.tsx`**:
   - Empty or dynamically replace the 8 `INITIAL_*` mock datasets (`INITIAL_CLUBS_DIRECTORY`, `INITIAL_CLUB_POSTS`, `INITIAL_CLUB_MEMBERS` with Unsplash URLs, `INITIAL_CLUB_OUTINGS`, `INITIAL_VAULT_GEAR`, `INITIAL_STANDARD_KITS`, `INITIAL_CHALLENGES`, `INITIAL_CHAT_MESSAGES`) with empty arrays or dynamic queries from Supabase, showing honest empty states in `ClubDrawerHost`.
2. **Fix Dead Route References & Retarget or Retire Failing Test**:
   - Update `src/components/leaderboards/LeaderboardScreen.tsx` and `LeaderboardSummaryList.tsx` to redirect to `/explorer` or another active route instead of deleted `/classements`.
   - Update `src/components/pays/MobileCountryDetailView.tsx` to not link to `/pays`.
   - Remove or adapt `revalidatePath('/pays/${country}')` in `src/features/compas/server/bottleActions.ts`.
   - Update or retire `tests/features/discovery/wiring.spec.ts` so it no longer checks deleted `/pays` files and tabs.
3. **Complete SQL Purge on Supabase (`icxyvwzfjbflcbqukpfz`)**:
   - Purge user `jdjdjdk@gmail.cim` (`6d6dc76c-5146-4c5a-8064-b1718daca07f`) and the remaining parasitic accounts matching test patterns (`%jdjd%`, `%bdjd%`, `%erge%`, `%@test.com`, `%@example.com`, `%@lkdv-test.local`, `faracitonyp%@gmail.com%`), while strictly protecting the official demo account `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app`).

---

## 5. Verification Method

To independently verify these findings:

1. **Check Mocks in `ClubLiquidGlassV8.tsx`**:
   ```bash
   grep -n "images.unsplash.com" src/components/clubs/ClubLiquidGlassV8.tsx
   grep -n "INITIAL_CLUBS_DIRECTORY" src/components/clubs/ClubLiquidGlassV8.tsx
   ```
2. **Check Dead Links**:
   ```bash
   grep -n 'href="/classements"' src/components/leaderboards/LeaderboardScreen.tsx
   grep -n 'href="/pays"' src/components/pays/MobileCountryDetailView.tsx
   npx vitest run tests/features/discovery/wiring.spec.ts
   ```
3. **Check Supabase Unpurged User**:
   ```bash
   node -e "
   const { Client } = require('pg');
   require('dotenv').config({ path: '.env.local' });
   const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
   c.connect().then(async () => {
     const r = await c.query(\"SELECT id, email FROM auth.users WHERE email ILIKE '%jdjdjdk%'\");
     console.log('Unpurged user:', r.rows);
     await c.end();
   });
   "
   ```
