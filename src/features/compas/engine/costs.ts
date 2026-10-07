/**
 * Barèmes de coûts du Compas — tenus dans le code, versionnés, sans IA.
 *
 * Même voyage → même budget, au centime près. Chaque montant porte sa base
 * (« barème Compas 2026 · Pérou ≈ 45 % des prix français »). Ce sont des
 * ordres de grandeur pour préparer, jamais un devis : Résa donne les vrais prix.
 *
 * Référence : prix moyens d'un voyageur en France en 2026 (repas mi-marché
 * mi-restaurant, nuit en hôtel simple ou gîte partagé à deux), multipliés par
 * le niveau de prix du pays (rapport de parité de pouvoir d'achat arrondi,
 * ajusté au coût touristique là où il diffère nettement : Tanzanie, Islande…).
 */

export const COSTS_VERSION = '2026-10';

/** Niveau de prix du pays, France = 1. */
const PRICE_LEVEL: Record<string, number> = {
  // Plus cher que la France
  CH: 1.45, NO: 1.35, IS: 1.4, DK: 1.25, LU: 1.2, IE: 1.15, GB: 1.15, US: 1.2, CA: 1.1, AU: 1.15,
  NZ: 1.1, SE: 1.1, FI: 1.1, SG: 1.1, IL: 1.2, AE: 1.05, MC: 1.5, LI: 1.4, FO: 1.3, PF: 1.3, NC: 1.25,
  // Proche de la France
  FR: 1, DE: 1, AT: 1, BE: 1, NL: 1.05, IT: 0.95, JP: 0.9, KR: 0.9, ES: 0.85, PT: 0.8, GR: 0.8,
  MT: 0.85, CY: 0.8, SI: 0.8, EE: 0.8, AD: 0.9, RE: 1, GP: 1, MQ: 1,
  // Moins cher
  HR: 0.75, CZ: 0.7, SK: 0.7, LT: 0.7, LV: 0.7, PL: 0.65, HU: 0.65, UY: 0.75, CR: 0.75, TW: 0.75,
  CL: 0.65, JO: 0.7, BW: 0.7, ME: 0.6, CN: 0.6, RO: 0.55, ZA: 0.55, AR: 0.55, MX: 0.55, BR: 0.55,
  KE: 0.55, TZ: 0.6, RW: 0.6, NA: 0.6, CU: 0.6, DO: 0.6, BG: 0.5, AL: 0.5, BA: 0.5, RS: 0.5,
  MK: 0.5, TR: 0.5, EC: 0.5, MY: 0.5, UG: 0.5, MA: 0.45, GE: 0.45, AM: 0.45, PE: 0.45, CO: 0.45,
  GT: 0.45, TH: 0.45, PH: 0.45, KZ: 0.45, MN: 0.45, TN: 0.4, ID: 0.4, LK: 0.4, UZ: 0.4, ET: 0.4,
  VN: 0.35, KH: 0.35, LA: 0.35, BO: 0.35, EG: 0.35, MG: 0.35, KG: 0.35, IR: 0.35, TJ: 0.35,
  NP: 0.3, IN: 0.3, BD: 0.3, PK: 0.3, MM: 0.35,
  // Îles, territoires et pays du Golfe (coût touristique)
  BM: 1.6, KY: 1.4, BL: 1.5, AI: 1.3, VG: 1.3, TC: 1.3, GL: 1.3, SJ: 1.4, BS: 1.25, BB: 1.2,
  VI: 1.2, WF: 1.2, FK: 1.2, JE: 1.15, GG: 1.15, GU: 1.15, IM: 1.1, AX: 1.1, PM: 1.1, MF: 1.1,
  SX: 1.1, SH: 1.1, GF: 1.05, GI: 1.05, AW: 1.05, AG: 1.05, YT: 1, PR: 1, MP: 1, AS: 1, KN: 1,
  LC: 1, MS: 1, HK: 1, SC: 1, MV: 1, PW: 1, CK: 1, NR: 1, NU: 1, SM: 0.95, VA: 0.95, MO: 0.95,
  QA: 0.95, CW: 0.95, GD: 0.95, VC: 0.9, BT: 0.9, FM: 0.9, MH: 0.9, TV: 0.9, VU: 0.9, DM: 0.85,
  KW: 0.85, SB: 0.85, BH: 0.8, PG: 0.8, KI: 0.8, SA: 0.75, OM: 0.75, JM: 0.75, TO: 0.75, WS: 0.75,
  // Amériques, Afrique, Europe de l'Est, Asie
  TT: 0.7, BZ: 0.7, FJ: 0.7, GQ: 0.7, PA: 0.6, CV: 0.6, MU: 0.6, GA: 0.65, CG: 0.6, DJ: 0.6,
  ZW: 0.6, HT: 0.6, GY: 0.6, LB: 0.6, PS: 0.6, SS: 0.6, BN: 0.6, CD: 0.55, AO: 0.55, TD: 0.55,
  CF: 0.55, ST: 0.55, KM: 0.55, TL: 0.55, CI: 0.5, SN: 0.5, ZM: 0.5, MZ: 0.5, SZ: 0.5, LR: 0.5,
  ER: 0.5, SO: 0.5, SR: 0.5, VE: 0.5, HN: 0.5, SV: 0.5, TM: 0.5, IQ: 0.5, CM: 0.45, GH: 0.45,
  LS: 0.45, BJ: 0.45, TG: 0.45, BF: 0.45, ML: 0.45, NE: 0.45, GN: 0.45, GW: 0.45, GM: 0.45,
  SL: 0.45, EH: 0.45, PY: 0.45, NI: 0.45, RU: 0.45, XK: 0.45, NG: 0.4, MW: 0.4, BI: 0.4, SD: 0.4,
  MR: 0.4, LY: 0.4, MD: 0.4, BY: 0.4, AZ: 0.4, DZ: 0.35, UA: 0.35, YE: 0.35, AF: 0.3, SY: 0.3,
};
/** Pays inconnu du barème : niveau moyen, annoncé comme tel. */
const DEFAULT_LEVEL = 0.7;

