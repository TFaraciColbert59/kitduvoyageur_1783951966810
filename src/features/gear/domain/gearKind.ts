import type { GearKind, GearSport } from './types';
import { isGearKind, isGearSport } from './types';

/**
 * Classement d'un objet d'inventaire en vélo, chaussures ou composant.
 *
 * Le schéma `gear_items` ne porte pas encore de type sportif : on le déduit du
 * libellé et de la catégorie, sans jamais écraser une valeur explicite. Un
 * objet ambigu reste `other` au lieu d'être rangé de force.
 */
export function normalizeGearText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const COMPONENT_PATTERNS: RegExp[] = [
  /\bchaine\b/,
  /\bchaines\b/,
  /\bpneu(s)?\b/,
  /\bpneus?\b/,
  /\bplaquette(s)?\b/,
  /\bcassette\b/,
  /\bplateau(x)?\b/,
  /\bderailleur(s)?\b/,
  /\broue(s)?\b/,
  /\brayon(s)?\b/,
  /\bpedalier\b/,
  /\bboitier\b/,
  /\bfourche\b/,
  /\bamortisseur\b/,
  /\bcintre\b/,
  /\bpotence\b/,
  /\bselle\b/,
  /\btige de selle\b/,
  /\bfrein(s)?\b/,
  /\bdisque(s)?\b/,
  /\bcable(s)?\b/,
  /\bgaine(s)?\b/,
  /\bmaillon(s)?\b/,
];

const SHOE_PATTERNS: RegExp[] = [
  /\bchaussure(s)?\b/,
  /\bbasket(s)?\b/,
  /\brunning\b/,
  /\bsneaker(s)?\b/,
  /\bbotte(s)?\b/,
  /\bsandale(s)?\b/,
  /\btrail shoe(s)?\b/,
];

const BIKE_PATTERNS: RegExp[] = [
  /\bvelo\b/,
  /\bbike\b/,
  /\bbicyclette\b/,
  /\bvtt\b/,
  /\bgravel\b/,
  /\bvtc\b/,
];

/** Type sportif d'un objet, déduit sans valeur inventée. */
export function inferGearKind(
  name: string | null | undefined,
  category?: string | null,
  explicit?: string | null
): GearKind {
  const declared = normalizeGearText(explicit);
  if (isGearKind(declared)) return declared;

  const label = `${normalizeGearText(category)} ${normalizeGearText(name)}`;
  if (!label.trim()) return 'other';

  // Un composant peut contenir « vélo » ou « chaussures » dans son libellé :
  // on le teste en premier pour ne pas transformer un pneu en bicyclette.
  if (COMPONENT_PATTERNS.some((pattern) => pattern.test(label))) return 'component';
  if (SHOE_PATTERNS.some((pattern) => pattern.test(label))) return 'shoe';
  if (BIKE_PATTERNS.some((pattern) => pattern.test(label))) return 'bike';
  return 'other';
}

/** Sport normalisé, `null` quand la valeur n'appartient pas à la taxonomie. */
export function normalizeSport(value: string | null | undefined): GearSport | null {
  const sport = normalizeGearText(value);
  return isGearSport(sport) ? sport : null;
}

/** Types d'objets qui portent un kilométrage pour ce sport. */
export function gearKindsForSport(sport: string | null | undefined): GearKind[] {
  const normalized = normalizeSport(sport);
  switch (normalized) {
    case 'velo':
      return ['bike'];
    case 'rando':
    case 'trail':
    case 'course':
    case 'famille':
    case 'bivouac':
      return ['shoe'];
    default:
      return [];
  }
}

/** Libellé court pour l'interface. */
export function gearKindLabel(kind: GearKind): string {
  switch (kind) {
    case 'bike':
      return 'Vélo';
    case 'shoe':
      return 'Chaussures';
    case 'component':
      return 'Composant';
    default:
      return 'Autre';
  }
}
