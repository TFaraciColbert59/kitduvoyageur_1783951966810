/**
 * Meilleurs efforts vélo — calculs purs, sans réseau ni persistance.
 *
 * S2.23 (« Meilleurs efforts à vélo ») ne peut s'appuyer que sur le contrat de
 * séance déjà transporté par le Compte : `distance_km`, `elevation_gain_m`,
 * `duration_seconds` et le sport issu de `activity_sessions` (ou de la
 * variante). Aucun flux GPS, aucun échantillon de puissance et aucun segment
 * ne sont exposés dans ce contrat. Le moteur reste donc au niveau de la
 * **séance** : il ne fabrique ni meilleur effort sur une distance normalisée,
 * ni vitesse maximale, ni puissance.
 *
 * Règles de fidélité :
 *   - seules les séances terminées, dont le sport est exactement `velo`, sont
 *     éligibles ; un sport absent ou inconnu n'est jamais attribué au vélo ;
 *   - une mesure absente reste absente (jamais remplacée par zéro) ;
 *   - la distance et le dénivelé sont des mesures enregistrées ;
 *   - la vitesse est une **moyenne calculée** à partir de la distance et de la
 *     durée enregistrées, sans recalcul du temps en mouvement ; ce n'est pas
 *     une mesure de vitesse ;
 *   - la puissance est déclarée indisponible : aucune source ne la fournit et
 *     aucune estimation n'est produite ;
 *   - les périodes sont découpées dans le fuseau choisi, avec un tie-break
 *     explicite (valeur décroissante, puis première performance, puis id).
 *
 * Aucune migration : le calcul est refait à chaque lecture du bootstrap, donc
 * une correction de séance retire naturellement un record devenu invalide.
 * Voir `docs/compte/A05-S2.23-MEILLEURS-EFFORTS.md`.
 */

import {
  isDone,
  localDateKey,
  periodRange,
  type ProgressionDateRange,
  type ProgressionPeriod,
  type ProgressionSession,
} from './engine';

/** Sport canonique de la taxonomie `explorer_sport_map`. */
export const BEST_EFFORT_SPORT = 'velo';

/** Nombre de performances affichées par métrique (la première est le record). */
export const BEST_EFFORT_TOP = 3;

export type BestEffortMetricId = 'distance' | 'elevation' | 'speed' | 'power';

/**
 * Provenance d'une valeur :
 *   - `measured` : valeur enregistrée par la séance ;
 *   - `calculated` : valeur dérivée de mesures enregistrées ;
 *   - `unavailable` : aucune mesure source, aucune estimation.
 */
export type BestEffortProvenance = 'measured' | 'calculated' | 'unavailable';

export type BestEffortUnit = 'km' | 'm' | 'km/h' | 'W';

export interface BestEffortCandidate {
  sessionId: string;
  title: string;
  /** Valeur dans l'unité canonique de la métrique. */
  value: number;
  /** Date de début enregistrée, telle quelle. */
  achievedAt: string | null;
  /** Date civile dans le fuseau demandé, ou `null` si illisible. */
  achievedDate: string | null;
  massif: string | null;
}

export interface BestEffortRecord {
  id: BestEffortMetricId;
  label: string;
  shortLabel: string;
  unit: BestEffortUnit;
  provenance: BestEffortProvenance;
  provenanceLabel: string;
  /** Meilleure valeur disponible, ou `null` si aucune mesure exploitable. */
  value: number | null;
  /** Première performance du classement, ou `null`. */
  best: BestEffortCandidate | null;
  /** Jusqu'à `BEST_EFFORT_TOP` performances, déjà classées. */
  top: BestEffortCandidate[];
  /** Séances vélo éligibles portant une valeur exploitable. */
  present: number;
  /** Séances vélo éligibles dont la mesure est absente. */
  missing: number;
  /** Séances vélo éligibles dont la valeur est présente mais non exploitable. */
  unusable: number;
  /** Explication d'une indisponibilité, ou `null` si une valeur existe. */
  reason: string | null;
  /** Limite de lecture affichée avec la valeur. */
  caveat: string;
}

export interface BestEffortsResult {
  period: ProgressionPeriod;
  range: ProgressionDateRange;
  /** Séances vélo terminées et comprises dans la période. */
  cyclingDone: number;
  /** Séances terminées de la période dont le sport est inconnu. */
  excludedUnknownSport: number;
  /** Séances terminées de la période appartenant à un autre sport connu. */
  excludedOtherSport: number;
  /** Séances vélo de la période non terminées. */
  excludedNotDone: number;
  /** Métriques dans l'ordre d'affichage. */
  records: BestEffortRecord[];
}

interface CandidateValue {
  status: 'ok' | 'missing' | 'unusable';
  value?: number;
}

