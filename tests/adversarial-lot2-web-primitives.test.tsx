// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 1. Sheet & Drawer imports
import { Sheet, type SheetSnap, type SheetDetent } from '@/components/ui/Sheet';
import DrawerShellDirect, {
  DrawerEmpty as DrawerEmptyDirect,
  DrawerError as DrawerErrorDirect,
  DrawerSkeleton as DrawerSkeletonDirect,
  DRAWER_SHELL_CSS as DRAWER_SHELL_CSS_DIRECT,
} from '@/components/ui/drawer/DrawerShell';
import DrawerShellCompte, {
  DrawerEmpty as DrawerEmptyCompte,
  DrawerError as DrawerErrorCompte,
  DrawerSkeleton as DrawerSkeletonCompte,
  DRAWER_SHELL_CSS as DRAWER_SHELL_CSS_COMPTE,
} from '@/components/compte/drawer/shell/DrawerShell';

// 2. SegmentedControl & Tabs imports
import { SegmentedControl, type SegmentedControlItem } from '@/components/ui/SegmentedControl';
import { CapsuleTabs, SubCapsuleTabs } from '@/components/ui/CapsuleTabs';
import { SubTabBar } from '@/components/ui/SubTabBar';
import { Tabs } from '@/components/ui/Tabs';

// 3. Dynamic Island imports
import {
  showDynamicIsland,
  dismissDynamicIsland,
  onDynamicIsland,
  type DynamicIslandEvent,
} from '@/lib/dynamic-island';
import { DynamicIslandHost } from '@/components/ui/DynamicIslandHost';

// 4. ToastHost & dialogs imports
import { ToastHost } from '@/components/ui/ToastHost';
import { lkvAlert, emitToast, subscribeToast, type ToastItem } from '@/components/ui/dialogs';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  dismissDynamicIsland();
});

