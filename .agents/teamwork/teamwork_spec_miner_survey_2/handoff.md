# Handoff Report — Survey Task 2: Section 5 Audit & Baseline Screenshots Spec Mining

**Agent ID**: `teamwork_spec_miner_survey_2`  
**State Folder**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_survey_2`  
**Working Directory**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`  
**Parent Conversation ID**: `5ca13125-701a-4c70-a7c3-f849d2125e35`  
**Type**: Hard Handoff (Task Complete)

---

## 1. Observation

Direct observations extracted from physical iPhone 16 Pro (UDID `00008140-000E7D081A0B001C`, screen dimensions `402 × 874 pt`, Retina @3x `1206 × 2622 px`), the Section 5 iPhone audit report, XCUITest XML accessibility trees, and project source code:

1. **Header Navigation redirection to `/compte`**:
   - In `src/components/messaging/MessagesScreen.tsx:1468-1476`:
     ```tsx
     <button
       type="button"
       className="lg ig-handle"
       onClick={() => router.push('/compte')}
       onPointerEnter={() => router.prefetch('/compte')}
       onTouchStart={() => router.prefetch('/compte')}
       aria-label="Messages — aller au compte"
     >
     ```
   - In `src/components/ui/NotificationBell.tsx:28-30`:
     ```tsx
     <Link
       href="/compte?tab=notifications"
       className={`lkdv-notif-wrap ${className}`.trim()}
     ```
   - In `messagerie-tree.xml`:
     `XCUIElementTypeButton | x=12 y=69 w=97 h=34 | vis=true | Messages — aller au compte`
     `XCUIElementTypeLink | x=352 y=67 w=38 h=38 | vis=true | Notifications`
   - Observable effect: Tapping the title or bell triggers route change to `/compte`, accompanied by a dark charcoal `#0d1117` flash during transition.

2. **Filter capsule floating overlap (`SubCapsuleTabs`)**:
   - In `src/components/messaging/messages-grammar.css:995-1000`:
     ```css
     .lkdv-messages .mfilters {
       position: absolute !important;
       top: auto !important;
       right: 12px !important;
       bottom: 10px !important;
     ```
   - In `messagerie-tree.xml`:
     - Filter pill: `XCUIElementTypeOther | x=182 y=346 w=196 h=30 | vis=true | Filtrer les discussions`
     - 4th conversation row: `XCUIElementTypeButton | x=22 y=337 w=358 h=56 | vis=true | Dolomites — août`
   - Observable effect: The filter capsule (`y=346..376`) floats directly on top of the 4th row (`y=337..393`), concealing the text, snippet, and timestamp in `00-messagerie-main.png` and `02-messagerie-toutes.png`.

3. **Coordinate collision in Split View 40/60**:
   - In `src/components/messaging/messages-grammar.css:1909-1926`:
     `.lkdv-messages .mapzone > .msplit { position: absolute; top: 2px; left: 50%; width: 88px; height: 22px; transform: translateX(-50%); ... }`
     On 402 pt wide screen, `left: 50%` places the grabber from `x = 157 pt` to `x = 245 pt`.
   - In `src/components/messaging/messages-grammar.css:360-365`:
     `.lkdv-messages .mpill { margin: 8px 12px 6px; ... }`
   - In `messagerie-conv-groupe-tree.xml`:
     - Header pill: `XCUIElementTypeButton | x=12 y=402 w=189 h=44 | vis=true | Bivouac de printemps — 5 membres`
   - Observable effect: The header pill extends from `x = 12` to `x = 201 pt`, directly overlapping the grabber handle (`x = 157..245 pt`) by **44 pt** (`x = 157..201 pt`), as documented in `06-messagerie-conv-groupe-bivouac.png`.
   - In `messagerie-conv-camille-tree.xml`:
     First message bubble: `XCUIElementTypeButton | x=136 y=338 w=250 h=73 | Message de vous, 18:15`
     Starts at `y = 338 pt` while header starts at `y = 402 pt`, passing underneath the header pill and grab handle.