interface MetricDefinition {
  id: BestEffortMetricId;
  label: string;
  shortLabel: string;
  unit: BestEffortUnit;
  provenance: Exclude<BestEffortProvenance, 'unavailable'>;
  caveat: string;
  pick: (session: ProgressionSession) => CandidateValue;
}

const OK = (value: number): CandidateValue => ({ status: 'ok', value });
const MISSING: CandidateValue = { status: 'missing' };
const UNUSABLE: CandidateValue = { status: 'unusable' };

/**
 * Une valeur strictement positive est nécessaire : un zéro enregistré n'est
 * pas un « meilleur effort » et n'est jamais promu en record. Il n'est pas
 * pour autant traité comme une mesure absente.
 */
function positive(value: number | null): CandidateValue {
  if (value === null || !Number.isFinite(value)) return MISSING;
  if (value <= 0) return UNUSABLE;
  return OK(value);
}

const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: 'distance',
    label: 'Distance',
    shortLabel: 'Plus longue sortie',
    unit: 'km',
    provenance: 'measured',
    caveat: 'Distance de séance enregistrée, pas un meilleur effort sur une distance normalisée.',
    pick: (session) => positive(session.km),
  },
  {
    id: 'elevation',
    label: 'Dénivelé positif',
    shortLabel: 'Plus gros dénivelé',
    unit: 'm',
    provenance: 'measured',
    caveat: 'Dénivelé positif enregistré sur la séance, sans correction de trace.',
    pick: (session) => positive(session.dplus),
  },
  {
    id: 'speed',
    label: 'Vitesse moyenne',
    shortLabel: 'Meilleure moyenne',
    unit: 'km/h',
    provenance: 'calculated',
    caveat:
      'Vitesse moyenne calculée depuis la distance et la durée enregistrées, sans recalcul du temps en mouvement ; ce n’est pas une vitesse maximale.',
    pick: (session) => {
      if (session.km === null || session.durationS === null) return MISSING;
      if (!Number.isFinite(session.km) || !Number.isFinite(session.durationS)) return MISSING;
      if (session.km <= 0 || session.durationS <= 0) return UNUSABLE;
      const speed = session.km / (session.durationS / 3600);
      if (!Number.isFinite(speed) || speed <= 0) return UNUSABLE;
      return OK(speed);
    },
  },
];

function candidateFrom(session: ProgressionSession, value: number, timeZone: string): BestEffortCandidate {
  return {
    sessionId: session.id,
    title: session.title,
    value,
    achievedAt: session.startedAt,
    achievedDate: localDateKey(session.startedAt, timeZone),
    massif: session.massif,
  };
}

/**
 * Classement déterministe : meilleure valeur, puis la performance la plus
 * ancienne (première atteinte), puis l'identifiant de séance pour départager
 * deux séances au même instant. Le classement ne dépend ni du fuseau ni de
 * l'ordre de la liste d'entrée.
 */
export function compareBestEffortCandidates(
  left: BestEffortCandidate,
  right: BestEffortCandidate
): number {
  if (right.value !== left.value) return right.value - left.value;
  const leftTime = left.achievedAt ? Date.parse(left.achievedAt) : Number.NaN;
  const rightTime = right.achievedAt ? Date.parse(right.achievedAt) : Number.NaN;
  const leftSafe = Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY;
  const rightSafe = Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY;
  if (leftSafe !== rightSafe) return leftSafe - rightSafe;
  return left.sessionId.localeCompare(right.sessionId);
}

function unavailableReason(
  definition: MetricDefinition,
  cyclingDone: number,
  missing: number,
  unusable: number
): string {
  if (cyclingDone === 0) return 'Aucune séance vélo terminée sur la période.';
  if (definition.id === 'speed') {
    if (missing > 0 && unusable === 0) {
      return `${missing} séance(s) vélo sans distance ou durée enregistrée.`;
    }
    if (unusable > 0 && missing === 0) {
      return `Aucune vitesse calculable : distance ou durée non strictement positive sur ${unusable} séance(s).`;
    }
    return `${missing} séance(s) sans distance ou durée et ${unusable} séance(s) non exploitables.`;
  }
  const label = definition.id === 'distance' ? 'distance' : 'dénivelé positif';
  if (missing > 0 && unusable === 0) {
    return `${missing} séance(s) vélo sans ${label} enregistré.`;
  }
  if (unusable > 0 && missing === 0) {
    return `Aucune mesure de ${label} strictement positive enregistrée.`;
  }
  if (missing > 0) {
    return `${missing} séance(s) sans ${label} et ${unusable} valeur(s) non exploitable(s).`;
  }
  return `Aucune mesure de ${label} exploitable sur la période.`;
}

