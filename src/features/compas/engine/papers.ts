/**
 * Compas — papiers, monnaie et prises, par règles, selon le voyageur (PLAN-100 4.1, 4.2).
 *
 * L'IA écrivait « pense à ton passeport » pour le Portugal : les papiers sont
 * décidés ici, sur des listes sûres, et chaque affirmation dépend de ce qu'on SAIT
 * de la personne (profil voyageur) :
 *  - papiers et formalités : sa NATIONALITÉ. Française : les listes ci-dessous et
 *    France Diplomatie (règles d'avant le profil, inchangées). Inconnue ou autre :
 *    rien d'affirmé, une seule ligne qui renvoie au service officiel de son pays
 *    (la vraie table passeport × destination est le lot Q) ; rien quand aucune
 *    frontière n'est passée (son propre pays, ou départ déjà dans le pays) ;
 *  - prises : son PAYS DE RÉSIDENCE (ses appareils). En France (ou nationalité
 *    française sans résidence dite) : l'adaptateur est dit ; sinon seulement le
 *    type de prise du pays, un fait ;
 *  - change : sa DEVISE. En zone euro, les conseils de change de l'IA ne sont
 *    gardés que pour une personne dont la devise connue n'est pas l'euro.
 * Les conseils de l'IA qui doublent une règle sont écartés (`keepAiNote`).
 */

import { entryFees } from './costs';
import { UNKNOWN_TRAVELLER, type TravellerContext } from './traveller';

/** `sur_place` : aucune frontière à passer (départ déjà dans le pays), rien à dire. */
export type PapersKind = 'domestique' | 'carte' | 'passeport' | 'a_verifier' | 'sur_place';

export interface TravelPapers {
  papers: PapersKind | null;
  /** Euro sur place, null si le pays est inconnu. */
  euro: boolean | null;
  /** Zone euro : la devise connue de la personne est l'euro (vrai) ou une autre (faux) ; null sinon. */
  sameMoney: boolean | null;
  /** Prises : une ligne en parle (`dit`), rien à dire (`compatibles`), ou inconnu (null). */
  plugs: 'dit' | 'compatibles' | null;
  notes: string[];
}

const set = (codes: string) => new Set(codes.split(' '));

/** France et outre-mer. */
const DOMESTIC = set('FR RE GP MQ GF YT PM BL MF NC PF WF');

/** La carte d'identité française suffit : UE, EEE, Suisse, micro-États, Balkans occidentaux. */
const ID_CARD = set(
  'AT BE BG HR CY CZ DK EE FI DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH AD MC SM VA AL BA ME MK RS'
);

/** Europe hors des listes sûres : on n'affirme rien, on renvoie à France Diplomatie. */
const EUROPE_TO_CHECK = set('TR GE MD UA BY RU AM AZ XK FO GL GI IM JE GG SJ');

/** Euro (Bulgarie depuis le 1er janvier 2026). */
const EURO = set(
  'FR RE GP MQ GF YT PM BL MF AT BE BG HR CY EE FI DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'
);

/** Prises incompatibles avec celles de France (C, E, F) : le type du pays. */
const PLUGS: Record<string, string> = {
  GB: 'G', IE: 'G', MT: 'G', CY: 'G',
  US: 'A/B', CA: 'A/B', MX: 'A/B', JP: 'A/B',
  AU: 'I', NZ: 'I',
};

/** Prises C, E, F : rien à dire à des appareils de France, et l'IA ne doit pas parler d'adaptateur. */
const FRENCH_PLUGS = set(
  'FR RE GP MQ GF YT PM BL MF AT BE BG HR CZ DK EE FI DE GR HU IT LV LT LU NL PL PT RO SK SI ES SE IS LI NO CH AD MC SM VA AL BA ME MK RS MA TN DZ TR'
);

/**
 * Papiers, monnaie et prises pour CE voyageur. `abroad` : faux quand le départ est
 * déjà dans le pays de destination (`abroadOf`), null quand on ne sait pas.
 */
