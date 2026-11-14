# Handoff Report: Milestone M2 — Feature 8 & Feature 9 Technical Investigation

**Agent**: Explorer 2 (`explorer_m2_2`)  
**Target Milestone**: M2 (/messagerie Refactor & Drawers)  
**Parent Orchestrator**: `2681e077-cac3-4443-8af1-fb9b1fb27368`  
**State Folder**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_m2_2`  
**Analysis Reference**: `analysis.md` in this directory

---

## 1. Observation

### Observation 1: Positioning and Truncation of Drawers (Feature 8)
- In `src/features/messaging/components/ComposerMenuSheet.tsx` (line 238) and `src/features/messaging/components/ConversationOptionsSheet.tsx` (line 111):
  - Both components wrap their entire layout in `<AccountDrawerHost variant="card" ...>`.
- In `src/design/account/AccountDrawerHost.tsx` (lines 144-156):
  ```ts
  const card = document.getElementById('card');
  const phone = card?.closest('.phone') as HTMLElement | null;
  if (!card || !phone) return;
  const c = card.getBoundingClientRect();
  const p = phone.getBoundingClientRect();
  setBox({
    top: Math.max(0, c.top - p.top),
    left: Math.max(0, c.left - p.left),
    right: Math.max(0, p.right - c.right),
    bottom: Math.max(0, p.bottom - c.bottom),
  });
  ```
- In `src/components/messaging/MessagesScreen.tsx` (line 1461), element `<div className="card split" id="card">` defines the upper 40% conversation list pane (`top ≈ 114px`, `bottom ≈ 386px` on the iPhone 16 Pro 874pt viewport).
- In `src/components/messaging/messages-grammar.css` (lines 531-536):
  ```css
  .lkdv-messages .sw-wrap[data-det='card'] .sh-h {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 0 6px;
    margin: 0;
  }
  ```
  Zero lateral padding (`padding: 2px 0 6px`) in `.sh-h` causes the title `"Partager dans le chat"` to sit at `0px` from the left edge when `onBack` is absent.
- In `src/components/ui/Sheet.tsx` (lines 119-150):
  The canonical Apple Sheet component already features fixed bottom anchoring (`fixed inset-x-0 bottom-0 z-[var(--z-sheet)]`), continuous corner radius `rounded-t-[var(--lkv-radius-sheet)]`, standardized Apple grabber (`apple-sheet-grabber h-[5px] w-[36px] rounded-[2.5px] bg-[rgba(23,64,44,0.25)]`), close button `×` (`<Icon name="x" size={18} />`), and safe padding `px-[var(--space-5)]`.

### Observation 2: Redundant "Écrire un message" & Incomplete Options (Feature 8)
- In `src/components/messaging/MessagesScreen.tsx` (lines 1754-1763):
  Clicking the active conversation pill `mpill` invokes `setProfileDrawerUser` for direct conversations, mounting an inline `AccountDrawerHost` (lines 1918-2040).
- Lines 2000-2029 of `MessagesScreen.tsx` render a prominent button:
  ```tsx
  <button type="button" className="mbtn p" ...>
    Écrire un message
  </button>
  ```
  This button is rendered directly above the conversation thread that is already open.
- Lines 1918-2040 contain `hideCloseButton={true}` and zero options for muting, blocking, or deleting the discussion.

### Observation 3: Duplicate Empty State in `Demandes` (Feature 9)
- In `src/components/messaging/MessagesScreen.tsx` (lines 1600-1645), when `visible.length === 0` (such as when switching to `filter === 'requests'` with no pending requests), the top card renders:
  ```tsx
  <div className="mstate" style={{ ... }}>
    <b style={{ font: '700 17px/1.2 var(--sf)', color: '#17402C' }}>
      {query.trim() ? 'Aucun résultat' : 'Aucune discussion'}
    </b>
    ...
    <button type="button" className="mbtn p" onClick={focusSearch} ...>
      Nouvelle discussion
    </button>
  </div>
  ```
- Simultaneously, lines 1735-1815 in the bottom pane render:
  ```tsx
  <div className="mstate" style={{ margin: 'auto' }}>
    <b>Choisissez une discussion</b>
    <span>Ou lancez une nouvelle discussion avec un membre de la communauté.</span>
    <button type="button" className="mbtn p" onClick={focusSearch}>
      Nouvelle discussion
    </button>
  </div>
  ```
  Both empty states render simultaneously on the screen within ~120pt of each other.

### Observation 4: Contrast Failure on CTA Button (Feature 9)
- In `src/components/compte/compte-v8.css` (line 138):
  ```css
  .mbtn.p {
    background: var(--pg);
    color: var(--pg-ink) !important;
    box-shadow: var(--pg-sh);
  }
  ```
- In `compte-v8.css` (line 32):
  ```css
  --pg-ink: #17402C;
  ```
- In `MessagesScreen.tsx` (line 1625), the inline style `color: '#fff'` is overridden by `.mbtn.p`'s `color: var(--pg-ink) !important;`.
- As a result, text color `#17402C` renders against dark green gradient `#275d3f` / `#17402c`, yielding a 1.0:1 contrast ratio (unreadable black-on-green).

### Observation 5: Non-functional CTA Button (Feature 9)
- In `MessagesScreen.tsx` (lines 1441-1444):
  ```ts
  const focusSearch = () => {
    searchRef.current?.focus({ preventScroll: true });
    searchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  ```
  Clicking `"Nouvelle discussion"` only focuses the conversation filter input.
