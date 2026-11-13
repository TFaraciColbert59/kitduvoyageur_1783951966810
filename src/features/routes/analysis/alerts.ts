/**
 * K2.22 · Alertes escaliers, ferry et petit aller-retour.
 *
 * Les escaliers et le ferry viennent d'étiquettes de tronçon réellement
 * présentes. Le petit aller-retour est détecté sur la géométrie : la trace
 * revient près d'un point antérieur en longeant le même corridor. Un
 * switchback ou une boucle ne sont pas signalés comme aller-retour.
 */
import {
  isFiniteNumber,
  type AnalysisGap,
  type AnalysisSport,
  type AnalysisWarning,
} from './types';
import {
  haversineM,
  normalizeTag,
  round,
  routeSamples,
  type GeoPointInput,
} from './geo';

export type RouteAlertKind = 'stairs' | 'ferry' | 'out_and_back';

export interface AlertSectionInput {
  readonly fromM: number;
  readonly toM: number;
  readonly wayType?: string | null;
  readonly surface?: string | null;
  readonly provider?: string | null;
  readonly route?: string | null;
  readonly tags?: Readonly<Record<string, string>> | null;
}

export interface AlertInput {
  readonly points?: readonly GeoPointInput[] | null;
  readonly sections?: readonly AlertSectionInput[] | null;
  readonly totalLengthM?: number | null;
  readonly sport?: AnalysisSport | null;
  /** Longueur maximale d'un « petit » aller-retour (m). */
  readonly maxSpurM?: number | null;
}

export interface RouteAlert {
  readonly id: string;
  readonly kind: RouteAlertKind;
  readonly severity: 'info' | 'warning';
  readonly fromM: number;
  readonly toM: number;
  readonly lengthM: number;
  readonly message: string;
  readonly evidence: string;
  readonly recalculable: boolean;
  readonly suggestedAction: 'avoid_steps' | 'avoid_ferry' | 'remove_detour' | 'review';
}

export interface AlertAnalysis {
  readonly status: 'clear' | 'alerts' | 'partial' | 'unavailable';
  readonly alerts: RouteAlert[];
  readonly checked: {
    readonly stairs: boolean;
    readonly ferry: boolean;
    readonly outAndBack: boolean;
  };
  readonly unavailableChecks: AnalysisGap[];
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
}

interface Interval {
  readonly fromM: number;
  readonly toM: number;
  readonly evidence: string;
}

function tagValue(section: AlertSectionInput, key: string): string | null {
  const tags = section.tags;
  if (!tags) return null;
  const direct = tags[key];
  if (typeof direct === 'string') return direct;
  const found = Object.keys(tags).find((entry) => entry.toLowerCase() === key.toLowerCase());
  return found ? tags[found] : null;
}

function isSteps(section: AlertSectionInput): boolean {
  const way = normalizeTag(section.wayType ?? tagValue(section, 'highway'));
  const steps = normalizeTag(tagValue(section, 'steps'));
  const surface = normalizeTag(section.surface);
  return (
    way === 'steps' ||
    surface === 'steps' ||
    steps === 'yes' ||
    steps === 'true' ||
    steps === '1'
  );
}

