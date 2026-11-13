// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createDrawerFocusStack,
  createFocusTrap,
  getFocusableElements,
  handleMapKeyDown,
} from '../index';

describe('O02 keyboard navigation & drawer focus restoration', () => {
  it('lists only visible, enabled, non-negative tabindex focusable elements', () => {
    document.body.innerHTML = `
      <div id="drawer">
        <button id="btn-ok">OK</button>
        <button id="btn-disabled" disabled>Disabled</button>
        <a id="link-ok" href="#top">Top</a>
        <div id="hidden" aria-hidden="true"><button id="btn-hidden">Hidden</button></div>
        <div id="neg-tab" tabindex="-1">Neg</div>
      </div>
    `;
    const drawer = document.getElementById('drawer')!;
    const focusables = getFocusableElements(drawer);
    expect(focusables.map((el) => el.id)).toEqual(['btn-ok', 'link-ok']);
  });

  it('traps Tab within drawer without trapping Escape and restores focus on close', () => {
    document.body.innerHTML = `
      <button id="opener">Ouvrir</button>
      <div id="drawer" role="dialog" aria-modal="true">
        <button id="first">Premier</button>
        <button id="last">Dernier</button>
      </div>
    `;

    const opener = document.getElementById('opener')!;
    const drawer = document.getElementById('drawer')!;
    const first = document.getElementById('first')!;
    const last = document.getElementById('last')!;

    opener.focus();
    expect(document.activeElement).toBe(opener);

    const onEscape = vi.fn();
    const trap = createFocusTrap(drawer, { onEscape });
    trap.activate();
    expect(trap.isActive()).toBe(true);
    expect(document.activeElement).toBe(first);

    // Tab from last wraps to first
    last.focus();
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    // Shift+Tab from first wraps to last
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);

    // Escape triggers onEscape (no keyboard trap)
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);

    // Deactivate restores focus to opener
    trap.deactivate();
    expect(trap.isActive()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('restores parent drawer focus across nested drawer stack', () => {
    document.body.innerHTML = `
      <button id="page-trigger">Carte</button>
      <button id="parent-trigger">Abonnement</button>
    `;
    const pageTrigger = document.getElementById('page-trigger')!;
    const parentTrigger = document.getElementById('parent-trigger')!;

    const stack = createDrawerFocusStack(document);
    pageTrigger.focus();
    stack.push('parent-drawer');

    parentTrigger.focus();
    stack.push('child-drawer');
    expect(stack.size()).toBe(2);

    const restoredChild = stack.pop('child-drawer');
    expect(restoredChild).toBe(parentTrigger);
    expect(document.activeElement).toBe(parentTrigger);

    const restoredParent = stack.pop('parent-drawer');
    expect(restoredParent).toBe(pageTrigger);
    expect(document.activeElement).toBe(pageTrigger);
  });

  it('handles map keyboard navigation and never traps Tab', () => {
    const onPan = vi.fn();
    const onZoom = vi.fn();
    const onResetView = vi.fn();
    const onActivateSelection = vi.fn();
    const onEscape = vi.fn();
    const onAnnounce = vi.fn();

    const handlers = { onPan, onZoom, onResetView, onActivateSelection, onEscape, onAnnounce };

    expect(handleMapKeyDown({ key: 'ArrowUp', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onPan).toHaveBeenCalledWith('up', 1);

    expect(handleMapKeyDown({ key: 'ArrowRight', shiftKey: true, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onPan).toHaveBeenCalledWith('right', 2.5);

    expect(handleMapKeyDown({ key: '+', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onZoom).toHaveBeenCalledWith(1);

    expect(handleMapKeyDown({ key: '-', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onZoom).toHaveBeenCalledWith(-1);

    expect(handleMapKeyDown({ key: 'Home', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onResetView).toHaveBeenCalledTimes(1);

    expect(handleMapKeyDown({ key: 'Enter', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onActivateSelection).toHaveBeenCalledTimes(1);

    expect(handleMapKeyDown({ key: 'Escape', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);

    // Tab must not be intercepted
    expect(handleMapKeyDown({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() }, handlers)).toBe(false);
  });
});
