/**
 * Compas — niveau de prix de l'alimentation d'un pays (ICP 2021 de la Banque mondiale, PLAN-100 4.6).
 *
 * L'indice de niveau de prix (Monde = 100) de la série « Produits alimentaires et boissons non
 * alcoolisées » mesure ce que coûte le même panier alimentaire d'un pays à l'autre : c'est la bonne
 * mesure des repas en autonomie (bivouac, journée avec pique-nique), qui sont des courses. Le Compas
 * le ramène à la France = 100, comme son barème (`costs.ts`).
 *
 * Pas pour les repas au restaurant ni les hôtels : la série « Restaurants et hôtels » de l'ICP donne
 * les prix payés par les résidents, plus de 20 % sous le barème Compas dans 87 des 170 pays (Tanzanie
 * 0,21 contre 0,6, le barème ajustant au coût touristique) ; le barème reste la base de ces repas-là.
 * Un pays absent de l'ICP (territoires, Cuba, Russie…) n'a pas de niveau ici : l'appelant garde son
 * barème, rien n'est inventé.
 *
 * Module PUR : les niveaux sont un JSON versionné (`scripts/compas/build-icp-price-levels.mjs`).
 */

import DATA from '../data/icpPriceLevels.json';
import META from '../data/icpPriceLevels.meta.json';
import { frenchDay } from './entry';

const FOOD = DATA.food as Record<string, number>;
const FRANCE = FOOD.FR;

export interface FoodLevel {
  /** Niveau de prix de l'alimentation, France = 1, arrondi au centième. */
  level: number;
  /** « alimentation : Pérou 69 (France = 100) · ICP 2021, Banque mondiale, lu le … ». */
  basis: string;
}

/** Le niveau de prix de l'alimentation d'un pays, ou null quand l'ICP 2021 n'en donne pas. */
export function icpFoodLevel(countryCode: string | null | undefined, countryName?: string | null): FoodLevel | null {
  const cc = (countryCode ?? '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(FOOD, cc) || !(FRANCE > 0)) return null;
  const level = Math.round((FOOD[cc] / FRANCE) * 100) / 100;
  if (!(level > 0)) return null;
  const where = countryName || cc;
  const read = frenchDay(META.readOn) ?? META.readOn;
  return {
    level,
    basis: `alimentation : ${where} ${Math.round(level * 100)} (France = 100) · ICP ${META.year}, Banque mondiale, lu le ${read}`,
  };
}
