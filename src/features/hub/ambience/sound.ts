/**
 * src/features/hub/ambience/sound.ts
 * Contrôleur audio sobre du Camp de Base et du Kit Studio (Lot L6-5 / D-18..D-22).
 *
 * INVARIANTS STRICTS :
 * - D-18 : Muet par défaut au premier lancement.
 * - D-19 : `AudioContext` instancié UNIQUEMENT à l'intérieur d'un geste utilisateur explicite.
 * - D-20 : Suspendu immédiatement au passage en arrière-plan (`visibilitychange` -> `hidden`),
 *          et ne reprend JAMAIS tout seul au retour au premier plan.
 * - D-21 : Préférence persistée dans `localStorage` ; l'état « muet » ne se réarme jamais seul.
 * - D-22 : Aucune information fonctionnelle n'est portée par le son seul.
 */

export const HUB_SOUND_STORAGE_KEY = 'lkdv_hub_sound_pref';

export type SoundPreference = 'muted' | 'enabled';

export interface MinimalAudioContext {
  state: 'suspended' | 'running' | 'closed';
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  close: () => Promise<void>;
  currentTime?: number;
  destination?: unknown;
  createOscillator?: () => {
    type: OscillatorType;
    frequency: { setValueAtTime: (value: number, time: number) => void };
    connect: (dest: unknown) => void;
    start: (when?: number) => void;
    stop: (when?: number) => void;
  };
  createGain?: () => {
    gain: {
      setValueAtTime: (value: number, time: number) => void;
      exponentialRampToValueAtTime: (value: number, time: number) => void;
    };
    connect: (dest: unknown) => void;
  };
}

export interface HubSoundSnapshot {
  preference: SoundPreference;
  isMuted: boolean;
  hasContext: boolean;
  contextState: 'none' | 'suspended' | 'running' | 'closed';
  suspendedByBackground: boolean;
}

export interface HubSoundControllerOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  createAudioContext?: () => MinimalAudioContext | null;
}

function defaultCreateAudioContext(): MinimalAudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    (window as unknown as { AudioContext?: new () => MinimalAudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: new () => MinimalAudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

export class HubSoundController {
  private preference: SoundPreference = 'muted';
  private ctx: MinimalAudioContext | null = null;
  private suspendedByBackground = false;
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private createAudioContext: () => MinimalAudioContext | null;
  private listeners = new Set<(snap: HubSoundSnapshot) => void>();
  private detachVisibility: (() => void) | null = null;

  constructor(options: HubSoundControllerOptions = {}) {
    this.storage =
      options.storage !== undefined
        ? options.storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null;
    this.createAudioContext = options.createAudioContext ?? defaultCreateAudioContext;

    // Lecture seule de la préférence persistée : JAMAIS de création d'AudioContext ici (D-18, D-19)
    try {
      const saved = this.storage?.getItem(HUB_SOUND_STORAGE_KEY);
      this.preference = saved === 'enabled' ? 'enabled' : 'muted';
    } catch {
      this.preference = 'muted';
    }
  }

  attachLifecycleListeners(doc: Document | null = typeof document !== 'undefined' ? document : null): () => void {
    this.detachVisibility?.();
    if (!doc) return () => {};

    const onVisibilityChange = () => {
      if (doc.visibilityState === 'hidden') {
        void this.handleBackgroundHidden();
      }
      // D-20 : Au retour à `visible`, on NE reprend JAMAIS le contexte automatiquement !
    };

    doc.addEventListener('visibilitychange', onVisibilityChange);
    this.detachVisibility = () => {
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      this.detachVisibility = null;
    };
    return this.detachVisibility;
  }

  getSnapshot(): HubSoundSnapshot {
    const contextState = this.ctx ? this.ctx.state : 'none';
    const effectivelyRunning =
      this.preference === 'enabled' &&
      !this.suspendedByBackground &&
      contextState === 'running';

    return {
      preference: this.preference,
      isMuted: this.preference === 'muted' || !effectivelyRunning,
      hasContext: this.ctx !== null,
      contextState,
      suspendedByBackground: this.suspendedByBackground,
    };
  }

  isPreferenceMuted(): boolean {
    return this.preference === 'muted';
  }

  hasAudioContext(): boolean {
    return this.ctx !== null;
  }

  subscribe(listener: (snap: HubSoundSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  private persistPreference(pref: SoundPreference): void {
    this.preference = pref;
    try {
      this.storage?.setItem(HUB_SOUND_STORAGE_KEY, pref);
    } catch {
      // quota/private browsing
    }
  }

  /**
   * D-19 : Seul point d'entrée autorisé à créer ou réveiller l'`AudioContext`.
   * Doit être invoqué exclusivement depuis un gestionnaire `onClick` / `onPointerUp`.
   */
  async enableFromUserGesture(): Promise<HubSoundSnapshot> {
    this.persistPreference('enabled');
    this.suspendedByBackground = false;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = this.createAudioContext();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Navigateur bloquant l'audio
      }
    }

    this.notify();
    return this.getSnapshot();
  }

  /**
   * D-21 : Coupe le son et mémorise « muet ». Ne se réarme jamais automatiquement.
   */
  async mute(): Promise<HubSoundSnapshot> {
    this.persistPreference('muted');
    this.suspendedByBackground = false;

    if (this.ctx && this.ctx.state === 'running') {
      try {
        await this.ctx.suspend();
      } catch {
        // ignore
      }
    }

    this.notify();
    return this.getSnapshot();
  }

  /**
   * D-20 : Appelé lors du passage de l'onglet ou de la WebView en arrière-plan.
   */
  async handleBackgroundHidden(): Promise<HubSoundSnapshot> {
    this.suspendedByBackground = true;
    if (this.ctx && this.ctx.state === 'running') {
      try {
        await this.ctx.suspend();
      } catch {
        // ignore
      }
    }
    this.notify();
    return this.getSnapshot();
  }

  /**
   * Retour sonore discret d'atelier (uniquement si déjà activé par geste et non suspendu).
   * Ne crée JAMAIS d'AudioContext s'il n'existe pas encore (D-19).
   */
  playTactileTick(): boolean {
    if (
      this.preference !== 'enabled' ||
      this.suspendedByBackground ||
      !this.ctx ||
      this.ctx.state !== 'running'
    ) {
      return false;
    }

    if (
      typeof this.ctx.createOscillator !== 'function' ||
      typeof this.ctx.createGain !== 'function' ||
      this.ctx.currentTime === undefined ||
      !this.ctx.destination
    ) {
      return true;
    }

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.018, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.detachVisibility?.();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch {
        // ignore
      }
    }
    this.ctx = null;
    this.listeners.clear();
  }
}

let sharedSoundController: HubSoundController | null = null;

export function getHubSoundController(): HubSoundController {
  if (!sharedSoundController) {
    sharedSoundController = new HubSoundController();
    sharedSoundController.attachLifecycleListeners();
  }
  return sharedSoundController;
}
