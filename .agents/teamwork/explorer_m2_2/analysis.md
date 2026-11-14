# Technical Specification & Investigation Blueprint: Feature 8 & Feature 9

**Milestone**: M2 (/messagerie Refactor & Drawers)  
**Author**: Explorer 2 (`explorer_m2_2`)  
**Target Device**: iPhone 16 Pro (402×874 pt, Retina @3x 1206×2622 px, UDID `00008140-000E7D081A0B001C`)  
**Design Standard**: Apple Human Interface Guidelines / LKDV Liquid Glass (Pure LKDV Green Palette, zero pure black `#000000`, zero `#0d1117`)

---

## 1. Executive Summary

This specification provides the exact technical blueprint to fix:
1. **Feature 8 — Bottom Sheet Drawers (`+` and `...`)**:
   - `ComposerMenuSheet` (`src/features/messaging/components/ComposerMenuSheet.tsx`)
   - `ConversationOptionsSheet` (`src/features/messaging/components/ConversationOptionsSheet.tsx`)
   - Core Apple Bottom Sheet primitive (`src/components/ui/Sheet.tsx`)
2. **Feature 9 — Demandes & Empty State Fix**:
   - Empty state deduplication in `src/components/messaging/MessagesScreen.tsx`
   - WCAG AAA contrast correction for "Nouvelle discussion" CTA button
   - Direct integration of `NewConversationModal` (`src/features/messaging/components/NewConversationModal.tsx`)

Both features currently suffer from legacy coupling with `AccountDrawerHost variant="card"` (designed for the `/compte` card overlay) and cascade conflicts with `compte-v8.css`. Migrating to the canonical Apple `Sheet.tsx` component and deduplicating the empty state resolves all defects cited in Section 5 of the iPhone Audit Report (`audit_complet_iphone.md`, lines 312-334).

---

## 2. Feature 8: Bottom Sheet Drawers (`+` and `...`)

### 2.1. Root Cause Analysis

#### A. High Viewport Position (`y = 114..386` instead of `y >= 500pt`)
- **Observed behavior**: Tapping `...` (share menu) or the conversation header pill opens a drawer floating in the top third of the screen (`y = 114..386`), obscuring the conversation list rather than sliding up from the screen bottom.
- **Evidence**:
  - `ComposerMenuSheet.tsx` (line 238) and `ConversationOptionsSheet.tsx` (line 111) both wrap their content in `<AccountDrawerHost variant="card" ...>`.
  - In `src/design/account/AccountDrawerHost.tsx` (lines 144-156), `variant="card"` calculates its bounds by measuring `document.getElementById('card')`:
    ```ts
    const card = document.getElementById('card');
    const phone = card?.closest('.phone') as HTMLElement | null;
    const c = card.getBoundingClientRect();
    const p = phone.getBoundingClientRect();
    setBox({
      top: Math.max(0, c.top - p.top),
      left: Math.max(0, c.left - p.left),
      right: Math.max(0, p.right - c.right),
      bottom: Math.max(0, p.bottom - c.bottom),
    });
    ```
  - In `src/components/messaging/MessagesScreen.tsx` (line 1461), `<div className="card split" id="card">` is the **upper 40% pane** of the split screen (`top ≈ 114px`, `bottom ≈ 386px` on iPhone 16 Pro).
  - Furthermore, `DRAWER_INSET` in `AccountDrawerHost.tsx` (line 24) hardcodes `bottom: 342.92px`, which was calibrated specifically for the profile tab card, not a viewport bottom sheet.
  - As a result, the drawer is mechanically pinned inside the upper card bounds (`y = 114..386`), completely disconnected from the composer button at `y = 728`.

#### B. Title Clipped at 0px from Left Border
- **Observed behavior**: The title `"Partager dans le chat"` touches the left container border with 0px padding.
- **Evidence**:
  - In `src/components/messaging/messages-grammar.css` (lines 531-536):
    ```css
    .lkdv-messages .sw-wrap[data-det='card'] .sh-h {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 2px 0 6px; /* zero lateral padding */
      margin: 0;
    }
    ```
  - In `AccountDrawerHost.tsx` (lines 262-273), when `onBack` is undefined (in `view === 'menu'`), the header renders:
    ```tsx
    <div className="sh-t">
      <b>{title}</b>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
    ```
  - Because `onBack` is absent and `.sh-h` specifies `padding: 2px 0 6px`, the title starts at `left = 0px` inside the `.sheet` container.

