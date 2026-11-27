/**
 * Passerelle d'intégration unifiée (Track F) entre :
 * - Les pré-réglages du store (`state/presets.ts`) et le rail UI (`PresetPillRail.tsx`),
 * - Le registre de calques MapLibre (`layerRegistry.ts`) et `UnifiedLayersSheet.tsx`,
 * - L'API `/api/explorer/v2/territory/encyclopedia` et `TerritorialEncyclopediaSheet.tsx`,
 * - Le moteur adaptatif (`adaptive/`) et `AdaptiveReadinessCard.tsx`.
 */

import type { ExplorerPresetId as StorePresetId } from './state/presets';
import type { ExplorerPresetId as AdaptivePresetId } from './adaptive/types';
import type { TerritorialEncyclopediaEntry } from './data/unifiedLayersHooks';
import {
  MAX_SIMULTANEOUS_ANALYTICAL_RASTERS,
  type TerritorialEncyclopediaData,
  type UnifiedLayerCategory,
  type UnifiedLayerItem,
} from './types/encyclopedia';

export {
  MAX_SIMULTANEOUS_ANALYTICAL_RASTERS,
  type TerritorialEncyclopediaData,
  type UnifiedLayerCategory,
  type UnifiedLayerItem,
};
import { UNIFIED_LAYER_BY_KEY } from './map/layerRegistry';
import {
  computeExplorerReadiness,
  estimateSafeEta,
  mapSportToSortieActivity,
  recommendActivityPreset,
  scoreOutingFit,
  type ActivityPresetRecommendation,
  type ExplorerReadiness,
  type OutingFitResult,
  type SafeEtaResult,
  type SessionRecord,
  type WeatherSnapshot,
} from './adaptive';
import type { Profile, Sport } from './state/types';

export const STORE_TO_ADAPTIVE_PRESET: Readonly<Record<StorePresetId, AdaptivePresetId>> = {
  clean: 'epure',
  hiking: 'rando_montagne',
  trail: 'trail_run',
  mtb: 'vtt_gravel',
  bivouac: 'bivouac_astro',
  nautical: 'nautique',
  safety: 'securite_risques',
  pokedex: 'pokedex',
  community: 'communaute',
  custom: 'rando_montagne',
};

export const ADAPTIVE_TO_STORE_PRESET: Readonly<Record<AdaptivePresetId, Exclude<StorePresetId, 'custom'>>> = {
  epure: 'clean',
  rando_montagne: 'hiking',
  trail_run: 'trail',
  vtt_gravel: 'mtb',
  bivouac_astro: 'bivouac',
  nautique: 'nautical',
  securite_risques: 'safety',
  pokedex: 'pokedex',
  communaute: 'community',
};

export interface UnifiedLayerFreshnessMap {
  hazards?: number | null;
  radar?: number | null;
  airspace?: number | null;
  pokedex?: number | null;
  social?: number | null;
}

const LAYER_UI_META: Readonly<
  Record<
    string,
    {
      category: UnifiedLayerCategory;
      label: string;
      description: string;
      icon?: string;
      isLive?: boolean;
      staleThresholdMin?: number;
      freshnessKey?: keyof UnifiedLayerFreshnessMap;
    }
  >