4. **Tiroir Coordinate Bug (`y=110..386` instead of bottom sheet)**:
   - In `src/features/messaging/components/ComposerMenuSheet.tsx:238-239`:
     ```tsx
     <AccountDrawerHost variant="card" open={isOpen} ...>
     ```
   - In `src/design/account/AccountDrawerHost.tsx`: `variant="card"` calculates dimensions relative to `#card`:
     `const card = document.getElementById('card');`
   - In `messagerie-composer-menu-tree.xml`:
     ```xml
     <XCUIElementTypeOther x="0" y="110" width="391" height="276" label="Partager dans le chat, boîte de dialogue web" visible="true">
     ```
   - Observable effect: The sheet opens at `y=110 pt` at the top of the viewport instead of the bottom (`y=728..874 pt`). Items inside:
     `Photo` at `y=244..280`, `Carte GPX` at `y=302..337`, `Randonnée` at `y=360..395` (cut in half by container height 276 pt at `y=386`), `Équipement` (`y=417`) and `Kit` (`y=475`) completely invisible, verified in `07-messagerie-composer-menu-sheet.png`.

5. **Conversation Options Sheet defects**:
   - In `src/components/messaging/MessagesScreen.tsx:1920-1926`:
     ```tsx
     <AccountDrawerHost open={profileDrawerUser !== null} variant="card" hideHeader={true} hideCloseButton={true} onClose={() => setProfileDrawerUser(null)}>
     ```
   - In `messagerie-conv-options-tree.xml`:
     Opens at `x=0 y=110 w=391 h=276` with no close button. Displays `Écrire un message` (`x=61 y=291 w=280 h=41`) and `Voir le profil` (`x=61 y=339 w=280 h=41`), lacking mute, search, block, delete, or media gallery.

6. **Skeleton freezing in group chats**:
   - In `src/features/messaging/hooks/useConversations.ts:39-44`:
     `fetchConversations` sets `setLoading(true)` on every call.
   - When a conversation is opened, `useMessages.ts:51` calls `messagingService.markAsRead(conversationId, currentUserId)`.
   - Realtime listener on `conversation_members` in `useConversations.ts:98` receives Postgres update and calls `fetchConversations()`, triggering `setLoading(true)`.
   - In `MessagesScreen.tsx:1582-1589`: `loading ? [1,2,3,4].map(...) => <div className="mskel">`.
   - Observable effect: The top list wipes conversations and displays 4 gray skeleton lines or freezes on ghost rows when opening group chats (`06-messagerie-conv-groupe-bivouac.png`).

7. **"Publication indisponible" and broken card embed**:
   - In `src/features/messaging/components/SharedPostEmbed.tsx:28-31` & `56`:
     ```tsx
     if (!UUID_RE.test(postId)) { setFailed(true); return; }
     ...
     if (failed) return <div className="mpost-embed-fallback">Publication indisponible</div>;
     ```
   - Observable effect: When group chat messages refer to mock/non-UUID posts or fail RLS, a bare gray fallback box appears (`06-messagerie-conv-groupe-bivouac.png`).

8. **Message long press inline layout break**:
   - In `src/components/messaging/MessagesScreen.tsx:798-845`:
     Long press inserts `<div className="mreacts">` with 3 text buttons (`Répondre`, `Transférer`, `Copier`) + 6 emojis inside the DOM hierarchy of the message row.
   - Observable effect: Causes text to wrap across 2 lines and shifts down the conversation, pushing subsequent messages under the composer bar (`09-messagerie-message-longpress.png`).

9. **Contrast failure in `Demandes` empty state**:
   - In `src/components/compte/compte-v8.css:32` & `138`:
     `--pg-ink: #17402C;`, `.mbtn.p { background: var(--pg); color: var(--pg-ink)!important; }`
   - In `MessagesScreen.tsx:1627`:
     `.mbtn.p` on dark green background renders dark green text (`#17402C`) over dark green button (`#19442C`), with contrast ratio `1.05:1` (`02-messagerie-filter-demandes.png`).

---

## 2. Logic Chain

1. **Header Redirection**:
   - Line 1471 of `MessagesScreen.tsx` explicitly binds `onClick` to `router.push('/compte')`, and `NotificationBell.tsx` uses `<Link href="/compte?tab=notifications">`.
   - Therefore, tapping either element causes an unintentional page transition to `/compte`, which loads the account bundle and triggers an unstyled black screen (`#0d1117`) during navigation.

2. **Badge Overlap**:
   - `SubCapsuleTabs` is placed with `position: absolute; bottom: 10px; right: 12px;` inside `.card.cs` which contains the scrollable list of conversations.
   - Because the list rows have `h = 56 pt` each, row 4 resides at `y = 337..393 pt`, overlapping the capsule at `y = 346..376 pt`.
   - Therefore, any conversation list containing 4 or more items will have its 4th row partially obscured by the floating pill.

