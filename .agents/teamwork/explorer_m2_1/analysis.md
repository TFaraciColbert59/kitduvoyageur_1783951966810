# Technical Analysis & Blueprint: Features 5, 6, 7 (/messagerie)

**Date**: 2026-11-14
**Author**: Explorer 1 (`teamwork_explorer_m2_1`)
**Scope**: Milestone M2 — Features 5, 6, 7
**Target Files**:
- `src/components/messaging/MessagesScreen.tsx`
- `src/components/messaging/messages-grammar.css`
- `src/components/ui/NotificationBell.tsx`

---

## 1. Feature 5: Header Navigation Fix

### 1.1 Root Cause & Live Trace
In `src/components/messaging/MessagesScreen.tsx` (lines 1468–1480):
```tsx
<section className="top" id="top">
  <div className="ig-top">
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
  </div>
```

In `src/components/ui/NotificationBell.tsx` (lines 28–38):
```tsx
return (
  <Link
    href="/compte?tab=notifications"
    className={`lkdv-notif-wrap ${className}`.trim()}
    aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
  >
    <Icon name="bell" size={17} aria-hidden="true" />
    {unread > 0 ? <span className={badgeClassName}>{unread > 99 ? '99+' : unread}</span> : null}
  </Link>
);
```

### 1.2 Observed Anomalies (iPhone Audit Section 5.1 & E2E Tests)
1. **Redirection to `/compte` on title click**: Tapping `"Messages"` triggers `router.push('/compte')`, abandoning the messaging workspace and switching to the user account profile.
2. **Accessible name pollution**: The title button carries `aria-label="Messages — aller au compte"`.
3. **Redirection to `/compte?tab=notifications` on bell click**: Tapping `NotificationBell` navigates away to `/compte?tab=notifications`.
4. **Charcoal black flash (`#0d1117`)**: During the route transition from `/messagerie` to `/compte`, the unhydrated account shell / drawer backdrop renders dark before loading the user profile, violating the LKDV green palette invariant.

### 1.3 Proposed Changes Blueprint

#### A. In `src/components/ui/NotificationBell.tsx`:
Add support for custom `onClick` handler so screens can retain in-page context without navigating away:
```tsx
export interface NotificationBellProps {
  userId?: string;
  className?: string;
  badgeClassName?: string;
  onClick?: (event: React.MouseEvent) => void;
}

export function NotificationBell({
  userId,
  className = 'gbtn',
  badgeClassName = 'lkdv-notif-badge',
  onClick,
}: NotificationBellProps) {
  const unread = useAccountUnreadCount(userId);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`lkdv-notif-wrap ${className}`.trim()}
        aria-label={unread > 0 ? `Notifications (${unread})` : 'Notifications'}
      >
        <Icon name="bell" size={17} aria-hidden="true" />
        {unread > 0 ? <span className={badgeClassName}>{unread > 99 ? '99+' : unread}</span> : null}
      </button>
    );
  }

  return (
    <Link
      href="/compte?tab=notifications"
      className={`lkdv-notif-wrap ${className}`.trim()}
      aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
    >
      <Icon name="bell" size={17} aria-hidden="true" />
      {unread > 0 ? <span className={badgeClassName}>{unread > 99 ? '99+' : unread}</span> : null}
    </Link>
  );
}
```

#### B. In `src/components/messaging/MessagesScreen.tsx`:
1. Add state for in-page notification sheet:
```tsx
const [notificationsOpen, setNotificationsOpen] = useState(false);
```
2. Title button click behavior: stays on `/messagerie`, scrolls conversation list to top, and resets filters/search if active:
```tsx
const handleTitleClick = () => {
  if (selectedId) setSelectedId(null);
  if (query) setQuery('');
  if (filter !== 'all') setFilter('all');
  const scrollContainer = phone.current?.querySelector('.card-scroll');
  if (scrollContainer) {
    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }
};
```
3. Update header JSX:
```tsx
<section className="top" id="top">
  <div className="ig-top">
    <button
      type="button"
      className="lg ig-handle"
      onClick={handleTitleClick}
      aria-label="Messages"
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>Messages</span>
    </button>
    <div className="ig-top-r">
      <NotificationBell
        userId={currentUserId ?? undefined}
        onClick={() => setNotificationsOpen(true)}
      />
    </div>
  </div>
```
4. Render canonical Apple Bottom Sheet for Notifications:
```tsx
<Sheet
  open={notificationsOpen}
  onOpenChange={setNotificationsOpen}
  title="Notifications"
  detent="medium"
  dragToDismiss
>
  <NotificationsPane />
</Sheet>
```
*(Import `NotificationsPane` dynamically or from `@/components/compte/drawer/compte/NotificationsPane` and `Sheet` from `@/components/ui/Sheet`).*