#### C. Lower Options Truncation
- **Observed behavior**: In `ComposerMenuSheet`, the 3rd card (`Randonnée / Proposer un itinéraire`) is cut in half at `y = 386`, and subsequent options (`Équipement`, `Kit`, etc.) are hidden.
- **Evidence**:
  - `AccountDrawerHost` sets height boundaries through `--card-top` and `--card-bottom`.
  - The inner wrapper has `overflow: hidden`, and `.sh-b` height is restricted to the card bounds (`~270px`).
  - Five full option rows require at least `5 × 58px + 60px = 350px`, causing severe vertical truncation.

#### D. Redundant "Écrire un message" and Missing Management Controls
- **Observed behavior**:
  - Tapping the contact pill in the active conversation opens a drawer with a huge button `"Écrire un message"`, even though the conversation is already open directly underneath.
  - The drawer lacks a close button (`×`), mute options, blocking, and conversation deletion.
- **Evidence**:
  - In `MessagesScreen.tsx` (lines 1754-1763), clicking `mpill` for direct conversations executes:
    ```tsx
    if (selected.type === 'direct' && selected.other_member) {
      setProfileDrawerUser({
        id: selected.other_member.id,
        name: selected.other_member.full_name || conversationTitle(selected),
        avatar: selected.other_member.avatar_url || selected.avatar_url,
        username: selected.other_member.username,
      });
    } else {
      setOptionsConv(selected);
    }
    ```
  - `setProfileDrawerUser` opens an inline `AccountDrawerHost` (lines 1918-2040) with:
    - Centered avatar
    - `@username` + `342 km parcourus`
    - Button `"Écrire un message"` (lines 2000-2029)
    - Button `"Voir le profil"` (lines 2030-2045)
    - `hideCloseButton={true}`
    - Zero management controls (no mute, no block, no delete).
  - Meanwhile, `ConversationOptionsSheet.tsx` (line 111) was only called on conversation list item long-press, had `hideHeader={true}` (no close button `×`), and lacked "Supprimer la discussion".

---

### 2.2. Architectural Solution & Migration to `src/components/ui/Sheet.tsx`

`Sheet.tsx` is the central Apple design system bottom sheet primitive. It uses Radix UI Dialog, is anchored at `bottom: 0`, and features the exact Apple HIG specifications:
- **Grabber**: `36×5pt` with `rounded-[2.5px]` and `bg-[rgba(23,64,44,0.25)]` (`--sheet-grabber-*`).
- **Surface**: `rounded-t-[28px]`, glass materials, backdrop scrim (`bg-[color:var(--lkv-overlay-scrim)]`).
- **Padding**: `px-[var(--space-5)]` (`20px`) for both header and content — completely preventing text clipping.
- **Placement**: `fixed inset-x-0 bottom-0 z-[var(--z-sheet)]` (`z-index: 500`), anchored at `bottom: 0` (`y >= 500pt`).
- **Detents**: supports `auto`, `medium` (`55dvh`), and `large` (`90dvh`).

#### Enhancements Required in `Sheet.tsx`
To support sub-views (such as selecting GPX or Equipment within `ComposerMenuSheet`, or mute duration submenu in `ConversationOptionsSheet`), `Sheet.tsx` should support two optional props:
```ts
export interface SheetProps {
  // ... existing props
  onBack?: () => void;
  headerAction?: React.ReactNode;
}
```
When `onBack` is provided, a standard iOS back chevron button (`<Icon name="chevron-left" size={20} />`) is rendered to the left of the title, with minimum 44×44pt touch target.

---

### 2.3. Blueprint: `ComposerMenuSheet.tsx`

Migrate from `AccountDrawerHost` to `Sheet`:

