/**
 * Suivi d'activité (04_CARTE §4, P7-16).
 *
 * Reçoit des positions GPS et produit les métriques du direct : distance,
 * dénivelé positif, temps en mouvement. Règles produit :
 *   - une position dont la précision dépasse 30 m est ignorée ;
 *   - lissage exponentiel de l'altitude (le GPS de montagne oscille de ±10 m) ;
 *   - le mouvement n'est compté qu'au-delà de 0,3 m/s ;
 *   - un saut de plus de 100 m en moins de 2 s est rejeté (perte de fix).
 *
 * Auto-pause (S1.05)
 * ------------------
 * La détection est **désactivée par défaut** : `new ActivityTracker()` garde
 * exactement le comportement historique. Elle s'active par sport ou par
 * configuration explicite, sans toucher à la pause manuelle (qui reste gérée
 * par le hook/le store : le tracker ne reçoit simplement plus de fix quand
 * l'activité est en pause manuelle).
 *
 * Les valeurs de base sont reprises des mécanismes LKDV existants :
 *   - seuil d'arrêt historique de `TrackingEngine` : 0,5 km/h (0,139 m/s) ;
 *   - temporisation historique : 120 s ;
 *   - seuil de reprise : `MIN_MOVING_SPEED_MS` (0,3 m/s, soit 1,08 km/h) pour
 *     le profil de repli, afin de ne pas déclarer « repris » un déplacement que
 *     le tracker ne compte toujours pas comme du mouvement ; les profils lents
 *     (kayak, escalade) descendent sous ce plancher avec leur propre seuil.
 *
 * La détection est **purement additive** : elle n'ampute ni `distanceM`, ni
 * `movingS`, ni `elevGainM`. Le hook S1.02 lira `autoPaused` pour suspendre ou
 * reprendre l'enregistrement ; les métriques historiques restent intactes.
 *
 * Les délais par sport sont des **hypothèses produit réversibles**, pas des
 * mesures terrain : course/trail réagissent vite (20 s), le vélo un peu plus
 * lentement (30 s, seuil 1 km/h), la randonnée conserve les 120 s historiques,
 * le kayak et le ski ont leurs propres seuils, l'escalade et le bivouac
 * tolèrent les arrêts longs. `AUTO_PAUSE_BY_SPORT` est la seule table à
 * modifier si les réglages S1.02 doivent être ajustés.
 *
 * Aucune dépendance d'exécution : utilisable dans le worker, dans les tests et
 * sur le web (l'import de `Sport` est un import de type, effacé au build).
 */

import type { Sport } from '../state/types';

export interface GpsFix {
  t: number;
  lat: number;
  lng: number;
  ele?: number | null;
  /** Précision horizontale en mètres. */
  acc?: number | null;
  speed?: number | null;
}

export interface AutoPauseConfig {
  /** Active la détection. `false` = comportement historique, métriques inchangées. */
  enabled: boolean;
  /** Vitesse à laquelle un fix est considéré comme arrêté (m/s). */
  speedThresholdMs: number;
  /** Durée continue d'arrêt avant la mise en pause (s). */
  durationS: number;
  /** Vitesse minimale pour envisager la reprise (m/s, hystérésis). */
  resumeSpeedThresholdMs: number;
  /** Durée continue de mouvement avant la reprise (s). */
  resumeDurationS: number;
  /**
   * Interruption GPS au-delà de laquelle on ne compte plus le temps écoulé
   * dans les temporisations (s). Une coupure de fix n'est ni un arrêt ni une
   * reprise : la temporisation repart à zéro. Si l'activité était déjà en
   * pause, un premier fix en mouvement après la coupure suffit à reprendre
   * (la continuité n'est pas mesurable).
   */
  maxFixGapS: number;
}

/** Alias de lecture, utile aux réglages qui parlent de « profil ». */
export type AutoPauseProfile = AutoPauseConfig;

export type AutoPauseConfigInput = Partial<AutoPauseConfig>;

export type AutoPauseEventType = 'pause' | 'resume' | 'reset';

export type AutoPauseReason = 'stop-delay' | 'resume-delay' | 'gps-gap' | 'config';

export interface AutoPauseEvent {
  type: AutoPauseEventType;
  /** Horodatage du fix qui a provoqué le changement (ms). */
  t: number;
  sport: Sport | null;
  /** Temporisation appliquée pour cet événement (s). */
  afterS: number;
  reason: AutoPauseReason;
}