> = {
  routes: {
    category: 'outdoor',
    label: 'Sentiers & itinéraires OSM',
    description: 'GR, PR, pistes VTT, refuges et accès',
    icon: 'route',
  },
  surfaceLayer: {
    category: 'outdoor',
    label: 'Revêtements & surfaces',
    description: 'Asphalte, gravier, terre et sentiers techniques OSM',
    icon: 'layers',
  },
  bikePois: {
    category: 'outdoor',
    label: 'Services vélo & VAE',
    description: 'Ateliers, locations, bornes de réparation et recharge',
    icon: 'bike',
  },
  avalancheSlope: {
    category: 'outdoor',
    label: 'Pentes > 30° (raster offline)',
    description: 'Inclinaison alpine & avalanche hachurée (AWS DEM)',
    icon: 'mountain',
  },
  lightPollution: {
    category: 'outdoor',
    label: 'Pollution lumineuse (raster)',
    description: 'NASA VIIRS Black Marble pour bivouac étoilé',
    icon: 'moon',
  },
  openseamap: {
    category: 'outdoor',
    label: 'Balisage nautique OpenSeaMap (raster)',
    description: 'Bouées, chenaux, ports et amers côtiers',
    icon: 'anchor',
  },
  waterwaysNav: {
    category: 'outdoor',
    label: 'Rivières & eaux navigables',
    description: 'Sections kayak, embarquements et rapides',
    icon: 'waves',
  },
  rainRadar: {
    category: 'safety_live',
    label: 'Radar précipitations (raster)',
    description: 'Pluie et averses temps réel (RainViewer, z≤7)',
    icon: 'cloud-rain',
    isLive: true,
    staleThresholdMin: 20,
    freshnessKey: 'radar',
  },
  hazardFires: {
    category: 'safety_live',
    label: 'Feux de forêt & incendies',
    description: 'Détections satellites NASA EONET / FIRMS',
    icon: 'flame',
    isLive: true,
    staleThresholdMin: 45,
    freshnessKey: 'hazards',
  },
  hazardFloods: {
    category: 'safety_live',
    label: 'Crues & hydrométrie rivières',
    description: 'Stations temps réel Hub’Eau & alertes officielles',
    icon: 'droplets',
    isLive: true,
    staleThresholdMin: 60,
    freshnessKey: 'hazards',
  },
  hazardSeismic: {
    category: 'safety_live',
    label: 'Séismes récents (USGS)',
    description: 'Secousses M≥2.5 des dernières 48 h',
    icon: 'activity',
    isLive: true,
    staleThresholdMin: 45,
    freshnessKey: 'hazards',
  },
  airspaceAircraft: {
    category: 'safety_live',
    label: 'Trafic & couloirs aériens',
    description: 'Aéronefs ADS-B en direct (OpenSky Network)',
    icon: 'plane',
    isLive: true,
    staleThresholdMin: 5,
    freshnessKey: 'airspace',
  },
  pokedexGbif: {
    category: 'pokedex',
    label: 'Densité biodiversité GBIF (raster)',
    description: '3,5 Md d’occurrences faune & flore mondiales',
    icon: 'leaf',
  },
  pokedexSpecies: {
    category: 'pokedex',
    label: 'Observations Pokédex (iNaturalist)',
    description: 'Espèces géolocalisées, statut rare & menacé',
    icon: 'leaf',
    isLive: true,
    staleThresholdMin: 720,
    freshnessKey: 'pokedex',
  },
  savedPlaces: {
    category: 'community',
    label: 'Lieux enregistrés',
    description: 'Points favoris et repères personnels épinglés',
    icon: 'bookmark',
  },
  communityHeatmap: {
    category: 'community',
    label: 'Fréquentation collective',
    description: 'Traces communautaires agrégées (k-anonymat actif)',
    icon: 'flame',
  },
  personalHeatmap: {
    category: 'community',
    label: 'Ma heatmap personnelle',
    description: 'Historique de tes sorties et traces enregistrées',
    icon: 'footprints',
  },
  socialCarnets: {
    category: 'community',
    label: 'Carnets de voyage publics',
    description: 'Récits et étapes contextualisés sur la zone',
    icon: 'users',
    isLive: true,
    staleThresholdMin: 30,
    freshnessKey: 'social',
  },
  socialClubs: {
    category: 'community',
    label: 'Clubs outdoor locaux',
    description: 'Clubs actifs et sorties collectives à proximité',
    icon: 'users',
    isLive: true,
    staleThresholdMin: 30,
    freshnessKey: 'social',
  },
  socialStories: {
    category: 'community',
    label: 'Stories & posts géolocalisés',
    description: 'Moments terrain récents de la communauté',
    icon: 'users',
    isLive: true,
    staleThresholdMin: 30,
    freshnessKey: 'social',
  },
  socialFriends: {
    category: 'community',
    label: 'Amis & abonnés (floutage ≥250 m)',
    description: 'Présence approximative opt-in (connexion requise)',
    icon: 'users',
    isLive: true,
    staleThresholdMin: 15,
    freshnessKey: 'social',
  },
  socialBottles: {
    category: 'community',
    label: 'Bouteilles à la mer',
    description: 'Expéditions ouvertes et groupes de voyage publics',
    icon: 'users',
    isLive: true,
    staleThresholdMin: 30,
    freshnessKey: 'social',
  },
};