// ============================================================================
// SUITE 1: Sheet & Drawer Snap System Stress Tests
// ============================================================================
describe('Adversarial Stress Test: Unified Sheet 3-Snap System', () => {
  it('correctly maps 3 canonical snaps (collapsed, half, expanded) to height classes', () => {
    const snaps: Array<[SheetSnap, string]> = [
      ['collapsed', 'h-[18dvh]'],
      ['half', 'h-[55dvh]'],
      ['expanded', 'h-[90dvh]'],
    ];

    for (const [snapValue, expectedClass] of snaps) {
      const { unmount } = render(
        <Sheet open onOpenChange={() => {}} title={`Sheet ${snapValue}`} snap={snapValue}>
          <div>Content {snapValue}</div>
        </Sheet>
      );

      const dialogContent = document.querySelector('[role="dialog"]');
      expect(dialogContent).not.toBeNull();
      expect(dialogContent?.className).toContain(expectedClass);
      unmount();
    }
  });

  it('preserves backward compatibility with legacy detents (auto, medium, large)', () => {
    const detents: Array<[SheetDetent, string]> = [
      ['auto', ''],
      ['medium', 'h-[55dvh]'],
      ['large', 'h-[90dvh]'],
    ];

    for (const [detentValue, expectedClass] of detents) {
      const { unmount } = render(
        <Sheet open onOpenChange={() => {}} title={`Detent ${detentValue}`} detent={detentValue}>
          <div>Content {detentValue}</div>
        </Sheet>
      );

      const dialogContent = document.querySelector('[role="dialog"]');
      expect(dialogContent).not.toBeNull();
      if (expectedClass) {
        expect(dialogContent?.className).toContain(expectedClass);
      } else {
        expect(dialogContent?.className).not.toContain('h-[');
      }
      unmount();
    }
  });

  it('snap prop strictly overrides detent prop when both are provided', () => {
    const { unmount } = render(
      <Sheet
        open
        onOpenChange={() => {}}
        title="Override Test"
        detent="collapsed"
        snap="expanded"
      >
        <div>Controlled snap precedence</div>
      </Sheet>
    );

    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent?.className).toContain('h-[90dvh]');
    expect(dialogContent?.className).not.toContain('h-[18dvh]');
    unmount();
  });

  it('handles unknown or invalid snap values gracefully without throwing', () => {
    const { unmount } = render(
      <Sheet
        open
        onOpenChange={() => {}}
        title="Invalid Snap"
        snap={'invalid-custom-snap' as any}
      >
        <div>Invalid snap content</div>
      </Sheet>
    );

    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent).not.toBeNull();
    // Invalids fallback to no height class without exploding
    expect(dialogContent?.className).not.toContain('h-[');
    unmount();
  });

  it('survives rapid controlled snap switching under stress', () => {
    function SnapHarness() {
      const [snap, setSnap] = useState<SheetSnap>('collapsed');
      return (
        <div>
          <button data-testid="to-collapsed" onClick={() => setSnap('collapsed')}>Collapsed</button>
          <button data-testid="to-half" onClick={() => setSnap('half')}>Half</button>
          <button data-testid="to-expanded" onClick={() => setSnap('expanded')}>Expanded</button>
          <Sheet open onOpenChange={() => {}} title="Rapid Snap" snap={snap}>
            <div data-testid="sheet-inner">Current: {snap}</div>
          </Sheet>
        </div>
      );
    }

    render(<SnapHarness />);
    const dialogContent = () => document.querySelector('[role="dialog"]');

    expect(dialogContent()?.className).toContain('h-[18dvh]');

    // Rapid cycling 50 times
    for (let i = 0; i < 50; i++) {
      fireEvent.click(screen.getByTestId('to-half'));
      expect(dialogContent()?.className).toContain('h-[55dvh]');

      fireEvent.click(screen.getByTestId('to-expanded'));
      expect(dialogContent()?.className).toContain('h-[90dvh]');

      fireEvent.click(screen.getByTestId('to-collapsed'));
      expect(dialogContent()?.className).toContain('h-[18dvh]');
    }

    expect(screen.getByTestId('sheet-inner').textContent).toBe('Current: collapsed');
  });

  it('dragToDismiss triggers onOpenChange(false) when dragged beyond 25% height threshold', () => {
    const onOpenChange = vi.fn();

    // Polyfill PointerEvent in jsdom if missing
    if (typeof window.PointerEvent === 'undefined') {
      window.PointerEvent = class PointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, params: any = {}) {
          super(type, params);
          this.pointerId = params.pointerId ?? 0;
        }
      } as any;
    }

    // Mock matchMedia so prefersReducedMotion returns false
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // Mock HTMLElement.prototype.offsetHeight so all elements in jsdom have a non-zero height
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() { return 400; },
    });

    render(
      <Sheet open onOpenChange={onOpenChange} title="Drag Sheet" dragToDismiss>
        <div>Draggable content</div>
      </Sheet>
    );

    const handle = document.querySelector('.cursor-grab') as HTMLElement;
    expect(handle).not.toBeNull();

    // Drag down 150px (which is > 400 * 0.25 = 100px)
    fireEvent(handle, new PointerEvent('pointerdown', { clientY: 100, pointerId: 1, bubbles: true }));
    fireEvent(handle, new PointerEvent('pointermove', { clientY: 250, pointerId: 1, bubbles: true }));
    fireEvent(handle, new PointerEvent('pointerup', { clientY: 250, pointerId: 1, bubbles: true }));

    expect(onOpenChange).toHaveBeenCalledWith(false);

    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    }
  });

  it('dragToDismiss does NOT dismiss when dragged under 25% threshold', () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Drag Sheet Small" dragToDismiss>
        <div>Draggable content</div>
      </Sheet>
    );

    const handle = document.querySelector('[aria-hidden="true"].flex.shrink-0');
    const panel = handle?.parentElement as HTMLElement;
    Object.defineProperty(panel, 'offsetHeight', { value: 400, configurable: true });

    // Drag down 50px (< 100px threshold)
    fireEvent.pointerDown(handle!, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle!, { clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(handle!, { clientY: 150, pointerId: 1 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('non-dismissible sheet blocks escape key dismissal', () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Strict Sheet" dismissible={false}>
        <div>Strict content</div>
      </Sheet>
    );

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // Escape should be prevented
    fireEvent.keyDown(dialog!, { key: 'Escape', code: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SUITE 2: DrawerShell Re-export Integrity & CSS Classes
// ============================================================================
describe('Adversarial Stress Test: DrawerShell Re-export Integrity', () => {
  it('confirms 100% referential equality of all exports between ui and compte', () => {
    expect(DrawerShellCompte).toBe(DrawerShellDirect);
    expect(DrawerSkeletonCompte).toBe(DrawerSkeletonDirect);
    expect(DrawerErrorCompte).toBe(DrawerErrorDirect);
    expect(DrawerEmptyCompte).toBe(DrawerEmptyDirect);
    expect(DRAWER_SHELL_CSS_COMPTE).toBe(DRAWER_SHELL_CSS_DIRECT);
  });

  it('verifies DRAWER_SHELL_CSS contains required selectors and design tokens', () => {
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('.lkdv-drawer-shell');
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('.sel-lens');
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('.lkdv-drawer-pane');
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('.lkdv-drawer-secondary');
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('prefers-reduced-motion');
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('--label:#172B24');
    expect(DRAWER_SHELL_CSS_DIRECT).toContain('--ink:#17402C');
  });

  it('DrawerError supports optional custom label and retry button', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DrawerErrorCompte onRetry={onRetry} label="Erreur réseau personnalisée" />);

    expect(screen.getByRole('alert').textContent).toContain('Erreur réseau personnalisée');
    const retryBtn = screen.getByRole('button', { name: 'Réessayer' });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Default label when omitted
    rerender(<DrawerErrorCompte />);
    expect(screen.getByRole('alert').textContent).toContain('Impossible de charger ce contenu.');
  });

  it('DrawerShell handles out-of-bound activeIndex safely', () => {
    const tabs = [
      { id: 't1', label: 'T1', icon: <span>1</span>, render: () => <div>Pane 1</div> },
      { id: 't2', label: 'T2', icon: <span>2</span>, render: () => <div>Pane 2</div> },
    ];

    // activeIndex 99 (beyond length)
    const { rerender } = render(
      <DrawerShellCompte tabs={tabs} activeIndex={99} onIndexChange={() => {}} />
    );

    const tabElements = screen.getAllByRole('tab');
    expect(tabElements).toHaveLength(2);
    // Should clamp to index 1 (safeIndex)
    expect(tabElements[1].getAttribute('aria-selected')).toBe('true');

    // activeIndex -5 (below 0)
    rerender(<DrawerShellCompte tabs={tabs} activeIndex={-5} onIndexChange={() => {}} />);
    const updatedTabs = screen.getAllByRole('tab');
    expect(updatedTabs[0].getAttribute('aria-selected')).toBe('true');
  });
});

// ============================================================================
// SUITE 3: SegmentedControl & Tabs System Keyboard, ARIA, & Tokens
// ============================================================================
describe('Adversarial Stress Test: SegmentedControl, Tabs, and CapsuleTabs', () => {
  const items: SegmentedControlItem[] = [
    { id: 'opt1', label: 'Option 1', icon: <span>A</span> },
    { id: 'opt2', label: 'Option 2', icon: <span>B</span>, badge: 3 },
    { id: 'opt3', label: 'Option 3', icon: <span>C</span> },
  ];

  it('complies with WAI-ARIA tablist/tab pattern, roving tabIndex, and aria-selected', () => {
    render(
      <SegmentedControl
        items={items}
        activeIndex={1}
        ariaLabel="Paramètres de vue"
        idFor={(id) => `tab-${id}`}
        panelIdFor={(id) => `panel-${id}`}
      />
    );

    const tablist = screen.getByRole('tablist', { name: 'Paramètres de vue' });
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    // Only active tab has tabIndex 0 and aria-selected true
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[0].getAttribute('aria-controls')).toBeNull();

    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-controls')).toBe('panel-opt2');

    expect(tabs[2].getAttribute('tabindex')).toBe('-1');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
    expect(tabs[2].getAttribute('aria-controls')).toBeNull();
  });

  it('supports full keyboard navigation (ArrowRight, ArrowLeft, Home, End) with circular wrap', () => {
    const onIndexChange = vi.fn();
    const onChange = vi.fn();

    function ControlledSegmentedControl() {
      const [activeIndex, setActiveIndex] = useState(0);
      return (
        <SegmentedControl
          items={items}
          activeIndex={activeIndex}
          onIndexChange={(i) => {
            setActiveIndex(i);
            onIndexChange(i);
          }}
          onChange={onChange}
          ariaLabel="Navigation clavier"
        />
      );
    }

    render(<ControlledSegmentedControl />);

    const tablist = screen.getByRole('tablist');

    // ArrowRight: 0 -> 1
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(onChange).toHaveBeenLastCalledWith('opt2');

    // ArrowRight: 1 -> 2
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(onChange).toHaveBeenLastCalledWith('opt3');

    // ArrowRight from 2 wraps to 0
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    expect(onChange).toHaveBeenLastCalledWith('opt1');

    // ArrowLeft from 0 wraps to 2
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(onChange).toHaveBeenLastCalledWith('opt3');

    // Home goes to 0
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    expect(onChange).toHaveBeenLastCalledWith('opt1');

    // End goes to 2
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(onChange).toHaveBeenLastCalledWith('opt3');
  });

  it('clicking active tab is idempotent and does not fire spurious change callbacks', () => {
    const onIndexChange = vi.fn();
    const onChange = vi.fn();

    render(
      <SegmentedControl
        items={items}
        activeIndex={1}
        onIndexChange={onIndexChange}
        onChange={onChange}
        ariaLabel="Idempotence"
      />
    );

    const tabs = screen.getAllByRole('tab');
    // Click active tab (index 1)
    fireEvent.click(tabs[1]);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    // Click inactive tab (index 2)
    fireEvent.click(tabs[2]);
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(onChange).toHaveBeenCalledWith('opt3');
  });

  it('handles empty items without errors', () => {
    const { container } = render(
      <SegmentedControl items={[]} ariaLabel="Vide" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('controlled by value prop correctly identifies index', () => {
    const onIndexChange = vi.fn();
    render(
      <SegmentedControl
        items={items}
        value="opt3"
        onIndexChange={onIndexChange}
        ariaLabel="Valeur string"
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('CapsuleTabs and SubCapsuleTabs delegate seamlessly to SegmentedControl', () => {
    const { container: c1 } = render(
      <CapsuleTabs items={items} activeIndex={0} ariaLabel="Capsule Principale" />
    );
    const tablist1 = screen.getByRole('tablist', { name: 'Capsule Principale' });
    expect(tablist1.className).toContain('segc');
    expect(tablist1.className).toContain('lg-tabs');
    expect(tablist1.className).toContain('lens-on');
    expect(c1.querySelector('.sel-lens')).not.toBeNull();

    cleanup();

    const { container: c2 } = render(
      <SubCapsuleTabs items={items} activeIndex={0} ariaLabel="Sous Capsule" />
    );
    const tablist2 = screen.getByRole('tablist', { name: 'Sous Capsule' });
    expect(tablist2.className).toContain('lkdv-lens-float');
    expect(c2.querySelector('.ig-th.lens')).not.toBeNull();
  });

  it('SubTabBar maps items and uses sm size with labels', () => {
    const subTabs = [
      { id: 'sub1', label: 'Général' },
      { id: 'sub2', label: 'Détails' },
    ];
    render(
      <SubTabBar tabs={subTabs} activeTab="sub1" onTabChange={() => {}} />
    );

    const tablist = screen.getByRole('tablist', { name: 'Navigation secondaire' });
    expect(tablist.className).toContain('lkdv-lens-float');
    expect(screen.getByText('Général')).not.toBeNull();
    expect(screen.getByText('Détails')).not.toBeNull();
  });

  it('Tabs component maintains design governance token classes (bg-[var(--g1-bg)], min-h-[var(--lkv-touch-min)])', () => {
    const options = [
      { id: 'all', label: 'Tous' },
      { id: 'active', label: 'Actifs' },
    ];

    const { rerender } = render(
      <Tabs options={options} value="all" onChange={() => {}} variant="segmented" />
    );

    const segmentedContainer = screen.getByRole('tablist');
    expect(segmentedContainer.className).toContain('bg-[var(--g1-bg)]');
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].className).toContain('min-h-[var(--lkv-touch-min)]');
    expect(tabs[0].className).toContain('bg-[var(--g3-bg)]'); // active tab in Tabs.tsx

    // Test scrollable variant
    rerender(<Tabs options={options} value="all" onChange={() => {}} variant="scrollable" />);
    const scrollableTabs = screen.getAllByRole('tab');
    expect(scrollableTabs[0].className).toContain('min-h-[var(--lkv-touch-min)]');
    expect(scrollableTabs[0].className).toContain('bg-[var(--g3-bg)]');
    expect(scrollableTabs[1].className).toContain('bg-[var(--g2-bg)]');
  });
});

// ============================================================================
// SUITE 4: Dynamic Island Host & Dispatcher
// ============================================================================
describe('Adversarial Stress Test: Dynamic Island Dispatcher & Host', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('showDynamicIsland dispatches event, returns ID, and notifies subscribers', () => {
    const listener = vi.fn();
    const unsub = onDynamicIsland(listener);

    // Initial call on subscribe gives currentEvent (null)
    expect(listener).toHaveBeenCalledWith(null);

    let eventId = '';
    act(() => {
      eventId = showDynamicIsland({
        title: 'Sortie en cours',
        subtitle: '12.4 km • 450 m D+',
        variant: 'expanded',
      });
    });

    expect(eventId).toBeTruthy();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: eventId,
        title: 'Sortie en cours',
        durationMs: 3800,
      })
    );

    unsub();
  });

  it('dismissDynamicIsland only dismisses matching ID if provided', () => {
    const listener = vi.fn();
    const unsub = onDynamicIsland(listener);

    let id1 = '';
    act(() => {
      id1 = showDynamicIsland({ title: 'Alerte 1' });
    });

    // Dismiss with non-matching ID -> should NOT dismiss
    act(() => {
      dismissDynamicIsland('wrong-id');
    });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ id: id1 }));

    // Dismiss with correct ID -> should dismiss
    act(() => {
      dismissDynamicIsland(id1);
    });
    expect(listener).toHaveBeenLastCalledWith(null);

    unsub();
  });

  it('DynamicIslandHost auto-dismisses after durationMs', () => {
    render(<DynamicIslandHost />);
    expect(document.querySelector('aside[aria-label="Notification île dynamique"]')).toBeNull();

    act(() => {
      showDynamicIsland({
        title: 'Waypoint atteint',
        durationMs: 2500,
      });
    });

    expect(screen.getByText('Waypoint atteint')).not.toBeNull();

    // Advance time by 2400ms (not yet dismissed)
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText('Waypoint atteint')).not.toBeNull();

    // Advance remaining 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.querySelector('aside[aria-label="Notification île dynamique"]')).toBeNull();
  });

  it('hover/pointerEnter pauses auto-dismiss and pointerLeave resumes', () => {
    render(<DynamicIslandHost />);

    act(() => {
      showDynamicIsland({
        title: 'Pause Test',
        durationMs: 2000,
      });
    });

    const statusContainer = screen.getByRole('status');

    // Advance by 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Pointer enter (pause)
    fireEvent.pointerEnter(statusContainer);

    // Advance by 5000ms while paused
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Still visible!
    expect(screen.getByText('Pause Test')).not.toBeNull();

    // Pointer leave (resume timer for duration)
    fireEvent.pointerLeave(statusContainer);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Dismissed after resume duration
    expect(screen.queryByText('Pause Test')).toBeNull();
  });

  it('action and undo buttons invoke callbacks and dismiss island', () => {
    const onAction = vi.fn();
    const onUndo = vi.fn();

    render(<DynamicIslandHost />);

    act(() => {
      showDynamicIsland({
        title: 'Trace sauvegardée',
        action: { label: 'Voir', onAction },
        undo: { label: 'Annuler', onUndo },
      });
    });

    const undoBtn = screen.getByRole('button', { name: 'Annuler' });
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Trace sauvegardée')).toBeNull();

    // Test action
    act(() => {
      showDynamicIsland({
        title: 'Deuxième trace',
        action: { label: 'Consulter', onAction },
      });
    });

    const actionBtn = screen.getByRole('button', { name: 'Consulter' });
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deuxième trace')).toBeNull();
  });
});

