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
 *  - prises : son PAYS DE RÉSIDENCE (ses appareils), pour n'importe quel pays (`engine/plugs.ts`, table de
 *    228 pays) : « adaptateur à prévoir » quand ses appareils et le pays n'ont aucune prise en commun ; pays de
 *    résidence inconnu (ou nationalité française sans résidence dite : la France) : seulement le type de prise
 *    du pays, un fait, là où la table ne donne pas le type C ; une ligne « Courant » quand la tension ou la
 *    fréquence diffèrent (lecture seule) ;
 *  - change : sa DEVISE, sinon celle de son pays de résidence (`engine/change.ts`) : une ligne « Change » à la
 *    lecture quand la monnaie du pays n'est pas la sienne. En zone euro, les conseils de change de l'IA ne sont
 *    gardés que pour une personne dont la devise connue n'est pas l'euro.
 * Les conseils de l'IA qui doublent une règle sont écartés (`keepAiNote`).
 *
 * VIE PRIVÉE : la ligne « Papiers » dépend de la nationalité, les lignes « Prises » et « Courant » des appareils
 * (résidence), la ligne « Change » et le conseil de change de la devise : rien de tout cela ne se range sur le voyage
 * (`trips.metadata` est lisible par les collaborateurs et, pour un voyage public, par tous : le
 * groupe de passeports de la table ne contient parfois qu'une nationalité, et « adaptateur à
 * prévoir » dit des appareils du pays de résidence). Le voyage ne garde que les lignes SANS profil
 * (`sharedNotes`, `sharedRules` pour filtrer l'IA) ; les lignes de la personne qui regarde se
 * calculent à la lecture, avec SON profil (`notesForReader`).
 */

import { CHANGE_NOTE_PREFIX, changeLineFor } from './change';
import { entryFees } from './costs';
import { describeEntry, entryFor, frenchDay, type EntryKind, type EntryRequirement } from './entry';
import { CURRENT_NOTE_PREFIX, currentLineFor, plugVerdict } from './plugs';
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
  // Prises : les appareils de la personne (`deviceCountry`) contre le pays visité (`engine/plugs.ts`).
  const verdict = plugVerdict(cc, where, deviceCountry(traveller));
  let plugs: TravelPapers['plugs'] = null;
  if (verdict.kind === 'adaptateur') {
    notes.push(verdict.line);
    plugs = 'dit';
  } else if (verdict.kind === 'fait' && verdict.line) {
    notes.push(verdict.line);
    plugs = 'dit';
  } else if (verdict.kind === 'commun') {
    plugs = 'compatibles';
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

/**
 * Le pays dont les appareils de la personne suivent la norme : son pays de résidence, sinon la France pour une
 * nationalité française sans résidence dite (règle d'avant), sinon null (résidence inconnue : le fait du pays seul).
 */
function deviceCountry(t: TravellerContext): string | null {
  return t.residenceCountry ?? (t.nationality === 'FR' ? 'FR' : null);
}

/** Toute ligne « Papiers » des règles ci-dessus commence ainsi (la note qui dépend de la nationalité). */
export const PAPERS_NOTE_PREFIX = 'Papiers :';

export function isPapersNote(note: string): boolean {
  return note.startsWith(PAPERS_NOTE_PREFIX);
}

/** Toute ligne « Prises » des règles ci-dessus commence ainsi (la note qui dépend des appareils de la personne). */
export const PLUGS_NOTE_PREFIX = 'Prises de type';

export function isPlugsNote(note: string): boolean {
  return note.startsWith(PLUGS_NOTE_PREFIX);
}

/**
 * Les lignes « Papiers » et « Prises » SANS profil : les seules qui se rangent sur le voyage.
 * Mêmes règles que pour une personne inconnue (aucune frontière : pas de « Papiers » ; sinon une
 * ligne qui renvoie au service officiel du pays de la personne ; pour les prises, le type du
 * pays, un fait). La table n'est jamais lue. Le lecteur recevra SA ligne (`notesForReader`).
 */
export function sharedNotes(
  countryCode: string | null | undefined,
  countryName: string | null | undefined,
  abroad: boolean | null
): string[] {
  return travelPapers(countryCode, countryName, UNKNOWN_TRAVELLER, abroad, null).notes;
}

/** La seule ligne « Papiers » de `sharedNotes`. */
export function sharedPapersNotes(
  countryCode: string | null | undefined,
  countryName: string | null | undefined,
  abroad: boolean | null
): string[] {
  return sharedNotes(countryCode, countryName, abroad).filter(isPapersNote);
}

/**
 * Les règles SANS profil, pour filtrer les conseils de l'IA avant de les ranger (`keepAiNote`) :
 * filtrer avec celles du lanceur ferait dépendre la présence d'un conseil de sa devise (change) ou
 * de ses appareils (prises), donc la trahirait. Le change est donc écarté en zone euro pour tous,
 * et un conseil sur les prises toujours (la règle les dit, pour chaque lecteur, à la lecture).
 */
export function sharedRules(
  countryCode: string | null | undefined,
  countryName: string | null | undefined,
  abroad: boolean | null
): TravelPapers {
  const rules = travelPapers(countryCode, countryName, UNKNOWN_TRAVELLER, abroad, null);
  return rules.papers == null ? rules : { ...rules, plugs: 'dit' };
}

/**
 * La ligne « Papiers » de CETTE personne, d'après son profil et la table (`find`). Rendue à la
 * lecture seulement (`notesForReader`), jamais rangée : voir l'en-tête du module.
 */
export function readerPapersNotes(
  countryCode: string | null | undefined,
  countryName: string | null | undefined,
  reader: TravellerContext,
  abroad: boolean | null,
  find: (passport: string, destination: string) => EntryRequirement | null
): string[] {
  const entry = entryFor(find, reader.nationality, countryCode, abroad);
  return travelPapers(countryCode, countryName, reader, abroad, entry).notes.filter(isPapersNote);
}

/**
 * La ligne « Prises » de CETTE personne, d'après ses appareils (pays de résidence ; nationalité française sans
 * résidence : la France) : l'adaptateur à prévoir quand ses appareils et le pays n'ont aucune prise en commun, sinon
 * le type de prise du pays si la résidence est inconnue (là où la table ne donne pas le type C). Rendue à la lecture
 * seulement, comme `readerPapersNotes`. Rien quand une prise est en commun, quand c'est son propre pays, ou quand la
 * table ne donne pas le pays.
 */
export function readerPlugsNotes(
  countryCode: string | null | undefined,
  countryName: string | null | undefined,
  reader: TravellerContext
): string[] {
  return travelPapers(countryCode, countryName, reader).notes.filter(isPlugsNote);
}

/** Toute ligne « Courant » (tension, fréquence) commence ainsi : elle dépend du pays de résidence de la personne. */
export function isCurrentNote(note: string): boolean {
  return note.startsWith(CURRENT_NOTE_PREFIX);
}

/** Toute ligne « Change » commence ainsi : elle dépend de la devise ou de la résidence de la personne. */
export function isMoneyNote(note: string): boolean {
  return note.startsWith(CHANGE_NOTE_PREFIX);
}

/**
 * La ligne « Courant » de CETTE personne : la tension ou la fréquence du pays visité diffèrent de chez elle (les
 * deux pays connus de la table). Lecture seule : jamais rangée sur le voyage.
 */
export function readerCurrentNotes(countryCode: string | null | undefined, reader: TravellerContext): string[] {
  const line = currentLineFor(countryCode, deviceCountry(reader));
  return line ? [line] : [];
}

/**
 * La ligne « Change » de CETTE personne : la monnaie du pays visité n'est pas la sienne (sa devise, sinon celle de
 * son pays de résidence). Lecture seule : jamais rangée sur le voyage.
 */
export function readerMoneyNotes(countryCode: string | null | undefined, reader: TravellerContext): string[] {
  const cc = (countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return [];
  const line = changeLineFor(cc, reader);
  return line ? [line] : [];
}

/** D'où vient le départ d'une préparation : lieu dit dans la demande, domicile du profil, position de l'appareil. */
export type AbroadFrom = 'dit' | 'domicile' | 'gps';

/** Ce que le voyage garde pour rendre la ligne de chaque lecteur : le pays visité et le départ, jamais un profil. */
export interface PapersFacts {
  countryCode: string;
  /** Nom du pays tel que la ligne le dit ; null : le code. */
  country: string | null;
  /**
   * Faux : départ déjà dans le pays ; null : on ne sait pas. C'est le départ DE LA PRÉPARATION : s'il vient
   * du domicile ou de la position du lanceur (`abroadFrom`), il ne vaut que pour lui (`abroadForReader`).
   */
  abroad: boolean | null;
  /**
   * D'où vient `abroad`. Absent : voyage préparé avant ce champ, `abroad` s'applique à tous comme avant
   * (limite connue, voir `abroadForReader`).
   */
  abroadFrom?: AbroadFrom;
  /**
   * Le lanceur de la préparation, rangé seulement quand `abroad` vient de son domicile ou de sa position :
   * c'est lui seul qui peut le lire (un collaborateur ne doit pas apprendre où habite le lanceur).
   */
  launchedBy?: string;
}

/**
 * `abroad` tel que CE lecteur peut le connaître. Un départ DIT dans la demande (« depuis Lyon ») est un
 * fait du voyage, le même pour tous. Un départ pris au DOMICILE ou à la POSITION du lanceur n'est le
 * départ que du lanceur : un collaborateur, un lecteur anonyme ou public ne sait pas s'il part du pays
 * visité, et le lui dire (par la présence ou l'absence de sa ligne « Papiers » ou « Formalités ») lui
 * apprendrait si le lanceur y habite : inconnu (null) pour tout autre que lui. Un voyage préparé avant
 * que la source soit rangée (`abroadFrom` absent) garde l'ancien comportement : sa source est inconnue,
 * le rattrapage des données le traite à part.
 */
export function abroadForReader(facts: PapersFacts, viewerId: string | null | undefined): boolean | null {
  if (facts.abroad == null) return null;
  if (facts.abroadFrom !== 'domicile' && facts.abroadFrom !== 'gps') return facts.abroad;
  return viewerId != null && facts.launchedBy != null && viewerId === facts.launchedBy ? facts.abroad : null;
}

/**
 * Les faits à ranger dès que le code pays est valide (les lignes « Papiers » comme « Prises » se
 * rendent à partir d'eux, même quand le voyage n'a gardé aucune ligne « Papiers » : départ déjà
 * dans le pays), sinon null.
 */
export function papersFactsFor(
  countryCode: string | null | undefined,
  countryName: string | null | undefined,
  abroad: boolean | null,
  /** D'où vient le départ et qui a lancé la préparation ; sans départ connu (`from` nul), rien de plus n'est rangé. */
  launch?: { from: AbroadFrom | null; by: string }
): PapersFacts | null {
  const cc = (countryCode ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const facts: PapersFacts = { countryCode: cc, country: countryName || null, abroad };
  if (launch?.from) {
    facts.abroadFrom = launch.from;
    // Le lanceur n'est rangé que pour un départ qui est le sien (domicile, position) : un départ dit est un fait du voyage.
    if (launch.from !== 'dit') facts.launchedBy = launch.by;
  }
  return facts;
}

/**
 * Met les lignes `own` à la place des lignes `is` de `notes` (à la place de la première). Sans ligne rangée : si
 * `after` est donné, `own` va juste après la dernière ligne qui y répond (sinon en tête) ; sans `after`, rien n'est
 * ajouté. `own` vide : les lignes rangées sont seulement retirées.
 */
function putLines(
  notes: string[],
  is: (note: string) => boolean,
  own: string[],
  after?: (note: string) => boolean
): string[] {
  const at = notes.findIndex(is);
  const rest = notes.filter((n) => !is(n));
  if (at >= 0) return [...rest.slice(0, at), ...own, ...rest.slice(at)];
  if (!own.length || !after) return notes;
  let last = -1;
  rest.forEach((n, i) => {
    if (after(n)) last = i;
  });
  return [...rest.slice(0, last + 1), ...own, ...rest.slice(last + 1)];
}

/** Une ligne qui dépend de la personne qui lit (papiers, prises, courant, change). */
const isReaderNote = (note: string) => isPapersNote(note) || isPlugsNote(note) || isCurrentNote(note) || isMoneyNote(note);

/**
 * Les notes rangées sur le voyage, avec les lignes « Papiers », « Prises », « Courant » et « Change » de CE lecteur
 * à la place de celles du voyage. Toute ligne de cette sorte rangée est remplacée (jamais rendue telle quelle : un
 * voyage préparé avant ce verrou peut encore porter la ligne d'une nationalité ou d'appareils d'un autre pays) ;
 * sans ligne rangée, la ligne « Papiers » n'est pas ajoutée (aucune frontière, ou rien à dire) mais les lignes
 * « Prises », « Courant » et « Change », qui ne dépendent que du pays visité et de la personne qui lit, sont
 * rendues juste après les papiers ; sans les faits du pays, tout est retiré plutôt que deviné.
 */
export function notesForReader(
  stored: string[],
  facts: PapersFacts | null,
  reader: TravellerContext,
  find: (passport: string, destination: string) => EntryRequirement | null,
  /** Qui lit : le lanceur est le seul à connaître le départ de sa préparation (`abroadForReader`). */
  viewerId: string | null = null
): string[] {
  const abroad = facts ? abroadForReader(facts, viewerId) : null;
  // Le départ du lanceur était dans le pays visité (son domicile, sa position) : le voyage n'a rangé aucune
  // ligne « Papiers » (aucune frontière POUR LUI). Un autre lecteur ne sait pas d'où il part : sa ligne lui
  // est rendue, en tête, là où la ligne rangée aurait été. Sinon l'absence de ligne dirait où habite le lanceur.
  const unseen = facts != null && facts.abroad === false && abroad !== false && !stored.some(isPapersNote);
  const papers = facts ? readerPapersNotes(facts.countryCode, facts.country, reader, abroad, find) : [];
  const plugs = facts ? readerPlugsNotes(facts.countryCode, facts.country, reader) : [];
  const current = facts ? readerCurrentNotes(facts.countryCode, reader) : [];
  const money = facts ? readerMoneyNotes(facts.countryCode, reader) : [];
  if (!unseen && !papers.length && !plugs.length && !current.length && !money.length && !stored.some(isReaderNote))
    return stored;
  let notes = putLines(stored, isPapersNote, papers);
  if (unseen) notes = [...papers, ...notes];
  notes = putLines(notes, isPlugsNote, plugs, isPapersNote);
  notes = putLines(notes, isCurrentNote, current, (n) => isPapersNote(n) || isPlugsNote(n));
  notes = putLines(notes, isMoneyNote, money, (n) => isPapersNote(n) || isPlugsNote(n) || isCurrentNote(n));
  return notes;
}

const PAPERS_RE = /passeport|carte d[’']identit|\bvisas?\b|e-visa|formalit|autorisation (de voyage|électronique)/i;
const PAPERS_ACRONYM_RE = /\b(ESTA|ETA|eTA|NZeTA|AVE)\b/;
/** Les conseils de change et de prises de l'IA (aussi lus par le script de rattrapage SQL du lot Z1). */
export const MONEY_RE = /bureau de change|taux de change|devises?\b|monnaie locale|changer (de l[’'])?argent|changer (tes |vos |des )?euros|change tes euros|change vos euros/i;
export const PLUG_RE = /adaptateur|prises? (électriques?|de type)/i;

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
