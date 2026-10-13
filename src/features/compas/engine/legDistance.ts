/**
 * Distance et dénivelé d'un tronçon entre deux soirs (plan 1.5).
 *
 * Quand un routeur a répondu, la distance est sa mesure et elle porte son nom
 * (Geoapify, Valhalla). Quand aucun n'a pu la mesurer (panne, crédits du jour
 * épuisés, lieu hors réseau), le tronçon garde une distance, mais ANNONCÉE :
 * vol d'oiseau × coefficient du terrain, marquée « estimation ». Jamais une
 * estimation ne se fait passer pour une mesure.
 *
 * Le dénivelé positif d'un tronçon à pied ou à vélo se lit sur le relief
 * (Terrain Tiles, AWS Open Data) le long du tracé mesuré : aucun routeur
 * autorisé ne le donne.
 */

export type LegMove = 'marche' | 'velo' | 'voiture';

/**
 * Détour du réseau par rapport au vol d'oiseau : une convention annoncée, pas
 * une mesure. 1,3 sur route (déjà la règle du trajet d'approche) ; 1,4 à pied,
 * où les sentiers contournent le relief.
 */
export const LEG_DETOUR: Readonly<Record<LegMove, number>> = {
  marche: 1.4,
  velo: 1.3,
  voiture: 1.3,
};

/** Où la distance d'une étape a été prise : ce que l'écran dit à côté du chiffre. */
export type LegDistanceSource = 'geoapify' | 'valhalla' | 'osrm' | 'brouter' | 'estimation' | 'vol_oiseau' | 'riviere';

/** La distance estimée d'un tronçon (km, au dixième), ou null si le vol d'oiseau n'est pas exploitable. */
export function estimatedLegKm(straightKm: number, move: LegMove): number | null {
  if (!Number.isFinite(straightKm) || straightKm <= 0) return null;
  return Math.round(straightKm * LEG_DETOUR[move] * 10) / 10;
}

/** La phrase d'annonce d'une distance estimée, jointe à l'étape. */
export function estimationNote(km: number, move: LegMove): string {
  const k = String(km).replace('.', ',');
  const coef = String(LEG_DETOUR[move]).replace('.', ',');
  return `Distance estimée : environ ${k} km (vol d’oiseau × ${coef}, itinéraire non calculé), à vérifier.`;
}

/**
 * Le dénivelé positif cumulé (m) d'une suite d'altitudes le long d'un tracé,
 * avec une hystérésis : une montée ne compte qu'une fois franchi `thresholdM`
 * au-dessus du point bas courant (toute descente l'abaisse), ce qui écarte le
 * bruit du relief (quelques mètres d'un pixel à l'autre) sans effacer une
 * vraie bosse. Les trous (null) sont sautés ; moins de deux altitudes : null,
 * jamais 0.
 */
export function ascentFromElevations(values: ReadonlyArray<number | null>, thresholdM = 10): number | null {
  const pts = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (pts.length < 2) return null;
  let gain = 0;
  let base = pts[0];
  for (let i = 1; i < pts.length; i += 1) {
    const v = pts[i];
    if (v - base >= thresholdM) {
      gain += v - base;
      base = v;
    } else if (v < base) {
      base = v;
    }
  }
  return Math.round(gain);
}

/**
 * Le `metadata` d'une étape écrite par le Compas : la source de sa distance,
 * ou un objet vide (la colonne `trip_steps.metadata` est NOT NULL ; un null
 * faisait échouer l'écriture de tout l'itinéraire).
 */
export function stepDistanceMetadata(source: LegDistanceSource | null | undefined): Record<string, unknown> {
  return source ? { distance: { source } } : {};
}
