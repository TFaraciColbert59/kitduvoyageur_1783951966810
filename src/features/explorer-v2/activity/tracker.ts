/**
 * Suivi d'activité (04_CARTE §4, P7-16).
 *
 * Reçoit des positions GPS et produit les métriques du direct : distance,
 * dénivelé positif, temps en mouvement. Règles produit :
 *   - une position dont la précision dépasse 30 m est ignorée ;
 *   - lissage exponentiel de l'altitude (le GPS de montagne oscille de ±10 m) ;
 *   - le mouvement n'est compté qu'à partir de 0,3 m/s ;
 *   - un saut de plus de 100 m en moins de 2 s est rejeté (perte de fix).
 *
 * Auto-pause (S1.05)
 * ------------------
 * La fiche demande de détecter les arrêts par sport et de laisser la fonction
 * désactivable. La décision produit retenue pour cette tranche est ON par
 * défaut ; le réglage de préparation permet de la couper. `new
 * ActivityTracker()` reste, lui, désactivé pour préserver le comportement
 * historique des appels directs. Le hook branche un profil de
 * `AUTO_PAUSE_BY_SPORT` (ou `AUTO_PAUSE_DISABLED`) via `setConfig`.
 *
 * Pause manuelle : le hook appelle `breakContinuity()` quand il suspend la
 * capture. Le premier fix valide suivant devient la nouvelle borne, sans
 * compter la durée, la distance ni le dénivelé de la pause — même si elle est
 * plus courte que `maxFixGapS`. Aucun callback ni historique n'est nécessaire.
 *
 * Pause automatique : les fixes continuent d'arriver (ils sont nécessaires à la
 * détection de reprise) mais `distanceM`, `movingS` et `elevGainM` sont gelés
 * pendant la pause ; `lastFix` avance pour que la reprise reparte de la
 * dernière position connue. Une interruption GPS (`maxFixGapS`) n'est jamais
 * comptée comme du mouvement continu : elle établit une nouvelle borne et
 * marque `discontinuity` pour que le tracé soit coupé. Ces règles ne
 * s'appliquent à l'accumulation des métriques que lorsque `config.enabled`
 * vaut `true` ; la coupure d'affichage, elle, reste valable.
 *
 * Fixs rejetés : `accepted` vaut `false`, `lastFix` ne recule pas et l'appelant
 * ne doit ni dessiner le point ni déplacer la carte. Le premier fix valide
 * suivant marque `discontinuity` s'il doit repartir d'une nouvelle borne.
 *
 * Durée : quand `receivedAt` est fourni (horloge monotone de réception), il
 * prime sur `t` pour `dtS` ; un saut de l'horloge murale ne gonfle donc ni
 * `movingS` ni la temporisation de pause. Sans `receivedAt`, `t` reste la
 * source historique.
 *
 * Seuils : base historique de `TrackingEngine` (0,5 km/h pendant 120 s) et
 * `MIN_MOVING_SPEED_MS` (0,3 m/s) pour le temps en mouvement. Aucun profil ne
 * peut reprendre sous ce seuil, sinon la distance s'accumulerait sans durée.
 * Les délais par sport sont des hypothèses produit réversibles, regroupées dans
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
  /**
   * Horodatage monotone de réception (ms). Utilisé pour la durée quand il est
   * présent : un ajustement de l'horloge murale (`t`) ne doit ni gonfler le
   * temps en mouvement ni déclencher une fausse pause. Absent, la durée
   * retombe sur `t` (comportement historique des appels directs et des tests).
   */
  receivedAt?: number;
}

export interface AutoPauseConfig {
  /** Active la détection. `false` = comportement historique, métriques inchangées. */
  enabled: boolean;
  /** Vitesse à laquelle un fix est considéré comme arrêté (m/s). */
  speedThresholdMs: number;
  /** Durée continue d'arrêt avant la mise en pause (s). */
  durationS: number;
  /**
   * Vitesse minimale pour envisager la reprise (m/s, hystérésis). Toujours
   * ramenée au moins à `MIN_MOVING_SPEED_MS` par `profile()`.
   */
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
  /**
   * Vrai si le dernier fix a été retenu. Un fix rejeté ne doit ni être dessiné
   * ni déplacer la carte ni alimenter le hors-trace.
   */
  accepted: boolean;
  /**
   * Vrai si le dernier fix accepté ouvre une nouvelle borne : trou GPS,
   * premier point après un rejet, ou reprise après une pause manuelle. Le
   * tracé doit alors être coupé avant d'ajouter ce point.
   */
  discontinuity: boolean;
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
    // Une reprise sous MIN_MOVING_SPEED_MS accumulerait de la distance sans
    // temps en mouvement (allure nulle). Le seuil de reprise ne descend donc
    // jamais sous le seuil qui alimente `movingS`.
    resumeSpeedThresholdMs: Math.max(resumeSpeedThresholdMs, MIN_MOVING_SPEED_MS),
    resumeDurationS,
    maxFixGapS,
  };
}

