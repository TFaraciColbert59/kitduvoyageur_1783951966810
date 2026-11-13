/**
 * Séries de métriques d'activité (A04 · S2.06/S2.07).
 *
 * Contrat volontairement strict :
 *   - une série n'existe que si une source a réellement fourni une valeur ;
 *   - une valeur absente ne produit aucun point, jamais un zéro ;
 *   - les calories et les pas ne sont **jamais** déduits de la distance, de la
 *     durée ou du poids : ils n'apparaissent que si un connecteur les fournit ;
 *   - l'allure est dérivée de la vitesse ; la vitesse d'intervalle n'est
 *     dérivée que lorsque la source ne la fournit pas.
 *
 * Les valeurs sont stockées dans l'unité canonique (SI ou unité de comptage) :
 * m, m/s, s/km, bpm, spm, W, °C, kcal, pas. La conversion d'affichage est
 * faite par `formatMetricValue`.
 *
 * Aucun capteur cardio, cadence, puissance, température, podomètre ou énergie
 * n'est branché dans l'Explorer aujourd'hui. Les champs correspondants de
 * `MetricInput` sont le point d'entrée des futurs imports FIT/TCX ou des
 * connecteurs santé ; ils ne sont alimentés par aucun code actuel.
 */

import type {
  MetricKey,
  MetricQuality,
  MetricSample,
  MetricSeries,
  MetricSeriesStats,
  MetricSource,
  Sport,
} from '../state/types';

export interface MetricDefinition {
  label: string;
  unit: string;
  icon: string;
}

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  elevation: { label: 'Altitude', unit: 'm', icon: 'mtn' },
  speed: { label: 'Vitesse', unit: 'm/s', icon: 'gauge' },
  pace: { label: 'Allure', unit: 's/km', icon: 'timer' },
  heartRate: { label: 'Fréquence cardiaque', unit: 'bpm', icon: 'heart' },
  cadence: { label: 'Cadence', unit: 'spm', icon: 'run' },
  strokeRate: { label: 'Cadence de pagaie', unit: 'c/min', icon: 'paddle' },
  power: { label: 'Puissance', unit: 'W', icon: 'pulse' },
  temperature: { label: 'Température', unit: '°C', icon: 'thermo' },
  calories: { label: 'Énergie', unit: 'kcal', icon: 'spark' },
  steps: { label: 'Pas', unit: 'pas', icon: 'foot' },
};

export const METRIC_ORDER: readonly MetricKey[] = [
  'elevation',
  'speed',
  'pace',
  'heartRate',
  'cadence',
  'strokeRate',
  'power',
  'temperature',
  'calories',
  'steps',
];

/** Un point d'affichage toutes les 5 s suffit ; les agrégats gardent tout. */
export const DISPLAY_SAMPLE_INTERVAL_MS = 5_000;

/**
 * Au-delà de 60 s entre deux mesures, l'intervalle n'est pas ponté pour la
 * moyenne pondérée : un trou GPS ou une pause ne doit pas donner un poids
 * arbitraire à la dernière valeur connue.
 */
export const MAX_WEIGHT_INTERVAL_S = 60;

/**
 * Entrée normalisée d'une source. Un connecteur fournit les champs qu'il
 * connaît ; les autres restent `null`/absents et ne créent aucune série.
 */
export interface MetricInput {
  /** Instant de mesure (ms), idéalement l'échelle corrigée du tracker. */
  t: number;
  elevationM?: number | null;
  speedMs?: number | null;
  heartRateBpm?: number | null;
  cadenceSpm?: number | null;
  strokeRateSpm?: number | null;
  powerW?: number | null;
  temperatureC?: number | null;
  /**
   * Énergie **cumulée** estimée par la source depuis le départ (kcal), jamais
   * calculée par LKDV. Une source qui ne connaît qu’un total fournit un seul
   * échantillon, pas une série reconstituée.
   */
  caloriesKcal?: number | null;
  /** Pas **cumulés** depuis le départ, fournis par un podomètre. */
  steps?: number | null;
  /** Source commune à l'échantillon ; absente, une source par métrique s'applique. */
  source?: MetricSource;
  /** Qualité commune ; absente, la qualité par défaut de la métrique s'applique. */
  quality?: MetricQuality;
}

