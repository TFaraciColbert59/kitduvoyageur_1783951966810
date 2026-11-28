import type { ActivityProfileSpec, PrimarySpeedUnit, RolloutWave, SportFamilyId } from './activityProfileSpec.types';
import {
  CSV_AND_LEGACY_SLUG_FALLBACK_MAP,
  SPORT_FAMILIES,
  V1_ACTIVITY_PROFILES,
  type SportFamilyMeta,
} from './v1Profiles.seed';
import { V2_ACTIVITY_PROFILES } from './v2Profiles.seed';
import { V3_ACTIVITY_PROFILES } from './v3Profiles.seed';

const registryBySlug = new Map<string, ActivityProfileSpec>();
const aliasToSlug = new Map<string, string>();

function registerProfiles(profiles: readonly ActivityProfileSpec[]): void {
  for (const spec of profiles) {
    const key = spec.identity.slugId.toLowerCase();
    registryBySlug.set(key, spec);
    aliasToSlug.set(key, key);
    aliasToSlug.set(spec.identity.legacyVariantId.toLowerCase(), key);
    for (const alias of spec.identity.legacySlugAliases) {
      const normalized = alias.toLowerCase();
      if (!aliasToSlug.has(normalized)) {
        aliasToSlug.set(normalized, key);
      }
    }
  }
}

registerProfiles(V1_ACTIVITY_PROFILES);
registerProfiles(V2_ACTIVITY_PROFILES);
registerProfiles(V3_ACTIVITY_PROFILES);

/**
 * Permet aux lots V2/V3 d'enregistrer des profils spécialisés supplémentaires
 * dynamiquement sans refactorer le moteur ni les écrans.
 */
export function registerAdditionalActivityProfiles(profiles: readonly ActivityProfileSpec[]): void {
  registerProfiles(profiles);
}

export function resolveActivityProfile(slugOrAlias: string | null | undefined): ActivityProfileSpec {
  const fallback = registryBySlug.get('hiking')!;
  if (!slugOrAlias) return fallback;
  const key = slugOrAlias.trim().toLowerCase();
  if (!key) return fallback;

  const direct = registryBySlug.get(key);
  if (direct) return direct;

  const viaAlias = aliasToSlug.get(key);
  if (viaAlias) {
    const found = registryBySlug.get(viaAlias);
    if (found) return found;
  }

  const viaCsvFallback = CSV_AND_LEGACY_SLUG_FALLBACK_MAP[key];
  if (viaCsvFallback) {
    const found = registryBySlug.get(viaCsvFallback);
    if (found) return found;
  }

  return registryBySlug.get('manual_generic_import') ?? fallback;
}

export function isKnownActivitySlugOrAlias(slugOrAlias: string): boolean {
  const key = slugOrAlias.trim().toLowerCase();
  return (
    registryBySlug.has(key) ||
    aliasToSlug.has(key) ||
    Object.prototype.hasOwnProperty.call(CSV_AND_LEGACY_SLUG_FALLBACK_MAP, key)
  );
}

export function listActivityProfiles(filter?: {
  wave?: RolloutWave;
  familyId?: SportFamilyId;
}): readonly ActivityProfileSpec[] {
  const all = Array.from(registryBySlug.values());
  return all.filter((spec) => {
    if (filter?.wave && spec.rolloutWave !== filter.wave) return false;
    if (filter?.familyId && spec.identity.familyId !== filter.familyId) return false;
    return true;
  });
}

export function listSportFamilies(): readonly SportFamilyMeta[] {
  return SPORT_FAMILIES;
}

/**
 * Facteur de coût métabolique GAP selon le polynôme de Minetti (2002) plafonné
 * sur [gradeClampMinPct, gradeClampMaxPct] pour éviter l'explosion sur pentes extrêmes.
 * Retourne le multiplicateur d'effort relatif au plat (`1.0` à `0 %`).
 */
