/**
 * src/features/hub/webgl/WebGLArbiter.ts
 * Single-context WebGL arbitration mutex (ADR-002).
 *
 * INVARIANT:
 * iOS WKWebView cannot reliably sustain two concurrent heavy WebGL contexts.
 * WebGLArbiter enforces `camp-map` XOR `bag-scene`.
 * Entering Studio saves MapLibre viewpoint and unmounts map;
 * exiting Studio unmounts Three.js and restores map viewpoint.
 * Context loss degrades to 2D List mode.
 */

export type WebGLHolder = 'camp-map' | 'bag-scene';

export interface MapViewState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
}

export class WebGLArbiter {
  private static instance: WebGLArbiter;
  private currentHolder: WebGLHolder | null = null;
  private savedMapState: MapViewState | null = null;
  private releaseHandlers = new Map<WebGLHolder, () => Promise<void> | void>();
  private contextLostCallbacks = new Set<() => void>();
  private isDegraded = false;

  static getInstance(): WebGLArbiter {
    if (!WebGLArbiter.instance) {
      WebGLArbiter.instance = new WebGLArbiter();
    }
    return WebGLArbiter.instance;
  }

  /**
   * Méthode de réinitialisation pour les tests unitaires isolés.
   */
  static resetInstance(): void {
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

  saveMapState(state: MapViewState): void {
    this.savedMapState = state;
  }

  getSavedMapState(): MapViewState | null {
    return this.savedMapState;
  }

  triggerContextLost(): void {
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
}