// ============================================================================
// SUITE 5: ToastHost Stacking & Eradication of react-hot-toast
// ============================================================================
describe('Adversarial Stress Test: ToastHost Stacking & Zero react-hot-toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ToastHost clamps concurrent toasts to max 3 items under rapid fire', () => {
    render(<ToastHost />);
    expect(document.querySelector('aside[aria-label="Zone de notifications"]')).toBeNull();

    // Emit 20 toasts rapidly
    act(() => {
      for (let i = 1; i <= 20; i++) {
        emitToast({
          id: `toast-${i}`,
          message: `Notification numéro ${i}`,
          durationMs: 5000,
        });
      }
    });

    const toastElements = screen.getAllByRole('status');
    // Must be clamped to at most 3
    expect(toastElements).toHaveLength(3);
    expect(screen.getByText('Notification numéro 18')).not.toBeNull();
    expect(screen.getByText('Notification numéro 19')).not.toBeNull();
    expect(screen.getByText('Notification numéro 20')).not.toBeNull();
    // Older toasts discarded from queue
    expect(screen.queryByText('Notification numéro 1')).toBeNull();
  });

  it('toasts auto-dismiss individually after their respective durations', () => {
    render(<ToastHost />);

    act(() => {
      emitToast({ id: 't1', message: 'Court', durationMs: 1000 });
      emitToast({ id: 't2', message: 'Long', durationMs: 3000 });
    });

    expect(screen.getByText('Court')).not.toBeNull();
    expect(screen.getByText('Long')).not.toBeNull();

    // Advance 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Court')).toBeNull();
    expect(screen.getByText('Long')).not.toBeNull();

    // Advance 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('Long')).toBeNull();
  });

  it('manual dismiss button removes the targeted toast', () => {
    render(<ToastHost />);

    act(() => {
      emitToast({ id: 'dismiss-me', message: 'À fermer manuellement' });
    });

    const closeBtn = screen.getByRole('button', { name: 'Fermer la notification' });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('À fermer manuellement')).toBeNull();
  });

  it('lkvAlert dispatches toasts with appropriate tone on Web', () => {
    const subscriber = vi.fn();
    const unsub = subscribeToast(subscriber);

    lkvAlert('Sauvegarde réussie !', { title: 'Succès', tone: 'success' });

    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Succès',
        message: 'Sauvegarde réussie !',
        tone: 'success',
        durationMs: 4000,
      })
    );

    unsub();
  });
});

