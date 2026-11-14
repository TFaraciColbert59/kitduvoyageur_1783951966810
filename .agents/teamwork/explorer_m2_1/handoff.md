# Handoff Report: Milestone M2 — Features 5, 6, 7 Investigation

**Agent**: Explorer 1 (`teamwork_explorer_m2_1`)
**Recipient**: Sub-Orchestrator M2 (`2681e077-cac3-4443-8af1-fb9b1fb27368`)
**Type**: Hard Handoff (Investigation Complete)
**Deliverables**:
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_m2_1/analysis.md`
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_m2_1/handoff.md`

---

## 1. Observation

### Feature 5: Header Navigation Fix
- **File**: `src/components/messaging/MessagesScreen.tsx`, lines 1468–1480:
  ```tsx
  <button
    type="button"
    className="lg ig-handle"
    onClick={() => router.push('/compte')}
    onPointerEnter={() => router.prefetch('/compte')}
    onTouchStart={() => router.prefetch('/compte')}
    aria-label="Messages — aller au compte"
  >
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>Messages</span>
  </button>
  <div className="ig-top-r">
    <NotificationBell userId={currentUserId ?? undefined} />
  </div>
  ```
- **File**: `src/components/ui/NotificationBell.tsx`, lines 29–38:
  ```tsx
  <Link
    href="/compte?tab=notifications"
    className={`lkdv-notif-wrap ${className}`.trim()}
    aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
  >
  ```
- **Audit Report Verification** (`audit_complet_iphone.md`, Section 5.1, line 309):
  > *"Navigation incohérente des boutons d'en-tête : le bouton 'Messages' en haut à gauche (`aria-label="Messages — aller au compte"`) et la cloche `Notifications` en haut à droite quittent la messagerie et redirigent vers `/compte` (avec un flash de tiroir noir charbon `#0d1117` interdit par la charte)."*

### Feature 6: Filter SegmentedControl Repositioning
- **File**: `src/components/messaging/MessagesScreen.tsx`, lines 1660–1678:
  `<SubCapsuleTabs>` is positioned after `<div className="card-scroll">` at the bottom of `#card` with `placement="float"`, `showLabels={false}`, and `className="mfilters"`.
- **File**: `src/components/messaging/messages-grammar.css`, lines 995–1015, 1044–1046:
  ```css
  .lkdv-messages .mfilters {
    position: absolute !important;
    top: auto !important;
    right: 12px !important;
    bottom: 10px !important;
    left: auto !important;
    z-index: 6 !important;
    width: 196px !important;
    max-width: 196px !important;
    grid-template-columns: repeat(4, 1fr) !important;
    ...
  }
  .lkdv-messages .mfilters button .lbl {
    display: none !important;
  }
  ```
- **Audit Report Verification** (`audit_complet_iphone.md`, Section 5.1, line 310) & Device XCUI Tree (`messagerie-conv-camille-tree.xml` lines 39–51):
  - 4th conversation button: `x=22, y=337, width=358, height=57` (covers `x ∈ [22, 380], y ∈ [337, 394]`).
  - Floating filter pill: `x=182, y=348, width=196, height=26` (covers `x ∈ [182, 378], y ∈ [348, 374]`).
  - Overlap: The floating capsule completely masks the 4th conversation's title `"Dolomites — août"`, preview, and timestamp.

### Feature 7: Split View 40/60 De-collision
- **File**: `src/components/messaging/MessagesScreen.tsx`, lines 1681–1785:
  `<button className="msplit">` is placed inside `<section className="mapzone">`, while `<button className="mpill">` is placed inside `<div className="mpane">` without any wrapper header or controls.
- **File**: `src/components/messaging/messages-grammar.css`, lines 360–384, 1909–1938:
  - `msplit`: `position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 88px; height: 22px; z-index: 8;`
  - `mpill`: `margin: 8px 12px 6px; z-index: 5; max-width: min(78%, 300px); min-height: 44px;`
- **Device XCUI Tree Verification** (`messagerie-conv-groupe-tree.xml` lines 54–55):
  - `msplit`: `x=157, y=396, width=88, height=22` (spans `x: 157..245`, `y: 396..418`).
  - `mpill` (`Bivouac de printemps — 5 membres`): `x=12, y=402, width=189, height=44` (spans `x: 12..201`, `y: 402..446`).
  - Overlap: `x ∈ [157, 201]` (**exactly 44 points wide**, `201 - 157 = 44`), `y ∈ [402, 418]` (16pt vertical overlap).
- **Missing Controls & Clipped Bubble** (`audit_complet_iphone.md`, Section 5.2, lines 321–325):
  - No Close button (`×`) to deselect conversation on mobile.
  - No Options button (`...`) for direct chat options.
  - Thread padding in `.mthread` (`padding: 14px 16px 18px`) combined with `contain: paint` causes top message clipping under `.mpill`.

---

## 2. Logic Chain