/** Prix de référence en France (€, par personne). */
const FR = {
  mealsPerDay: { bivouac: 16, refuge: 22, hebergement: 32, jour: 14 },
  lodgingPerNight: 45,
  refugeHalfBoard: 58,
  localTripPerLeg: 25,
  carRentalPerDay: 45,
} as const;

/** Formalités d'entrée connues pour un voyageur français (€ par personne, hors permis locaux). */
const ENTRY_FEES: Record<string, { eur: number; detail: string }> = {
  NP: { eur: 45, detail: 'visa népalais (30 jours) + permis de trek TIMS' },
  VN: { eur: 25, detail: 'e-visa vietnamien' },
  KH: { eur: 30, detail: 'visa cambodgien' },
  LA: { eur: 40, detail: 'visa laotien à l’arrivée' },
  IN: { eur: 25, detail: 'e-visa indien' },
  LK: { eur: 50, detail: 'ETA srilankaise' },
  TZ: { eur: 50, detail: 'visa tanzanien' },
  KE: { eur: 30, detail: 'eTA kényane' },
  EG: { eur: 25, detail: 'visa égyptien' },
  ET: { eur: 50, detail: 'e-visa éthiopien' },
  MG: { eur: 35, detail: 'visa malgache' },
  JO: { eur: 55, detail: 'visa jordanien (inclus dans le Jordan Pass)' },
  US: { eur: 20, detail: 'ESTA' },
  CA: { eur: 5, detail: 'AVE canadienne' },
  AU: { eur: 15, detail: 'eVisitor (gratuit) + frais de service' },
  NZ: { eur: 60, detail: 'NZeTA + taxe touristique IVL' },
  GB: { eur: 20, detail: 'ETA britannique' },
  MM: { eur: 50, detail: 'e-visa birman' },
  BO: { eur: 0, detail: '' },
  CU: { eur: 25, detail: 'carte de tourisme cubaine' },
  RW: { eur: 50, detail: 'visa rwandais' },
  UG: { eur: 50, detail: 'e-visa ougandais' },
  BD: { eur: 50, detail: 'visa bangladais' },
  PK: { eur: 35, detail: 'e-visa pakistanais' },
  IR: { eur: 75, detail: 'visa iranien' },
};

