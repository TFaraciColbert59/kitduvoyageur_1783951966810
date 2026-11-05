// Cycle de vie du rendu (SPEC-3D) : boucle à la demande, pause en arrière-plan, perte de contexte WebGL,
// mesure de fluidité. Aucune dépendance à three : la cible est un objet qui sait lancer/arrêter une boucle.

export interface LoopTarget {
  setAnimationLoop(callback: ((time: number) => void) | null): void;
}

export interface LifecycleOptions {
  readonly renderer: LoopTarget;
  readonly canvas: HTMLCanvasElement;
  /** Rend une image ; renvoie true tant que la scène bouge encore (amortissement, animation). */
  readonly step: (time: number) => boolean;
  /** Contexte perdu : l'affichage est gelé. */
  readonly onContextLost?: () => void;
  /** Contexte restauré : à l'appelant de reconstruire la scène depuis l'état ; un rendu est ensuite demandé. */
  readonly onContextRestored?: () => void;
  /** Repos avant arrêt de la boucle (ms). Défaut : 600. */
  readonly idleMs?: number;
  readonly doc?: Document;
  readonly win?: Window;
}

export interface Lifecycle {
  /** Quelque chose a changé : démarre la boucle si elle est arrêtée et prolonge son activité. */
  invalidate(): void;
  isRunning(): boolean;
  isFrozen(): boolean;
  isPaused(): boolean;
  dispose(): void;
}

export const IDLE_MS = 600;

export function createLifecycle(options: LifecycleOptions): Lifecycle {
  const { renderer, canvas, step } = options;
  const idleMs = options.idleMs ?? IDLE_MS;
  const doc = options.doc ?? document;
  const win = options.win ?? window;

  let running = false;
  let frozen = false;
  let paused = doc.visibilityState === 'hidden';
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const disarm = (): void => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  const stop = (): void => {
    disarm();
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  };
  const arm = (): void => {
    disarm();
    timer = setTimeout(stop, idleMs);
  };
  const tick = (time: number): void => {
    if (disposed || frozen || paused) { stop(); return; }
    if (step(time)) arm();
  };
  const invalidate = (): void => {
    if (disposed || frozen || paused) return;
    arm();
    if (!running) {
      running = true;
      renderer.setAnimationLoop(tick);
    }
  };

  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') { paused = true; stop(); } else { paused = false; invalidate(); }
  };
  const onPageHide = (): void => { paused = true; stop(); };
  const onPageShow = (): void => { paused = doc.visibilityState === 'hidden'; invalidate(); };
  const onLost = (event: Event): void => {
    event.preventDefault();
    frozen = true;
    stop();
    options.onContextLost?.();
  };
  const onRestored = (): void => {
    frozen = false;
    options.onContextRestored?.();
    invalidate();
  };

  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('pageshow', onPageShow);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    invalidate,
    isRunning: () => running,
    isFrozen: () => frozen,
    isPaused: () => paused,
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', onPageHide);
      win.removeEventListener('pageshow', onPageShow);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    },
  };
}

/** Moyenne glissante par fenêtre de 30 images : signale quand elle dépasse le seuil (ombres à couper). */
export interface FrameMeter {
  /** Enregistre une image ; renvoie la moyenne (ms) à la fin d'une fenêtre complète, sinon null. */
  push(time: number): number | null;
  lastAverage(): number | null;
}

export function createFrameMeter(windowSize = 30, gapMs = 100): FrameMeter {
  let prev: number | null = null;
  let sum = 0;
  let count = 0;
  let last: number | null = null;
  return {
    push(time) {
      const before = prev;
      prev = time;
      // Un grand écart = la boucle vient de redémarrer : on ne mesure pas le repos.
      if (before === null || time - before > gapMs || time < before) { sum = 0; count = 0; return null; }
      sum += time - before;
      count += 1;
      if (count < windowSize) return null;
      last = sum / count;
      sum = 0;
      count = 0;
      return last;
    },
    lastAverage: () => last,
  };
}
