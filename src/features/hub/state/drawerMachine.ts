/**
 * src/features/hub/state/drawerMachine.ts
 * Navigation state machine for the LKDV HUB Camp de Base & Kit Studio.
 *
 * RULES:
 * 1. Zero new Next.js pages: all 19 entries of hubSectionRegistry remain inside /hub.
 * 2. hubSectionRegistry.ts is the untouched source of truth for HUB segments.
 * 3. Popstate hierarchy: SUB_DRAWER_OPEN -> DRAWER_OPEN -> STUDIO -> CLOSED without leaving /hub.
 * 4. scrollCache restores scroll position across drawer switches.
 * 5. Bidirectional synchronization with URL (/hub/<segment>, /hub?drawer=<segment>, /hub?studio=1&drawer=<studioDrawer>).
 */

import { hubSectionRegistry, type HubSectionDef } from '../registry/hubSectionRegistry';
import type { HubSectionId } from '../engine/hubProfileEngine';

export const STUDIO_DRAWERS = [
  'inventaire',
  'personnaliser',
  'statistiques',
  'lignee',
  'insignes',
  'options',
] as const;

export type StudioDrawer = (typeof STUDIO_DRAWERS)[number];

/** Drawer d'entrée par défaut du Kit Studio (point d'entrée unique, hors littéral dans les composants). */
export const DEFAULT_STUDIO_DRAWER: StudioDrawer = 'inventaire';

/** URL canonique d'un drawer du HUB à partir d'un segment du registre (seul point d'écriture hors registre). */
export function hubDrawerUrl(segment: string): string {
  return `/hub/${segment}`;
}

/** Les sections « matériel » ouvrent l'atelier Kit Studio plutôt qu'un contenu générique. */
export function isGearHubSection(sectionId: string): boolean {
  return sectionId === 'inventaire' || sectionId === 'kit' || sectionId === 'gear';
}

export function isStudioDrawer(value: string | null | undefined): value is StudioDrawer {
  if (!value) return false;
  return (STUDIO_DRAWERS as readonly string[]).includes(value);
}

/**
 * Legacy / deep-link aliases resolving to canonical hubSectionRegistry segments.
 */
export const HUB_DRAWER_ALIASES: Readonly<Record<string, string>> = {
  overview: '',
  itinerary: 'itineraire',
  gear: 'kit-voyage',
  materiel: 'inventaire',
  kits: 'kit',
  docs: 'documents',
  safety: 'securite',
  notes: 'journal',
  'voyages-lies': 'voyages',
  participants: 'groupe',
} as const;

/**
 * Resolves a segment or section ID against the 19 canonical entries of hubSectionRegistry.
 * Returns:
 * - `{ kind: 'root', def }` when resolving overview (`''`)
 * - `{ kind: 'redirect', href: '/compas?etape=kit', def }` for `preparation` (MIGRATIONS_CLEANUP §2.1)
 * - `{ kind: 'drawer', segment, sectionId, def }` for any of the 17 openable drawers
 * - `null` for unknown values
 */
export type ResolvedHubDestination =
  | { kind: 'root'; def: HubSectionDef }
  | { kind: 'redirect'; href: string; def: HubSectionDef }
  | { kind: 'drawer'; segment: string; sectionId: HubSectionId; def: HubSectionDef };

export function resolveHubDestination(raw: string | null | undefined): ResolvedHubDestination | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  const normalized = trimmed in HUB_DRAWER_ALIASES ? HUB_DRAWER_ALIASES[trimmed] : trimmed;

  const bySegment = hubSectionRegistry.find((entry) => entry.segment === normalized);
  const def = bySegment ?? hubSectionRegistry.find((entry) => entry.id === normalized);
  if (!def) return null;

  if (def.segment === '') {
    return { kind: 'root', def };
  }
  if (def.id === 'preparation') {
    return { kind: 'redirect', href: '/compas?etape=kit', def };
  }
  return { kind: 'drawer', segment: def.segment, sectionId: def.id, def };
}

export type DrawerMachineState =
  | { type: 'CLOSED'; redirectHref?: string }
  | { type: 'DRAWER_OPEN'; drawerId: string; sectionId: HubSectionId }
  | { type: 'SUB_DRAWER_OPEN'; drawerId: string; sectionId: HubSectionId; subDrawerId: string }
  | { type: 'STUDIO'; activeDrawer?: StudioDrawer; subDrawerId?: string; kitId?: string | null };