export function travelPapers(
  countryCode: string | null | undefined,
  countryName?: string | null,
  traveller: TravellerContext = UNKNOWN_TRAVELLER,
  abroad: boolean | null = null
): TravelPapers {
  const cc = (countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return { papers: null, euro: null, sameMoney: null, plugs: null, notes: [] };
  const where = countryName || cc;
  const notes: string[] = [];
  const papers =
    traveller.nationality === 'FR'
      ? frenchPapers(cc, where, notes)
      : otherPapers(cc, where, traveller.nationality, abroad, notes);
  const plug = PLUGS[cc];
  let plugs: TravelPapers['plugs'];
  if (frenchDevices(traveller)) {
    if (plug) notes.push(`Prises de type ${plug} : adaptateur à prévoir.`);
    plugs = plug ? 'dit' : FRENCH_PLUGS.has(cc) ? 'compatibles' : null;
  } else {
    if (plug) notes.push(`Prises de type ${plug} (${where}) : vérifie que tes chargeurs s’y branchent.`);
    plugs = plug ? 'dit' : null;
  }
  const euro = EURO.has(cc);
  return {
    papers,
    euro,
    sameMoney: euro && traveller.currency ? traveller.currency === 'EUR' : null,
    plugs,
    notes,
  };
}

/** Ressortissant français : listes sûres, formalités connues, France Diplomatie. */
function frenchPapers(cc: string, where: string, notes: string[]): PapersKind {
  if (DOMESTIC.has(cc)) return 'domestique';
  if (ID_CARD.has(cc)) {
    notes.push(`Papiers : carte d’identité ou passeport en cours de validité, sans visa (${where}).`);
    return 'carte';
  }
  const fee = entryFees(cc);
  if (fee) {
    notes.push(`Papiers : passeport + ${fee.detail}, conditions à vérifier sur France Diplomatie avant de partir.`);
    return 'passeport';
  }
  if (EUROPE_TO_CHECK.has(cc)) {
    notes.push(`Papiers : conditions d’entrée (${where}) à vérifier sur France Diplomatie avant de partir.`);
    return 'a_verifier';
  }
  notes.push(`Papiers : passeport (${where}), conditions d’entrée à vérifier sur France Diplomatie avant de partir.`);
  return 'passeport';
}

/**
 * Nationalité inconnue ou autre : rien d'affirmé. Son propre pays, ou un départ déjà
 * dans le pays : aucune frontière, rien à dire. Sinon une seule ligne, la même pour
 * tous (dédoublonnée par `orderNotes`), qui renvoie au service officiel de son pays.
 */
function otherPapers(
  cc: string,
  where: string,
  nationality: string | null,
  abroad: boolean | null,
  notes: string[]
): PapersKind {
  if (nationality === cc) return 'domestique';
  if (abroad === false) return 'sur_place';
  notes.push(`Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`);
  return 'a_verifier';
}

/** Appareils de France : résidence en France (outre-mer compris), ou nationalité française sans résidence dite. */
function frenchDevices(t: TravellerContext): boolean {
  return t.residenceCountry ? DOMESTIC.has(t.residenceCountry) : t.nationality === 'FR';
}

const PAPERS_RE = /passeport|carte d[’']identit|\bvisas?\b|e-visa|formalit|autorisation (de voyage|électronique)/i;
const PAPERS_ACRONYM_RE = /\b(ESTA|ETA|eTA|NZeTA|AVE)\b/;
const MONEY_RE = /bureau de change|taux de change|devises?\b|monnaie locale|changer (de l[’'])?argent|changer (tes |vos |des )?euros|change tes euros|change vos euros/i;
const PLUG_RE = /adaptateur|prises? (électriques?|de type)/i;

/** Un conseil de l'IA est gardé s'il ne contredit pas, ou ne double pas, une règle connue. */
export function keepAiNote(note: string, rules: TravelPapers): boolean {
  if (rules.papers == null) return true;
  // Les papiers restent à la règle, même quand elle se tait (rien d'affirmé par l'IA).
  if (PAPERS_RE.test(note) || PAPERS_ACRONYM_RE.test(note)) return false;
  // Change : écarté en zone euro, sauf pour une personne dont la devise connue est autre.
  if (rules.euro && rules.sameMoney !== false && MONEY_RE.test(note)) return false;
  if (rules.plugs != null && PLUG_RE.test(note)) return false;
  return true;
}
