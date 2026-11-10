/**
 * Compas v6 — adaptateurs entre le Brief et le moteur actuel (ADR-V6-001 §3.6, tâche T1.7).
 *
 *   règles (actions) ──► Brief            `actionsToBrief`
 *   réglages du voyage ─► Brief verrouillé `settingsToBrief`
 *   Brief ──► entrée de `buildTripContext` `briefToTripContextInput`
 *   Brief ──► préférences (`metadata.compas.prefs`) `briefToPreferences`
 *
 * Module PUR : aucune I/O, pas de `Date.now`, même entrée → même sortie, aucune entrée
 * modifiée. Rien n'est branché : ce fichier n'est lu par personne tant que T1.7 n'a pas lieu.
 *
 * Passages de la phrase. Les actions rendues par `parseIntentRules` ne portent PAS le passage
 * qui les justifie (`intentActionSchema` n'a aucun champ de passage ; `groundingIssue` rend un
 * texte d'erreur, jamais une position). `actionsToBrief` le retrouve donc ici, de façon
 * déterministe, dans la phrase d'origine (celle de la personne, pas la réécriture en anglais des
 * règles es/de/it), et ne marque 'dit' que si le passage est trouvé, cohérent avec la valeur de
 * l'action, et vérifié par `evidenceInPhrase`. Sinon : 'deduit', confiance 0,7, sans passage.
 */
import type { CompasPreferences } from '../compasModel';
import { COMPAS_ACTIVITIES, type CompasActivity, type CompasIntentAction } from '../intent';
import type { TripContextInput } from '../tripContext';
import { MAX_TRIP_DAYS as MAX_DAYS_LOCKED } from '../tripContext';
import {
  briefForStorage,
  briefPaths,
  briefSchema,
  derive,
  emptyBrief,
  emptyValue,
  evidenceInPhrase,
  getValue,
  lockValue,
  valueInEvidence,
  withValue,
  type Brief,
  type BriefPath,
  type BriefValue,
} from './schema';

type AnyValue = BriefValue<unknown>;

/** Confiance d'une valeur lue par les règles avec son passage. */
export const CONFIDENCE_RULES_SAID = 0.9;
/** Confiance d'une valeur que les règles ont calculée sans passage retrouvé. */
export const CONFIDENCE_RULES_DEDUCED = 0.7;

/** Plafond de durée appliqué à une durée DITE par la phrase (`planApplication`, intent.ts `MAX_TRIP_DAYS`). */
const MAX_DAYS_SAID = 30;

/* ------------------------------------------------------------------------------------------ */
/* Outils de recherche de passage                                                              */
/* ------------------------------------------------------------------------------------------ */

const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
/** Expression globale, insensible à la casse, avec bornes de mot Unicode. */
const rx = (src: string) => new RegExp(`${B}(?:${src})${E}`, 'giu');

/** Nombres écrits en lettres (fr, en, es, de, it) et en chiffres. */
const NUM_WORDS: Readonly<Record<string, number>> = {
  un: 1, une: 1, uno: 1, una: 1, ein: 1, eine: 1, einer: 1, einen: 1, einem: 1, one: 1,
  deux: 2, two: 2, dos: 2, zwei: 2, due: 2, zweit: 2,
  trois: 3, three: 3, tres: 3, drei: 3, tre: 3, dritt: 3,
  quatre: 4, four: 4, cuatro: 4, vier: 4, quattro: 4, viert: 4,
  cinq: 5, five: 5, cinco: 5, fünf: 5, cinque: 5, fünft: 5,
  six: 6, seis: 6, sechs: 6, sei: 6, sechst: 6,
  sept: 7, seven: 7, siete: 7, sieben: 7, sette: 7, siebt: 7,
  huit: 8, eight: 8, ocho: 8, acht: 8, otto: 8,
  neuf: 9, nine: 9, nueve: 9, neun: 9, nove: 9,
  dix: 10, ten: 10, diez: 10, zehn: 10, dieci: 10,
  onze: 11, eleven: 11, once: 11, elf: 11, undici: 11,
  douze: 12, twelve: 12, doce: 12, zwölf: 12, dodici: 12,
  quinze: 15, fifteen: 15, quince: 15, fünfzehn: 15, quindici: 15,
  vingt: 20, twenty: 20, veinte: 20, zwanzig: 20, venti: 20,
  trente: 30, thirty: 30, treinta: 30, dreißig: 30, trenta: 30,
};
const NUMW = `\\d+(?:[.,]\\d+)?|${Object.keys(NUM_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|')}`;

