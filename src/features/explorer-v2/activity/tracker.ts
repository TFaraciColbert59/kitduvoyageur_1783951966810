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
 * Désactivée par défaut : `new ActivityTracker()` garde le comportement
 * historique. Le hook branche un profil de `AUTO_PAUSE_BY_SPORT` (ou
 * `AUTO_PAUSE_DISABLED`) via le constructeur. La détection n'ampute jamais
 * `distanceM`, `movingS` ou `elevGainM` : le hook lit `autoPaused` pour
 * suspendre/reprendre l'enregistrement.
 *
 * Pause manuelle : le hook appelle `breakContinuity()` quand il suspend la
 * capture. Le premier fix valide suivant devient la nouvelle borne, sans
 * compter la durée, la distance ni le dénivelé de la pause — même si elle est
 * plus courte que `maxFixGapS`. Aucun callback ni historique n'est nécessaire.
 *
 * Seuils : base historique de `TrackingEngine` (0,5 km/h pendant 120 s) et
 * `MIN_MOVING_SPEED_MS` (0,3 m/s) pour la reprise du profil de repli. Les
 * délais par sport sont des hypothèses produit réversibles, regroupées dans
 * `AUTO_PAUSE_BY_SPORT`.
 *
 * Aucune dépendance d'exécution : utilisable dans le worker, dans les tests et
 * sur le web (l'import de `Sport` est un type, effacé au build).
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
  /** Interruption GPS au-delà de laquelle une temporisation repart à zéro (s). */
  maxFixGapS: number;
}

export interface ActivityMetrics {
  distanceM: number;
  elevGainM: number;
  movingS: number;
  lastFix: GpsFix | null;
  rejected: number;
  /** État de la pause automatique ; `false` quand la fonction est désactivée. */
  autoPaused: boolean;
}

export const MAX_ACCURACY_M = 30;
export const MIN_MOVING_SPEED_MS = 0.3;
export const MAX_JUMP_M = 100;
export const MAX_JUMP_WINDOW_S = 2;
const ELE_SMOOTHING = 0.25;

function profile(
  speedThresholdMs: number,
  durationS: number,
  resumeSpeedThresholdMs: number,
  resumeDurationS: number,
  maxFixGapS: number
): AutoPauseConfig {
  return {
    enabled: true,
    speedThresholdMs,
    durationS,
    resumeSpeedThresholdMs,
    resumeDurationS,
    maxFixGapS,
  };
}

const DEFAULT_AUTO_PAUSE = profile(0.139, 120, MIN_MOVING_SPEED_MS, 5, 120);

/** Configuration inactive, compatible avec le comportement historique. */
export const AUTO_PAUSE_DISABLED: AutoPauseConfig = { ...DEFAULT_AUTO_PAUSE, enabled: false };

/**
 * Profils par sport. Les valeurs sont des hypothèses réversibles à ajuster
 * depuis les réglages S1.02 sans toucher à la machine à états.
 */