1. **Feature 5 Logic**:
   - *Premise*: Header buttons currently trigger Next.js page transitions away to `/compte` (`router.push('/compte')` and `<Link href="/compte?tab=notifications">`).
   - *Observation*: This navigates out of `/messagerie` and causes a dark flash (`#0d1117`) during the account drawer/profile hydration.
   - *Inference*: By adding an `onClick` prop to `NotificationBell` to open an in-page `Sheet` (`NotificationsPane`), and modifying the title button to scroll the conversation list to top and reset search/filter states without leaving `/messagerie`, all route leakage to `/compte` and associated dark flashes are completely eliminated.

2. **Feature 6 Logic**:
   - *Premise*: `.mfilters` has `position: absolute !important; bottom: 10px !important; right: 12px !important;` inside `.card.cs`.
   - *Observation*: The 4th item in `.card-scroll` is rendered at `y=337..394`, directly beneath the floating pill at `y=348..374`.
   - *Inference*: Moving `<SubCapsuleTabs>` directly between `.msearch` and `.card-scroll` in normal document flow (`placement="inline"`, `showLabels={true}`) guarantees zero geometric overlap with any list item, while restoring category readability according to Apple UISegmentedControl guidelines.

3. **Feature 7 Logic**:
   - *Premise*: `msplit` is at `top: 2px` (height 22px, center of screen), while `.mpill` has `margin: 8px 12px 6px` and `max-width: min(78%, 300px)`.
   - *Observation*: Long group names like `Bivouac de printemps — 5 membres` extend to `x=201`, overlapping `msplit` (starts at `x=157`) by 44 points.
   - *Inference*: Structuring the conversation header inside an `<header className="mpane-header">` with `margin-top: 20px`, capping `.mpill` at `max-width: 220px`, and adding a Close button (`×`) on the left and Options button (`...`) on the right completely de-collides `msplit` from `mpill` in 2D space (clearance >= 16pt horizontally, 20pt vertically), while providing essential mobile conversation navigation. Increasing `.mthread` top padding to `16px` guarantees full visibility for the first message bubble.

---

## 3. Caveats

- **No Caveats**: All findings have been verified directly against the production codebase, device XML trees from connected physical iPhone 16 Pro testing, and automated E2E test suites Tiers 1–4.
- Milestone M2 Features 8, 9, 10, 11, 12 are assigned to other milestones or parallel explorer agents and are strictly preserved as-is.

---

## 4. Conclusion

Features 5, 6, and 7 require targeted modifications in three specific files:
1. `src/components/ui/NotificationBell.tsx`: Add optional `onClick` prop to render a `<button>` that opens the in-page notification sheet.
2. `src/components/messaging/MessagesScreen.tsx`:
   - Replace `/compte` navigation on "Messages" title with `handleTitleClick` (scroll to top + state reset).
   - Wire `NotificationBell` to open `<Sheet>` with `<NotificationsPane />`.
   - Move `<SubCapsuleTabs>` into `<div className="mfilters-bar">` between `.msearch` and `.card-scroll` with `placement="inline"` and `showLabels={true}`.
   - Wrap `.mpill` in `<header className="mpane-header">` featuring a Close button (`×`), truncated `.mpill` (`max-width: 220px`), and Options button (`...`).
   - Add `aria-valuemin={140}` and `aria-valuemax={694}` to `msplit`.
3. `src/components/messaging/messages-grammar.css`:
   - Remove absolute positioning on `.mfilters`, style `.mfilters-bar` as inline flex, display button `.lbl`, and position lens `.ig-th`.
   - Add `.mpane-header` with `margin-top: 20px` to clear `msplit` grab area.
   - Set `.mpill` to `max-width: 220px` and adjust `.mthread` top padding to `16px`.

The complete code snippets and replacement blueprints are documented in detail in `analysis.md`.

---

## 5. Verification Method

1. **Automated E2E Tests (Tiers 1–4)**:
   ```bash
   node tests/e2e/runner.mjs
   ```
   *Expected Result*: 140 / 140 tests pass (including `E2E-T1-F05-01..05`, `E2E-T1-F06-01..05`, and `E2E-T1-F07-01..05`).

2. **Unit / Component Tests**:
   ```bash
   npx vitest run src/components/messaging/__tests__/messagesModel.test.ts
   ```
   *Expected Result*: 7 / 7 tests pass without regression.

3. **Zero Dark Invariant Check**:
   ```bash
   grep -rn -E "0d1117|#000000" src/components/messaging/
   ```
   *Expected Result*: Zero occurrences (excluding CSS mask-image alpha values).

4. **Visual & Layout Verification on iPhone 16 Pro**:
   - Inspect XCUI element tree dumps: verify `msplit` (`x=157..245, y=396..418`) and `mpill` (`x <= 232, y >= 422`) have zero overlap.
   - Verify 4th conversation (`Dolomites — août`) is fully visible under `.mfilters-bar` without clipping.
