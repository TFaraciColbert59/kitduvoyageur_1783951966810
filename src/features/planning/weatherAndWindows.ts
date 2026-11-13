/**
 * Calendrier, météo, conditions et fenêtres optimales.
 *
 * Invariants :
 * - Fuseaux horaires IANA explicites (aucune dépendance au fuseau local machine).
 * - Gestion explicite de l'absence de fournisseur météo réel : aucune donnée météo
 *   n'est jamais inventée silencieusement.
 * - Distinction explicite entre observation, prévision et alerte officielle.
 */

import type {
  HourlyWeatherPoint,
  MultiDayPlan,
  OfficialAlertSeverity,
  OptimalWindow,
  OptimalWindowOptions,
  OptimalWindowResult,
  PlanWeatherReport,
  WeatherFeedSnapshot,
} from './models';
import { assertValidTimeZone, diffMinutesIso, getLocalDateAndHour } from './timezone';

const ALERT_RANK: Record<OfficialAlertSeverity, number> = {
  none: 0,
  moderate: 1,
  severe: 2,
  extreme: 3,
};

export function createUnconfiguredWeatherFeed(
  timezone: string,
  reason = 'Aucun fournisseur météo réel configuré.',
): WeatherFeedSnapshot {
  return {
    status: 'unconfigured',
    providerName: null,
    timezone: assertValidTimeZone(timezone),
    fetchedAtIso: null,
    maxAgeMinutes: 60,
    points: [],
    unavailableReason: reason,
  };
}

export function evaluatePlanWeather(
  plan: MultiDayPlan,
  feed: WeatherFeedSnapshot,
  nowIso: string,
): PlanWeatherReport {
  const tz = assertValidTimeZone(plan.timezone);
  assertValidTimeZone(feed.timezone);

  if (feed.status !== 'available' || !feed.providerName) {
    return {
      status: 'provider_unavailable',
      providerName: feed.providerName,
      timezone: tz,
      fetchedAtIso: feed.fetchedAtIso,
      freshnessMinutes: null,
      isStale: true,
      missingReason:
        feed.unavailableReason ??
        `Fournisseur météo indisponible (${feed.status}).`,
      hasOfficialAlert: false,
      maxAlertSeverity: 'none',
      pointsEvaluated: 0,
    };
  }

  if (feed.points.length === 0 || !feed.fetchedAtIso) {
    return {
      status: 'no_data',
      providerName: feed.providerName,
      timezone: tz,
      fetchedAtIso: feed.fetchedAtIso,
      freshnessMinutes: null,
      isStale: true,
      missingReason: 'Aucune donnée météo disponible pour la période demandée.',
      hasOfficialAlert: false,
      maxAlertSeverity: 'none',
      pointsEvaluated: 0,
    };
  }

  const freshnessMinutes = Math.max(0, diffMinutesIso(nowIso, feed.fetchedAtIso));
  const isStale = freshnessMinutes > feed.maxAgeMinutes;

  let maxAlertSeverity: OfficialAlertSeverity = 'none';
  for (const pt of feed.points) {
    const sev = pt.alertSeverity ?? 'none';
    if (ALERT_RANK[sev] > ALERT_RANK[maxAlertSeverity]) {
      maxAlertSeverity = sev;
    }
  }

  return {
    status: isStale ? 'stale' : 'ok',
    providerName: feed.providerName,
    timezone: tz,
    fetchedAtIso: feed.fetchedAtIso,
    freshnessMinutes,
    isStale,
    missingReason: isStale
      ? `Bulletin météo périmé (${freshnessMinutes} min > ${feed.maxAgeMinutes} min).`
      : null,
    hasOfficialAlert: maxAlertSeverity !== 'none',
    maxAlertSeverity,
    pointsEvaluated: feed.points.length,
  };
}

