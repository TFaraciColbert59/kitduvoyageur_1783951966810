/**
 * Compas v5 · « À prévoir » : tout ce qu'il faut réserver pour CE type de voyage (fonctions pures).
 *
 * Le trajet d'approche et les nuits ont leur propre modèle (`v5/model/prevoir.ts`) ; ici, le reste : papiers
 * d'entrée, assurance, transfert depuis l'aéroport ou la gare, location (voiture, vélo, embarcation,
 * matériel), forfait de remontées, refuges, permis, guide, activités sur place. Les lignes sortent dans
 * l'ordre où l'on s'en occupe.
 *
 * RÈGLES DURES
 *  - Un PRIX n'existe que si un barème versionné du dépôt le donne (`engine/costs.ts` : assurance, voiture de
 *    location, formalités d'un ressortissant français). Tout le reste est sans prix : l'écran dit « Prix sur
 *    le site ». Aucune table de tarifs n'est ajoutée ici.
 *  - Aucun lieu, aucun nom d'aéroport ou de gare n'est deviné : sans lui, « l'aéroport » ou « la gare ».
 *  - Les liens sont des recherches publiques (`engine/deepLinks.ts`), sans clé ni identifiant d'affiliation.
 *  - La nationalité ne sert qu'à décider d'un prix de formalités ; la ligne se calcule à la lecture, avec le
 *    profil de la personne qui regarde, et ne se range jamais sur le voyage (`engine/formalities.ts`).
 */

import { getCountryByCode } from '@/lib/countries';
import { CAR_ASSUMPTIONS } from './autofill';
import { carRentalPerDay, insurance, priceLevel, COSTS_VERSION } from './costs';
import type { AxisLevel } from './danger';
import { activitiesSearchUrl, addDaysIso, carRentalUrl, isoDate, mapsDirectionsUrl, objectSearchUrl } from './deepLinks';
import { engineT, type EngineT } from './engineI18n';
import { needsFormalities, type EntryKind, type EntryRequirement } from './entry';
import { readerEntryFee, readerNeedsInsurance } from './formalities';

export type ResaKind = 'transfer' | 'rental' | 'pass' | 'permit' | 'guide' | 'insurance' | 'visa' | 'activity';

/** « Quand » d'une ligne qui n'a pas de date propre. */
export const BEFORE_DEPARTURE = 'avant le départ' as const;

/** Un refuge se réserve au plus tôt : repère de conseil (jours avant le départ), jamais un tarif. */
export const REFUGE_BOOK_LEAD_DAYS = 60;

export interface ResaPrice {
  amount: number;
  currency: string;
  /** D'où vient le montant : le barème versionné du Compas, avec sa date. */
  basis: string;
  /** `person` : par personne ; `group` : pour tout le groupe. */
  per: 'person' | 'group';
}

export interface ResaLine {
  /** Clé stable de la ligne ; le statut « réservé » se range sous `extra:<key>`. */
  key: string;
  kind: ResaKind;
  title: string;
  why: string;
  /** Date ISO où il faut l'avoir, ou `BEFORE_DEPARTURE`. */
  when: string;
  /** Date limite conseillée (ISO), seulement quand elle a un sens (refuges). */
  bookBy?: string;
  /** Absent : « Prix sur le site ». */
  price?: ResaPrice;
  /** Recherche publique préremplie, ou null quand le lieu manque. */
  url: string | null;
}

export type ResaApproach = 'flight' | 'train' | 'car' | 'bus' | 'carpool' | 'foot';