function isFerry(section: AlertSectionInput): boolean {
  const way = normalizeTag(section.wayType);
  const route = normalizeTag(section.route ?? tagValue(section, 'route'));
  const ferry = normalizeTag(tagValue(section, 'ferry'));
  const mode = normalizeTag(tagValue(section, 'mode'));
  const provider = normalizeTag(section.provider);
  return (
    way === 'ferry' ||
    route === 'ferry' ||
    ferry === 'yes' ||
    ferry === 'true' ||
    mode === 'ferry' ||
    (provider?.includes('ferry') ?? false)
  );
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const ordered = intervals
    .filter((interval) => interval.toM > interval.fromM)
    .slice()
    .sort((a, b) => a.fromM - b.fromM || a.toM - b.toM);
  const merged: Interval[] = [];
  for (const interval of ordered) {
    const last = merged[merged.length - 1];
    if (last && interval.fromM <= last.toM + 1) {
      merged[merged.length - 1] = {
        fromM: last.fromM,
        toM: Math.max(last.toM, interval.toM),
        evidence: `${last.evidence} ; ${interval.evidence}`,
      };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function sampleInterval(
  section: AlertSectionInput,
  index: number,
  totalLengthM: number
): Interval | null {
  if (!isFiniteNumber(section.fromM) || !isFiniteNumber(section.toM)) return null;
  const fromM = Math.max(0, Math.min(totalLengthM, section.fromM));
  const toM = Math.max(0, Math.min(totalLengthM, section.toM));
  if (toM <= fromM) return null;
  return {
    fromM,
    toM,
    evidence: `tronçon ${index + 1} (${round(section.fromM, 0)}–${round(section.toM, 0)} m)`,
  };
}

function decimate<T>(values: readonly T[], max: number): T[] {
  if (values.length <= max) return values.slice();
  const out: T[] = [];
  const step = Math.ceil(values.length / max);
  for (let index = 0; index < values.length; index += step) out.push(values[index]);
  const last = values[values.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Part des points de l'aller qui longent le retour dans le même corridor.
 * Une boucle ne partage que ses extrémités ; un aller-retour partage tout.
 */
function corridorOverlap(
  points: readonly { lat: number; lon: number }[],
  outStart: number,
  outEnd: number,
  backStart: number,
  backEnd: number,
  corridorM: number
): number {
  let matched = 0;
  let total = 0;
  for (let out = outStart; out <= outEnd; out += 1) {
    total += 1;
    let nearest = Number.POSITIVE_INFINITY;
    for (let back = backStart; back <= backEnd; back += 1) {
      const distance = haversineM(
        [points[out].lon, points[out].lat],
        [points[back].lon, points[back].lat]
      );
      if (Number.isFinite(distance) && distance < nearest) nearest = distance;
    }
    if (nearest <= corridorM) matched += 1;
  }
  return total > 0 ? matched / total : 0;
}

function detectOutAndBack(
  points: readonly GeoPointInput[],
  maxSpurM: number
): RouteAlert[] {
  const samples = routeSamples(points);
  if (samples.length < 5) return [];

  const maxDetectionPoints = 600;
  const detection = decimate(samples, maxDetectionPoints);
  if (detection.length < 5) return [];

  const alerts: RouteAlert[] = [];
  const returnRadiusM = 30;
  const minSpurM = 120;
  const corridorM = 30;
  const maxWindowM = Math.max(minSpurM * 2, maxSpurM * 2);

  let index = 0;
  while (index < detection.length - 4) {
    let foundEnd = -1;
    let foundTurn = -1;
    let foundOverlap = 0;
    let foundSpurM = 0;

    for (let end = index + 4; end < detection.length; end += 1) {
      if (detection[end].distanceM - detection[index].distanceM > maxWindowM) break;
      const closingDistanceM = haversineM(
        [detection[index].lon, detection[index].lat],
        [detection[end].lon, detection[end].lat]
      );
      if (!Number.isFinite(closingDistanceM) || closingDistanceM > returnRadiusM) continue;
      const subLengthM = detection[end].distanceM - detection[index].distanceM;
      if (subLengthM < minSpurM * 2) continue;

      let turn = index;
      let furthestM = 0;
      for (let cursor = index; cursor <= end; cursor += 1) {
        const distanceM = haversineM(
          [detection[index].lon, detection[index].lat],
          [detection[cursor].lon, detection[cursor].lat]
        );
        if (Number.isFinite(distanceM) && distanceM > furthestM) {
          furthestM = distanceM;
          turn = cursor;
        }
      }
      if (furthestM < minSpurM || turn <= index || turn >= end) continue;

      const overlap = corridorOverlap(detection, index, turn, turn, end, corridorM);
      if (overlap < 0.8) continue;

      foundEnd = end;
      foundTurn = turn;
      foundOverlap = overlap;
      foundSpurM = furthestM;
      break;
    }

    if (foundEnd >= 0) {
      alerts.push({
        id: `out-and-back-${alerts.length + 1}`,
        kind: 'out_and_back',
        severity: 'info',
        fromM: round(detection[index].distanceM, 1),
        toM: round(detection[foundEnd].distanceM, 1),
        lengthM: round(detection[foundEnd].distanceM - detection[index].distanceM, 1),
        message: `Aller-retour d’environ ${round(foundSpurM, 0)} m : le tracé revient sur ses pas.`,
        evidence: `corridor partagé à ${round(foundOverlap * 100, 0)} %, demi-tour au point ${foundTurn + 1}`,
        recalculable: true,
        suggestedAction: 'remove_detour',
      });
      index = foundEnd + 1;
    } else {
      index += 1;
    }
  }

  return alerts;
}

export function analyzeRouteAlerts(input: AlertInput): AlertAnalysis {
  const alerts: RouteAlert[] = [];
  const unavailableChecks: AnalysisGap[] = [];
  const warnings: AnalysisWarning[] = [];
  const sections = input.sections ?? null;

  let totalLengthM = isFiniteNumber(input.totalLengthM) ? Math.max(0, input.totalLengthM) : 0;
  if (totalLengthM <= 0 && sections) {
    totalLengthM = sections.reduce(
      (max, section) => (isFiniteNumber(section.toM) ? Math.max(max, section.toM) : max),
      0
    );
  }

  const checked = {
    stairs: sections !== null,
    ferry: sections !== null,
    outAndBack: Boolean(input.points && input.points.length >= 5),
  };

  if (sections === null) {
    unavailableChecks.push({
      code: 'alert_sections_unavailable',
      message:
        'Aucun tronçon étiqueté : les escaliers et le ferry ne peuvent pas être vérifiés.',
    });
  } else if (totalLengthM <= 0) {
    unavailableChecks.push({
      code: 'alert_sections_invalid',
      message: 'Les bornes des tronçons sont absentes : les alertes ne peuvent pas être situées.',
    });
  } else {
    const stairIntervals: Interval[] = [];
    const ferryIntervals: Interval[] = [];
    sections.forEach((section, index) => {
      const interval = sampleInterval(section, index, totalLengthM);
      if (!interval) {
        warnings.push({
          code: 'alert_section_invalid',
          message: `Tronçon ${index + 1} sans bornes valides, ignoré.`,
          severity: 'info',
        });
        return;
      }
      if (isSteps(section)) stairIntervals.push(interval);
      if (isFerry(section)) ferryIntervals.push(interval);
    });

    const bikeSport =
      input.sport === 'velo' ||
      input.sport === 'route' ||
      input.sport === 'gravel' ||
      input.sport === 'vtt' ||
      input.sport === 'enduro';

    for (const interval of mergeIntervals(stairIntervals)) {
      alerts.push({
        id: `stairs-${alerts.length + 1}`,
        kind: 'stairs',
        severity: bikeSport ? 'warning' : 'info',
        fromM: round(interval.fromM, 1),
        toM: round(interval.toM, 1),
        lengthM: round(interval.toM - interval.fromM, 1),
        message: bikeSport
          ? 'Escalier sur le tracé : passage à pied probable avec le vélo.'
          : 'Escalier sur le tracé : progression à pied et rythme ralenti.',
        evidence: interval.evidence,
        recalculable: false,
        suggestedAction: 'avoid_steps',
      });
    }

    for (const interval of mergeIntervals(ferryIntervals)) {
      alerts.push({
        id: `ferry-${alerts.length + 1}`,
        kind: 'ferry',
        severity: 'warning',
        fromM: round(interval.fromM, 1),
        toM: round(interval.toM, 1),
        lengthM: round(interval.toM - interval.fromM, 1),
        message: 'Traversée en ferry : horaires et réservation non vérifiés par le tracé.',
        evidence: interval.evidence,
        recalculable: false,
        suggestedAction: 'avoid_ferry',
      });
    }
  }

  if (!checked.outAndBack) {
    unavailableChecks.push({
      code: 'out_and_back_geometry_unavailable',
      message: 'La géométrie est absente ou trop courte pour détecter un aller-retour.',
    });
  } else {
    const maxSpurM = isFiniteNumber(input.maxSpurM) ? Math.max(120, input.maxSpurM) : 2_000;
    alerts.push(...detectOutAndBack(input.points ?? [], maxSpurM));
  }

  const hasAlerts = alerts.length > 0;
  const noSourceAtAll = sections === null && !checked.outAndBack;
  const status = hasAlerts
    ? 'alerts'
    : noSourceAtAll
      ? 'unavailable'
      : unavailableChecks.length > 0
        ? 'partial'
        : 'clear';

  return {
    status,
    alerts: alerts.sort((a, b) => a.fromM - b.fromM || a.kind.localeCompare(b.kind)),
    checked,
    unavailableChecks,
    missing: [...unavailableChecks],
    warnings,
  };
}