export interface PopStateResult {
  handled: boolean;
  state: DrawerMachineState;
}

/**
 * Parses URL pathname + query string into a canonical DrawerMachineState.
 */
export function parseHubUrlState(pathname: string, search = ''): DrawerMachineState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const studioFlag = params.get('studio');
  const drawerParam = params.get('drawer');
  const subParam = params.get('sub') || undefined;
  const kitParam = params.get('kit');

  if (studioFlag === '1' || studioFlag === 'true') {
    const activeDrawer = isStudioDrawer(drawerParam) ? drawerParam : undefined;
    return {
      type: 'STUDIO',
      activeDrawer,
      subDrawerId: activeDrawer ? subParam : undefined,
      kitId: kitParam,
    };
  }

  const cleanPath = pathname.split(/[?#]/)[0];
  const match = cleanPath.match(/^\/hub(?:\/([^/]+))?\/?$/);
  const rawSegment = drawerParam ?? (match ? match[1] ?? '' : '');

  if (!rawSegment) {
    return { type: 'CLOSED' };
  }

  const resolved = resolveHubDestination(rawSegment);
  if (!resolved || resolved.kind === 'root') {
    return { type: 'CLOSED' };
  }
  if (resolved.kind === 'redirect') {
    return { type: 'CLOSED', redirectHref: resolved.href };
  }
  if (subParam) {
    return {
      type: 'SUB_DRAWER_OPEN',
      drawerId: resolved.segment,
      sectionId: resolved.sectionId,
      subDrawerId: subParam,
    };
  }
  return {
    type: 'DRAWER_OPEN',
    drawerId: resolved.segment,
    sectionId: resolved.sectionId,
  };
}

/**
 * Serializes a DrawerMachineState back to its canonical /hub URL.
 */
export function serializeHubUrlState(state: DrawerMachineState): string {
  switch (state.type) {
    case 'CLOSED':
      return state.redirectHref ?? '/hub';
    case 'DRAWER_OPEN':
      return `/hub/${state.drawerId}`;
    case 'SUB_DRAWER_OPEN':
      return `/hub/${state.drawerId}?sub=${encodeURIComponent(state.subDrawerId)}`;
    case 'STUDIO': {
      const params = new URLSearchParams();
      params.set('studio', '1');
      if (state.kitId) params.set('kit', state.kitId);
      if (state.activeDrawer) params.set('drawer', state.activeDrawer);
      if (state.activeDrawer && state.subDrawerId) params.set('sub', state.subDrawerId);
      return `/hub?${params.toString()}`;
    }
  }
}

export class DrawerNavigationMachine {
  private state: DrawerMachineState = { type: 'CLOSED' };
  private scrollCache = new Map<string, number>();
  private listeners = new Set<(state: DrawerMachineState) => void>();
  private previousStudioContext: { activeDrawer?: StudioDrawer; kitId?: string | null } | null = null;

  constructor(initialState?: DrawerMachineState) {
    if (initialState) {
      this.state = initialState;
    }
  }

  getState(): DrawerMachineState {
    return this.state;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: (state: DrawerMachineState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  syncFromUrl(pathname: string, search = ''): DrawerMachineState {
    this.previousStudioContext = null;
    this.state = parseHubUrlState(pathname, search);
    this.notify();
    return this.state;
  }

  toUrl(): string {
    return serializeHubUrlState(this.state);
  }

  openDrawer(rawSegment: string, fromStudio = false): ResolvedHubDestination | null {
    const resolved = resolveHubDestination(rawSegment);
    if (!resolved || resolved.kind === 'root') {
      this.previousStudioContext = null;
      this.state = { type: 'CLOSED' };
      this.notify();
      return resolved;
    }

    if (resolved.kind === 'redirect') {
      this.previousStudioContext = null;
      this.state = { type: 'CLOSED', redirectHref: resolved.href };
      this.notify();
      return resolved;
    }

    if (fromStudio && this.state.type === 'STUDIO') {
      this.previousStudioContext = {
        activeDrawer: this.state.activeDrawer,
        kitId: this.state.kitId,
      };
    } else if (!fromStudio) {
      this.previousStudioContext = null;
    }

    this.state = {
      type: 'DRAWER_OPEN',
      drawerId: resolved.segment,
      sectionId: resolved.sectionId,
    };
    this.notify();
    return resolved;
  }

  openSubDrawer(subDrawerId: string): void {
    if (this.state.type === 'DRAWER_OPEN') {
      this.state = {
        type: 'SUB_DRAWER_OPEN',
        drawerId: this.state.drawerId,
        sectionId: this.state.sectionId,
        subDrawerId,
      };
      this.notify();
    } else if (this.state.type === 'STUDIO' && this.state.activeDrawer) {
      this.state = {
        ...this.state,
        subDrawerId,
      };
      this.notify();
    }
  }

  closeSubDrawer(): void {
    if (this.state.type === 'SUB_DRAWER_OPEN') {
      this.state = {
        type: 'DRAWER_OPEN',
        drawerId: this.state.drawerId,
        sectionId: this.state.sectionId,
      };
      this.notify();
    } else if (this.state.type === 'STUDIO' && this.state.subDrawerId) {
      this.state = {
        ...this.state,
        subDrawerId: undefined,
      };
      this.notify();
    }
  }

  closeDrawer(): void {
    if (this.state.type === 'STUDIO' && this.state.activeDrawer) {
      this.state = {
        type: 'STUDIO',
        kitId: this.state.kitId,
        activeDrawer: undefined,
        subDrawerId: undefined,
      };
      this.notify();
      return;
    }

    if (this.previousStudioContext) {
      const ctx = this.previousStudioContext;
      this.previousStudioContext = null;
      this.state = {
        type: 'STUDIO',
        activeDrawer: ctx.activeDrawer,
        kitId: ctx.kitId,
      };
    } else {
      this.state = { type: 'CLOSED' };
    }
    this.notify();
  }

  enterStudio(activeDrawer?: StudioDrawer, kitId?: string | null): void {
    this.previousStudioContext = null;
    this.state = {
      type: 'STUDIO',
      activeDrawer,
      kitId: kitId ?? (this.state.type === 'STUDIO' ? this.state.kitId : null),
    };
    this.notify();
  }

  setStudioDrawer(activeDrawer?: StudioDrawer): void {
    if (this.state.type !== 'STUDIO') {
      this.enterStudio(activeDrawer);
      return;
    }
    this.state = {
      ...this.state,
      activeDrawer,
      subDrawerId: undefined,
    };
    this.notify();
  }

  exitStudio(): void {
    this.previousStudioContext = null;
    this.state = { type: 'CLOSED' };
    this.notify();
  }

  /**
   * Hiérarchie stricte de fermeture au retour arrière (B-05) :
   * 1. Sous-tiroir ouvert (dans HUB ou dans Studio) -> revient au tiroir parent
   * 2. Tiroir Studio ouvert -> ferme le tiroir Studio et reste dans Studio
   * 3. Tiroir HUB ouvert depuis Studio -> revient à Studio
   * 4. Tiroir HUB ouvert -> revient au Camp (CLOSED) sans quitter /hub
   * 5. Studio sans tiroir actif -> ferme Studio et revient au Camp (CLOSED)
   * 6. CLOSED -> handled = false (navigation historique normale du navigateur)
   */
  handlePopState(): PopStateResult {
    switch (this.state.type) {
      case 'SUB_DRAWER_OPEN': {
        this.closeSubDrawer();
        return { handled: true, state: this.state };
      }
      case 'DRAWER_OPEN': {
        this.closeDrawer();
        return { handled: true, state: this.state };
      }
      case 'STUDIO': {
        if (this.state.subDrawerId) {
          this.closeSubDrawer();
          return { handled: true, state: this.state };
        }
        if (this.state.activeDrawer) {
          this.setStudioDrawer(undefined);
          return { handled: true, state: this.state };
        }
        this.exitStudio();
        return { handled: true, state: this.state };
      }
      case 'CLOSED':
      default:
        return { handled: false, state: this.state };
    }
  }

  saveScrollPosition(key: string, scrollTop: number): void {
    this.scrollCache.set(key, Math.max(0, scrollTop));
  }

  getScrollPosition(key: string): number {
    return this.scrollCache.get(key) ?? 0;
  }

  clearScrollCache(): void {
    this.scrollCache.clear();
  }
}
