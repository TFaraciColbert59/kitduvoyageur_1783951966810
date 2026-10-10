/**
 * Compas — papiers, monnaie et prises, par règles, selon le voyageur (PLAN-100 4.1, 4.2).
 *
 * L'IA écrivait « pense à ton passeport » pour le Portugal : les papiers sont
 * décidés ici, sur des listes sûres, et chaque affirmation dépend de ce qu'on SAIT
 * de la personne (profil voyageur) :
 *  - papiers et formalités : sa NATIONALITÉ. Quand la table passeport × destination
 *    (travelrequirements.info, `engine/entry.ts`) a une ligne confirmée pour elle,
 *    la ligne « Papiers » vient de la table, avec sa date de vérification. Sinon :
 *    française, les listes ci-dessous et France Diplomatie (règles d'avant le
 *    profil, inchangées ; la carte d'identité en Europe, que la table ne dit pas,
 *    garde la liste interne) ; inconnue ou autre, rien d'affirmé, une seule ligne
 *    qui renvoie au service officiel de son pays. Rien quand aucune frontière
 *    n'est passée (son propre pays, ou départ déjà dans le pays) ;
 *  - prises : son PAYS DE RÉSIDENCE (ses appareils). En France (ou nationalité
 *    française sans résidence dite) : l'adaptateur est dit ; sinon seulement le
 *    type de prise du pays, un fait ;
 *  - change : sa DEVISE. En zone euro, les conseils de change de l'IA ne sont
 *    gardés que pour une personne dont la devise connue n'est pas l'euro.
 * Les conseils de l'IA qui doublent une règle sont écartés (`keepAiNote`).
 */

import { entryFees } from './costs';
import { describeEntry, frenchDay, type EntryKind, type EntryRequirement } from './entry';
import { UNKNOWN_TRAVELLER, type TravellerContext } from './traveller';

/**
 * `sur_place` : aucune frontière à passer (départ déjà dans le pays), rien à dire.
 * `visa` : visa, autorisation ou permis à obtenir (d'après la table) ; `libre_circulation` :
 * pas de formalité de frontière (d'après la table).
 */
export type PapersKind =
  | 'domestique'
  | 'carte'
  | 'passeport'
  | 'visa'
  | 'libre_circulation'
  | 'a_verifier'
  | 'sur_place';

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
 * déjà dans le pays de destination (`abroadOf`), null quand on ne sait pas. `entry` :
 * ce que la table passeport × destination dit pour sa nationalité et ce pays
 * (`server/entryRequirements.ts`, via `entryFor`) ; null ou « non confirmé » : les règles
 * d'avant. Ignorée sans nationalité connue.
 */
export function travelPapers(
  countryCode: string | null | undefined,
  countryName?: string | null,
  traveller: TravellerContext = UNKNOWN_TRAVELLER,
  abroad: boolean | null = null,
  entry: EntryRequirement | null = null
): TravelPapers {
  const cc = (countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return { papers: null, euro: null, sameMoney: null, plugs: null, notes: [] };
  const where = countryName || cc;
  const notes: string[] = [];
  const papers =
    traveller.nationality === 'FR'
      ? frenchPapers(cc, where, notes, abroad, entry)
      : otherPapers(cc, where, traveller.nationality, abroad, notes, entry);
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

const FRANCE_DIPLOMATIE = 'sur France Diplomatie';
const OFFICIAL_SERVICE = 'auprès du service officiel de ton pays';

/** Mot de la table → nature des papiers, pour `TravelPapers.papers`. */
const PAPERS_OF: Record<EntryKind, PapersKind> = {
  libre_circulation: 'libre_circulation',
  sans_visa: 'passeport',
  visa_arrivee: 'visa',
  e_visa: 'visa',
  autorisation: 'visa',
  visa_a_demander: 'visa',
  permis: 'visa',
  interdit: 'a_verifier',
  non_confirme: 'a_verifier',
};

/**
 * La ligne « Papiers » d'après la table, avec sa date de vérification et où la confirmer ;
 * null quand la table ne dit rien de sûr (« non confirmé », pas de ligne).
 */
function tableLine(entry: EntryRequirement | null, where: string, confirm: string, notes: string[]): PapersKind | null {
  const body = entry ? describeEntry(entry) : null;
  if (!entry || !body) return null;
  const day = frenchDay(entry.verified);
  notes.push(`Papiers : ${body} (${where})${day ? ` ; vérifié le ${day}` : ''}, à confirmer ${confirm} avant de partir.`);
  return PAPERS_OF[entry.kind];
}

/**
 * Ressortissant français : DOMESTIC, la carte d'identité en Europe (liste interne : la
 * table ne la dit pas), puis la table ; sans ligne confirmée, les formalités connues et
 * France Diplomatie (règles d'avant). Son propre territoire : rien (un citoyen y entre de
 * droit). Un départ déjà dans le pays visité (`abroad` faux, ex. résident au Portugal pour
 * un voyage au Portugal) : aucune frontière, rien à dire.
 */
function frenchPapers(
  cc: string,
  where: string,
  notes: string[],
  abroad: boolean | null,
  entry: EntryRequirement | null
): PapersKind {
  if (DOMESTIC.has(cc)) return 'domestique';
  if (abroad === false) return 'sur_place';
  if (ID_CARD.has(cc)) {
    notes.push(`Papiers : carte d’identité ou passeport en cours de validité, sans visa (${where}).`);
    return 'carte';
  }
  const fromTable = tableLine(entry, where, FRANCE_DIPLOMATIE, notes);
  if (fromTable) return fromTable;
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
 * Nationalité inconnue ou autre : rien d'affirmé. Un départ déjà dans le pays : aucune
 * frontière, rien à dire. Son propre pays sans départ connu : pas de frontière connue,
 * rien à dire non plus ; mais revenir dans son pays depuis l'étranger franchit une
 * frontière (`abroad` vrai) : la ligne ci-dessous. Une nationalité connue qui passe une
 * frontière reçoit la ligne de la table quand elle est confirmée ; sinon une seule
 * ligne, la même pour tous (dédoublonnée par `orderNotes`), qui renvoie au service
 * officiel de son pays. Sans nationalité connue, la table n'est jamais lue.
 */
function otherPapers(
  cc: string,
  where: string,
  nationality: string | null,
  abroad: boolean | null,
  notes: string[],
  entry: EntryRequirement | null
): PapersKind {
  if (abroad === false) return nationality === cc ? 'domestique' : 'sur_place';
  if (nationality === cc && abroad == null) return 'domestique';
  // La table ne parle qu'à une nationalité connue, hors de son propre pays (un citoyen y revient de droit).
  const fromTable = nationality && nationality !== cc ? tableLine(entry, where, OFFICIAL_SERVICE, notes) : null;
  if (fromTable) return fromTable;
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