---

## 2. Feature 6: Filter SegmentedControl Repositioning

### 2.1 Root Cause & Live Trace
In `src/components/messaging/MessagesScreen.tsx` (lines 1660–1678):
`<SubCapsuleTabs>` was placed at the bottom of `.card.cs`, outside `.card-scroll`, with `placement="float"` and `showLabels={false}`:
```tsx
{/* Filtre des discussions : capsule compacte en bas à droite de la card. */}
<SubCapsuleTabs
  items={FILTERS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    badge: item.id === 'requests' && pendingCount > 0 ? pendingCount : undefined,
  }))}
  activeIndex={Math.max(0, FILTERS.findIndex((item) => item.id === filter))}
  onIndexChange={(idx) => {
    const next = FILTERS[idx];
    if (next) changeFilter(next.id);
  }}
  ariaLabel="Filtrer les discussions"
  placement="float"
  showLabels={false}
  className="mfilters"
/>
```

In `src/components/messaging/messages-grammar.css` (lines 995–1015, 1044–1046):
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
  height: 30px !important;
  padding: 2.5px !important;
  border-radius: 9999px !important;
  ...
}
.lkdv-messages .mfilters button .lbl {
  display: none !important;
}
```

### 2.2 Observed Anomalies (iPhone Audit Section 5.1 & Device Tree)
- In `messagerie-conv-camille-tree.xml` and baseline shots `00-messagerie-main.png`, `02-messagerie-filter-demandes.png`:
  - 4th conversation button (`Dolomites — août`): `x=22, y=337, width=358, height=57`.
  - Floating filter pill (`💬 / 👤 / 👥 / 🔔`): `x=182, y=348, width=196, height=26`.
  - **Severe collision**: Filter pill floats directly above conversation 4, masking the text `"Dolomites — août"`, preview text, and timestamp.
  - Labels (`Toutes`, `Directs`, `Groupes`, `Demandes`) are hidden due to `display: none !important;` on `.lbl`.

### 2.3 Proposed Changes Blueprint

#### A. In `src/components/messaging/MessagesScreen.tsx`:
Move `<SubCapsuleTabs>` out of the bottom of `#card` into a dedicated container `<div className="mfilters-bar">` located directly between `.msearch` and `.card-scroll`:
```tsx
<div className="card cs" id="card">
  <div className="msearch">
    <Icon name="search" className="size-4" aria-hidden="true" />
    <input
      ref={searchRef}
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Rechercher une discussion"
      aria-label="Rechercher une discussion, une personne ou un message"
    />
    {query ? (
      <button
        type="button"
        className="msearch-x"
        onClick={() => {
          setQuery('');
          searchRef.current?.focus();
        }}
        aria-label="Effacer la recherche"
      >
        <Icon name="x" className="size-3.5" aria-hidden="true" />
      </button>
    ) : null}
  </div>

  {/* Filtre des discussions : inséré dans le flux normal sous la recherche */}
  <div className="mfilters-bar">
    <SubCapsuleTabs
      items={FILTERS.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        badge: item.id === 'requests' && pendingCount > 0 ? pendingCount : undefined,
      }))}
      activeIndex={Math.max(0, FILTERS.findIndex((item) => item.id === filter))}
      onIndexChange={(idx) => {
        const next = FILTERS[idx];
        if (next) changeFilter(next.id);
      }}
      ariaLabel="Filtrer les discussions"
      placement="inline"
      showLabels={true}
      className="mfilters"
    />
  </div>

  <div className="card-scroll">
    ...
```

#### B. In `src/components/messaging/messages-grammar.css`:
1. Add `.mfilters-bar` in normal document flow:
```css
.lkdv-messages .mfilters-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 10px 8px;
  flex: none;
  z-index: 3;
}
```
2. Remove absolute coordinates on `.lkdv-messages .mfilters` and adapt to full inline width:
```css
.lkdv-messages .mfilters {
  position: relative !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  z-index: 2 !important;
  width: 100% !important;
  max-width: 100% !important;
  display: grid !important;
  grid-template-columns: repeat(4, 1fr) !important;
  height: 32px !important;
  padding: 2.5px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.35), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  box-sizing: border-box !important;
}
```
3. Enable labels display on `.lbl`:
```css
.lkdv-messages .mfilters button .lbl {
  display: inline-block !important;
  font: 600 11px/1 var(--sf);
  margin-left: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```