export interface ResaPlanInput {
  /** Activité du voyage (`COMPAS_ACTIVITIES`). */
  activity: string | null;
  /** Pays d'arrivée et pays de départ (ISO alpha-2), null quand ils ne sont pas connus. */
  destinationCountry: string | null;
  originCountry: string | null;
  /** « À l'étranger » quand le pays de départ n'est pas lisible ici (départ du lanceur) ; sinon calculé des deux pays. */
  abroad?: boolean | null;
  /** Dates du voyage (ISO) et durée, lues du modèle : jamais recalculées ici. */
  start: string | null;
  end: string | null;
  days: number | null;
  party: number;
  maxAltitudeM: number | null;
  /** Trajet d'approche retenu (ou proposé par défaut) ; null : aucun trajet connu. */
  approach: ResaApproach | null;
  /** Nationalité de la personne qui regarde (ISO), seulement si connue. */
  nationality: string | null;
  /** Ce que la table passeport × destination dit pour elle (`entryFor`), ou null. */
  entry: EntryRequirement | null;
  /** Nom du sentier nommé (« GR20 »), ou null. */
  namedTrail: string | null;
  /** Nom du lieu de séjour (base), pour les liens et les titres. */
  base: string | null;
  /**
   * Localité de la première étape (là où l'on arrive : « Kościelisko »). Le transfert de l'aéroport ou de la gare
   * va là ; sans elle, le nom du voyage (`base`). Un massif (« Tatras ») n'est pas une adresse.
   */
  arrivalPlace?: string | null;
  /** Nom du pays, pour la recherche de visa (sinon la base). */
  countryName?: string | null;
  /** Aéroport d'arrivée (nom OurAirports) ; sans lui, « l'aéroport ». */
  hub: string | null;
  /** Code IATA de l'aéroport d'arrivée du vol retenu, quand il est connu : lieu de prise de la voiture de location. */
  arrivalAirport?: string | null;
  /** Préférence de nuits du voyage (`preferences.nights`). */
  nights: 'bivouac' | 'refuge' | 'hebergement' | 'mixte' | null;
  /** Niveau de l'axe « technique » du danger : « guide conseillé » dès « vigilance ». */
  technicalLevel?: AxisLevel | null;
  /** Sans voiture voulue (`preferences.carFree`) : jamais de voiture de location. */
  carFree?: boolean;
  /** Aujourd'hui (ISO) : une date limite déjà passée n'est pas affichée. Absent : aucune date n'est écartée. */
  today?: string | null;
  t?: EngineT;
}

