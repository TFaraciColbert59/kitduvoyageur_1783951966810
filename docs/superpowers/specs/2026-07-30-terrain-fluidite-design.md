# Design: Parcours Utilisateur Instinctif & Mode Terrain

**Date:** 2026-07-30
**Stack:** Next.js 15 / React 19 / Tailwind CSS / Framer Motion 12

---

## 1. Navigation Restructuring

### BottomTabBar

Tabs: **Boutique** | **Aventures** | **🧭 Terrain** | **Communauté** | **Compte**

- `Accueil` tab removed (desktop-only page; mobile users land on Boutique or Terrain)
- `Terrain` occupies center position, visually distinct: larger icon, forest-800 background, white icon, subtle glow shadow
- Active dot indicator moved to layoutId system for smooth spring animation
- `matchPaths` updated to reflect new tab structure

### TopBar

- **Persistent search icon** on ALL pages (removed `isHome` gate)
- Search icon opens `SearchOverlay` modal (not a link to explorer)
- Remaining structure unchanged: back arrow, title, cart icon
- Floating hamburger menu button (MobileNavWrapper) retained for drawer access

---

## 2. Page /terrain (Terrain Hub)

New route: `src/app/terrain/page.tsx` + `src/app/terrain/layout.tsx`

Mobile-only hub page aggregating terrain-mode tools:

| Section | Content |
|---------|---------|
| Header | "Mode Terrain" title + subtitle, GPS status indicator (active/inactive) |
| Hero Card | Large card with terrain illustration, "Naviguer" CTA → `/naviguer` |
| Quick Grid | 2×2 cards: Mon Kit, Recherche, Carte, Guide |
| Bottom CTA | "Activer le mode terrain" switch (future: persistent mode toggle) |

### Layout
- `layout.tsx`: metadata (title "Mode Terrain", description), canonical, JSON-LD WebPage schema via `other`
- `page.tsx`: client component rendering `TerrainHub`

---

## 3. SearchOverlay + Recent Searches

### SearchOverlay Component
- Full-screen overlay with backdrop scrim (z-index 60, above BottomTabBar 50)
- Animated entrance: slide down + fade via Framer Motion
- Search input auto-focused, with clear button
- Results section: recent searches, suggestions
- Close on: escape key, backdrop tap, swipe down

### useRecentSearches Hook
- `localStorage`-backed persistence
- API: `{ recentSearches, addSearch, clearSearches, removeSearch }`
- Max 10 entries, deduplicated, most-recent-first
- Each entry: `{ query: string, timestamp: number }`

### Integration
- TopBar search button opens SearchOverlay instead of linking to /explorer
- Recent searches shown as tappable chips in overlay

---

## 4. Fluidité & Micro-interactions

### Haptic Feedback Integration
- `useHapticFeedback` already exists but unused — wire into:
  - BottomTabBar tab presses (light haptic)
  - Search overlay submit (medium haptic)
  - Back button (light haptic)
- Pattern: `haptic.light()` on press/tap, `haptic.success()` on completion

### Infinite Scroll Hook
- `useInfiniteScroll` hook (ref-based IntersectionObserver)
- Returns: `{ sentinelRef, isIntersecting, page }`
- Generic: `(loadMore: () => Promise<void>, options?: { threshold, rootMargin })`
- Used on boutique, communaute, explorer listing pages

### Optimistic UI (Pattern)
- Wrap mutations in `@tanstack/react-query` `useMutation` with `onMutate` + `onError` rollback
- Pattern documented for: cart add/remove, wishlist toggle, follow/unfollow

### Page Transitions
- `PageTransition` already wraps all pages (fade + slide 0.25s)
- Add `layout` animations to repeated list items for stable reorder

---

## 5. Offline Resilience

### Navigator.onLine Detection
- `useOnlineStatus` hook: `{ isOnline, lastOnline }`
- Listeners on `online`/`offline` events
- Expose via React context for global access

### Visual Feedback
- Offline banner: fixed bottom bar above BottomTabBar, amber background
- Toast on connection loss: "Mode hors-ligne — les données affichées peuvent être obsolètes"
- Reconnection toast: "Connexion rétablie"

### Caching Strategy
- `localStorage`-backed cache with TTL per data type
- `useOfflineCache(key, fetcher, ttl)` hook: return cached data if offline, refresh if online + stale
- Keys: recent searches, last-viewed product, user profile (partial)

---

## 6. Files Modified/Created

| File | Action |
|------|--------|
| `src/components/mobile-nav/BottomTabBar.tsx` | Modify tabs |
| `src/components/mobile-nav/TopBar.tsx` | Persistent search |
| `src/app/terrain/layout.tsx` | Create |
| `src/app/terrain/page.tsx` | Create |
| `src/components/terrain/TerrainHub.tsx` | Create |
| `src/components/search/SearchOverlay.tsx` | Create |
| `src/components/search/useRecentSearches.ts` | Create |
| `src/hooks/useOnlineStatus.ts` | Create |
| `src/hooks/useInfiniteScroll.ts` | Create |
| `src/hooks/useOfflineCache.ts` | Create |

---

## 7. Open Questions / Future

- Mode terrain "persistent" toggle: deferred — UI exists on TerrainHub page but no global state yet
- Push notifications for offline mode: deferred
- Service worker caching: deferred (consider next-pwa or workbox later)