// ============================================================================
// SUITE 6: Circular Dependency & Import Isolation Static Analysis
// ============================================================================
describe('Adversarial Stress Test: Circular Dependencies & Import Graph', () => {
  it('confirms zero circular dependencies across unified web primitives', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const rootDir = path.resolve(__dirname, '..');
    const targetFiles = [
      'src/components/ui/Sheet.tsx',
      'src/components/ui/drawer/DrawerShell.tsx',
      'src/components/compte/drawer/shell/DrawerShell.tsx',
      'src/components/ui/SegmentedControl.tsx',
      'src/components/ui/Tabs.tsx',
      'src/components/ui/CapsuleTabs.tsx',
      'src/components/ui/SubTabBar.tsx',
      'src/components/ui/DynamicIslandHost.tsx',
      'src/components/ui/ToastHost.tsx',
      'src/components/ui/dialogs.ts',
      'src/lib/dynamic-island.ts',
    ];

    function extractImports(filePath: string): string[] {
      const fullPath = path.resolve(rootDir, filePath);
      if (!fs.existsSync(fullPath)) return [];
      const rawContent = fs.readFileSync(fullPath, 'utf-8');
      // Strip comments to avoid false matches in comment text
      const cleanContent = rawContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const importRegex = /(?:import|export)\s+(?:.*?from\s+)?['"](.*?)['"]/g;
      const results: string[] = [];
      let match;
      while ((match = importRegex.exec(cleanContent)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('@/') || importPath.startsWith('.')) {
          let resolved = importPath.startsWith('@/')
            ? path.join('src', importPath.slice(2))
            : path.relative(rootDir, path.resolve(path.dirname(fullPath), importPath));

          // Try extensions
          for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
            const candidate = path.resolve(rootDir, resolved + ext);
            if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
              results.push(path.relative(rootDir, candidate));
              break;
            }
          }
        }
      }
      return results;
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    function checkCycle(node: string, currentPath: string[]) {
      visited.add(node);
      recStack.add(node);

      const neighbors = extractImports(node);
      for (const neighbor of neighbors) {
        if (!targetFiles.includes(neighbor) && !neighbor.startsWith('src/components/ui/')) {
          continue;
        }
        if (!visited.has(neighbor)) {
          checkCycle(neighbor, [...currentPath, neighbor]);
        } else if (recStack.has(neighbor)) {
          cycles.push([...currentPath, neighbor]);
        }
      }

      recStack.delete(node);
    }

    for (const file of targetFiles) {
      if (!visited.has(file)) {
        checkCycle(file, [file]);
      }
    }

    expect(cycles).toEqual([]);
  });

  it('verifies that no source file in src/ imports react-hot-toast', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rootDir = path.resolve(__dirname, '..');

    function scanDir(dir: string): string[] {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanDir(full));
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(full);
        }
      }
      return files;
    }

    const allSourceFiles = scanDir(path.join(rootDir, 'src'));
    const offendingFiles: string[] = [];

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('react-hot-toast')) {
        offendingFiles.push(path.relative(rootDir, file));
      }
    }

    expect(offendingFiles).toEqual([]);
  });
});

