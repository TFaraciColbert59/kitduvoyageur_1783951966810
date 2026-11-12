/**
 * Suivi d'activité (04_CARTE §4, P7-16).
 *
 * Reçoit des positions GPS et produit les métriques du direct : distance,
 * dénivelé positif, temps en mouvement. Règles produit :
 *   - une position non finie, hors bornes ou dont la précision dépasse 30 m
 *     est ignorée ;
 *   - lissage exponentiel de l'altitude (le GPS de montagne oscille de ±10 m) ;
 *   - le mouvement est compté à partir de 0,3 m/s, ou du seuil de reprise du
 *     sport quand celui-ci est plus lent (kayak, escalade) ;
 *   - un saut de plus de 100 m en moins de 2 s est rejeté (perte de fix) ;
 *   - une vitesse implicite supérieure au maximum plausible du sport est
 *     rejetée même si le trou dure plus de 2 s : la règle ne dépend donc pas
 *     de `maxFixGapS`.
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
 * Durée et horloges : `t` est l'instant de **mesure** (horloge murale),
 * `receivedAt` l'instant monotone de **réception**. La mesure prime pour la
 * distance et la plausibilité, car une livraison en rafale ne raccourcit pas
 * le trajet réel. `receivedAt` ne sert qu'à corriger un saut d'horloge murale
 * détecté (écart incohérent avec la distance/vitesse rapportée), jamais à
 * remplacer systématiquement l'intervalle mesuré. Un `t` qui recule est
 * d'abord traité comme un fix périmé ; deux mesures consécutives dans la
 * nouvelle époque prouvent un saut d'horloge et rebasent le curseur sans
 * geler l'activité.
 *
 * Seuils : base historique de `TrackingEngine` (0,5 km/h pendant 120 s) et
 * `MIN_MOVING_SPEED_MS` (0,3 m/s) pour le temps en mouvement. Les profils
 * gardent leurs seuils propres (kayak 0,25 m/s, escalade 0,2 m/s) : quand un
 * sport reprend sous 0,3 m/s, le temps en mouvement est compté à son seuil de
 * reprise pour que la distance ne s'accumule jamais sans durée. Les délais par
 * sport sont des hypothèses produit réversibles, regroupées dans
 * `AUTO_PAUSE_BY_SPORT`.
 *
 * Config partielle : `normalizeConfig` fusionne les champs absents avec les
 * défauts **avant** de valider chaque valeur. Un appelant JavaScript qui ne
 * fournit que `{ enabled: true }` obtient donc une configuration finie, jamais
 * `NaN`.
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
  /**
   * Active la détection. `false` coupe l'arrêt/reprise automatique ; les
   * métriques gardent l'accumulation historique, hors fixes invraisemblables
   * (la plausibilité GPS reste appliquée).
   */
  enabled: boolean;
  /** Vitesse à laquelle un fix est considéré comme arrêté (m/s). */
  speedThresholdMs: number;
  /** Durée continue d'arrêt avant la mise en pause (s). */
  durationS: number;
  /**
   * Vitesse minimale pour envisager la reprise (m/s, hystérésis). Les profils
   * gardent leur valeur par sport, y compris sous `MIN_MOVING_SPEED_MS`.
   */
  resumeSpeedThresholdMs: number;
  /** Durée continue de mouvement avant la reprise (s). */
  resumeDurationS: number;
  /** Interruption GPS au-delà de laquelle une temporisation repart à zéro (s). */
  maxFixGapS: number;
  /**
   * Vitesse implicite maximale plausible pour le sport (m/s). Un fix dont la
   * distance divisée par le temps mesuré dépasse ce plafond est une perte de
   * fix, même si le trou est plus long que `MAX_JUMP_WINDOW_S`. Optionnel
   * dans une configuration partielle ; `normalizeConfig` fournit le défaut.
   */
  maxPlausibleSpeedMs?: number;
}

/** Configuration résolue : tous les champs sont présents et finis. */
type ResolvedAutoPauseConfig = Required<AutoPauseConfig>;

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
/** Au-delà, un `t` qui recule est un candidat saut d'horloge, pas un cache GPS. */
const BACKWARD_CLOCK_TOLERANCE_MS = 2_000;
/** Écart minimal entre mesure et réception pour soupçonner un saut d'horloge. */
const CLOCK_DESYNC_TOLERANCE_S = 2;
/** Plafond générique quand le sport n'est pas connu (54 km/h). */
export const DEFAULT_MAX_PLAUSIBLE_SPEED_MS = 15;
const ELE_SMOOTHING = 0.25;

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return Math.max(0, finiteOr(value, fallback));
}

