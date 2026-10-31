/**
 * src/features/hub/state/drawerMachine.ts
 * Navigation state machine for the LKDV HUB Camp de Base.
 *
 * RULES:
 * 1. Zero new Next.js pages: all 19 views remain drawers/states within /hub.
 * 2. Popstate hierarchy: subdrawer -> drawer -> Studio -> closed without leaving /hub.
 * 3. scrollCache restores scroll position across drawer switches.
 * 4. Bidirectional synchronization with URL query and path segments.
 */

import {
  resolveCanonicalDrawer,
  type HubCanonicalSegment,
} from '../registry/hubSectionRegistry';

export type StudioDrawer =
  | 'inventaire'
  | 'personnaliser'
  | 'statistiques'
  | 'lignee'
  | 'options';

export type DrawerMachineState =
  | { type: 'CLOSED' }
  | { type: 'DRAWER_OPEN'; drawerId: HubCanonicalSegment }
  | { type: 'SUB_DRAWER_OPEN'; drawerId: HubCanonicalSegment; subDrawerId: string }
  | { type: 'STUDIO'; activeDrawer?: StudioDrawer };

export interface PopStateResult {
  handled: boolean;
  state: DrawerMachineState;
}

export class DrawerNavigationMachine {
  private state: DrawerMachineState = { type: 'CLOSED' };
  private scrollCache = new Map<string, number>();
  private listeners = new Set<(state: DrawerMachineState) => void>();
  private openedFromStudio = false;

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

  openDrawer(rawSegment: string | HubCanonicalSegment, fromStudio = false): void {
    const canonical = resolveCanonicalDrawer(rawSegment);
    if (!canonical) {
      this.closeDrawer();
      return;
    }

    this.openedFromStudio = fromStudio;
    this.state = {
      type: 'DRAWER_OPEN',
      drawerId: canonical,
    };
    this.notify();
  }

  openSubDrawer(subDrawerId: string): void {
    if (this.state.type === 'DRAWER_OPEN') {
      this.state = {
        type: 'SUB_DRAWER_OPEN',
        drawerId: this.state.drawerId,
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
      };
      this.notify();
    }
  }

  closeDrawer(): void {
    if (this.openedFromStudio) {
      this.openedFromStudio = false;
      this.state = { type: 'STUDIO' };
    } else {
      this.state = { type: 'CLOSED' };
    }
    this.notify();
  }

  enterStudio(activeDrawer?: StudioDrawer): void {
    this.openedFromStudio = false;
    this.state = {
      type: 'STUDIO',
      activeDrawer,
    };
    this.notify();
  }

  exitStudio(): void {
    this.openedFromStudio = false;
    this.state = { type: 'CLOSED' };
    this.notify();
  }

  /**
   * Gestion hiérarchique de l'événement popstate (bouton retour navigateur / mobile) :
   * - SUB_DRAWER_OPEN -> DRAWER_OPEN
   * - DRAWER_OPEN -> STUDIO (si ouvert depuis Studio) ou CLOSED sans quitter /hub
   * - STUDIO -> CLOSED
   * - CLOSED -> handled = false (laisse passer l'historique pour quitter le hub)
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
