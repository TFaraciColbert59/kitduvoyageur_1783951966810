/**
 * src/features/hub/webgl/WebGLArbiter.ts
 * Single-context WebGL arbitration mutex (ADR-002 / C-05 / C-17 / C-18).
 *
 * INVARIANTS:
 * 1. iOS WKWebView cannot reliably sustain two concurrent heavy WebGL contexts.
 *    WebGLArbiter enforces `camp-map` XOR `bag-scene`.
 * 2. Entering Studio saves MapLibre viewpoint and unmounts map;
 *    exiting Studio unmounts Three.js and restores map viewpoint.
 * 3. On `webglcontextlost`, attempts restoration ONCE; if no handler restores
 *    context or if a second context loss occurs, transitions to `DEGRADED` (2D List).
 * 4. Supports render-loop pause (`setPaused`) on background / offscreen / opaque drawer,
 *    and automatic GPU release after 30s in background (`BACKGROUND_RELEASE_MS`).
 */

export type WebGLHolder = 'camp-map' | 'bag-scene';

export interface MapViewState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
  layer?: 'standard' | 'topo';
}

export const BACKGROUND_RELEASE_MS = 30_000;

export class WebGLArbiter {
  private static instance: WebGLArbiter;
  private currentHolder: WebGLHolder | null = null;
  private savedMapState: MapViewState | null = null;
  private releaseHandlers = new Map<WebGLHolder, () => Promise<void> | void>();
  private restoreHandlers = new Map<WebGLHolder, () => boolean | Promise<boolean>>();
  private contextLostCallbacks = new Set<() => void>();
  private pauseCallbacks = new Set<(paused: boolean) => void>();
  private isDegraded = false;
  private paused = false;
  private restorationAttempts = 0;
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;

  static getInstance(): WebGLArbiter {
    if (!WebGLArbiter.instance) {
      WebGLArbiter.instance = new WebGLArbiter();
    }
    return WebGLArbiter.instance;
  }

  static resetInstance(): void {
    if (WebGLArbiter.instance?.backgroundTimer) {
      clearTimeout(WebGLArbiter.instance.backgroundTimer);
    }
    WebGLArbiter.instance = new WebGLArbiter();
  }

  async acquire(holder: WebGLHolder): Promise<void> {
    if (this.currentHolder === holder) return;

    if (this.currentHolder) {
      const release = this.releaseHandlers.get(this.currentHolder);
      if (release) {
        await release();
      }
      this.currentHolder = null;
    }

    this.currentHolder = holder;
  }

  release(holder: WebGLHolder): void {
    if (this.currentHolder === holder) {
      this.currentHolder = null;
    }
  }

  current(): WebGLHolder | null {
    return this.currentHolder;
  }

  registerReleaseHandler(
    holder: WebGLHolder,
    handler: () => Promise<void> | void
  ): () => void {
    this.releaseHandlers.set(holder, handler);
    return () => {
      if (this.releaseHandlers.get(holder) === handler) {
        this.releaseHandlers.delete(holder);
      }
    };
  }

  registerRestoreHandler(
    holder: WebGLHolder,
    handler: () => boolean | Promise<boolean>
  ): () => void {
    this.restoreHandlers.set(holder, handler);
    return () => {
      if (this.restoreHandlers.get(holder) === handler) {
        this.restoreHandlers.delete(holder);
      }
    };
  }

  saveMapState(state: MapViewState): void {
    this.savedMapState = state;
  }

  getSavedMapState(): MapViewState | null {
    return this.savedMapState;
  }

  /**
   * C-18: Une tentative de restauration est accordée si un restoreHandler est enregistré
   * pour le détenteur courant et qu'aucune tentative n'a encore eu lieu.
   * Si aucun restoreHandler n'est présent, si la tentative échoue, ou lors d'une 2e perte,
   * bascule immédiatement en mode DEGRADED et notifie les écouteurs.
   */
  triggerContextLost(): boolean {
    if (this.isDegraded) {
      return false;
    }

    const holder = this.currentHolder;
    const restoreHandler = holder ? this.restoreHandlers.get(holder) : undefined;

    if (this.restorationAttempts === 0 && restoreHandler) {
      this.restorationAttempts = 1;
      try {
        const result = restoreHandler();
        if (result instanceof Promise) {
          result
            .then((ok) => {
              if (!ok) this.degradeNow();
            })
            .catch(() => this.degradeNow());
          return true;
        }
        if (result === true) {
          return true;
        }
      } catch {
        // tombe en dégradation ci-dessous
      }
    }

    this.degradeNow();
    return false;
  }

  notifyContextRestored(): void {
    // Le contexte a été restauré avec succès sur l'unique tentative autorisée.
    // On conserve restorationAttempts = 1 afin qu'une seconde perte bascule directement en DEGRADED.
  }

  getRestorationAttempts(): number {
    return this.restorationAttempts;
  }

  private degradeNow(): void {
    if (this.isDegraded) return;
    this.isDegraded = true;
    for (const cb of Array.from(this.contextLostCallbacks)) {
      try {
        cb();
      } catch {
        // Ignorer les erreurs d'écouteurs individuels
      }
    }
  }

  onContextLost(cb: () => void): () => void {
    this.contextLostCallbacks.add(cb);
    return () => {
      this.contextLostCallbacks.delete(cb);
    };
  }

  isContextDegraded(): boolean {
    return this.isDegraded;
  }

  /**
   * C-17: Pause / reprise de la boucle de rendu (onglet caché, canvas hors écran, tiroir plein écran).
   * Après 30 s en arrière-plan (`releaseOnTimeout = true`), libère proactivement le contexte GPU actif.
   */
  setPaused(paused: boolean, options?: { releaseAfterTimeout?: boolean }): void {
    if (this.backgroundTimer) {
      clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
    }

    if (this.paused !== paused) {
      this.paused = paused;
      for (const cb of Array.from(this.pauseCallbacks)) {
        try {
          cb(paused);
        } catch {
          // ignore
        }
      }
    }

    if (paused && options?.releaseAfterTimeout && this.currentHolder) {
      const holderToRelease = this.currentHolder;
      this.backgroundTimer = setTimeout(async () => {
        if (this.paused && this.currentHolder === holderToRelease) {
          const release = this.releaseHandlers.get(holderToRelease);
          if (release) {
            await release();
          }
          this.currentHolder = null;
        }
      }, BACKGROUND_RELEASE_MS);
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  onPauseChange(cb: (paused: boolean) => void): () => void {
    this.pauseCallbacks.add(cb);
    return () => {
      this.pauseCallbacks.delete(cb);
    };
  }
}