function positiveOr(value: number | undefined, fallback: number): number {
  const next = finiteOr(value, fallback);
  return next > 0 ? next : fallback;
}

function profile(
  speedThresholdMs: number,
  durationS: number,
  resumeSpeedThresholdMs: number,
  resumeDurationS: number,
  maxFixGapS: number,
  maxPlausibleSpeedMs: number
): ResolvedAutoPauseConfig {
  return {
    enabled: true,
    speedThresholdMs,
    durationS,
    // Aucun clamp global : le kayak et l'escalade reprennent sous 0,3 m/s.
    // `movementThresholdS()` abaisse alors le seuil de temps en mouvement pour
    // que la distance ne s'accumule jamais sans durée.
    resumeSpeedThresholdMs,
    resumeDurationS,
    maxFixGapS,
    maxPlausibleSpeedMs,
  };
}

/** Normalise aussi les configs partielles fournies directement. */
function normalizeConfig(config: Partial<AutoPauseConfig> = {}): ResolvedAutoPauseConfig {
  const merged = { ...AUTO_PAUSE_DISABLED, ...config };
  return {
    enabled: merged.enabled === true,
    speedThresholdMs: nonNegativeOr(merged.speedThresholdMs, AUTO_PAUSE_DISABLED.speedThresholdMs),
    durationS: nonNegativeOr(merged.durationS, AUTO_PAUSE_DISABLED.durationS),
    resumeSpeedThresholdMs: nonNegativeOr(
      merged.resumeSpeedThresholdMs,
      AUTO_PAUSE_DISABLED.resumeSpeedThresholdMs
    ),
    resumeDurationS: nonNegativeOr(
      merged.resumeDurationS,
      AUTO_PAUSE_DISABLED.resumeDurationS
    ),
    maxFixGapS: positiveOr(merged.maxFixGapS, AUTO_PAUSE_DISABLED.maxFixGapS),
    maxPlausibleSpeedMs: positiveOr(
      merged.maxPlausibleSpeedMs,
      AUTO_PAUSE_DISABLED.maxPlausibleSpeedMs
    ),
  };
}

const DEFAULT_AUTO_PAUSE = profile(0.139, 120, MIN_MOVING_SPEED_MS, 5, 120, DEFAULT_MAX_PLAUSIBLE_SPEED_MS);

/**
 * Configuration inactive : détection coupée, seuils de plausibilité génériques.
 * L'accumulation des métriques reste celle de l'historique ; seuls les fixes
 * non finis ou invraisemblables sont rejetés.
 */
export const AUTO_PAUSE_DISABLED: ResolvedAutoPauseConfig = {
  ...DEFAULT_AUTO_PAUSE,
  enabled: false,
};

/**
 * Profils par sport. Les valeurs sont des hypothèses réversibles à ajuster
 * depuis les réglages S1.02 sans toucher à la machine à états. Le dernier
 * paramètre est la vitesse implicite maximale plausible : au-delà, le fix est
 * une perte de fix, jamais du mouvement.
 */
export const AUTO_PAUSE_BY_SPORT: Readonly<Record<Sport, AutoPauseConfig>> = {
  // 0,5 km/h ; arrêt court (feu, regroupement) ; reprise à 1,08 km/h.
  course: profile(0.139, 20, MIN_MOVING_SPEED_MS, 3, 60, 15),
  // Profil historique LKDV : 0,5 km/h pendant 120 s. 18 km/h max.
  rando: profile(0.139, 120, MIN_MOVING_SPEED_MS, 5, 120, 5),
  // 1 km/h : le vélo peut osciller lentement sans être à l'arrêt ; reprise 1,8 km/h.
  velo: profile(0.278, 30, 0.5, 3, 60, 25),
  // 0,8 km/h : dérive d'un kayak immobile ; reprise historique à 0,25 m/s.
  kayak: profile(0.222, 45, 0.25, 5, 90, 6),
  // Même logique que la course, avec une trace plus bruitée en montagne.
  trail: profile(0.139, 20, MIN_MOVING_SPEED_MS, 3, 60, 10),
  // 1 km/h : peau de phoque / dérapages lents ne sont pas des arrêts. 144 km/h max.
  ski: profile(0.278, 60, MIN_MOVING_SPEED_MS, 5, 90, 40),
  // Escalade : progression très lente, on attend 3 min avant de conclure ;
  // reprise historique à 0,2 m/s.
  escalade: profile(0.139, 180, 0.2, 5, 120, 3),
  // Balade en famille : les pauses photo/goûter sont longues.
  famille: profile(0.139, 180, MIN_MOVING_SPEED_MS, 8, 120, 6),
  // Bivouac : on ne veut pas couper l'enregistrement à chaque installation.
  bivouac: profile(0.139, 300, MIN_MOVING_SPEED_MS, 10, 300, 6),
};

