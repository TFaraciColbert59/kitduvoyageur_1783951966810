# Handoff Report — Lot 3: Route Deletion, Zero Mock Cleanup & Supabase SQL Purge

## 1. Observation

### 1.1 UI Routes to Delete (9 Pages + `/dev/*`)
Under `src/app/`, exactly 20 files across 10 directories are confirmed for deletion:
- `src/app/planification/page.tsx`
- `src/app/heatmaps/page.tsx`
- `src/app/segments/page.tsx`
- `src/app/classements/page.tsx`
- `src/app/classements/[segmentId]/page.tsx`
- `src/app/rankings/page.tsx`
- `src/app/live-segments/page.tsx`
- `src/app/accessibilite/page.tsx`
- `src/app/carbone/layout.tsx`
- `src/app/carbone/page.tsx`
- `src/app/pays/layout.tsx`
- `src/app/pays/loading.tsx`
- `src/app/pays/[code]/error.tsx`
- `src/app/pays/[code]/loading.tsx`
- `src/app/pays/[code]/page.tsx`
- `src/app/pays/[code]/CountryDetailClient.tsx`
- `src/app/dev/compas-v5/page.tsx`
- `src/app/dev/compas-v5-carte/sample.ts`
- `src/app/dev/compas-v5-carte/page.tsx`
- `src/app/dev/compas-v5-carte/LiveMapLab.tsx`

**Backend APIs and Libraries Preserved Intact**:
- `src/app/api/heatmaps/*` (7 routes)
- `src/app/api/segments/*` (8 routes)
- `src/app/api/live-segments/*` (7 routes)
- `src/app/api/rankings/*` (9 routes)
- `src/app/api/pays/*` (5 routes)
- `src/app/api/dev/*` (4 routes)
- `src/lib/heatmaps/*`, `src/lib/segments/*`, `src/lib/live-segments/*`, `src/lib/rankings/*`, `src/features/pays/*`
All 26 backend tests for these APIs pass in Vitest (`src/app/api/**/__tests__`).

### 1.2 Inbound References to Deleted Routes
A comprehensive search mapped the following inbound references requiring removal or updating:
1. `src/middleware.ts`:
   - Line 31-32: `'/pays'`, `'/carbone'` in `APP_ROUTES`
   - Lines 181-198: Regex match `^\/pays\/([a-zà-ü-]+)$` and country redirect logic
   - Lines 210-211, 230: `'/pays'`, `'/pays/:path*'`, `'/carbone'` in `config.matcher`
2. `src/app/robots.ts`:
   - Lines 12-13, 17, 23: `'/pays'`, `'/pays/'`, `'/carbone'`, `'/accessibilite'` in `ALLOW`
3. `src/app/sitemap.ts`:
   - Line 18: `{ url: '/carbone', priority: 0.5, changeFrequency: 'monthly' }`
   - Line 25: `{ url: '/accessibilite', priority: 0.4, changeFrequency: 'yearly' }`
   - Lines 41-48: `publishedCountries.map(...)` generating `/pays/${country.code.toLowerCase()}`
   - Line 98: `...countryEntries` in return array
4. `src/constants/routeRegistry.json`:
   - Lines 404-409: Redirect `{ "source": "/pays", "destination": "/explorer", "permanent": false }`
5. `src/components/mobile-nav/destinationRegistry.ts`:
   - Line 67: `ariaLabel: 'Explorer les sentiers, pays et destinations'`
   - Line 69: `matchPaths: ['/explorer', '/pays']` (`'/pays'` to remove)
   - Line 120: `EXTENDED_NAV_PREFIXES` includes `'/pays'` (`'/pays'` to remove)
6. `src/components/mobile-nav/navigation/useNavigationPlateau.ts`:
   - Lines 35-36: `isPaysHub`, `isPaysDetail`
   - Lines 72-77, 102-107, 131-132, 144-145, 187-196: `activePaysContinent`, `activePaysDetailTab`, and listeners `pays-continent-change`, `pays-detail-tab-change`
7. `src/components/ui/GlobalSearchModal.tsx`:
   - Line 31: `{ label: 'Guide Islande & Volcans', category: 'Destination', url: '/pays/is' }`
   - Lines 214-217: Static destinations pointing to `/pays/is`, `/pays/no`, `/pays/np`, `/pays/ch`
8. `src/components/map/UnifiedExplorerMap.tsx`:
   - Lines 1736-1741: `<Link href={'/pays/' + selectedCountry.iso.toLowerCase()}>Explorer le pays</Link>`
