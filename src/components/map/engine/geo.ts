/**
 * CHANTIER ATLAS — Phase 4
 * Résolution ISO A2 d'un feature Natural Earth (GeoJSON 110m).
 * Porté fidèlement de `CountryGlobe.tsx` (même ordre de fallback, mêmes
 * exclusions) pour que la couche monde de l'explorateur joigne exactement les
 * mêmes pays que le référentiel `countries_geo`.
 */

const SKIPPED_CODES = new Set(['-99', '-3', '']);

export function resolveIsoA2(properties: Record<string, unknown> | null | undefined): string | null {
  if (!properties) return null;
  const candidates = [
    properties.ISO_A2,
    properties.ISO_A2_EH,
    properties.WB_A2,
    properties.ADM0_A3,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const value = String(candidate);
    if (SKIPPED_CODES.has(value) || value.length !== 2) continue;
    return value.toUpperCase();
  }
  return null;
}

export function resolveCountryName(properties: Record<string, unknown> | null | undefined): string {
  if (!properties) return '';
  const candidates = [properties.NAME, properties.NAME_EN, properties.ADMIN, properties.name];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
  }
  return '';
}