/** Normalise aussi les configs fournies directement (hors `profile()`). */
function normalizeConfig(config: AutoPauseConfig): AutoPauseConfig {
  return {
    ...AUTO_PAUSE_DISABLED,
    ...config,
    resumeSpeedThresholdMs: Math.max(config.resumeSpeedThresholdMs, MIN_MOVING_SPEED_MS),
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
  // 0,8 km/h : dérive d'un kayak immobile ; reprise au seuil de mouvement (0,3 m/s).
  kayak: profile(0.222, 45, 0.25, 5, 90),
  // Même logique que la course, avec une trace plus bruitée en montagne.
  trail: profile(0.139, 20, MIN_MOVING_SPEED_MS, 3, 60),
  // 1 km/h : peau de phoque / dérapages lents ne sont pas des arrêts.
  ski: profile(0.278, 60, MIN_MOVING_SPEED_MS, 5, 90),
  // Escalade : progression très lente, on attend 3 min avant de conclure ;
  // reprise au seuil de mouvement (0,3 m/s), pas en dessous.
  escalade: profile(0.139, 180, 0.2, 5, 120),
  // Balade en famille : les pauses photo/goûter sont longues.
  famille: profile(0.139, 180, MIN_MOVING_SPEED_MS, 8, 120),
  // Bivouac : on ne veut pas couper l'enregistrement à chaque installation.
  bivouac: profile(0.139, 300, MIN_MOVING_SPEED_MS, 10, 300),
};

/**
 * Profil effectif d'un sport, désactivé si le réglage de préparation l'est.
 * Retourne toujours une copie : aucun appelant ne peut muter la table.
 */
export function autoPauseConfigForSport(
  sport: Sport | null | undefined,
  enabled = true,
): AutoPauseConfig {
  if (!enabled || !sport) return { ...AUTO_PAUSE_DISABLED };
  return { ...AUTO_PAUSE_BY_SPORT[sport] };
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
  private metrics: Omit<ActivityMetrics, 'autoPaused'> = {
    distanceM: 0,
    elevGainM: 0,
    movingS: 0,
    lastFix: null,
    rejected: 0,
    accepted: false,
    discontinuity: false,
  };

  private smoothedEle: number | null = null;

  private config: AutoPauseConfig;

  private autoPaused = false;

  private stoppedS = 0;

  private resumingS = 0;

  /** Posé par `breakContinuity()` : le prochain fix valide est une borne. */
  private continuityBroken = false;

  /** Un fix rejeté ne doit pas servir de preuve de continuité. */
  private rejectedSinceLastFix = false;

  constructor(config: AutoPauseConfig = AUTO_PAUSE_DISABLED) {
    this.config = normalizeConfig(config);
  }

  get state(): ActivityMetrics {
    return { ...this.metrics, autoPaused: this.autoPaused };
  }

  /**
   * Applique un profil sans perdre les métriques déjà acquises. Utilisé quand
   * le sport ou le réglage de préparation change en cours de sortie.
   */
  setConfig(config: AutoPauseConfig): void {
    this.config = normalizeConfig(config);
    this.resetAutoPause();
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
    if (
      !Number.isFinite(fix.t) ||
      !Number.isFinite(fix.lat) ||
      !Number.isFinite(fix.lng)
    ) {
      return this.rejectFix(true);
    }

    if (fix.acc !== undefined && fix.acc !== null && fix.acc > MAX_ACCURACY_M) {
      return this.rejectFix(true);
    }

    const previous = this.metrics.lastFix;
    if (!previous) {
      this.startNewSegment(fix, false);
      this.continuityBroken = false;
      this.rejectedSinceLastFix = false;
      return this.state;
    }

    if (this.continuityBroken) {
      this.startNewSegment(fix, true);
      this.continuityBroken = false;
      this.rejectedSinceLastFix = false;
      return this.state;
    }

    // Horodatage non monotone : un fix plus ancien (ou dupliqué) ne doit ni
    // ajouter de distance ni faire reculer la borne. `maximumAge: 2000` côté
    // `watchPosition` peut livrer un point mis en cache après un point plus
    // récent, notamment au moment d'une reprise.
    if (fix.t <= previous.t) {
      return this.rejectFix(false);
    }

    const dtS = this.elapsedSeconds(previous, fix);
    const distance = haversineM(previous, fix);

    // Perte de fix : saut impossible dans un laps de temps très court.
    if (dtS <= MAX_JUMP_WINDOW_S && distance > MAX_JUMP_M) {
      return this.rejectFix(true);
    }

    const speed = fix.speed ?? (dtS > 0 ? distance / dtS : 0);
    const gap = dtS > this.config.maxFixGapS;

    if (this.config.enabled) {
      // Interruption GPS : la ligne droite et le temps du trou ne sont pas du
      // mouvement observé. La nouvelle borne est la position courante. Seule
      // une vitesse explicitement rapportée par le GPS peut reprendre la
      // détection ; la vitesse déduite du trou ne prouve aucun mouvement.
      if (gap) {
        const reportedSpeed =
          typeof fix.speed === 'number' && Number.isFinite(fix.speed)
            ? Math.max(0, fix.speed)
            : null;
        this.metrics.lastFix = fix;
        this.metrics.accepted = true;
        this.metrics.discontinuity = true;
        this.smoothedEle = typeof fix.ele === 'number' ? fix.ele : this.smoothedEle;
        this.rejectedSinceLastFix = false;
        this.stoppedS = 0;
        this.resumingS = 0;
        if (
          this.autoPaused &&
          reportedSpeed !== null &&
          reportedSpeed >= this.config.resumeSpeedThresholdMs
        ) {
          // La continuité n'est pas mesurable après la coupure : un premier
          // fix en mouvement suffit à reprendre, sinon on resterait pausé.
          this.autoPaused = false;
        }
        return this.state;
      }

      // Fix rejeté (précision ou saut) : le suivant établit une nouvelle borne,
      // sans compter l'intervalle non prouvé.
      if (this.rejectedSinceLastFix) {
        this.metrics.lastFix = fix;
        this.metrics.accepted = true;
        this.metrics.discontinuity = true;
        this.smoothedEle = typeof fix.ele === 'number' ? fix.ele : this.smoothedEle;
        this.rejectedSinceLastFix = false;
        this.stoppedS = 0;
        this.resumingS = 0;
        return this.state;
      }

      // Pause automatique : on garde les fixes pour détecter la reprise, mais
      // aucune métrique n'est accumulée pendant la pause.
      if (this.autoPaused) {
        this.metrics.lastFix = fix;
        this.metrics.accepted = true;
        this.metrics.discontinuity = false;
        if (typeof fix.ele === 'number') {
          this.smoothedEle =
            this.smoothedEle === null
              ? fix.ele
              : this.smoothedEle + ELE_SMOOTHING * (fix.ele - this.smoothedEle);
        }
        this.updateAutoPause(dtS, speed);
        return this.state;
      }
    }

    const afterRejection = this.rejectedSinceLastFix;
    this.metrics.distanceM += distance;
    if (speed >= MIN_MOVING_SPEED_MS) this.metrics.movingS += dtS;

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
    this.metrics.accepted = true;
    // Même désactivée, une coupure ne doit pas être reliée à l'écran. Les
    // métriques, elles, gardent le comportement historique.
    this.metrics.discontinuity = gap || afterRejection;
    this.rejectedSinceLastFix = false;

    this.updateAutoPause(dtS, speed);
    return this.state;
  }

  /**
   * Rejette le fix sans toucher à la dernière borne. `markContinuity` arme la
   * nouvelle borne du prochain fix valide (précision, saut, coordonnée
   * invalide) ; un simple retard de livraison ne doit pas, lui, couper la
   * continuité des métriques.
   */
  private rejectFix(markContinuity: boolean): ActivityMetrics {
    this.metrics.rejected += 1;
    this.metrics.accepted = false;
    this.metrics.discontinuity = false;
    if (markContinuity) this.rejectedSinceLastFix = true;
    return this.state;
  }

  /**
   * Durée réellement écoulée. L'horodatage de réception monotone prime sur
   * l'horloge murale `t`, qui peut sauter (synchronisation, réglage manuel) et
   * gonfler `movingS` ou déclencher une fausse pause. Sans `receivedAt`, on
   * garde le comportement historique.
   */
  private elapsedSeconds(previous: GpsFix, fix: GpsFix): number {
    const previousReceivedAt = previous.receivedAt;
    const receivedAt = fix.receivedAt;
    if (
      typeof previousReceivedAt === 'number' &&
      Number.isFinite(previousReceivedAt) &&
      typeof receivedAt === 'number' &&
      Number.isFinite(receivedAt)
    ) {
      return Math.max(0, (receivedAt - previousReceivedAt) / 1000);
    }
    return Math.max(0, (fix.t - previous.t) / 1000);
  }

  private startNewSegment(fix: GpsFix, discontinuity: boolean): void {
    this.metrics.lastFix = fix;
    this.metrics.accepted = true;
    this.metrics.discontinuity = discontinuity;
    this.smoothedEle = typeof fix.ele === 'number' ? fix.ele : null;
    this.resetAutoPause();
  }

  private resetAutoPause(): void {
    this.autoPaused = false;
    this.stoppedS = 0;
    this.resumingS = 0;
  }

  private updateAutoPause(dtS: number, rawSpeed: number): void {
    if (!this.config.enabled) return;

    const speed = Number.isFinite(rawSpeed) ? Math.max(0, rawSpeed) : null;
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