export interface MetricSeriesSummary {
  count: number;
  average: number;
  min: number;
  max: number;
  first: number;
  last: number;
  durationS: number;
}

export interface MetricUnavailable {
  key: MetricKey;
  label: string;
  reason: string;
}

export interface MetricUnavailableGroup {
  id: 'sensors' | 'energy';
  title: string;
  hint: string;
  entries: MetricUnavailable[];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function emptyStats(): MetricSeriesStats {
  return {
    count: 0,
    sum: 0,
    min: 0,
    max: 0,
    first: 0,
    last: 0,
    firstT: 0,
    lastT: 0,
    weightedSum: 0,
    weightedDurationS: 0,
  };
}

function defaultSource(key: MetricKey): MetricSource {
  if (key === 'pace') return 'derived';
  if (key === 'elevation' || key === 'speed') return 'gps';
  return 'sensor';
}

function defaultQuality(key: MetricKey, source: MetricSource): MetricQuality {
  if (source === 'estimated') return 'estimated';
  if (source === 'derived' || key === 'pace') return 'derived';
  if (key === 'calories') return 'estimated';
  return 'measured';
}

function mergeSource(current: MetricSource, next: MetricSource): MetricSource {
  return current === next ? current : 'mixed';
}

function mergeQuality(current: MetricQuality, next: MetricQuality): MetricQuality {
  if (current === 'estimated' || next === 'estimated') return 'estimated';
  if (current === 'derived' || next === 'derived') return 'derived';
  return 'measured';
}

function createSeries(key: MetricKey, source: MetricSource, quality: MetricQuality): MetricSeries {
  const definition = METRIC_DEFINITIONS[key];
  return {
    key,
    label: definition.label,
    unit: definition.unit,
    samples: [],
    stats: emptyStats(),
    source,
    quality,
  };
}

function appendToSeries(
  series: MetricSeries,
  value: number,
  t: number,
  source: MetricSource,
  quality: MetricQuality,
): MetricSeries {
  const previous = series.stats;
  const dtS = previous.count > 0 ? (t - previous.lastT) / 1000 : 0;
  const weightS =
    Number.isFinite(dtS) && dtS > 0 && dtS <= MAX_WEIGHT_INTERVAL_S ? dtS : 0;
  const stats: MetricSeriesStats =
    previous.count === 0
      ? {
          count: 1,
          sum: value,
          min: value,
          max: value,
          first: value,
          last: value,
          firstT: t,
          lastT: t,
          weightedSum: 0,
          weightedDurationS: 0,
        }
      : {
          count: previous.count + 1,
          sum: previous.sum + value,
          min: Math.min(previous.min, value),
          max: Math.max(previous.max, value),
          first: previous.first,
          last: value,
          firstT: previous.firstT,
          lastT: t,
          // Intégration trapézoïdale : la valeur varie entre les deux mesures.
          // Un trou > 60 s n'est pas ponté.
          weightedSum:
            previous.weightedSum +
            (weightS > 0 ? ((previous.last + value) / 2) * weightS : 0),
          weightedDurationS: previous.weightedDurationS + weightS,
        };

  const lastSample = series.samples[series.samples.length - 1];
  const shouldDisplay =
    !lastSample || t - lastSample.t >= DISPLAY_SAMPLE_INTERVAL_MS;
  const samples: MetricSample[] = shouldDisplay
    ? [...series.samples, { t, value, source, quality }]
    : series.samples;

  return {
    ...series,
    samples,
    stats,
    source: mergeSource(series.source, source),
    quality: mergeQuality(series.quality, quality),
  };
}

/**
 * Ajoute un échantillon à une liste de séries et retourne une **nouvelle**
 * liste. Aucune valeur absente n'est créée : les champs `null` sont ignorés.
 * L'allure est dérivée d'une vitesse strictement positive.
 */
export function appendMetricInputs(series: MetricSeries[], input: MetricInput): MetricSeries[] {
  if (!Number.isFinite(input.t)) return series;
  let next = series.slice();

  const add = (key: MetricKey, rawValue: number | null | undefined) => {
    const value = finite(rawValue);
    if (value === null) return;
    const source = input.source ?? defaultSource(key);
    const quality = input.quality ?? defaultQuality(key, source);
    const index = next.findIndex((candidate) => candidate.key === key);
    if (index === -1) {
      const created = createSeries(key, source, quality);
      next.push(appendToSeries(created, value, input.t, source, quality));
      return;
    }
    next[index] = appendToSeries(next[index], value, input.t, source, quality);
  };

  add('elevation', input.elevationM);
  add('speed', input.speedMs);

  // L'allure est toujours dérivée de la vitesse : aucune source ne fournit
  // directement une allure dont on pourrait vérifier l'unité.
  const speed = finite(input.speedMs);
  if (speed !== null && speed > 0) {
    const pace = 1000 / speed;
    const existing = next.findIndex((candidate) => candidate.key === 'pace');
    if (existing === -1) {
      next.push(appendToSeries(createSeries('pace', 'derived', 'derived'), pace, input.t, 'derived', 'derived'));
    } else {
      next[existing] = appendToSeries(next[existing], pace, input.t, 'derived', 'derived');
    }
  }

  add('heartRate', input.heartRateBpm);
  add('cadence', input.cadenceSpm);
  add('strokeRate', input.strokeRateSpm);
  add('power', input.powerW);
  add('temperature', input.temperatureC);
  add('calories', input.caloriesKcal);
  add('steps', input.steps);

  next.sort((a, b) => METRIC_ORDER.indexOf(a.key) - METRIC_ORDER.indexOf(b.key));
  return next;
}

/** Construit une liste de séries depuis des entrées déjà normalisées. */
export function buildMetricSeries(inputs: ReadonlyArray<MetricInput>): MetricSeries[] {
  let series: MetricSeries[] = [];
  for (const input of inputs) series = appendMetricInputs(series, input);
  return series;
}

/** Vrai quand la série contient au moins une valeur réellement reçue. */
export function hasMetricValues(series: MetricSeries): boolean {
  return series.stats.count > 0;
}

/** Agrégats d'une série, ou `null` si aucune valeur n'a été reçue. */
export function summarizeMetricSeries(series: MetricSeries): MetricSeriesSummary | null {
  if (series.stats.count <= 0) return null;
  return {
    count: series.stats.count,
    average:
      series.stats.weightedDurationS > 0
        ? series.stats.weightedSum / series.stats.weightedDurationS
        : series.stats.sum / series.stats.count,
    min: series.stats.min,
    max: series.stats.max,
    first: series.stats.first,
    last: series.stats.last,
    durationS: Math.max(0, (series.stats.lastT - series.stats.firstT) / 1000),
  };
}

export type MetricUnits = 'metric' | 'imperial';

const NUMBER_0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NUMBER_1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function formatPace(secondsPerKm: number, units: MetricUnits): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const converted = units === 'imperial' ? secondsPerKm * 1.609344 : secondsPerKm;
  const total = Math.max(0, Math.round(converted));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}" /${units === 'imperial' ? 'mi' : 'km'}`;
}

