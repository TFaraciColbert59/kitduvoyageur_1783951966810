import type { AbroadFrom } from './papers';
import { UNKNOWN_ORIGIN_LINE } from './travel';

/**
 * D'où part le trajet d'approche, tel que l'écran le dit (PLAN-100 4.3).
 *
 * Trois sources, dans cet ordre (`travelOrigin`, `engine/travel.ts`) : le départ DIT
 * (`metadata.compas.origin`, « depuis Lyon »), le domicile du profil voyageur, la position de
 * l'appareil. Seul le départ dit a un nom à l'écran, parce que c'est un fait du voyage que la
 * personne a écrit. Le domicile et la position ne sont JAMAIS nommés ni chiffrés ici : « depuis
 * ton domicile », « depuis ta position (arrondie à ~1 km) », et rien de plus
 * (`travelHome.test.ts`, verrou `scripts/verify/traveller_privacy.mjs`).
 *
 * Module pur, sans profil : l'appelant (`getCompasData`, côté lecture) ne lui passe qu'un
 * booléen « la personne a un domicile », jamais le domicile.
 */

export type DepartureSource =
  /** Le départ dit : le seul à porter un nom. */
  | 'dit'
  /** Le domicile du profil voyageur de la personne qui regarde. */
  | 'domicile'
  /** La position de l'appareil de la personne qui regarde. */
  | 'gps'
  /** Le domicile ou la position d'une autre personne (celle qui a lancé la préparation) : jamais montré. */
  | 'autre'
  /** Aucun point de départ : le trajet n'est pas chiffré. */
  | 'aucun';

export interface Departure {
  source: DepartureSource;
  /** Le nom du lieu, seulement pour un départ dit. */
  name?: string;
}

export interface DepartureInput {
  /** Le départ dit rangé sur le voyage, s'il y en a un. */
  said: { name: string } | null;
  /** La personne qui regarde a un domicile dans son profil voyageur (le domicile lui-même ne passe jamais ici). */
  hasHome: boolean;
  /**
   * D'où est parti le trajet de la dernière préparation, et qui l'a lancée ; null sans préparation ou
   * sans départ connu à ce moment-là.
   */
  prepared: { from: AbroadFrom | null; by: string | null } | null;
  /** La personne qui regarde (null : sans compte). */
  viewerId: string | null;
}

/**
 * Le départ en usage. Un départ dit l'emporte toujours. Sinon, une préparation déjà faite dit d'où elle est
 * partie : depuis le domicile ou la position, c'est celui de la personne qui l'a lancée, que seule elle voit
 * (un collaborateur ne doit pas apprendre où elle habite ni où elle était : `autre`). Sans préparation, le
 * prochain trajet partira du domicile si la personne en a un.
 */
export function readDeparture(input: DepartureInput): Departure {
  if (input.said) return { source: 'dit', name: input.said.name };
  const from = input.prepared?.from;
  if (from === 'domicile' || from === 'gps')
    return input.viewerId != null && input.prepared?.by === input.viewerId
      ? { source: from }
      : { source: 'autre' };
  if (input.hasHome) return { source: 'domicile' };
  return { source: 'aucun' };
}

/** Le départ du domicile : jamais le nom du domicile. */
export const DEPARTURE_HOME = 'depuis ton domicile';
/** Le départ de la position : arrondie avant tout envoi. */
export const DEPARTURE_GPS = 'depuis ta position (arrondie à ~1 km)';

export interface DepartureText {
  /** Ce que dit la ligne : le lieu, « depuis ton domicile », « depuis ta position (arrondie à ~1 km) »… */
  value: string;
  /** D'où vient ce départ, en quelques mots ; null quand il n'y en a pas. */
  source: string | null;
  /** Une phrase qui dit ce que ça change. */
  hint: string;
}

export function departureText(d: Departure | undefined): DepartureText {
  switch (d?.source) {
    case 'dit':
      return {
        value: d.name?.trim() || 'Départ dit',
        source: 'départ dit',
        hint: 'Le trajet d’approche est chiffré depuis là.',
      };
    case 'domicile':
      return {
        value: DEPARTURE_HOME,
        source: 'ton profil voyageur',
        hint: 'Le nom de ton domicile n’est jamais affiché ni rangé sur le voyage. Dis une autre ville pour partir d’ailleurs.',
      };
    case 'gps':
      return {
        value: DEPARTURE_GPS,
        source: 'position de ton appareil',
        hint: 'Ta position est arrondie avant tout envoi. Dis une autre ville pour partir d’ailleurs.',
      };
    case 'autre':
      return {
        value: 'Départ de la personne qui a lancé la préparation',
        source: 'non montré',
        hint: 'Son domicile ou sa position ne sont montrés à personne d’autre. Dis une ville pour partir d’ailleurs.',
      };
    default:
      return {
        value: UNKNOWN_ORIGIN_LINE,
        source: null,
        hint: 'Dis d’où tu pars pour chiffrer le trajet d’approche.',
      };
  }
}

/** La valeur courte de la ligne « Départ » sur la carte Où. */
export function departureRowValue(d: Departure | undefined): string {
  switch (d?.source) {
    case 'dit':
      return d.name?.trim() || 'Départ dit';
    case 'domicile':
      return DEPARTURE_HOME;
    case 'gps':
      return DEPARTURE_GPS;
    case 'autre':
      return 'Non montré';
    default:
      return 'Non renseigné';
  }
}
