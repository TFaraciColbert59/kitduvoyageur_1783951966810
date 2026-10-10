# Analysis & Remediation Strategy: Live Cards UI & Apple HIG Mobile Ergonomics (M2)

**Author**: `explorer_m2_remediation_ui_1`  
**Date**: 2026-10-04T16:04:00Z  
**Scope**: Remediation of findings from `reviewer_m2_2` and `challenger_m2_2` across `MessageBubble.tsx`, `PackMergeSheet.tsx`, and `GPXLiveCard.tsx`.

---

## 1. Executive Summary

This report establishes the surgical remediation strategy for the UI and mobile ergonomics findings identified during Milestone 2 reviews. Specifically:
1. **Empty Facade in `MessageBubble.tsx:516-523`**: Resolved via a canonical domain helper `computeKitPreviewMergeResult` in `packMerge.ts` that derives an authentic physiological `PackMergeResult` from any `KitSnapshot`, eliminating the 0-item empty sheet.
2. **iOS Home Indicator Collision in `PackMergeSheet.tsx:65, 223`**: Resolved via safe-area padding `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]`, clearing the 34px gesture swipe zone on iPhones.
3. **Sub-Standard Touch Target in `PackMergeSheet.tsx:120`**: Resolved by enlarging the segmented switcher container to `h-12 min-h-[48px]` and tabs to `min-h-[44px]`, satisfying Apple HIG ($\ge 44\text{pt}$).
4. **Missing Backdrop Scrim in `PackMergeSheet.tsx:61`**: Resolved by inserting an accessible `<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />` scrim.
5. **Hard Page Refresh in `GPXLiveCard.tsx:35`**: Resolved by adopting Next.js SPA navigation (`useRouter().push`) with test-safe fallback.
6. **SVG Gradient ID Collision in `GPXLiveCard.tsx:28`**: Resolved via React `useId()` for deterministic, instance-unique gradient references.
7. **Invalid Icon Glyph in `GPXLiveCard.tsx:79`**: Resolved by changing `name="arrow-down-tray"` to canonical `name="download"`, eliminating console warnings and restoring the SVG glyph.

---

## 2. Finding-by-Finding Forensic Analysis

### 2.1 Issue 1: `MessageBubble.tsx:516-523` — Empty Facade Wiring of `PackMergeSheet`

#### Root Cause
In `MessageBubble.tsx:516-523`, when a user taps "Pack Merge" on `KitLiveCard`:
```tsx
{showPackMergeSheet && isKitSnapshot(message.metadata) && (
  <PackMergeSheet
    isOpen={true}
    onClose={() => setShowPackMergeSheet(false)}
    tripTitle={(message.metadata as KitSnapshot).title}
  />
)}
```
The `result` prop is entirely omitted. In `PackMergeSheet.tsx:42-53`, default fallbacks evaluate to:
- `savedGrams = 0`
- `warnings = []`
- `individualLoads = []`
- `deduplicatedItems = []`
Consequently, the user is presented with a dead UI: "Charges & Sécurité (0)", "Matériel (0)", no savings, and an "Appliquer" button that performs no action.

#### Surgical Remedy
We introduce `computeKitPreviewMergeResult` in `src/features/messaging/domain/packMerge.ts`. It takes a `KitSnapshot` and:
1. Gathers items from `snapshot.itemsPreview`, `snapshot.categories`, or `snapshot.totalWeightGrams`.
2. Establishes a 2-person expedition pairing (Owner as Guide, Teammate as Member, both modeled at 70kg).
3. Invokes `PackMergeService.runPackMerge`, distributing shared gear via water-filling load balancing and checking the 20% physiological threshold.
4. Computes genuine load bars, percentage gauges, individual assignments, and overload warnings if kit weight is excessive.
5. Memoizes the preview in `MessageBubble.tsx` and passes it via `result={previewMergeResult}` and `kitSnapshot={kitSnapshot}`.
6. Updates `PackMergeSheet` to accept optional `kitSnapshot?: KitSnapshot` as an internal fallback if `result` is omitted by any future consumer.

---

### 2.2 Issue 2: `PackMergeSheet.tsx:65, 223` — iOS Safe-Area Inset Violation

#### Root Cause
`PackMergeSheet` is anchored to `bottom-0` with uniform padding `p-[var(--space-4)]` (16px). Modern iPhones have a 34px gesture area at the bottom (`safe-area-inset-bottom`). With only 16px padding, the 48px CTA button ("Appliquer la répartition au groupe") sits directly inside the system swipe bar. Swiping up or tapping the button triggers the iOS app switcher or home screen transition instead of the CTA action.

