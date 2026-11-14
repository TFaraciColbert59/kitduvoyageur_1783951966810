## 2026-11-14T04:16:44Z
You are worker_lot4 (role: 'Lot 4 Implementation Worker').

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/worker_lot4

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context and References to Read First:
1. ORIGINAL_REQUEST.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
2. Scope Document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
3. Master Plan: /Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/implementation_plan.md (§5.A Compte & Profil Public + iPhone 16 Pro visual fixes)
4. Profile Explorer Handoff: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_lot4_profile/handoff.md
5. iPhone Visuals Explorer Handoff: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_lot4_iphone_visuals/handoff.md

Your Assigned Tasks:

PART A: Unified Profile6040Shell & Compte Sub-surfaces (per explorer_lot4_profile/handoff.md):
1. Create `src/components/profile/Profile6040Shell.tsx` unifying `/compte` and `/profil/[id]`:
   - 60/40 Liquid Glass layout: top 60% hero / profile seal / highlights / stats, bottom 40% public 3D map/grid respecting RLS `signature_visibility`.
   - Mount in `src/app/compte/page.tsx` (mode="owner") and `src/app/profil/[id]/page.tsx` (mode="visitor").
   - Visitor mode: 0 intimate settings, public map respects RLS (no private GPS coordinates exposed).
2. Eradicate `_MOCK_HIGHLIGHTS` (Dolomites, GR20...) and `TONY_AVATAR` in `src/components/compte/compte-liquid-glass-v8-runtime.js` and `src/components/clubs/club-liquid-glass-v8-runtime.js`. Highlights must be populated from genuine user carnets or honest empty state.
3. Fix real `km` / `D+` aggregation:
   - In `src/lib/supabase/queries-compte.ts`: query `hike_sessions` for distance and elevation gain.
   - In `src/components/profile/publicProfilePayload.ts`: populate `outings`, `massifs`, `countries`, and `yearMonths` dynamically from genuine user activities.
4. Fix Sub-surfaces:
   - `ConsentSettingsSheet` (`src/components/compte/drawer/compte/ConsentSettingsSheet.tsx`): enforce explicit text tokens (`#172B24`, `#56665D`) eliminating white text on frosted glass.
   - Visibility Drawer (`17-compte-visibilite.png`, event `lkdv:open-outing-bulk`): bind `OutingBulkAudienceSheet` cleanly and remove the empty runtime sheet.
   - Edit Profile Drawer (`11-compte-edit.png`): eliminate double `[×]` button by relocating avatar removal onto the avatar badge, and unlock drawer height to 92dvh.
   - Map State Banner (`06-compte.png`): remove `transform: none` in `src/components/compte/map/compte-map.css` to restore centering `translate(-50%, -50%)` and add clearance above TabBar.
   - Mountain Sorties View (`15-compte-mountain.png`): fix missing `.voyage-info` and cover fallback layout in `compte-liquid-glass-v8-runtime.js`.
   - Remove `author-thomas-alps` alias in `src/app/profil/[id]/page.tsx`.
   - IMPORTANT: Keep all contract strings required by `tests/design/compte-liquid-glass-v8.spec.ts` (`__lkdvHydrateCompte`, `href="/compte/modifier"`, `#17402C`, `#5B7F55`, `Story à la une`, `visiteur`, `Hiver`, `kitsim`, `Face ID`, `NameDrop`).

PART B: iPhone 16 Pro Visual Fixes across 5 Pillars (per explorer_lot4_iphone_visuals/handoff.md):
1. `/hub`:
   - Visible alpine disc/ring markers when idle in `src/features/hub/styles/hub-camp-option3.css`.
   - Convert `.camp-header` to Light Liquid Glass (sage/transparent, no dark charcoal `rgba(18, 38, 30, 0.78)`).
   - Fix blank pills in `HubGearDrawer.tsx` / `HubBudgetDrawer.tsx`.
   - Correct text color in `src/features/hub/components/budget/ReservationsOverview.tsx` to `#172B24`.
2. `/kit-studio`:
   - Display honest empty state for unauthenticated users instead of immediate redirect to `/connexion`.
   - Ensure Back button in `src/features/kit-studio/ui/kit-studio.css` has proper safe-area clearance and contrast.
   - Fix glyph mapping in `catalog.ts` and `ItemSheet.tsx`: Tent (`tent`), Duvet (`sack`), Mattress (`roll`).
3. `Explorer & Compas`:
   - In `map.css` / `v5.css`: raise dock/HUD and MapLibre attribution above native TabBar (`--v5-nav-clear` with `env(safe-area-inset-bottom)` / 83px).
   - In `ExplorerSheet.tsx`: cap sheet height under `.xp-chrome` + `env(safe-area-inset-top)` to eliminate collision with search/compass and hide overflow.
   - Round distances to 2 decimals or integer (`10 km` / `9,99 km`) in `CarnetDrawerV2.tsx` and related components; eliminate alpine elevation fallback (`≈ 850 m`) on flat tracks in `SheetContent.tsx`.
4. `Communauté, + Créer, Clubs & Sorties`:
   - Enforce contrast `#172B24` on top-right actions (`+`, search, bell) in `community-feed.css`.
   - Place wizard step capsule `1 | 2 | 3` (`.lkdv-cv2-mini-slot`) in flex flow above `.lkdv-cv2-footer` in `CommunitySheetShell.tsx` to eliminate overlap on "Suivant >".
   - Align search and sorties tabs with `SegmentedControl`.
   - Cleanly handle `event.organizer` on `/sorties/[id]`.
5. `Messages`:
   - Deduplicate direct threads per interlocutor in `src/components/messaging/messagesModel.ts`.
   - Avatar fallback: ensure initials fallback without broken `no_image.png` in `MessagesScreen.tsx`.
   - Fix padding and clearance above TabBar in `messages-grammar.css` and `MessagesScreen.tsx`.
6. `Carnet V2, Checkout, CookieConsentBanner & 404`:
   - Carnet: Dynamic Island margin in `carnet-v2.css`; remove `'— · '` em-dash artifacts in `place.ts` and `CarnetCardV2.tsx`; honest empty state in `CarnetDrawerV2.tsx`.
   - `src/app/not-found.tsx`: rebrand `"Boutique & Kits"` to `"Kits & Studio"` (`/kit-studio`), style card in light sage liquid glass (`#F0F5EE`, border `rgba(23,64,44,0.15)`, text `#17402C`).
   - `src/components/CookieConsentBanner.tsx`: replace dark charcoal `bg-[color:var(--lkv-ink-900)]` with sage liquid glass card (`#F0F5EE`, border `rgba(23,64,44,0.15)`, text `#172B24`, CTA green `#226148`).
   - Checkout: ensure safe-area insets in header and payment CTA in `src/app/checkout/page.tsx`.

Verification Commands to Run:
1. `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
2. `npx vitest run tests/design/`
3. `npx vitest run src/app/api/`
4. `npx vitest run tests/features/discovery/wiring.spec.ts tests/mobile-layout.spec.ts src/components/leaderboards/`