/**
 * Formate une valeur canonique pour l'affichage. Une valeur non finie reste
 * un tiret, jamais « 0 ».
 */
export function formatMetricValue(
  key: MetricKey,
  value: number,
  units: MetricUnits = 'metric',
): string {
  if (!Number.isFinite(value)) return '—';
  switch (key) {
    case 'elevation':
      return units === 'imperial'
        ? `${NUMBER_0.format(value * 3.28084)} ft`
        : `${NUMBER_0.format(value)} m`;
    case 'speed':
      return units === 'imperial'
        ? `${NUMBER_1.format(value * 2.236936)} mph`
        : `${NUMBER_1.format(value * 3.6)} km/h`;
    case 'pace':
      return formatPace(value, units);
    case 'heartRate':
      return `${NUMBER_0.format(value)} bpm`;
    case 'cadence':
      return `${NUMBER_0.format(value)} spm`;
    case 'strokeRate':
      return `${NUMBER_0.format(value)} c/min`;
    case 'power':
      return `${NUMBER_0.format(value)} W`;
    case 'temperature':
      return units === 'imperial'
        ? `${NUMBER_1.format((value * 9) / 5 + 32)} °F`
        : `${NUMBER_1.format(value)} °C`;
    case 'calories':
      return `${NUMBER_0.format(value)} kcal`;
    case 'steps':
      return `${NUMBER_0.format(value)} pas`;
    default:
      return `${NUMBER_1.format(value)}`;
  }
}