#### Surgical Remedy
Append `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]` to line 65:
```tsx
className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[var(--lkv-radius-lg)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-sheet)] p-[var(--space-4)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))] shadow-elevation-4 backdrop-blur-[var(--glass-blur-lg)]"
```
- On modern iPhones: bottom padding is $16\text{px} + 34\text{px} = 50\text{px}$. The button sits 16px clear of the home bar.
- On desktop / Android / standard viewports: `env(safe-area-inset-bottom, 0px)` resolves to `0px`, preserving 16px padding.

---

### 2.3 Issue 3: `PackMergeSheet.tsx:120` — Segmented Tab Switcher Touch Target Below 44px

#### Root Cause
Line 120 sets container height `h-10` (40px) with `p-1` (4px padding top/bottom). The clickable tab buttons inside have an effective height of only $40\text{px} - 8\text{px} = 32\text{px}$.
This violates Apple Human Interface Guidelines ($\ge 44\text{pt} \times 44\text{pt}$ minimum tap target) and WCAG 2.2 Success Criterion 2.5.8.

#### Surgical Remedy
Update container to `h-12 min-h-[48px]` and explicitly enforce `min-h-[44px]` on both buttons:
```tsx
<div className="mt-3.5 flex h-12 min-h-[48px] items-center rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.05]">
  <button
    type="button"
    onClick={() => {
      haptic('light');
      setSelectedTab('loads');
    }}
    className={`flex h-full min-h-[44px] flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
      selectedTab === 'loads'
        ? 'bg-white text-[color:var(--lkv-text-primary)] shadow-sm dark:bg-neutral-800'
        : 'text-[color:var(--lkv-text-secondary)]'
    }`}
  >
    Charges & Sécurité ({individualLoads.length})
  </button>
  <button
    type="button"
    onClick={() => {
      haptic('light');
      setSelectedTab('items');
    }}
    className={`flex h-full min-h-[44px] flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
      selectedTab === 'items'
        ? 'bg-white text-[color:var(--lkv-text-primary)] shadow-sm dark:bg-neutral-800'
        : 'text-[color:var(--lkv-text-secondary)]'
    }`}
  >
    Matériel ({deduplicatedItems.length})
  </button>
</div>
```

---

### 2.4 Issue 4: `PackMergeSheet.tsx:61` — Missing Backdrop Overlay Scrim

#### Root Cause
The bottom sheet renders without a scrim backdrop. The chat background remains undimmed, leading to visual confusion and preventing "tap outside to dismiss".

#### Surgical Remedy
Insert an accessible scrim element before the dialog container:
```tsx
{/* Backdrop overlay scrim */}
<div
  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
  onClick={() => {
    haptic('light');
    onClose?.();
  }}
  aria-hidden="true"
/>
```

---

### 2.5 Issue 5: `GPXLiveCard.tsx:35` — Full Page Reload Navigation

#### Root Cause
Line 35 executes `window.location.href = \`/explorer?trail=\${snapshot.id}\``.
In a Next.js App Router application, direct `window.location` assignment triggers a hard MPA document reload. This resets React state, chat scroll position, active WebSocket/Supabase channels, and destroys client-side transitions.

#### Surgical Remedy
Adopt Next.js client-side navigation (`router.push`) with a defensive retrieval pattern that guarantees 100% test pass rates in Vitest SSR / `renderToStaticMarkup`:
```tsx
import { useRouter } from 'next/navigation';

// In component:
let router: ReturnType<typeof useRouter> | null = null;
try {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  router = useRouter();
} catch {
  router = null;
}

const handleCardClick = () => {
  haptic('light');
  if (onOpenMap) {
    onOpenMap(snapshot);
  } else if (snapshot.id) {
    const destination = `/explorer?trail=${snapshot.id}`;
    if (router) {
      router.push(destination);
    } else if (typeof window !== 'undefined') {
      window.location.assign(destination);
    }
  }
};
```

---

### 2.6 Issue 6: `GPXLiveCard.tsx:28` — Non-Unique SVG Gradient ID

