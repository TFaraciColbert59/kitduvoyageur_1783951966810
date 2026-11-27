/**
 * Explorer v2 — Fail-Safe User Capability Manifest Builder & Server Loader.
 *
 * Bridges real Supabase user data (physiology, orientation, traveller altitude,
 * sport capabilities, locomotion assets, 28d sessions, wellness snapshots,
 * product_ownership + materiel_kits) into a strict, deterministic
 * `UserCapabilityManifest`.
 *
 * Strict Silent Fail-Safe Invariant:
 * - Unproven modes (nautical/kayak, cycling, car, ski touring, alpine T4+, via ferrata)
 *   are NEVER enabled by default.
 * - Guests and incomplete profiles receive a calm, conservative foot (+ public transit)
 *   manifest capped at SAC T2 with zero hidden-shortcut nagging.
 */

import { computeExplorerReadiness } from '../adaptive/loadAndReadiness';
import type {
  BiometricWellnessSnapshot,
  GearInventory,
  SessionRecord,
} from '../adaptive/types';
import type {
  LocomotionAssetKind,
  MobilityProfileKind,
  RoutingPriority,
  RoutingTravelMode,
  UserCapabilityManifest,
  UserKitOption,
} from './types';

export interface CapabilityRawSources {
  authenticated: boolean;
  physiology?: {
    weight_kg?: number | null;
    height_cm?: number | null;
    vo2max_ml_kg_min?: number | null;
    vma_kmh?: number | null;
    mobility_profile?: string | null;
    declared_level?: string | null;
  } | null;
  orientation?: {
    priority?: string | null;
    experience?: string | null;
  } | null;
  traveller?: {
    home_altitude_m?: number | null;
  } | null;
  perfProfile?: {
    flat_speed_kmh?: number | null;
    ascent_speed_m_per_h?: number | null;
    descent_speed_m_per_h?: number | null;
    sample_count?: number | null;
    calibration_level?: string | null;
  } | null;
  sportCapabilities?: Array<{
    sport: string;
    practiced?: boolean | null;
    experience_level?: string | null;
    sac_max_grade?: number | null;
    mtb_max_grade?: number | null;
    whitewater_max_grade?: number | null;
    via_ferrata_ok?: boolean | null;
    winter_avalanche_trained?: boolean | null;
    max_comfortable_dplus_m?: number | null;
    max_comfortable_km?: number | null;
  }>;
  locomotionAssets?: Array<{
    asset_kind: string;
    is_active?: boolean | null;
    range_km?: number | null;
    battery_wh?: number | null;
  }>;
  gearItems?: Array<{
    name?: string | null;
    category?: string | null;
    function_id?: string | null;
    weight_g?: number | null;
    condition?: string | null;
  }>;
  kits?: Array<{
    id: string;
    name: string;
    total_weight_g?: number | null;
    season?: string | null;
    is_favorite?: boolean | null;
  }>;
  zoneConfigs?: Array<{
    threshold_kind?: string | null;
    threshold_value?: number | null;
  }>;
  recentSessions?: SessionRecord[];
  latestWellness?: BiometricWellnessSnapshot | null;
  selectedKitId?: string | null;
  packWeightOverrideKg?: number | null;
  nowMs?: number;
}