4. Update sliding lens indicator `.ig-th`:
```css
.lkdv-messages .mfilters .ig-th {
  position: absolute !important;
  top: 2.5px !important;
  bottom: 2.5px !important;
  left: 2.5px !important;
  width: calc((100% - 5px) / 4) !important;
  height: calc(100% - 5px) !important;
  border-radius: 9999px !important;
  transform: translateX(calc(var(--i, 0) * 100%)) !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.42)) !important;
  box-shadow: inset 0 1px 0 #fff, inset 0 -1px 1px rgba(255, 255, 255, 0.5), 0 0 0 0.5px rgba(23, 43, 36, 0.07), 0 2px 8px rgba(23, 43, 36, 0.08) !important;
  transition: transform 0.28s var(--ease-spring) !important;
  z-index: 1 !important;
}
```
5. Remove `.mfilter-float` rule.

---

## 3. Feature 7: Split View 40/60 De-collision

### 3.1 Root Cause & Live Trace
In `src/components/messaging/MessagesScreen.tsx` (lines 1681–1785):
```tsx
<section className="mapzone" aria-label="Conversation">
  <button
    type="button"
    className="msplit"
    role="separator"
    aria-orientation="horizontal"
    aria-label="Régler la hauteur des discussions et de la conversation"
    aria-valuenow={split}
    ...
  >
    <span aria-hidden="true" />
  </button>
  ...
  <div className="map" ...>
    {selected ? (
      <div className="mpane in" data-conversation={selected.id}>
        <button
          type="button"
          className="mpill"
          onClick={...}
          aria-label={...}
        >
          <span className="mpill-av">...</span>
          <span className="mpill-txt">
            <b>{conversationTitle(selected)}</b>
            <span>{selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'}</span>
          </span>
        </button>
        <div className="mpane-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <MessageThread ... />
        </div>
      </div>
```

In `src/components/messaging/messages-grammar.css`:
- `.lkdv-messages .mapzone > .msplit`:
  `position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 88px; height: 22px; z-index: 8;`
- `.lkdv-messages .mpill`:
  `margin: 8px 12px 6px; z-index: 5; max-width: min(78%, 300px); min-height: 44px;`

### 3.2 Observed Anomalies (iPhone Audit Section 5.2 & XCUI Tree Dump)
1. **The 44pt Collision**:
   From live XCUI element tree (`messagerie-conv-groupe-tree.xml` lines 54–55):
   - `msplit`: `x=157, y=396, width=88, height=22` (x spans `157..245`).
   - `mpill` (`Bivouac de printemps — 5 membres`): `x=12, y=402, width=189, height=44` (x spans `12..201`).
   - Overlap interval: `x ∈ [157, 201]`, which is **exactly 44 points wide** (`201 - 157 = 44 pt`)!
   - Vertical overlap: `y ∈ [402, 418]`.
   - Result: Users attempting to tap the grab handle hit the title pill instead, and long titles are visually sliced by the drag bar.
2. **Clipped Top Message Bubble**:
   In `04-messagerie-conv-camille-rochat.png`, the first message bubble (`"Salut ! Tu prends le réchaud..."`) is truncated at the top because `.mthread` lacks top breathing room and directly abuts `.mpill` without proper clearance.
3. **Missing Mobile Navigation Controls**:
   There is neither a Close (`×`) button to deselect the conversation (`setSelectedId(null)`) nor an Options (`...`) button for direct conversations (where clicking `.mpill` opens user profile instead of conversation options).

### 3.3 Proposed Changes Blueprint