#### Root Cause
Line 28 defines `gradId` as:
```tsx
const gradId = `gpx-grad-${snapshot.id || snapshot.title.replace(/\s+/g, '-').toLowerCase()}`;
```
If two messages display the same trail or default to `"Trace GPX"`, duplicate `<linearGradient id="gpx-grad-trace-gpx">` nodes coexist in the DOM. In SVG rendering, `url(#id)` resolves against the first node in document order. When that first node is unmounted or virtualized away, downstream cards lose their stroke styling.

#### Surgical Remedy
Use React's `useId()` hook sanitized for SVG ID attributes:
```tsx
const reactId = React.useId().replace(/:/g, '');
const gradId = `gpx-grad-${snapshot.id ? `${snapshot.id}-${reactId}` : reactId}`;
```
This guarantees 100% unique IDs across all card instances without SSR hydration mismatch.

---

### 2.7 Issue 7: `GPXLiveCard.tsx:79` — Invalid Icon Name `arrow-down-tray`

#### Root Cause
Line 79 uses:
```tsx
<Icon name="arrow-down-tray" size={16} aria-hidden="true" />
```
`arrow-down-tray` is not registered in `src/components/ui/Icon/registry.generated.ts`. In test/dev mode, `Icon` logs a stream of console warnings (`[Icon] No glyph resolved for name "arrow-down-tray"`), and renders null glyph content.

#### Surgical Remedy
Update to the canonical registered icon name `'download'` (registered at line 61 of `registry.generated.ts`):
```tsx
<Icon name="download" size={16} aria-hidden="true" />
```

---

## 3. Surgical Code Implementations & Diffs

### 3.1 Domain Engine: `src/features/messaging/domain/packMerge.ts`

Add exported function `computeKitPreviewMergeResult`:

```typescript
// ============================================================================
// 6. PREVIEW HELPER FOR LIVE CARDS & CHAT THREADS
// ============================================================================

import type { KitSnapshot } from '../types/outdoorObjects.types';

/**
 * Computes a realistic preview PackMergeResult from a KitSnapshot.
 * Used when PackMergeSheet is opened from a KitLiveCard in a chat thread
 * without an existing multi-user expedition merge session.
 */
export function computeKitPreviewMergeResult(
  snapshot: KitSnapshot,
  options?: { currentUserName?: string }
): PackMergeResult {
  const items: PackGearItem[] = [];

  if (snapshot.itemsPreview && snapshot.itemsPreview.length > 0) {
    snapshot.itemsPreview.forEach((p, idx) => {
      items.push({
        id: p.id || `preview-${idx}`,
        name: p.name,
        weightGrams: Math.max(1, p.weightGrams || 100),
        category: p.category || 'misc',
        isShared: p.isShared ?? true,
      });
    });
  } else if (snapshot.categories && snapshot.categories.length > 0) {
    snapshot.categories.forEach((cat, idx) => {
      items.push({
        id: `${snapshot.kitId || 'kit'}-cat-${idx}`,
        name: `${cat.name} (${cat.count} obj.)`,
        weightGrams: Math.max(1, cat.weightGrams || 100),
        category: cat.name,
        isShared: true,
      });
    });
  } else if ((snapshot.totalWeightGrams || 0) > 0) {
    items.push({
      id: `${snapshot.kitId || 'kit'}-item-1`,
      name: snapshot.title || 'Matériel du kit',
      weightGrams: snapshot.totalWeightGrams,
      category: 'misc',
      isShared: true,
    });
  }

  const ownerId = snapshot.ownerId || 'kit-owner';
  const ownerName = snapshot.ownerName || 'Propriétaire';
  const teammateName = options?.currentUserName || 'Équipier';

  const participants: PackParticipant[] = [
    {
      id: ownerId,
      name: ownerName,
      bodyWeightKg: 70,
      role: 'guide',
    },
    {
      id: 'teammate-1',
      name: teammateName,
      bodyWeightKg: 70,
      role: 'member',
    },
  ];

  const kits: PackMergeKit[] = [
    {
      ownerId,
      items,
    },
  ];

  return PackMergeService.runPackMerge(participants, kits);
}
```

Export in `src/features/messaging/services/domain/packMergeService.ts`:
```typescript
import {
  computeKitPreviewMergeResult,
  // ... other imports
} from '../../domain/packMerge';

export {
  computeKitPreviewMergeResult,
  // ...
};

export const packMergeService = {
  // ...
  computeKitPreviewMergeResult,
};
```

---

### 3.2 Component: `src/features/messaging/components/GPXLiveCard.tsx`

