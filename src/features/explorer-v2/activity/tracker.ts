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
 *     rejetée même si le trou dure plus de 2 s et moins que `maxFixGapS`.
 *   - au-delà de `maxFixGapS`, l'intervalle est une inconnue : la position
 *     courante devient une nouvelle borne, sans distance ni durée, même quand
 *     l'auto-pause est désactivée. Le tracé est toujours coupé.
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
 * distance, la durée et la plausibilité, car une livraison en rafale ne
 * raccourcit pas le trajet réel. `receivedAt` ne corrige qu'un saut d'horloge
 * murale **prouvé** : distance incohérente avec la vitesse rapportée, ou écart
 * mesure/réception important alors que la réception a réellement pris du temps
 * (un lot de fixes livré en quelques millisecondes reste une rafale). Un `t`
 * qui recule est d'abord traité comme un fix périmé ; trois mesures consécutives
 * et croissantes dans une époque plus ancienne prouvent un saut d'horloge et
 * rebasent le curseur sans geler l'activité. Deux fixes périmés d'un buffer ne
 * suffisent donc plus à faire reculer la carte.
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

import type { ActivitySplit, Sport } from '../state/types';
import {
  addSplitInterval,
  cloneSplits,
  closeLap,
  createSplitsState,
  MIN_LAP_DISTANCE_M,
} from './splits';

export interface GpsFix {
  t: number;
  lat: number;
  lng: number;
  ele?: number | null;
  /** Précision horizontale en mètres. */
  acc?: number | null;
  speed?: number | null;
  /**
   * Horodatage monotone de réception (ms). Sert uniquement de preuve pour
   * corriger un saut de l'horloge murale `t` : la mesure reste la référence
   * des durées, y compris quand plusieurs fixes arrivent dans la même rafale.
   * Absent, la durée retombe sur `t` (comportement historique des appels
   * directs et des tests).
   */
  receivedAt?: number;
}

export interface AutoPauseConfig {
  /**
   * Active la détection. `false` coupe l'arrêt/reprise automatique ; les
   * métriques gardent l'accumulation historique sous `maxFixGapS`, hors fixes
   * invraisemblables (la plausibilité GPS reste appliquée). Au-delà de
   * `maxFixGapS`, le trou reste une nouvelle borne sans distance ni durée.
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
  /**
   * Instant corrigé du dernier fix accepté, sur une échelle monotone : il
   * rebase les sauts d'horloge et ne recule jamais. `null` tant qu'aucun fix
   * n'a été accepté. Les consommateurs qui mesurent une durée (hors-trace,
   * par exemple) doivent l'utiliser à la place de `lastFix.t`.
   */
  effectiveTMs: number | null;
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
  /**
   * Splits kilométriques réels. Chaque intervalle accepté est affecté au
   * segment courant ; un seuil franchi ferme le split et en ouvre un suivant.
   * Les pauses et les trous GPS n'ajoutent ni distance ni temps.
   */
  splits: ActivitySplit[];
  /** Même découpe par mile, calculée en parallèle pour les unités impériales. */
  mileSplits: ActivitySplit[];
  /** Tours manuels réels, indépendants des splits kilométriques. */
  laps: ActivitySplit[];
}

export const MAX_ACCURACY_M = 30;
export const MIN_MOVING_SPEED_MS = 0.3;
export const MAX_JUMP_M = 100;
export const MAX_JUMP_WINDOW_S = 2;
/** Au-delà, un `t` qui recule est un candidat saut d'horloge, pas un cache GPS. */
const BACKWARD_CLOCK_TOLERANCE_MS = 2_000;
/** Écart minimal entre mesure et réception pour soupçonner un saut d'horloge. */
const CLOCK_DESYNC_TOLERANCE_S = 2;
/**
 * En dessous, le lot de fixes est considéré comme livré en rafale : le temps
 * de réception ne prouve rien et ne doit jamais remplacer la mesure. Au-delà,
 * un écart important peut être un vrai saut d'horloge.
 */