- `NewConversationModal` exists at `src/features/messaging/components/NewConversationModal.tsx` (lines 17-37) with full directory browsing and blocking filters, but was never imported in `MessagesScreen.tsx`.

---

## 2. Logic Chain

1. **Drawers High Viewport Misalignment**:
   Because `ComposerMenuSheet` and `ConversationOptionsSheet` use `AccountDrawerHost variant="card"`, they measure element `#card` in `MessagesScreen.tsx`. Since `#card` is the top 40% split pane (`y = 114..386`), the drawer is physically constrained to the top third of the viewport. Migrating to `src/components/ui/Sheet.tsx` (which attaches to `Dialog.Portal` and anchors to `bottom: 0` with `fixed inset-x-0 bottom-0 z-[var(--z-sheet)]`) anchors the drawer at the bottom of the device screen (`y >= 500pt`), matching iOS HIG.
2. **Padding and Truncation Fix**:
   `Sheet.tsx` applies `px-[var(--space-5)]` (`20px`) and `min-h-0 flex-1 overflow-y-auto`, ensuring titles are never clipped at 0px and all 5 composer options (`Photo`, `Carte GPX`, `Randonnée`, `Équipement`, `Kit`) are fully visible and scrollable.
3. **Options Sheet Refactor**:
   In `MessagesScreen.tsx`, tapping `mpill` currently opens `profileDrawerUser` with `"Écrire un message"`. By redirecting `mpill` to open `ConversationOptionsSheet`, removing `"Écrire un message"`, and providing Sourdine (mute), Bloquer (moderation), Supprimer la discussion (`messagingService.deleteConversationForMe`), and a close button (`×`), the duplicate drawer is removed and authentic conversation management is restored.
4. **Empty State Deduplication**:
   When `visible.length === 0` (e.g. `filter === 'requests'`), suppressing `.mstate` in the bottom pane leaves only a single contextual empty state in the top card, eliminating the redundant display.
5. **WCAG AAA Contrast Compliance**:
   Introducing `.mstate .mbtn-cta-primary` with `background: var(--lkv-primary, #17402C) !important;` and `color: var(--lkv-on-brand, #FFFFFF) !important;` eliminates the CSS override from `compte-v8.css`. The contrast ratio between `#FFFFFF` and `#17402C` is 11.88:1, well above WCAG AAA 7.0:1.
6. **Actionable Contact Modal**:
   Dynamically importing `NewConversationModal` into `MessagesScreen.tsx`, wiring it to state `newConvOpen`, and connecting the CTA button to `onClick={() => setNewConvOpen(true)}` fulfills the contact creation flow.

---

## 3. Caveats

- **Virtual Keyboard Insets**: Virtual keyboard resizing on physical iOS devices shrinks the visible viewport. `Sheet.tsx` uses `dvh` (`max-h-[90dvh]` and `DETENT`), which natively respects the visual viewport with Capacitor keyboard plugins.
- **Demo Mode Persistence**: In demo mode (`demo-conv-*`), `messagingService.deleteConversationForMe` and `updateMemberPreferences` mutate `demoConversationsCache`. This is fully supported and tested by the service.
- **Zero Modifications Made**: In accordance with the Explorer archetype rules, no source code files were edited. Detailed before/after code blocks are documented in `analysis.md` for the implementer agent.

---

## 4. Conclusion

Features 8 and 9 can be completely repaired without architecture changes by:
1. Enhancing `src/components/ui/Sheet.tsx` with optional `onBack?: () => void` and `headerAction?: React.ReactNode`.
2. Migrating `ComposerMenuSheet.tsx`, `ConversationOptionsSheet.tsx`, and `NewConversationModal.tsx` from `AccountDrawerHost` to `Sheet.tsx`.
3. Updating `ConversationOptionsSheet.tsx` to remove `"Écrire un message"`, add `data-testid`, and include Mute, Block, Delete, and Close controls.
4. Updating `MessagesScreen.tsx` to deduplicate empty states, style the CTA button with WCAG AAA tokens, and wire `"Nouvelle discussion"` to `NewConversationModal`.

---

## 5. Verification Method

### 1. Automated Test Verification
Run the complete E2E opaque-box suite:
```bash
node tests/e2e/runner.mjs
```
**Expected Outcome**: 140 / 140 tests pass (including `E2E-T1-F08-01` to `E2E-T1-F08-05`, `E2E-T1-F09-01` to `E2E-T1-F09-05`, and Tier 2/3 combinations).

### 2. Physical iPhone 16 Pro Appium Verification
Inspect real device capture outputs against audit baseline shots:
- `02-messagerie-filter-demandes.png`: Only one `.mstate` empty state is present; CTA button displays `#FFFFFF` text on `#17402C`.
- `03-messagerie-nouvelle-discussion-tap.png`: Tapping CTA opens `NewConversationModal` at the bottom of the screen.
- `07-messagerie-composer-menu-sheet.png`: Tapping `...` opens `ComposerMenuSheet` anchored at `bottom: 0` (`y >= 500pt`), 36×5pt grabber, 20px left padding, and all 5 options visible.
- `08-messagerie-conversation-options-sheet.png`: Tapping `mpill` opens `ConversationOptionsSheet` at `bottom: 0` with close button `×`, mute, block, delete, and no `"Écrire un message"`.

### 3. Invalidation Conditions
- If any drawer opens with `y < 450pt` on iPhone 16 Pro (874pt height).
- If container has more than one `.mstate` element simultaneously rendered.
- If contrast ratio on the primary CTA is less than 7.0:1 or if pure black `#000000` is present.
