/**
 * Itinerary Assembler & Transparent XAI Breakdown Generator.
 *
 * Converts raw routes (from Rust/WASM kernel, TS parity fallback, or Valhalla/Geoapify external
 * / multimodal legs) into unified `ComputedItinerary` objects enriched with:
 * - Adaptive Outing Fit (`scoreOutingFit` & `estimateSafeEta`)
 * - MOVE (2026) relative effort % eCRF & hydration liters
 * - Full 4-pillar French XAI (`physiology`, `equipment`, `weather`, `terrain`) with clickable
 *   map focus coordinates and data provenance timestamps.
 */

import { estimateHydrationLiters } from '../adaptive/environment';
import { mapSportToSortieActivity } from '../adaptive/loadAndReadiness';
import { scoreOutingFit } from '../adaptive/outingFit';
import { estimateSafeEta } from '../adaptive/safeEta';
import type { TechnicalGrade, TechnicalSurface, WeatherSnapshot } from '../adaptive/types';
import type { Sport } from '../state/types';
import { haversineDistanceM, sampleElevationAndSlopeBatch } from './corridorBuilder';
import type { KernelComputedRoute } from './tsFallbackEngine';
import type {
  CompactCorridorGraph,
  ComputedItinerary,
  ExplanationVariableItem,
  ItineraryElevationPoint,
  ItineraryLeg,
  RouteEnvironmentSnapshot,
  RouteExplanationBreakdown,
  RoutePlanEndpoint,
  RoutingTravelMode,
  UserCapabilityManifest,
} from './types';

export function mapModeToSport(mode: RoutingTravelMode): Sport {
  switch (mode) {
    case 'trail':
      return 'trail';
    case 'velo':
    case 'gravel':
    case 'vtt':
    case 'vae':
      return 'velo';
    case 'ski':
    case 'raquettes':
      return 'ski';
    case 'kayak':
      return 'kayak';
    case 'rando':
    case 'multimodal':
    default:
      return 'rando';
  }
}

export function modeLabelFr(mode: RoutingTravelMode): string {
  switch (mode) {
    case 'rando':
      return 'Randonnée';
    case 'trail':
      return 'Trail';
    case 'velo':
      return 'Vélo route';
    case 'gravel':
      return 'Gravel';
    case 'vtt':
      return 'VTT';
    case 'vae':
      return 'Vélo électrique';
    case 'ski':
      return 'Ski de rando';
    case 'raquettes':
      return 'Raquettes';
    case 'kayak':
      return 'Kayak / Nautique';
    case 'multimodal':
      return 'Multimodal';
  }
}

export function roleMeta(roleCode: number): {
  role: ComputedItinerary['role'];
  roleLabel: string;
} {
  switch (roleCode) {
    case 1:
      return { role: 'safer', roleLabel: 'Plus sûr & abrité' };
    case 2:
      return { role: 'gentler', roleLabel: 'Plus doux · moins d’effort' };
    case 3:
      return { role: 'faster', roleLabel: 'Plus direct' };
    default:
      return { role: 'recommended', roleLabel: 'Recommandé pour vous' };
  }
}

function sacGradeLabel(grade: number): TechnicalGrade {
  if (grade <= 1) return 'T1';
  if (grade === 2) return 'T2';
  if (grade === 3) return 'T3';
  if (grade === 4) return 'T4';
  if (grade === 5) return 'T5';
  return 'T6';
}

function formatMinutesDelta(sec: number): string {
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 1) return 'Neutre';
  return min > 0 ? `+${min} min` : `${min} min`;
}