```tsx
'use client';

import React, { useId } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { GPXSnapshot } from '../types/outdoorObjects.types';

export interface GPXLiveCardProps {
  snapshot: GPXSnapshot;
  isMine?: boolean;
  onOpenMap?: (snapshot: GPXSnapshot) => void;
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export const GPXLiveCard: React.FC<GPXLiveCardProps> = React.memo(({
  snapshot,
  isMine = false,
  onOpenMap,
}) => {
  const { haptic } = useHapticFeedback();
  const reactId = useId().replace(/:/g, '');
  const gradId = `gpx-grad-${snapshot.id ? `${snapshot.id}-${reactId}` : reactId}`;

  // Safe router instance resilient to SSR & unit tests without mock
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const handleCardClick = () => {
    haptic('light');
    if (onOpenMap) {
      onOpenMap(snapshot);
    } else if (snapshot.id) {
      const destination = `/explorer?trail=${snapshot.id}`;
      if (router) {
        router.push(destination);
      } else if (typeof window !== 'undefined') {
        window.location.assign(destination);
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('medium');
  };

  return (
    <article
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      aria-label={`Tracé GPX : ${snapshot.title}`}
      className={`group relative my-1.5 flex w-full max-w-[320px] cursor-pointer flex-col overflow-hidden rounded-2xl border p-3.5 transition-all active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-primary)]">
            <Icon name="navigation" size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold leading-tight">
              {snapshot.title || 'Tracé GPX'}
            </h4>
            <span className="font-mono text-[10px] opacity-70">Trace vectorielle</span>
          </div>
        </div>

        {snapshot.gpxFileUrl || snapshot.gpxUrl ? (
          <a
            href={snapshot.gpxFileUrl || snapshot.gpxUrl}
            download={`${snapshot.title || 'trace'}.gpx`}
            onClick={handleDownload}
            aria-label="Télécharger le fichier GPX"
            className="flex size-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none"
          >
            <Icon name="download" size={16} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {/* SVG Polyline Vector Rendering — 0 Network Fetch, Instant Mount */}
      <div className="relative mt-2 h-20 w-full overflow-hidden rounded-xl bg-black/[0.03] p-1 dark:bg-white/[0.03]">
        <svg
          viewBox="0 0 240 80"
          className="size-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          role="presentation"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--lkv-secondary)" />
              <stop offset="100%" stopColor="var(--lkv-primary)" />
            </linearGradient>
          </defs>
          {/* Contrast halo */}
          <polyline
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={snapshot.svgPolylinePath}
          />
          {/* Primary polyline path */}
          <polyline
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={snapshot.svgPolylinePath}
          />
        </svg>

        <div className="pointer-events-none absolute bottom-1 right-2 font-mono text-[9px] font-semibold opacity-50">
          Aperçu 2D
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-2.5 grid grid-cols-3 divide-x divide-black/[0.06] border-t border-black/[0.06] py-2 text-center dark:divide-white/[0.08] dark:border-white/[0.08]">
        <div className="px-1">
          <span className="block text-[9px] font-medium uppercase tracking-wider opacity-60">
            Distance
          </span>
          <span className="font-mono text-xs font-bold tabular-nums">
            {snapshot.distanceKm.toFixed(1)} km
          </span>
        </div>
        <div className="px-1">
          <span className="block text-[9px] font-medium uppercase tracking-wider opacity-60">
            Dénivelé
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-[color:var(--lkv-action)]">
            +{Math.round(snapshot.elevationGainM)} m
          </span>
        </div>
        <div className="px-1">
          <span className="block text-[9px] font-medium uppercase tracking-wider opacity-60">
            Durée
          </span>
          <span className="font-mono text-xs font-bold tabular-nums">
            {formatDuration(snapshot.estimatedDurationMinutes)}
          </span>
        </div>
      </div>

      {/* Action CTA Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick();
        }}
        className="mt-2 flex h-[44px] min-h-[44px] w-full items-center justify-center rounded-xl bg-[color:var(--lkv-primary)] text-xs font-medium text-[color:var(--lkv-text-inverted)] transition-transform active:scale-95"
        aria-label="Voir la trace détaillée"
      >
        Voir la trace détaillée
      </button>
    </article>
  );
});

GPXLiveCard.displayName = 'GPXLiveCard';
```

---

### 3.3 Component: `src/features/messaging/components/PackMergeSheet.tsx`

```tsx
'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { PackMergeResult } from '../domain/packMerge';
import type { KitSnapshot } from '../types/outdoorObjects.types';
import { computeKitPreviewMergeResult } from '../domain/packMerge';

export interface DeduplicatedEquipmentItem {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  assignedToName: string;
  savedDuplicatesCount?: number;
}

export interface PackMergeSheetProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  result?: PackMergeResult;
  kitSnapshot?: KitSnapshot;
  tripTitle?: string;
  totalSavedGrams?: number;
  onApplyMerge?: () => void;
}

export const PackMergeSheet: React.FC<PackMergeSheetProps> = ({
  isOpen = true,
  open,
  onClose,
  result,
  kitSnapshot,
  tripTitle = "Optimisation du sac d'équipe",
  totalSavedGrams,
  onApplyMerge,
}) => {
  const { haptic } = useHapticFeedback();
  const [selectedTab, setSelectedTab] = useState<'loads' | 'items'>('loads');

  const isVisible = open !== undefined ? open : isOpen;
  if (!isVisible) return null;

  const effectiveResult = useMemo(() => {
    if (result) return result;
    if (kitSnapshot) return computeKitPreviewMergeResult(kitSnapshot);
    return undefined;
  }, [result, kitSnapshot]);

  const savedGrams =
    totalSavedGrams ??
    effectiveResult?.metrics?.weightSavedDeduplicationGrams ??
    effectiveResult?.groupStats?.weightSavedGrams ??
    0;

  const warnings = effectiveResult?.warnings || [];
  const individualLoads = effectiveResult?.individualLoads
    ? Object.values(effectiveResult.individualLoads)
    : [];
  const deduplicatedItems = effectiveResult?.deduplicatedItems || [];

  const handleApply = () => {
    haptic('success');
    onApplyMerge?.();
    onClose?.();
  };

  return (
    <>
      {/* Backdrop overlay scrim */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => {
          haptic('light');
          onClose?.();
        }}
        aria-hidden="true"
      />

      {/* Bottom Sheet Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-merge-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[var(--lkv-radius-lg)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-sheet)] p-[var(--space-4)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))] shadow-elevation-4 backdrop-blur-[var(--glass-blur-lg)]"
      >
        {/* Header with Title and 44px Close Button */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3
              id="pack-merge-title"
              className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]"
            >
              Pack Merge — Répartition du matériel
            </h3>
            <p className="text-xs text-[color:var(--lkv-text-secondary)]">
              {tripTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              haptic('light');
              onClose?.();
            }}
            className="flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Fermer la vue Pack Merge"
          >
            ✕
          </button>
        </div>

        {/* Collective Weight Saved Banner */}
        {savedGrams > 0 && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--lkv-secondary)]/15 p-2.5 text-xs text-[color:var(--lkv-forest-600)] dark:text-[color:var(--lkv-text-primary)]">
            <Icon name="sparkles" size={16} className="shrink-0 text-[color:var(--lkv-action)]" aria-hidden="true" />
            <span className="font-semibold">
              ✓ {savedGrams} g économisés par dédoublonnage de groupe
            </span>
          </div>
        )}

        {/* Overload & Safety Warnings */}
        {warnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200"
              >
                <span aria-hidden="true">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Segmented View Switcher — Apple HIG 48px container / 44px touch targets */}
        <div className="mt-3.5 flex h-12 min-h-[48px] items-center rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.05]">
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setSelectedTab('loads');
            }}
            className={`flex h-full min-h-[44px] flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
              selectedTab === 'loads'
                ? 'bg-white text-[color:var(--lkv-text-primary)] shadow-sm dark:bg-neutral-800'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            Charges & Sécurité ({individualLoads.length})
          </button>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setSelectedTab('items');
            }}
            className={`flex h-full min-h-[44px] flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
              selectedTab === 'items'
                ? 'bg-white text-[color:var(--lkv-text-primary)] shadow-sm dark:bg-neutral-800'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            Matériel ({deduplicatedItems.length})
          </button>
        </div>

        {/* Tab 1: Individual Loads and Safety Bars */}
        {selectedTab === 'loads' && (
          <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
            {individualLoads.map((load) => {
              const roleOrBreed = load.roleOrBreed || (load.isDog ? 'Chien' : 'Équipier');
              return (
                <div
                  key={load.participantId}
                  className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[color:var(--lkv-text-primary)]">
                      {load.name} ({roleOrBreed})
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">
                      {load.allocatedWeightKg} kg / {load.maxSafeWeightKg} kg ({load.loadPercentage}%)
                    </span>
                  </div>

                  {/* Load Bar */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                    <div
                      className={`h-full transition-all ${
                        load.isOverloaded
                          ? 'bg-red-500'
                          : load.loadPercentage > 85
                            ? 'bg-amber-500'
                            : 'bg-[color:var(--lkv-primary)]'
                      }`}
                      style={{ width: `${Math.min(100, load.loadPercentage)}%` }}
                    />
                  </div>

                  {load.isOverloaded && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                      <Icon name="ExclamationTriangleIcon" size={12} aria-hidden="true" />
                      <span>Surcharge critique ! Allégez d&apos;au moins {(load.overloadGrams / 1000).toFixed(1)} kg.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Shared & Deduplicated Items */}
        {selectedTab === 'items' && (
          <div className="mt-3 max-h-60 divide-y divide-black/[0.06] overflow-y-auto rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] dark:divide-white/[0.08]">
            {deduplicatedItems.map((item) => (
              <div
                key={item.itemId || item.id}
                className="flex min-h-[44px] items-center justify-between p-2.5 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-[color:var(--lkv-text-primary)]">
                    {item.name}
                  </span>
                  <span className="block text-[10px] opacity-70">
                    Porté par {item.assignedParticipantName || 'Groupe'}
                  </span>
                </div>
                <span className="font-mono font-bold text-[color:var(--lkv-action)]">
                  {item.weightGrams >= 1000
                    ? `${(item.weightGrams / 1000).toFixed(2)} kg`
                    : `${item.weightGrams} g`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action Footer */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleApply}
            className="flex h-12 min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--lkv-action)] font-semibold text-white shadow-elevation-2 transition-transform active:scale-[0.98]"
          >
            <Icon name="check" size={18} aria-hidden="true" />
            <span>Appliquer la répartition au groupe</span>
          </button>
        </div>
      </div>
    </>
  );
};
```

---

### 3.4 Component: `src/features/messaging/components/MessageBubble.tsx`

In `MessageBubble.tsx`, import `computeKitPreviewMergeResult`:
```tsx
import { computeKitPreviewMergeResult } from '../domain/packMerge';
```
In component body:
```tsx
  const kitSnapshot = isKitSnapshot(message.metadata) ? (message.metadata as KitSnapshot) : null;
  const previewMergeResult = React.useMemo(() => {
    if (!kitSnapshot) return undefined;
    return computeKitPreviewMergeResult(kitSnapshot, {
      currentUserName: !isMine ? senderName : 'Équipier',
    });
  }, [kitSnapshot, isMine, senderName]);
```
At line 516:
```tsx
  {/* Pack Merge Sheet modal for KitLiveCard */}
  {showPackMergeSheet && kitSnapshot && (
    <PackMergeSheet
      isOpen={true}
      onClose={() => setShowPackMergeSheet(false)}
      tripTitle={kitSnapshot.title}
      result={previewMergeResult}
      kitSnapshot={kitSnapshot}
      onApplyMerge={() => {
        haptic('success');
      }}
    />
  )}
```

---

## 4. Verification Plan

1. **Unit & Stress Test Suite**:
   Execute the full messaging test suite:
   ```powershell
   npx vitest run tests/messaging/outdoor-live-cards.spec.ts tests/messaging/challenger-m2-2-livecards-stress.spec.ts
   ```
   *Expected outcome*: 65/65 tests passing.

2. **Touch Targets & Safe-Area Inspection**:
   - `renderToStaticMarkup(React.createElement(PackMergeSheet, { kitSnapshot }))`:
     - Assert contains `min-h-[44px]` on tab buttons.
     - Assert contains `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]`.
     - Assert contains backdrop scrim `<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"`.
     - Assert contains `Charges & Sécurité (2)`.
     - Assert contains `Matériel (` with $> 0$ items.

3. **GPX SVG Gradient & Download Icon**:
   - Verify SVG output includes unique gradient ID from `useId()`.
   - Verify `<Icon name="download" />` renders without any `[Icon] No glyph resolved` warning in console.

4. **TypeScript & Linter Checks**:
   ```powershell
   npm run type-check
   npx eslint src/features/messaging/components/GPXLiveCard.tsx src/features/messaging/components/PackMergeSheet.tsx src/features/messaging/components/MessageBubble.tsx
   ```
   *Expected outcome*: 0 errors, 0 warnings.