export function buildUnifiedLayerItems(
  layerVisibility: Record<string, boolean>,
  freshness: UnifiedLayerFreshnessMap,
): UnifiedLayerItem[] {
  return Object.entries(LAYER_UI_META).map(([key, meta]) => {
    const spec = UNIFIED_LAYER_BY_KEY[key];
    return {
      id: key,
      category: meta.category,
      label: meta.label,
      description: meta.description,
      enabled: layerVisibility[key] === true,
      isAnalyticalRaster: spec?.isAnalyticalRaster ?? false,
      isLive: meta.isLive ?? false,
      updatedAtMs: meta.freshnessKey ? (freshness[meta.freshnessKey] ?? null) : null,
      staleThresholdMin: meta.staleThresholdMin,
    };
  });
}

const EMERGENCY_LABELS_FR: Readonly<Record<string, string>> = {
  general: 'Urgences',
  universal: 'Urgences',
  medical: 'SAMU',
  ambulance: 'SAMU',
  fire: 'Pompiers',
  police: 'Police',
  mountain: 'Secours montagne',
  mountainRescue: 'Secours montagne',
};

export function mapEncyclopediaEntryToSheetData(
  entry: TerritorialEncyclopediaEntry | null | undefined,
  fallback: {
    scale: TerritorialEncyclopediaData['scale'];
    id: string;
    name: string;
    subtitle?: string | null;
    routeCount?: number;
  },
): TerritorialEncyclopediaData {
  if (!entry) {
    return {
      id: fallback.id,
      scale: fallback.scale,
      name: fallback.name,
      subtitle: fallback.subtitle ?? 'Chargement de l’encyclopédie territoriale…',
      breadcrumb: [{ id: fallback.id, scale: fallback.scale, label: fallback.name }],
      geography: { summaryFr: null },
      safety: { emergencyNumbers: [{ label: 'Urgences Europe', number: '112' }], activeHazards: [] },
      weatherHydrology: null,
      activities: { tags: ['Randonnée', 'Trail', 'VTT'], routeCount: fallback.routeCount ?? 0, featuredTrails: [] },
      pokedex: [],
      community: [],
    };
  }

  const emergencyNumbers: Array<{ label: string; number: string }> = [];
  const rawEmergency = entry.practical?.emergencyNumbers;
  if (rawEmergency && typeof rawEmergency === 'object') {
    for (const [key, value] of Object.entries(rawEmergency)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        emergencyNumbers.push({
          label: EMERGENCY_LABELS_FR[key] ?? key,
          number: value.trim(),
        });
      }
    }
  }
  if (emergencyNumbers.length === 0) {
    emergencyNumbers.push({ label: 'Urgences', number: '112' });
  }

  const parsedUpdatedMs = entry.weather?.observedAt
    ? Date.parse(entry.weather.observedAt)
    : null;
  const safeUpdatedMs =
    parsedUpdatedMs !== null && Number.isFinite(parsedUpdatedMs) ? parsedUpdatedMs : null;

  const severityFromSummary = (
    raw: string | null | undefined,
  ): 'info' | 'warn' | 'critical' => {
    const norm = (raw ?? '').toLowerCase();
    if (norm === 'extreme' || norm === 'severe' || norm === 'critical') return 'critical';
    if (norm === 'moderate' || norm === 'warn') return 'warn';
    return 'info';
  };

  const hazardsSummary = entry.hazardsSummary ?? {
    activeWildfires: 0,
    activeAlerts: 0,
    highestSeverity: null,
    headlines: [],
  };

  const activeHazards: TerritorialEncyclopediaData['safety']['activeHazards'] = [];
  if (hazardsSummary.activeWildfires > 0) {
    activeHazards.push({
      id: 'hz-wildfires',
      title: `${hazardsSummary.activeWildfires} feu${hazardsSummary.activeWildfires > 1 ? 'x' : ''} de forêt actif${hazardsSummary.activeWildfires > 1 ? 's' : ''} détecté${hazardsSummary.activeWildfires > 1 ? 's' : ''}`,
      severity: 'critical',
      updatedAtMs: safeUpdatedMs,
      staleThresholdMin: 45,
    });
  }
  for (let idx = 0; idx < (hazardsSummary.headlines ?? []).length; idx += 1) {
    const headline = hazardsSummary.headlines[idx];
    if (!headline) continue;
    activeHazards.push({
      id: `hz-alert-${idx}`,
      title: headline,
      severity: severityFromSummary(hazardsSummary.highestSeverity),
      updatedAtMs: safeUpdatedMs,
      staleThresholdMin: 120,
    });
  }

  const biomeParts: string[] = [];
  if (entry.practical?.continent) biomeParts.push(entry.practical.continent);
  if (entry.practical?.capital) biomeParts.push(`Capitale : ${entry.practical.capital}`);
  if (entry.practical?.currencyCode) biomeParts.push(entry.practical.currencyCode);

  const practicalAdvisoryParts: string[] = [];
  if (entry.practical?.languages && entry.practical.languages.length > 0) {
    practicalAdvisoryParts.push(`Langues : ${entry.practical.languages.slice(0, 3).join(', ')}`);
  }
  if (entry.practical?.drivingSide) {
    practicalAdvisoryParts.push(`Conduite : ${entry.practical.drivingSide}`);
  }
  if (entry.practical?.plugTypes && entry.practical.plugTypes.length > 0) {
    practicalAdvisoryParts.push(`Prises : ${entry.practical.plugTypes.join(', ')}`);
  }

  const topSpecies = entry.biodiversity?.topSpecies ?? [];
  const publicCarnetsCount = entry.community?.publicCarnetsCount ?? 0;
  const publicClubsCount = entry.community?.publicClubsCount ?? 0;

  return {
    id: entry.id,
    scale: entry.scale,
    name: entry.name,
    subtitle: entry.wiki?.description ?? fallback.subtitle ?? null,
    breadcrumb: [
      { id: 'world', scale: 'world', label: 'Monde' },
      ...(entry.scale !== 'world'
        ? [{ id: entry.id, scale: entry.scale, label: entry.name }]
        : []),
    ],
    geography: {
      biome: biomeParts.length > 0 ? biomeParts.join(' · ') : null,
      areaSummary:
        entry.practical?.areaKm2 != null
          ? `${Math.round(entry.practical.areaKm2).toLocaleString('fr-FR')} km²`
          : null,
      summaryFr: entry.wiki?.extract ?? null,
    },
    safety: {
      emergencyNumbers,
      bivouacPolicyFr:
        practicalAdvisoryParts.length > 0 ? practicalAdvisoryParts.join(' · ') : null,
      activeHazards,
    },
    weatherHydrology:
      entry.weather &&
      (entry.weather.temperatureC != null || entry.weather.windMs != null)
        ? {
            temperatureC: entry.weather.temperatureC,
            windKmh:
              entry.weather.windMs != null ? Math.round(entry.weather.windMs * 3.6) : null,
            summaryFr: entry.weather.symbol
              ? `Conditions : ${entry.weather.symbol.replace(/_/g, ' ')}`
              : null,
            updatedAtMs: safeUpdatedMs,
          }
        : null,
    activities: {
      tags: ['Randonnée', 'Trail', 'VTT', 'Bivouac', 'Nautique'],
      routeCount: fallback.routeCount ?? 0,
      featuredTrails: [],
    },
    pokedex: topSpecies.map((sp) => ({
      id: String(sp.taxonId),
      commonName: sp.commonName || sp.scientificName,
      scientificName: sp.scientificName,
      status: sp.threatened
        ? 'threatened'
        : sp.observationCount < 10
          ? 'rare'
          : sp.observationCount < 40
            ? 'uncommon'
            : 'common',
      photoUrl: sp.photoUrl,
      wikipediaUrl: null,
    })),
    community: [
      ...(publicCarnetsCount > 0
        ? [
            {
              id: 'comm-carnets',
              kind: 'carnet' as const,
              title: `${publicCarnetsCount} carnet${publicCarnetsCount > 1 ? 's' : ''} de voyage`,
              subtitle: 'Récits publics sur ce territoire',
            },
          ]
        : []),
      ...(publicClubsCount > 0
        ? [
            {
              id: 'comm-clubs',
              kind: 'club' as const,
              title: `${publicClubsCount} club${publicClubsCount > 1 ? 's' : ''} actif${publicClubsCount > 1 ? 's' : ''}`,
              subtitle: 'Sorties collectives et inventaire partagé',
            },
          ]
        : []),
    ],
  };
}