function formatHoursMin(totalMin: number): string {
  const m = Math.max(1, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem} min`;
  return rem > 0 ? `${h}h${String(rem).padStart(2, '0')}` : `${h}h`;
}

function buildElevationProfile(
  coordsWithEle: ReadonlyArray<{ lat: number; lon: number; eleM: number }>,
): {
  profile: ItineraryElevationPoint[];
  maxAltM: number | null;
  minAltM: number | null;
  highestCoord: [number, number] | null;
  steepestCoord: [number, number] | null;
  steepestSlopePct: number;
} {
  if (coordsWithEle.length === 0) {
    return {
      profile: [],
      maxAltM: null,
      minAltM: null,
      highestCoord: null,
      steepestCoord: null,
      steepestSlopePct: 0,
    };
  }

  const maxPts = 85;
  const step = Math.max(1, Math.floor(coordsWithEle.length / maxPts));
  const profile: ItineraryElevationPoint[] = [];
  let cumM = 0;
  let maxAlt = -Infinity;
  let minAlt = Infinity;
  let highestCoord: [number, number] | null = null;
  let steepestCoord: [number, number] | null = null;
  let steepestSlopePct = 0;

  let prev = coordsWithEle[0]!;
  for (let i = 0; i < coordsWithEle.length; i++) {
    const cur = coordsWithEle[i]!;
    let segSlopePct = 0;
    if (i > 0) {
      const segM = haversineDistanceM(prev.lat, prev.lon, cur.lat, cur.lon);
      cumM += segM;
      if (segM > 4) {
        segSlopePct = Math.round(((cur.eleM - prev.eleM) / segM) * 100);
        if (Math.abs(segSlopePct) > steepestSlopePct) {
          steepestSlopePct = Math.abs(segSlopePct);
          steepestCoord = [cur.lon, cur.lat];
        }
      }
      prev = cur;
    }

    if (cur.eleM > maxAlt) {
      maxAlt = cur.eleM;
      highestCoord = [cur.lon, cur.lat];
    }
    if (cur.eleM < minAlt) {
      minAlt = cur.eleM;
    }

    if (i === 0 || i === coordsWithEle.length - 1 || i % step === 0) {
      profile.push({
        km: Math.round((cumM / 1000) * 100) / 100,
        ele: Math.round(cur.eleM),
        lat: cur.lat,
        lng: cur.lon,
        slopePct: segSlopePct,
      });
    }
  }

  return {
    profile,
    maxAltM: Number.isFinite(maxAlt) ? Math.round(maxAlt) : null,
    minAltM: Number.isFinite(minAlt) ? Math.round(minAlt) : null,
    highestCoord,
    steepestCoord,
    steepestSlopePct,
  };
}

function buildWeatherSnapshot(env: RouteEnvironmentSnapshot): WeatherSnapshot {
  return {
    temperatureC: env.temperatureHighC ?? env.temperatureStartC,
    windSpeedKmh: env.windKmh,
    windGustKmh: env.ridgeWindKmh,
    precipitationMmH: env.precipMmH,
    thunderstormRisk: env.thunderstormRisk ? 'high' : 'none',
    avalancheRiskLevel: env.avalancheBraLevel > 0 ? (env.avalancheBraLevel as 1 | 2 | 3 | 4 | 5) : null,
    wildfireAlert: env.activeFireCount > 0,
    floodAlert: env.activeFloodAlert,
    fetchedAtMs: Date.parse(env.fetchedAtIso) || Date.now(),
  };
}

function buildExplanation(params: {
  role: ComputedItinerary['role'];
  mode: RoutingTravelMode;
  manifest: UserCapabilityManifest;
  env: RouteEnvironmentSnapshot;
  distanceKm: number;
  dplusM: number;
  maxAltM: number | null;
  durationP50Min: number;
  packDeltaSec: number;
  altitudeDeltaSec: number;
  weatherDeltaSec: number;
  fatigueDeltaSec: number;
  kcal: number;
  hydrationLiters: number;
  afterDarkMinutes: number;
  maxSlopeDeg: number;
  exposed30M: number;
  maxSac: TechnicalGrade;
  surfaceBreakdownPct: RouteExplanationBreakdown['surfaceBreakdownPct'];
  waterPointsCount: number;
  sheltersCount: number;
  highestCoord: [number, number] | null;
  steepestCoord: [number, number] | null;
  originCoord: [number, number];
  destCoord: [number, number];
  legs: ItineraryLeg[];
  deltaDurationMin: number | null;
  deltaDplusM: number | null;
}): RouteExplanationBreakdown {
  const { manifest, env } = params;
  const variables: ExplanationVariableItem[] = [];

  // ── Pillar 1: Physiology & Performance ────────────────────────────────────
  variables.push({
    id: 'phys-pace',
    pillar: 'physiology',
    label: 'Allure personnelle (Campbell)',
    value: `${manifest.flatSpeedKmh.toFixed(1)} km/h plat · ${Math.round(manifest.ascentSpeedMPerH)} m/h D+`,
    impactLabel: manifest.readiness.status === 'calibrated' ? 'Calibré' : 'Prudent',
    tone: manifest.readiness.status === 'calibrated' ? 'good' : 'neutral',
    detail:
      manifest.dataSources[0] ??
      'Basé sur une allure de référence prudente ajustée à votre profil et au pourcentage de pente.',
    source: 'Profil physiologique LKDV',
  });

  variables.push({
    id: 'phys-pack',
    pillar: 'physiology',
    label: 'Poids du sac (MOVE 2026)',
    value: `${manifest.packWeightKg.toFixed(1)} kg${manifest.activeKitName ? ` (${manifest.activeKitName})` : ''}`,
    impactLabel: formatMinutesDelta(params.packDeltaSec),
    tone: params.packDeltaSec > 900 ? 'warn' : 'neutral',
    detail: `Charge portée de ${Math.round((manifest.packWeightKg / Math.max(40, manifest.bodyWeightKg)) * 100)} % du poids corporel (+20 % O₂ par tranche de 10 % en montée).`,
    source: manifest.activeKitName ? 'Kit matériel LKDV' : 'Charge estimée',
  });

  if ((params.maxAltM ?? 0) > 1500) {
    variables.push({
      id: 'phys-altitude',
      pillar: 'physiology',
      label: 'Altitude & hypoxie',
      value: `Point haut ${params.maxAltM} m (acclim. ${Math.round(manifest.readiness.altitudeAcclimatization.ceilingM)} m)`,
      impactLabel: formatMinutesDelta(params.altitudeDeltaSec),
      tone: params.altitudeDeltaSec > 600 ? 'warn' : 'neutral',
      detail: 'Au-dessus de 1 500 m, la capacité aérobie baisse d’environ 1 % par 100 m selon votre acclimatation sur 21 jours.',
      focusCoords: params.highestCoord,
      source: 'DEM AWS Terrarium + historique 21j',
    });
  }

  variables.push({
    id: 'phys-readiness',
    pillar: 'physiology',
    label: 'État de forme & récupération',
    value:
      manifest.readiness.score !== null
        ? `Readiness ${manifest.readiness.score}/100`
        : 'Aucune séance récente (neutre)',
    impactLabel:
      params.fatigueDeltaSec > 60
        ? formatMinutesDelta(params.fatigueDeltaSec)
        : manifest.readiness.score !== null
          ? 'Optimal'
          : 'Neutre',
    tone:
      params.fatigueDeltaSec > 600
        ? 'warn'
        : manifest.readiness.score !== null && manifest.readiness.score >= 70
          ? 'good'
          : 'neutral',
    detail: `${manifest.readiness.summaryFr} Dépense estimée : ${Math.round(params.kcal)} kcal · Hydratation conseillée : ${params.hydrationLiters.toFixed(1)} L.`,
    source: 'Moteur adaptatif ACWR / DOMS',
  });

  // ── Pillar 2: Equipment & Locomotion ──────────────────────────────────────
  const approachLeg = params.legs.find((l) => l.kind !== 'terrain');
  variables.push({
    id: 'equip-mode',
    pillar: 'equipment',
    label: 'Locomotion autorisée',
    value: approachLeg
      ? `${approachLeg.label} + ${modeLabelFr(params.mode)}`
      : modeLabelFr(params.mode),
    impactLabel: 'Validé',
    tone: 'good',
    detail: approachLeg
      ? `Approche multimodale jusqu’à ${approachLeg.toLabel}, puis fin d’itinéraire en ${modeLabelFr(params.mode).toLowerCase()} selon vos pratiques déclarées.`
      : `Mode ${modeLabelFr(params.mode)} validé par votre profil. Tous les passages hors de vos compétences ou de votre matériel ont été exclus.`,
    focusCoords: approachLeg?.coordinates[approachLeg.coordinates.length - 1] ?? params.originCoord,
    source: 'Inventaire matériel & pratiques',
  });

  const gearSummaryParts: string[] = [];
  if (manifest.gear.hasRainShell) gearSummaryParts.push('veste imperméable');
  if (manifest.gear.hasHeadlamp) gearSummaryParts.push('frontale');
  if (manifest.gear.hasThermalLayer) gearSummaryParts.push('couche thermique');
  if (manifest.gear.hasCramponsIceAxe) gearSummaryParts.push('crampons/piolet');
  if (manifest.gear.hasAvalancheKit) gearSummaryParts.push('DVA/pelle/sonde');

  variables.push({
    id: 'equip-safety',
    pillar: 'equipment',
    label: 'Matériel de sécurité vérifié',
    value: gearSummaryParts.length > 0 ? gearSummaryParts.slice(0, 3).join(', ') : 'Équipement basique',
    impactLabel:
      params.afterDarkMinutes > 0 && !manifest.gear.hasHeadlamp
        ? 'Frontale requise'
        : env.precipMmH > 1 && !manifest.gear.hasRainShell
          ? 'Pluie sans veste'
          : 'Adapté',
    tone:
      (params.afterDarkMinutes > 0 && !manifest.gear.hasHeadlamp) ||
      (env.precipMmH > 1 && !manifest.gear.hasRainShell)
        ? 'warn'
        : 'good',
    detail: `Limites techniques actives : sentiers ≤ T${manifest.sacMaxGrade}${manifest.mobilityProfile === 'pmr' ? ' · accès PMR sans marches' : ''}.`,
    source: 'Kits & inventaire LKDV',
  });

  // ── Pillar 3: Weather & Daylight ──────────────────────────────────────────
  const tempText =
    env.temperatureStartC !== null
      ? env.temperatureHighC !== null && Math.abs(env.temperatureHighC - env.temperatureStartC) >= 2
        ? `${Math.round(env.temperatureStartC)}°C → ${Math.round(env.temperatureHighC)}°C`
        : `${Math.round(env.temperatureStartC)}°C`
      : 'Non mesurée';

  variables.push({
    id: 'wx-conditions',
    pillar: 'weather',
    label: 'Météo & vent en crête',
    value: `${tempText} · vent ${env.windKmh} km/h (crête ${env.ridgeWindKmh} km/h)`,
    impactLabel:
      env.thunderstormRisk
        ? 'Orage · crêtes évitées'
        : params.weatherDeltaSec > 60
          ? formatMinutesDelta(params.weatherDeltaSec)
          : 'Favorable',
    tone: env.thunderstormRisk || env.ridgeWindKmh >= 50 ? 'warn' : 'good',
    detail:
      env.precipMmH > 0.2
        ? `Précipitations estimées à ${env.precipMmH} mm/h. Le routage favorise les sections abritées en forêt.`
        : 'Conditions sèches sur le corridor au moment du calcul.',
    focusCoords: params.highestCoord ?? params.destCoord,
    source: 'Open-Meteo',
    updatedAtIso: env.fetchedAtIso,
  });

  const duskMarginMin =
    env.daylight.civilDuskMs !== null
      ? Math.round((env.daylight.civilDuskMs - (Date.now() + params.durationP50Min * 60_000)) / 60_000)
      : null;

  variables.push({
    id: 'wx-daylight',
    pillar: 'weather',
    label: 'Fenêtre solaire & crépuscule',
    value:
      env.daylight.sunsetMs !== null
        ? `Coucher ${new Date(env.daylight.sunsetMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        : `${env.daylight.daylightHours}h de jour`,
    impactLabel:
      params.afterDarkMinutes > 0
        ? `+${params.afterDarkMinutes} min de nuit`
        : duskMarginMin !== null && duskMarginMin > 0
          ? `Marge +${formatHoursMin(duskMarginMin)}`
          : 'De jour',
    tone: params.afterDarkMinutes > 0 ? 'warn' : 'good',
    detail:
      params.afterDarkMinutes > 0
        ? 'L’arrivée estimée dépasse le crépuscule civil : prévoyez une lampe frontale ou un départ plus tôt.'
        : 'L’itinéraire se termine avant la tombée de la nuit avec marge de sécurité.',
    source: 'NOAA Éphémérides offline',
  });

  // ── Pillar 4: Terrain, Slopes & Vital Services ────────────────────────────
  variables.push({
    id: 'terrain-slope',
    pillar: 'terrain',
    label: 'Relief, cotation & pentes',
    value: `Max ${params.maxSac} · pente max ${Math.round(params.maxSlopeDeg)}°`,
    impactLabel: params.exposed30M > 50 ? `${Math.round(params.exposed30M)} m ≥ 30°` : 'Pentes modérées',
    tone: params.exposed30M > 150 && env.snowDepthCm >= 15 ? 'warn' : 'good',
    detail: `Revêtement : ${params.surfaceBreakdownPct.trail}% sentier, ${params.surfaceBreakdownPct.gravel}% piste, ${params.surfaceBreakdownPct.paved}% revêtu, ${params.surfaceBreakdownPct.technical}% rocher/technique.`,
    focusCoords: params.steepestCoord ?? params.highestCoord,
    source: 'OSM + DEM AWS Terrarium',
  });

  variables.push({
    id: 'terrain-services',
    pillar: 'terrain',
    label: 'Eau, abris & aléas corridor',
    value: `${params.waterPointsCount} eau · ${params.sheltersCount} abri${params.sheltersCount > 1 ? 's' : ''}`,
    impactLabel: env.activeFireCount > 0 ? `${env.activeFireCount} aléa évité` : 'Couloir dégagé',
    tone: env.activeFireCount > 0 ? 'warn' : 'good',
    detail:
      params.waterPointsCount > 0 || params.sheltersCount > 0
        ? `Points de ravitaillement et abris recensés le long du tracé (besoin estimé ${params.hydrationLiters.toFixed(1)} L).`
        : `Aucun point d’eau recensé directement sur la trace : emportez ${params.hydrationLiters.toFixed(1)} L au départ.`,
    focusCoords: params.destCoord,
    source: 'OSM + NASA EONET',
    updatedAtIso: env.fetchedAtIso,
  });

  // Concise headline & bullet synthesis
  const whyChosen: string[] = [];
  if (params.role === 'recommended') {
    whyChosen.push(
      `Adapté à votre profil (${modeLabelFr(params.mode)}, max ${params.maxSac}) avec sac de ${manifest.packWeightKg.toFixed(1)} kg.`,
    );
  } else if (params.role === 'safer') {
    whyChosen.push('Minimise les zones exposées au vent, les routes circulées et les pentes raides.');
  } else if (params.role === 'gentler') {
    whyChosen.push('Réduit la dépense métabolique (Minetti) et lisse les pourcentages de montée.');
  } else {
    whyChosen.push('Privilégie le tracé le plus direct dans le respect de vos limites de sécurité.');
  }
  if (env.thunderstormRisk) {
    whyChosen.push('Crêtes exposées pénalisées en raison du risque orageux.');
  }
  if (params.waterPointsCount > 0) {
    whyChosen.push(`${params.waterPointsCount} point${params.waterPointsCount > 1 ? 's' : ''} d’eau disponible${params.waterPointsCount > 1 ? 's' : ''} sur l’itinéraire.`);
  }

  let comparisonVsPrimary: string | null = null;
  if (params.deltaDurationMin !== null && params.deltaDplusM !== null) {
    const dt = params.deltaDurationMin === 0 ? 'même durée' : `${params.deltaDurationMin > 0 ? '+' : ''}${params.deltaDurationMin} min`;
    const dd = params.deltaDplusM === 0 ? 'même D+' : `${params.deltaDplusM > 0 ? '+' : ''}${params.deltaDplusM} m D+`;
    comparisonVsPrimary = `${dt} · ${dd} vs recommandé`;
  }

  return {
    headline: whyChosen[0] ?? 'Itinéraire calculé selon vos capacités et les conditions en direct.',
    whyChosen,
    comparisonVsPrimary,
    variables,
    surfaceBreakdownPct: params.surfaceBreakdownPct,
    maxSacGradeLabel: params.maxSac,
    maxSlopeDeg: Math.round(params.maxSlopeDeg),
    exposedSlope30PlusM: Math.round(params.exposed30M),
    waterPointsCount: params.waterPointsCount,
    sheltersCount: params.sheltersCount,
    dataFreshness: env.sources.map((s) => ({ source: s.name, updatedAtIso: s.updatedAtIso })),
  };
}

