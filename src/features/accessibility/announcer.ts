/**
 * @fileoverview Annonceur ARIA live-region pour VoiceOver / TalkBack (Lot O02).
 * Gère les régions polite & assertive, la déduplication, le nettoyage automatique
 * et le formatage sémantique des labels carte / itinéraire / drawer.
 */

import type {
  AnnouncementOptions,
  AnnouncementRecord,
  AriaLivePoliteness,
  ScreenReaderAnnouncer,
} from './types';

const DEFAULT_DEDUPE_WINDOW_MS = 400;
const DEFAULT_CLEAR_AFTER_MS = 5000;
const MAX_HISTORY = 50;

const SR_ONLY_STYLE = [
  'position: absolute',
  'width: 1px',
  'height: 1px',
  'padding: 0',
  'margin: -1px',
  'overflow: hidden',
  'clip: rect(0, 0, 0, 0)',
  'white-space: nowrap',
  'border: 0',
].join('; ');

function createLiveRegionElement(doc: Document, politeness: 'polite' | 'assertive', id: string): HTMLElement {
  const existing = doc.getElementById(id);
  if (existing) return existing;

  const el = doc.createElement('div');
  el.id = id;
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
  el.setAttribute('data-lkdv-live-region', politeness);
  el.setAttribute('style', SR_ONLY_STYLE);
  doc.body?.appendChild(el);
  return el;
}

export interface CreateAnnouncerOptions {
  document?: Document | null;
  idPrefix?: string;
  now?: () => number;
}

export function createScreenReaderAnnouncer(
  options: CreateAnnouncerOptions = {},
): ScreenReaderAnnouncer {
  const doc = options.document !== undefined ? options.document : typeof document !== 'undefined' ? document : null;
  const idPrefix = options.idPrefix ?? 'lkdv-sr-announcer';
  const now = options.now ?? (() => Date.now());

  let politeEl: HTMLElement | null = null;
  let assertiveEl: HTMLElement | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;
  const history: AnnouncementRecord[] = [];
  let lastMessage = '';
  let lastPoliteness: AriaLivePoliteness = 'polite';
  let lastTimestamp = 0;

  function ensureRegions(): void {
    if (!doc || !doc.body) return;
    if (!politeEl) {
      politeEl = createLiveRegionElement(doc, 'polite', `${idPrefix}-polite`);
    }
    if (!assertiveEl) {
      assertiveEl = createLiveRegionElement(doc, 'assertive', `${idPrefix}-assertive`);
    }
  }

  function clearRegionsText(): void {
    if (politeEl) politeEl.textContent = '';
    if (assertiveEl) assertiveEl.textContent = '';
  }

  function announce(rawMessage: string, opts: AnnouncementOptions = {}): boolean {
    const message = rawMessage.trim();
    if (!message) return false;

    const politeness: AriaLivePoliteness = opts.politeness ?? 'polite';
    if (politeness === 'off') return false;

    const dedupeWindowMs = opts.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    const clearAfterMs = opts.clearAfterMs ?? DEFAULT_CLEAR_AFTER_MS;
    const ts = now();

    if (
      message === lastMessage &&
      politeness === lastPoliteness &&
      ts - lastTimestamp < dedupeWindowMs
    ) {
      return false;
    }

    lastMessage = message;
    lastPoliteness = politeness;
    lastTimestamp = ts;

    history.push({ message, politeness, timestamp: ts });
    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    ensureRegions();
    const target = politeness === 'assertive' ? assertiveEl : politeEl;
    if (target) {
      // Réinitialisation brève pour forcer la ré-annonce si le texte est identique hors fenêtre de dédup
      if (target.textContent === message) {
        target.textContent = '';
      }
      target.textContent = message;
    }

    if (clearTimer !== null) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (clearAfterMs > 0) {
      clearTimer = setTimeout(() => {
        clearRegionsText();
        clearTimer = null;
      }, clearAfterMs);
    }

    return true;
  }

  function clear(): void {
    if (clearTimer !== null) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    clearRegionsText();
    lastMessage = '';
    lastTimestamp = 0;
  }

  function destroy(): void {
    clear();
    politeEl?.remove();
    assertiveEl?.remove();
    politeEl = null;
    assertiveEl = null;
    history.length = 0;
  }

  return {
    announce,
    clear,
    getHistory: () => [...history],
    destroy,
  };
}

let sharedAnnouncer: ScreenReaderAnnouncer | null = null;

export function getSharedAnnouncer(): ScreenReaderAnnouncer {
  if (!sharedAnnouncer) {
    sharedAnnouncer = createScreenReaderAnnouncer();
  }
  return sharedAnnouncer;
}

export function announceToScreenReader(message: string, options?: AnnouncementOptions): boolean {
  return getSharedAnnouncer().announce(message, options);
}

export function formatDistanceAriaLabel(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 'Distance inconnue';
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} mètres`;
  }
  const km = distanceMeters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1).replace('.', ',')} kilomètres`;
}

export function formatElevationAriaLabel(gainMeters: number): string {
  if (!Number.isFinite(gainMeters)) return 'Dénivelé inconnu';
  const rounded = Math.round(gainMeters);
  if (rounded >= 0) {
    return `${rounded} mètres de dénivelé positif`;
  }
  return `${Math.abs(rounded)} mètres de dénivelé négatif`;
}

export function formatMapFeatureAriaLabel(feature: {
  name: string;
  category?: string;
  distanceMeters?: number;
  elevationGainMeters?: number;
}): string {
  const parts = [feature.name];
  if (feature.category) parts.push(feature.category);
  if (typeof feature.distanceMeters === 'number') {
    parts.push(formatDistanceAriaLabel(feature.distanceMeters));
  }
  if (typeof feature.elevationGainMeters === 'number') {
    parts.push(formatElevationAriaLabel(feature.elevationGainMeters));
  }
  return parts.join(', ');
}

export function formatDrawerStateAnnouncement(drawerTitle: string, isOpen: boolean): string {
  return isOpen ? `Panneau ${drawerTitle} ouvert` : `Panneau ${drawerTitle} fermé`;
}
