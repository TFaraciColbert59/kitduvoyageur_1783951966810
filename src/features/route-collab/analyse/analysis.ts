/**
 * Lecture complète de l'onglet « Analyser » (7.1 à 7.10) : une seule fonction pure qui assemble les moteurs
 * (effort, difficulté, profil, météo au passage, eau, alertes, surfaces, lumière, synthèse) et attache à
 * chaque bloc sa source et sa date (`Provenance`). L'écran ne calcule rien : il affiche cette lecture.
 */
import type { DayReading } from '../dayReading';
import { sunTimes, formatLocalTime } from '../insights/daylight';
import { surfaceBreakdown, type StageSurfaceBreakdown, type SurfaceBreakdown } from '../insights/surfaces';
import { threeLineSynthesis, type ThreeLineSynthesis } from '../insights/summary';
import { waterEvidenceLevel, type WaterEvidence, type WaterGap } from '../insights/water';
import type { ProfileModel } from '../profileLink';
import type { CollaborativeKitItem, RouteWorkspaceState, WaterObservation } from '../types';
import { readAlerts, type AlertsReading, type FireAlertPayload, type OfficialAlertsPayload } from './alerts';
import { readDifficulty, type DifficultyReading } from './difficulty';
import { buildEffortAnalysis, type EffortAnalysis, type MemberProfile } from './effort';
import { addMinutesToClock, type DayPassage, type PassageWeather } from './passageWeather';
import {
  SOURCE_DIFFICULTY,
  SOURCE_EFFORT,
  SOURCE_PLAN,
  SOURCE_SUN,
  isIsoDate,
  type Provenance,
} from './provenance';
import { bandShares, elevationGaps, rankedClimbs, slopeSegments, type ElevationGap, type RankedClimbs, type SlopeBand, type SlopeSegment } from './segments';

/** Seuil de la synthèse : au-delà de cette distance sans point d'eau connu, c'est « à vérifier ». */
export const WATER_GAP_ALERT_KM = 10;

export interface PackReading {
  readonly weightKg: number | null;
  readonly unweightedCount: number;
}

/** Charge portée par la personne : objets du sac qui lui sont attribués (poids connus seulement, le reste est dit). */
export function packOf(items: readonly CollaborativeKitItem[], userId: string): PackReading {
  const mine = items.filter((i) => i.assigneeUserId === userId);
  if (mine.length === 0) return { weightKg: null, unweightedCount: 0 };
  const weighted = mine.filter((i) => i.weightGrams != null);
  if (weighted.length === 0) return { weightKg: null, unweightedCount: mine.length };
  const grams = weighted.reduce((a, i) => a + (i.weightGrams as number) * Math.max(1, i.quantity), 0);
  return { weightKg: Math.round(grams) / 1000, unweightedCount: mine.length - weighted.length };
}

export interface WaterEvidenceRow {
  readonly observation: WaterObservation;
  readonly evidence: WaterEvidence;
}

export interface DayWater {
  readonly stageId: string;
  readonly day: number;
  readonly gap: WaterGap;
  readonly rows: readonly WaterEvidenceRow[];
  readonly counts: Readonly<Record<WaterEvidence['level'], number>>;
  readonly provenance: Provenance;
}

export interface DayDaylight {
  readonly stageId: string;
  readonly day: number;
  readonly dateIso: string | null;
  readonly sunriseLocal: string | null;
  readonly sunsetLocal: string | null;
  readonly arrivalLocal: string | null;
  readonly marginMin: number | null;
  readonly late: boolean;
  /** Pourquoi une valeur manque (« date inconnue », « durée inconnue »…). */
  readonly reason: string | null;
  readonly provenance: Provenance;
}

export interface WeatherReading extends PassageWeather {
  readonly provenance: Provenance;
}