3. **Split View Collision & Obscuration**:
   - The master-detail divider `msplit` is centered with `left: 50%; transform: translateX(-50%); width: 88px` (`x = 157..245 pt`).
   - Group titles are longer than single-user names, expanding `mpill` to `w = 189 pt` (`x = 12..201 pt`).
   - `x = 201 > 157`, resulting in a 44 pt physical overlap where the drag handle renders directly over the right side of the pill.
   - In addition, `.mthread` lacks top scroll padding relative to the fixed height of `.mpill` (`h = 44 pt`) and `msplit` (`h = 22 pt`), causing the top message bubble to be rendered beneath the header.

4. **Sheet Coordinate Misplacement**:
   - `ComposerMenuSheet` and `ConversationOptionsSheet` utilize `<AccountDrawerHost variant="card">`.
   - `AccountDrawerHost` measures `#card` (the upper list card at `y = 110..386 pt`) and constrains the sheet's bounding box to `#card`.
   - Therefore, clicking `+` in the bottom composer bar at `y = 728 pt` opens a drawer at the top of the screen (`y = 110 pt`), limited to `276 pt` height, which slices off the lower menu entries.

5. **Skeleton Flash / Freeze**:
   - `useConversations.ts` resets `loading = true` unconditionally inside `fetchConversations()`.
   - Opening a conversation triggers `markAsRead`, which sends a Postgres update to `conversation_members`.
   - Realtime listener receives this update and calls `fetchConversations()`, resetting `loading = true`.
   - `MessagesScreen.tsx` switches from displaying conversations to rendering `<div className="mskel">` skeletons whenever `loading` is true.
   - Therefore, every conversation selection induces a visual flash of skeleton rows.

6. **Long Press Layout Shift**:
   - Contextual actions are appended inline inside the bubble's DOM container rather than displayed via a portal or overlay (`UIContextMenuInteraction`).
   - Inlining 9 flex items in a 250 pt bubble forces flex-wrapping, adding ~30 pt of vertical height and pushing the bottom of the scroll container down.

---

## 3. Caveats

1. **Capacitor Swift Bridge vs. WebKit CSS Primitives**:
   - The app runs inside a Capacitor WKWebView container. Native iOS UIKit elements (e.g. `UISheetPresentationController`, `UIContextMenuInteraction`) can be invoked natively via Capacitor plugins or faithfully replicated via WebKit CSS primitives (`-apple-system-*`, backdrop filters, spring animations). The specification provides exact tokens and behaviors for both avenues.
2. **Database Data vs. Visual Bug**:
   - "Publication indisponible" is partially an data integrity issue (messages referencing non-existent or deleted posts in Supabase). However, the UI must handle non-existent posts gracefully with branded fallback cards rather than broken grey boxes.
3. No code changes were made (read-only mining task).

---

## 4. Conclusion

The specification mining for Section 5 (`/messagerie`) is fully completed. All 18 functional areas, 13 edge cases, and 9 core bugs documented in the iPhone audit report and baseline screenshots have been mapped to:
1. Exact coordinates (`x`, `y`, `w`, `h`) on the physical iPhone 16 Pro (402 × 874 pt).
2. Apple HIG iOS 18 requirements (sheet detents, context menu interaction, touch targets >= 44pt, typography primitives).
3. LKDV Green Palette rules (replacement of `#000000` / `#0d1117` with dark greens `#06130D`, `#0B1E16`, `#143527`, `#2D7255`, `#5DD49F`).

The complete, unabridged specification has been authored to:
`/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_survey_2/spec_messagerie_audit.md`.

---

## 5. Verification Method

To independently verify all findings and coordinates:

1. **Verify XCUITest XML coordinate trees**:
   ```bash
   python3 -c "
   import xml.etree.ElementTree as ET
   tree = ET.parse('/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/messagerie-composer-menu-tree.xml')
   for el in tree.iter():
       if 'Partager dans le chat' in (el.attrib.get('label') or ''):
           print('Found Sheet Rect:', el.attrib.get('x'), el.attrib.get('y'), el.attrib.get('width'), el.attrib.get('height'))
   "
   # Output confirms: x=0, y=110, w=391, h=276
   ```

2. **Verify Header navigation bug in code**:
   Inspect line 1471 of `src/components/messaging/MessagesScreen.tsx` to verify `onClick={() => router.push('/compte')}`.

3. **Verify Button contrast bug**:
   Inspect line 138 of `src/components/compte/compte-v8.css` (`--pg-ink: #17402C`) and line 1627 of `MessagesScreen.tsx`.

4. **Verify baseline screenshots**:
   Inspect images `00-messagerie-main.png` through `09-messagerie-message-longpress.png` in `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/`.