const CLOCK_BURST_RECEIVED_S = 1;
/** Marge supplémentaire pour un saut en mouvement sans vitesse rapportée. */
const CLOCK_MOVING_RECEIVED_S = 2;
/** Rapport et écart minimaux entre mesure et réception pour parler de saut. */
const CLOCK_MIN_RATIO = 3;
const CLOCK_MIN_DIFF_S = 10;
/** Plafond générique quand le sport n'est pas connu (54 km/h). */
export const DEFAULT_MAX_PLAUSIBLE_SPEED_MS = 15;
const ELE_SMOOTHING = 0.25;
/**
 * Fenêtre de preuve pour un `speed` GPS rapporté à 0. Un zéro est une mesure
 * d'arrêt valide : on ne le remplace par la vitesse déduite que si la position
 * a réellement progressé (déplacement net suffisant) sur une durée assez
 * longue pour ne pas confondre le jitter stationnaire avec de la marche.
 *
 * 90 s, et non 20 s : à 0,3 m/s (le seuil de reprise de la randonnée), 8 m
 * exigent 26,7 s. L'ancien plafond de 20 s rendait la preuve mathématiquement
 * impossible entre 0,3 et 0,4 m/s et gelait la distance d'un marcheur lent dont
 * le GPS rapporte `speed: 0`. La fenêtre couvre aussi les sports plus lents
 * (kayak 0,25 m/s, escalade 0,2 m/s) et une précision moyenne.
 */
const ZERO_SPEED_WINDOW_MS = 90_000;
const ZERO_SPEED_MIN_SPAN_S = 10;
const ZERO_SPEED_MIN_DISPLACEMENT_M = 8;
/**
 * Le bruit d'un GPS à 20 m de précision peut déplacer le point de 20 m sans
 * mouvement réel. On exige donc `max(8 m, 2 × précision)` de déplacement net,
 * plafonné à 60 m (précision maximale acceptée : 30 m).
 */
const ZERO_SPEED_ACCURACY_FACTOR = 2;
const ZERO_SPEED_MAX_DISPLACEMENT_M = 60;

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
 * L'accumulation des métriques reste celle de l'historique sous `maxFixGapS` ;
 * seuls les fixes non finis ou invraisemblables sont rejetés. Au-delà de
 * `maxFixGapS`, le trou est une nouvelle borne sans distance ni durée. La
 * règle « premier fix après un rejet = nouvelle borne » continue de
 * s'appliquer, même sur un trou long : elle évite de compter un intervalle
 * non prouvé.
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

function initialMetrics(): Omit<ActivityMetrics, 'autoPaused'> {
  const splits = createSplitsState();
  return {
    distanceM: 0,
    elevGainM: 0,
    movingS: 0,
    lastFix: null,
    effectiveTMs: null,
    rejected: 0,
    accepted: false,
    discontinuity: false,
    splits: splits.km,
    mileSplits: splits.mi,
    laps: splits.laps,
  };
}

export class ActivityTracker {
  private metrics: Omit<ActivityMetrics, 'autoPaused'> = initialMetrics();

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

  /** Dernier `t` observé dans une époque plus ancienne (candidat saut). */
  private backwardCandidateTMs: number | null = null;

  /** Nombre de mesures consécutives dans cette époque basse. */
  private backwardCandidateCount = 0;

  /** Réception du premier fix de l'époque basse, pour écarter une rafale. */
  private backwardCandidateReceivedAtMs: number | null = null;

  /** Fenêtre des fixes à `speed: 0`, pour distinguer arrêt et vitesse figée. */
  private zeroSpeedWindow: Array<{ t: number; fix: GpsFix }> = [];

  constructor(config: Partial<AutoPauseConfig> = AUTO_PAUSE_DISABLED) {
    this.config = normalizeConfig(config);
  }

  get state(): ActivityMetrics {
    return {
      ...this.metrics,
      autoPaused: this.autoPaused,
      splits: cloneSplits(this.metrics.splits),
      mileSplits: cloneSplits(this.metrics.mileSplits),
      laps: cloneSplits(this.metrics.laps),
    };
  }

