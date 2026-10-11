/**
 * Compas — le prix du carburant selon le pays (PLAN-100 1.8 et 4.6).
 *
 * UE-27 : le prix publié par le bulletin pétrolier hebdomadaire de la Commission européenne
 * (Euro-super 95, TTC, euros par litre ; CC BY 4.0), tel que `scripts/compas/build-fuel-prices.mjs`
 * l'a lu dans `data/fuelPrices.json`, daté. Ailleurs, AUCUNE source gratuite : le prix est une
 * ESTIMATION (la moyenne pondérée de l'UE-27 publiée dans le même bulletin) donnée avec la
 * fourchette des pays de l'UE (du moins cher au plus cher), jamais comme un fait. Aucun prix
 * n'est inventé pour un pays hors de la table.
 *
 * Module PUR : la table est un JSON versionné (pas de réseau).
 */

import DATA from '../data/fuelPrices.json';
import { frenchDay } from './entry';

export type FuelKind = 'bulletin' | 'estimation';

export interface FuelPrice {
  /** Euros par litre (essence, TTC). */
  eurPerL: number;
  kind: FuelKind;
  /** D'où vient le prix, pour la base de la ligne de budget. */
  basis: string;
  /** Fourchette de l'UE pour une estimation (€/L), null quand le prix est publié. */
  range: { low: number; high: number } | null;
}

const SUPER = DATA.eurosuper95 as Record<string, number>;
const ALL = Object.values(SUPER);
const RANGE = { low: Math.min(...ALL), high: Math.max(...ALL) };
const EU_AVERAGE = DATA.eu27.eurosuper95;
const BULLETIN_DAY = frenchDay(DATA.date) ?? DATA.date;

/** « 2,21 » : deux décimales, virgule française, arrondi au centime le plus proche. */
export function perLitre(v: number): string {
  return (Math.floor(v * 100 + 0.5 + 1e-9) / 100).toFixed(2).replace('.', ',');
}

const SOURCE = `bulletin pétrolier de l’UE du ${BULLETIN_DAY}`;

const normal = (cc: string | null | undefined) => (cc ?? '').trim().toUpperCase();

/** Prix du carburant d'un pays : publié pour l'UE-27, sinon l'estimation de l'UE avec sa fourchette. */
export function fuelPrice(countryCode: string | null | undefined): FuelPrice {
  const cc = normal(countryCode);
  const published = Object.prototype.hasOwnProperty.call(SUPER, cc) ? SUPER[cc] : null;
  if (published != null)
    return { eurPerL: published, kind: 'bulletin', basis: `Euro-super 95 à ${perLitre(published)} €/L (${SOURCE})`, range: null };
  return {
    eurPerL: EU_AVERAGE,
    kind: 'estimation',
    basis: `carburant estimé hors UE (aucune source gratuite) : moyenne de l’UE-27 à ${perLitre(EU_AVERAGE)} €/L, de ${perLitre(RANGE.low)} à ${perLitre(RANGE.high)} €/L selon les pays de l’UE (${SOURCE}) ; à vérifier sur place`,
    range: { ...RANGE },
  };
}

/**
 * Prix pour un trajet qui touche plusieurs pays (le départ et la destination) : celui du pays
 * quand il n'y en a qu'un, la moyenne des prix publiés quand tous le sont, sinon l'estimation
 * (un pays hors de l'UE parmi eux). Aucun pays connu : l'estimation.
 */
export function fuelPriceFor(countryCodes: Array<string | null | undefined>): FuelPrice {
  const codes = [...new Set(countryCodes.map(normal).filter((c) => /^[A-Z]{2}$/.test(c)))];
  if (codes.length === 0) return fuelPrice(null);
  if (codes.length === 1) return fuelPrice(codes[0]);
  const prices = codes.map((c) => ({ code: c, price: fuelPrice(c) }));
  if (prices.some((p) => p.price.kind === 'estimation')) return fuelPrice(null);
  const mean = prices.reduce((t, p) => t + p.price.eurPerL, 0) / prices.length;
  return {
    eurPerL: Math.round(mean * 1000) / 1000,
    kind: 'bulletin',
    basis: `Euro-super 95, moyenne des pays du trajet : ${prices.map((p) => `${p.code} ${perLitre(p.price.eurPerL)} €/L`).join(', ')} (${SOURCE})`,
    range: null,
  };
}