export const AUTO_PAUSE_BY_SPORT: Readonly<Record<Sport, AutoPauseConfig>> = {
  // 0,5 km/h ; arrêt court (feu, regroupement) ; reprise à 1,08 km/h.
  course: profile(0.139, 20, MIN_MOVING_SPEED_MS, 3, 60),
  // Profil historique LKDV : 0,5 km/h pendant 120 s.
  rando: profile(0.139, 120, MIN_MOVING_SPEED_MS, 5, 120),
  // 1 km/h : le vélo peut osciller lentement sans être à l'arrêt ; reprise 1,8 km/h.
  velo: profile(0.278, 30, 0.5, 3, 60),
  // 0,8 km/h : dérive d'un kayak immobile ; reprise 0,9 km/h.
  kayak: profile(0.222, 45, 0.25, 5, 90),
  // Même logique que la course, avec une trace plus bruitée en montagne.
  trail: profile(0.139, 20, MIN_MOVING_SPEED_MS, 3, 60),
  // 1 km/h : peau de phoque / dérapages lents ne sont pas des arrêts.
  ski: profile(0.278, 60, MIN_MOVING_SPEED_MS, 5, 90),
  // Escalade : progression très lente, on attend 3 min avant de conclure.
  escalade: profile(0.139, 180, 0.2, 5, 120),
  // Balade en famille : les pauses photo/goûter sont longues.
  famille: profile(0.139, 180, MIN_MOVING_SPEED_MS, 8, 120),
  // Bivouac : on ne veut pas couper l'enregistrement à chaque installation.
  bivouac: profile(0.139, 300, MIN_MOVING_SPEED_MS, 10, 300),
};

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
  private metrics: Omit<ActivityMetrics, 'autoPaused'> = {
    distanceM: 0,
    elevGainM: 0,
    movingS: 0,
    lastFix: null,
    rejected: 0,
  };

  private smoothedEle: number | null = null;

  private readonly config: AutoPauseConfig;

  private autoPaused = false;

  private stoppedS = 0;

  private resumingS = 0;

  /** Posé par `breakContinuity()` : le prochain fix valide est une borne. */
  private continuityBroken = false;

  /** Un fix rejeté ne doit pas servir de preuve de continuité. */
  private rejectedSinceLastFix = false;

  constructor(config: AutoPauseConfig = AUTO_PAUSE_DISABLED) {
    this.config = { ...AUTO_PAUSE_DISABLED, ...config };
  }

  get state(): ActivityMetrics {
    return { ...this.metrics, autoPaused: this.autoPaused };
  }

  /**
   * Signale une rupture de continuité (pause manuelle, changement de source).
   * Le premier fix valide suivant établit la nouvelle borne : la durée, la
   * distance et le dénivelé du trou ne sont pas comptés, et l'auto-pause
   * repart de zéro. Idempotent.
   */
  breakContinuity(): void {
    this.continuityBroken = true;
    this.resetAutoPause();
  }

  addFix(fix: GpsFix): ActivityMetrics {
    if (fix.acc !== undefined && fix.acc !== null && fix.acc > MAX_ACCURACY_M) {
      this.metrics.rejected += 1;
      this.rejectedSinceLastFix = true;
      return this.state;
    }

    const previous = this.metrics.lastFix;
    if (!previous || this.continuityBroken) {
      this.startNewSegment(fix);
      this.continuityBroken = false;
      this.rejectedSinceLastFix = false;
      return this.state;
    }

    const dtS = Math.max(0, (fix.t - previous.t) / 1000);
    const distance = haversineM(previous, fix);

    // Perte de fix : saut impossible dans un laps de temps très court.
    if (dtS > 0 && dtS <= MAX_JUMP_WINDOW_S && distance > MAX_JUMP_M) {
      this.metrics.rejected += 1;
      this.rejectedSinceLastFix = true;
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

    if (this.rejectedSinceLastFix) {
      this.rejectedSinceLastFix = false;
      this.stoppedS = 0;
      this.resumingS = 0;
      return this.state;
    }

    this.updateAutoPause(fix, dtS, speed);
    return this.state;
  }

  private startNewSegment(fix: GpsFix): void {
    this.metrics.lastFix = fix;
    this.smoothedEle = typeof fix.ele === 'number' ? fix.ele : null;
    this.resetAutoPause();
  }

  private resetAutoPause(): void {
    this.autoPaused = false;
    this.stoppedS = 0;
    this.resumingS = 0;
  }

  private updateAutoPause(fix: GpsFix, dtS: number, rawSpeed: number): void {
    if (!this.config.enabled) return;

    const speed = Number.isFinite(rawSpeed) ? Math.max(0, rawSpeed) : null;

    // Trou de fix : le temps écoulé n'est pas une preuve d'arrêt ou de reprise.
    if (dtS > this.config.maxFixGapS) {
      this.stoppedS = 0;
      this.resumingS = 0;
      if (this.autoPaused && speed !== null && speed >= this.config.resumeSpeedThresholdMs) {
        // La continuité n'est pas mesurable après la coupure : un premier fix
        // en mouvement suffit à reprendre, sinon on resterait pausé à vie.
        this.autoPaused = false;
      }
      return;
    }

    if (dtS <= 0 || speed === null) return;

    if (!this.autoPaused) {
      if (speed <= this.config.speedThresholdMs) {
        this.stoppedS += dtS;
        this.resumingS = 0;
        if (this.stoppedS >= this.config.durationS) {
          this.autoPaused = true;
          this.stoppedS = 0;
        }
      } else {
        this.stoppedS = 0;
        this.resumingS = 0;
      }
      return;
    }

    // En pause : il faut un mouvement continu au-dessus du seuil de reprise.
    if (speed >= this.config.resumeSpeedThresholdMs) {
      this.resumingS += dtS;
      if (this.resumingS >= this.config.resumeDurationS) {
        this.autoPaused = false;
        this.resumingS = 0;
      }
    } else {
      this.resumingS = 0;
    }
  }
}

/** Vitesse moyenne de déplacement (km/h) sur les mesures en mouvement. */
export function averageSpeedKmh(metrics: ActivityMetrics): number | null {
  if (metrics.movingS <= 0) return null;
  return (metrics.distanceM / metrics.movingS) * 3.6;
}