export interface Analysis {
  readonly effort: EffortAnalysis;
  readonly effortProvenance: Provenance;
  readonly difficulty: DifficultyReading;
  readonly difficultyProvenance: Provenance;
  readonly slopes: readonly SlopeSegment[];
  readonly slopeShares: Readonly<Record<SlopeBand, number>>;
  readonly gaps: readonly ElevationGap[];
  readonly climbs: RankedClimbs;
  /** Source et date du profil (altitudes issues du calcul d'itinéraire des tronçons). */
  readonly profileProvenance: Provenance;
  readonly surfaces: { readonly overall: SurfaceBreakdown; readonly perStage: readonly StageSurfaceBreakdown[] };
  readonly surfaceProvenance: Provenance;
  readonly water: readonly DayWater[];
  readonly daylight: readonly DayDaylight[];
  readonly weather: readonly WeatherReading[];
  readonly alerts: AlertsReading;
  readonly synthesis: ThreeLineSynthesis;
  readonly synthesisProvenance: Provenance;
  readonly pack: PackReading;
}

export interface AnalysisInput {
  readonly workspace: RouteWorkspaceState;
  readonly profile: ProfileModel;
  readonly days: readonly DayReading[];
  readonly members: readonly MemberProfile[];
  readonly currentUserId: string;
  readonly now: Date;
  readonly waterByStage: Readonly<Record<string, readonly WaterObservation[]>>;
  /** Heure de relevé du dernier chargement des lieux (OpenStreetMap), par étape. */
  readonly placesFetchedAtByStage?: Readonly<Record<string, string | null>>;
  readonly remote: {
    readonly weather: readonly PassageWeather[] | null;
    readonly fire: FireAlertPayload | null;
    readonly official?: OfficialAlertsPayload | null;
  };
}

function latestCalculatedAt(ws: Pick<RouteWorkspaceState, 'sections'>): string | null {
  const dates = ws.sections.map((s) => s.provenance.calculatedAt).filter(isIsoDate);
  return dates.sort().at(-1) ?? null;
}

/** Point et heure de passage envoyés au serveur météo : milieu de la journée, sinon le départ. Jours sans date : exclus. */
export function dayPassages(days: readonly DayReading[], profile: ProfileModel): DayPassage[] {
  const out: DayPassage[] = [];
  for (const d of days) {
    if (!d.dateIso || d.kind === 'rest') continue;
    const pts = profile.points.filter((p) => p.day === d.dayNumber);
    if (pts.length === 0) continue;
    const mid = pts[Math.floor(pts.length / 2)];
    const half = d.duration.minutes != null ? addMinutesToClock(d.departureTimeLocal, d.duration.minutes / 2) : null;
    out.push({
      day: d.dayNumber,
      dateIso: d.dateIso.slice(0, 10),
      lat: Math.round(mid.lat * 1e4) / 1e4,
      lon: Math.round(mid.lon * 1e4) / 1e4,
      passageLocal: half ?? d.departureTimeLocal,
      timezone: d.timezone,
      basis: half ? 'midday' : 'departure',
    });
  }
  return out;
}

/** Tracé simplifié (≤ 300 points) pour situer les feux sur le serveur. */
export function trackForFire(profile: ProfileModel, max = 300): { lat: number; lon: number }[] {
  const pts = profile.points;
  if (pts.length === 0) return [];
  const step = Math.max(1, Math.ceil(pts.length / max));
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < pts.length; i += step) out.push({ lat: Math.round(pts[i].lat * 1e5) / 1e5, lon: Math.round(pts[i].lon * 1e5) / 1e5 });
  const last = pts[pts.length - 1];
  if (out.length < max + 1) out.push({ lat: Math.round(last.lat * 1e5) / 1e5, lon: Math.round(last.lon * 1e5) / 1e5 });
  return out.slice(0, max);
}

function daylightOf(d: DayReading): DayDaylight {
  const sun = d.dateIso && d.endLat != null && d.endLon != null ? sunTimes(d.endLat, d.endLon, d.dateIso) : null;
  return {
    stageId: d.stageId,
    day: d.dayNumber,
    dateIso: d.dateIso,
    sunriseLocal: sun?.sunrise ? formatLocalTime(sun.sunrise, d.timezone) : null,
    sunsetLocal: d.arrival.sunsetLocal,
    arrivalLocal: d.arrival.arrivalLocal,
    marginMin: d.arrival.marginMin,
    late: d.arrival.late,
    reason: d.arrival.reason ?? (sun?.polar ? (sun.polar === 'polar_day' ? 'jour polaire : pas de coucher' : 'nuit polaire : pas de lever') : null),
    provenance: { source: SOURCE_SUN, at: d.dateIso },
  };
}