  /**
   * Ferme le tour manuel courant. Sans distance mesurée, ne crée aucun tour
   * vide. Les splits kilométriques et impériaux ne sont pas remis à zéro :
   * les découpes restent indépendantes.
   */
  markLap(): ActivityMetrics {
    const before = this.metrics.laps[this.metrics.laps.length - 1];
    if (!before || before.distanceM < MIN_LAP_DISTANCE_M) return this.state;
    const next = closeLap({
      km: this.metrics.splits,
      mi: this.metrics.mileSplits,
      laps: this.metrics.laps,
    });
    this.metrics.laps = next.laps;
    return this.state;
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
      // Le premier fix à `speed: 0` est la borne de la fenêtre : sans lui, un
      // déplacement réel dès le départ perdrait son premier intervalle.
      if (reportedSpeed === 0) {
        this.zeroSpeedWindow = [{ t: this.lastEffectiveTMs ?? fix.t, fix }];
      }
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
      const continuesLowerEpoch =
        backwardsMs > BACKWARD_CLOCK_TOLERANCE_MS &&
        candidate !== null &&
        fix.t > candidate;
      if (continuesLowerEpoch) {
        // Un seul fix périmé ne prouve rien ; deux non plus quand ils
        // proviennent du même buffer et progressent seulement de quelques
        // secondes. On attend une troisième mesure croissante dans l'époque
        // basse avant de rebaser la carte.
        this.backwardCandidateCount += 1;
        this.backwardCandidateTMs = fix.t;
        if (
          this.backwardCandidateCount >= 3 &&
          this.lowerEpochLooksCorroborated(fix)
        ) {
          this.clockShiftMs = (this.lastEffectiveTMs ?? previous.t) - fix.t;
          this.backwardCandidateTMs = null;
          this.backwardCandidateCount = 0;
          this.rejectedSinceLastFix = false;
          this.continuityBroken = false;
          this.startNewSegment(fix, true, ele);
          return this.state;
        }
        return this.rejectFix(false);
      }
      this.backwardCandidateTMs =
        backwardsMs > BACKWARD_CLOCK_TOLERANCE_MS ? fix.t : null;
      this.backwardCandidateCount =
        backwardsMs > BACKWARD_CLOCK_TOLERANCE_MS ? 1 : 0;
      this.backwardCandidateReceivedAtMs =
        backwardsMs > BACKWARD_CLOCK_TOLERANCE_MS ? finiteNumber(fix.receivedAt) : null;
      return this.rejectFix(false);
    }

    this.backwardCandidateTMs = null;
    this.backwardCandidateCount = 0;
    this.backwardCandidateReceivedAtMs = null;

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
    // Le trou se mesure sur l'horloge de mesure, avant toute correction : un
    // `receivedAt` qui compresse un intervalle réel de 5 min ne doit pas le
    // faire passer sous `maxFixGapS` et relier deux points par une corde.
    const measuredS = Math.max(0, (fix.t - previous.t) / 1000);

    // Perte de fix : saut impossible dans un laps de temps très court.
    if (dtS <= MAX_JUMP_WINDOW_S && distance > MAX_JUMP_M) {
      return this.rejectFix(true);
    }

    const gap = measuredS > this.config.maxFixGapS;
    // `speed: 0` est une mesure d'arrêt : il n'est remplacé par la vitesse
    // déduite que si un déplacement net prouve que le GPS est figé. Sans cela,
    // le jitter stationnaire faisait croire à un mouvement et l'auto-pause ne
    // s'accumulait jamais.
    const inferredSpeed = dtS > 0 ? distance / dtS : 0;
    const effectiveT = (this.lastEffectiveTMs ?? previous.t) + dtS * 1000;
    // Un saut d'horloge compresse ou étire le temps : la fenêtre `speed: 0`
    // ne doit pas traverser la correction, sinon 5 m de jitter étalés sur
    // 30 s deviendraient 2,5 m/s. Elle repart de la nouvelle borne.
    if (Math.abs(dtS - measuredS) > 1e-6) this.zeroSpeedWindow = [];
    const speed = this.resolveSpeed(reportedSpeed, inferredSpeed, fix, effectiveT);

    // Le premier fix qui suit un rejet établit une nouvelle borne, sans
    // comparer sa distance à l'ancienne : après une perte de fix, la position
    // a pu changer légitimement. Sinon un déplacement réel resterait rejeté
    // indéfiniment et l'activité serait gelée. Cette règle s'applique aussi
    // quand le fix suivant tombe après un trou (`gap`) et quand la détection
    // automatique est désactivée : sinon le trou entier serait compté. Ce
    // point n'alimente ni distance ni durée ; le tracé est coupé.
    if (this.rejectedSinceLastFix) {
      this.metrics.lastFix = fix;
      this.metrics.accepted = true;
      this.metrics.discontinuity = true;
      this.lastEffectiveTMs = effectiveT;
      this.metrics.effectiveTMs = effectiveT;
      // Une nouvelle borne sans altitude ne doit pas comparer le D+ à
      // l'altitude d'avant le trou.
      this.smoothedEle = ele;
      this.rejectedSinceLastFix = false;
      this.stoppedS = 0;
      this.resumingS = 0;
      this.zeroSpeedWindow = [];
      // Même règle que la branche « trou » : après une coupure, une vitesse
      // explicitement rapportée suffit à lever une pause automatique, sinon on
      // resterait pausé jusqu'à la prochaine série.
      if (
        gap &&
        this.autoPaused &&
        reportedSpeed !== null &&
        reportedSpeed >= this.config.resumeSpeedThresholdMs
      ) {
        this.autoPaused = false;
      }
      return this.state;
    }

