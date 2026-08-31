# Mobile UX Architecture (Focus Terrain & Sac) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Apple iOS 18 native mobile experience for LKDV equipment preparation and trail usage, featuring an Apple Health weight header, Apple Reminders swipe-to-pack items with 48px touch targets, a floating Liquid Island bottom controller, retractable vital safety alerts, and an OLED pure black battery eco mode.

**Architecture:** A dedicated mobile sub-module in `src/features/materiel/components/mobile/` composed of 4 focused, highly testable components (`MobileWeightHeader`, `MobileChecklistItem`, `MobileFloatingIsland`, `MobileVitalAlertBanner`) orchestrating state with `DepartCockpit` and the offline sync engine.

**Tech Stack:** React 19, Next.js 15, TypeScript 5, Tailwind CSS, Framer Motion, Lucide React, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-31-mobile-ux-architecture-design.md](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/docs/superpowers/specs/2026-08-31-mobile-ux-architecture-design.md)

## Global Constraints

- Touch targets must be >= 48x48px across all interactive mobile elements.
- Gestures must support touch and mouse drag with spring physics without blocking vertical page scroll.
- Zero TypeScript errors with strict checking (`npm run type-check`).
- 100% test pass rate with Vitest (`npm test`).
- Haptic feedback must gracefully fall back when `navigator.vibrate` is not supported.

---

### Task 1: Mobile Weight & Progress Header (Apple Health Style)

**Files:**
- Create: `src/features/materiel/components/mobile/MobileWeightHeader.tsx`
- Test: `tests/materiel/mobile-weight-header.spec.ts`

**Interfaces:**
- Produces: `export function MobileWeightHeader(props: MobileWeightHeaderProps): JSX.Element`
  - `readinessPercentage: number`
  - `baseWeightG: number`
  - `wornWeightG: number`
  - `consumablesWeightG: number`
  - `onOpenDetails?: () => void`


- [ ] **Step 1: Write the failing unit test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement MobileWeightHeader component**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Apple Reminders Style Checklist Item with Swipe-to-Pack

**Files:**
- Create: `src/features/materiel/components/mobile/MobileChecklistItem.tsx`
- Test: `tests/materiel/mobile-checklist-item.spec.ts`

**Interfaces:**
- Produces: `export function MobileChecklistItem(props: MobileChecklistItemProps): JSX.Element`
  - `item: ChecklistItem`
  - `onToggle: (item: ChecklistItem) => void`
  - `onDelete?: (item: ChecklistItem) => void`
  - `isHighlighted?: boolean`

- [ ] **Step 1: Write the failing unit test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement MobileChecklistItem with 48px hit-box, SF Pro typography and swipe-to-pack**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: Floating Bottom Capsule (« Liquid Island »)

**Files:**
- Create: `src/features/materiel/components/mobile/MobileFloatingIsland.tsx`
- Test: `tests/materiel/mobile-floating-island.spec.ts`

**Interfaces:**
- Produces: `export function MobileFloatingIsland(props: MobileFloatingIslandProps): JSX.Element`
  - `totalCount: number`
  - `remainingCount: number`
  - `filterMode: 'all' | 'remaining'`
  - `onFilterChange: (mode: 'all' | 'remaining') => void`
  - `isSpeaking: boolean`
  - `onToggleSpeak: () => void`
  - `onQuickAdd: () => void`

- [ ] **Step 1: Write the failing unit test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement MobileFloatingIsland with safe-area spacing and scroll-aware contraction**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 4: Retractable Vital Safety Notification Banner

**Files:**
- Create: `src/features/materiel/components/mobile/MobileVitalAlertBanner.tsx`
- Test: `tests/materiel/mobile-vital-alert.spec.ts`

**Interfaces:**
- Produces: `export function MobileVitalAlertBanner(props: MobileVitalAlertBannerProps): JSX.Element`
  - `alerts: ActionableAlert[]`
  - `onAction: (alert: ActionableAlert) => void`

- [ ] **Step 1: Write the failing unit test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement MobileVitalAlertBanner with iOS notification ergonomics**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 5: Mobile Cockpit Integration & OLED Ultra-Save Mode

**Files:**
- Modify: `src/features/materiel/components/depart/DepartCockpit.tsx`
- Modify: `src/features/materiel/components/depart/DepartChecklist.tsx`
- Test: `tests/mobile-layout.spec.ts`

**Interfaces:**
- Integrate all 4 mobile components into `DepartCockpit` mobile render path (`< 768px`).
- Apply OLED pure black mode (`#000000`, no GPU blur) when `isUltraSave` is active.

- [ ] **Step 1: Update mobile layout tests**
- [ ] **Step 2: Integrate mobile components and OLED mode into DepartCockpit**
- [ ] **Step 3: Run full typecheck and test suite**
- [ ] **Step 4: Commit**