```tsx
import { Sheet } from '@/components/ui/Sheet';

export const ComposerMenuSheet: React.FC<ComposerMenuSheetProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onSendGpx,
  onSendProduct,
  onSendTrail,
  onSendKit,
  onSendPhoto,
  onPickPhoto,
}) => {
  // ... state logic remains preserved ...

  const effectiveDetent = preview ? 'auto' : view === 'menu' ? 'auto' : 'large';

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title={
        preview
          ? 'Vérifier la pièce jointe'
          : view === 'menu'
            ? 'Partager dans le chat'
            : view === 'equip'
              ? 'Équipement'
              : view === 'kit'
                ? 'Mes kits'
                : 'Randonnées'
      }
      description={
        preview
          ? 'Confirmez avant l’envoi'
          : view === 'menu'
            ? 'Choisissez ce que vous voulez envoyer'
            : view === 'equip'
              ? 'Sélectionnez un matériel'
              : view === 'kit'
                ? 'Sélectionnez un kit'
                : 'Sélectionnez un itinéraire'
      }
      detent={effectiveDetent}
      onBack={preview ? () => setPreview(null) : view !== 'menu' ? backToMenu : undefined}
      headerAction={
        !preview && (view === 'gpx' || view === 'trail') ? (
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#17402C] hover:bg-[rgba(23,64,44,0.06)]"
            aria-label="Importer un fichier GPX"
            onClick={() => gpxInputRef.current?.click()}
          >
            <Icon name="plus" size={18} aria-hidden="true" />
          </button>
        ) : null
      }
      panelClassName="lkdv-messages"
      contentClassName="p-0"
    >
      {/* File inputs */}
      <input ref={gpxInputRef} type="file" accept=".gpx,application/gpx+xml" className="hidden" onChange={handleGpxPick} />
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />

      {/* Main Menu Options */}
      {view === 'menu' && !preview && (
        <div className="flex flex-col gap-2 px-5 pb-6 pt-2">
          {[
            { id: 'photo', label: 'Photo', sub: 'Depuis votre galerie', onClick: () => { haptic('light'); photoInputRef.current?.click(); } },
            { id: 'gpx', label: 'Carte GPX', sub: 'Fichier .gpx de votre itinéraire', onClick: openGpx },
            { id: 'trail', label: 'Randonnée', sub: 'Itinéraires enregistrés et tracés réels', onClick: openTrails },
            { id: 'equip', label: 'Équipement', sub: 'Depuis votre inventaire', onClick: openEquip },
            { id: 'kit', label: 'Kit', sub: 'Un kit de matériel', onClick: openKits },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`composer-opt-${item.id}`}
              onClick={item.onClick}
              className="flex min-h-[56px] w-full items-center justify-between rounded-2xl bg-white/80 p-3.5 text-left shadow-sm transition-transform active:scale-[0.98]"
            >
              <div>
                <div className="text-[15px] font-semibold text-[#172B24]">{item.label}</div>
                <div className="text-[12px] text-[#56665D]">{item.sub}</div>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(23,64,44,0.06)] text-[#56665D]">
                <Icon name="chevron-right" size={16} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Subviews (equip, kit, trail, gpx, preview) with smooth scrolling */}
      {/* ... preserved and wrapped in px-5 pb-6 ... */}
    </Sheet>
  );
};
```

---

### 2.4. Blueprint: `ConversationOptionsSheet.tsx`

1. **Eliminate redundant "Écrire un message"**: Completely absent when viewing an active conversation.
2. **Add authentic management controls**:
   - **Sourdine / Mute**: Toggle and duration submenu (`1 heure`, `8 heures`, `Toujours`).
   - **Infos du contact / groupe**: Direct link to profile (`/profil/:id`) or group details with member count.
   - **Bloquer**: Direct trigger for safety moderation (`onReport` or direct block API).
   - **Supprimer la discussion**: Destructive button executing `messagingService.deleteConversationForMe(conversation.id, currentUserId)`.
   - **Close button (`×`)**: Handled natively by `<Sheet dismissible={true}>`.