9. Obsolete UI primitives:
   - `src/components/ui/GlassSubCard.tsx`, `src/components/ui/GlassPill.tsx`, `src/components/ui/GlassCapsuleBtn.tsx`
   - `src/components/ui/index.ts` re-exports them
   - `src/features/hub/components/HubActivityHero.tsx` imports `GlassCapsuleBtn` at line 7 and uses it at line 150
10. Test references:
   - `tests/design/m02-destination-registry.spec.ts`: line 67 expects `getActiveDestinationId('/pays/france') === 'explorer'`
   - `tests/visual/pays-visual.spec.ts`, `tests/visual/unification-visual.spec.ts`, `tests/visual/shell.spec.ts`: Playwright tests navigating to `/pays` or `/pays/fr`

### 1.3 Zero Mock & Real Data Inventory
- **DEMO_* constants**:
  - `DEMO_AUTO_LOGIN`, `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD` in `src/contexts/AuthContext.tsx`, `src/app/api/demo-login/route.ts`, `src/app/api/auth/demo/route.ts`, `src/features/demo/*` are essential to the official demo account and **MUST BE PRESERVED**.
  - `DEMO_STUDIO_DATA`, `DEMO_OWN` in `src/features/kit-studio/domain/studioData.ts:53-72` are hardcoded mocks to replace with real empty state.
  - `DEMO_FREEDOM_COMMENTS` in `src/features/community/reels/freedomReelsService.ts:240-265` are hardcoded comments.
  - `DEMO_CARNETS`, `DEMO_OUTINGS`, `DEMO_CLUBS`, `DEMO_GEAR_ITEMS`, `DEMO_ORDERS`, `DEMO_ACTIVE_LOANS` in `src/components/clubs/ClubLiquidGlassV8.tsx:92-295` and `src/components/compte/CompteLiquidGlassV8.tsx:174-389`.
  - `DEMO_NOW_ISO`, `DEMO_VIEWER`, `DEMO_MAIN_ROUTE`, `DEMO_LODGINGS` in `src/components/planning/sampleData.ts`.
- **_MOCK_* constants**:
  - In `src/components/clubs/club-liquid-glass-v8-runtime.js` and `src/components/compte/compte-liquid-glass-v8-runtime.js`:
    - `_MOCK_HIGHLIGHTS` (Dolomites, GR20, Vercors, Mont-Blanc, Sac)
    - `_MOCK_MASSIFS`, `_MOCK_OUTINGS`, `_MOCK_CARNETS`, `_MOCK_SPECIES`, `_MOCK_KITS_LINEAGE`, `_MOCK_ORDERS_BOOKINGS`, `_MOCK_TRIBU`, `_MOCK_CLUBS`
- **CLUB_PRESETS**:
  - `src/components/clubs/ClubLiquidGlassV8.tsx:304`: `const CLUB_PRESETS: Record<string, ...>` with fallback lookups at lines 573 and 856 causing fallback data and 400 errors.
- **Mathieu Chevrier & Checkout fake data**:
  - `src/app/checkout/page.tsx:484`: fake card number `•••• •••• •••• 4242` and fake card visual.
  - `src/app/checkout/page.tsx:60-65`: shipping costs default to 5.90 € even when cart is empty (`items.length === 0`).
- **Fake stories & avatars**:
  - `src/components/compte/drawer/compte/HighlightEditDrawer.tsx:17-60`: `MOCK_HIGHLIGHTS_FALLBACK` with Unsplash images.
  - `src/components/compte/compte-liquid-glass-v8-runtime.js:45`: `TONY_AVATAR` base64 jpeg.
  - `src/app/profil/[id]/page.tsx:110`: `author-thomas-alps` hardcoded alias.
  - `public/assets/images/no_image.png`: 20KB opaque PNG referenced 40+ times as avatar fallback across `src/features/messaging/*`, `src/features/trips/*`, `src/features/hub/*`, `src/components/ui/AppImage.tsx`.
- **Alpes/Écrins fake data**:
  - `src/features/hub/components/HubCampShell.tsx:829-844`: hardcoded `Traversée des Écrins 2026` and `Tour des Fiz 2025`.
  - `src/features/hub/components/drawers/HubDocsDrawer.tsx:26-45`: hardcoded `Halte au Refuge des Écrins`, `SNCF TGV + TER Chamonix`.
  - `src/features/hub/components/drawers/HubItineraryDrawer.tsx:250-269`: hardcoded `Bivouac du Lac Turquoise`, `Refuge des Écrins`.
  - `src/features/hub/components/drawers/HubDepartDrawer.tsx:72`: `Gourdes & Hydratation (2L)`.