const iso2 = (v: string | null | undefined): string | null => {
  const c = (v ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
};

const ENTRY_WHY: Partial<Record<EntryKind, 'visaWhyEvisa' | 'visaWhyAuthorisation' | 'visaWhyEmbassy' | 'visaWhyArrival' | 'visaWhyPermit'>> = {
  e_visa: 'visaWhyEvisa',
  autorisation: 'visaWhyAuthorisation',
  visa_a_demander: 'visaWhyEmbassy',
  visa_arrivee: 'visaWhyArrival',
  permis: 'visaWhyPermit',
};

/** Activités qui se font en montagne : un permis d'accès est à vérifier hors d'Europe. */
const PERMIT_ACTIVITIES = new Set(['hiking', 'trekking', 'bivouac', 'mountaineering', 'climbing', 'trail', 'ski']);
/** Activités où des refuges peuvent être réservés (nuits « refuge » dites). */
const HUT_ACTIVITIES = new Set(['hiking', 'trekking', 'ski', 'mountaineering', 'climbing', 'mixed', 'trail', 'bivouac']);
/** Activités d'un sentier nommé (GR20, TMB…) : ses refuges se réservent à l'avance. */
const TRAIL_ACTIVITIES = new Set(['hiking', 'trekking', 'bivouac', 'trail', 'mixed']);
const TOWN_ACTIVITIES = new Set(['citytrip', 'beach', 'cultural']);

/** Rang des nuits dans le plan fusionné (`v5/model/prevoir.ts`) : après le transfert et la voiture de l'arrivée. */
export const RESA_RANK_NIGHT = 44;

/**
 * Ordre unique où l'on s'en occupe : papiers, assurance, [trajet : 25], transfert et voiture de l'arrivée, [nuits :
 * 44], puis ce qui se prend pour l'activité (location de vélo, d'embarcation ou de matériel, puis le forfait juste
 * après, refuges, permis, guide, activités sur place).
 */
const RANK: Record<string, number> = {
  visa: 10,
  insurance: 20,
  transfer: 30,
  'rental-car': 40,
  'rental-bike': 45,
  'rental-boat': 46,
  'rental-gear': 47,
  'lift-pass': 48,
  refuges: 51,
  permit: 52,
  guide: 60,
  activities: 70,
};

/** Rang d'une ligne dans le plan (les lignes inconnues passent en dernier). */
export const resaRank = (key: string): number => RANK[key] ?? 99;

export function resaPlan(input: ResaPlanInput): ResaLine[] {
  const t = input.t ?? engineT('fr');
  const dest = iso2(input.destinationCountry);
  const from = iso2(input.originCountry);
  const abroad: boolean | null = dest && from ? dest !== from : (input.abroad ?? null);
  const activity = input.activity ?? '';
  const start = isoDate(input.start);
  const when = start ?? BEFORE_DEPARTURE;
  const days = input.days != null && Number.isInteger(input.days) && input.days >= 1 ? input.days : null;
  const party = Math.max(1, Math.floor(input.party) || 1);
  const base = input.base?.trim() || null;
  const out: ResaLine[] = [];
  const add = (line: Omit<ResaLine, 'when'> & { when?: string }) => out.push({ when: BEFORE_DEPARTURE, ...line });

  /* Papiers : le visa ou l'autorisation que la table dit requis pour CETTE personne. */
  const entry = input.entry;
  if (entry && abroad !== false && (needsFormalities(entry.kind) || entry.kind === 'permis')) {
    const why = ENTRY_WHY[entry.kind];
    const fee = readerEntryFee({ countryCode: dest, abroad, nationality: iso2(input.nationality), entry });
    if (why)
      add({
        key: 'visa',
        kind: 'visa',
        title: t('compas.v5.resa.visaTitle'),
        why: t(`compas.v5.resa.${why}`),
        price: fee ? { amount: fee.eur, currency: 'EUR', basis: fee.basis, per: 'person' } : undefined,
        url: objectSearchUrl(t('compas.v5.resa.q.visa'), input.countryName?.trim() || base),
      });
  }

  /* Assurance : seulement quand on SAIT que le voyage passe une frontière. */
  if (readerNeedsInsurance(abroad)) {
    const high = (input.maxAltitudeM ?? 0) >= 4000;
    add({
      key: 'insurance',
      kind: 'insurance',
      title: t('compas.v5.resa.insuranceTitle'),
      why: t(high ? 'compas.v5.resa.insuranceWhyAltitude' : 'compas.v5.resa.insuranceWhy'),
      price:
        days != null
          ? {
              amount: insurance(days, { abroad: true, altitudeM: input.maxAltitudeM }),
              currency: 'EUR',
              basis: `barème Compas ${COSTS_VERSION} · assurance voyage et rapatriement, forfait par jour`,
              per: 'person',
            }
          : undefined,
      url: objectSearchUrl(
        [
          t('compas.v5.resa.q.insurance'),
          input.countryName?.trim() || base,
          days != null ? t(days === 1 ? 'compas.v5.resa.q.day' : 'compas.v5.resa.q.days', { n: days }) : null,
          high ? t('compas.v5.resa.q.insuranceTrek') : null,
        ]
          .filter(Boolean)
          .join(' '),
        null
      ),
    });
  }

  /* Location de voiture : un road trip sans voiture au départ. */
  const noCarAtArrival = input.approach === 'flight' || input.approach === 'train' || input.approach === 'bus';
  const rentCar = activity === 'roadtrip' && noCarAtArrival && input.carFree !== true;

  /* Transfert : de l'aéroport ou de la gare au lieu de séjour (la voiture de location se prend à l'arrivée). */
  if ((input.approach === 'flight' || input.approach === 'train') && !rentCar) {
    const hub = input.hub?.trim() || t(input.approach === 'flight' ? 'compas.v5.resa.hubAirport' : 'compas.v5.resa.hubStation');
    const arrival = input.arrivalPlace?.trim() || base;
    add({
      key: 'transfer',
      kind: 'transfer',
      title: arrival ? t('compas.v5.resa.transferTitle', { base: arrival, hub }) : t('compas.v5.resa.transferTitleNoBase', { hub }),
      why: t('compas.v5.resa.transferWhy'),
      when,
      url: mapsDirectionsUrl({ origin: input.hub?.trim() || null, destination: arrival, mode: 'transit' }),
    });
  }

  if (rentCar) {
    const level = dest ? priceLevel(dest) : null;
    const cars = Math.max(1, Math.ceil(party / CAR_ASSUMPTIONS.seats));
    add({
      key: 'rental-car',
      kind: 'rental',
      title: t('compas.v5.resa.rentalCarTitle'),
      why: t('compas.v5.resa.rentalCarWhy'),
      when,
      price:
        level?.known && days != null
          ? {
              amount: carRentalPerDay(level.level) * days * cars,
              currency: 'EUR',
              basis: `${level.basis} · voiture de catégorie économique, ${days} jour${days > 1 ? 's' : ''}${cars > 1 ? `, ${cars} voitures` : ''}`,
              per: 'group',
            }
          : undefined,
      url: carRentalUrl({
        label: t('compas.v5.resa.q.car'),
        place: input.arrivalAirport?.trim().toUpperCase() || input.arrivalPlace?.trim() || base,
        start: input.start,
        end: input.end,
      }),
    });
  }

  if (activity === 'cycling' && (noCarAtArrival || input.approach === 'foot'))
    add({
      key: 'rental-bike',
      kind: 'rental',
      title: t('compas.v5.resa.rentalBikeTitle'),
      why: t('compas.v5.resa.rentalBikeWhy'),
      when,
      url: objectSearchUrl(t('compas.v5.resa.q.bike'), base),
    });

  if (activity === 'water')
    add({
      key: 'rental-boat',
      kind: 'rental',
      title: t('compas.v5.resa.rentalBoatTitle'),
      why: t('compas.v5.resa.rentalBoatWhy'),
      when,
      url: objectSearchUrl(t('compas.v5.resa.q.boat'), base),
    });

  const gear =
    activity === 'ski'
      ? (['rentalGearSki', 'gearSki'] as const)
      : activity === 'climbing'
        ? (['rentalGearClimb', 'gearClimb'] as const)
        : activity === 'mountaineering'
          ? (['rentalGearAlpine', 'gearAlpine'] as const)
          : null;
  if (gear)
    add({
      key: 'rental-gear',
      kind: 'rental',
      title: t(`compas.v5.resa.${gear[0]}Title`),
      why: t(`compas.v5.resa.${gear[0]}Why`),
      when,
      url: objectSearchUrl(t(`compas.v5.resa.q.${gear[1]}`), base),
    });

  /* Forfait de remontées : le ski. */
  if (activity === 'ski')
    add({
      key: 'lift-pass',
      kind: 'pass',
      title: t('compas.v5.resa.liftPassTitle'),
      why: t('compas.v5.resa.liftPassWhy'),
      when,
      url: objectSearchUrl(t('compas.v5.resa.q.liftPass'), base),
    });

  /* Refuges : réservés à l'avance en trek en refuge ou sur un sentier nommé. Une date limite, pas un prix. */
  const huts = (input.nights === 'refuge' && HUT_ACTIVITIES.has(activity)) || (input.namedTrail != null && (activity === '' || TRAIL_ACTIVITIES.has(activity)));
  if (huts) {
    const limit = addDaysIso(start, -REFUGE_BOOK_LEAD_DAYS);
    const today = isoDate(input.today ?? null);
    add({
      key: 'refuges',
      kind: 'permit',
      title: t('compas.v5.resa.refugesTitle'),
      why: t('compas.v5.resa.refugesWhy'),
      when,
      ...(limit && !(today && limit < today) ? { bookBy: limit } : {}),
      url: objectSearchUrl(t('compas.v5.resa.q.refuges'), input.namedTrail ?? base),
    });
  }

  /* Permis : AUCUNE donnée de permis dans le dépôt, donc une ligne générique pour la montagne hors d'Europe. */
  if (dest && PERMIT_ACTIVITIES.has(activity) && getCountryByCode(dest)?.continent !== 'Europe')
    add({
      key: 'permit',
      kind: 'permit',
      title: t('compas.v5.resa.permitTitle'),
      why: t('compas.v5.resa.permitWhy'),
      url: objectSearchUrl(t('compas.v5.resa.q.permit'), base),
    });

  /* Guide : seulement au-dessus du seuil d'engagement que le moteur de danger a déjà calculé. */
  if ((activity === 'climbing' || activity === 'mountaineering') && (input.technicalLevel === 'vigilance' || input.technicalLevel === 'bloque'))
    add({
      key: 'guide',
      kind: 'guide',
      title: t('compas.v5.resa.guideTitle'),
      why: t('compas.v5.resa.guideWhy'),
      when,
      url: objectSearchUrl(t('compas.v5.resa.q.guide'), base),
    });

  if (TOWN_ACTIVITIES.has(activity))
    add({
      key: 'activities',
      kind: 'activity',
      title: t('compas.v5.resa.activitiesTitle'),
      why: t('compas.v5.resa.activitiesWhy'),
      url: activitiesSearchUrl(base),
    });

  return out.sort((a, b) => resaRank(a.key) - resaRank(b.key));
}