```tsx
import { Sheet } from '@/components/ui/Sheet';
import { messagingService } from '../services/messagingService';

export const ConversationOptionsSheet: React.FC<ConversationOptionsSheetProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onRefreshConversations,
  onReport,
  onOpenProfile,
  onDeleteConversation,
}) => {
  const { haptic } = useHapticFeedback();
  const [loading, setLoading] = useState(false);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);

  if (!conversation) return null;

  const isPending = conversation.status === 'pending';
  const isMuted = conversation.is_muted;
  const isArchived = conversation.is_archived;
  const isGroup = conversation.type === 'group';
  const member = conversation.other_member;

  const closeAndRefresh = () => {
    onRefreshConversations?.();
    onClose();
  };

  const handleDelete = async () => {
    const ok = window.confirm('Supprimer cette discussion de votre boîte de réception ?');
    if (!ok) return;
    haptic('medium');
    setLoading(true);
    await messagingService.deleteConversationForMe(conversation.id, currentUserId);
    setLoading(false);
    onDeleteConversation?.(conversation.id);
    closeAndRefresh();
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        showMuteSubmenu
          ? 'Durée de la sourdine'
          : isPending
            ? 'Demande de message'
            : isGroup
              ? 'Options du groupe'
              : 'Options de conversation'
      }
      description={
        showMuteSubmenu
          ? 'Choisissez combien de temps masquer les alertes'
          : isGroup
            ? `${conversation.title || 'Groupe'} · Membres`
            : member?.full_name || 'Voyageur LKDV'
      }
      onBack={showMuteSubmenu ? () => setShowMuteSubmenu(false) : undefined}
      detent="auto"
      panelClassName="lkdv-messages"
    >
      <div className="flex flex-col gap-2.5 px-5 pb-6 pt-2">
        {/* Contact or Group Card */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-white/80 p-3.5 shadow-sm">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-lg">
            {member?.avatar_url ? (
              <Image src={member.avatar_url} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              initials(isGroup ? conversation.title || 'Groupe' : member?.full_name || 'Voyageur')
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold text-[#172B24] truncate">
              {isGroup ? conversation.title || 'Groupe' : member?.full_name || 'Voyageur LKDV'}
            </div>
            <div className="text-[13px] text-[#56665D]">
              {isGroup ? 'Discussion collective' : member?.username ? `@${member.username}` : 'Membre LKDV'}
            </div>
          </div>
          {!isGroup && member?.id && (
            <button
              type="button"
              className="flex h-9 items-center rounded-full bg-[rgba(23,64,44,0.08)] px-4 text-[13px] font-semibold text-[#17402C]"
              onClick={() => {
                onClose();
                onOpenProfile?.({ id: member.id, name: member.full_name || 'Voyageur', avatar: member.avatar_url });
              }}
            >
              Profil
            </button>
          )}
        </div>

        {/* Mute Management */}
        {showMuteSubmenu ? (
          <div className="flex flex-col gap-2">
            {[
              { hours: 1, label: 'Pendant 1 heure' },
              { hours: 8, label: 'Pendant 8 heures' },
              { hours: undefined, label: 'Toujours (jusqu’à réactivation)' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex min-h-[48px] items-center justify-between rounded-xl bg-white/70 px-4 text-left font-medium text-[#172B24] shadow-sm active:scale-[0.99]"
                onClick={() => handleMuteToggle(item.hours)}
              >
                <span>{item.label}</span>
                <span className="text-xs font-semibold text-[#226148]">Activer</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Sourdine action */}
            <button
              type="button"
              data-testid="conv-opt-mute"
              className="flex min-h-[50px] items-center justify-between rounded-xl bg-white/80 px-4 text-left font-medium text-[#172B24] shadow-sm transition active:scale-[0.99]"
              onClick={() => {
                if (isMuted) handleMuteToggle(0);
                else setShowMuteSubmenu(true);
              }}
            >
              <div>
                <div className="text-[15px] font-semibold">
                  {isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
                </div>
                <div className="text-[12px] text-[#56665D]">
                  {isMuted ? 'Les notifications sont masquées' : 'Choisir une durée de silence'}
                </div>
              </div>
              <span className="text-xs font-semibold text-[#226148]">
                {isMuted ? 'Réactiver' : 'Choisir'}
              </span>
            </button>

            {/* Archive / Desarchive */}
            <button
              type="button"
              className="flex min-h-[50px] items-center justify-between rounded-xl bg-white/80 px-4 text-left font-medium text-[#172B24] shadow-sm transition active:scale-[0.99]"
              onClick={handleArchiveToggle}
            >
              <div>
                <div className="text-[15px] font-semibold">
                  {isArchived ? 'Désarchiver la discussion' : 'Archiver la discussion'}
                </div>
                <div className="text-[12px] text-[#56665D]">
                  {isArchived ? 'Rétablir dans la boîte de réception' : 'Masquer de la liste principale'}
                </div>
              </div>
              <span className="text-xs font-semibold text-[#56665D]">
                {isArchived ? 'Désarchiver' : 'Archiver'}
              </span>
            </button>

            {/* Bloquer / Signaler (Direct conversation only) */}
            {!isGroup && onReport && (
              <button
                type="button"
                data-testid="conv-opt-report"
                className="flex min-h-[50px] items-center justify-between rounded-xl bg-white/80 px-4 text-left font-medium text-[#85261E] shadow-sm transition active:scale-[0.99]"
                onClick={() => {
                  onReport(conversation);
                  onClose();
                }}
              >
                <div>
                  <div className="text-[15px] font-semibold">Signaler ou bloquer</div>
                  <div className="text-[12px] text-[#8C9790]">En cas de contenu inapproprié</div>
                </div>
                <span className="text-xs font-semibold text-[#85261E]">Bloquer</span>
              </button>
            )}

            {/* Supprimer définitivement la discussion */}
            <button
              type="button"
              data-testid="conv-opt-clear"
              className="flex min-h-[50px] items-center justify-between rounded-xl bg-[rgba(133,38,30,0.06)] px-4 text-left font-medium text-[#85261E] shadow-sm transition active:scale-[0.99]"
              onClick={handleDelete}
            >
              <div>
                <div className="text-[15px] font-semibold">Supprimer la discussion</div>
                <div className="text-[12px] text-[#85261E]/80">Effacer de votre appareil</div>
              </div>
              <span className="text-xs font-semibold text-[#85261E]">Supprimer</span>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
};
```