function buildMeasuredRecord(
  definition: MetricDefinition,
  sessions: readonly ProgressionSession[],
  timeZone: string,
  cyclingDone: number
): BestEffortRecord {
  const candidates: BestEffortCandidate[] = [];
  let missing = 0;
  let unusable = 0;

  for (const session of sessions) {
    const picked = definition.pick(session);
    if (picked.status === 'missing') {
      missing += 1;
      continue;
    }
    if (picked.status === 'unusable' || picked.value === undefined) {
      unusable += 1;
      continue;
    }
    candidates.push(candidateFrom(session, picked.value, timeZone));
  }

  candidates.sort(compareBestEffortCandidates);
  const top = candidates.slice(0, BEST_EFFORT_TOP);
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    unit: definition.unit,
    provenance: definition.provenance,
    provenanceLabel: definition.provenance === 'measured' ? 'mesuré' : 'calculé',
    value: top[0]?.value ?? null,
    best: top[0] ?? null,
    top,
    present: candidates.length,
    missing,
    unusable,
    reason: top.length > 0 ? null : unavailableReason(definition, cyclingDone, missing, unusable),
    caveat: definition.caveat,
  };
}

/**
 * Puissance : aucune colonne, aucun capteur et aucune estimation dans le
 * contrat actuel. La carte est rendue avec `value: null` et une provenance
 * `unavailable` ; elle ne doit jamais être remplie par un calcul de vitesse,
 * de dénivelé ou de durée.
 */
function buildPowerRecord(cyclingDone: number): BestEffortRecord {
  return {
    id: 'power',
    label: 'Puissance',
    shortLabel: 'Puissance mesurée',
    unit: 'W',
    provenance: 'unavailable',
    provenanceLabel: 'indisponible',
    value: null,
    best: null,
    top: [],
    present: 0,
    missing: cyclingDone,
    unusable: 0,
    reason:
      cyclingDone === 0
        ? 'Aucune séance vélo terminée sur la période.'
        : 'Aucune mesure de puissance n’est enregistrée par les séances LKDV. Aucune estimation n’est produite.',
    caveat:
      'La puissance exigerait un capteur ou des échantillons exploitables. Aucun des deux n’est présent dans le contrat Compte.',
  };
}

/**
 * Construit les meilleurs efforts vélo d'une période.
 *
 * @param sessions séances compactes du propriétaire (bootstrap authentifié)
 * @param period période civile, découpée dans `timeZone`
 * @param timeZone fuseau résolu par l'écran (profil, navigateur ou UTC)
 * @param now instant de référence, injectable pour un rendu déterministe
 */
export function buildBestEfforts(
  sessions: readonly ProgressionSession[],
  period: ProgressionPeriod,
  timeZone: string,
  now: Date = new Date()
): BestEffortsResult {
  const range = periodRange(period, timeZone, now);
  const nowMs = now.getTime();
  const cycling: ProgressionSession[] = [];
  let excludedUnknownSport = 0;
  let excludedOtherSport = 0;
  let excludedNotDone = 0;

  for (const session of sessions) {
    const dateKey = localDateKey(session.startedAt, timeZone);
    if (!dateKey || dateKey < range.startKey || dateKey > range.endKey) continue;

    const done = isDone(session, nowMs);
    if (session.sport === BEST_EFFORT_SPORT) {
      if (!done) {
        excludedNotDone += 1;
        continue;
      }
      cycling.push(session);
      continue;
    }

    // Les autres sports ne sont comptés que s'ils sont terminés : la vue vélo
    // explique ce qu'elle exclut, sans prétendre à un agrégat multisport.
    if (!done) continue;
    if (!session.sport?.trim()) excludedUnknownSport += 1;
    else excludedOtherSport += 1;
  }

  const cyclingDone = cycling.length;
  const records: BestEffortRecord[] = [
    ...METRIC_DEFINITIONS.map((definition) =>
      buildMeasuredRecord(definition, cycling, timeZone, cyclingDone)
    ),
    buildPowerRecord(cyclingDone),
  ];

  return {
    period,
    range,
    cyclingDone,
    excludedUnknownSport,
    excludedOtherSport,
    excludedNotDone,
    records,
  };
}

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Formate une valeur dans l'unité canonique de sa métrique. */
export function formatBestEffortValue(id: BestEffortMetricId, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (id === 'distance') return `${numberFormat.format(value)} km`;
  if (id === 'elevation') return `+${Math.round(value).toLocaleString('fr-FR')} m`;
  if (id === 'speed') return `${numberFormat.format(value)} km/h`;
  return `${Math.round(value).toLocaleString('fr-FR')} W`;
}

/** Unité affichable, indépendamment de la valeur. */
export function bestEffortUnitLabel(unit: BestEffortUnit): string {
  return unit === 'm' ? 'mètres' : unit === 'km' ? 'kilomètres' : unit;
}
