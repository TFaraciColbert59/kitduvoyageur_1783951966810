# Handoff Report: E2E Test Specifications (Tier 1 & Tier 2) — LKDV Messagerie

**State folder**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_e2e_t1t2_1`  
**Working directory**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`  
**Target Module**: `/messagerie`, Design System Bank (`src/design/bank.ts`), iOS Bridge sync (`ios/App/App/DesignTokens.generated.swift`)  
**Specification Reference**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `SCOPE.md`, `spec_messagerie_audit.md`, `audit_complet_iphone.md` (Section 5)

---

## 1. Observation

Direct code inspections, file readings, and audit findings confirm the following concrete architectural, styling, and functional facts:

1. **Tokens Bank & Multi-target Generation**:
   - `src/design/bank.ts` defines design tokens across `surfaces`, `inks`, `brand`, `glass`, `typography`, `radii`, `zIndex`, `spacing`, `motion`, and `ghosts`.
   - `scripts/generate-design-bank.mjs` compiles `bank.ts` into:
     - `src/styles/tokens.generated.css`
     - `src/design/tokens.generated.ts`
     - `tailwind.preset.generated.js`
     - `ios/App/App/DesignTokens.generated.swift`
   - Grabber handle specifications in `bank.ts` / `tokens.css`: 36×5pt, radius 2.5pt (or 999px pill).
   - Inset grouped lists, squircle continuous corner radii (`radii.card: 28`, `radii.sheet: 44`), and system typography (`-apple-system-headline`, `-apple-system-body`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`) are formalized.

2. **Residual Dark Themes and Pure Black Injections**:
   - `src/styles/tokens.css` line 633 contains `.dark { ... }` and line 834 `html.dark, .dark, [data-theme='dark'] { ... }` containing dark color definitions that risk leaking pure black `#000000` or `#0d1117` into screens.
   - `capacitor.config.ts` line 75 specifies `Keyboard: { style: "DARK" as any }`, conflicting with the 100% Light Mode Liquid Glass pure LKDV green palette requirement.
   - Linear gradient masks in `src/components/messaging/messages-grammar.css` lines 886, 1545, 1557 use `#000` as alpha mask markers (`-webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 10px)`).

3. **Header Navigation Defect**:
   - `src/components/messaging/MessagesScreen.tsx` lines 1470-1474:
     ```tsx
     <button
       type="button"
       className="lg ig-handle"
       onClick={() => router.push('/compte')}
       onPointerEnter={() => router.prefetch('/compte')}
       onTouchStart={() => router.prefetch('/compte')}
       aria-label="Messages — aller au compte"
     >
       <span>Messages</span>
     </button>
     ```
   - `src/components/ui/NotificationBell.tsx` line 29:
     ```tsx
     <Link href="/compte?tab=notifications" className={`lkdv-notif-wrap ${className}`.trim()} ...>
     ```
   - Both elements escape `/messagerie` to `/compte`, causing an abrupt screen departure and dark flash `#0d1117`.

4. **Filter Control Collision (`SubCapsuleTabs`)**:
   - `src/components/messaging/MessagesScreen.tsx` lines 1660-1678 places `<SubCapsuleTabs placement="float" className="mfilters" ... />` inside `.card.cs` (`#card`).
   - `src/components/messaging/messages-grammar.css` lines 995-1002 styles `.mfilters`:
     ```css
     .lkdv-messages .mfilters {
       position: absolute !important;
       right: 12px !important;
       bottom: 10px !important;
       width: 196px !important;
       z-index: 6 !important;
     }
     ```
   - Under iPhone 16 Pro (402×874 pt), `.mfilters` at `y=346..376` physically overlaps the 4th conversation row (`Dolomites — août` at `y=337..393`).

5. **Split View 40/60 Collision & First Message Occlusion**:
   - `messages-grammar.css` line 1909: `.lkdv-messages .mapzone > .msplit` is centered at `left: 50%; transform: translateX(-50%); width: 88px` (`x=157..245 pt`).
   - `messages-grammar.css` line 360: `.lkdv-messages .mpill` has `margin: 8px 12px 6px`. In group conversations (`Bivouac de printemps · 5 membres`), width reaches 189 pt (`x=12..201 pt`).
   - This creates a **44 pt physical overlap collision** between `x=157` and `x=201`.
   - In `MessagesScreen.tsx`, the first message bubble at `y=338` scrolls beneath the split separator and header pill without sufficient top padding.

6. **Modal Drawer Placement & Truncation**:
   - `ComposerMenuSheet.tsx` line 286 mounts inside `<AccountDrawerHost variant="card">`.
   - `AccountDrawerHost` with `variant="card"` binds its bounding box to `#card` (height 276 pt, `y=110..386 pt`).
   - Clicking `+` at bottom `y=728 pt` opens the drawer at the top (`y=110 pt`), cutting off options "Équipement" and "Kit" beyond `y=386 pt`.
   - `ConversationOptionsSheet.tsx` likewise opens at `y=110..386 pt` without an Apple-compliant close button (`×`) and with a redundant "Écrire un message" button.

7. **Demandes Filter & Empty State Anomalies**:
   - `MessagesScreen.tsx` line 1608 displays `.mstate` ("Aucune discussion / Nouvelle discussion") in `#card` while lines 1805-1811 simultaneously display `.mstate` ("Choisissez une discussion / Nouvelle discussion") in `.mapzone`.
   - The button "Nouvelle discussion" uses `focusSearch` (`searchRef.current?.focus()`) instead of opening `NewConversationModal`.
   - In `Demandes`, the button previously exhibited dark green text on dark green background with contrast < 1.1:1.

8. **Group Chat Realtime Freeze**:
   - `useConversations.ts` line 48 calls `setLoading(true)` on every background invocation of `fetchConversations()`, including Realtime `conversation_members` updates triggered by opening a group chat (`markAsRead`).
   - In `MessagesScreen.tsx`, `loading && conversations.length === 0` renders 4 grey loading skeletons (`.mrows-skeleton`).

9. **Shared Post Embed**:
   - `SharedPostEmbed.tsx` line 61 renders `<div className="mpost-embed-fallback">Publication indisponible</div>` styled as a raw grey rectangle without LKDV brand aesthetics.

10. **Reaction Emoji Overlay**:
    - `MessagesScreen.tsx` lines 798-825 renders `openMenu === message.id` directly into the DOM flow within `.mbub-wrap`, pushing the chat downward across 2 lines and clipping emojis.

---

## 2. Logic Chain

1. **Derivation of Test Strategy**:
   - Because LKDV Messagerie is deployed across Web (Next.js) and native iOS (Capacitor on iPhone 16 Pro), tests must verify both static contract adherence (design bank, token generators, Swift files) and dynamic DOM/behavioral contracts (navigation routing, coordinates, z-index, accessibility, Realtime stability).
   - Opaque-box requirements dictate that tests stimulate public interfaces (`click`, `scroll`, `drag`, `resize`, `realtime event`, `token compilation`) and assert externally observable outcomes (DOM attributes, bounding client rects, computed CSS styles, navigation URLs, WCAG contrast ratios, process exit codes).

2. **Tier 1 (Feature Coverage) Logic**:
   - Each of the 12 features from `PROJECT.md` represents a discrete functional domain.
   - To guarantee complete coverage without regression, each feature requires at least 5 isolated, independent test cases verifying positive paths, interface contracts, visual geometry, and functional fulfillment.
   - 12 features × 5 tests = 60 concrete Tier 1 test cases.

3. **Tier 2 (Boundary & Corner Cases) Logic**:
   - Real devices exhibit failure modes at extreme values (viewport widths 320px vs 402px vs 430px, zero/negative drag offsets, 99+ notifications, network disconnection, malformed data, and dark theme class injection).
   - Each feature requires at least 5 stress/boundary test cases verifying robustness under invalid, extreme, or adversarial conditions.
   - 12 features × 5 tests = 60 concrete Tier 2 test cases.

4. **Total Catalog Scope**:
   - Total of 120 concrete, fully specified test cases with unique IDs, preconditions, inputs, assertions, and verification criteria.

---

## 3. Tier 1 Test Catalog: Feature Coverage (60 Tests)

### Feature 1: Apple Primitives & Tokens Bank (F01)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F01-01` | Sheet grabber handle dimensions | Apple Primitives Bank | Bounding rect of `.sheet-grabber` or `.msplit > span` | Width is exactly `36px` (±0.5px), height is `5px` (±0.5px), border-radius is `2.5px` (or pill) | `computedStyle(grabber).width === '36px'` && `height === '5px'` |
| `E2E-T1-F01-02` | Squircle continuous corner radii | Apple Primitives Bank | Inspect CSS custom properties in `tokens.generated.css` | `--lkv-radius-card: 28px`, `--lkv-radius-sheet: 44px`, `--lkv-radius-hero: 38px`, `--lkv-radius-pill: 9999px` | Regex match in generated CSS and computed `--card-radius` |
| `E2E-T1-F01-03` | Apple system typography hierarchy | Apple Primitives Bank | Render headline, body, caption elements with typography tokens | Headline uses `-apple-system`, weight 600, size 17px; Body uses size 17px, line-height 22px; Caption1 uses 12px, line-height 16px | `getComputedStyle(el).fontFamily.includes('-apple-system')` |
| `E2E-T1-F01-04` | Liquid Glass material blur & saturation | Apple Primitives Bank | Read glass tokens: `--g1-blur`, `--g2-blur`, `--g3-blur` | `g1: 12px` (sat 180%), `g2: 24px` (sat 180%), `g3: 36px` (sat 190%), `gc: 20px` (sat 180%) | `computedStyle.backdropFilter` contains `blur(24px) saturate(180%)` on `.lg` elements |
| `E2E-T1-F01-05` | Multi-target token generator consistency | Apple Primitives Bank | Execute `node scripts/generate-design-bank.mjs --check` | Exit code 0, stdout confirms all 5 generated artifacts are perfectly in sync with `src/design/bank.ts` | Process exit code `0` |

### Feature 2: Pure LKDV Green Palette (No Pure Black) (F02)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F02-01` | Zero pure black `#000000` in active styles | LKDV Green Palette | Full token scan across all active CSS rules in `/messagerie` | No color or background rule evaluates to `#000000`, `#000`, `rgb(0,0,0)`, or `black` (excluding gradient alpha masks) | Color scanner AST check across rendered styles |
| `E2E-T1-F02-02` | Elimination of charcoal dark `#0d1117` | LKDV Green Palette | Search for `#0d1117` in DOM styles, stylesheets, and navigation backgrounds | Zero occurrences of `#0d1117` in computed styles | `!document.body.innerHTML.includes('#0d1117')` |
| `E2E-T1-F02-03` | Forest green brand primary mapping | LKDV Green Palette | Inspect `--lkv-primary`, `--lkv-action`, `--lkv-surface-canvas` | `--lkv-primary: #17402C`, `--lkv-action: #226148`, `--lkv-surface-canvas: #FBFAF6` | `computedStyle.getPropertyValue('--lkv-primary').trim() === '#17402C'` |
| `E2E-T1-F02-04` | Deep forest dark ink token mapping | LKDV Green Palette | Inspect text primary and secondary tokens | `--lkv-text-primary: #172B24`, `--lkv-text-secondary: #56665D`, `--lkv-scrim: rgba(16, 28, 23, 0.42)` | Evaluated hex/rgba matches LKDV green ink spec |
| `E2E-T1-F02-05` | Capacitor native keyboard light configuration | LKDV Green Palette | Read `capacitor.config.ts` Keyboard plugin section | `Keyboard.style` is `"LIGHT"` (not `"DARK"`) | `config.plugins.Keyboard.style === 'LIGHT'` |

### Feature 3: Swift Native Design Tokens Sync (F03)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F03-01` | Swift brand color tokens sync | Swift Native Sync | Inspect `ios/App/App/DesignTokens.generated.swift` | `brandPrimary = hexColor("#17402C")`, `brandAction = hexColor("#226148")`, `brandSecondary = hexColor("#5B7F55")` | Exact string match in Swift source file |
| `E2E-T1-F03-02` | Swift surface and label tokens sync | Swift Native Sync | Inspect `DesignTokens.Colors` in generated Swift | `surfaceCanvas = hexColor("#FBFAF6")`, `surfaceElevated = hexColor("#FFFFFF")`, `labelPrimary = hexColor("#172B24")` | Exact string match in Swift source file |
| `E2E-T1-F03-03` | Swift radii tokens parity | Swift Native Sync | Inspect `DesignTokens.Radii` | `xs: 12`, `sm: 16`, `md: 20`, `lg: 24`, `card: 28`, `hero: 38`, `sheet: 44`, `pill: 9999` | Values match `src/design/bank.ts` `radii` |
| `E2E-T1-F03-04` | Swift ZIndex hierarchy parity | Swift Native Sync | Inspect `DesignTokens.ZIndex` | `base: 1`, `sticky: 100`, `subbar: 200`, `tabbar: 300`, `hud: 400`, `sheet: 500`, `modal: 600`, `alert: 700` | Values match `src/design/bank.ts` `zIndex` |
| `E2E-T1-F03-05` | Swift syntax and compilation validation | Swift Native Sync | Parse `DesignTokens.generated.swift` with Swift compiler syntax check | File compiles cleanly with 0 syntax errors or warnings | `swiftc -typecheck ios/App/App/DesignTokens.generated.swift` passes (or regex AST validator) |

### Feature 4: External Skills Integration (Apple HIG & Liquid Glass) (F04)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F04-01` | Apple HIG 44×44pt touch target compliance | External Skills Integration | Measure bounding client rects of all interactive buttons in `/messagerie` | Every button (search clear, notification bell, filter tabs, composer buttons, sheet close) has `width >= 44px` and `height >= 44px` | `rect.width >= 44 && rect.height >= 44` |
| `E2E-T1-F04-02` | Liquid Glass specular rim highlight | External Skills Integration | Inspect `.lg` / `.glass-pill` box-shadow properties | Contains `inset 0 1px 0 rgba(255, 255, 255, 0.75)` (or 0.85/0.95) specular reflection highlight | `boxShadow` contains `inset 0px 1px 0px` |
| `E2E-T1-F04-03` | Dynamic Type font family cascade | External Skills Integration | Test elements with `-apple-system` font cascade | Elements inherit `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` | Computed `fontFamily` starts with `-apple-system` |
| `E2E-T1-F04-04` | Haptic feedback triggering on user actions | External Skills Integration | Click primary filter tabs and sheet action buttons | `useHapticFeedback` invokes `selection` or `light` haptic pattern | Mock haptic spy called with `'selection'` or `'light'` |
| `E2E-T1-F04-05` | Apple continuous corner squircle rendering | External Skills Integration | Inspect card and sheet border-radius and corner-smoothing | Applied `border-radius: 28px` (card) and `44px` (sheet) with smooth corners | Bounding radius check on `.card` and `.sheet` |

### Feature 5: Header Navigation Fix (F05)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F05-01` | Title "Messages" click does NOT route to `/compte` | Header Navigation Fix | Tap `#top .ig-handle` ("Messages" title) | Browser URL remains `/messagerie`; no call to `router.push('/compte')` | `window.location.pathname === '/messagerie'` |
| `E2E-T1-F05-02` | Title "Messages" scrolls list to top | Header Navigation Fix | Scroll conversation list down by 200px, then tap "Messages" title | Conversation list scroll position smoothly animates to `scrollTop: 0` | `container.scrollTop === 0` |
| `E2E-T1-F05-03` | Title accessible name sanitation | Header Navigation Fix | Inspect `aria-label` of `#top .ig-handle` | Value is `"Messages"` or `"Fil des messages"` (no longer contains "aller au compte") | `!button.getAttribute('aria-label').includes('aller au compte')` |
| `E2E-T1-F05-04` | Notification bell does NOT navigate to `/compte` | Header Navigation Fix | Tap notification bell in `#top .ig-top-r` | Does not navigate to `/compte?tab=notifications`; opens in-app notification sheet or unread filter | `window.location.pathname === '/messagerie'` |
| `E2E-T1-F05-05` | Zero dark transition flash on header interaction | Header Navigation Fix | Tap header buttons while monitoring background color | Surface background remains light (`#FBFAF6` / `rgba(255,255,255,...)`); no black frame `#0d1117` | Background color never matches `#0d1117` during transition |

### Feature 6: Filter SegmentedControl Repositioning (F06)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F06-01` | Normal document flow positioning | Filter Repositioning | Inspect computed `position` of `.mfilters` / `SubCapsuleTabs` | `position` is `relative` or `static` (NOT `position: absolute` with `bottom: 10px`) | `computedStyle.position !== 'absolute'` |
| `E2E-T1-F06-02` | Unobstructed 4th conversation row visibility | Filter Repositioning | Render 4 or more conversations in list | 4th conversation row bounding box has zero vertical overlap with filter control | `row4Rect.bottom <= filterRect.top` or `filterRect.bottom <= row4Rect.top` |
| `E2E-T1-F06-03` | Tab switching between all 4 filter categories | Filter Repositioning | Click sequentially: "Toutes", "Directs", "Groupes", "Demandes" | Active tab indicator updates, conversation list filters matching conversations | Active index updates 0 -> 1 -> 2 -> 3 |
| `E2E-T1-F06-04` | Filter indicator spring sliding animation | Filter Repositioning | Measure `.ig-th` slider transform on tab change | Horizontal transform transitions with spring curve (`--ease-spring`) | `computedStyle.transition` contains spring curve |
| `E2E-T1-F06-05` | Unread badge rendering on Demandes tab | Filter Repositioning | Mock 3 pending conversation requests | Badge displaying "3" appears on 4th tab with background `--warn` and text `--tint-ink` | Badge element with text content `"3"` is visible |

### Feature 7: Split View 40/60 De-collision (F07)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F07-01` | Zero overlap between `msplit` and `mpill` | Split View De-collision | Open any conversation, measure bounding rects of `msplit` and `mpill` | `mpillRect.right < msplitRect.left` or `mpillRect.top > msplitRect.bottom` (0px collision) | Geometric intersection rect area === 0 |
| `E2E-T1-F07-02` | Long group title de-collision | Split View De-collision | Open group "Bivouac de printemps · 5 membres" (width ~189pt) | Pill title truncates with ellipsis before contacting `msplit` handle | Clearance between `mpill.right` and `msplit.left` >= 8px |
| `E2E-T1-F07-03` | First message thread clearance | Split View De-collision | Navigate to conversation with historical messages | Top message bubble (`.mbub-wrap:first-child`) is fully visible below `mpill` and `msplit` | `firstBubbleRect.top >= headerRect.bottom + 8px` |
| `E2E-T1-F07-04` | Vertical split dragging responsiveness | Split View De-collision | Pointer drag `msplit` down by 50px | `--msg-split` height increases by 50px (within clamp bounds 140px to max) | `mapzoneRect.height` changes proportionally |
| `E2E-T1-F07-05` | Double-tap split reset to default | Split View De-collision | Double-tap / double-click `msplit` | `--msg-split` resets to initial default ratio (~360px) | `computedSplit === defaultSplit` |

### Feature 8: Bottom Sheet Drawers (+ and ...) (F08)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F08-01` | Composer `+` drawer opens at screen bottom | Bottom Sheet Drawers | Tap `+` button in composer bar (`y=728pt`) | Drawer opens anchored at bottom (`bottom: 0`, `y >= 450pt`), NOT confined to `#card` (`y=110..386`) | `sheetRect.bottom >= 750px` |
| `E2E-T1-F08-02` | Full visibility of all 5 composer options | Bottom Sheet Drawers | Open `ComposerMenuSheet` | "Photo", "Carte GPX", "Randonnée", "Équipement", and "Kit" are all in DOM and visible | All 5 option items have `clientHeight > 0` without clipping |
| `E2E-T1-F08-03` | Bottom sheet Apple grabber handle and padding | Bottom Sheet Drawers | Inspect `ComposerMenuSheet` header | Grabber is centered (36×5pt), left padding >= 16pt, close button accessible | `paddingLeft >= 16px` && grabber visible |
| `E2E-T1-F08-04` | Conversation options `...` opens bottom sheet with `×` | Bottom Sheet Drawers | Tap contact pill or `...` button | Opens `ConversationOptionsSheet` at screen bottom with visible close button `×` | Close button with `aria-label="Fermer"` exists and is clickable |
| `E2E-T1-F08-05` | Conversation management actions availability | Bottom Sheet Drawers | Inspect options in `ConversationOptionsSheet` | Contains Mute, Report, Block, Clear conversation, Leave group; no redundant "Écrire un message" | Actions present; redundant button absent |

### Feature 9: Demandes & Empty State Fix (F09)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F09-01` | Single unified empty state on Demandes | Demandes & Empty State | Switch filter to "Demandes" with 0 pending requests | Exactly ONE `.mstate` element rendered in viewport (no stacked duplicates) | `document.querySelectorAll('.mstate:not([style*="display: none"])').length === 1` |
| `E2E-T1-F09-02` | WCAG AAA contrast on "Nouvelle discussion" button | Demandes & Empty State | Measure contrast ratio of text vs background on "Nouvelle discussion" | Contrast ratio is >= 7:1 (white `#FFFFFF` on green `#275D3F` or `#17402C`) | Contrast calculation >= 7.0 |
| `E2E-T1-F09-03` | "Nouvelle discussion" opens creation modal | Demandes & Empty State | Tap "Nouvelle discussion" button in empty state | Opens `NewConversationModal` / contact picker (does NOT just focus search input) | Modal dialog with `role="dialog"` appears in DOM |
| `E2E-T1-F09-04` | Clean single empty state on empty inbox | Demandes & Empty State | User with 0 total conversations views `/messagerie` | Master list displays single centered message "Aucune discussion" | Single `.mstate` in view |
| `E2E-T1-F09-05` | Search with zero results displays reset action | Demandes & Empty State | Type query "NonExistentString123" into search | Displays "Aucun résultat" with "Effacer la recherche" button; clicking clears query | Query cleared and full list restored |

### Feature 10: Group Chat Realtime Freeze Elimination (F10)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F10-01` | No global loading freeze on group chat select | Group Chat Realtime | Select group chat "Bivouac de printemps" | Conversation list does NOT replace rows with loading skeletons (`.mrows-skeleton`) | `.mrows-skeleton` never mounted during selection |
| `E2E-T1-F10-02` | `setLoading(true)` omitted during background sync | Group Chat Realtime | Trigger `refreshConversations()` while conversations exist in state | `loading` state remains `false` in `useConversations` | UI rows remain at full 100% opacity |
| `E2E-T1-F10-03` | Realtime inbound message updates unread counter | Group Chat Realtime | Dispatch Supabase `postgres_changes` event for new message | Conversation preview and unread badge update reactively without row recreation | Row element preserved; badge updated |
| `E2E-T1-F10-04` | Instant cache hydration on mount | Group Chat Realtime | Mount `MessagesScreen` with populated session cache | Cached conversations render on frame 1 before network fetch completes | Conversation items present on initial render |
| `E2E-T1-F10-05` | Silent member count update | Group Chat Realtime | Trigger `conversation_members` update event | Group pill member count updates silently without flicker | Pill text updates seamlessly |

### Feature 11: Shared Post Embed Graceful Fallback (F11)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F11-01` | Valid community post renders rich embed | Shared Post Embed | Message with `message_type: 'post'` and valid `postId` | Renders `CommunityFeedPost` embed with author, media preview, and title | `.mpost-embed` contains post content |
| `E2E-T1-F11-02` | Branded fallback card for unavailable post | Shared Post Embed | Message with `postId` of deleted/unresolvable post | Displays branded LKDV fallback card with mountain/post icon and message | `.mpost-embed-fallback` is rendered |
| `E2E-T1-F11-03` | LKDV green palette fallback styling | Shared Post Embed | Inspect colors of `.mpost-embed-fallback` | Uses `--lkv-surface-muted` or `--lkv-primary-subtle`, green ink, zero `#000000` | No grey raw box; background uses LKDV token |
| `E2E-T1-F11-04` | Post navigation on embed tap | Shared Post Embed | Tap valid shared post embed card | Navigates to `/communaute?post=<id>` | `router.push` called with correct community URL |
| `E2E-T1-F11-05` | Image aspect ratio and squircle bounds | Shared Post Embed | Render shared post with 16:9 photo | Photo renders without horizontal cut/clipping, with continuous corner radius | `img.naturalWidth > 0` && `overflow === 'hidden'` |

### Feature 12: Reaction Emoji Overlay Bar (F12)

| ID | Name | Target Feature | Inputs / Preconditions | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T1-F12-01` | Long-press opens floating contextual overlay | Reaction Emoji Bar | Long-press (> 500ms) on a message bubble | Reaction bar appears as floating overlay positioned above bubble | Overlay has `position: absolute` or `fixed` with `z-index >= 100` |
| `E2E-T1-F12-02` | Zero document flow jump on reaction bar open | Reaction Emoji Bar | Measure `scrollTop` and neighboring message positions before/after long-press | Pre-existing message bubbles do NOT shift vertically by even 1px | `deltaY === 0` for all other bubbles |
| `E2E-T1-F12-03` | Single horizontal row of 6 emojis | Reaction Emoji Bar | Inspect emoji container layout | All 6 emojis (`👍`, `❤️`, `😂`, `😮`, `🙏`, `🔥`) fit on one line (`flex-wrap: nowrap`) | All 6 emoji buttons share identical `offsetTop` |
| `E2E-T1-F12-04` | Emoji selection adds reaction and closes overlay | Reaction Emoji Bar | Tap `🔥` emoji in reaction bar | `onToggleReaction` fires with `'🔥'`, overlay closes smoothly | Reaction counter displays `'🔥 1'`, overlay unmounted |
| `E2E-T1-F12-05` | Vertical actions menu clean detachment | Reaction Emoji Bar | Inspect contextual actions (Reply, Forward, Copy) | Actions menu renders as a separate vertical grouped list below/beside emoji bar | Separated DOM node; no inline wrap collision |

---

## 4. Tier 2 Test Catalog: Boundary & Corner Cases (60 Tests)

### Feature 1: Apple Primitives & Tokens Bank — Boundaries (F01)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F01-01` | Missing ghost variable fallback | Apple Primitives Bank | Remove `--msg-split` from inline styles | CSS gracefully falls back to default `360px` without collapsing split pane to 0px | `computedStyle.height >= 140px` |
| `E2E-T2-F01-02` | Extreme Dynamic Type text scaling | Apple Primitives Bank | Set `--lkdv-text-scale: 2.5` (250% accessibility zoom) | Labels wrap properly, grabber remains 36×5pt, touch targets remain >= 44pt | Touch target >= 44pt; no text truncation |
| `E2E-T2-F01-03` | Unsupported WebKit platform font fallback | Apple Primitives Bank | User agent without `-apple-system` support | Fallback cascade resolves to `Inter`, `system-ui`, then `sans-serif` without error | `computedFontFamily.includes('sans-serif')` |
| `E2E-T2-F01-04` | Concentric corner radius floor boundary | Apple Primitives Bank | Nested card inside container with `radii.concentricFloor: 20` | Inner element corner radius clamps to minimum 20px | `innerRadius >= 20` |
| `E2E-T2-F01-05` | Hardware backdrop-filter disabled | Apple Primitives Bank | `@supports not (backdrop-filter: blur(1px))` | Solid fallback `--g3-reduced-bg: #EBF2EC` is applied with readable text `#172B24` | Background is opaque `#EBF2EC` |

### Feature 2: Pure LKDV Green Palette — Boundaries (F02)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F02-01` | Dark theme class injection rejection | LKDV Green Palette | Inject `<html class="dark">` or `data-theme="dark"` into DOM | Theme remains strictly LKDV green palette; background does not flip to `#000` or `#0d1117` | Canvas background evaluates to LKDV canvas `#FBFAF6` or forest `#06130D` |
| `E2E-T2-F02-02` | CSS mask-image linear gradient alpha boundary | LKDV Green Palette | Inspect mask-image rules containing `#000` in `messages-grammar.css` | Used strictly inside `mask-image` alpha gradient; does NOT bleed visible black color into layout | Canvas snapshot has 0 visible black pixels |
| `E2E-T2-F02-03` | WCAG AAA contrast at extreme opacity | LKDV Green Palette | Measure text contrast on `--lkdv-scrim` (`rgba(16, 28, 23, 0.42)`) with photo background | White text on photo with scrim retains contrast >= 7:1 | Calculated luminosity contrast >= 7.0 |
| `E2E-T2-F02-04` | Hue integrity under color-mix transitions | LKDV Green Palette | CSS `color-mix(in srgb, var(--lkv-primary) 50%, var(--lkv-surface))` | Evaluated color remains within LKDV green hue gamut (145° to 170°) | HSL hue channel between 145 and 170 |
| `E2E-T2-F02-05` | Third-party leaflet & map attribution override | LKDV Green Palette | Mount map element with standard dark leaflet controls | Dark controls overridden with green glass styling; no pitch-black backgrounds | `controlBg !== 'rgb(0, 0, 0)'` |

### Feature 3: Swift Native Design Tokens Sync — Boundaries (F03)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F03-01` | 3-digit vs 6-digit vs 8-digit hex input in generator | Swift Native Sync | Feed `#FFF`, `#FFFFFF`, `#FFFFFF80` into Swift hex helper | Swift scanner converts all formats correctly into normalized `UIColor` components | Valid RGBA components generated |
| `E2E-T2-F03-02` | Out-of-sync drift detection exit code | Swift Native Sync | Modify `src/design/bank.ts` without regenerating Swift | `node scripts/generate-design-bank.mjs --check` fails with non-zero exit code | Process exit code !== 0 |
| `E2E-T2-F03-03` | Extreme radius value clamping in Swift | Swift Native Sync | Value `pill: 9999` in Swift `CGFloat` | Compiles and renders as rounded pill without CoreGraphics overflow | `DesignTokens.Radii.pill == 9999` |
| `E2E-T2-F03-04` | SwiftUI Color dynamic provider roundtrip | Swift Native Sync | Access `DesignTokens.Colors.colorBrandPrimary` in SwiftUI view | Returns valid `Color(uiColor: brandPrimary)` without runtime exception | SwiftUI color resolves valid RGB |
| `E2E-T2-F03-05` | Build script resilience to missing target directory | Swift Native Sync | Temporarily rename `ios/App/App` before generation | Generator creates target directory recursively or reports clean descriptive error | Process handles missing dir cleanly |

### Feature 4: External Skills Integration — Boundaries (F04)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F04-01` | Portrait to landscape orientation switch | External Skills Integration | Rotate viewport to 874×402 (landscape) | Safe-area left and right insets preserved; header buttons do not enter Dynamic Island | Inset clearance >= `env(safe-area-inset-left)` |
| `E2E-T2-F04-02` | Prefers-reduced-motion media trigger | External Skills Integration | Set `prefers-reduced-motion: reduce` in browser context | Transitions duration clamped to 0s/none; springs disabled; UI remains 100% functional | Animation duration is 0s |
| `E2E-T2-F04-03` | Minimum touch spacing between adjacent targets | External Skills Integration | Measure distance between search clear button and search field border | At least 8pt physical margin separation between touch activation areas | `targetSeparation >= 8px` |
| `E2E-T2-F04-04` | Keyboard inset expansion (`env(keyboard-inset-height)`) | External Skills Integration | Simulate virtual keyboard open (`keyboardInset = 336px`) | Composer bar shifts up by exactly 336px; input cursor remains visible above keyboard | `composerRect.bottom <= viewportHeight - 336` |
| `E2E-T2-F04-05` | Ultra-compact screen width (320px iPhone SE) | External Skills Integration | Set viewport width to 320px | Header, list rows, split view, and composer adjust without horizontal page scroll | `document.documentElement.scrollWidth <= 320` |

### Feature 5: Header Navigation Fix — Boundaries (F05)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F05-01` | Rapid tap burst on "Messages" title | Header Navigation Fix | 10 rapid taps in 500ms on "Messages" title | No navigation triggered, no debouncing crash, stays on `/messagerie` | URL remains `/messagerie` |
| `E2E-T2-F05-02` | Keyboard activation (`Tab` + `Enter`/`Space`) | Header Navigation Fix | Focus "Messages" title via keyboard and press `Enter` | Stays on `/messagerie`, scrolls list to top | `window.location.pathname === '/messagerie'` |
| `E2E-T2-F05-03` | Deep-link URL parameters preservation | Header Navigation Fix | Load `/messagerie?c=conv-456&highlight=msg-789` and click header | Query params `c` and `highlight` are preserved or cleanly handled without route loss | URL parameters maintained |
| `E2E-T2-F05-04` | Notification count badge overflow (> 999) | Header Navigation Fix | User has 1,250 unread notifications | Badge renders "99+" without expanding outside parent bell container | Badge text is `"99+"` && `badgeRect.width <= 24px` |
| `E2E-T2-F05-05` | Offline state notification click | Header Navigation Fix | Network offline (`navigator.onLine = false`), tap bell | Displays offline notification drawer/toast; does NOT trigger white/black network error screen | Stays on `/messagerie` with offline banner |

### Feature 6: Filter SegmentedControl Repositioning — Boundaries (F06)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F06-01` | Zero conversations in list (empty filter) | Filter Repositioning | All filters return 0 conversations | Filter bar stays pinned in normal document flow; does not jump or collapse | Filter bar `offsetTop` stable |
| `E2E-T2-F06-02` | 100+ conversations scroll boundary | Filter Repositioning | Populate list with 100 conversation rows and scroll to bottom | Filter bar remains reachable or fixed at top of card; conversation rows have bottom padding | List scrolls smoothly; last row reachable |
| `E2E-T2-F06-03` | Rapid switching between filter tabs during network lag | Filter Repositioning | Switch tabs rapidly (Toutes -> Directs -> Groupes -> Demandes) in 100ms | Latest selected tab wins; no stale filter state rendered | Active filter matches final tab click |
| `E2E-T2-F06-04` | Long filter badge string ("99+") | Filter Repositioning | Set requests badge to 150 | Badge formats as "99+" with font-size 7.5px; does not push adjacent icons out of view | Filter pill width remains 196px |
| `E2E-T2-F06-05` | SubCapsuleTabs in 320px viewport | Filter Repositioning | Viewport width 320px | Capsule tabs scale or fit comfortably without horizontal overflow | No horizontal scroll on `#card` |

### Feature 7: Split View 40/60 De-collision — Boundaries (F07)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F07-01` | Drag handle minimum clamp boundary (140px) | Split View De-collision | Drag `msplit` all the way to top of viewport (`dy = -500px`) | Height clamps at `140px`; does NOT collapse master list to negative or 0px | `splitHeight >= 140px` |
| `E2E-T2-F07-02` | Drag handle maximum clamp boundary | Split View De-collision | Drag `msplit` all the way to bottom of viewport (`dy = +800px`) | Height clamps leaving at least 180px for detail pane; does not collapse composer | Detail pane height >= 180px |
| `E2E-T2-F07-03` | Pointer cancel during drag gesture | Split View De-collision | Dispatch `pointercancel` during split drag | Dragging state resets (`data-splitting='false'`), split height persists at last valid position | `dataset.splitting === 'false'` |
| `E2E-T2-F07-04` | Ultra-long conversation title in `mpill` | Split View De-collision | Conversation title with 150 characters | Pill text truncates with ellipsis; pill width clamped to `min(78%, 300px)` | `mpillRect.width <= 300px` |
| `E2E-T2-F07-05` | Keyboard accessibility resize (`ArrowUp` / `ArrowDown`) | Split View De-collision | Focus `msplit` separator and press `ArrowUp` 5 times | Split height decrements in 24px increments, strictly respecting clamp boundaries | Height changes by `5 * 24 = 120px` (or clamped) |

### Feature 8: Bottom Sheet Drawers (+ and ...) — Boundaries (F08)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F08-01` | Swipe-down gesture dismissal | Bottom Sheet Drawers | Touch pointer drag downward on grabber by 150px | Sheet animates down with spring curve and triggers `onClose` | Sheet unmounts from DOM |
| `E2E-T2-F08-02` | Scrim backdrop tap dismissal | Bottom Sheet Drawers | Tap outside sheet content area on backdrop scrim | Sheet closes; click event does NOT propagate to messages behind scrim | Sheet closes; underlying message not clicked |
| `E2E-T2-F08-03` | Drawer open while virtual keyboard active | Bottom Sheet Drawers | Focus message composer, then tap `+` | Virtual keyboard dismisses immediately; sheet opens anchored at true bottom | Sheet bottom anchored at viewport bottom |
| `E2E-T2-F08-04` | Inventory API failure inside `ComposerMenuSheet` | Bottom Sheet Drawers | Mock `/api/materiel/kits` network 500 error | Sheet displays inline error "Impossible de charger vos équipements" with retry button (no crash) | Error message rendered; sheet functional |
| `E2E-T2-F08-05` | Rapid alternating toggles of `+` and `...` | Bottom Sheet Drawers | Tap `+` then immediately tap `...` | Previous drawer closes cleanly; exactly one drawer open at a time; zero backdrop leaks | Exactly one sheet in DOM |

### Feature 9: Demandes & Empty State Fix — Boundaries (F09)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F09-01` | Realtime incoming request transition | Demandes & Empty State | Receive incoming conversation request while viewing empty Demandes | Empty state disappears immediately; new request row renders with notification badge | Request row appears; `.mstate` removed |
| `E2E-T2-F09-02` | Request acceptance workflow | Demandes & Empty State | Tap "Accepter" on pending request | Request status transitions to `'active'`; conversation moves to "Directs" tab | Conversation appears in Directs list |
| `E2E-T2-F09-03` | Request decline workflow | Demandes & Empty State | Tap "Refuser" on pending request | Request removed from list; if list becomes empty, single empty state restored | Request removed; single empty state |
| `E2E-T2-F09-04` | Guest user empty state redirection | Demandes & Empty State | Unauthenticated guest views empty inbox and clicks "Se connecter" | Redirects to `/connexion?next=/messagerie` with return target | URL is `/connexion?next=/messagerie` |
| `E2E-T2-F09-05` | Rapid double-click on "Nouvelle discussion" | Demandes & Empty State | Double-click "Nouvelle discussion" button in 50ms | `NewConversationModal` opens once; does not stack multiple modal instances | Exactly one modal instance in DOM |

### Feature 10: Group Chat Realtime Freeze — Boundaries (F10)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F10-01` | Flood of 50 incoming Realtime events in 1s | Group Chat Realtime | Ingest 50 rapid `postgres_changes` events | Events debounced; UI updates smoothly without freezing main thread or flashing skeletons | Framerate maintained; skeletons absent |
| `E2E-T2-F10-02` | Network disconnection during background sync | Group Chat Realtime | Network goes offline during background refresh | Cached conversations remain displayed; offline banner shown; no white screen | Cached data visible; offline status active |
| `E2E-T2-F10-03` | Realtime channel teardown on unmount | Group Chat Realtime | Mount and immediately unmount `MessagesScreen` | Supabase channel removed cleanly; zero memory leaks or orphaned listeners | `supabase.removeChannel` called |
| `E2E-T2-F10-04` | Rapid group chat switching | Group Chat Realtime | Switch between 5 different group chats within 2 seconds | Correct chat history renders for selected group; no ghost rows with 30% opacity | Active conversation matches clicked ID |
| `E2E-T2-F10-05` | SessionStorage quota exceeded or disabled | Group Chat Realtime | Mock `sessionStorage.setItem` throwing `QuotaExceededError` | Application catches error gracefully; continues using in-memory state without crashing | App operates normally |

### Feature 11: Shared Post Embed Graceful Fallback — Boundaries (F11)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F11-01` | Non-UUID malformed post ID | Shared Post Embed | `postId: "not-a-uuid"` or `'<script>'` | Regex check fails fast; renders branded fallback immediately without issuing network request | Fallback rendered; 0 network calls |
| `E2E-T2-F11-02` | RLS unauthorized post access | Shared Post Embed | Query returns Postgres RLS permission denied error | Branded fallback rendered; author details or post text are not leaked | Fallback rendered; zero leaked data |
| `E2E-T2-F11-03` | Slow network shimmer animation | Shared Post Embed | Network delay 2000ms on post resolution | `.mpost-embed-skeleton` shimmers smoothly with green fill; does not block surrounding chat | Shimmer element active; no chat freeze |
| `E2E-T2-F11-04` | Shared post from deleted author | Shared Post Embed | Post row exists but `author_id` deleted from `profiles` | Renders post with fallback author avatar ("?") and name "Membre LKDV" | Post renders with fallback author |
| `E2E-T2-F11-05` | Thread containing 10 consecutive shared posts | Shared Post Embed | Render thread with 10 shared post cards | All 10 embeds load and render independently without memory exhaustion | 10 embed cards rendered |

### Feature 12: Reaction Emoji Overlay Bar — Boundaries (F12)

| ID | Name | Target Feature | Boundary / Corner Vector | Expected Output / Assertion | Verification Criteria |
|---|---|---|---|---|---|
| `E2E-T2-F12-01` | Message bubble at very top boundary of thread | Reaction Emoji Bar | Long-press top-most message bubble | Emoji overlay detects boundary; flips position BELOW bubble to avoid top clipping | `overlayRect.top >= threadRect.top` |
| `E2E-T2-F12-02` | Message bubble at bottom boundary above composer | Reaction Emoji Bar | Long-press bottom-most message bubble | Emoji overlay flips position ABOVE bubble to avoid composer bar collision | `overlayRect.bottom <= composerRect.top` |
| `E2E-T2-F12-03` | Outside tap or scroll event dismisses overlay | Reaction Emoji Bar | Open overlay, then touch scroll thread container | Overlay dismisses immediately without executing any reaction or action | Overlay unmounted |
| `E2E-T2-F12-04` | Rapid emoji toggle spam | Reaction Emoji Bar | Tap same emoji 10 times rapidly | Optimistic counter increments and decrements cleanly without desync | Final count matches expected state |
| `E2E-T2-F12-05` | Long-press cancelled before 500ms threshold | Reaction Emoji Bar | Touch down on bubble for 200ms then release | Overlay does NOT open; regular tap or link navigation executed | Overlay remains unmounted |

---

## 5. Implementation Blueprint & Execution Architecture

### 5.1. Test Harness Architecture
The test suite is structured to run via standard test runners supported in the repository (`Vitest` for DOM/component/contract tests and `Playwright` for E2E browser rendering):

```
tests/e2e/
├── fixtures/
│   ├── mockConversations.ts       # Mock direct & group conversations, members, requests
│   ├── mockSupabaseClient.ts      # Deterministic Realtime channel & Postgres Changes mock
│   ├── mockViewport.ts            # iPhone 16 Pro (402×874 pt) and responsive viewport helpers
│   └── mockHaptics.ts             # Spy harness for useHapticFeedback
├── tier1-feature-coverage/
│   ├── f01-apple-primitives.spec.ts
│   ├── f02-lkdv-palette.spec.ts
│   ├── f03-swift-sync.spec.ts
│   ├── f04-external-skills.spec.ts
│   ├── f05-header-nav.spec.ts
│   ├── f06-filter-repositioning.spec.ts
│   ├── f07-split-view.spec.ts
│   ├── f08-bottom-sheets.spec.ts
│   ├── f09-demandes-empty-state.spec.ts
│   ├── f10-group-realtime-freeze.spec.ts
│   ├── f11-shared-post-embed.spec.ts
│   └── f12-reaction-overlay.spec.ts
├── tier2-boundary-corner/
│   ├── f01-primitives-boundaries.spec.ts
│   ├── f02-palette-boundaries.spec.ts
│   ├── f03-swift-boundaries.spec.ts
│   ├── f04-skills-boundaries.spec.ts
│   ├── f05-header-boundaries.spec.ts
│   ├── f06-filter-boundaries.spec.ts
│   ├── f07-split-boundaries.spec.ts
│   ├── f08-sheet-boundaries.spec.ts
│   ├── f09-demandes-boundaries.spec.ts
│   ├── f10-realtime-boundaries.spec.ts
│   ├── f11-embed-boundaries.spec.ts
│   └── f12-reaction-boundaries.spec.ts
└── runner.mjs                     # Unified orchestrator executing all tiers with clean exit codes
```

### 5.2. Standardized Test Runner Commands
The test suite can be run directly from npm or node:
- **Tier 1 Execution**:
  ```bash
  npm run test:e2e:t1
  # or: npx vitest run tests/e2e/tier1-feature-coverage
  ```
- **Tier 2 Execution**:
  ```bash
  npm run test:e2e:t2
  # or: npx vitest run tests/e2e/tier2-boundary-corner
  ```
- **Unified Run**:
  ```bash
  node tests/e2e/runner.mjs
  ```
- **Exit Code Guarantees**:
  - Exit code `0`: All 120 tests passed.
  - Exit code `1`: One or more tests failed, outputting exact failure report with test ID, target feature, and assertion failure.

---

## 6. Caveats

1. **Hardware Appium vs Headless E2E**:
   - The test specifications designed here represent opaque-box specifications executable in both browser/Node.js E2E test environments (Vitest/Playwright) and on the physical iPhone 16 Pro via Appium (`UDID: 00008140-000E7D081A0B001C`).
   - Hardware-specific touch gestures (such as actual iOS physical haptics) are mocked in DOM test runners and verified via XCUITest event stream on the physical device.
2. **Swift Native Code**:
   - Verification of `DesignTokens.generated.swift` in Web E2E testing utilizes token AST string parsing and compiler syntax validation. Full binary compilation is performed during Xcode build (`xcodebuild`).
3. **No Code Implementation in this Turn**:
   - As a Specification Miner, no application source code was modified. All deliverables are specification blueprints and test catalogs located in `.agents/teamwork/`.

---

## 7. Conclusion

The specification mining and E2E test architecture for Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases) is complete:
- **Tier 1**: Exactly 60 concrete test specifications (5 tests for each of the 12 features) covering all functional and visual requirements.
- **Tier 2**: Exactly 60 concrete boundary/corner test specifications (5 tests for each of the 12 features) covering extreme values, viewports, network dropouts, RLS errors, and dark theme residual rejection.
- **Total**: 120 comprehensive test cases formatted with ID, Name, Target Feature, Inputs, Expected Output, and Verification Criteria.
- **Handoff Status**: Ready for immediate implementation by the E2E Test Engineer and execution on the physical iPhone 16 Pro test pipeline.

---

## 8. Verification Method

To independently verify this specification report:
1. Inspect the handoff report:
   ```bash
   cat .agents/teamwork/teamwork_spec_miner_e2e_t1t2_1/handoff.md
   ```
2. Verify test case count:
   - Tier 1 test cases: 60 (`E2E-T1-F01-01` through `E2E-T1-F12-05`).
   - Tier 2 test cases: 60 (`E2E-T2-F01-01` through `E2E-T2-F12-05`).
   - Total test cases: 120.
3. Verify feature coverage: All 12 features from `PROJECT.md § Feature Inventory` are systematically addressed in both Tier 1 and Tier 2.
4. Invalidation condition: Any missing feature from `PROJECT.md`, test case count < 60 per tier, or lack of concrete assertion/verification criteria invalidates this report.
