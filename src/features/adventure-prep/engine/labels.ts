import { A_VERIFIER } from './trust';
import type { GearNeed } from '../types';
import type { PackWeight } from './gear';

/**
 * Libelles de preparation — uniquement de la mise en forme.
 *
 * Regle : toute valeur inconnue s'affiche « À vérifier ». Aucun zero par
 * defaut, aucun total partiel presente comme un total (A9).
 */

export const GEAR_CATEGORY_LABELS: Readonly<Record<GearNeed['category'], string>> = {
  shelter: 'Abri',
  sleep: 'Dormir',
  cook: 'Cuisine',
  clothing: 'Vêtements',
  water: 'Eau',
  safety: 'Sécurité',
  navigation: 'Navigation',
  misc: 'Divers',
};

/** Poids du sac : somme seulement si tous les poids sont connus. */
export function bookWeightLabel(weight: PackWeight): string {
  if (weight.grams === null) {
    return weight.hasGaps ? `Poids du sac : ${A_VERIFIER.toLowerCase()}` : 'Poids du sac : —';
  }
  const kg = weight.grams / 1000;
  const formatted = kg < 10 ? kg.toFixed(2).replace('.', ',') : Math.round(kg).toString();
  return `Poids du sac : ${formatted} kg`;
}

/** Resume de l'equipement en une phrase, sans score artificiel. */
export function gearSummary(
  gear: readonly GearNeed[],
  packedGearIds: readonly string[],
): string {
  if (gear.length === 0) return 'Aucun équipement identifié';
  const packed = gear.filter((item) => packedGearIds.includes(item.id)).length;
  const toVerify = gear.length - packed;
  return toVerify === 0
    ? `${gear.length} élément(s), tout est confirmé`
    : `${packed}/${gear.length} élément(s) confirmés, ${toVerify} à vérifier`;
}

/** Nombre d'elements dont la preparation n'est pas confirmee. */
export function gearToVerifyCount(gear: readonly GearNeed[], packedGearIds: readonly string[]): number {
  return gear.filter((item) => !packedGearIds.includes(item.id)).length;
}

export function minutesLabel(minutes: number | null): string {
  if (minutes === null) return A_VERIFIER;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function daysLabel(days: number | null): string {
  if (days === null) return A_VERIFIER;
  return days === 1 ? '1 jour' : `${days} jours`;
}

export function plural(count: number, singular: string, plural_?: string): string {
  return count <= 1 ? singular : (plural_ ?? `${singular}s`);
}