/** Libellé honnête de la qualité et de la provenance d'une série. */
export function metricQualityLabel(quality: MetricQuality, source: MetricSource): string {
  if (quality === 'estimated') return 'estimé';
  if (quality === 'derived') return 'calculé';
  if (source === 'import') return 'importé';
  if (source === 'gps') return 'mesuré GPS';
  if (source === 'sensor') return 'mesuré capteur';
  if (source === 'mixed') return 'sources mixtes';
  return 'mesuré';
}

export const METRIC_UNAVAILABLE_REASONS: Partial<Record<MetricKey, string>> = {
  heartRate:
    'Aucune ceinture cardio connectée (BLE, HealthKit/Health Connect ou import FIT/TCX).',
  cadence: 'Aucun capteur de cadence connecté.',
  strokeRate: 'Aucun capteur de cadence de pagaie connecté.',
  power: 'Aucun capteur de puissance connecté.',
  temperature: 'Aucun capteur de température connecté.',
  calories:
    'Aucune source d’énergie connectée ; LKDV ne déduit pas de calories de la durée, de la distance ou du poids.',
  steps:
    'Aucun podomètre connecté ; LKDV ne déduit pas de pas de la distance parcourue.',
};

/**
 * Métriques pertinentes pour un sport mais non branches. Sert uniquement à
 * expliquer une absence : aucune valeur n'est produite à partir de cette liste.
 */
export function unavailableMetricsForSport(sport: Sport): MetricKey[] {
  switch (sport) {
    case 'course':
    case 'trail':
      return ['heartRate', 'cadence', 'power', 'temperature', 'calories', 'steps'];
    case 'rando':
    case 'famille':
      return ['heartRate', 'temperature', 'calories', 'steps'];
    case 'velo':
      return ['heartRate', 'cadence', 'power', 'temperature', 'calories'];
    case 'kayak':
      return ['heartRate', 'strokeRate', 'temperature', 'calories'];
    case 'ski':
      return ['heartRate', 'power', 'temperature', 'calories'];
    case 'escalade':
      return ['heartRate', 'temperature', 'calories'];
    case 'bivouac':
      return ['heartRate', 'temperature', 'calories', 'steps'];
    default:
      return ['heartRate', 'calories'];
  }
}

export function unavailableMetricEntries(keys: ReadonlyArray<MetricKey>): MetricUnavailable[] {
  return keys.flatMap((key) => {
    const reason = METRIC_UNAVAILABLE_REASONS[key];
    if (!reason) return [];
    return [{ key, label: METRIC_DEFINITIONS[key].label, reason }];
  });
}

const SENSOR_METRIC_KEYS: ReadonlySet<MetricKey> = new Set<MetricKey>([
  'heartRate',
  'cadence',
  'strokeRate',
  'power',
  'temperature',
]);

/**
 * Regroupe les absences pour garder une vue au repos lisible : un bloc
 * « capteurs » et un bloc « énergie/pas », jamais une valeur inventée.
 */
export function groupUnavailableMetrics(entries: MetricUnavailable[]): MetricUnavailableGroup[] {
  if (entries.length === 0) return [];
  const sensors = entries.filter((entry) => SENSOR_METRIC_KEYS.has(entry.key));
  const energy = entries.filter((entry) => !SENSOR_METRIC_KEYS.has(entry.key));
  const groups: MetricUnavailableGroup[] = [];
  if (sensors.length > 0) {
    groups.push({
      id: 'sensors',
      title: 'Capteurs non connectés',
      hint: `${sensors.map((entry) => entry.label).join(' · ')} : aucune source branchée.`,
      entries: sensors,
    });
  }
  if (energy.length > 0) {
    groups.push({
      id: 'energy',
      title: 'Énergie et pas',
      hint: 'Aucune source connectée ; ces valeurs ne sont pas déduites de la distance ou de la durée.',
      entries: energy,
    });
  }
  return groups;
}