export interface PriceLevel {
  level: number;
  known: boolean;
  /** « Pérou ≈ 45 % des prix français ». */
  basis: string;
}

export function priceLevel(countryCode: string | null | undefined, countryName?: string | null): PriceLevel {
  const cc = (countryCode ?? '').toUpperCase();
  const known = cc in PRICE_LEVEL;
  const level = known ? PRICE_LEVEL[cc] : DEFAULT_LEVEL;
  const where = countryName || cc || 'pays inconnu';
  const pct = Math.round(level * 100);
  return {
    level,
    known,
    basis: known
      ? cc === 'FR'
        ? `barème Compas ${COSTS_VERSION} · prix français`
        : `barème Compas ${COSTS_VERSION} · ${where} ≈ ${pct} % des prix français`
      : `barème Compas ${COSTS_VERSION} · niveau de prix moyen (${where} absent du barème)`,
  };
}

const round = (n: number) => Math.round(n);

export type MealNight = 'bivouac' | 'refuge' | 'hebergement';

/** Repas par personne et par jour, selon la nuit qui suit (bivouac = lyophilisés, hébergement = restaurant). */
export function mealsPerDay(night: MealNight | null, level: number): number {
  return round(FR.mealsPerDay[night ?? 'jour'] * level);
}

export function mealsTotal(input: { days: number; party: number; nights: Array<MealNight | null>; level: number }): number {
  let perPerson = 0;
  for (let d = 1; d <= Math.max(1, input.days); d += 1) perPerson += mealsPerDay(input.nights[d - 1] ?? null, input.level);
  return perPerson * Math.max(1, input.party);
}

/** Nuit en hébergement par personne (chambre partagée à deux, hôtel simple ou gîte). */
export function lodgingPerNight(level: number): number {
  return Math.max(8, round(FR.lodgingPerNight * level));
}

/** Refuge gardé en demi-pension quand son prix n'est pas connu. */
export function refugePerNight(level: number): number {
  return Math.max(10, round(FR.refugeHalfBoard * level));
}

/** Trajet en bus, train ou bateau entre deux étapes, par personne. */
export function localTripPerLeg(move: string, level: number): number {
  const base = move === 'vol' ? 90 : move === 'bateau' ? 35 : move === 'train' ? 30 : FR.localTripPerLeg;
  return Math.max(4, round(base * (move === 'vol' ? Math.max(0.6, level) : level)));
}

/** Location de voiture par jour (catégorie économique, assurance de base). */
export function carRentalPerDay(level: number): number {
  return Math.max(20, round(FR.carRentalPerDay * Math.max(0.55, level)));
}

/**
 * Vol aller-retour par personne, par tranche de distance à vol d'oiseau
 * (classe économique, réservé 1 à 3 mois avant). Résa · Vols donne le vrai prix.
 */
export function flightRoundTrip(km: number): { eur: number; basis: string } {
  const bands: Array<[number, number, string]> = [
    [1200, 180, 'moins de 1 200 km'],
    [2500, 280, '1 200 à 2 500 km'],
    [5000, 520, '2 500 à 5 000 km'],
    [8000, 780, '5 000 à 8 000 km'],
    [11000, 950, '8 000 à 11 000 km'],
    [Infinity, 1150, 'plus de 11 000 km'],
  ];
  const band = bands.find(([max]) => km < max)!;
  return { eur: band[1], basis: `barème Compas ${COSTS_VERSION} · vol aller-retour, ${band[2]}` };
}

/** Formalités d'entrée connues (visa, autorisation, permis principal), sinon null. */
export function entryFees(countryCode: string | null | undefined): { eur: number; detail: string } | null {
  const hit = ENTRY_FEES[(countryCode ?? '').toUpperCase()];
  return hit && hit.eur > 0 ? hit : null;
}

/** Assurance voyage et rapatriement par personne (forfait par jour, plancher). */
export function insurance(days: number, opts: { abroad: boolean; altitudeM: number | null }): number {
  const perDay = (opts.altitudeM ?? 0) >= 4000 ? 4.5 : opts.abroad ? 3 : 2;
  return Math.max(30, round(perDay * Math.max(1, days)));
}