export interface AutoPauseState {
  enabled: boolean;
  paused: boolean;
  /** Durée continue d'arrêt déjà observée (s), plafonnée au délai. */
  stoppedS: number;
  /** Durée continue de mouvement observée pendant la pause (s). */
  resumingS: number;
  /** Horodatage du dernier changement d'état, ou `null`. */
  changedAt: number | null;
  pauseCount: number;
  resumeCount: number;
}

export interface ActivityMetrics {
  distanceM: number;
  elevGainM: number;
  movingS: number;
  lastFix: GpsFix | null;
  rejected: number;
  /** État détaillé de la détection automatique. */
  autoPause: AutoPauseState;
  /** Raccourci pour les appelants qui lisent un booléen (parité TrackingEngine). */
  autoPaused: boolean;
  /** Même valeur que `autoPaused`, nom repris de `TrackingEngine`. */
  isAutoPaused: boolean;
}

export interface ActivityTrackerOptions {
  /** Sport courant : sélectionne le profil d'auto-pause. */
  sport?: Sport | null;
  /**
   * `undefined`/`false`/`null` : désactivé (défaut historique).
   * `true` : profil du sport (ou profil par défaut).
   * Objet : profil du sport surchargé ; `enabled` vaut `true` par défaut.
   */
  autoPause?: boolean | AutoPauseConfigInput | null;
  /** Notifié à chaque pause/reprise/reset, pour l'haptique ou un toast. */
  onAutoPause?: (event: AutoPauseEvent) => void;
}

export const MAX_ACCURACY_M = 30;
export const MIN_MOVING_SPEED_MS = 0.3;
export const MAX_JUMP_M = 100;
export const MAX_JUMP_WINDOW_S = 2;
const ELE_SMOOTHING = 0.25;
const MAX_EVENTS = 50;

/** Profil de repli : celui de `TrackingEngine` (0,5 km/h pendant 120 s). */
export const DEFAULT_AUTO_PAUSE_CONFIG: AutoPauseConfig = {
  enabled: true,
  speedThresholdMs: 0.139,
  durationS: 120,
  resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
  resumeDurationS: 5,
  maxFixGapS: 120,
};

/**
 * Profils par sport. Les commentaires donnent l'équivalent lisible ; les
 * valeurs restent en m/s pour éviter les conversions dans la boucle GPS.
 *
 * Toutes les valeurs sont réversibles et seront remplacées par les réglages
 * S1.02 si ceux-ci diffèrent : le tracker ne fait que les consommer.
 */
export const AUTO_PAUSE_BY_SPORT: Readonly<Record<Sport, AutoPauseConfig>> = {
  // 0,5 km/h ; arrêt court (feu, regroupement) ; reprise à 1,08 km/h.
  course: {
    enabled: true,
    speedThresholdMs: 0.139,
    durationS: 20,
    resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
    resumeDurationS: 3,
    maxFixGapS: 60,
  },
  // Profil historique LKDV : 0,5 km/h pendant 120 s.
  rando: {
    enabled: true,
    speedThresholdMs: 0.139,
    durationS: 120,
    resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
    resumeDurationS: 5,
    maxFixGapS: 120,
  },
  // 1 km/h : le vélo peut osciller lentement sans être à l'arrêt ; reprise 1,8 km/h.
  velo: {
    enabled: true,
    speedThresholdMs: 0.278,
    durationS: 30,
    resumeSpeedThresholdMs: 0.5,
    resumeDurationS: 3,
    maxFixGapS: 60,
  },
  // 0,8 km/h : dérive d'un kayak immobile ; reprise 0,9 km/h.
  kayak: {
    enabled: true,
    speedThresholdMs: 0.222,
    durationS: 45,
    resumeSpeedThresholdMs: 0.25,
    resumeDurationS: 5,
    maxFixGapS: 90,
  },
  // Même logique que la course, avec une trace plus bruitée en montagne.
  trail: {
    enabled: true,
    speedThresholdMs: 0.139,
    durationS: 20,
    resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
    resumeDurationS: 3,
    maxFixGapS: 60,
  },
  // 1 km/h : peau de phoque / dérapages lents ne sont pas des arrêts.
  ski: {
    enabled: true,
    speedThresholdMs: 0.278,
    durationS: 60,
    resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
    resumeDurationS: 5,
    maxFixGapS: 90,
  },
  // Escalade : progression très lente, on attend 3 min avant de conclure.
  escalade: {
    enabled: true,
    speedThresholdMs: 0.139,
    durationS: 180,
    resumeSpeedThresholdMs: 0.2,
    resumeDurationS: 5,
    maxFixGapS: 120,
  },
  // Balade en famille : les pauses photo/goûter sont longues.
  famille: {
    enabled: true,
    speedThresholdMs: 0.139,
    durationS: 180,
    resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
    resumeDurationS: 8,
    maxFixGapS: 120,
  },
  // Bivouac : on ne veut pas couper l'enregistrement à chaque installation.
  bivouac: {
    enabled: true,
    speedThresholdMs: 0.139,
    durationS: 300,
    resumeSpeedThresholdMs: MIN_MOVING_SPEED_MS,
    resumeDurationS: 10,
    maxFixGapS: 300,
  },
};

