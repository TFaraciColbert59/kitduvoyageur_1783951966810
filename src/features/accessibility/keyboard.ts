/**
 * @fileoverview Navigation clavier carte/drawers, gestion du focus sans piège clavier
 * et restauration du focus à la fermeture des drawers (Lot O02).
 */

import type {
  FocusTrapController,
  FocusTrapOptions,
  MapKeyboardHandlers,
  MapPanDirection,
} from './types';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isElementVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hidden) return false;
  if (typeof el.closest === 'function' && el.closest('[aria-hidden="true"], [hidden], [inert]')) {
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
  }
  return true;
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter((el) => isElementVisible(el) && el.tabIndex >= 0);
}

function safeFocus(el: HTMLElement | null | undefined): void {
  if (!el || typeof el.focus !== 'function') return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    try {
      el.focus();
    } catch {
      // Ignore focus errors on detached nodes
    }
  }
}

export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): FocusTrapController {
  let active = false;
  let previouslyFocused: HTMLElement | null = null;
  let addedTabIndex = false;

  const doc = container.ownerDocument;

  function onKeyDown(event: KeyboardEvent): void {
    if (!active) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      options.onEscape?.();
      return;
    }

    if (event.key !== 'Tab' || options.allowTabExit) {
      return;
    }

    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      // Aucun enfant focalisable : on garde le focus sur le conteneur mais Escape reste actif (aucun piège).
      event.preventDefault();
      safeFocus(container);
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = doc.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (activeEl === first || !container.contains(activeEl)) {
        event.preventDefault();
        safeFocus(last);
      }
    } else if (activeEl === last || !container.contains(activeEl)) {
      event.preventDefault();
      safeFocus(first);
    }
  }

  function activate(): void {
    if (active) return;
    active = true;
    previouslyFocused =
      options.restoreFocusTo !== undefined
        ? options.restoreFocusTo
        : (doc.activeElement as HTMLElement | null);

    container.addEventListener('keydown', onKeyDown);

    const focusables = getFocusableElements(container);
    const target =
      options.initialFocus && container.contains(options.initialFocus)
        ? options.initialFocus
        : focusables[0];

    if (target) {
      safeFocus(target);
    } else {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
        addedTabIndex = true;
      }
      safeFocus(container);
    }
  }

  function deactivate(): void {
    if (!active) return;
    active = false;
    container.removeEventListener('keydown', onKeyDown);

    if (addedTabIndex) {
      container.removeAttribute('tabindex');
      addedTabIndex = false;
    }

    const restoreTarget =
      options.restoreFocusTo !== undefined ? options.restoreFocusTo : previouslyFocused;
    previouslyFocused = null;

    if (restoreTarget && restoreTarget.isConnected) {
      safeFocus(restoreTarget);
    }
  }

  return {
    activate,
    deactivate,
    isActive: () => active,
    getFocusableCount: () => getFocusableElements(container).length,
  };
}

export interface DrawerFocusEntry {
  id: string;
  restoreTarget: HTMLElement | null;
}

export interface DrawerFocusStack {
  push: (id: string, opener?: HTMLElement | null) => void;
  pop: (id?: string) => HTMLElement | null;
  peek: () => DrawerFocusEntry | undefined;
  size: () => number;
  clear: () => void;
}

/**
 * Pile de restauration de focus pour drawers imbriqués (parent -> sous-drawer -> retour parent).
 */
export function createDrawerFocusStack(
  doc: Document | null = typeof document !== 'undefined' ? document : null,
): DrawerFocusStack {
  const stack: DrawerFocusEntry[] = [];

  function push(id: string, opener?: HTMLElement | null): void {
    const existingIndex = stack.findIndex((entry) => entry.id === id);
    if (existingIndex !== -1) {
      stack.splice(existingIndex, 1);
    }
    const restoreTarget =
      opener !== undefined ? opener : ((doc?.activeElement as HTMLElement | null) ?? null);
    stack.push({ id, restoreTarget });
  }

  function pop(id?: string): HTMLElement | null {
    if (stack.length === 0) return null;
    let entry: DrawerFocusEntry | undefined;
    if (id !== undefined) {
      const idx = stack.findIndex((item) => item.id === id);
      if (idx === -1) return null;
      [entry] = stack.splice(idx, 1);
    } else {
      entry = stack.pop();
    }
    const target = entry?.restoreTarget ?? null;
    if (target && target.isConnected) {
      safeFocus(target);
      return target;
    }
    return null;
  }

  return {
    push,
    pop,
    peek: () => stack[stack.length - 1],
    size: () => stack.length,
    clear: () => {
      stack.length = 0;
    },
  };
}

const ARROW_TO_DIRECTION: Record<string, MapPanDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const DIRECTION_LABELS_FR: Record<MapPanDirection, string> = {
  up: 'nord',
  down: 'sud',
  left: 'ouest',
  right: 'est',
};

/**
 * Gestionnaire clavier pour la carte interactive.
 * Ne piège jamais Tab ; gère flèches (pan), +/- (zoom), Home/0 (recentrer), Enter/Space (sélection), Escape.
 */
export function handleMapKeyDown(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  handlers: MapKeyboardHandlers,
): boolean {
  const direction = ARROW_TO_DIRECTION[event.key];
  if (direction) {
    event.preventDefault();
    const stepMultiplier = event.shiftKey ? 2.5 : 1;
    handlers.onPan?.(direction, stepMultiplier);
    handlers.onAnnounce?.(`Carte déplacée vers le ${DIRECTION_LABELS_FR[direction]}`);
    return true;
  }

  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    handlers.onZoom?.(1);
    handlers.onAnnounce?.('Zoom avant');
    return true;
  }

  if (event.key === '-' || event.key === '_') {
    event.preventDefault();
    handlers.onZoom?.(-1);
    handlers.onAnnounce?.('Zoom arrière');
    return true;
  }

  if (event.key === 'Home' || event.key === '0') {
    event.preventDefault();
    handlers.onResetView?.();
    handlers.onAnnounce?.('Vue carte réinitialisée');
    return true;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handlers.onActivateSelection?.();
    return true;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    handlers.onEscape?.();
    handlers.onAnnounce?.('Sélection carte effacée');
    return true;
  }

  return false;
}

export function createMapKeyboardController(
  element: HTMLElement,
  handlers: MapKeyboardHandlers,
): () => void {
  const listener = (event: KeyboardEvent) => {
    handleMapKeyDown(event, handlers);
  };
  element.addEventListener('keydown', listener);
  return () => {
    element.removeEventListener('keydown', listener);
  };
}