export function buildAnalysis(input: AnalysisInput): Analysis {
  const { workspace: ws, profile, days, now } = input;
  const planAt = ws.updatedAt;
  const calcAt = latestCalculatedAt(ws);
  const pack = packOf(ws.kitItems, input.currentUserId);

  // Température du passage : moyenne des jours lus (MET Norway) ; sans prévision, conditions neutres dites à l'écran.
  const temps = (input.remote.weather ?? []).filter((w) => w.status === 'ok' && w.tempC != null).map((w) => w.tempC as number);
  const tempC = temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null;

  const effort = buildEffortAnalysis(profile, ws.sections, {
    sport: ws.sport,
    members: input.members,
    packWeightKg: pack.weightKg,
    packUnweightedCount: pack.unweightedCount,
    tempC,
    stages: ws.stages,
  });
  const difficulty = readDifficulty(ws, profile);
  const slopes = slopeSegments(profile);
  const climbs = rankedClimbs(profile, ws.sport);
  const surfaces = surfaceBreakdown({ points: ws.points, sections: ws.sections, stages: ws.stages });

  const water: DayWater[] = days.map((d) => {
    const observations = input.waterByStage[d.stageId] ?? [];
    const rows = observations.map((o) => ({ observation: o, evidence: waterEvidenceLevel(o, { now }) }));
    const counts = { mapped: 0, potability_declared: 0, confirmed_recent: 0 };
    for (const r of rows) counts[r.evidence.level] += 1;
    const dated = rows.map((r) => r.observation.observedAt).filter(isIsoDate).sort();
    return {
      stageId: d.stageId,
      day: d.dayNumber,
      gap: d.water,
      rows,
      counts,
      provenance: { source: 'OpenStreetMap et points déclarés', at: dated.at(-1) ?? input.placesFetchedAtByStage?.[d.stageId] ?? null },
    };
  });

  const daylight = days.filter((d) => d.kind !== 'rest').map(daylightOf);
  const weather: WeatherReading[] = (input.remote.weather ?? []).map((w) => ({
    ...w,
    provenance: { source: w.source, at: w.fetchedAt },
  }));
  const alerts = readAlerts(ws.stages, input.remote.fire, now, input.remote.official ?? null);

  const longestGaps = water.map((w) => w.gap.gapKm).filter((g): g is number => g != null);
  const synthesis = threeLineSynthesis(ws, {
    now,
    lateStageDays: daylight.filter((d) => d.late).map((d) => d.day),
    longestWaterGapKm: longestGaps.length > 0 ? Math.max(...longestGaps) : null,
    waterGapAlertKm: WATER_GAP_ALERT_KM,
  });
  if (effort.critical.length > 0) {
    synthesis.toCheck.push(`${effort.critical.length} passage${effort.critical.length > 1 ? 's' : ''} difficile${effort.critical.length > 1 ? 's' : ''} relevé${effort.critical.length > 1 ? 's' : ''}`);
  }
  if (alerts.active.length > 0) {
    const closures = alerts.active.filter((a) => a.kind === 'closure' || (a.kind === 'fire' && a.severity === 'critical'));
    if (closures.length > 0) synthesis.blocking.push(`${closures.length} fermeture${closures.length > 1 ? 's' : ''} déclarée${closures.length > 1 ? 's' : ''}`);
  }

  return {
    effort,
    effortProvenance: { source: SOURCE_EFFORT, at: planAt },
    difficulty,
    difficultyProvenance: { source: SOURCE_DIFFICULTY, at: planAt },
    slopes,
    slopeShares: bandShares(slopes),
    gaps: elevationGaps(slopes),
    climbs,
    profileProvenance: { source: `${SOURCE_PLAN} · altitudes du calcul d’itinéraire`, at: calcAt },
    surfaces,
    surfaceProvenance: { source: `${SOURCE_PLAN} · surfaces des tronçons`, at: calcAt },
    water,
    daylight,
    weather,
    alerts,
    synthesis,
    synthesisProvenance: { source: SOURCE_PLAN, at: planAt },
    pack,
  };
}