/**
 * Profil effectif d'un sport, désactivé si le réglage de préparation l'est.
 * La désactivation coupe la détection, pas les seuils du sport : la
 * plausibilité GPS et la coupure de tracé restent celles du sport. Retourne
 * toujours une copie : aucun appelant ne peut muter la table.
 */
export function autoPauseConfigForSport(
  sport: Sport | null | undefined,
  enabled = true,
): AutoPauseConfig {
  if (!sport) return { ...AUTO_PAUSE_DISABLED };
  const base = AUTO_PAUSE_BY_SPORT[sport];
  return enabled ? { ...base } : { ...base, enabled: false };
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

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isValidFix(fix: GpsFix): boolean {
  return (
    Number.isFinite(fix.t) &&
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.lng) &&
    fix.lat >= -90 &&
    fix.lat <= 90 &&
    fix.lng >= -180 &&
    fix.lng <= 180
  );
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

  private config: ResolvedAutoPauseConfig;

  private autoPaused = false;

  private stoppedS = 0;

  private resumingS = 0;

  /** Posé par `breakContinuity()` : le prochain fix valide est une borne. */
  private continuityBroken = false;

  /** Un fix rejeté ne doit pas servir de preuve de continuité. */
  private rejectedSinceLastFix = false;

  /** Dernier instant de mesure ramené dans l'époque courante (ms). */
  private lastEffectiveTMs: number | null = null;

  /** Décalage appliqué à `t` après un saut d'horloge murale (ms). */
  private clockShiftMs = 0;

  /** Premier `t` observé dans une époque plus ancienne (candidat saut). */
  private backwardCandidateTMs: number | null = null;

  constructor(config: Partial<AutoPauseConfig> = AUTO_PAUSE_DISABLED) {
    this.config = normalizeConfig(config);
  }

  get state(): ActivityMetrics {
    return { ...this.metrics, autoPaused: this.autoPaused };
  }

  /**
   * Applique un profil sans perdre les métriques déjà acquises. Utilisé quand
   * le sport ou le réglage de préparation change en cours de sortie.
   */
  setConfig(config: Partial<AutoPauseConfig>): void {
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
    if (!isValidFix(fix)) {
      return this.rejectFix(true);
    }

    if (fix.acc !== undefined && fix.acc !== null) {
      if (!Number.isFinite(fix.acc) || fix.acc < 0 || fix.acc > MAX_ACCURACY_M) {
        return this.rejectFix(true);
      }
    }

    const ele = finiteNumber(fix.ele);
    const rawReportedSpeed = finiteNumber(fix.speed);
    const reportedSpeed =
      rawReportedSpeed === null ? null : Math.max(0, rawReportedSpeed);
    const previous = this.metrics.lastFix;
    if (!previous) {
      this.startNewSegment(fix, false, ele);
      this.continuityBroken = false;
      this.rejectedSinceLastFix = false;
      return this.state;
    }

    // Horodatage qui recule. Un point isolé est un fix périmé
    // (`maximumAge: 2000`) : on le rejette sans faire reculer la borne. Deux
    // points consécutifs dans l'époque basse, en revanche, prouvent un saut de
    // l'horloge murale (NTP, réglage manuel). On rebase alors le curseur pour
    // que l'activité ne reste pas gelée jusqu'au rattrapage de l'ancienne heure.
    if (fix.t <= previous.t) {
      const backwardsMs = previous.t - fix.t;
      const candidate = this.backwardCandidateTMs;
      if (
        backwardsMs > BACKWARD_CLOCK_TOLERANCE_MS &&
        candidate !== null &&
        fix.t > candidate
      ) {
        this.clockShiftMs = (this.lastEffectiveTMs ?? previous.t) - fix.t;
        this.backwardCandidateTMs = null;
        this.rejectedSinceLastFix = false;
        this.continuityBroken = false;
        this.startNewSegment(fix, true, ele);
        return this.state;
      }
      this.backwardCandidateTMs =
        backwardsMs > BACKWARD_CLOCK_TOLERANCE_MS ? fix.t : null;
      return this.rejectFix(false);
    }

    this.backwardCandidateTMs = null;

    // Pause manuelle : le premier fix réellement plus récent devient la
    // nouvelle borne. Un fix périmé (`maximumAge`) a été rejeté juste avant et
    // ne doit pas servir de point de départ à la reprise.
    if (this.continuityBroken) {
      this.continuityBroken = false;
      this.startNewSegment(fix, true, ele);
      this.rejectedSinceLastFix = false;
      return this.state;
    }
    const distance = haversineM(previous, fix);
    const dtS = this.elapsedSeconds(previous, fix, distance, reportedSpeed);

    // Perte de fix : saut impossible dans un laps de temps très court.
    if (dtS <= MAX_JUMP_WINDOW_S && distance > MAX_JUMP_M) {
      return this.rejectFix(true);
    }

    const gap = dtS > this.config.maxFixGapS;
    const speed = reportedSpeed ?? (dtS > 0 ? distance / dtS : 0);
    const effectiveT = (this.lastEffectiveTMs ?? previous.t) + dtS * 1000;

    // Le premier fix qui suit un rejet établit une nouvelle borne, sans
    // comparer sa distance à l'ancienne : après une perte de fix, la position
    // a pu changer légitimement. Sinon un déplacement réel resterait rejeté
    // indéfiniment et l'activité serait gelée. Ce point n'alimente ni distance
    // ni durée ; le tracé est coupé.
    if (!gap && this.rejectedSinceLastFix) {
      this.metrics.lastFix = fix;
      this.metrics.accepted = true;
      this.metrics.discontinuity = true;
      this.lastEffectiveTMs = effectiveT;
      // Une nouvelle borne sans altitude ne doit pas comparer le D+ à
      // l'altitude d'avant le trou.
      this.smoothedEle = ele;
      this.rejectedSinceLastFix = false;
      this.stoppedS = 0;
      this.resumingS = 0;
      return this.state;
    }

    // Plausibilité indépendante de `maxFixGapS` : un saut de 500 m en 30 s
    // n'est pas du mouvement, même si le trou est sous le seuil de coupure.
    // Un vrai trou (`gap`) est déjà traité comme une nouvelle borne plus bas.
    if (!gap && dtS > 0 && distance / dtS > this.config.maxPlausibleSpeedMs) {
      return this.rejectFix(true);
    }

    if (this.config.enabled) {
      // Interruption GPS : la ligne droite et le temps du trou ne sont pas du
      // mouvement observé. La nouvelle borne est la position courante. Seule
      // une vitesse explicitement rapportée par le GPS peut reprendre la
      // détection ; la vitesse déduite du trou ne prouve aucun mouvement.
      if (gap) {
        this.metrics.lastFix = fix;
        this.metrics.accepted = true;
        this.metrics.discontinuity = true;
        this.lastEffectiveTMs = effectiveT;
        // Le premier fix après le trou est une nouvelle borne : si son
        // altitude manque, le D+ repart de zéro au lieu de traverser le trou.
        this.smoothedEle = ele;
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

      // Pause automatique : on garde les fixes pour détecter la reprise, mais
      // aucune métrique n'est accumulée pendant la pause.
      if (this.autoPaused) {
        this.metrics.lastFix = fix;
        this.metrics.accepted = true;
        this.metrics.discontinuity = false;
        this.lastEffectiveTMs = effectiveT;
        if (ele !== null) {
          this.smoothedEle =
            this.smoothedEle === null
              ? ele
              : this.smoothedEle + ELE_SMOOTHING * (ele - this.smoothedEle);
        }
        this.updateAutoPause(dtS, speed);
        return this.state;
      }
    }

    const afterRejection = this.rejectedSinceLastFix;
    this.metrics.distanceM += distance;
    if (speed >= this.movementThresholdS()) this.metrics.movingS += dtS;

    if (ele !== null) {
      const smoothed =
        this.smoothedEle === null
          ? ele
          : this.smoothedEle + ELE_SMOOTHING * (ele - this.smoothedEle);
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
    this.lastEffectiveTMs = effectiveT;
    this.rejectedSinceLastFix = false;

    this.updateAutoPause(dtS, speed);
    return this.state;
  }

  /**
   * Rejette le fix sans toucher à la dernière borne. `markContinuity` arme la
   * nouvelle borne du prochain fix valide (précision, saut, coordonnée
   * invalide) ; un simple retard de livraison ne doit pas, lui, couper la
   * continuité des métriques. `discontinuity` reste celui du dernier fix
   * **accepté**, conformément au contrat d'`ActivityMetrics`.
   */
  private rejectFix(markContinuity: boolean): ActivityMetrics {
    this.metrics.rejected += 1;
    this.metrics.accepted = false;
    if (markContinuity) this.rejectedSinceLastFix = true;
    return this.state;
  }

  /**
   * Durée mesurée entre deux fixes. `t` (mesure) est la référence : une
   * livraison en rafale ne doit pas transformer 20 s de terrain en 1 ms.
   * `receivedAt` ne sert qu'à corriger un saut d'horloge murale prouvé par
   * l'incohérence entre la distance et la vitesse rapportée (ou par un écart
   * massif quand aucune vitesse n'est fournie).
   */
  private elapsedSeconds(
    previous: GpsFix,
    fix: GpsFix,
    distanceM: number,
    reportedSpeed: number | null
  ): number {
    const sampleS = Math.max(0, (fix.t - previous.t) / 1000);
    if (sampleS <= 0) return 0;

    const previousReceivedAt = previous.receivedAt;
    const receivedAt = fix.receivedAt;
    if (
      typeof previousReceivedAt === 'number' &&
      Number.isFinite(previousReceivedAt) &&
      typeof receivedAt === 'number' &&
      Number.isFinite(receivedAt)
    ) {
      const receivedS = Math.max(0, (receivedAt - previousReceivedAt) / 1000);
      if (sampleS > receivedS + CLOCK_DESYNC_TOLERANCE_S) {
        const expectedM =
          reportedSpeed !== null && reportedSpeed > 0 ? reportedSpeed * sampleS : null;
        const distanceIncoherent =
          expectedM !== null && expectedM > 20 && distanceM < expectedM * 0.25;
        // À l'arrêt, aucune distance ne permet de trancher : un écart de
        // plusieurs dizaines de secondes livré presque instantanément est un
        // saut d'horloge, pas une station immobile de 30 s.
        const stationaryDesync =
          sampleS > 10 && receivedS * 10 < sampleS && distanceM < 10;
        const massiveJump = sampleS > 300 && receivedS * 10 < sampleS;
        if (distanceIncoherent || stationaryDesync || massiveJump) {
          const base = this.lastEffectiveTMs ?? previous.t;
          this.clockShiftMs = base + receivedS * 1000 - fix.t;
          return receivedS;
        }
      }
      return sampleS;
    }

    // `receivedAt` absent d'un côté : l'intervalle mesuré reste la seule
    // source, sans mélanger deux horloges.
    return sampleS;
  }

  private startNewSegment(fix: GpsFix, discontinuity: boolean, ele: number | null): void {
    this.metrics.lastFix = fix;
    this.metrics.accepted = true;
    this.metrics.discontinuity = discontinuity;
    this.lastEffectiveTMs = fix.t + this.clockShiftMs;
    this.backwardCandidateTMs = null;
    this.smoothedEle = ele;
    this.resetAutoPause();
  }

  /**
   * Seuil qui alimente `movingS`. Quand l'auto-pause est active, un sport lent
   * (kayak 0,25 m/s, escalade 0,2 m/s) compte son mouvement à son propre seuil
   * de reprise : la distance ne s'accumule jamais sans durée. Désactivée, on
   * garde le 0,3 m/s historique.
   */
  private movementThresholdS(): number {
    return this.config.enabled
      ? Math.min(MIN_MOVING_SPEED_MS, this.config.resumeSpeedThresholdMs)
      : MIN_MOVING_SPEED_MS;
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