#### Wiring in `MessagesScreen.tsx`:
- When clicking `mpill` or conversation options, always set `setOptionsConv(selected)`.
- Delete the redundant inline `profileDrawerUser` `AccountDrawerHost` (lines 1918-2040).
- Pass `onDeleteConversation={(id) => { setSelectedId(null); }}` to `ConversationOptionsSheet`.

---

## 3. Feature 9: Demandes & Empty State Fix

### 3.1. Root Cause Analysis

#### A. Duplicate Empty State on `Demandes`
- **Observed behavior**: Tapping the `Demandes` filter tab (`🔔`) when there are no message requests displays two conflicting empty states at once:
  - Top card: `"Aucune discussion"` with a `"Nouvelle discussion"` button.
  - Bottom card: `"Choisissez une discussion / Ou lancez une nouvelle discussion avec un membre de la communauté."` with a second `"Nouvelle discussion"` button right below it.
- **Evidence**:
  - In `src/components/messaging/MessagesScreen.tsx` (lines 1600-1645), the top card checks `visible.length === 0`:
    ```tsx
    {visible.length === 0 ? (
      <div className="mstate" style={{ ... }}>
        <b style={{ font: '700 17px/1.2 var(--sf)', color: '#17402C' }}>
          {query.trim() ? 'Aucun résultat' : 'Aucune discussion'}
        </b>
        ...
        <button type="button" className="mbtn p" onClick={focusSearch} ...>
          Nouvelle discussion
        </button>
      </div>
    ) : ...}
    ```
  - In lines 1735-1810, the bottom pane checks `{selected ? ( ... ) : ( ... )}`:
    ```tsx
    {selected ? (
      <div className="mpane in" ...> ... </div>
    ) : (
      <div className="mstate" style={{ margin: 'auto' }}>
        <b>Choisissez une discussion</b>
        <span>Ou lancez une nouvelle discussion avec un membre de la communauté.</span>
        <button type="button" className="mbtn p" onClick={focusSearch}>
          Nouvelle discussion
        </button>
      </div>
    )}
    ```
  - When switching to `Demandes` and there are no pending requests, `visible.length === 0` AND `selected === null`.
  - Both components simultaneously evaluate their empty condition and render `.mstate`, producing two stacked empty states and two stacked buttons within 120pt of each other.