/** Alias explicite pour les réglages qui importent plusieurs profils. */
export const AUTO_PAUSE_PROFILES = AUTO_PAUSE_BY_SPORT;

/** Même profil que le repli, mais désactivé : utilisable comme valeur de réglage. */
export const AUTO_PAUSE_DISABLED: AutoPauseConfig = {
  ...DEFAULT_AUTO_PAUSE_CONFIG,
  enabled: false,
};

function copyConfig(config: AutoPauseConfig): AutoPauseConfig {
  return { ...config };
}

function bounded(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function normalizeConfig(config: AutoPauseConfig): AutoPauseConfig {
  const speedThresholdMs = bounded(
    config.speedThresholdMs,
    DEFAULT_AUTO_PAUSE_CONFIG.speedThresholdMs
  );
  const resumeSpeedThresholdMs = Math.max(
    speedThresholdMs,
    bounded(config.resumeSpeedThresholdMs, DEFAULT_AUTO_PAUSE_CONFIG.resumeSpeedThresholdMs)
  );
  return {
    enabled: config.enabled !== false,
    speedThresholdMs,
    durationS: bounded(config.durationS, DEFAULT_AUTO_PAUSE_CONFIG.durationS),
    resumeSpeedThresholdMs,
    resumeDurationS: bounded(config.resumeDurationS, DEFAULT_AUTO_PAUSE_CONFIG.resumeDurationS),
    maxFixGapS: bounded(config.maxFixGapS, DEFAULT_AUTO_PAUSE_CONFIG.maxFixGapS),
  };
}

/** Profil d'un sport, ou profil de repli. Retourne toujours une copie. */
export function autoPauseConfigForSport(sport?: Sport | null): AutoPauseConfig {
  const profile = sport ? AUTO_PAUSE_BY_SPORT[sport] : undefined;
  return copyConfig(profile ?? DEFAULT_AUTO_PAUSE_CONFIG);
}

/**
 * Résout une configuration d'auto-pause.
 *
 * - `input` absent ou `true` : profil du sport, activé ;
 * - `input` `false`/`null` : profil du sport, désactivé ;
 * - `input` objet : profil du sport surchargé, activé sauf `enabled: false`.
 */
export function resolveAutoPauseConfig(
  sport?: Sport | null,
  input?: boolean | AutoPauseConfigInput | null
): AutoPauseConfig {
  const base = autoPauseConfigForSport(sport);
  if (input === false || input === null) return { ...base, enabled: false };
  if (input === undefined || input === true) return { ...base, enabled: true };

  return normalizeConfig({
    ...base,
    ...input,
    enabled: input.enabled ?? true,
  });
}

function isTrackerOptions(
  value: ActivityTrackerOptions | AutoPauseConfigInput
): value is ActivityTrackerOptions {
  if ('autoPause' in value || 'onAutoPause' in value) return true;
  if ('sport' in value) return !('enabled' in value);
  // Un objet vide est l'appel historique `new ActivityTracker()` : il ne doit
  // surtout pas être interprété comme une configuration qui active la pause.
  if (Object.keys(value).length === 0) return true;
  return false;
}

export function haversineM(a: GpsFix, b: GpsFix): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export class ActivityTracker {
  private metrics: ActivityMetrics = {
    distanceM: 0,
    elevGainM: 0,
    movingS: 0,
    lastFix: null,
    rejected: 0,
    autoPause: {
      enabled: false,
      paused: false,
      stoppedS: 0,
      resumingS: 0,
      changedAt: null,
      pauseCount: 0,
      resumeCount: 0,
    },
    autoPaused: false,
    isAutoPaused: false,
  };

  private smoothedEle: number | null = null;

  private sport: Sport | null = null;

  /** Demande initiale, conservée pour recalculer le profil si le sport change. */
  private autoPauseRequested: boolean | AutoPauseConfigInput | null = null;

  private autoPauseConfigValue: AutoPauseConfig = { ...AUTO_PAUSE_DISABLED };

  private readonly onAutoPause?: (event: AutoPauseEvent) => void;

  private events: AutoPauseEvent[] = [];

  /** Une mesure rejetée casse la continuité : elle n'est ni arrêt ni reprise. */
  private autoPauseContinuityBroken = false;

  constructor(options: ActivityTrackerOptions | AutoPauseConfigInput = {}) {
    const trackerOptions: ActivityTrackerOptions = isTrackerOptions(options)
      ? options
      : { autoPause: options };
    this.sport = trackerOptions.sport ?? null;
    this.onAutoPause = trackerOptions.onAutoPause;

    if (trackerOptions.autoPause !== undefined) {
      this.autoPauseRequested = trackerOptions.autoPause;
      this.applyAutoPauseConfig(resolveAutoPauseConfig(this.sport, trackerOptions.autoPause), true);
    }
  }

  get state(): ActivityMetrics {
    const autoPause = { ...this.metrics.autoPause };
    return {
      ...this.metrics,
      autoPause,
      autoPaused: autoPause.paused,
      isAutoPaused: autoPause.paused,
    };
  }

  /** Configuration effective (copie), utile au câblage des réglages S1.02. */
  get autoPauseConfig(): AutoPauseConfig {
    return copyConfig(this.autoPauseConfigValue);
  }

  /** Historique borné des transitions, pour les preuves et l'interface. */
  get autoPauseEvents(): readonly AutoPauseEvent[] {
    return [...this.events];
  }

  drainAutoPauseEvents(): AutoPauseEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  /** Change de sport sans perdre les métriques ; réarme la détection. */
  setSport(sport: Sport | null): void {
    if (this.sport === sport) return;
    this.sport = sport;
    if (this.autoPauseRequested === null || this.autoPauseRequested === false) return;
    this.applyAutoPauseConfig(resolveAutoPauseConfig(this.sport, this.autoPauseRequested), false);
  }

  /**
   * Active, désactive ou surcharge la détection.
   * La désactivation remet l'état à zéro sans toucher aux métriques.
   */
  setAutoPause(input: boolean | AutoPauseConfigInput | null = true): void {
    this.autoPauseRequested = input;
    this.applyAutoPauseConfig(resolveAutoPauseConfig(this.sport, input), false);
  }

  /** Alias de `setAutoPause`, pour le vocabulaire des réglages. */
  configureAutoPause(input: boolean | AutoPauseConfigInput | null = true): void {
    this.setAutoPause(input);
  }

  /**
   * Réarme la détection sans changer sa configuration. À appeler par le hook
   * après une pause/reprise manuelle ou un changement de session, pour ne pas
   * interpréter le trou de fix comme un arrêt ou une reprise automatique.
   */
  resetAutoPause(): void {
    this.applyAutoPauseConfig(this.autoPauseConfigValue, false);
  }

  private applyAutoPauseConfig(config: AutoPauseConfig, silent: boolean): void {
    const previous = this.metrics.autoPause;
    const wasPaused = previous.paused;
    this.autoPauseConfigValue = normalizeConfig(config);

    this.metrics.autoPause = {
      enabled: this.autoPauseConfigValue.enabled,
      paused: false,
      stoppedS: 0,
      resumingS: 0,
      changedAt: previous.changedAt,
      pauseCount: previous.pauseCount,
      resumeCount: previous.resumeCount,
    };
    this.metrics.autoPaused = false;
    this.metrics.isAutoPaused = false;

    if (wasPaused && !silent) {
      this.recordEvent({
        type: 'reset',
        t: this.metrics.lastFix?.t ?? 0,
        sport: this.sport,
        afterS: 0,
        reason: 'config',
      });
    }
  }

  addFix(fix: GpsFix): ActivityMetrics {
    if (fix.acc !== undefined && fix.acc !== null && fix.acc > MAX_ACCURACY_M) {
      this.metrics.rejected += 1;
      this.autoPauseContinuityBroken = true;
      return this.state;
    }

    const previous = this.metrics.lastFix;
    if (!previous) {
      this.metrics.lastFix = fix;
      this.smoothedEle = fix.ele ?? null;
      return this.state;
    }

    const dtS = Math.max(0, (fix.t - previous.t) / 1000);
    const distance = haversineM(previous, fix);

    // Perte de fix : saut impossible dans un laps de temps très court.
    if (dtS > 0 && dtS <= MAX_JUMP_WINDOW_S && distance > MAX_JUMP_M) {
      this.metrics.rejected += 1;
      this.autoPauseContinuityBroken = true;
      return this.state;
    }

    this.metrics.distanceM += distance;

    const speed = fix.speed ?? (dtS > 0 ? distance / dtS : 0);
    if (speed > MIN_MOVING_SPEED_MS) this.metrics.movingS += dtS;

    if (typeof fix.ele === 'number') {
      const smoothed =
        this.smoothedEle === null
          ? fix.ele
          : this.smoothedEle + ELE_SMOOTHING * (fix.ele - this.smoothedEle);
      if (this.smoothedEle !== null && smoothed > this.smoothedEle) {
        this.metrics.elevGainM += smoothed - this.smoothedEle;
      }
      this.smoothedEle = smoothed;
    }

    this.metrics.lastFix = fix;
    this.updateAutoPause(fix, dtS, speed, this.autoPauseContinuityBroken);
    this.autoPauseContinuityBroken = false;
    return this.state;
  }

  private updateAutoPause(
    fix: GpsFix,
    dtS: number,
    rawSpeed: number,
    continuityBroken: boolean
  ): void {
    const config = this.autoPauseConfigValue;
    if (!config.enabled) return;

    // Une mesure aberrante de vitesse ne doit ni suspendre ni reprendre.
    const speed = Number.isFinite(rawSpeed) ? Math.max(0, rawSpeed) : null;

    // Un fix rejeté a créé un trou dans la preuve : on ne compte pas l'intervalle
    // qui le sépare du dernier fix valide comme une continuité d'arrêt ou de
    // mouvement. La temporisation repart au fix valide suivant.
    if (continuityBroken) {
      this.metrics.autoPause.stoppedS = 0;
      this.metrics.autoPause.resumingS = 0;
      return;
    }

    // Trou de fix : le temps écoulé n'est pas une preuve d'arrêt ou de reprise.
    // On repart d'une temporisation neuve, en conservant l'état courant.
    if (dtS > config.maxFixGapS) {
      this.metrics.autoPause.stoppedS = 0;
      this.metrics.autoPause.resumingS = 0;
      if (
        this.metrics.autoPause.paused &&
        speed !== null &&
        speed >= config.resumeSpeedThresholdMs
      ) {
        // La continuité n'est pas mesurable après la coupure : le premier fix
        // en mouvement suffit à reprendre, sinon on resterait pausé à vie.
        this.transition(false, fix.t, 'gps-gap', 0);
      }
      return;
    }

    if (dtS <= 0 || speed === null) return;

    if (!this.metrics.autoPause.paused) {
      if (speed <= config.speedThresholdMs) {
        this.metrics.autoPause.stoppedS = Math.min(
          config.durationS,
          this.metrics.autoPause.stoppedS + dtS
        );
        this.metrics.autoPause.resumingS = 0;
        if (this.metrics.autoPause.stoppedS >= config.durationS) {
          this.transition(true, fix.t, 'stop-delay', config.durationS);
        }
      } else {
        this.metrics.autoPause.stoppedS = 0;
        this.metrics.autoPause.resumingS = 0;
      }
      return;
    }

    // En pause : il faut un mouvement continu au-dessus du seuil de reprise.
    if (speed >= config.resumeSpeedThresholdMs) {
      this.metrics.autoPause.resumingS = Math.min(
        config.resumeDurationS,
        this.metrics.autoPause.resumingS + dtS
      );
      if (this.metrics.autoPause.resumingS >= config.resumeDurationS) {
        this.transition(false, fix.t, 'resume-delay', config.resumeDurationS);
      }
    } else {
      this.metrics.autoPause.resumingS = 0;
    }
  }

  private transition(paused: boolean, t: number, reason: AutoPauseReason, afterS: number): void {
    const state = this.metrics.autoPause;
    if (state.paused === paused) return;

    state.paused = paused;
    state.changedAt = t;
    if (paused) {
      state.pauseCount += 1;
      state.stoppedS = this.autoPauseConfigValue.durationS;
      state.resumingS = 0;
    } else {
      state.resumeCount += 1;
      state.stoppedS = 0;
      state.resumingS = 0;
    }
    this.metrics.autoPaused = paused;
    this.metrics.isAutoPaused = paused;

    this.recordEvent({
      type: paused ? 'pause' : 'resume',
      t,
      sport: this.sport,
      afterS,
      reason,
    });
  }

  private recordEvent(event: AutoPauseEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
    this.onAutoPause?.(event);
  }
}

/** Vitesse moyenne de déplacement (km/h) sur les mesures en mouvement. */
export function averageSpeedKmh(metrics: ActivityMetrics): number | null {
  if (metrics.movingS <= 0) return null;
  return (metrics.distanceM / metrics.movingS) * 3.6;
}
