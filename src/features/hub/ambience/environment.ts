/**
 * src/features/hub/ambience/environment.ts
 * Moteur pur d'ambiance environnementale honnête (Lot L6-5 / D-23, D-24 / KIT_STUDIO_SPEC §12.2).
 *
 * RÈGLES STRICTES :
 * 1. Aucun effet météo sans source légitime explicite (`met-norway` ou `nasa-power`).
 *    Météo absente ou source inconnue -> `weatherEffect: 'none'`, jamais de pluie/neige inventée (D-23).
 * 2. Aucun effet saisonnier si la latitude du projet manque.
 * 3. Coupé en premier (`active: false`) lorsque `qualityAmbienceEnabled === false` (batterie faible, D-24)
 *    ou lorsque l'utilisateur désactive l'ambiance automatique.
 * 4. `prefers-reduced-motion` fige tout effet animé (`animatedEffects: false`) sans retirer d'information.
 */

export type LegitimateWeatherSource = 'met-norway' | 'nasa-power';

export interface VerifiedWeatherReading {
  source: LegitimateWeatherSource | string | null | undefined;
  precipitationMmH?: number | null;
  cloudCoverPct?: number | null;
  temperatureC?: number | null;
  snowfallCm?: number | null;
}

export type AestheticLightingPreset =
  | 'auto'
  | 'atelier-neutre'
  | 'lumiere-matinale'
  | 'crepuscule-doux';

export type TimeOfDayMood = 'neutral' | 'dawn' | 'day' | 'dusk' | 'night';
export type SeasonMood = 'none' | 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherEffect = 'none' | 'clear' | 'overcast' | 'rain' | 'snow';

export interface AmbienceInput {
  now?: Date | null;
  projectLatitude?: number | null;
  projectElevationM?: number | null;
  weather?: VerifiedWeatherReading | null;
  autoAmbienceEnabled?: boolean;
  qualityAmbienceEnabled?: boolean; // issu de QualityGovernor.getProfile().ambienceEnabled (D-24)
  reducedMotion?: boolean;
  manualLightingPreset?: AestheticLightingPreset;
}

export interface ResolvedAmbienceState {
  active: boolean;
  cutReason: 'low-battery-or-quality' | 'manual-off' | null;
  timeOfDay: TimeOfDayMood;
  season: SeasonMood;
  weatherEffect: WeatherEffect;
  weatherSource: LegitimateWeatherSource | null;
  elevationBand: 'none' | 'plain' | 'mountain' | 'high-alpine';
  animatedEffects: boolean;
  lightingPreset: AestheticLightingPreset;
}

const LEGITIMATE_SOURCES = new Set<string>(['met-norway', 'nasa-power']);

export function resolveTimeOfDay(now: Date | null | undefined): TimeOfDayMood {
  if (!now || Number.isNaN(now.getTime())) return 'neutral';
  const hour = now.getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

export function resolveSeason(
  now: Date | null | undefined,
  latitude: number | null | undefined
): SeasonMood {
  if (
    !now ||
    Number.isNaN(now.getTime()) ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return 'none';
  }

  const month = now.getUTCMonth(); // 0..11
  const northern = latitude >= 0;

  let northSeason: SeasonMood;
  if (month >= 2 && month <= 4) northSeason = 'spring';
  else if (month >= 5 && month <= 7) northSeason = 'summer';
  else if (month >= 8 && month <= 10) northSeason = 'autumn';
  else northSeason = 'winter';

  if (northern) return northSeason;

  switch (northSeason) {
    case 'spring':
      return 'autumn';
    case 'summer':
      return 'winter';
    case 'autumn':
      return 'spring';
    case 'winter':
      return 'summer';
    default:
      return 'none';
  }
}

export function resolveLegitimateWeather(
  weather: VerifiedWeatherReading | null | undefined
): { effect: WeatherEffect; source: LegitimateWeatherSource | null } {
  if (!weather || !weather.source || !LEGITIMATE_SOURCES.has(weather.source)) {
    return { effect: 'none', source: null };
  }

  const source = weather.source as LegitimateWeatherSource;
  const snow = typeof weather.snowfallCm === 'number' && Number.isFinite(weather.snowfallCm) ? weather.snowfallCm : null;
  const precip =
    typeof weather.precipitationMmH === 'number' && Number.isFinite(weather.precipitationMmH)
      ? weather.precipitationMmH
      : null;
  const temp =
    typeof weather.temperatureC === 'number' && Number.isFinite(weather.temperatureC)
      ? weather.temperatureC
      : null;
  const clouds =
    typeof weather.cloudCoverPct === 'number' && Number.isFinite(weather.cloudCoverPct)
      ? weather.cloudCoverPct
      : null;

  if ((snow !== null && snow > 0) || (precip !== null && precip > 0.2 && temp !== null && temp <= 0.5)) {
    return { effect: 'snow', source };
  }
  if (precip !== null && precip > 0.2) {
    return { effect: 'rain', source };
  }
  if (clouds !== null && clouds >= 70) {
    return { effect: 'overcast', source };
  }
  if (clouds !== null || precip !== null || temp !== null) {
    return { effect: 'clear', source };
  }

  return { effect: 'none', source: null };
}

export function resolveAmbienceState(input: AmbienceInput = {}): ResolvedAmbienceState {
  const {
    now = null,
    projectLatitude = null,
    projectElevationM = null,
    weather = null,
    autoAmbienceEnabled = true,
    qualityAmbienceEnabled = true,
    reducedMotion = false,
    manualLightingPreset = 'auto',
  } = input;

  // D-24 : Batterie faible / dégradation qualité coupe l'ambiance EN PREMIER
  if (!qualityAmbienceEnabled) {
    return {
      active: false,
      cutReason: 'low-battery-or-quality',
      timeOfDay: 'neutral',
      season: 'none',
      weatherEffect: 'none',
      weatherSource: null,
      elevationBand: 'none',
      animatedEffects: false,
      lightingPreset:
        manualLightingPreset === 'auto' ? 'atelier-neutre' : manualLightingPreset,
    };
  }

  if (!autoAmbienceEnabled) {
    return {
      active: false,
      cutReason: 'manual-off',
      timeOfDay: 'neutral',
      season: 'none',
      weatherEffect: 'none',
      weatherSource: null,
      elevationBand: 'none',
      animatedEffects: false,
      lightingPreset:
        manualLightingPreset === 'auto' ? 'atelier-neutre' : manualLightingPreset,
    };
  }

  const timeOfDay = resolveTimeOfDay(now);
  const season = resolveSeason(now, projectLatitude);
  const resolvedWeather = resolveLegitimateWeather(weather);

  let elevationBand: ResolvedAmbienceState['elevationBand'] = 'none';
  if (typeof projectElevationM === 'number' && Number.isFinite(projectElevationM)) {
    if (projectElevationM >= 2200) elevationBand = 'high-alpine';
    else if (projectElevationM >= 900) elevationBand = 'mountain';
    else elevationBand = 'plain';
  }

  return {
    active: true,
    cutReason: null,
    timeOfDay,
    season,
    weatherEffect: resolvedWeather.effect,
    weatherSource: resolvedWeather.source,
    elevationBand,
    animatedEffects: !reducedMotion && resolvedWeather.effect !== 'none',
    lightingPreset: manualLightingPreset,
  };
}