#### B. Text Contrast Failure on Dark Green Button (Black on `#19442c`)
- **Observed behavior**: The `"Nouvelle discussion"` CTA button displays black text over dark green `#19442c`, failing WCAG AA (4.5:1) and AAA (7:1).
- **Evidence**:
  - In `MessagesScreen.tsx` (line 1625), the button has:
    ```tsx
    <button
      type="button"
      className="mbtn p"
      style={{
        background: 'linear-gradient(180deg, #275d3f, #17402c)',
        color: '#fff',
        ...
      }}
    >
      Nouvelle discussion
    </button>
    ```
  - However, in `src/components/compte/compte-v8.css` (line 138):
    ```css
    .mbtn.p {
      background: var(--pg);
      color: var(--pg-ink) !important; /* <--- !important overrides inline style! */
      box-shadow: var(--pg-sh);
    }
    ```
  - In `compte-v8.css` (line 32), `--pg-ink` is defined as:
    ```css
    --pg-ink: #17402C;
    ```
  - Because `.mbtn.p` applies `color: var(--pg-ink) !important;`, the browser stylesheet rule **completely overrides** the inline React `color: '#fff'`.
  - The rendered text color is therefore `#17402C` (dark green ink) over `#17402c` (dark green background). The contrast ratio is 1.0:1 (completely unreadable, appearing as black on green on mobile screens).

#### C. Non-functional CTA Button (`focusSearch` instead of Contact Picker)
- **Observed behavior**: Clicking `"Nouvelle discussion"` does not open a user directory or modal; it merely focuses the filter search box (which only filters conversations already in the list).
- **Evidence**:
  - In `MessagesScreen.tsx` (lines 1441-1444):
    ```ts
    const focusSearch = () => {
      searchRef.current?.focus({ preventScroll: true });
      searchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    ```
  - `focusSearch` was written as a placeholder. The real contact directory modal (`NewConversationModal.tsx`) already exists at `src/features/messaging/components/NewConversationModal.tsx`, but was never imported or instantiated inside `MessagesScreen.tsx`.

---

### 3.2. Blueprint: Empty State Deduplication & Contextual Copy

In `src/components/messaging/MessagesScreen.tsx`:

1. **Top Card Empty State**: Show contextual feedback based on the active tab:
   - When `filter === 'requests'`:
     - Title: `"Aucune demande"`
     - Description: `"Vous n'avez aucune demande de message en attente."`
     - Button: `"Nouvelle discussion"` (opens `NewConversationModal`)
   - When `query.trim()`:
     - Title: `"Aucun résultat"`
     - Description: `"Aucune discussion ne correspond à « ${query} »."`
     - Button: `"Effacer la recherche"` (`onClick={() => setQuery('')}`)
   - When inbox is empty:
     - Title: `"Aucune discussion"`
     - Description: `"Lancez une discussion avec un membre de la communauté."`
     - Button: `"Nouvelle discussion"` (opens `NewConversationModal`)

2. **Bottom Pane**:
   - When `visible.length === 0`: **Do NOT render a second `.mstate` empty state**. Render `null` or a tranquil clean background.
   - When `visible.length > 0` and `selectedId === null`: Render the standard selection prompt:
     - Title: `"Choisissez une discussion"`
     - Description: `"Sélectionnez une discussion dans la liste pour afficher les messages."`
     - Action button: `"Nouvelle discussion"` (opens `NewConversationModal`).

---

### 3.3. Blueprint: WCAG AAA Contrast Fix

1. In `src/components/messaging/messages-grammar.css`, add explicit, high-specificity rules utilizing LKDV tokens:
```css
.lkdv-messages .mstate .mbtn-cta-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-height: 40px;
  padding: 0 24px;
  border-radius: 9999px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  border: none;
  background: var(--lkv-primary, #17402C) !important;
  color: var(--lkv-on-brand, #FFFFFF) !important;
  box-shadow: 0 4px 14px rgba(23, 64, 44, 0.28) !important;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.lkdv-messages .mstate .mbtn-cta-primary:active {
  transform: scale(0.97);
  opacity: 0.92;
}
```

2. **Contrast Verification**:
   - Background: `--lkv-primary` (`#17402C`, relative luminance $L_1 = 0.0384$)
   - Foreground: `--lkv-on-brand` (`#FFFFFF`, relative luminance $L_2 = 1.0000$)
   - Contrast Ratio:
     $$\frac{1.0000 + 0.05}{0.0384 + 0.05} = \frac{1.05}{0.0884} = 11.88 : 1$$
   - Result: **11.88:1**, substantially exceeding the **WCAG AAA requirement of 7.0:1** for regular text. Zero pure black (`#000000`).