    // Plausibilité indépendante de `maxFixGapS` : un saut de 500 m en 30 s
    // n'est pas du mouvement, même si le trou est sous le seuil de coupure.
    // Un vrai trou (`gap`) est déjà traité comme une nouvelle borne plus bas.
    if (!gap && dtS > 0 && distance / dtS > this.config.maxPlausibleSpeedMs) {
      return this.rejectFix(true);
    }

    // Interruption GPS : la ligne droite et le temps du trou ne sont pas du
    // mouvement observé. La nouvelle borne est la position courante. La règle
    // vaut aussi auto-pause désactivée : un trou de 5 km ne devient jamais du
    // mouvement, seule la détection d'arrêt est coupée par le réglage.
    if (gap) {
      this.metrics.lastFix = fix;
      this.metrics.accepted = true;
      this.metrics.discontinuity = true;
      this.lastEffectiveTMs = effectiveT;
      this.metrics.effectiveTMs = effectiveT;
      // Le premier fix après le trou est une nouvelle borne : si son altitude
      // manque, le D+ repart de zéro au lieu de traverser le trou.
      this.smoothedEle = ele;
      this.rejectedSinceLastFix = false;
      this.stoppedS = 0;
      this.resumingS = 0;
      this.zeroSpeedWindow = [];
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

    if (this.config.enabled) {
      // Pause automatique : on garde les fixes pour détecter la reprise, mais
      // aucune métrique n'est accumulée pendant la pause.
      if (this.autoPaused) {
        this.metrics.lastFix = fix;
        this.metrics.accepted = true;
        this.metrics.discontinuity = false;
        this.lastEffectiveTMs = effectiveT;
        this.metrics.effectiveTMs = effectiveT;
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

    const moving = this.atOrAbove(speed, this.movementThresholdS());
    this.metrics.distanceM += distance;
    if (moving) this.metrics.movingS += dtS;

    // Seuls les intervalles qui viennent d'être ajoutés aux métriques entrent
    // dans les splits. Un intervalle non « en mouvement » avance la distance
    // mais pas la durée : le split reste cohérent avec `movingS`.
    if (distance > 0) {
      const next = addSplitInterval(
        {
          km: this.metrics.splits,
          mi: this.metrics.mileSplits,
          laps: this.metrics.laps,
        },
        distance,
        moving ? dtS : 0,
      );
      this.metrics.splits = next.km;
      this.metrics.mileSplits = next.mi;
      this.metrics.laps = next.laps;
    }

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
    this.metrics.discontinuity = gap;
    this.lastEffectiveTMs = effectiveT;
    this.metrics.effectiveTMs = effectiveT;
    this.rejectedSinceLastFix = false;

    this.updateAutoPause(dtS, speed);
    return this.state;
  }

  /**
   * Trois fixes dans l'époque basse suffisent en général à identifier un vrai
   * saut d'horloge. Quand les réceptions sont renseignées, on exige en plus
   * qu'elles ne soient pas toutes tombées dans la même rafale : un buffer qui
   * draine trois points périmés ne doit pas faire reculer la carte.
   */
  private lowerEpochLooksCorroborated(fix: GpsFix): boolean {
    const received = finiteNumber(fix.receivedAt);
    const firstReceived = this.backwardCandidateReceivedAtMs;
    if (firstReceived === null || received === null) return true;
    return received - firstReceived >= CLOCK_BURST_RECEIVED_S * 1000;
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
   * `receivedAt` ne corrige que les sauts d'horloge muraux prouvés :
   * distance incohérente avec la vitesse rapportée, ou écart mesure/réception
   * important alors que la réception a réellement duré. Un lot reçu en
   * quelques millisecondes reste une rafale et garde le temps mesuré.
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
        // Un saut d'horloge n'est retenu que si la réception a pris du temps.
        // Plusieurs fixes livrés dans la même milliseconde constituent une
        // rafale : leur temps de réception ne prouve aucun saut.
        const receivedTookTime = receivedS >= CLOCK_BURST_RECEIVED_S;
        const measuredJump =
          sampleS - receivedS >= CLOCK_MIN_DIFF_S &&
          sampleS >= CLOCK_MIN_RATIO * Math.max(receivedS, 0.001);
        // À l'arrêt, la distance ne peut pas contredire l'horloge : un écart
        // important, une réception lente et quelques mètres de jitter
        // suffisent à conclure au saut. Le seuil de 10 m couvre le GPS
        // stationnaire sans avaler un vrai déplacement lent.
        const stationaryJump = receivedTookTime && distanceM < 10 && measuredJump;
        // En mouvement sans vitesse rapportée, exiger un peu plus de recul de
        // réception évite de confondre un lot livré en 1 s avec un saut.
        const movingWithoutSpeedJump =
          reportedSpeed === null && receivedS >= CLOCK_MOVING_RECEIVED_S && measuredJump;
        if (
          (distanceIncoherent && receivedTookTime) ||
          stationaryJump ||
          movingWithoutSpeedJump
        ) {
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
    this.metrics.effectiveTMs = this.lastEffectiveTMs;
    this.backwardCandidateTMs = null;
    this.backwardCandidateCount = 0;
    this.backwardCandidateReceivedAtMs = null;
    this.smoothedEle = ele;
    this.resetAutoPause();
  }

  /**
   * Comparaison de vitesse avec 1 % de tolérance. Une trace à 0,3 m/s
   * convertie en degrés peut mesurer 0,2997 m/s : sans cette marge, la preuve
   * `speed: 0` resterait sous le seuil de reprise et le mouvement lent serait
   * encore ignoré.
   */
  private atOrAbove(speed: number, threshold: number): boolean {
    return speed + Math.max(1e-9, threshold * 0.01) >= threshold;
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

  /**
   * Vitesse retenue pour les métriques et l'auto-pause.
   *
   * - vitesse rapportée > 0 : prioritaire ;
   * - vitesse absente : vitesse déduite, comportement historique ;
   * - vitesse rapportée = 0 : arrêt, sauf preuve d'un `speed` figé (déplacement
   *   net ≥ 8 m sur ≥ 10 s, soit un mouvement soutenu hors du bruit GPS).
   */
  private resolveSpeed(
    reportedSpeed: number | null,
    inferredSpeed: number,
    fix: GpsFix,
    effectiveT: number,
  ): number {
    if (reportedSpeed === null) {
      // Une vitesse inconnue ne prouve ni l'arrêt ni le mouvement : la fenêtre
      // de preuve repart de zéro au lieu de réutiliser un point d'avant elle.
      this.zeroSpeedWindow = [];
      return inferredSpeed;
    }
    if (reportedSpeed > 0) {
      this.zeroSpeedWindow = [];
      return reportedSpeed;
    }

    const window = this.zeroSpeedWindow;
    window.push({ t: effectiveT, fix });
    while (window.length > 1 && effectiveT - window[0].t > ZERO_SPEED_WINDOW_MS) {
      window.shift();
    }
    const first = window[0];
    const spanS = (effectiveT - first.t) / 1000;
    if (spanS >= ZERO_SPEED_MIN_SPAN_S) {
      const displacement = haversineM(first.fix, fix);
      const sustainedSpeed = displacement / spanS;
      const accuracy = Math.max(
        finiteNumber(first.fix.acc) ?? 0,
        finiteNumber(fix.acc) ?? 0,
      );
      const required = Math.min(
        ZERO_SPEED_MAX_DISPLACEMENT_M,
        Math.max(ZERO_SPEED_MIN_DISPLACEMENT_M, accuracy * ZERO_SPEED_ACCURACY_FACTOR),
      );
      if (
        // La distance haversine peut rendre 9,999 999 m pour 10 m exactement :
        // sans cette tolérance, la preuve échouerait au premier palier.
        displacement + 0.05 >= required &&
        this.atOrAbove(sustainedSpeed, this.config.resumeSpeedThresholdMs)
      ) {
        return sustainedSpeed;
      }
    }
    return 0;
  }

  private resetAutoPause(): void {
    this.autoPaused = false;
    this.stoppedS = 0;
    this.resumingS = 0;
    this.zeroSpeedWindow = [];
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
    if (this.atOrAbove(speed, this.config.resumeSpeedThresholdMs)) {
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