- **Real profile stats calculation**:
  - `src/components/profile/publicProfilePayload.ts:47-52`: `massifs`, `countries`, `yearMonths`, `outings` hardcoded to 0/empty despite existing activities in `input.activite`.

### 1.4 Supabase Live Inspection (`icxyvwzfjbflcbqukpfz`)
Live inspection using `execute_sql` via Supabase MCP confirmed:
1. **Official Demo Account**:
   - `auth.users`: UID `d5451f35-db9f-4575-9114-6d3b79550bbc`, `demo@lkdv.app`, created `2026-08-21 00:24:22+00`.
   - `public.user_profiles`: `full_name: "Léa Fontaine"`, `handle: "lea.fontaine"`, `role: "user"`, `profile_visibility: "public"`.
   - Owns 2 legitimate clubs (`Trekkeurs des Alpes`, `Islandophiles Nomades`), 26 legitimate community posts, and legitimate carnets (TMB, Islande, GTJ, etc.).
   - Owns 0 rows in `public.events` or `public.club_events`.
2. **Parasitic Rows Identified**:
   - Parasitic test club: `Judisid` (`id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed'`, created by demo user on 2026-10-28)
   - Parasitic community posts: exactly 11 posts (1 Judisid welcoming post `3e478630-f742-4073-af8d-4ac1c17312b1` + 10 fake CC0 video posts).
   - Test carnets: exactly 3 carnets created on 2026-11-11 with titles `Jdjdjd*` (`55e9180f-...`, `63d920da-...`, `82e70018-...`).
   - Demo seed events: exactly 4 events in `public.events` and 29 events in `public.club_events`.
   - Parasitic accounts: exactly 42 users in `auth.users` matching gibberish handles/emails (`ergre`, `Jdjdjd`, `Bdjdjdjd`, `traytest_*`, anonymous 2026-11-11 accounts, secondary demo accounts).
3. **Foreign Key Integrity**:
   - Verified that `user_profiles.id` references `auth.users(id)` with `ON DELETE CASCADE`.
   - Verified that all child tables referencing `user_profiles(id)` or `auth.users(id)` use either `CASCADE` or `SET NULL`.
   - There are **0 tables with `RESTRICT` or `NO ACTION`**.

---

## 2. Logic Chain

1. **Safety of Route Deletion**:
   - Investigation proved that no active component outside the 10 target folders imports from `@/app/(accessibilite|carbone|...)`.
   - Backend APIs (`src/app/api/pays`, `src/app/api/heatmaps`, `src/app/api/segments`, `src/app/api/live-segments`, `src/app/api/rankings`) are tested, isolated, and completely decoupled from the UI page folders. Preserving `src/app/api/*` and `src/lib/*` while deleting UI pages ensures native mobile endpoints remain functional.
   - Removing the 9 routes from `middleware.ts`, `robots.ts`, `sitemap.ts`, `routeRegistry.json`, and mobile navigation registries cleanly eliminates dead navigation branches and ensures deleted paths yield HTTP 404 / 301 as expected.

2. **Clean Primitives Substitution**:
   - `GlassSubCard` and `GlassPill` have zero external imports outside `src/components/ui/index.ts`.
   - `GlassCapsuleBtn` is only imported by `src/features/hub/components/HubActivityHero.tsx` for a single button ("Partager"), which can be directly replaced with the unified `Button` primitive (`variant="glass"`). This permits safe removal of the 3 legacy glass primitives.

3. **Zero Mock Strategy**:
   - Preserving `DEMO_AUTO_LOGIN` / `DEMO_LOGIN_*` ensures `/api/demo-login` and `/connexion` stay functional without breaking CI or manual tester access.
   - Replacing hardcoded `CLUB_PRESETS` in `ClubLiquidGlassV8.tsx` with Supabase data resolution (`supabase.from('clubs').select('*').eq('id', clubId)`) resolves 400 Bad Request errors for dynamic clubs.
   - Replacing `no_image.png` with letter initials in circular avatars eliminates 404s and visual degradation across messaging and account screens.
   - Updating `publicProfilePayload.ts` to calculate `km`, `dplus`, and populate `outings`, `massifs`, `countries`, and `yearMonths` from `input.activite` ensures the public profile displays real user stats instead of zeros.