---

### 3.4. Blueprint: Wiring `NewConversationModal`

1. In `src/features/messaging/components/NewConversationModal.tsx`:
   - Replace `<AccountDrawerHost>` with `<Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }} title="Nouvelle discussion" description="Annuaire des voyageurs" detent="large">`.
   - Ensure the traveler list displays avatar, full name, username, and an action button `"Écrire"`.

2. In `src/components/messaging/MessagesScreen.tsx`:
   - Add state: `const [newConvOpen, setNewConvOpen] = useState(false);`
   - Include in `surfaceOpen`: `... || newConvOpen;`
   - Dynamic import:
     ```tsx
     const NewConversationModal = dynamic(
       () => import('@/features/messaging/components/NewConversationModal').then((m) => m.NewConversationModal),
       { ssr: false }
     );
     ```
   - Wire all "Nouvelle discussion" buttons to:
     ```tsx
     onClick={() => {
       haptic('light');
       setNewConvOpen(true);
     }}
     ```
   - Render the modal:
     ```tsx
     {currentUserId ? (
       <NewConversationModal
         isOpen={newConvOpen}
         onClose={() => setNewConvOpen(false)}
         currentUserId={currentUserId}
         onConversationCreated={async (convId) => {
           await refreshConversations();
           setSelectedId(convId);
           setNewConvOpen(false);
         }}
       />
     ) : null}
     ```

---

## 4. Summary of Affected Files & Target Code Blocks

| File | Target Lines | Modification |
|---|---|---|
| `src/components/ui/Sheet.tsx` | 20-30, 151-179 | Add optional `onBack?: () => void` and `headerAction?: React.ReactNode` to `SheetProps` and header rendering. |
| `src/features/messaging/components/ComposerMenuSheet.tsx` | 5-6, 237-285, 521-615 | Replace `AccountDrawerHost` with `Sheet`. Provide 5 options with `data-testid="composer-opt-*"` and scrollable container. |
| `src/features/messaging/components/ConversationOptionsSheet.tsx` | 6-8, 111-338 | Replace `AccountDrawerHost` with `Sheet`. Remove redundant "Écrire un message". Add Sourdine (mute), Bloquer, and Supprimer la discussion with `data-testid="conv-opt-*"`. |
| `src/features/messaging/components/NewConversationModal.tsx` | 7, 108-186 | Replace `AccountDrawerHost` with `Sheet detent="large"`. |
| `src/components/messaging/MessagesScreen.tsx` | 62-70, 1220-1230, 1410-1415, 1600-1645, 1745-1815, 1918-2040 | Deduplicate empty state, apply WCAG AAA CTA styling, wire `NewConversationModal`, unify `mpill` to `setOptionsConv(selected)`, and eliminate `profileDrawerUser` card drawer. |
| `src/components/messaging/messages-grammar.css` | 798-810 | Add `.mbtn-cta-primary` with `#17402C` background and `#FFFFFF` text (`!important`). |

---

## 5. Verification & Test Plan

1. **Unit & Boundary Tests (Vitest)**:
   - `tests/e2e/tiers/tier1-features.spec.ts`:
     - `E2E-T1-F08-01` to `E2E-T1-F08-05`: Verifies bottom sheet anchoring, 5 composer options, 36×5pt grabber, close button `×`, and management controls.
     - `E2E-T1-F09-01` to `E2E-T1-F09-05`: Verifies single unified empty state on `Demandes`, WCAG AAA contrast ratio ($\ge 7.0$), and modal launch.
   - Command: `node tests/e2e/runner.mjs` (must pass 140/140 tests).
2. **Physical iPhone 16 Pro Verification (UDID `00008140-000E7D081A0B001C`)**:
   - `02-messagerie-filter-demandes.png`: Verifies single empty state with readable white-on-dark-green button.
   - `03-messagerie-nouvelle-discussion-tap.png`: Verifies tapping opens `NewConversationModal` bottom sheet directory.
   - `07-messagerie-composer-menu-sheet.png`: Verifies `...` opens bottom sheet at `y >= 500pt` with grabber and 5 fully visible options.
   - `08-messagerie-conversation-options-sheet.png`: Verifies options bottom sheet with close `×`, mute, block, and delete options without redundant "Écrire un message".