function isPointEligibleForWindow(
  pt: HourlyWeatherPoint,
  options: OptimalWindowOptions,
): { eligible: boolean; penalty: number; reason: string | null } {
  if (pt.alertSeverity === 'severe' || pt.alertSeverity === 'extreme') {
    return {
      eligible: false,
      penalty: 100,
      reason: pt.alertTitle ?? `Alerte officielle ${pt.alertSeverity}`,
    };
  }

  const maxGust = options.maxGustKmh ?? 45;
  if (pt.gustKmh !== null && pt.gustKmh > maxGust) {
    return { eligible: false, penalty: 50, reason: `Rafales ${pt.gustKmh} km/h` };
  }

  const maxPrecip = options.maxPrecipMmPerHour ?? 1.5;
  if (pt.precipMm !== null && pt.precipMm > maxPrecip) {
    return { eligible: false, penalty: 50, reason: `Précipitations ${pt.precipMm} mm/h` };
  }

  if (options.minTempC !== undefined && pt.tempC !== null && pt.tempC < options.minTempC) {
    return { eligible: false, penalty: 40, reason: `Température < ${options.minTempC}°C` };
  }

  if (options.maxTempC !== undefined && pt.tempC !== null && pt.tempC > options.maxTempC) {
    return { eligible: false, penalty: 40, reason: `Température > ${options.maxTempC}°C` };
  }

  if (
    options.maxStageElevationM != null &&
    pt.freezingLevelM !== null &&
    pt.freezingLevelM < options.maxStageElevationM
  ) {
    return {
      eligible: false,
      penalty: 45,
      reason: `Isotherme 0°C (${pt.freezingLevelM} m) sous le point haut (${options.maxStageElevationM} m)`,
    };
  }

  let penalty = 0;
  if (pt.precipMm !== null) penalty += pt.precipMm * 10;
  if (pt.gustKmh !== null) penalty += Math.max(0, pt.gustKmh - 20) * 0.5;
  if (pt.alertSeverity === 'moderate') penalty += 20;

  return { eligible: true, penalty, reason: null };
}

export function findOptimalWindows(
  plan: MultiDayPlan,
  feed: WeatherFeedSnapshot,
  nowIso: string,
  options: OptimalWindowOptions,
): OptimalWindowResult {
  const report = evaluatePlanWeather(plan, feed, nowIso);
  if (report.status === 'provider_unavailable' || report.status === 'no_data') {
    return {
      status: report.status,
      timezone: report.timezone,
      providerName: report.providerName,
      missingReason: report.missingReason,
      windows: [],
    };
  }

  const minHours = Math.max(1, Math.floor(options.minDurationHours));
  const sortedPoints = [...feed.points].sort(
    (a, b) => Date.parse(a.timestampIso) - Date.parse(b.timestampIso),
  );

  // Regrouper en séquences contiguës de points éligibles dans le fuseau horaire du plan
  const runs: HourlyWeatherPoint[][] = [];
  let currentRun: HourlyWeatherPoint[] = [];

  for (const pt of sortedPoints) {
    const check = isPointEligibleForWindow(pt, options);
    if (!check.eligible) {
      if (currentRun.length >= minHours) {
        runs.push(currentRun);
      }
      currentRun = [];
      continue;
    }

    if (currentRun.length > 0) {
      const prev = currentRun[currentRun.length - 1];
      const gapMin = diffMinutesIso(pt.timestampIso, prev.timestampIso);
      if (gapMin > 90 || gapMin < 0) {
        if (currentRun.length >= minHours) {
          runs.push(currentRun);
        }
        currentRun = [];
      }
    }
    currentRun.push(pt);
  }
  if (currentRun.length >= minHours) {
    runs.push(currentRun);
  }

  const windows: OptimalWindow[] = runs.map((run) => {
    const first = run[0];
    const last = run[run.length - 1];
    const startLocal = getLocalDateAndHour(first.timestampIso, report.timezone);
    const endLocal = getLocalDateAndHour(last.timestampIso, report.timezone);

    let maxGustKmh: number | null = null;
    let totalPrecipMm: number | null = null;
    let minTempC: number | null = null;
    let maxTempC: number | null = null;
    let penaltySum = 0;

    for (const pt of run) {
      const check = isPointEligibleForWindow(pt, options);
      penaltySum += check.penalty;
      if (pt.gustKmh !== null) {
        maxGustKmh = maxGustKmh === null ? pt.gustKmh : Math.max(maxGustKmh, pt.gustKmh);
      }
      if (pt.precipMm !== null) {
        totalPrecipMm = Number(((totalPrecipMm ?? 0) + pt.precipMm).toFixed(2));
      }
      if (pt.tempC !== null) {
        minTempC = minTempC === null ? pt.tempC : Math.min(minTempC, pt.tempC);
        maxTempC = maxTempC === null ? pt.tempC : Math.max(maxTempC, pt.tempC);
      }
    }

    const avgPenalty = penaltySum / run.length;
    const score = Math.max(0, Math.min(100, Math.round(100 - avgPenalty)));

    return {
      startIso: first.timestampIso,
      endIso: last.timestampIso,
      localDate: startLocal.date,
      localStartTime: startLocal.time,
      localEndTime: endLocal.time,
      timezone: report.timezone,
      score,
      maxGustKmh,
      totalPrecipMm,
      minTempC,
      maxTempC,
      reasons: [
        `Fenêtre ${run.length}h (${startLocal.time}-${endLocal.time} ${report.timezone})`,
      ],
    };
  });

  windows.sort((a, b) => b.score - a.score || Date.parse(a.startIso) - Date.parse(b.startIso));

  return {
    status: report.status,
    timezone: report.timezone,
    providerName: report.providerName,
    missingReason: report.missingReason,
    windows,
  };
}
