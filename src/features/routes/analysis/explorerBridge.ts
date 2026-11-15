import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import type { Sport } from '@/features/explorer-v2/state/types';
import type { WeatherResponse } from '@/features/explorer-v2/data/hooks';
import {
  analyzeClimbs,
  analyzeDifficulty,
  analyzeFireAlerts,
  analyzeRouteAlerts,
  analyzeRouteWeather,
  analyzeSurfaces,
  type AlertAnalysis,
  type AlertSectionInput,
  type AnalysisSport,
  type AthleteProfile,
  type ClimbAnalysis,
  type DifficultyAnalysis,
  type FireAnalysis,
  type FireIncident,
  type FireSource,
  type ProfileSample,
  type RouteWeatherAnalysis,
  type SurfaceAnalysis,
  type SurfaceSectionInput,
  type WeatherHourInput,
  type WeatherSeries,
} from './index';
import { routeSamples } from './geo';

export interface ExplorerProfilePoint {
  d: number;
  ele: number | null;
}

export function toAnalysisSport(sport: RouteSport | Sport | string | null | undefined): AnalysisSport {
  switch (sport) {
    case 'route':
      return 'route';
    case 'gravel':
      return 'gravel';
    case 'vtt':
      return 'vtt';
    case 'velo':
      return 'velo';
    case 'enduro':
      return 'enduro';
    case 'course':
      return 'course';
    case 'trail':
      return 'trail';
    case 'ski':
      return 'ski';
    case 'kayak':
      return 'kayak';
    case 'famille':
      return 'famille';
    case 'bivouac':
      return 'bivouac';
    case 'rando':
      return 'rando';
    case 'marche':
    default:
      return 'marche';
  }
}

/** Convertit un symbole MET Norway (`rain`, `partlycloudy_day`, etc.) en code WMO. */
export function wmoCodeFromMetSymbol(symbol: string | null | undefined): number | null {
  if (!symbol) return null;
  const s = symbol.toLowerCase();
  if (s.includes('thunder')) return 95;
  if (s.includes('snow') || s.includes('sleet')) return 73;
  if (s.includes('heavyrain') || s.includes('rainshowers')) return 80;
  if (s.includes('rain')) return 61;
  if (s.includes('fog')) return 45;
  if (s.includes('clearsky') || s.includes('fair')) return 0;
  if (s.includes('partlycloudy') || s.includes('cloudy')) return 2;
  return null;
}

export function weatherSeriesFromExplorerWeather(
  weather: WeatherResponse | null | undefined,
  timezone = 'Europe/Paris'
): WeatherSeries | null {
  if (!weather || !Array.isArray(weather.hours) || weather.hours.length === 0) return null;
  const hours: WeatherHourInput[] = weather.hours.map((h) => ({
    time: h.time,
    temperatureC: h.temperature_c,
    windKmH: h.wind_ms != null && Number.isFinite(h.wind_ms) ? Math.round(h.wind_ms * 3.6 * 10) / 10 : null,
    precipitationMm: h.precip_mm ?? null,
    weatherCode: wmoCodeFromMetSymbol(h.symbol),
  }));
  return {
    source: weather.source || 'met-no',
    attribution: 'MET Norway (api.met.no)',
    fetchedAt: new Date().toISOString(),
    timezone,
    hours,
  };
}

export interface ExplorerRouteAnalysisBundle {
  readonly sport: AnalysisSport;
  readonly surfaces: SurfaceAnalysis;
  readonly climbs: ClimbAnalysis | null;
  readonly difficulty: DifficultyAnalysis;
  readonly alerts: AlertAnalysis;
  readonly fire: FireAnalysis;
  readonly weather: RouteWeatherAnalysis | null;
}

export interface BuildExplorerRouteAnalysisInput {
  readonly positions: ReadonlyArray<readonly [number, number]>; // [lng, lat]
  readonly sport?: RouteSport | Sport | string | null;
  readonly profilePoints?: readonly ExplorerProfilePoint[] | null;
  readonly surfaceSections?: readonly SurfaceSectionInput[] | null;
  readonly alertSections?: readonly AlertSectionInput[] | null;
  readonly explorerWeather?: WeatherResponse | null;
  readonly startAtIso?: string;
  readonly speedKmH?: number | null;
  readonly ebike?: boolean;
  readonly athlete?: AthleteProfile | null;
  readonly fireIncidents?: readonly FireIncident[] | null;
  readonly fireSource?: FireSource | null;
}

export function buildExplorerRouteAnalysis(
  input: BuildExplorerRouteAnalysisInput
): ExplorerRouteAnalysisBundle {
  const geoPoints = input.positions.map(([lon, lat]) => ({ lat, lon }));
  const samples = routeSamples(geoPoints);
  const totalLengthM = samples.length > 0 ? samples[samples.length - 1].distanceM : 0;
  const analysisSport = toAnalysisSport(input.sport);

  const surfaces = analyzeSurfaces({
    sections: input.surfaceSections ?? [],
    totalLengthM,
  });

  let climbs: ClimbAnalysis | null = null;
  let gainM: number | null = null;
  let lossM: number | null = null;
  let maxAltM: number | null = null;

  if (input.profilePoints && input.profilePoints.length >= 2) {
    const profileSamples: ProfileSample[] = input.profilePoints.map((p) => ({
      distanceM: p.d,
      elevationM: p.ele,
    }));
    climbs = analyzeClimbs({ profile: profileSamples, sport: analysisSport });
    gainM = climbs.totalGainM;
    lossM = climbs.totalLossM;
    const validAlt = input.profilePoints
      .map((p) => p.ele)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    maxAltM = validAlt.length > 0 ? Math.max(...validAlt) : null;
  }

  // S3.26 + K2.05 : profil sportif ou assistance VAE traduits en profil athlète explicite
  const baseAthlete = input.athlete ?? null;
  const resolvedSpeedKmH =
    input.speedKmH && Number.isFinite(input.speedKmH) && input.speedKmH > 0
      ? input.speedKmH
      : baseAthlete?.flatSpeedKmH ?? null;
  const athlete: AthleteProfile | null =
    resolvedSpeedKmH !== null || baseAthlete || input.ebike
      ? {
          flatSpeedKmH: resolvedSpeedKmH,
          ascentMPerH: input.ebike ? 950 : baseAthlete?.ascentMPerH ?? null,
          descentMPerH: baseAthlete?.descentMPerH ?? null,
          label: input.ebike ? 'Assistance VAE' : baseAthlete?.label ?? 'Rythme ajusté',
        }
      : null;

  const difficulty = analyzeDifficulty({
    sport: analysisSport,
    distanceM: totalLengthM,
    gainM,
    lossM,
    maxAltitudeM: maxAltM,
    surface: surfaces,
    climbs,
    athlete,
  });

  const alerts = analyzeRouteAlerts({
    points: geoPoints,
    sections: input.alertSections ?? null,
    totalLengthM,
    sport: analysisSport,
  });

  const fire = analyzeFireAlerts({
    incidents: input.fireIncidents ?? null,
    source: input.fireSource ?? null,
    points: geoPoints,
  });

  const series = weatherSeriesFromExplorerWeather(input.explorerWeather);
  const weather =
    series || input.startAtIso
      ? analyzeRouteWeather({
          points: geoPoints,
          series,
          startAt: input.startAtIso ?? new Date().toISOString(),
          durationS: difficulty.duration.seconds,
          speedKmH: resolvedSpeedKmH,
        })
      : null;

  return {
    sport: analysisSport,
    surfaces,
    climbs,
    difficulty,
    alerts,
    fire,
    weather,
  };
}