export function computeMinettiGapMultiplier(
  gradePct: number,
  clampMinPct = -35,
  clampMaxPct = 35,
): number {
  if (!Number.isFinite(gradePct)) return 1;
  const clamped = Math.max(clampMinPct, Math.min(clampMaxPct, gradePct));
  const i = clamped / 100;
  // Cr(i) = 155.4 i^5 - 30.4 i^4 - 43.3 i^3 + 46.3 i^2 + 19.5 i + 3.6 (J/kg/m)
  const flatCost = 3.6;
  const cost =
    155.4 * Math.pow(i, 5) -
    30.4 * Math.pow(i, 4) -
    43.3 * Math.pow(i, 3) +
    46.3 * Math.pow(i, 2) +
    19.5 * i +
    flatCost;
  return Math.max(0.55, cost / flatCost);
}

/** CO₂ évité en vélotaf (base ADEME voiture thermique moyenne France : 0,192 kg/km). */
export function computeCommuteCo2Grams(distanceM: number): number {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return 0;
  return Math.round((distanceM / 1000) * 192);
}

export interface SpeedFormatInput {
  distanceM: number;
  movingS: number;
  elevGainM?: number;
  powerW?: number | null;
  units?: 'metric' | 'imperial';
}

export interface FormattedPrimaryMetric {
  valueText: string;
  unitLabel: string;
  unitKind: PrimarySpeedUnit;
}

function formatPaceClock(secPerUnit: number): string {
  const safe = Math.max(1, Math.round(secPerUnit));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Formateur strict « anti-km/h générique » piloté par `ActivityProfileSpec.algorithms.primarySpeedUnit`.
 */
export function formatPrimarySpeedMetric(
  spec: ActivityProfileSpec,
  input: SpeedFormatInput,
): FormattedPrimaryMetric {
  const unit = spec.algorithms.primarySpeedUnit;
  const units = input.units ?? 'metric';
  const distM = Math.max(0, Number.isFinite(input.distanceM) ? input.distanceM : 0);
  const movingS = Math.max(0, Number.isFinite(input.movingS) ? input.movingS : 0);
  const elevGainM = Math.max(0, Number.isFinite(input.elevGainM ?? 0) ? (input.elevGainM ?? 0) : 0);

  if (unit === 'min_per_km') {
    const denom = units === 'imperial' ? distM / 1609.344 : distM / 1000;
    const label = units === 'imperial' ? 'min/mi' : 'min/km';
    if (denom < 0.05 || movingS < 5) return { valueText: '0:00', unitLabel: label, unitKind: unit };
    return { valueText: formatPaceClock(movingS / denom), unitLabel: label, unitKind: unit };
  }

  if (unit === 'm_per_h_vam') {
    if (movingS < 30 || elevGainM < 5) return { valueText: '0', unitLabel: 'm/h', unitKind: unit };
    const vam = Math.round(elevGainM / (movingS / 3600));
    return { valueText: String(vam), unitLabel: 'm/h', unitKind: unit };
  }

  if (unit === 'km_per_h') {
    const label = units === 'imperial' ? 'mph' : 'km/h';
    if (movingS < 5 || distM < 10) return { valueText: '0,0', unitLabel: label, unitKind: unit };
    const kmh = (distM / 1000) / (movingS / 3600);
    const val = units === 'imperial' ? kmh * 0.621371 : kmh;
    return { valueText: val.toFixed(1).replace('.', ','), unitLabel: label, unitKind: unit };
  }

  if (unit === 'knots') {
    if (movingS < 5 || distM < 10) return { valueText: '0,0', unitLabel: 'nds', unitKind: unit };
    const knots = (distM / 1852) / (movingS / 3600);
    return { valueText: knots.toFixed(1).replace('.', ','), unitLabel: 'nds', unitKind: unit };
  }

  if (unit === 'min_per_100m') {
    if (distM < 25 || movingS < 5) return { valueText: '0:00', unitLabel: '/100m', unitKind: unit };
    return { valueText: formatPaceClock(movingS / (distM / 100)), unitLabel: '/100m', unitKind: unit };
  }

  if (unit === 'min_per_500m') {
    if (distM < 50 || movingS < 5) return { valueText: '0:00', unitLabel: '/500m', unitKind: unit };
    return { valueText: formatPaceClock(movingS / (distM / 500)), unitLabel: '/500m', unitKind: unit };
  }

  if (unit === 'watts') {
    const w = input.powerW;
    return { valueText: w && w > 0 ? String(Math.round(w)) : '0', unitLabel: 'W', unitKind: unit };
  }

  return { valueText: `${Math.round(movingS / 60)} min`, unitLabel: 'durée', unitKind: unit };
}