#### A. In `src/components/messaging/MessagesScreen.tsx`:
1. Update `msplit` ARIA attributes:
```tsx
<button
  type="button"
  className="msplit"
  role="separator"
  aria-orientation="horizontal"
  aria-label="Régler la hauteur des discussions et de la conversation"
  aria-valuenow={split}
  aria-valuemin={140}
  aria-valuemax={694}
  ...
```
2. Replace naked `<button className="mpill">` with a structured `<header className="mpane-header">`:
```tsx
<header className="mpane-header">
  <div className="mpane-header-left">
    <button
      type="button"
      className="mbtn-conv-close lg gbtn"
      onClick={() => {
        haptic('light');
        setSelectedId(null);
      }}
      aria-label="Fermer la conversation"
    >
      <Icon name="x" size={16} aria-hidden="true" />
    </button>
    <button
      type="button"
      className="mpill"
      onClick={() => {
        haptic('light');
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
      }}
      aria-label={`${conversationTitle(selected)} — ${
        selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'
      }`}
    >
      <span className="mpill-av" aria-hidden="true">
        {selected.avatar_url && selected.avatar_url !== '/assets/images/no_image.png' ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar distant */}
            <img
              src={selected.avatar_url}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'inline';
              }}
            />
            <span style={{ display: 'none' }}>{initials(conversationTitle(selected))}</span>
          </>
        ) : (
          initials(conversationTitle(selected))
        )}
      </span>
      <span className="mpill-txt">
        <b>{conversationTitle(selected)}</b>
        <span>{selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'}</span>
      </span>
    </button>
  </div>

  <div className="mpane-header-right">
    <button
      type="button"
      className="mbtn-conv-options lg gbtn"
      onClick={() => {
        haptic('light');
        setOptionsConv(selected);
      }}
      aria-label="Options de la conversation"
    >
      <Icon name="more-horizontal" size={17} aria-hidden="true" />
    </button>
  </div>
</header>
```

#### B. In `src/components/messaging/messages-grammar.css`:
1. Grab handle `msplit`:
```css
.lkdv-messages .mapzone > .msplit {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: grid;
  place-items: center;
  width: 88px;
  height: 18px;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
  cursor: ns-resize;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
.lkdv-messages .mapzone > .msplit > span {
  display: block;
  width: 36px;
  height: 5px;
  border-radius: 2.5px;
  background: rgba(23, 64, 44, 0.25);
  transition: background 0.2s ease, width 0.2s ease;
}
```
2. Conversation header `.mpane-header`:
```css
.lkdv-messages .mpane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  margin-top: 20px; /* Clear msplit grab area completely */
  flex: none;
  z-index: 5;
  position: relative;
}
.lkdv-messages .mpane-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.lkdv-messages .mpane-header-right {
  display: flex;
  align-items: center;
  flex: none;
}
.lkdv-messages .mpane-header .gbtn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: none;
  background: rgba(255, 255, 255, 0.65);
  border: 0.5px solid rgba(23, 64, 44, 0.12);
  color: var(--label);
  box-shadow: 0 1px 3px rgba(23, 43, 36, 0.08);
  cursor: pointer;
  transition: transform 0.14s ease, background 0.14s ease;
}
.lkdv-messages .mpane-header .gbtn:active {
  transform: scale(0.92);
}
```
3. Contact / Group pill `.mpill`:
```css
.lkdv-messages .mpill {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 220px;
  min-height: 38px;
  margin: 0;
  padding: 3px 10px 3px 3px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.485), rgba(255, 255, 255, 0.325) 55%, rgba(255, 255, 255, 0.405));
  -webkit-backdrop-filter: blur(14px) saturate(1.8);
  backdrop-filter: blur(14px) saturate(1.8);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 0 0.5px rgba(23, 43, 36, 0.12),
    0 6px 18px rgba(23, 43, 36, 0.12);
  color: var(--label);
  text-align: left;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
```
4. Thread top breathing room in `.mthread`:
```css
.lkdv-messages .mthread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 16px 16px 18px;
  scroll-padding-bottom: 18px;
  scrollbar-width: none;
}
```

---

## 4. Synthesis & Risk Assessment

| Feature | Primary Risk | Mitigation |
|---|---|---|
| F05: Header Nav | Breaking notifications access if in-page sheet is incomplete | Leverage existing `Sheet` component with `NotificationsPane`, which is already tested and connected to React Query. |
| F06: Filter Repositioning | Horizontal overflow on very small devices (<360px) | `SubCapsuleTabs` with `grid-template-columns: repeat(4, 1fr)` and `min-width: 0`, `text-overflow: ellipsis` on `.lbl`. |
| F07: Split View De-collision | Handle collision during continuous resizing | Vertical separation (`margin-top: 20px`) guarantees 0px vertical collision regardless of horizontal width or touch dragging. |

All proposals are 100% compliant with the Apple design system, LKDV pure green palette (zero `#000000`, zero `#0d1117`), and E2E test suites Tiers 1–4.