4. **Guaranteed Non-Destruction of Demo Account**:
   - Invariant: `id != 'd5451f35-db9f-4575-9114-6d3b79550bbc'` is hardcoded into the SQL deletion script.
   - The query dry-run proves that all 42 accounts selected for deletion are distinct from the demo account.
   - Cascading deletions will cleanly remove test rows without leaving orphaned records or triggering constraint errors.

---

## 3. Caveats

1. **Visual Playwright Tests**: `tests/visual/pays-visual.spec.ts` navigates directly to `/pays/fr`. When `/pays/[code]` is removed, this test file will naturally fail unless it is retired or adapted.
2. **Offline/Cached Data**: Mobile clients that have cached references to deleted routes should be handled gracefully by server returning 404.
3. **MapLibre Country Click**: `UnifiedExplorerMap.tsx` currently has a CTA button linking to `/pays/[code]`. Rather than breaking with a 404, the explorer map should filter or zoom to the selected country within `/explorer`.

---

## 4. Conclusion

The specification for Lot 3 is fully designed, verified against live code and database, and ready for immediate implementation:
1. Delete the 20 UI files across the 10 target directories.
2. Update the 9 navigation/router files and remove the 3 obsolete primitives.
3. Replace hardcoded mocks with real queries or honest empty states across Hub, Studio, Clubs, Compte, and Checkout.
4. Execute the targeted SQL purge script on Supabase project `icxyvwzfjbflcbqukpfz`.

### Targeted Supabase SQL Deletion Script