const DEFAULT_GEAR_FAIL_SAFE: GearInventory = {
  hasHeadlamp: false,
  hasAvalancheKit: false,
  hasWaterFilterOrCapacityL: 1.0,
  hasThermalLayer: false,
  hasRainShell: false,
  hasCramponsIceAxe: false,
  hasFirstAidKit: false,
  hasOfflineMap: false,
  hasHelmet: false,
  hasBivouacKit: false,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mapPriority(raw: string | null | undefined): RoutingPriority {
  if (raw === 'securite') return 'securite';
  if (raw === 'confort') return 'doux';
  if (raw === 'legerete') return 'rapide';
  return 'equilibre';
}

function mapMobility(raw: string | null | undefined): MobilityProfileKind {
  if (raw === 'pmr' || raw === 'famille' || raw === 'senior') return raw;
  return 'standard';
}

function deriveGearFlags(
  items: NonNullable<CapabilityRawSources['gearItems']>,
): {
  gear: GearInventory;
  hasPfd: boolean;
  hasWatercraftAndPfd: boolean;
  hasViaFerrataKit: boolean;
  hasSnowshoes: boolean;
  hasTouringSkis: boolean;
  inferredRoadBike: boolean;
  inferredGravelBike: boolean;
  inferredMtb: boolean;
  inferredEbike: boolean;
} {
  const usable = items.filter((it) => it.condition !== 'pour_pieces');
  const fns = new Set(usable.map((it) => (it.function_id ?? '').toLowerCase()).filter(Boolean));
  const textBlob = usable
    .map((it) => `${it.name ?? ''} ${it.category ?? ''}`.toLowerCase())
    .join(' | ');

  const hasHeadlamp = fns.has('light') || /\b(frontale|headlamp|lampe)\b/i.test(textBlob);
  const hasAvalancheKit =
    fns.has('avalanche_dva') ||
    (/\b(dva|arva|transceiver)\b/i.test(textBlob) && /\b(pelle|sonde)\b/i.test(textBlob));
  const hasCramponsIceAxe =
    fns.has('crampons_axe') || /\b(crampon|piolet|ice\s*axe)\b/i.test(textBlob);
  const hasThermalLayer =
    fns.has('insulation') || /\b(doudoune|polaire|merinos|thermique|fleece|down)\b/i.test(textBlob);
  const hasRainShell =
    fns.has('rainshell') || /\b(gore-?tex|hardshell|impermeable|coupe-vent|rain)\b/i.test(textBlob);
  const hasFirstAidKit =
    fns.has('firstaid') || fns.has('emergency') || /\b(secours|first\s*aid|trousse|couverture\s*survie)\b/i.test(textBlob);
  const hasOfflineMap = fns.has('nav') || fns.has('map') || /\b(boussole|carte\s*ign|gps)\b/i.test(textBlob);
  const hasHelmet =
    fns.has('helmet_alpine') || fns.has('helmet_bike') || /\b(casque|helmet)\b/i.test(textBlob);
  const hasBivouacKit =
    (fns.has('shelter') || /\b(tente|tarp|bivouac)\b/i.test(textBlob)) &&
    (fns.has('sleep') || /\b(duvet|sac\s*de\s*couchage)\b/i.test(textBlob));
  const hasWaterTreat = fns.has('watertreat') || /\b(filtre|katadyn|sawyer|lifestraw|micropur)\b/i.test(textBlob);
  const hasWaterBottle = fns.has('water') || /\b(gourde|flasque|camelbak|poche\s*a\s*eau)\b/i.test(textBlob);

  const hasWatercraft = fns.has('watercraft') || /\b(kayak|packraft|cano[eë]|paddle|\bsup\b)\b/i.test(textBlob);
  const hasPfd = fns.has('pfd_vest') || /\b(vfi|gilet\s*(de\s*)?(sauvetage|flottabilit|kayak)|pfd)\b/i.test(textBlob);
  const hasViaFerrataKit =
    fns.has('via_ferrata_kit') || /\b(via\s*ferrata|longe\s*absorbeur)\b/i.test(textBlob);
  const hasSnowshoes = fns.has('snowshoes') || /\b(raquettes?\s*(a\s*neige)?)\b/i.test(textBlob);
  const hasTouringSkis =
    fns.has('skis_touring') || /\b(ski\s*de\s*rando|peaux\s*de\s*phoque|splitboard)\b/i.test(textBlob);

  const inferredEbike = /\b(vae|vttae|e-?bike|electrique)\b/i.test(textBlob);
  const inferredMtb = /\b(vtt|mountain\s*bike|enduro|trail\s*bike)\b/i.test(textBlob);
  const inferredGravelBike = /\b(gravel)\b/i.test(textBlob);
  const inferredRoadBike = /\b(velo\s*de\s*route|road\s*bike|course\s*velo)\b/i.test(textBlob);

  return {
    gear: {
      hasHeadlamp,
      hasAvalancheKit,
      hasWaterFilterOrCapacityL: hasWaterTreat ? 3.0 : hasWaterBottle ? 1.5 : 1.0,
      hasThermalLayer,
      hasRainShell,
      hasCramponsIceAxe,
      hasFirstAidKit,
      hasOfflineMap,
      hasHelmet,
      hasBivouacKit,
    },
    hasPfd,
    hasWatercraftAndPfd: hasWatercraft && hasPfd,
    hasViaFerrataKit: hasViaFerrataKit && hasHelmet,
    hasSnowshoes,
    hasTouringSkis,
    inferredRoadBike,
    inferredGravelBike,
    inferredMtb,
    inferredEbike,
  };
}

/**
 * Pure deterministic builder converting DB rows (or empty guest state) into a strict
 * `UserCapabilityManifest`.
 */
export function buildUserCapabilityManifest(raw: CapabilityRawSources): UserCapabilityManifest {
  const nowMs = raw.nowMs ?? Date.now();
  const dataSources: string[] = [];

  const bodyWeightKg =
    typeof raw.physiology?.weight_kg === 'number' && Number.isFinite(raw.physiology.weight_kg)
      ? clamp(raw.physiology.weight_kg, 35, 180)
      : 72;
  const heightCm =
    typeof raw.physiology?.height_cm === 'number' && Number.isFinite(raw.physiology.height_cm)
      ? clamp(raw.physiology.height_cm, 120, 225)
      : 174;
  const mobilityProfile = mapMobility(raw.physiology?.mobility_profile);
  const priority = mapPriority(raw.orientation?.priority);
  const homeAltitudeM =
    typeof raw.traveller?.home_altitude_m === 'number' && Number.isFinite(raw.traveller.home_altitude_m)
      ? clamp(Math.round(raw.traveller.home_altitude_m), 0, 4500)
      : 200;

  if (raw.physiology?.weight_kg) dataSources.push('Profil physiologique');

  // Performance profile calibration
  const flatSpeedKmh =
    typeof raw.perfProfile?.flat_speed_kmh === 'number' && Number.isFinite(raw.perfProfile.flat_speed_kmh)
      ? clamp(raw.perfProfile.flat_speed_kmh, 2.2, 7.5)
      : mobilityProfile === 'pmr'
        ? 3.0
        : mobilityProfile === 'famille' || mobilityProfile === 'senior'
          ? 3.5
          : 4.3;
  const ascentSpeedMPerH =
    typeof raw.perfProfile?.ascent_speed_m_per_h === 'number' &&
    Number.isFinite(raw.perfProfile.ascent_speed_m_per_h)
      ? clamp(raw.perfProfile.ascent_speed_m_per_h, 150, 1200)
      : mobilityProfile === 'pmr'
        ? 180
        : mobilityProfile === 'famille' || mobilityProfile === 'senior'
          ? 260
          : 360;
  const descentSpeedMPerH =
    typeof raw.perfProfile?.descent_speed_m_per_h === 'number' &&
    Number.isFinite(raw.perfProfile.descent_speed_m_per_h)
      ? clamp(raw.perfProfile.descent_speed_m_per_h, 200, 1400)
      : 520;

  // Map calibrated flat speed to Campbell (2022) Lorentzian speed percentile (2.5..97.5)
  const speedPercentile = clamp(Math.round(((flatSpeedKmh - 2.6) / (6.2 - 2.6)) * 85 + 10), 10, 95);

  const vo2maxMlKgMin =
    typeof raw.physiology?.vo2max_ml_kg_min === 'number' && Number.isFinite(raw.physiology.vo2max_ml_kg_min)
      ? clamp(raw.physiology.vo2max_ml_kg_min, 24, 88)
      : typeof raw.physiology?.vma_kmh === 'number' && Number.isFinite(raw.physiology.vma_kmh)
        ? clamp(raw.physiology.vma_kmh * 3.5, 24, 88)
        : 45;

  const ftpRow = (raw.zoneConfigs ?? []).find((z) => z.threshold_kind === 'ftp');
  const ftpW =
    typeof ftpRow?.threshold_value === 'number' && Number.isFinite(ftpRow.threshold_value)
      ? Math.round(ftpRow.threshold_value)
      : null;

  if (raw.perfProfile?.sample_count && raw.perfProfile.sample_count > 0) {
    dataSources.push(`Calibré sur ${raw.perfProfile.sample_count} sortie(s)`);
  }

  // Real readiness from 28d sessions + wellness snapshot
  const recentSessions = raw.recentSessions ?? [];
  const readiness = computeExplorerReadiness({
    sessions: recentSessions,
    wellness: raw.latestWellness ?? null,
    homeAltitudeM,
    nowMs,
  });
  if (readiness.score !== null) {
    dataSources.push(`État de forme ${readiness.score}/100`);
  }

  // Kits & pack weight
  const availableKits: UserKitOption[] = (raw.kits ?? [])
    .filter((k) => Boolean(k.id && k.name))
    .map((k) => ({
      id: k.id,
      name: k.name,
      weightKg:
        typeof k.total_weight_g === 'number' && Number.isFinite(k.total_weight_g)
          ? Number((k.total_weight_g / 1000).toFixed(1))
          : 4.5,
      season: k.season ?? null,
    }));

  const chosenKit =
    (raw.selectedKitId ? availableKits.find((k) => k.id === raw.selectedKitId) : null) ??
    availableKits.find((k) => raw.kits?.find((rk) => rk.id === k.id)?.is_favorite) ??
    availableKits[0] ??
    null;

  const packWeightKg =
    typeof raw.packWeightOverrideKg === 'number' && Number.isFinite(raw.packWeightOverrideKg)
      ? clamp(raw.packWeightOverrideKg, 0, 35)
      : chosenKit
        ? clamp(chosenKit.weightKg, 0, 35)
        : 4.0;

  if (chosenKit) {
    dataSources.push(`Kit ${chosenKit.name} (${packWeightKg.toFixed(1)} kg)`);
  }

  // Gear inventory & locomotion assets
  const gearDerived =
    (raw.gearItems?.length ?? 0) > 0
      ? deriveGearFlags(raw.gearItems!)
      : {
          gear: { ...DEFAULT_GEAR_FAIL_SAFE },
          hasPfd: false,
          hasWatercraftAndPfd: false,
          hasViaFerrataKit: false,
          hasSnowshoes: false,
          hasTouringSkis: false,
          inferredRoadBike: false,
          inferredGravelBike: false,
          inferredMtb: false,
          inferredEbike: false,
        };
  if ((raw.gearItems?.length ?? 0) > 0) {
    dataSources.push(`${raw.gearItems!.length} équipements analysés`);
  }

  const activeAssets = new Set<LocomotionAssetKind>(
    (raw.locomotionAssets ?? [])
      .filter((a) => a.is_active !== false)
      .map((a) => a.asset_kind as LocomotionAssetKind),
  );
  const ebikeAsset = (raw.locomotionAssets ?? []).find(
    (a) => a.asset_kind === 'ebike' && a.is_active !== false,
  );
  const ebikeRangeKm =
    typeof ebikeAsset?.range_km === 'number' && Number.isFinite(ebikeAsset.range_km)
      ? ebikeAsset.range_km
      : typeof ebikeAsset?.battery_wh === 'number' && Number.isFinite(ebikeAsset.battery_wh)
        ? Math.round(ebikeAsset.battery_wh * 0.14)
        : activeAssets.has('ebike') || gearDerived.inferredEbike
          ? 65
          : null;

  const hasRoadBike = activeAssets.has('road_bike') || gearDerived.inferredRoadBike;
  const hasGravelBike = activeAssets.has('gravel_bike') || gearDerived.inferredGravelBike;
  const hasMtb = activeAssets.has('mtb') || gearDerived.inferredMtb;
  const hasEbike = activeAssets.has('ebike') || gearDerived.inferredEbike;
  const hasCar = activeAssets.has('car') || activeAssets.has('van_4x4');
  const hasPublicTransitAccess = !raw.locomotionAssets?.some(
    (a) => a.asset_kind === 'public_transit' && a.is_active === false,
  );
  const hasWatercraftAsset =
    activeAssets.has('kayak') || activeAssets.has('packraft') || activeAssets.has('sup');
  const hasWatercraftAndPfd =
    gearDerived.hasWatercraftAndPfd || (hasWatercraftAsset && gearDerived.hasPfd);
  const hasSnowshoes = activeAssets.has('snowshoes') || gearDerived.hasSnowshoes;
  const hasTouringSkis = activeAssets.has('ski_touring') || gearDerived.hasTouringSkis;

  // Sport capabilities (strict Fail-Safe defaults)
  const capsBySport = new Map(
    (raw.sportCapabilities ?? [])
      .filter((c) => c.practiced !== false)
      .map((c) => [c.sport.toLowerCase(), c]),
  );

  const randoCap = capsBySport.get('rando');
  const trailCap = capsBySport.get('trail');
  const vttCap = capsBySport.get('vtt');
  const skiCap = capsBySport.get('ski');
  const kayakCap = capsBySport.get('kayak') ?? capsBySport.get('packraft') ?? capsBySport.get('sup');

  const expBoost =
    raw.orientation?.experience === 'aguerri'
      ? 3
      : raw.orientation?.experience === 'regulier'
        ? 2
        : 2;
  const sacMaxGrade = clamp(
    mobilityProfile === 'pmr'
      ? 1
      : typeof randoCap?.sac_max_grade === 'number'
        ? randoCap.sac_max_grade
        : expBoost,
    1,
    6,
  ) as 1 | 2 | 3 | 4 | 5 | 6;

  const mtbMaxGrade = clamp(
    typeof vttCap?.mtb_max_grade === 'number' ? vttCap.mtb_max_grade : hasMtb ? 2 : 0,
    0,
    5,
  ) as 0 | 1 | 2 | 3 | 4 | 5;

  // STRICT Fail-Safe: nautical whitewater grade > 0 ONLY if nautical sport practiced AND craft+PFD proven
  const nauticalProven = Boolean(kayakCap && hasWatercraftAndPfd);
  const whitewaterMaxGrade = (
    nauticalProven
      ? clamp(typeof kayakCap?.whitewater_max_grade === 'number' ? kayakCap.whitewater_max_grade : 1, 1, 6)
      : 0
  ) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const viaFerrataOk = Boolean(
    (randoCap?.via_ferrata_ok || capsBySport.get('escalade')?.via_ferrata_ok) &&
      gearDerived.hasViaFerrataKit,
  );
  const winterAvalancheTrained = Boolean(
    (skiCap?.winter_avalanche_trained || randoCap?.winter_avalanche_trained) &&
      gearDerived.gear.hasAvalancheKit,
  );

  const maxComfortableDplusM =
    typeof randoCap?.max_comfortable_dplus_m === 'number'
      ? randoCap.max_comfortable_dplus_m
      : mobilityProfile === 'pmr'
        ? 200
        : raw.orientation?.experience === 'aguerri'
          ? 1600
          : 950;
  const maxComfortableKm =
    typeof randoCap?.max_comfortable_km === 'number'
      ? randoCap.max_comfortable_km
      : mobilityProfile === 'pmr'
        ? 8
        : raw.orientation?.experience === 'aguerri'
          ? 28
          : 18;

  // Build strictly allowed modes list (Silent Fail-Safe: never expose unproven modes!)
  const allowedModes: RoutingTravelMode[] = ['rando'];
  if (trailCap || recentSessions.some((s) => s.sport === 'trail' || s.sport === 'course')) {
    allowedModes.push('trail');
  }
  if (hasRoadBike) allowedModes.push('velo');
  if (hasGravelBike) allowedModes.push('gravel');
  if (hasMtb) allowedModes.push('vtt');
  if (hasEbike) allowedModes.push('vae');
  if (hasTouringSkis && skiCap) allowedModes.push('ski');
  if (hasSnowshoes) allowedModes.push('raquettes');
  if (nauticalProven) allowedModes.push('kayak');

  const allowedApproachModes: Array<'car' | 'public_transit' | 'bike'> = [];
  if (hasPublicTransitAccess) allowedApproachModes.push('public_transit');
  if (hasCar) allowedApproachModes.push('car');
  if (hasRoadBike || hasGravelBike || hasMtb || hasEbike) allowedApproachModes.push('bike');
  if (allowedApproachModes.length > 0) {
    allowedModes.push('multimodal');
  }

  if (dataSources.length === 0) {
    dataSources.push('Profil prudent par défaut (sentiers ≤ T2)');
  }

  return {
    authenticated: raw.authenticated,
    allowedModes,
    allowedApproachModes,
    mobilityProfile,
    priority,
    bodyWeightKg,
    heightCm,
    packWeightKg,
    activeKitId: chosenKit?.id ?? null,
    activeKitName: chosenKit?.name ?? null,
    availableKits,
    flatSpeedKmh,
    ascentSpeedMPerH,
    descentSpeedMPerH,
    speedPercentile,
    vo2maxMlKgMin,
    ftpW,
    ebikeRangeKm,
    homeAltitudeM,
    readiness,
    sacMaxGrade,
    mtbMaxGrade,
    whitewaterMaxGrade,
    viaFerrataOk,
    winterAvalancheTrained,
    maxComfortableDplusM,
    maxComfortableKm,
    gear: gearDerived.gear,
    hasWatercraftAndPfd,
    hasViaFerrataKit: gearDerived.hasViaFerrataKit,
    hasSnowshoes,
    hasTouringSkis,
    hasRoadBike,
    hasGravelBike,
    hasMtb,
    hasEbike,
    hasCar,
    hasPublicTransitAccess,
    dataSources,
  };
}

/**
 * Convenience Fail-Safe guest manifest (zero network / DB round-trips).
 */
export function createGuestFailSafeManifest(overrides?: {
  packWeightKg?: number | null;
  nowMs?: number;
}): UserCapabilityManifest {
  return buildUserCapabilityManifest({
    authenticated: false,
    packWeightOverrideKg: overrides?.packWeightKg ?? null,
    nowMs: overrides?.nowMs,
  });
}