function numberOf(token: string): number | null {
  const t = token.toLowerCase();
  if (t in NUM_WORDS) return NUM_WORDS[t];
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Texte sans accents ni casse, avec la position de chaque signe dans le texte d'origine. */
function foldWithMap(s: string): { text: string; starts: number[]; ends: number[] } {
  let text = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  for (const ch of s) {
    const base = ch.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
    for (let k = 0; k < base.length; k += 1) {
      starts.push(i);
      ends.push(i + ch.length);
    }
    text += base;
    i += ch.length;
  }
  return { text, starts, ends };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Position (dans la phrase d'origine) du premier passage qui dit ce nom, sans tenir compte de la casse ni des accents. */
function locateName(src: string, name: string): { from: number; to: number } | null {
  const needle = foldWithMap(name.normalize('NFC')).text;
  const tokens = needle.split(/[\s'’`\-.,;:]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const folded = foldWithMap(src);
  const re = new RegExp(`${B}${tokens.map(escapeRe).join("[\\s'’`\\-.,;:]+")}${E}`, 'u');
  const m = re.exec(folded.text);
  if (!m) return null;
  return { from: folded.starts[m.index], to: folded.ends[m.index + m[0].length - 1] };
}

/** Passage exact (sous-chaîne de la phrase) vérifié par `evidenceInPhrase`, sinon null. */
function checked(src: string, from: number, to: number, phrase: string): string | null {
  const passage = src.slice(from, to).trim();
  return passage && evidenceInPhrase(passage, phrase) ? passage : null;
}

function firstMatch(
  src: string,
  re: RegExp,
  accept?: (m: RegExpExecArray) => boolean
): { text: string; index: number } | null {
  re.lastIndex = 0;
  for (const m of src.matchAll(re)) {
    if (!accept || accept(m as RegExpExecArray)) return { text: m[0], index: m.index ?? 0 };
  }
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* Lexiques (fr, en, es, de, it)                                                               */
/* ------------------------------------------------------------------------------------------ */

const MONTH = [
  'janvier|janv\\.?|février|fevrier|févr?\\.?|mars|avril|avr\\.?|mai|juin|juillet|juil\\.?|août|aout|septembre|sept\\.?|octobre|oct\\.?|novembre|nov\\.?|décembre|decembre|déc\\.?',
  'january|jan\\.?|february|feb\\.?|march|mar\\.?|april|apr\\.?|may|june|jun\\.?|july|jul\\.?|august|aug\\.?|september|sep\\.?|october|november|december|dec\\.?',
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre',
  'januar|februar|märz|maerz|juni|juli|oktober|dezember',
  'gennaio|febbraio|aprile|maggio|giugno|luglio|settembre|ottobre|dicembre',
].join('|');
const QUALIFIER =
  '(?:(?:fin|début|debut|mi|milieu|early|late|mid|end of|beginning of|principios de|finales de|mediados de|fine|inizio|ende|anfang|mitte)[- ]+(?:de |of |d\'|d’)?)?';
const ORD = '(?:er|st|nd|rd|th|\\.|º)?';
const TO = '(?:au|al|a|to|until|till|through|thru|bis zum|bis|hasta el|hasta|fino al|fino a|-|–|->)';

const DATE_PATTERNS: RegExp[] = [
  rx('\\d{4}-\\d{2}-\\d{2}(?:\\s*(?:au|al|a|to|bis|-|–|->)\\s*\\d{4}-\\d{2}-\\d{2})?'),
  rx(`\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?(?:\\s*${TO}\\s*\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)?`),
  rx(
    `(?:(?:du|from|vom|dal|del|desde el|von)\\s+)?(?:the\\s+)?\\d{1,2}${ORD}(?:\\s+(?:de |of |d'|d’)?(?:${MONTH}))?\\s*${TO}\\s*(?:the\\s+)?\\d{1,2}${ORD}\\s+(?:de |of |d'|d’)?(?:${MONTH})(?:\\s+\\d{4})?`
  ),
  rx(`(?:from\\s+)?(?:${MONTH})\\s+\\d{1,2}${ORD}(?:\\s*${TO}\\s*(?:(?:${MONTH})\\s+)?\\d{1,2}${ORD})?`),
  rx(`\\d{1,2}${ORD}\\s+(?:de |of |d'|d’)?(?:${MONTH})(?:\\s+\\d{4})?`),
];
const MONTH_ONLY = rx(`${QUALIFIER}(?:${MONTH})(?:\\s+\\d{4})?`);

const DAY_U = 'jours?|j|journées?|journee|days?|d[ií]as?|jornadas?|tage?n?|tag|giorni|giorno|giornata|giornate';
const NIGHT_U = 'nuits?|nights?|noches?|nächte|nacht|notti|notte';
const WEEK_U = 'semaines?|weeks?|semanas?|wochen?|settimane|settimana';
const MONTH_U = 'mois|months?|mes(?:es)?|monate?n?|mesi|mese';
const FORT_U = 'fortnights?|quinzaines?|quincena';
const HALF = '(?:\\s+(?:et demie?|and a half|y media|und eine halbe|e mezza))?';
const DURATION_N = rx(`(?:${NUMW}|a|an)\\s*-?\\s*(?:${DAY_U}|${NIGHT_U}|${WEEK_U}|${MONTH_U}|${FORT_U})${HALF}`);
/** Durées que les règles lisent sans nombre dit, par nombre de jours. */
const LONE_DURATION: Readonly<Record<number, RegExp>> = {
  1: rx('day[- ](?:hike|trip|walk|tour|out)|tages\\p{L}*|[àa] la journ[ée]e|journ[ée]e|jornada|giornata'),
  7: rx("semaine|settimana|semana|woche|week"),
  14: rx('quinzaine|fortnight|quincena'),
  30: rx('mois|month|mes|monat|mese'),
};
const WEEKEND = rx('week[- ]?end|fin de semana|wochenende|fine settimana');
const HALF_DAY = rx('demi-journ[ée]e|half[- ]?(?:a[- ])?day|media jornada|halber tag|halbtag|mezza giornata');
const HOURS_H = rx('(\\d{1,2})\\s*h(?:eures?)?(?:\\s*(\\d{2}))?');
const HOURS_W = rx(`(?:${NUMW})\\s*(?:heures?|hours?|hrs?|horas?|stunden?|ore|ora)${HALF}`);

const PERSON_NOUNS =
  'personnes?|pers|randonneurs?|adultes?|amis|amies|copains|copines|potes|participants|voyageurs?|people|persons|friends|adults|hikers|travell?ers|of us|personas|adultos|amigos|amigas|personen|erwachsene|freund\\p{L}*|menschen|leute|gente|gens|persone|adulti|amici|amiche|enfants?|kids?|children|teenagers|kinder\\p{L}*|ni[ñn]os|hijos|bambini|figli|compagni';
const NOT_PERSON_UNIT =
  'jours?|j|h|heures?|nuits?|km|kilos?|kg|g|m|metres?|€|euros?|eur|semaines?|mois|min|%|ans|days?|nights?|weeks?|tage?n?|noches?|d[ií]as?|giorni|notti';

const SOLO = rx('seul|seule|en solo|solo|solitaire|en solitaire|solitari[oa]|alone|by myself|on my own|allein|alleine|sola|da sola|da solo|a solas|sin compañía|tutto solo');
const DUO = rx(
  'à deux|nous deux|en couple|en duo|couple|duo|just the two of us|the two of us|two of us|zu zweit|als paar|a dos|los dos|en pareja|in due|in coppia|noi due|nosotros dos|pareja'
);
const WITH_PARTNER = rx(
  "(?:avec|with|con|mit|insieme a)\\s+(?:mon|ma|ta|my|mi|mein|meine|il mio|la mia|mia|mio)\\s+(?:femme|mari|chéri\\p{L}*|copine|copain|conjoint\\p{L}*|compagn\\p{L}*|épouse|wife|husband|girlfriend|boyfriend|partner|esposa|esposo|marido|mujer|novi[oa]|pareja|frau|mann|freund\\p{L}*|partner\\p{L}*|moglie|marito|ragazza|ragazzo)"
);
const PARTY_COUNTED = rx(
  `(?:(?:avec|with|con|mit)\\s+)?(?:(?:nos?|mes?|ses?|les|our|my|the|mis|nuestros?|los|las|unsere?|meine?|die|miei|nostri|i|gli|le)\\s+)?(?:${NUMW})\\s+(?:${PERSON_NOUNS})`
);
const PARTY_LEAD = rx(
  `(?:à|pour|on est|on sera|nous sommes|nous serons|groupe de|famille de|we are|we're|we'll be|party of|group of|family of|for|somos|vamos|seremos|wir sind|siamo|saremo|andiamo|familia de|gruppo di|gruppe von|zu)\\s+(?:in\\s+)?(?:${NUMW})(?!\\s*(?:${NOT_PERSON_UNIT})${E})`
);
const PARTY_COMPOSITE = new RegExp(
  `${B}(?:avec|with|con|mit)?\\s*(?:(?:${NUMW})\\s+\\p{L}+(?:\\s*(?:,|et|and|y|und|e|&|\\+)\\s*(?:${NUMW})\\s+\\p{L}+)+)`,
  'giu'
);

const CAR_FREE = rx(
  'sans voiture|sans véhicule|car[- ]?free|without (?:a )?car|no car|sin (?:coche|auto|carro)|ohne auto|autofrei|senza (?:auto|macchina)'
);
const PER_PERSON = rx(
  'par personne|par pers\\.?|per person|per head|each|por persona|pro person|a persona|par tête|p\\.p\\.|/\\s*pers\\w*'
);
const DISTANCE = rx('(\\d{1,3}(?:[.,]\\d)?)\\s*(?:km|kilom[èe]tre?s?|kilomet\\p{L}*)');
const PER_DAY =
  /^\s*(?:par jour|par j\b|\/\s*(?:jour|j)\b|per day|a day|\/\s*day|chaque jour|por d[ií]a|al d[ií]a|pro tag|am tag|\/\s*tag|al giorno|per giorno|quotidien\p{L}*)/iu;
const WEIGHT = rx('(?:\\d+(?:[.,]\\d+)?)\\s*(?:kg|kilos?|kilogrammes?|kilograms?|chili)');
const OUTDOOR_NIGHTS = rx(`(?:\\d+)\\s*(?:${NIGHT_U})(?:\\s+\\p{L}+){0,2}`);
const MONEY = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:[€$£¥]\\s*)?\\d[\\d\\s.,\\u202f\\u00a0]*\\d?(?:\\s?k)?\\s*(?:€|\\$|£|¥|euros?|eur|usd|dollars?|gbp|livres?|pounds?|chf|francs?|cad|pesos?|yen)?`,
  'giu'
);

const PACE_WORDS: Record<'tranquille' | 'normal' | 'soutenu', RegExp> = {
  tranquille: rx(
    'tranquille(?:ment)?|doucement|cool|calme|pépère|pepere|lent(?:ement)?|relax\\p{L}*|slow\\p{L}*|easy|gentle|leisurely|tranquil[oa]|despacio|lento|gem[üu]tlich|entspannt|langsam|ruhig|piano|calmo'
  ),
  normal: rx('normal|moyen|steady|medio|mittel\\p{L}*|regular|normale'),
  soutenu: rx('soutenu|sportif|rapide|intense|fast|brisk|r[áa]pido|sportivo|z[üu]gig|schnell|sportlich|veloce|intenso'),
};
const NIGHT_WORDS: Record<'bivouac' | 'refuge' | 'hebergement' | 'mixte', RegExp> = {
  hebergement: rx(
    'h[ée]bergements?|h[ôo]tels?|g[îi]tes?|chambres?|auberges?|airbnb|hostel\\p{L}*|lodging|accommodation|alojamiento|unterkunft|albergo|alloggio|pension|b&b'
  ),
  bivouac: rx(
    'bivouac\\p{L}*|bivy|wild[- ]?camp\\p{L}*|belle [ée]toile|vivac\\p{L}*|biwak\\p{L}*|acampada libre|sous tente|tente|tent|tienda|tenda|zelt\\p{L}*|camping|acampada|campeggio|dehors|camper'
  ),
  refuge: rx('refuges?|huts?|hütten?|rifugi?o?|cabañas?'),
  mixte: rx('mixtes?|mixed|mix|gemischt|mistas?'),
};
const LEVEL_WORDS: Record<'debut' | 'regulier' | 'aguerri', RegExp> = {
  debut: rx(
    'débutant\\p{L}*|debutant\\p{L}*|beginner\\p{L}*|novice\\p{L}*|première fois|premiere fois|primera vez|anfänger\\p{L}*|principiante\\p{L}*|erste[sn]? mal|prima volta|first time'
  ),
  regulier: rx('intermédiaire|intermediaire|r[ée]gulier|intermediate|intermedio|average'),
  aguerri: rx(
    'aguerri\\p{L}*|confirmé\\p{L}*|confirme\\p{L}*|expert\\p{L}*|experienced|erfahren\\p{L}*|experto|esperto|advanced|avanzad[oa]|fortgeschritten\\p{L}*|avanzato'
  ),
};
const TERRAIN_WORDS: Record<'sentier' | 'montagne' | 'hors_sentier' | 'itinerance' | 'urbain_transit', RegExp> = {
  hors_sentier: rx('hors[- ]sentier|off[- ]trail|sin sendero|pfadlos|fuori sentiero|wegelos'),
  sentier: rx('sentiers?|trails?|paths?|senderos?|pfad\\p{L}*|sentiero|wege?'),
  montagne: rx('montagne\\p{L}*|mountain\\p{L}*|altitude|sommets?|monta[ñn]a\\p{L}*|berg\\p{L}*|montagna|alpin\\p{L}*|summit|cima|gipfel'),
  itinerance: rx('itin[ée]rance|itinerant\\p{L}*|itinerante?'),
  urbain_transit: rx('transit|correspondance|layover'),
};

const ACTIVITY_WORDS: Record<CompasActivity, RegExp> = {
  hiking: rx('rando\\p{L}*|hik\\p{L}*|walk\\p{L}*|senderis\\p{L}*|caminata\\p{L}*|excursi\\p{L}*|wander\\p{L}*|escursion\\p{L}*|balades?|promenades?|marche|à pied|on foot|a pie|a piedi|zu fu[ßs]|ruta|sentier|sentiero|sendero|stroll\\p{L}*|passeggiat\\p{L}*|camminat\\p{L}*'),
  trekking: rx('trek\\p{L}*|trekking|gr ?\\d+|alta via|camino|cammino|backpacking|tour (?:du|de|des|of|di)'),
  bivouac: rx('bivouac\\p{L}*|bivy|wild[- ]?camp\\p{L}*|vivac\\p{L}*|biwak\\p{L}*|acampada libre|acampar'),
  roadtrip: rx('road ?trip\\p{L}*|viaje por carretera|en voiture|viaje en coche|rundreise|autotour|viaggio in auto|mietwagen|road-trip'),
  cultural: rx('cultur\\p{L}*|mus[ée]es?|museum\\p{L}*|museo|patrimoine|heritage|kultur\\p{L}*|visites?|sightseeing'),
  bushcraft: rx('bushcraft|survie|survival|supervivencia|überleben|sopravvivenza'),
  mixed: rx('mixte|mixed|multi-?activit\\p{L}*'),
  cycling: rx('v[ée]lo\\p{L}*|cycl\\p{L}*|bike|biking|bikepacking|bici\\p{L}*|fahrrad\\p{L}*|radtour\\p{L}*|vtt|gravel|bicicletta|rad|bicyclette'),
  ski: rx('ski\\p{L}*|esqu[íi]|esqui|snowboard\\p{L}*|splitboard\\p{L}*|sci|sciare|skitour\\p{L}*|esquiar|settimana bianca'),
  mountaineering: rx('alpinisme|mountaineering|alpinismo|bergsteig\\p{L}*|alpinist\\p{L}*|ascension\\p{L}*|ascensi[óo]n|besteigung|alpinismo'),
  climbing: rx('escalade|climb\\p{L}*|escalada|escalar|klettern|bouldern|boulder|bloc|besteig\\p{L}*|salire|scalare|arrampicata|grimp\\p{L}*|via ferrata'),
  water: rx('kayak\\p{L}*|cano[ëe]\\p{L}*|paddl\\p{L}*|kanu|surf\\p{L}*|raft\\p{L}*|voile|sail\\p{L}*|vela|segeln|navigation|plong[ée]e|diving|buceo|tauchen|snorkel\\p{L}*|wakeboard\\p{L}*|kitesurf\\p{L}*|windsurf\\p{L}*|canyoning|stand[- ]?up'),
  citytrip: rx('city ?trip\\p{L}*|city break|escapade urbaine|städtereise|ciudad|città|stadt|ville'),
  beach: rx('plages?|beach\\p{L}*|playas?|strand\\p{L}*|al mare|mare|farniente|spiagg\\p{L}*|baignade'),
  vanlife: rx('vanlife|van|furgoneta|furgone|kastenwagen|camping-car|campervan|motorhome|camper|wohnmobil|autocaravana'),
  running: rx('course [àa] pied|running|jogging|footing|courir|run|correr|laufen|joggen|correre|marathon|semi-marathon'),
  trail: rx('trail running|ultra-?trail|trail|ultra|carrera de monta[ñn]a|trailrun\\p{L}*|berglauf'),
};

/* ------------------------------------------------------------------------------------------ */
/* Contrôle d'une valeur avant de l'écrire dans le Brief                                       */
/* ------------------------------------------------------------------------------------------ */

function leafSchema(path: BriefPath) {
  const [block, key] = path.split('.') as [string, string];
  const shape = briefSchema.shape as unknown as Record<string, { shape: Record<string, { safeParse(v: unknown): { success: boolean } }> }>;
  return shape[block].shape[key];
}

const said = (value: unknown, evidence: string): AnyValue => ({
  value,
  source: 'dit',
  confidence: CONFIDENCE_RULES_SAID,
  evidence,
  locked: false,
  prive: false,
});

/** Valeur calculée par les règles sans passage retrouvé : honnêtement 'deduit', sans passage. */
const deduced = (value: unknown): AnyValue => derive(value, [], CONFIDENCE_RULES_DEDUCED);

interface Found {
  value: unknown;
  /** Passage retrouvé dans la phrase, ou null. */
  evidence: string | null;
}

/* ------------------------------------------------------------------------------------------ */
/* actionsToBrief                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** Table de correspondance action → variables du Brief (documentation exécutable, testée). */
export const ACTION_TO_PATHS: Readonly<Record<CompasIntentAction['type'], readonly BriefPath[]>> = {
  set_dates: ['quand.dateDebut', 'quand.dateFin', 'quand.mois'],
  set_duration: ['quand.jours', 'quand.heures'],
  set_party_size: ['qui.personnes'],
  set_budget: ['budget.enveloppe', 'budget.devise', 'budget.base'],
  set_pace: ['effort.rythme'],
  set_nights: ['nuits.type'],
  set_activity: ['projet.activite'],
  avoid: ['ou.aEviter'],
  wish: ['ou.envies'],
  add_item: ['materiel.possedeDit'],
  search_route: [],
  set_destination: ['ou.destination', 'projet.itineraireNomme'],
  set_origin: ['ou.depart'],
  set_outdoor_nights: ['nuits.nuitsDehors'],
  set_max_pack: ['materiel.poidsViseKg'],
  set_car_free: ['transport.sansVoiture'],
  set_distance: ['effort.kmParJour', 'effort.kmTotal'],
  set_level: ['qui.niveau'],
  set_terrain: ['effort.terrain'],
};

/** Jours que dit un passage de durée (« 2 semaines » → 14), pour vérifier qu'il correspond à l'action. */
function daysOfPassage(passage: string): number | null {
  const m = new RegExp(`^(${NUMW}|a|an)\\s*-?\\s*(\\p{L}+)(?:\\s+(et demie?|and a half|y media|und eine halbe|e mezza))?$`, 'iu').exec(
    passage.trim()
  );
  if (!m) return null;
  const n = m[1].toLowerCase() === 'a' || m[1].toLowerCase() === 'an' ? 1 : numberOf(m[1]);
  if (n == null || n <= 0) return null;
  const half = m[3] ? 0.5 : 0;
  const unit = m[2].toLowerCase();
  if (new RegExp(`^(?:${NIGHT_U})$`, 'iu').test(unit)) return Math.round(n + 1);
  if (new RegExp(`^(?:${WEEK_U})$`, 'iu').test(unit)) return Math.round(Math.floor((n + half) * 7));
  if (new RegExp(`^(?:${MONTH_U})$`, 'iu').test(unit)) return Math.round(Math.round((n + half) * 30));
  if (new RegExp(`^(?:${FORT_U})$`, 'iu').test(unit)) return Math.round(Math.floor((n + half) * 14));
  if (new RegExp(`^(?:${DAY_U})$`, 'iu').test(unit)) return Math.round(n);
  return null;
}

function findDays(src: string, phrase: string, days: number): string | null {
  const m = firstMatch(src, DURATION_N, (x) => daysOfPassage(x[0]) === days);
  if (m) return checked(src, m.index, m.index + m.text.length, phrase) ?? null;
  if (days === 2) {
    const w = firstMatch(src, WEEKEND);
    if (w) return checked(src, w.index, w.index + w.text.length, phrase);
  }
  // Une durée dite sans nombre (« semaine de ski », « Tagesausflug », « day hike »).
  const lone = LONE_DURATION[days];
  if (lone) {
    const w = firstMatch(src, lone);
    if (w) return checked(src, w.index, w.index + w.text.length, phrase);
  }
  return null;
}

function findHours(src: string, phrase: string, hours: number): string | null {
  const h = firstMatch(src, HOURS_H, (x) => {
    const v = Number(x[1]) + (x[2] ? Number(x[2]) / 60 : 0);
    return Math.abs(Math.round(v * 4) / 4 - hours) < 0.01;
  });
  if (h) return checked(src, h.index, h.index + h.text.length, phrase);
  const w = firstMatch(src, HOURS_W, (x) => {
    const n = numberOf(/^[^\s]+/.exec(x[0])![0]);
    return n != null && Math.abs(n + (/(demie?|half|media|halbe|mezza)/i.test(x[0]) ? 0.5 : 0) - hours) < 0.01;
  });
  if (w) return checked(src, w.index, w.index + w.text.length, phrase);
  if (hours === 4) {
    const d = firstMatch(src, HALF_DAY);
    if (d) return checked(src, d.index, d.index + d.text.length, phrase);
  }
  return null;
}

/** Jours-nombres d'un passage de date (années à quatre chiffres exclues). */
function dayNumbers(passage: string): number[] {
  return (passage.match(/\d+/g) ?? []).filter((d) => d.length <= 2).map(Number);
}

function findDatePassage(src: string, phrase: string, start: string, end: string | null) {
  const startDay = Number(start.slice(8, 10));
  const endDay = end ? Number(end.slice(8, 10)) : null;
  for (const re of DATE_PATTERNS) {
    const m = firstMatch(src, re, (x) => {
      const nums = dayNumbers(x[0]);
      return nums.includes(startDay) || (x[0].includes('-') && x[0].includes(start));
    });
    if (m) {
      const passage = checked(src, m.index, m.index + m.text.length, phrase);
      if (passage) {
        const nums = dayNumbers(passage);
        const rangeEnd = endDay != null && nums.length >= 2 && nums.includes(endDay);
        const isoEnd = end != null && passage.includes(end);
        return { passage, endSaid: rangeEnd || isoEnd };
      }
    }
  }
  return null;
}

function findMonthPassage(src: string, phrase: string, month: number): string | null {
  const m = firstMatch(src, MONTH_ONLY, (x) => valueInEvidence('quand.mois', month, x[0]) === 'oui');
  return m ? checked(src, m.index, m.index + m.text.length, phrase) : null;
}

/** Nombre de personnes que dit un passage, avec les lectures des règles (« avec 5 amis » = 6). */
function findParty(src: string, phrase: string, count: number): string | null {
  const ok = (m: { text: string; index: number } | null) =>
    m ? checked(src, m.index, m.index + m.text.length, phrase) : null;
  if (count === 1) {
    const p = ok(firstMatch(src, SOLO));
    if (p) return p;
  }
  if (count === 2) {
    const p = ok(firstMatch(src, DUO)) ?? ok(firstMatch(src, WITH_PARTNER));
    if (p) return p;
  }
  const counted = ok(
    firstMatch(src, PARTY_COUNTED, (x) => {
      const tokens = x[0].trim().split(/\s+/);
      const lead = /^(?:avec|with|con|mit)$/i.test(tokens[0]);
      // Premier nombre du passage (un possessif ou un article peut le précéder : « avec nos 3 enfants »).
      const num = tokens.map(numberOf).find((n) => n != null) ?? null;
      return num != null && (num === count || (lead && num + 1 === count));
    })
  );
  if (counted) return counted;
  const composite = ok(
    firstMatch(src, PARTY_COMPOSITE, (x) => {
      const lead = /^(?:avec|with|con|mit)/i.test(x[0].trim());
      let sum = 0;
      for (const part of x[0].matchAll(new RegExp(`(${NUMW})\\s+\\p{L}+`, 'giu'))) {
        const n = numberOf(part[1]);
        if (n == null) return false;
        sum += n;
      }
      return sum === count || (lead && sum + 1 === count);
    })
  );
  if (composite) return composite;
  return ok(
    firstMatch(src, PARTY_LEAD, (x) => {
      const last = x[0].trim().split(/\s+/).pop() ?? '';
      return numberOf(last) === count;
    })
  );
}

function findClass<K extends string>(
  src: string,
  phrase: string,
  lexicon: Record<K, RegExp>,
  wanted: K
): string | null {
  const m = firstMatch(src, lexicon[wanted]);
  return m ? checked(src, m.index, m.index + m.text.length, phrase) : null;
}

function findMoneyPassage(src: string, phrase: string, amount: number): { passage: string; end: number } | null {
  const parse = (raw: string): number | null => {
    const hasK = /\d\s?k(?![\p{L}])/iu.test(raw);
    let t = raw.replace(/[^\d.,\s  ]/gu, '').replace(/[\s  ]/g, '');
    t = t.replace(/[.,]+$/, '');
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
    else t = t.replace(',', '.');
    const n = Number(t);
    return Number.isFinite(n) ? (hasK ? n * 1000 : n) : null;
  };
  const m = firstMatch(src, MONEY, (x) => {
    const n = parse(x[0].trim());
    return n != null && Math.abs(n - amount) < 0.5;
  });
  if (!m) return null;
  const passage = checked(src, m.index, m.index + m.text.length, phrase);
  return passage ? { passage, end: m.index + m.text.length } : null;
}

/**
 * Ce que les règles ont lu, en Brief. Ne produit que du 'dit' (passage retrouvé dans la phrase)
 * ou du 'deduit' (sans passage). Une action sans variable correspondante, ou dont la valeur
 * n'entre pas dans le Brief, est rendue dans `unmapped` : jamais ignorée en silence.
 *
 * Quand une même variable est lue deux fois (deux `set_party_size`), la première gagne, comme
 * `planApplication`.
 */
export function actionsToBrief(
  actions: readonly CompasIntentAction[],
  phrase: string
): { brief: Brief; unmapped: string[] } {
  const src = phrase.normalize('NFC');
  let brief = emptyBrief();
  const unmapped: string[] = [];
  const note = (label: string) => {
    if (!unmapped.includes(label)) unmapped.push(label);
  };
  const seen = new Set<string>();

  /** Écrit une variable si elle est vide et conforme au schéma ; sinon l'action est signalée. */
  const put = (type: string, path: BriefPath, f: Found | null): void => {
    if (!f || f.value == null) return;
    const v: AnyValue = f.evidence ? said(f.value, f.evidence) : deduced(f.value);
    if (!leafSchema(path).safeParse(v).success) {
      note(`${type}:hors_bornes`);
      return;
    }
    if (getValue(brief, path).value != null) return;
    brief = withValue(brief, path, v);
  };

  /** Passage d'un nom : dit seulement si le nom est retrouvé dans la phrase. */
  const nameEvidence = (name: string): string | null => {
    const at = locateName(src, name);
    return at ? checked(src, at.from, at.to, phrase) : null;
  };

  /** Liste de noms (envies, à éviter, objets) : dit si tous sont retrouvés, sur le plus petit passage qui les couvre. */
  const listFound = (labels: readonly string[]): Found => {
    const values: string[] = [];
    for (const l of labels) {
      const t = l.trim();
      if (t && !values.some((x) => x.toLowerCase() === t.toLowerCase())) values.push(t);
    }
    const spans = values.map((v) => locateName(src, v));
    if (spans.some((s) => s == null)) return { value: values.slice(0, 8), evidence: null };
    const from = Math.min(...spans.map((s) => s!.from));
    const to = Math.max(...spans.map((s) => s!.to));
    const passage = to - from <= 200 ? checked(src, from, to, phrase) : null;
    return { value: values.slice(0, 8), evidence: passage };
  };

  for (const a of actions) {
    if (seen.has(a.type) && a.type !== 'avoid' && a.type !== 'wish' && a.type !== 'add_item') continue;
    seen.add(a.type);
    switch (a.type) {
      case 'set_dates': {
        const found = findDatePassage(src, phrase, a.start, a.end);
        put(a.type, 'quand.dateDebut', { value: a.start, evidence: found?.passage ?? null });
        if (a.end) put(a.type, 'quand.dateFin', { value: a.end, evidence: found?.endSaid ? found.passage : null });
        const month = Number(a.start.slice(5, 7));
        put(a.type, 'quand.mois', {
          value: month,
          evidence: found && valueInEvidence('quand.mois', month, found.passage) === 'oui' ? found.passage : findMonthPassage(src, phrase, month),
        });
        break;
      }
      case 'set_duration': {
        if (a.days != null) {
          const evidence = a.atLeast ? null : findDays(src, phrase, a.days);
          put(a.type, 'quand.jours', { value: a.days, evidence });
        }
        if (a.hours != null) put(a.type, 'quand.heures', { value: a.hours, evidence: findHours(src, phrase, a.hours) });
        break;
      }
      case 'set_party_size':
        put(a.type, 'qui.personnes', { value: a.count, evidence: findParty(src, phrase, a.count) });
        break;
      case 'set_budget': {
        const money = findMoneyPassage(src, phrase, a.amount);
        const exact = money != null && !a.groupOf && !a.said;
        put(a.type, 'budget.enveloppe', { value: a.amount, evidence: exact ? money.passage : null });
        if (a.currency)
          put(a.type, 'budget.devise', {
            value: a.currency,
            evidence: exact && /[€$£¥]|[a-z]{2,}$/iu.test(money.passage) ? money.passage : null,
          });
        if (a.perPerson) {
          const after = money ? src.slice(money.end) : '';
          const m = PER_PERSON.exec(after.slice(0, 30));
          PER_PERSON.lastIndex = 0;
          const evidence = m && money ? checked(src, money.end + m.index, money.end + m.index + m[0].length, phrase) : null;
          put(a.type, 'budget.base', { value: 'par_personne', evidence });
        } else if (a.groupOf) put(a.type, 'budget.base', { value: 'total', evidence: null });
        break;
      }
      case 'set_pace':
        put(a.type, 'effort.rythme', { value: a.pace, evidence: findClass(src, phrase, PACE_WORDS, a.pace) });
        break;
      case 'set_nights':
        put(a.type, 'nuits.type', { value: a.nights, evidence: findClass(src, phrase, NIGHT_WORDS, a.nights) });
        break;
      case 'set_activity':
        put(a.type, 'projet.activite', { value: a.activity, evidence: findClass(src, phrase, ACTIVITY_WORDS, a.activity) });
        break;
      case 'avoid':
        brief = appendList(brief, 'ou.aEviter', a.label);
        break;
      case 'wish':
        brief = appendList(brief, 'ou.envies', a.label);
        break;
      case 'add_item':
        brief = appendList(brief, 'materiel.possedeDit', a.name);
        break;
      case 'search_route':
        // Une recherche de parcours au catalogue : un geste du moteur, pas une variable du Brief.
        note(a.type);
        break;
      case 'set_destination': {
        put(a.type, 'ou.destination', { value: a.place, evidence: nameEvidence(a.place) });
        if (a.trail) {
          const flexible = a.trail.replace(/(\p{L})(\p{N})/gu, '$1[\\s-]?$2');
          const m = firstMatch(src, new RegExp(`${B}${flexible}${E}`, 'giu'));
          put(a.type, 'projet.itineraireNomme', {
            value: a.trail,
            evidence: m ? checked(src, m.index, m.index + m.text.length, phrase) : null,
          });
        }
        break;
      }
      case 'set_origin':
        put(a.type, 'ou.depart', { value: a.place, evidence: nameEvidence(a.place) });
        break;
      case 'set_outdoor_nights': {
        const m = firstMatch(src, OUTDOOR_NIGHTS, (x) => valueInEvidence('nuits.nuitsDehors', a.nights, x[0]) === 'oui');
        put(a.type, 'nuits.nuitsDehors', {
          value: a.nights,
          evidence: m ? checked(src, m.index, m.index + m.text.length, phrase) : null,
        });
        break;
      }
      case 'set_max_pack': {
        const m = firstMatch(src, WEIGHT, (x) => valueInEvidence('materiel.poidsViseKg', a.kg, x[0]) === 'oui');
        put(a.type, 'materiel.poidsViseKg', {
          value: a.kg,
          evidence: m ? checked(src, m.index, m.index + m.text.length, phrase) : null,
        });
        break;
      }
      case 'set_car_free': {
        const m = firstMatch(src, CAR_FREE);
        put(a.type, 'transport.sansVoiture', {
          value: true,
          evidence: m ? checked(src, m.index, m.index + m.text.length, phrase) : null,
        });
        break;
      }
      case 'set_distance': {
        const m = firstMatch(src, DISTANCE, (x) => valueInEvidence('effort.kmTotal', a.km, x[0]) === 'oui');
        const perDay = m != null && PER_DAY.test(src.slice(m.index + m.text.length, m.index + m.text.length + 24));
        let evidence: string | null = null;
        if (m) {
          let to = m.index + m.text.length;
          const tail = PER_DAY.exec(src.slice(to, to + 24));
          if (tail) to += tail[0].length;
          evidence = checked(src, m.index, to, phrase);
        }
        put(a.type, perDay ? 'effort.kmParJour' : 'effort.kmTotal', { value: a.km, evidence });
        break;
      }
      case 'set_level':
        put(a.type, 'qui.niveau', { value: a.level, evidence: findClass(src, phrase, LEVEL_WORDS, a.level) });
        break;
      case 'set_terrain':
        put(a.type, 'effort.terrain', { value: a.terrain, evidence: findClass(src, phrase, TERRAIN_WORDS, a.terrain) });
        break;
    }
  }

  // Listes : le passage couvre tous les noms, calculé une fois la liste complète.
  for (const path of ['ou.aEviter', 'ou.envies', 'materiel.possedeDit'] as const) {
    const list = getValue(brief, path).value as string[] | null;
    if (!list) continue;
    const f = listFound(list);
    const v: AnyValue = f.evidence ? said(f.value, f.evidence) : deduced(f.value);
    if (leafSchema(path).safeParse(v).success) brief = withValue(brief, path, v);
    else {
      brief = withValue(brief, path, emptyValue());
      note(`${path === 'ou.aEviter' ? 'avoid' : path === 'ou.envies' ? 'wish' : 'add_item'}:hors_bornes`);
    }
  }

  return { brief, unmapped };
}

/** Ajoute un nom à une liste du Brief (ordre de la phrase, sans doublon, 8 au plus) : valeur provisoire, la source est fixée ensuite. */
function appendList(brief: Brief, path: BriefPath, label: string): Brief {
  const current = (getValue(brief, path).value as string[] | null) ?? [];
  const t = label.trim();
  if (!t || current.some((x) => x.toLowerCase() === t.toLowerCase()) || current.length >= 8) return brief;
  return withValue(brief, path, deduced([...current, t]));
}

/* ------------------------------------------------------------------------------------------ */
/* settingsToBrief                                                                             */
/* ------------------------------------------------------------------------------------------ */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NIGHTS_TO_KIND: Record<string, string | undefined> = {
  bivouac: 'bivouac',
  refuge: 'refuge',
  hebergement: 'hebergement',
  mixte: 'mixte',
};
const PRIORITY_TO_BRIEF: Record<string, string | undefined> = {
  legerete: 'legerete',
  confort: 'confort',
  budget: 'prix',
  securite: 'securite',
};

/**
 * Noms reconnus dans `touched` : les champs de l'entrée (`startDate`, `endDate`, `plannedDays`,
 * `durationHours`, `partySize`, `activity`, `destinationName`) et les clés de `CompasPreferences`
 * (`pace`, `nights`, `level`, `autonomy`, `priority`, `terrain`, `maxPackKg`, `outdoorNights`,
 * `targetKm`, `carFree`, `wishes`, `avoid`).
 */
export const SETTING_NAMES = [
  'startDate',
  'endDate',
  'plannedDays',
  'durationHours',
  'partySize',
  'activity',
  'destinationName',
  'pace',
  'nights',
  'level',
  'autonomy',
  'priority',
  'terrain',
  'maxPackKg',
  'outdoorNights',
  'targetKm',
  'carFree',
  'wishes',
  'avoid',
] as const;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, 8) : [];

/**
 * Réglages déjà posés sur le voyage : ils entrent verrouillés (`lockValue` : dit, confiance 1, publics).
 * Seuls ceux que la personne a modifiés elle-même (`touched`) entrent ; les autres restent absents
 * (le moteur les recalcule). Une valeur illisible ou hors bornes reste absente. Jamais de variable
 * de `SENSITIVE_PATHS` (le résultat passe `briefForStorage`).
 */
export function settingsToBrief(input: {
  startDate: string | null;
  endDate: string | null;
  plannedDays: unknown;
  durationHours: unknown;
  partySize: number | null;
  activity: string | null;
  destinationName: string | null;
  preferences: Partial<CompasPreferences> | null;
  touched: ReadonlySet<string>;
}): Brief {
  let brief = emptyBrief();
  const put = (name: string, path: BriefPath, value: unknown) => {
    if (!input.touched.has(name) || value == null) return;
    const v = lockValue(value);
    if (leafSchema(path).safeParse(v).success) brief = withValue(brief, path, v);
  };
  const p = input.preferences ?? {};
  const num = (v: unknown) => (typeof v === 'number' || typeof v === 'string') && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

  put('startDate', 'quand.dateDebut', typeof input.startDate === 'string' && ISO.test(input.startDate) ? input.startDate : null);
  put('endDate', 'quand.dateFin', typeof input.endDate === 'string' && ISO.test(input.endDate) ? input.endDate : null);
  const planned = num(input.plannedDays);
  put('plannedDays', 'quand.jours', planned != null && Number.isInteger(planned) ? planned : null);
  put('durationHours', 'quand.heures', num(input.durationHours));
  put('partySize', 'qui.personnes', typeof input.partySize === 'number' ? input.partySize : null);
  put('activity', 'projet.activite', (COMPAS_ACTIVITIES as readonly string[]).includes(input.activity ?? '') ? input.activity : null);
  put('destinationName', 'ou.destination', input.destinationName?.trim() || null);

  put('pace', 'effort.rythme', p.pace);
  put('nights', 'nuits.type', p.nights ? NIGHTS_TO_KIND[p.nights] : null);
  put('level', 'qui.niveau', p.level);
  put('autonomy', 'nuits.autonomie', p.autonomy);
  put('priority', 'budget.priorite', p.priority ? PRIORITY_TO_BRIEF[p.priority] : null);
  put('terrain', 'effort.terrain', p.terrain);
  put('maxPackKg', 'materiel.poidsViseKg', num(p.maxPackKg));
  put('outdoorNights', 'nuits.nuitsDehors', num(p.outdoorNights));
  // `targetKm` : « la sortie entière, ou par jour pour un séjour » ; le moteur le lit par jour (`targetKmPerDay`).
  put('targetKm', 'effort.kmParJour', num(p.targetKm));
  put('carFree', 'transport.sansVoiture', p.carFree === true ? true : null);
  const wishes = strings(p.wishes);
  put('wishes', 'ou.envies', wishes.length ? wishes : null);
  const avoid = strings(p.avoid);
  put('avoid', 'ou.aEviter', avoid.length ? avoid : null);

  // Dernier garde-fou (règle R5) : aucune variable sensible, aucun passage.
  return briefForStorage(brief);
}

/* ------------------------------------------------------------------------------------------ */
/* briefToTripContextInput                                                                     */
/* ------------------------------------------------------------------------------------------ */

const MS_DAY = 86_400_000;

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + n * MS_DAY).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / MS_DAY);
}

const val = <T>(brief: Brief, path: BriefPath): T | null => (getValue(brief, path).value as T | null) ?? null;

/** Une date du calendrier (« 2027-02-31 » et « 2027-13-01 » passent le motif du schéma, pas ceci), sinon null. */
function calendarDate(iso: string | null): string | null {
  if (iso == null) return null;
  const t = Date.parse(`${iso}T12:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Entrée de `buildTripContext` tirée du Brief : dates et jours, heures, groupe, activité, destination dite.
 * Ce que le Brief ne porte pas (ancre, pays résolu, membres) vient de `base`, tout comme une variable absente.
 *
 * Les dates suivent `planApplication` (intent.ts) : des dates dites (début et fin) font les jours ; sinon une
 * durée en jours depuis le début (plafonnée à 30 quand elle est dite, pas quand la personne l'a réglée) ;
 * sinon, un début seul garde la durée de `base` (un jour à défaut). Une durée en heures tient dans le jour de
 * début. Sans début, la durée en jours devient la durée retenue (`plannedDays`).
 * La destination est le nom dit : le pays résolu et l'ancre de `base` sont ceux de la destination d'AVANT,
 * à l'appelant de les renouveler s'il la change.
 */
export function briefToTripContextInput(brief: Brief, base: TripContextInput): TripContextInput {
  const out: TripContextInput = { ...base };
  const d0 = calendarDate(val<string>(brief, 'quand.dateDebut'));
  const d1 = calendarDate(val<string>(brief, 'quand.dateFin'));
  const days = getValue(brief, 'quand.jours');
  const n = days.value as number | null;
  const h = val<number>(brief, 'quand.heures');

  if (d0 != null || d1 != null || n != null || h != null) {
    const start = d0 ?? calendarDate(base.startDate);
    if (start != null) {
      out.startDate = start;
      if (h != null) {
        out.endDate = start;
        out.durationHours = h;
      } else if (d0 != null && d1 != null) {
        out.endDate = d1;
        out.durationHours = null;
      } else if (n != null) {
        out.endDate = addDays(start, Math.min(days.locked ? MAX_DAYS_LOCKED : MAX_DAYS_SAID, n) - 1);
        out.durationHours = null;
      } else if (d1 != null) {
        out.endDate = d1;
        out.durationHours = null;
      } else {
        const baseDated =
          calendarDate(base.startDate) && calendarDate(base.endDate) ? daysBetween(base.startDate!, base.endDate!) + 1 : null;
        const planned = Number(base.plannedDays);
        const keep = baseDated ?? (Number.isInteger(planned) && planned >= 1 ? planned : null);
        out.endDate = addDays(start, Math.min(MAX_DAYS_SAID, keep ?? 1) - 1);
        out.durationHours = keep == null || baseDated != null ? (base.durationHours ?? null) : null;
      }
    } else {
      if (n != null) out.plannedDays = Math.min(days.locked ? MAX_DAYS_LOCKED : MAX_DAYS_SAID, n);
      if (h != null) out.durationHours = h;
    }
  }

  const party = val<number>(brief, 'qui.personnes');
  if (party != null) out.partySize = party;
  const activity = val<string>(brief, 'projet.activite');
  if (activity != null) out.activity = activity;
  const destination = val<string>(brief, 'ou.destination');
  if (destination != null) out.destinationName = destination;
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* briefToPreferences                                                                          */
/* ------------------------------------------------------------------------------------------ */

const KIND_TO_NIGHTS: Record<string, CompasPreferences['nights']> = {
  bivouac: 'bivouac',
  refuge: 'refuge',
  mixte: 'mixte',
  hebergement: 'hebergement',
  gite: 'hebergement',
  hotel: 'hebergement',
  chez_habitant: 'hebergement',
};
const BRIEF_TO_PRIORITY: Record<string, CompasPreferences['priority']> = {
  prix: 'budget',
  confort: 'confort',
  legerete: 'legerete',
  securite: 'securite',
};

/**
 * Préférences au format lu par `readCompasMeta` (`metadata.compas.prefs`), tirées du Brief.
 *
 * AVANT toute conversion, le Brief passe par `briefForStorage` : ces préférences sont rangées sur le
 * voyage, lisible par un tiers sur un voyage public. Rien de privé (profil, historique, ou déduit d'eux),
 * rien de sensible, aucun passage de la phrase n'en sort (ADR-V6-001 §3.3 et §3.6).
 * Une variable sans équivalent dans `CompasPreferences` est laissée de côté (voir `unconsumedPaths`).
 */
export function briefToPreferences(brief: Brief): Partial<CompasPreferences> {
  const b = briefForStorage(brief);
  const out: Partial<CompasPreferences> = {};
  const pace = val<string>(b, 'effort.rythme');
  if (pace === 'tranquille' || pace === 'normal' || pace === 'soutenu') out.pace = pace;
  const kind = val<string>(b, 'nuits.type');
  if (kind && KIND_TO_NIGHTS[kind]) out.nights = KIND_TO_NIGHTS[kind];
  const level = val<string>(b, 'qui.niveau');
  if (level === 'debut' || level === 'regulier' || level === 'aguerri') out.level = level;
  const autonomy = val<string>(b, 'nuits.autonomie');
  if (autonomy === 'journee' || autonomy === 'bivouac_1_2' || autonomy === 'itinerance_longue') out.autonomy = autonomy;
  const priority = val<string>(b, 'budget.priorite');
  if (priority && BRIEF_TO_PRIORITY[priority]) out.priority = BRIEF_TO_PRIORITY[priority];
  const terrain = val<string>(b, 'effort.terrain');
  if (
    terrain === 'sentier' ||
    terrain === 'montagne' ||
    terrain === 'hors_sentier' ||
    terrain === 'itinerance' ||
    terrain === 'urbain_transit'
  )
    out.terrain = terrain;
  const pack = val<number>(b, 'materiel.poidsViseKg');
  if (pack != null) out.maxPackKg = pack;
  const outdoor = val<number>(b, 'nuits.nuitsDehors');
  if (outdoor != null) out.outdoorNights = outdoor;
  // `targetKm` : une seule valeur. Par jour d'abord (le moteur le lit par jour), sinon la distance totale dite.
  const km = val<number>(b, 'effort.kmParJour') ?? val<number>(b, 'effort.kmTotal');
  if (km != null) out.targetKm = km;
  if (val<boolean>(b, 'transport.sansVoiture') === true) out.carFree = true;
  const wishes = val<string[]>(b, 'ou.envies');
  if (wishes && wishes.length) out.wishes = wishes.slice(0, 8);
  const avoid = val<string[]>(b, 'ou.aEviter');
  if (avoid && avoid.length) out.avoid = avoid.slice(0, 8);
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* unconsumedPaths                                                                             */
/* ------------------------------------------------------------------------------------------ */

const NEUTRAL_BASE: TripContextInput = {
  startDate: null,
  endDate: null,
  plannedDays: null,
  partySize: null,
  destinationName: null,
  activity: null,
  durationHours: null,
};

function consumed(brief: Brief): string {
  return JSON.stringify([briefToTripContextInput(brief, NEUTRAL_BASE), briefToPreferences(brief)]);
}

/**
 * Variables du Brief, renseignées dans CE Brief, que le moteur actuel ne consomme pas par ces deux
 * adaptateurs (pour le journal du banc). Mesure par retrait : une variable est consommée si l'enlever
 * change `briefToTripContextInput` (sur une base neutre) ou `briefToPreferences`. Les chevauchements sont
 * donc comptés comme ils agissent (des dates dites passent devant la durée en jours ; une valeur privée,
 * qui ne sort pas dans les préférences, n'est pas consommée par elles).
 * Ne rend que des chemins, jamais une valeur.
 */
export function unconsumedPaths(brief: Brief): BriefPath[] {
  const whole = consumed(brief);
  return briefPaths().filter((p) => {
    if (getValue(brief, p).value == null) return false;
    return consumed(withValue(brief, p, emptyValue())) === whole;
  });
}
