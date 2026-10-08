/**
 * La position de la personne n'est jamais transmise exacte à un service tiers
 * (plan 2.10, RGPD) : 0,01° près, soit environ un kilomètre, assez pour
 * chiffrer un trajet, trop peu pour désigner un domicile.
 */
export function coarsePosition(p: { lat: number; lon: number } | null): { lat: number; lon: number } | null {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  return { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 };
}