```sql
-- ============================================================================
-- LOT 3: TARGETED DATABASE PURGE ON icxyvwzfjbflcbqukpfz (lekitduvoyageur2)
-- MANDATORY HARD CONSTRAINT: demo@lkdv.app (UID d5451f35-db9f-4575-9114-6d3b79550bbc)
-- MUST REMAIN 100% OPERATIONAL. NEVER DELETE THIS UID OR ITS LEGITIMATE DATA.
-- ============================================================================

BEGIN;

-- 1. DELETE PARASITIC / TEST COMMUNITY POSTS
-- 1.1 Judisid welcoming post (club test)
DELETE FROM public.community_posts
WHERE id = '3e478630-f742-4073-af8d-4ac1c17312b1'
   OR club_id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed'
   OR content ILIKE '%Judisid%';

-- 1.2 Fake CC0 video posts
DELETE FROM public.community_posts
WHERE content ILIKE '%Vidéo d’illustration CC0%'
   OR content ILIKE '%Séquence d’illustration (CC0)%'
   OR content ILIKE '%vidéo libre CC0%'
   OR content ILIKE '%Wikimedia Commons%';

-- 2. DELETE TEST CARNETS (Jdjdjd tests)
DELETE FROM public.carnets
WHERE title ILIKE 'Jdjdjd%'
  AND author_id = 'd5451f35-db9f-4575-9114-6d3b79550bbc';

-- 3. DELETE PARASITIC / TEST CLUB: Judisid
-- All club_members, club_channels, etc. cascade delete automatically
DELETE FROM public.clubs
WHERE id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed'
   OR slug ILIKE 'judisid%';

-- 4. DELETE DEMO SEED EVENTS & TEST EVENTS
-- 4.1 From public.events
DELETE FROM public.events
WHERE id IN (
  '6e8bbcad-85b7-548a-9492-77c82b656d60', -- Rencontre Japon — récits de marche
  '465d0a27-8b40-5f50-b903-943f1881790e', -- Rencontre vanlife — Biscarrosse
  '9694eb1f-96d3-569d-9733-e908177685d3', -- Soirée Népal — retour de trek
  '27747609-b22b-4f23-bfc0-fd88caf8d809'  -- Jeudjdjd
) OR title IN (
  'Rencontre Japon — récits de marche',
  'Rencontre vanlife — Biscarrosse',
  'Soirée Népal — retour de trek',
  'Jeudjdjd'
);

-- 4.2 From public.club_events
DELETE FROM public.club_events
WHERE title LIKE 'Bivouac Initiation - %'
   OR title LIKE 'Expédition avancée - %'
   OR title IN (
     'Rencontre Japon — récits de marche',
     'Rencontre vanlife — Biscarrosse',
     'Soirée Népal — retour de trek'
   );

-- 5. DELETE PARASITIC / TEST USERS (FROM auth.users - Cascades to user_profiles and dependents)
-- Hard constraint safety check: Ensure demo UID is NEVER deleted
DELETE FROM auth.users
WHERE id != 'd5451f35-db9f-4575-9114-6d3b79550bbc'
  AND (
    -- Test accounts with gibberish names/emails
    id IN (
      '4a55e4c5-2418-49fe-8250-4ed98daed03f', -- ergre (gre@ezfe.com)
      '7834f5a9-8613-4f41-9665-ee8e2a313da4', -- Jdjdjd (faracitonypdhdh@gmail.com)
      'a450eb98-61de-4b37-85db-6f1cb687f9cb', -- Jdjdjd (dhjdjd@djdjdn.cokdjd)
      '19ca19a2-9f93-4133-bf1d-32fee6fe9ace', -- Jdudjdjd (faracitonyp@gmail.comdjjdjd)
      'd988b6b3-ef6c-4c5a-998e-4ac5a1f4c9e9', -- Bdjdjdjd (dndjdj@jdjdj.com)
      '5b182835-966f-49b8-b254-16d28fd4cc1e', -- Fuidjd (jdjdj@jdjdj.com)
      '627ea47b-90d8-40ce-aeaf-fbd78f5b06e4', -- jdidjd@jdidkd.com
      '13ed05ea-2a53-4ecf-9241-4fc5e72a55e5', -- reeger (ergerrg@erger.com)
      '873d14e7-806d-45c9-ab8a-9aeb43379d96', -- dhjdjd@djdjdn.cokdjdhjjj
      'a2b1ba3e-a886-4141-90c3-fa765a10608e', -- dezdez@cezefcz.com
      '94670fc4-0f7f-4eba-83bc-4c3f3a8f2db2', -- sqcdcsq@yuvvku.com
      'bb0239a0-82d9-414e-92dd-d2485170b261', -- tfty@tyc.com
      'b4dd5f27-fffc-47ab-ad9e-4031cc43f069', -- gregerr@rgfrez.com
      '15c66df8-3190-4720-9e53-b0e5caaa66ce', -- ezfzeffze@gmail.com
      '0f37f8ff-1b48-45f9-85a8-a7d4a5e9c866', -- ebnzevve@enje.com
      'b7c7c2d3-6e2c-4f9c-abe3-cab0f23cdbdc'  -- rhtrth@trhrt.com
    )
    OR email ILIKE 'traytest_%'
    OR (email IS NULL AND created_at >= '2026-11-11 00:00:00+00')
    -- Secondary demo accounts (keeping demo@lkdv.app safe)
    OR email IN (
      'demo.bot@example.com',
      'compas.demo@lkdv-demo.test',
      'lea.demo@lkdv-demo.test',
      'malik.demo@lkdv-demo.test',
      'claude-demo@lkdv-test.dev',
      'compas.demo@lekitduvoyageur.fr',
      'sefsedemo@lkdv.app',
      'demo.a.stories@lkdv.dev',
      'demo.b.stories@lkdv.dev',
      'y-demo@lekitduvoyageur.fr'
    )
  );

COMMIT;
```

---

## 5. Verification Method

1. **Verify Route Deletion**:
   - Run `ls src/app/{planification,heatmaps,segments,classements,rankings,live-segments,accessibilite,carbone,pays,dev}` — should return "No such file or directory".
   - Verify `src/app/api/{heatmaps,segments,live-segments,rankings,pays,dev}` still exist and contain all route files.
2. **Verify Inbound References**:
   - `grep -rn -E "(/planification|/heatmaps|/segments|/classements|/rankings|/live-segments|/accessibilite|/carbone|/pays)" src/middleware.ts src/app/robots.ts src/app/sitemap.ts src/constants/routeRegistry.json src/components/mobile-nav/` — should return 0 results.
3. **Verify Type Checking & Tests**:
   - `npx tsc --noEmit`
   - `npx vitest run tests/design/` (must remain 100% green)
   - `npx vitest run src/app/api/` (all 26 backend tests must remain green)
4. **Verify Supabase Cleanup**:
   - Execute query `SELECT count(*) FROM public.clubs WHERE id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed';` (should return 0).
   - Execute query `SELECT count(*) FROM auth.users WHERE id = 'd5451f35-db9f-4575-9114-6d3b79550bbc';` (must return 1).
   - Execute query `SELECT count(*) FROM public.user_profiles WHERE id = 'd5451f35-db9f-4575-9114-6d3b79550bbc';` (must return 1).
