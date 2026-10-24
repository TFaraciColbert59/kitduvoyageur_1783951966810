/**
 * Formatage unique des métriques LKDV.
 *
 * Les écrans compacts (profil, cartes, drawers) affichent les milliers avec
 * un « k » pour éviter les nombres à 5 chiffres. Les fiches détaillées peuvent
 * utiliser `formatNumber` / `formatElevationExact`.
 */

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const NUMBER_EXACT = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** 1 234 → « 1 234 » ; 12,25 → « 12,3 ». */
export function formatNumber(value: number): string {
  return NUMBER.format(finite(value));
}

/** 1 234 → « 1 234 » sans décimale. */
export function formatInteger(value: number): string {
  return NUMBER_EXACT.format(Math.round(finite(value)));
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return formatInteger(value);
  const thousands = value / 1000;
  return `${NUMBER.format(Math.round(thousands * 10) / 10)} k`;
}

/** 339 → « 339 km » ; 12,25 → « 12,3 km ». */
export function formatKm(value: number): string {
  return `${formatNumber(value)} km`;
}

/** Version compacte d'un dénivelé : 950 → « 950 m » ; 12 870 → « 12,9 k m ». */
export function formatElevation(value: number): string {
  return `${compact(value)} m`;
}

/** Version sans unité, pour les tuiles : 12 870 → « 12,9 k ». */
export function formatElevationCompact(value: number): string {
  return compact(value);
}

/** Compteur compact : 999 → « 999 » ; 12 870 → « 12,9 k ». */
export function formatCount(value: number): string {
  return compact(value);
}

/** Valeur exacte, pour les fiches détaillées : 12 870 → « 12 870 m ». */
export function formatElevationExact(value: number): string {
  return `${formatInteger(value)} m`;
}
