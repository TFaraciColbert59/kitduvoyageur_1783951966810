/**
 * EMPREINTE — la trace publique, 100 % dérivée du terrain (ADR-010, Lot C).
 * =======================================================================
 * Ne JAMÁIS choisie, ne CADRE jamais : tout est agrégat de hike_sessions.
 * Garde-fous codés ici (et testés) : plancher, aucune coordonnée, aucun
 * agrégat inter-utilisateurs, vocabulaire descriptif (jamais de rôle).
 */

/** Shape publique renvoyée par la base (matview user_field_signature). */
export interface FieldSignatureRow {
  total_outings?: number;
  total_km?: number;
  total_dplus_m?: number;
  max_altitude_gain_m?: number;
  distinct_months?: number;
  distinct_regions?: number;
  max_autonomy_days?: number;
  off_trail_share?: number;
}

/** Plancher de crédibilité (mêmes raisons qu'au Lot 4 des Lignées). */
export const FIELD_SIGNATURE_FLOOR = 3;

export const SIGNATURE_VISIBILITIES = ['private', 'communaute', 'public'] as const;
export type SignatureVisibility = (typeof SIGNATURE_VISIBILITIES)[number];

/** L'empreinte n'existe publiquement qu'à partir du plancher de sorties. */
export function hasFieldSignature(sig: FieldSignatureRow | null | undefined): boolean {
  return !!sig && (sig.total_outings ?? 0) >= FIELD_SIGNATURE_FLOOR;
}

/** Shape publique 100 % remplie (aucun champ optionnel côté affichage). */
export interface PublicFieldSignature {
  total_outings: number;
  total_km: number;
  total_dplus_m: number;
  max_altitude_gain_m: number;
  distinct_months: number;
  distinct_regions: number;
  max_autonomy_days: number;
  off_trail_share: number;
}

/** Label neutre sous le plancher — jamais de chiffre, jamais de classement. */
export function youngLabel(hasAny = false): string {
  return hasAny ? 'lignée jeune' : 'pas encore d’empreinte';
}

/**
 * Shape publique FILTRÉE : renvoie null sous le plancher (objet vide côté API).
 * GARDE-FOU : jamais de coordonnées, jamais de percentile/moyenne d'autrui.
 */
export function publicSignature(
  sig: FieldSignatureRow | null | undefined
): PublicFieldSignature | null {
  if (!hasFieldSignature(sig)) return null;
  return {
    total_outings: Math.round(sig!.total_outings ?? 0),
    total_km: Math.round((sig!.total_km ?? 0) * 10) / 10,
    total_dplus_m: Math.round(sig!.total_dplus_m ?? 0),
    max_altitude_gain_m: Math.round(sig!.max_altitude_gain_m ?? 0),
    distinct_months: Math.round(sig!.distinct_months ?? 0),
    distinct_regions: Math.round(sig!.distinct_regions ?? 0),
    max_autonomy_days: Math.max(1, Math.round(sig!.max_autonomy_days ?? 1)),
    off_trail_share: Math.min(1, Math.max(0, sig!.off_trail_share ?? 0)),
  };
}

const NOMBRE = [
  'zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit',
  'dix-neuf', 'vingt',
];
const nombre = (n: number): string => (n <= 20 ? NOMBRE[n] : `${n}`);
const saison = (m: number): string => m === 1 ? 'saison' : 'saisons';
const qte = (n: number, sing: string, plur: string): string => `${nombre(n)} ${n > 1 ? plur : sing}`;

/**
 * Vocabulaire PUREMENT DESCRIPTIF (défaut de l'ADR-010) :
 *   « quinze sorties, trois saisons, Écrins et Ariège »
 * Aucun nom de rôle, aucun ordre, aucun comparatif.
 * @param regions liste de régions distinctes (granularité = région, jamais coordonnées)
 */
export function signatureText(sig: FieldSignatureRow | null | undefined, regions: string[] = []): string {
  const pub = publicSignature(sig);
  if (!pub) return youngLabel(!!sig && (sig.total_outings ?? 0) > 0);

  const parts: string[] = [];
  parts.push(qte(pub.total_outings, 'sortie', 'sorties'));
  if (pub.distinct_months > 0) parts.push(qte(pub.distinct_months, saison(pub.distinct_months), saison(pub.distinct_months)));
  if (regions.length > 0) {
    const list = regions.slice(0, 4);
    if (list.length === 1) parts.push(list[0]);
    else if (list.length === 2) parts.push(`${list[0]} et ${list[1]}`);
    else parts.push(`${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// SCEAU — seed déterministe + géométrie modulée par l'empreinte
// ---------------------------------------------------------------------------

/** Hash FNV-1a 32 bits → seed [0, 2^32) stable pour un même utilisateur. */
export function fieldSealSeed(userId: string): number {
  const s = userId.toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return hash;
}

export interface SealGeometry {
  branches: number;   // ~ saisons (modulé 3..9)
  density: number;    // ~ km (modulé 0.25..1)
  amplitude: number;  // ~ D+ (modulé 1..5)
}

/** Géométrie du sceau, dérivée de l'empreinte (aucune donnée géographique). */
export function sealGeometry(sig: FieldSignatureRow | null | undefined): SealGeometry {
  const pub = publicSignature(sig);
  if (!pub) return { branches: 3, density: 0.35, amplitude: 2 };
  const months = pub.distinct_months;
  const km = pub.total_km;
  const dplus = pub.total_dplus_m;
  return {
    branches: 3 + (months % 7),                       // 3..9
    density: Math.min(1, 0.25 + Math.log10(1 + km) / 12), // croît avec km
    amplitude: 1 + Math.min(4, Math.round(dplus / 400)), // 1..5
  };
}

/** Assure l'« absence d'ordre » : aucune branche ne domine (utilisé par le rendu). */
export function sealIsBalanced(g: SealGeometry): boolean {
  return g.branches >= 3 && g.branches <= 9 && g.amplitude >= 1 && g.amplitude <= 5;
}