/**
 * Assembles a full `ComputedItinerary` from a Rust/WASM or TS parity kernel route.
 */
export function assembleItineraryFromKernel(params: {
  id: string;
  rank: number;
  kernelRoute: KernelComputedRoute;
  graph: CompactCorridorGraph;
  mode: RoutingTravelMode;
  engineUsed: 'rust_wasm_local' | 'ts_parity_local';
  computeTimeMs: number;
  origin: RoutePlanEndpoint;
  destination: RoutePlanEndpoint;
  manifest: UserCapabilityManifest;
  env: RouteEnvironmentSnapshot;
  departureMs: number;
  primaryReference?: { durationP50Min: number; dplusM: number; distanceKm: number } | null;
}): ComputedItinerary {
  const { kernelRoute: kr, graph, manifest, env, mode } = params;
  const { role, roleLabel } = roleMeta(kr.roleCode);
  const sport = mapModeToSport(mode);

  const coordsWithEle = kr.nodePath.map((nid) => {
    const n = graph.nodes[nid]!;
    return { lat: n.lat, lon: n.lon, eleM: n.eleM };
  });
  const coordinates: Array<[number, number]> = coordsWithEle.map((c) => [c.lon, c.lat]);

  const { profile, maxAltM, minAltM, highestCoord, steepestCoord } = buildElevationProfile(coordsWithEle);

  const distanceKm = Math.round((kr.distanceM / 1000) * 100) / 100;
  const dplusM = Math.round(kr.dplusM);
  const dminusM = Math.round(kr.dminusM);
  const durationP50Min = Math.max(1, Math.round(kr.durationSec / 60));
  const durationP90Min = Math.max(durationP50Min + 4, Math.round(durationP50Min * 1.22));
  const weather = buildWeatherSnapshot(env);

  const maxSac = sacGradeLabel(kr.maxSacGrade);
  const totalSurf = Math.max(1, kr.pavedM + kr.gravelM + kr.trailM + kr.technicalM);
  const surfaceBreakdownPct = {
    paved: Math.round((kr.pavedM / totalSurf) * 100),
    gravel: Math.round((kr.gravelM / totalSurf) * 100),
    trail: Math.round((kr.trailM / totalSurf) * 100),
    technical: Math.round((kr.technicalM / totalSurf) * 100),
  };
  const dominantSurface: TechnicalSurface =
    surfaceBreakdownPct.technical >= 30
      ? 'rocky_alpine'
      : surfaceBreakdownPct.paved >= 60
        ? 'paved'
        : surfaceBreakdownPct.gravel >= 50
          ? 'gravel'
          : 'trail';

  const safeEta = estimateSafeEta({
    activity: mapSportToSortieActivity(sport),
    distanceKm: Math.max(0.2, distanceKm),
    elevationGainM: dplusM,
    elevationLossM: dminusM,
    maxAltitudeM: maxAltM,
    meanAltitudeM: maxAltM && minAltM ? Math.round((maxAltM + minAltM) * 0.5) : maxAltM,
    packWeightKg: manifest.packWeightKg,
    lat: params.destination.lat,
    lng: params.destination.lng,
    departureAtMs: params.departureMs,
    readiness: manifest.readiness,
    weather,
    surface: dominantSurface,
    technicalGrade: maxSac,
  });

  const fit = scoreOutingFit({
    safeEta,
    readiness: manifest.readiness,
    weather,
    gear: manifest.gear,
    maxAltitudeM: maxAltM,
    technicalGrade: maxSac,
    surface: dominantSurface,
  });

  const arrivalMs = params.departureMs + durationP50Min * 60_000;
  const afterDarkMinutes =
    env.daylight.civilDuskMs !== null && arrivalMs > env.daylight.civilDuskMs
      ? Math.round((arrivalMs - env.daylight.civilDuskMs) / 60_000)
      : 0;

  const hydrationLiters = estimateHydrationLiters({
    durationHours: durationP50Min / 60,
    temperatureC: env.temperatureStartC,
    elevationGainM: dplusM,
  });

  // MOVE (2026) relative effort % eCRF approximation from kcal/min vs VO2max
  const kcalPerMin = kr.kcal / Math.max(1, durationP50Min);
  const vo2NeededMlKgMin = (kcalPerMin * 200) / Math.max(40, manifest.bodyWeightKg);
  const relativeEffortPct = Math.min(100, Math.max(15, Math.round((vo2NeededMlKgMin / Math.max(25, manifest.vo2maxMlKgMin)) * 100)));

  const deltaDurationMin = params.primaryReference
    ? durationP50Min - params.primaryReference.durationP50Min
    : null;
  const deltaDplusM = params.primaryReference ? dplusM - params.primaryReference.dplusM : null;
  const deltaDistanceKm = params.primaryReference
    ? Math.round((distanceKm - params.primaryReference.distanceKm) * 100) / 100
    : null;

  const leg: ItineraryLeg = {
    id: `${params.id}-terrain`,
    kind: 'terrain',
    mode,
    label: modeLabelFr(mode),
    fromLabel: params.origin.label || 'Départ',
    toLabel: params.destination.label || 'Destination',
    distanceKm,
    durationMin: durationP50Min,
    dplusM,
    dminusM,
    coordinates,
  };

  const explanation = buildExplanation({
    role,
    mode,
    manifest,
    env,
    distanceKm,
    dplusM,
    maxAltM,
    durationP50Min,
    packDeltaSec: kr.packDeltaSec,
    altitudeDeltaSec: kr.altitudeDeltaSec,
    weatherDeltaSec: kr.weatherDeltaSec,
    fatigueDeltaSec: kr.fatigueDeltaSec,
    kcal: kr.kcal,
    hydrationLiters,
    afterDarkMinutes,
    maxSlopeDeg: kr.maxSlopeDeg,
    exposed30M: kr.exposed30M,
    maxSac,
    surfaceBreakdownPct,
    waterPointsCount: kr.waterPts,
    sheltersCount: kr.shelters,
    highestCoord,
    steepestCoord,
    originCoord: [params.origin.lng, params.origin.lat],
    destCoord: [params.destination.lng, params.destination.lat],
    legs: [leg],
    deltaDurationMin,
    deltaDplusM,
  });

  return {
    id: params.id,
    rank: params.rank,
    role,
    roleLabel,
    title: `${roleLabel} · ${params.destination.label || 'Destination'}`,
    mode,
    recommendedSport: sport,
    engineUsed: params.engineUsed,
    computeTimeMs: params.computeTimeMs,
    distanceKm,
    dplusM,
    dminusM,
    maxAltM,
    minAltM,
    durationP50Min,
    durationP90Min,
    estimatedKcal: Math.round(kr.kcal),
    relativeEffortPct,
    hydrationLiters,
    arrivalTimeIso: new Date(arrivalMs).toISOString(),
    turnaroundTimeIso: safeEta.turnaroundAtMs ? new Date(safeEta.turnaroundAtMs).toISOString() : null,
    afterDarkMinutes,
    deltaDurationMin,
    deltaDplusM,
    deltaDistanceKm,
    overlapRatioWithPrimary: Math.round(kr.overlapRatio * 100) / 100,
    fit,
    geojson: {
      type: 'Feature',
      properties: {
        itineraryId: params.id,
        rank: params.rank,
        role,
        roleLabel,
        mode,
        durationP50Min,
        dplusM,
        distanceKm,
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    },
    legs: [leg],
    elevationProfile: profile,
    explanation,
  };
}

/**
 * Assembles a full `ComputedItinerary` from external router legs (Valhalla/Geoapify or Multimodal).
 * Enriches coordinates with real AWS Terrarium DEM elevation & applies our full biomechanical XAI.
 */
export async function assembleItineraryFromExternalLegs(params: {
  id: string;
  rank: number;
  roleCode: number;
  mode: RoutingTravelMode;
  engineUsed: 'valhalla_enriched' | 'geoapify_enriched' | 'multimodal_hybrid';
  computeTimeMs: number;
  legs: ItineraryLeg[];
  origin: RoutePlanEndpoint;
  destination: RoutePlanEndpoint;
  manifest: UserCapabilityManifest;
  env: RouteEnvironmentSnapshot;
  departureMs: number;
  primaryReference?: { durationP50Min: number; dplusM: number; distanceKm: number } | null;
}): Promise<ComputedItinerary> {
  const { manifest, env, mode } = params;
  const { role, roleLabel } = roleMeta(params.roleCode);
  const sport = mapModeToSport(mode);

  const allCoords: Array<[number, number]> = [];
  for (const leg of params.legs) {
    for (const c of leg.coordinates) {
      if (allCoords.length === 0) {
        allCoords.push(c);
      } else {
        const last = allCoords[allCoords.length - 1]!;
        if (last[0] !== c[0] || last[1] !== c[1]) {
          allCoords.push(c);
        }
      }
    }
  }

  // Downsample up to 120 points for fast DEM elevation sampling
  const sampleStep = Math.max(1, Math.floor(allCoords.length / 120));
  const sampledPoints: Array<{ lat: number; lon: number }> = [];
  for (let i = 0; i < allCoords.length; i += sampleStep) {
    sampledPoints.push({ lon: allCoords[i]![0], lat: allCoords[i]![1] });
  }
  if (allCoords.length > 0) {
    const last = allCoords[allCoords.length - 1]!;
    sampledPoints.push({ lon: last[0], lat: last[1] });
  }

  const dem = await sampleElevationAndSlopeBatch(sampledPoints);
  const coordsWithEle = sampledPoints.map((pt, idx) => ({
    lat: pt.lat,
    lon: pt.lon,
    eleM: dem[idx]?.eleM ?? 0,
  }));

  let dplusM = 0;
  let dminusM = 0;
  let maxSlopeDeg = 0;
  let exposed30M = 0;
  for (let i = 1; i < coordsWithEle.length; i++) {
    const dz = coordsWithEle[i]!.eleM - coordsWithEle[i - 1]!.eleM;
    if (dz > 1.5) dplusM += dz;
    else if (dz < -1.5) dminusM += -dz;
    const slope = dem[i]?.slopeDeg ?? 0;
    if (slope > maxSlopeDeg) maxSlopeDeg = slope;
    if (slope >= 30) {
      exposed30M += haversineDistanceM(
        coordsWithEle[i - 1]!.lat,
        coordsWithEle[i - 1]!.lon,
        coordsWithEle[i]!.lat,
        coordsWithEle[i]!.lon,
      );
    }
  }
  dplusM = Math.round(dplusM);
  dminusM = Math.round(dminusM);

  const { profile, maxAltM, minAltM, highestCoord, steepestCoord } = buildElevationProfile(coordsWithEle);

  const distanceKm = Math.round(params.legs.reduce((s, l) => s + l.distanceKm, 0) * 100) / 100;
  const baseDurMin = Math.max(1, Math.round(params.legs.reduce((s, l) => s + l.durationMin, 0)));

  // Apply MOVE 2026 pack, altitude & readiness deltas on terrain legs
  const terrainLegs = params.legs.filter((l) => l.kind === 'terrain');
  const terrainBaseSec = Math.max(60, terrainLegs.reduce((s, l) => s + l.durationMin, 0) * 60);
  const loadRatio = manifest.packWeightKg / Math.max(40, manifest.bodyWeightKg);
  const packDeltaSec = terrainBaseSec * loadRatio * 1.1;
  const effAlt = Math.max(0, (maxAltM ?? 0) - Math.max(1500, manifest.readiness.altitudeAcclimatization.ceilingM));
  const altitudeDeltaSec = terrainBaseSec * ((effAlt / 100) * 0.01);
  const weatherDeltaSec = terrainBaseSec * (env.windKmh > 25 ? Math.min(0.25, (env.windKmh - 25) * 0.005) : 0);
  const fatigueDeltaSec =
    manifest.readiness.score !== null && manifest.readiness.score < 65
      ? terrainBaseSec * (((65 - manifest.readiness.score) / 65) * 0.2)
      : 0;

  const extraMin = Math.round((packDeltaSec + altitudeDeltaSec + weatherDeltaSec + fatigueDeltaSec) / 60);
  const durationP50Min = Math.max(1, baseDurMin + extraMin);
  const durationP90Min = Math.max(durationP50Min + 5, Math.round(durationP50Min * 1.2));

  const weather = buildWeatherSnapshot(env);
  const maxSac: TechnicalGrade = maxSlopeDeg >= 28 ? 'T3' : maxSlopeDeg >= 16 ? 'T2' : 'T1';
  const safeEta = estimateSafeEta({
    activity: mapSportToSortieActivity(sport),
    distanceKm: Math.max(0.2, terrainLegs.reduce((s, l) => s + l.distanceKm, 0) || distanceKm),
    elevationGainM: dplusM,
    elevationLossM: dminusM,
    maxAltitudeM: maxAltM,
    meanAltitudeM: maxAltM && minAltM ? Math.round((maxAltM + minAltM) * 0.5) : maxAltM,
    packWeightKg: manifest.packWeightKg,
    lat: params.destination.lat,
    lng: params.destination.lng,
    departureAtMs: params.departureMs,
    readiness: manifest.readiness,
    weather,
    surface: 'trail',
    technicalGrade: maxSac,
  });

  const fit = scoreOutingFit({
    safeEta,
    readiness: manifest.readiness,
    weather,
    gear: manifest.gear,
    maxAltitudeM: maxAltM,
    technicalGrade: maxSac,
    surface: 'trail',
  });

  const arrivalMs = params.departureMs + durationP50Min * 60_000;
  const afterDarkMinutes =
    env.daylight.civilDuskMs !== null && arrivalMs > env.daylight.civilDuskMs
      ? Math.round((arrivalMs - env.daylight.civilDuskMs) / 60_000)
      : 0;

  const hasTerrainLeg = terrainLegs.length > 0;
  const terrainDistKm = terrainLegs.reduce((s, l) => s + l.distanceKm, 0);
  const kcal = hasTerrainLeg
    ? Math.round((terrainDistKm * 58 + dplusM * 0.65) * ((manifest.bodyWeightKg + manifest.packWeightKg) / 75))
    : Math.round(durationP50Min * 1.3);
  const hydrationLiters = hasTerrainLeg
    ? estimateHydrationLiters({
        durationHours: Math.max(0.3, terrainBaseSec / 3600),
        temperatureC: env.temperatureStartC,
        elevationGainM: dplusM,
      })
    : Math.max(0.5, Number(((durationP50Min / 60) * 0.25).toFixed(1)));
  const relativeEffortPct = hasTerrainLeg
    ? Math.min(95, Math.max(25, Math.round((kcal / Math.max(15, durationP50Min)) * 9)))
    : 15;

  const hasApproach = params.legs.some((l) => l.kind !== 'terrain');
  const surfaceBreakdownPct = hasApproach
    ? { paved: 55, gravel: 15, trail: 25, technical: 5 }
    : mode === 'velo'
      ? { paved: 90, gravel: 10, trail: 0, technical: 0 }
      : { paved: 20, gravel: 25, trail: 50, technical: 5 };

  const deltaDurationMin = params.primaryReference
    ? durationP50Min - params.primaryReference.durationP50Min
    : null;
  const deltaDplusM = params.primaryReference ? dplusM - params.primaryReference.dplusM : null;
  const deltaDistanceKm = params.primaryReference
    ? Math.round((distanceKm - params.primaryReference.distanceKm) * 100) / 100
    : null;

  const explanation = buildExplanation({
    role,
    mode,
    manifest,
    env,
    distanceKm,
    dplusM,
    maxAltM,
    durationP50Min,
    packDeltaSec,
    altitudeDeltaSec,
    weatherDeltaSec,
    fatigueDeltaSec,
    kcal,
    hydrationLiters,
    afterDarkMinutes,
    maxSlopeDeg,
    exposed30M,
    maxSac,
    surfaceBreakdownPct,
    waterPointsCount: 0,
    sheltersCount: 0,
    highestCoord,
    steepestCoord,
    originCoord: [params.origin.lng, params.origin.lat],
    destCoord: [params.destination.lng, params.destination.lat],
    legs: params.legs,
    deltaDurationMin,
    deltaDplusM,
  });

  return {
    id: params.id,
    rank: params.rank,
    role,
    roleLabel,
    title: `${roleLabel} · ${params.destination.label || 'Destination'}`,
    mode,
    recommendedSport: sport,
    engineUsed: params.engineUsed,
    computeTimeMs: params.computeTimeMs,
    distanceKm,
    dplusM,
    dminusM,
    maxAltM,
    minAltM,
    durationP50Min,
    durationP90Min,
    estimatedKcal: kcal,
    relativeEffortPct,
    hydrationLiters,
    arrivalTimeIso: new Date(arrivalMs).toISOString(),
    turnaroundTimeIso: safeEta.turnaroundAtMs ? new Date(safeEta.turnaroundAtMs).toISOString() : null,
    afterDarkMinutes,
    deltaDurationMin,
    deltaDplusM,
    deltaDistanceKm,
    overlapRatioWithPrimary: params.rank === 0 ? 0 : 0.45,
    fit,
    geojson: {
      type: 'Feature',
      properties: {
        itineraryId: params.id,
        rank: params.rank,
        role,
        roleLabel,
        mode,
        durationP50Min,
        dplusM,
        distanceKm,
      },
      geometry: {
        type: 'LineString',
        coordinates: allCoords,
      },
    },
    legs: params.legs,
    elevationProfile: profile,
    explanation,
  };
}
