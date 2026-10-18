/**
 * Compas — « Dis-le » en anglais (PLAN-100 6.2), lu sans IA.
 *
 * Le lecteur de règles (`parseIntentRules`) reste français ; ce module lui donne
 * les mots anglais courants (nombres en lettres, compagnie, jours, mois abrégés,
 * prépositions de lieu). Il n'est consulté que lorsque l'interface est en anglais
 * ou que la phrase est sans équivoque anglaise (`looksEnglish`). Fonctions pures,
 * appelées sur le texte « à plat » (minuscules, sans accents), positions gardées.
 *
 * Règle d'or : rien d'inventé. Ce qui reste ambigu (« 10/12 », « with the kids »)
 * n'est pas compris, jamais deviné.
 */

/* ---------- Détection de langue ---------- */

/** Mots qui n'existent qu'en anglais (« in », « the », « of us ») : jamais « ski », « Paris », « solo ». */
const EN_MARKERS = new Set([
  'the',
  'of',
  'us',
  'we',
  "we're",
  "we'd",
  "we'll",
  'i',
  "i'm",
  "i'd",
  "i'll",
  'my',
  'our',
  'with',
  'and',
  'for',
  'from',
  'to',
  'in',
  'at',
  'near',
  'around',
  'across',
  'through',
  'days',
  'day',
  'weeks',
  'week',
  'nights',
  'night',
  'months',
  'month',
  'next',
  'this',
  'tomorrow',
  'today',
  'tonight',
  'leaving',
  'starting',
  'going',
  'trip',
  'people',
  'kids',
  'children',
  'wife',
  'husband',
  'alone',
  'want',
  'like',
  'go',
  'hiking',
  'hike',
  'climbing',
  'cycling',
  'biking',
  'skiing',
  'walking',
  'holiday',
  'vacation',
  'fortnight',
  'adults',
  'friends',
  'under',
  'about',
  'family',
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'january',
  'february',
  'april',
  'june',
  'july',
  'august',
  'october',
  'november',
  'december',
]);

/** Mots-outils français : un seul suffit pour que la phrase ne soit pas « sans équivoque anglaise ». */
const FR_MARKERS = new Set([
  'le',
  'la',
  'les',
  'des',
  'du',
  'de',
  "d'",
  'et',
  'avec',
  'pour',
  'jour',
  'jours',
  'semaine',
  'semaines',
  'nuit',
  'nuits',
  'au',
  'aux',
  'en',
  'dans',
  'depuis',
  'nous',
  'je',
  "j'",
  'mon',
  'ma',
  'mes',
  'un',
  'une',
  'sur',
  'chez',
  'vers',
  'prochain',
  'prochaine',
  'demain',
  'personnes',
  'voyage',
  'rando',
  'randonnee',
  'est',
  'sommes',
  'pars',
  'mois',
  'ce',
  'cette',
  'ou',
  'sans',
  'entre',
  'femme',
  'mari',
  'enfants',
  'amis',
  'vacances',
  'samedi',
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
  "l'",
  'quelques',
  'deux',
  'trois',
  'quatre',
  'cinq',
]);

function plainWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/[^a-z']+/)
    .flatMap((w) => (/^[dlj]'/.test(w) ? [w.slice(0, 2), w.slice(2)] : [w]))
    .filter(Boolean);
}

/**
 * La phrase est-elle sans équivoque anglaise ? Au moins deux mots anglais et AUCUN
 * mot-outil français : une phrase française (même courte, même mêlée de « ski » ou
 * de « trek ») n'est jamais lue en anglais.
 */
export function looksEnglish(text: string): boolean {
  // Un mot en minuscule accentué (« à », « été », « départ ») ou « week-end » : du français.
  // Un nom propre accentué (« the Ardèche », « Céüse ») ne décide pas.
  if (
    /(?:^|[^\p{L}])(?:\p{Ll}*[àâçéèêëîïôûùœ]\p{Ll}*|week-end)(?![\p{L}])/u.test(
      text.normalize('NFC')
    )
  )
    return false;
  let en = 0;
  for (const w of plainWords(text)) {
    if (FR_MARKERS.has(w)) return false;
    if (EN_MARKERS.has(w)) en += 1;
  }
  return en >= 2;
}

/* ---------- Nombres en lettres ---------- */

const EN_UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const UNIT_RE = Object.keys(EN_UNITS)
  .sort((a, b) => b.length - a.length)
  .join('|');
const EN_NUMBER = new RegExp(
  `\\b(?:(${Object.keys(EN_TENS).join('|')})(?:[- ](${UNIT_RE}))?|(${UNIT_RE}))\\b`,
  'g'
);

/** « three days » → « 3     days », « twenty-one » → « 21 » : chiffres complétés d'espaces, positions gardées. */
export function spellNumbersEn(plain: string): string {
  return plain.replace(EN_NUMBER, (whole: string, tens?: string, unit?: string, alone?: string) => {
    const n = tens
      ? EN_TENS[tens] + (unit && EN_UNITS[unit] < 10 ? EN_UNITS[unit] : 0)
      : EN_UNITS[alone ?? ''];
    // « twenty eleven » n'est pas un nombre : seule la dizaine est lue.
    if (tens && unit && EN_UNITS[unit] >= 10)
      return String(EN_TENS[tens]).padEnd(tens.length) + whole.slice(tens.length);
    return String(n).padEnd(whole.length);
  });
}

/* ---------- Vocabulaire des règles ---------- */

export const EN_WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Mois abrégés anglais (« Oct 12 », « 3 Aug ») ; les mots entiers sont déjà lus par les règles. */
export const EN_MONTH_ABBR = 'jan\\.?|feb\\.?|mar\\.?|apr\\.?|jun\\.?|jul\\.?|aug\\.?|sept?\\.?';

/** Jamais une destination à eux seuls : jours, saisons, fêtes, moments. */
const EN_NOT_PLACE =
  /^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|summer|winter|spring|autumn|fall|christmas|xmas|easter|thanksgiving|new year'?s?(?: eve)?|weekend|today|tomorrow|tonight|morning|afternoon|evening|jan|feb|mar|apr|jun|jul|aug|sep|sept)$/;

export function notAPlaceEn(plainName: string): boolean {
  return EN_NOT_PLACE.test(plainName.trim().replace(/\.$/, ''));
}

/** Fin d'un nom de lieu en anglais : un mot qui ouvre une autre idée (insensible à la casse). */
export const PLACE_END_EN =
  /\s(?:in|on|at|with|by|as|and|or|next|this|tomorrow|today|tonight|leaving|starting|departing|arriving|returning|during|over|under|about|around|budget|then|via|near|before|after|hiking|hike|trekking|trek|skiing|climbing|biking|cycling|kayaking|camping|road|trip|holiday|vacation|getaway|we|i|my|our|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|may|june|july|august|september|october|november|december|summer|winter|spring|autumn|christmas|easter|half|an)(?=[\s,-]|$)/i;

/** Nom commun en minuscule après un nom propre (« the Atlas mountains », « the Ardèche river ») : sensible à la casse. */
export const PLACE_TAIL_EN =
  /\s(?:mountains?|river|valley|region|area|coast|national park|lakes?|forest|countryside|hills)(?=[\s,.;!?-]|$)/;

/** Fin d'un lieu de départ anglais (« from Lyon to Annecy », « from Paris via Dijon »). */
export const ORIGIN_END_EN = /\s(?:to|towards?|via|then|or|and|through)(?=[\s-]|$)/i;

/** Ce qui annonce le départ (texte « plain ») : « from Lyon », « leaving from Geneva », « starting from Oxford ». */
export const ORIGIN_LEAD_EN =
  /(?:^|[\s,(])(?:(?:leaving|starting|departing|setting off|flying) )?from\s+/g;

/** Prépositions de destination (texte « plain »), après les françaises. */
export const DEST_LEAD_EN =
  '(?:to the|to|around the|around|across the|across|through the|through|near|close to|visiting|visit|exploring|explore|on the|on|along the|at)';

/** Premiers mots anglais capitalisés qui ne sont jamais un nom de lieu (« I'm », « We », « Leaving »…). */
const EN_STOP_LEAD =
  /^(?:i|i'm|i'd|i'll|i've|we|we're|we'd|we'll|my|our|the|a|an|and|but|or|so|it|it's|this|that|there|leaving|starting|going|arriving|looking|planning|hoping|want|would|could|please|just|me|you|he|she|they|hi|hello|thanks|ideally|maybe|probably|budget|also|family|solo|weekend|day|half|one|two|three|road|city|van|honeymoon|summer|winter|spring|autumn|fall|week|weekend|trip|hiking|hike|trek|trekking|ski|skiing)$/i;

export function enStopLead(name: string): boolean {
  return EN_STOP_LEAD.test(name.split(/[\s-]/)[0]);
}

/* ---------- Activités et nuits ---------- */

/** Mots anglais ajoutés aux activités du lecteur (même ordre, du plus précis au plus large). */
export const ACTIVITY_EN: Record<string, string> = {
  ski: 'snowboard|snowboarding|snowshoes?|ski touring',
  climbing: 'climb|rock climbing|boulder',
  cycling: 'cycle|mtb|bicycle|mountain biking|bikes',
  water: 'kayaks|sail|canoe trip|white ?water',
  vanlife: 'campervan|camper van|rv|motorhome',
  citytrip: 'city break',
  beach: 'beaches',
  hiking: 'hikes|hiked|walking|walk|hut to hut',
  cultural: 'museums?|cultural',
};

export const NIGHTS_EN = {
  bivouac: /\b(?:tent|wild ?camp(?:ing)?)\b/,
  refuge: /\b(?:huts?|mountain huts?)\b/,
  hebergement: /\b(?:hostels?|b&b|inns?|lodges?)\b/,
};

/* ---------- Groupe ---------- */

/** Une personne de plus (« with my wife »). */
const ONE =
  /^(?:wife|husband|partner|spouse|girlfriend|boyfriend|fiancee?|friend|buddy|mate|brother|sister|son|daughter|mom|mum|mother|dad|father|kid|child|baby|toddler|teen|teenager|colleague|cousin|grandma|grandpa|grandmother|grandfather)$/;
/** Pluriels qui ne disent pas combien sans nombre (« with friends »). */
const MANY =
  /^(?:friends|kids|children|sons|daughters|brothers|sisters|teens|teenagers|babies|toddlers|colleagues|cousins|buddies|mates|people|others|family|guys|girls)$/;
/** Deux personnes, dites telles (« my parents »). */
const TWO = /^(?:parents|grandparents)$/;

/**
 * « with my wife », « with my husband and 2 kids », « with 3 friends » : moi et ceux
 * qui viennent. `undefined` : rien dit ; `null` : dit sans nombre sûr (« with the kids »,
 * « with a guide ») — le groupe reste alors non compris.
 */
export function companionsParty(plain: string): number | null | undefined {
  const m = /\bwith\s+([^,.;!?]+)/.exec(plain);
  if (!m) return undefined;
  const clause = m[1].split(
    /\s(?:for|in|to|from|on|at|leaving|starting|next|this|under|budget|near|around|during|\d+\s*(?:days?|nights?|weeks?))\b/
  )[0];
  let extra = 0;
  for (const raw of clause.split(/\s+and\s+|\s*&\s*|\s+plus\s+/)) {
    const seg =
      /^(?:(?:my|our|a|an|the|his|her|some)\s+)?(?:(\d{1,2})\s+)?(?:(?:little|young|small|best|teenage|two|older|younger)\s+)?([a-z']+)$/.exec(
        raw.trim()
      );
    if (!seg) return null;
    const n = seg[1] ? Number(seg[1]) : null;
    const word = seg[2];
    if (ONE.test(word)) extra += n ?? 1;
    else if (TWO.test(word)) extra += n ?? 2;
    else if (MANY.test(word) && n) extra += n;
    else return null;
  }
  return extra > 0 ? 1 + extra : null;
}

/* ---------- Dates ---------- */

/**
 * « 25/12 » (jour/mois) ou « 12/25 » (mois/jour) : seul l'ordre qui existe est lu.
 * « 10/12 » se lit des deux façons (10 décembre au Royaume-Uni, 12 octobre aux
 * États-Unis) : `null`, la date n'est pas devinée.
 */
export function slashOrderEn(a: number, b: number): [day: number, month: number] | null {
  if (a === b) return [a, b];
  if (a > 12 && b <= 12) return [a, b];
  if (b > 12 && a <= 12) return [b, a];
  return null;
}

/** Fêtes dites en anglais (« Christmas in Lapland ») ; « Easter Island » n'est pas Pâques. */
export const HOLIDAYS_EN: Array<[RegExp, 'christmas' | 'easter' | 'newyear']> = [
  [/\b(?:christmas|xmas)\b/, 'christmas'],
  [/\beaster\b(?!\s+island)/, 'easter'],
  [/\bnew year'?s?(?: eve)?\b/, 'newyear'],
];