export interface AdaptiveOverviewBundle {
  readiness: ExplorerReadiness;
  recommendation: ActivityPresetRecommendation;
  safeEta: SafeEtaResult | null;
  outingFit: OutingFitResult | null;
  selectedRouteTitle: string | null;
}

export function buildAdaptiveOverviewBundle(params: {
  sessions: readonly SessionRecord[];
  profileMode: Profile;
  gear?: import('./adaptive/types').GearInventory | null;
  packWeightKg?: number | null;
  temperatureC?: number | null;
  windKmh?: number | null;
  precipMm?: number | null;
  selectedRoute?: {
    id: string;
    title: string;
    sport: Sport;
    distanceKm: number;
    elevationGainM: number;
    maxAltitudeM?: number | null;
    startLat: number;
    startLng: number;
  } | null;
  nowMs: number;
}): AdaptiveOverviewBundle {
  const readiness = computeExplorerReadiness(
    {
      sessions: params.sessions,
    },
    params.nowMs,
  );

  const hasWx = params.temperatureC != null || params.windKmh != null || params.precipMm != null;
  const weather: WeatherSnapshot | null = hasWx
    ? {
        temperatureC: params.temperatureC ?? null,
        windSpeedKmh: params.windKmh ?? null,
        precipitationMmH: params.precipMm ?? null,
        fetchedAtMs: params.nowMs,
      }
    : null;

  const preferredSport: Sport | null =
    params.selectedRoute?.sport ??
    (params.profileMode === 'famille' || params.profileMode === 'enfants'
      ? 'famille'
      : params.profileMode === 'sportif'
        ? 'trail'
        : params.profileMode === 'solo' || params.profileMode === 'senior' || params.profileMode === 'pmr'
          ? 'rando'
          : null);

  const recommendation = recommendActivityPreset({
    readiness,
    weather,
    preferredSport,
    nowMs: params.nowMs,
  });

  const surface = params.precipMm && params.precipMm > 1 ? 'mud' : 'trail';

  const safeEta = params.selectedRoute
    ? estimateSafeEta({
        activity: mapSportToSortieActivity(params.selectedRoute.sport),
        distanceKm: Math.max(0.5, params.selectedRoute.distanceKm),
        elevationGainM: Math.max(0, params.selectedRoute.elevationGainM),
        elevationLossM: Math.max(0, params.selectedRoute.elevationGainM),
        maxAltitudeM: params.selectedRoute.maxAltitudeM ?? null,
        meanAltitudeM: params.selectedRoute.maxAltitudeM
          ? Math.round(params.selectedRoute.maxAltitudeM * 0.75)
          : null,
        packWeightKg: params.packWeightKg ?? null,
        lat: params.selectedRoute.startLat,
        lng: params.selectedRoute.startLng,
        departureAtMs: params.nowMs,
        readiness,
        weather,
        surface,
        technicalGrade: 'T2',
      })
    : null;

  const outingFit =
    params.selectedRoute && safeEta
      ? scoreOutingFit({
          safeEta,
          readiness,
          weather,
          gear: params.gear ?? null,
          maxAltitudeM: params.selectedRoute.maxAltitudeM ?? null,
          technicalGrade: 'T2',
          surface,
        })
      : null;

  return {
    readiness,
    recommendation,
    safeEta,
    outingFit,
    selectedRouteTitle: params.selectedRoute?.title ?? null,
  };
}
