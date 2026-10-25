import { saidCountryFor, saidPlaceAfterCountry } from './saidCountry';
import { canonicalCountryName } from './countryNames';
import { z } from 'zod';
import type { CompasNights, CompasPreferences } from './compasModel';
import {
  activityLabel,
  addDaysIso,
  daysBetweenIso,
  formatDayMonth,
  formatHours,
  formatMoney,
} from './format';
import type { Pace } from './weather';
import {
  HOLIDAY_RE,
  HOLIDAY_WORD,
  easterSunday,
  holidayDate,
  readMoney,
  saidPerPerson,
  spellNumbers,
  vagueSpan,
} from './intentWords';
import { samePlaceName } from './places';
import { profileFor } from './activityProfile';
import { trailRefIn } from './geoTrails';
import type { Locale } from '@/lib/i18n/locale';
import {
  ACTIVITY_EN,
  DEST_LEAD_EN,
  EN_MONTH_ABBR,
  EN_WEEKDAYS,
  HOLIDAYS_EN,
  NIGHTS_EN,
  ORIGIN_END_EN,
  ORIGIN_LEAD_EN,
  PLACE_END_EN,
  PLACE_TAIL_EN,
  companionsParty,
  enStopLead,
  looksEnglish,
  notAPlaceEn,
  slashOrderEn,
  spellNumbersEn,
} from './intentEn';

import { detectPivot, pivotText, type PivotLexicon, type PivotLang } from './intentPivot';
import { ES_LEXICON } from './intentEs';
import { DE_LEXICON } from './intentDe';
import { IT_LEXICON } from './intentIt';

export { looksEnglish } from './intentEn';

/** Lexiques de la lecture espagnole, allemande et italienne (PLAN-100 6.2, `intentPivot.ts`). */
const PIVOTS: Record<PivotLang, PivotLexicon> = { es: ES_LEXICON, de: DE_LEXICON, it: IT_LEXICON };
const PIVOT_LIST: PivotLexicon[] = Object.values(PIVOTS);

/**
 * Langue reconnue dans la phrase : `'es'`, `'de'` ou `'it'` (mots propres, aucun mot-outil
 * français ni anglais), `'en'` (sans équivoque anglaise), sinon null (lue en français).
 * `locale` (langue de l'interface) départage seulement une égalité entre ces trois langues.
 */
export function phraseLanguage(text: string, locale?: Locale): Locale | null {
  const src = text.normalize('NFC');
  return detectPivot(src, PIVOT_LIST, locale) ?? (looksEnglish(src) ? 'en' : null);
}

/**
 * Compas — « Dis-le » : une phrase devient des actions PROPOSÉES.
 *
 * L'IA comprend, le moteur décide : chaque action passe ici par trois portes
 * avant d'être proposée.
 * 1. Le schéma (liste fermée d'actions, bornes).
 * 2. L'ancrage : un nombre, une date ou un nom qui n'est pas dans la phrase
 *    est refusé (« le modèle n'écrit aucun chiffre absent de l'entrée »).
 * 3. Les limites réelles : pas de date passée, pas plus de 30 jours,
 *    enveloppe jamais sous l'engagé, pas de doublon.
 * Rien n'est appliqué sans un geste explicite de l'utilisateur.
 *
 * Le lecteur de règles ci-dessous fonctionne SANS IA : c'est le repli quand
 * l'IA est indisponible, et le complément quand elle oublie une partie.
 */

export const COMPAS_ACTIVITIES = [
  'hiking',
  'trekking',
  'bivouac',
  'roadtrip',
  'cultural',
  'bushcraft',
  'mixed',
  'cycling',
  'ski',
  'mountaineering',
  'climbing',
  'water',
  'citytrip',
  'beach',
  'vanlife',
  'running',
  'trail',
] as const;
export type CompasActivity = (typeof COMPAS_ACTIVITIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const label = z.string().trim().min(1).max(60);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);

export const intentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_dates'), start: isoDate, end: isoDate.nullable() }),
  z.object({
    type: z.literal('set_duration'),
    days: z.number().int().min(1).max(60).nullable(),
    hours: z.number().min(0.25).max(23.75).nullable(),
    /**
     * Durée vague (« quelques jours ») : `days` est le minimum que le pluriel garantit, pas un nombre dit.
     * Posé par les règles seulement : un nombre de l'IA pour « quelques jours » est refusé (inventé).
     */
    atLeast: z.literal(true).optional(),
  }),
  z.object({ type: z.literal('set_party_size'), count: z.number().int().min(1).max(99) }),
  z.object({
    type: z.literal('set_budget'),
    amount: z.number().positive().max(1_000_000),
    /** Devise dite dans la phrase (« 2000 $ ») ; absente : celle du voyage. */
    currency: currencyCode.optional(),
    /** Montant tel que dit, quand le serveur l'a converti dans la devise du voyage. */
    said: z
      .object({
        amount: z.number().positive().max(1_000_000_000),
        currency: currencyCode,
        date: isoDate,
        source: z.string().trim().min(1).max(80),
      })
      .optional(),
    /** Montant dit « par personne » (`amount` = par personne) : `validateActions` le multiplie par le groupe. */
    perPerson: z.literal(true).optional(),
    /** Groupe par lequel un montant « par personne » a été multiplié : `amount` est alors le total appliqué. */
    groupOf: z.number().int().min(1).max(99).optional(),
  }),
  z.object({ type: z.literal('set_pace'), pace: z.enum(['tranquille', 'normal', 'soutenu']) }),
  z.object({
    type: z.literal('set_nights'),
    nights: z.enum(['bivouac', 'refuge', 'hebergement', 'mixte']),
  }),
  z.object({ type: z.literal('set_activity'), activity: z.enum(COMPAS_ACTIVITIES) }),
  z.object({ type: z.literal('avoid'), label }),
  z.object({ type: z.literal('wish'), label }),
  z.object({
    type: z.literal('add_item'),
    name: label,
    quantity: z.number().int().min(1).max(99).default(1),
  }),
  z.object({ type: z.literal('search_route'), query: label }),
  z.object({
    type: z.literal('set_destination'),
    place: label,
    /**
     * « GR34 en 8 jours » : `place` reste la région (« Bretagne », le sentier reste une
     * envie) ; la référence normalisée (`trailRefIn`) voyage à côté pour le référentiel
     * `geo_trails`. Lue dans la phrase par les règles seulement, jamais montrée.
     */
    trail: z.string().regex(/^[\p{Lu}\p{N}]{1,12}$/u).optional(),
  }),
  /** Lieu d'où l'on part (« depuis Lyon ») : le trajet d'approche se chiffre depuis là. */
  z.object({
    type: z.literal('set_origin'),
    place: z.string().trim().min(1).max(80),
    /**
     * « Bourg en Bresse » quand le départ lu est « Bourg » : la carte dit si « en … » fait
     * partie du nom (`settleLinkedOrigin`). Jamais montré ni appliqué tel quel.
     */
    longer: z.string().trim().min(1).max(80).optional(),
  }),
  z.object({ type: z.literal('set_outdoor_nights'), nights: z.number().int().min(1).max(60) }),
  z.object({ type: z.literal('set_max_pack'), kg: z.number().min(1).max(40) }),
  /** « sans voiture » : ni voiture personnelle ni de location, train, bus, vélo ou à pied. */
  z.object({ type: z.literal('set_car_free') }),
  z.object({ type: z.literal('set_distance'), km: z.number().min(1).max(300) }),
  z.object({ type: z.literal('set_level'), level: z.enum(['debut', 'regulier', 'aguerri']) }),
  z.object({
    type: z.literal('set_terrain'),
    terrain: z.enum(['sentier', 'montagne', 'hors_sentier', 'itinerance', 'urbain_transit']),
  }),
]);

export type CompasIntentAction = z.output<typeof intentActionSchema>;
export type IntentSource = 'ia' | 'regles';

export interface CompasProposal {
  id: string;
  action: CompasIntentAction;
  label: string;
  ok: boolean;
  /** Pourquoi le moteur refuse, en clair. */
  reason: string | null;
  source: IntentSource;
}

export interface IntentContext {
  /** Aujourd'hui, heure de Paris (AAAA-MM-JJ). */
  today: string;
  startDate: string | null;
  endDate: string | null;
  /** Prévu + dépensé : l'enveloppe ne descend jamais en dessous. */
  engaged: number;
  currency: string;
  avoid: string[];
  wishes: string[];
  /** Taille du groupe rangée sur le voyage (`party_size`) ; absente ou null : pas encore dite. */
  partySize?: number | null;
}

export const MAX_TRIP_DAYS = 30;

type BudgetAction = Extract<CompasIntentAction, { type: 'set_budget' }>;

/**
 * Une enveloppe dite dans une autre devise, ramenée à celle du voyage au taux lu par le serveur :
 * le montant et la devise changent, le montant dit et le taux restent dans `said`, et TOUT le reste
 * de l'action est gardé (« par personne » compris : il se multiplie ensuite par le groupe, sur le
 * montant converti ; constat Codex, PR #93).
 */
export function budgetConverted(
  action: BudgetAction,
  tripCurrency: string,
  converted: { amount: number; date: string; source: string }
): BudgetAction {
  return {
    ...action,
    amount: Math.max(1, Math.round(converted.amount)),
    currency: tripCurrency,
    said: { amount: action.amount, currency: action.currency ?? tripCurrency, date: converted.date, source: converted.source },
  };
}
const MAX_AHEAD_DAYS = 540;

/* ---------- Normalisation ---------- */

function plainOf(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'");
}

const WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
};
const NUM = `(\\d+(?:[.,]\\d+)?|${Object.keys(WORDS).join('|')})`;

function toNumber(token: string): number | null {
  if (token in WORDS) return WORDS[token];
  const n = Number(token.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Le nombre figure-t-il dans la phrase, en chiffres ou en lettres ? */
export function numberInText(text: string, n: number): boolean {
  const plain = spellNumbers(plainOf(text))
    .replace(/(\d)[\s\u202f\u00a0.,](?=\d{3}\b)/g, '$1')
    // « 3k€ », « 2,5 k » : le montant entier est dit.
    .replace(/\b(\d+)(?:[.,](\d))?\s*k\b/g, (_, int: string, dec?: string) => String(Number(`${int}.${dec ?? 0}`) * 1000));
  const digits = String(n).replace('.', '[.,]');
  if (new RegExp(`(^|[^\\d])${digits}([^\\d]|$)`).test(plain)) return true;
  return Object.entries(WORDS).some(([w, v]) => v === n && new RegExp(`\\b${w}\\b`).test(plain));
}

/* ---------- Dates ---------- */

const MONTHS: Array<[RegExp, number]> = [
  [/^janv/, 1],
  [/^fev/, 2],
  [/^mars/, 3],
  [/^avr/, 4],
  [/^mai/, 5],
  [/^juin/, 6],
  [/^juil/, 7],
  [/^aout/, 8],
  [/^sept/, 9],
  [/^oct/, 10],
  [/^nov/, 11],
  [/^dec/, 12],
  // Phrases en anglais (« Hiking in Iceland in July »).
  [/^january/, 1],
  [/^february/, 2],
  [/^march/, 3],
  [/^april/, 4],
  [/^may$/, 5],
  [/^june/, 6],
  [/^july/, 7],
  [/^august/, 8],
  // Mois anglais abrégés (« Oct 12 », « 3 Aug ») : lus seulement par les règles anglaises.
  [/^jan/, 1],
  [/^feb/, 2],
  [/^mar/, 3],
  [/^apr/, 4],
  [/^jun/, 6],
  [/^jul/, 7],
  [/^aug/, 8],
  [/^sep/, 9],
];
const MONTH_RE =
  '(janvier|janv\\.?|fevrier|fevr?\\.?|mars|avril|avr\\.?|mai|juin|juillet|juil\\.?|aout|septembre|sept\\.?|octobre|oct\\.?|novembre|nov\\.?|decembre|dec\\.?|january|february|march|april|may|june|july|august|september|october|november|december)';
const SEASONS: Record<string, { first: number; months: number[] }> = {
  hiver: { first: 12, months: [12, 1, 2] },
  printemps: { first: 3, months: [3, 4, 5] },
  ete: { first: 6, months: [6, 7, 8] },
  automne: { first: 9, months: [9, 10, 11] },
};
const SEASON_RE = /\b(?:en|cet|cette|pour l'|durant l'|pendant l'|l')\s*(hiver|ete|printemps|automne)\b/;
const ACTIVITY_LEAD = /^(?:rando|randonnee|randonnees|trek|trekking|trail|velo|ski|escalade|bivouac|alpinisme|kayak|canoe|surf|voyage|sejour|vacances|road|city|safari|sortie|course|running|marche|balade|traversee|tour|circuit|croisiere|plongee|parapente|week|weekend|journee|semaine|petit|grand|long|court|joli|beau)$/;
const FUNCTION_WORD = /^(?:depuis|vers|chez|sur|sous|par|a|le|la|les|l|ce|cet|cette|ces|son|sa|ses|ton|ta|tes|week|weekend|jusqu|apres|avant|pendant|durant|quelques|plusieurs|tout|toute|tous|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)$/;
const SENTENCE_OPENER = /^(?:je|j|on|nous|il|elle|vous|tu|bonjour|salut|hello|hi|hey|merci|svp|stp|ok|oui|non|mon|ma|mes|un|une|le|la|les|pour|avec|dans|en|au|aux|du|des|de|i|we|my|our)$/;
const RU_DAYS = /(\d{1,3})\s*(дн(?:я|ей|ь)|дней|суток|недел(?:и|ю|ь|я))/i;
const WEEK_OF = /\b(?:une\s+|1\s+)?semaine\s+(?:de|d'|a|au|aux|en|dans|sur)\s+(?!la\b|l'|du\b|des\b|prochaine|derniere)/;
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const RELATIVE_DATE =
  /\b(aujourd'hui|demain|apres-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week[- ]?end|semaine prochaine|mois prochain|dans \S+ (?:jours?|semaines?|mois)|dans une quinzaine|in \S+ (?:days?|weeks?|months?))\b/;

function monthOf(token: string): number | null {
  return MONTHS.find(([re]) => re.test(token))?.[1] ?? null;
}

function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** Prochaine date (≥ aujourd'hui) pour un jour et un mois, année déduite. */
function resolveDayMonth(
  today: string,
  day: number,
  month: number,
  year: number | null
): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const y0 = year ?? Number(today.slice(0, 4));
  for (const y of year ? [y0] : [y0, y0 + 1]) {
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(`${iso}T12:00:00Z`);
    if (d.getUTCDate() !== day) return null;
    if (year || iso >= today) return iso;
  }
  return null;
}

/** JJ/MM d'abord (français) ; MM/JJ seulement quand JJ/MM n'existe pas (« 11/25 »). */
function dayMonthAnyOrder(today: string, a: number, b: number, year: number | null): string | null {
  return resolveDayMonth(today, a, b, year) ?? (b > 12 ? resolveDayMonth(today, b, a, year) : null);
}

/** Même jour, `n` mois plus tard (borné à la fin du mois : 31 janv. + 1 mois = 28 févr.). */
function addMonthsIso(iso: string, n: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + n;
  const day = Number(iso.slice(8, 10));
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last), 12)).toISOString().slice(0, 10);
}

function nextWeekday(today: string, target: number, strict: boolean): string {
  const delta = (target - weekday(today) + 7) % 7;
  return addDaysIso(today, delta === 0 && strict ? 7 : delta);
}

/** La date proposée est-elle ancrée dans la phrase ? */
function dateGrounded(text: string, iso: string, end = false): boolean {
  const plain = plainOf(text);
  if (RELATIVE_DATE.test(plain) || HOLIDAY_RE.test(plain)) return true;
  const month = Number(iso.slice(5, 7));
  // Le mois est dit (« en janvier ») : un départ dans ce mois est ancré. Une
  // date de FIN seulement si le mois est donné comme fin (« jusqu'à fin
  // juillet », « du 28 juin à début juillet ») : « 7 jours en juillet » ne
  // dit pas « jusqu'au 8 ».
  const monthRe = end
    ? new RegExp(
        `(?:jusqu'?(?:a|au|en)|\\ba\\b|\\bau\\b|\\bvers\\b|->|–|—)\\s*(?:(?:debut|mi|fin)[\\s-]+(?:de\\s+|d')?)?${MONTH_RE}`,
        'g'
      )
    : new RegExp(`\\b${MONTH_RE}`, 'g');
  for (const m of plain.matchAll(monthRe)) if (monthOf(m[1]) === month) return true;
  const seasonSaid = !end ? SEASON_RE.exec(plain) : null;
  if (seasonSaid && SEASONS[seasonSaid[1]].months.includes(month)) return true;
  const day = Number(iso.slice(8, 10));
  return numberInText(text, day);
}

/* ---------- Lecteur de règles (sans IA) ---------- */

function clean(fragment: string, max = 40): string {
  return fragment
    .replace(/\s+(et|puis|mais|avec|pour|en|le|la|les|du|de|des|a|au|aux)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** Coupe un fragment au premier mot qui ouvre une autre idée. */
function upToBreak(fragment: string): string {
  const cut = fragment.search(
    /\s(?:et|puis|mais|pour|avec|sans|en|dans|du|le|la|a|au|à|on|depart|départ|des|dès|depuis)\s|\s(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|ce|cette|prochain|prochaine)(?=\s|$)|[,.;!?]|\d/i
  );
  return cut >= 0 ? fragment.slice(0, cut) : fragment;
}

/** Nom commun de lieu qui peut ouvrir un nom propre (« lac d'Annecy »). */
// La préposition est facultative : « mont Ventoux », « lac Blanc », « pic Saint-Loup ».
const PLACE_NOUN =
  /^(?:lacs?|calanques?|massifs?|parc(?: national| naturel(?: régional)?)?|gorges|vallée|vallee|îles?|iles?|côte|cote|canal|canaux|mer|camp de base|monts?|puys?|pics?|piton|pointe|glaciers?|étangs?|etangs?|col|forêt|foret|plateau|baie|golfe|cirque|presqu['’]île|presqu['’]ile|canyon|désert|desert|volcans?|aiguilles?|dents?)\s+(?:de la |de l['’]|du |des |de |d['’])?/iu;

/** Le même nom commun de lieu, en fin de texte (« … jusqu'au lac » devant « Blanc »). */
const PLACE_NOUN_TAIL = new RegExp(`(?:^|\\s)(${PLACE_NOUN.source.slice(1)})$`, 'iu');

/**
 * Nom commun qui, devant « de », fait partie du nom d'un lieu : « Pays de Galles », « lac de Côme »,
 * « Val de Loire », « Terre de Feu », « Baie de Somme », « Cap de Creus ». Sans IA, « au Pays de Galles
 * à Cardiff » se lisait « de Galles à Cardiff » (destination « Pays », relecture de la PR #108, 23 oct.).
 * Texte simplifié (`plainOf`) qui s'arrête juste avant le « de ».
 */
const NAME_NOUN_BEFORE_DE =
  /(?:^|[\s'(])(?:pays|terres?|vals?|vallees?|lacs?|baies?|cotes?|caps?|forets?|iles?|monts?|massifs?|parcs?(?: national| naturel(?: regional)?)?|golfes?|plages?|villes?|calanques?|gorges|canal|mer|puys?|pics?|piton|pointe|glaciers?|etangs?|col|plateau|cirque|presqu'iles?|canyon|desert|volcans?|aiguilles?|dents?|region|marais|causses?|dunes?|bois|grottes?|sources?|chateau|abbaye|camp de base)\s*$/;

/**
 * « de X à Y » (X et Y en noms propres), dans l'ordre de la phrase. Les mots d'un nom se séparent par un
 * espace seulement : le trait d'union est déjà une lettre du mot (« Saint-Jean-Pied-de-Port »). L'avoir
 * aussi comme séparateur laissait le moteur essayer 2^n découpages quand « à Y » manquait (« de Ab-Ab-…
 * x » : 10 s pour 94 caractères, relecture de la PR #108, 23 oct.).
 */
const FROM_TO_RE =
  /(?:^|\s)de\s+(\p{Lu}[\p{L}'’-]+(?:\s\p{Lu}[\p{L}'’-]+)*)\s+(?:à|a|jusqu['’]à)\s+(\p{Lu}[\p{L}'’-]+(?:\s\p{Lu}[\p{L}'’-]+)*)/gu;

/** Mot qui situe dans un lieu, devant « du », « de la » : « autour du lac de Côme », « au bord du lac de Garde ». */
const SITUATING_BEFORE =
  /(?:^|\s)(?:autour|pres|proche|loin|bord|tour|boucle|circuit|traversee|cote|rives?|environs|abords|pied|sommet|nord|sud|est|ouest|centre|coeur|cœur|region)\s*$/;

/**
 * Préposition de lieu juste avant le nom commun (texte simplifié) : « au lac de Côme », « en vallée de
 * Chevreuse », « dans la baie de Somme », « autour du lac de Côme ». Le nom commun ouvre alors un nom de lieu.
 */
const PLACE_PREP_BEFORE =
  /(?:^|\s)(?:au|aux|en|a(?: la| l')?|dans(?: le| la| les| l')?|sur(?: le| la| les| l')?|vers(?: le| la| les| l')?|(?:autour|pres|au bord|a cote|aux abords|au pied|au coeur|au cœur) (?:du|des|de la|de l'))\s*$/;

/** « le long de la côte », « longer la côte » : un trajet le long du lieu, pas un lieu où l'on séjourne. */
const ALONG_BEFORE = /(?:^|\s)(?:le long (?:du|des|de la|de l')|longer(?: le| la| les| l')?|longeant(?: le| la| les| l')?)\s*$/;

/**
 * Le premier « de X à Y » de la phrase dont le « de » n'appartient pas à un nom de lieu (« de Genève à
 * Nice », « au Japon de Tokyo à Kyoto », jamais « au Pays de Galles à Cardiff » ni « au lac de Côme à
 * Bellagio »). Le nom commun (« lac », « côte », « mer ») n'ouvre un nom de lieu que s'il porte une
 * majuscule (« Lac de Garde »), suit une préposition de lieu (« au lac de Côme ») ou est ouvert par « du »,
 * « de la », « de l' », « des » (« du lac de Côme ») ; sinon c'est un mot courant et le « de X à Y » reste
 * (« kayak de mer de Marseille à Cassis », « la côte de Nice à Menton », « le canal de Nantes à Brest »,
 * « le long de la côte de Collioure à Banyuls », relecture 3 de la PR #108). Le nom de lieu entier est le
 * départ quand un « de » l'ouvre (« du lac de Côme à Milan », « de Mont de Marsan à Dax »), sauf après un
 * mot qui situe (« autour du lac de Côme à Bellagio »). `at` : position du « de » (ou « du ») qui ouvre le
 * départ ; `said` : ce départ tel qu'écrit, « de » compris (« de Tokyo », « du lac de Côme »).
 */
function fromToIn(src: string): { from: string; to: string; at: number; said: string } | null {
  for (const m of src.matchAll(FROM_TO_RE)) {
    const de = (m.index ?? 0) + (m[0].startsWith('de') ? 0 : 1);
    const end = de + m[0].trimStart().indexOf(m[1]) + m[1].length;
    const plainFromTo = { from: m[1], to: m[2], at: de, said: src.slice(de, end) };
    const before = plainOf(src.slice(0, de));
    const noun = NAME_NOUN_BEFORE_DE.exec(before);
    if (!noun) return plainFromTo;
    const nounAt = noun.index + noun[0].search(/[^\s'(]/);
    const head = before.slice(0, nounAt);
    const opener = /(?:^|\s)(de|du|des|de la|de l')\s*$/.exec(head);
    const named =
      !ALONG_BEFORE.test(head) &&
      (/^\p{Lu}/u.test(src.slice(nounAt)) || PLACE_PREP_BEFORE.test(head) || (opener != null && opener[1] !== 'de'));
    if (!named) return plainFromTo;
    if (!opener) continue;
    const prior = before.slice(0, opener.index);
    if (SITUATING_BEFORE.test(prior) || NAME_NOUN_BEFORE_DE.test(prior)) continue;
    const at = opener.index + (/^\s/.test(opener[0]) ? 1 : 0);
    return { from: capitalized(src.slice(nounAt, end)), to: m[2], at, said: src.slice(at, end) };
  }
  return null;
}

/** Le fragment commence-t-il par un nom de lieu (nom propre, ou « lac de X ») ? */
function properLead(fragment: string): boolean {
  if (/^\p{Lu}/u.test(fragment)) return true;
  const lead = PLACE_NOUN.exec(fragment);
  return !!lead && /^\p{Lu}/u.test(fragment.slice(lead[0].length));
}

/**
 * Un mois, un jour de la semaine ou une fête n'est jamais une destination
 * (« à Noël »). Le premier mot du nom est un mois ENTIER : « juillet-aout »,
 * « mai ou juin », « July and August » sont des mois ; « Marseille »,
 * « Juillac » ou « Octon » commencent comme un mois et restent des lieux.
 */
const MONTH_LEAD = new RegExp(`^${MONTH_RE}(?![a-z])`);
function notAPlace(name: string, en = false): boolean {
  const plain = plainOf(name);
  return MONTH_LEAD.test(plain) || WEEKDAYS.includes(plain) || HOLIDAY_WORD.test(plain) || (en && notAPlaceEn(plain));
}

/** Coupe un nom de lieu lu en anglais à la première autre idée (« Corsica with my wife », « Atlas mountains »). */
function cutEn(name: string, origin = false): string {
  const cut = name.split(PLACE_END_EN)[0].split(PLACE_TAIL_EN)[0];
  return origin ? cut.split(ORIGIN_END_EN)[0] : cut;
}

const capitalized = (s: string) => (s ? s[0].toLocaleUpperCase('fr') + s.slice(1) : s);

/** Voyage de plusieurs jours (3 jours ou plus, 2 nuits ou plus, une semaine…) ? */
function longTrip(plain: string): boolean {
  if (/\b(semaines?|quinzaine|weeks?)\b(?![- ]?end)/.test(plain)) return true;
  for (const m of plain.matchAll(new RegExp(`\\b${NUM}\\s+(jours?|nuits?|days?|nights?)\\b`, 'g'))) {
    const n = toNumber(m[1]);
    if (n != null && n >= (/^n/.test(m[2]) ? 2 : 3)) return true;
  }
  return false;
}

/**
 * Sentiers célèbres → région où les préparer, et le nom du sentier (gardé en envie : avec l'IA, le
 * spécialiste en propose les étapes, chacune vérifiée sur la carte).
 */
const FAMOUS_TRAILS: Array<[RegExp, string, string]> = [
  [/\bgr ?20\b/, 'Corse', 'GR20'],
  [/\bhrp\b|\bhaute route pyreneenne\b/, 'Pyrénées', 'Haute Route Pyrénéenne'],
  [/\bgr ?10\b/, 'Pyrénées', 'GR10'],
  [/\bgr ?11\b/, 'Pyrénées', 'GR11'],
  [/\bgr ?54\b|\btour de l'oisans\b/, 'Écrins', 'GR54'],
  [/\bgr ?34\b|\bsentier des douaniers\b/, 'Bretagne', 'GR34'],
  [/\bgr ?5\b/, 'Alpes', 'GR5'],
  [/\bgr ?65\b|\bchemin du puy\b|\bvia podiensis\b/, 'Le Puy-en-Velay', 'GR65'],
  [/\bgr ?70\b|\bchemin de stevenson\b/, 'Cévennes', 'Chemin de Stevenson'],
  [/\bgr ?221\b|\bruta de pedra en sec\b/, 'Majorque', 'GR221'],
  [/\btmb\b|\btour du mont[- ]blanc\b/, 'Mont Blanc', 'Tour du Mont-Blanc'],
  [/\bchemin de l'inca\b|\binca trail\b/, 'Machu Picchu', "Chemin de l'Inca"],
  [/\bkungsleden\b/, 'Laponie suédoise', 'Kungsleden'],
  [/\bwest highland way\b/, 'Écosse', 'West Highland Way'],
  [/\blaugavegur\b/, 'Islande', 'Laugavegur'],
  [/\balta via ?(?:1|uno)\b/, 'Dolomites', 'Alta Via 1'],
  [/\balta via ?(?:2|due)\b/, 'Dolomites', 'Alta Via 2'],
  [/\b(?:tour|circuit) des annapurnas?\b|\bannapurna circuit\b/, 'Népal', 'Tour des Annapurnas'],
  [/\bjohn muir trail\b/, 'Yosemite', 'John Muir Trail'],
  [/\bmilford track\b/, 'Fiordland', 'Milford Track'],
  [/\boverland track\b/, 'Tasmanie', 'Overland Track'],
  [/\blycian way\b|\bvoie lycienne\b/, 'Lycie', 'Voie lycienne'],
  [/\brota vicentina\b|\bfishermen'?s trail\b/, 'Alentejo', 'Rota Vicentina'],
  // Le Camino part de Saint-Jean-Pied-de-Port : les dix premiers jours sont en Navarre (jamais « Camino », qui est aussi un lieu en Équateur).
  [/\bcamino(?: de santiago| frances)?\b|\bchemin de saint[- ]jacques\b|\bcompostelle\b/, 'Navarre', 'Chemin de Saint-Jacques'],
];

/**
 * Des enfants dans le groupe (« avec mes 2 enfants », « en famille avec les petits », « with kids ») :
 * le nom est précédé d'un mot qui les compte ou les possède. Pas « sans les enfants », ni le
 * « petits » d'un paysage (« rando des petits lacs », revue du 14 oct.).
 */
function withChildren(plain: string): boolean {
  const CHILD = '(?:enfants?|gamins?|bebes?|kids?|children)';
  if (new RegExp(`\\b(?:sans|without|no)\\s+(?:les\\s+|nos\\s+|mes\\s+|des\\s+|d'\\s*)?${CHILD}\\b`).test(plain)) return false;
  return (
    new RegExp(`\\b(?:avec|with|nos|mes|les|des|my|our|un|une|\\d+|deux|trois|quatre)\\s+(?:(?:\\d+|deux|trois|quatre|jeunes|petits|grands|young|small|two|three)\\s+)?${CHILD}\\b`).test(plain) ||
    /\b(?:avec|nos|mes) (?:les |deux |trois )?petits\b(?!\s+(?:lacs?|villages?|chemins?|sentiers?|ports?|sommets?|cols?|prix|budget))/.test(plain)
  );
}

/** Région d'un sentier célèbre nommé comme un lieu (« GR34 », « Tour du Mont-Blanc »), sinon null. */
export function trailRegion(place: string): string | null {
  const plain = plainOf(place);
  return FAMOUS_TRAILS.find(([re]) => re.test(plain))?.[1] ?? null;
}

/**
 * Le sentier célèbre nommé dans un texte, avec son tronçon (« GR20 sud »), sinon null. Le nom est
 * celui du tableau (« gr 20 » → « GR20 »), le tronçon celui de la phrase.
 */
export function famousTrailIn(text: string): string | null {
  const plain = plainOf(text);
  for (const [re, , label] of FAMOUS_TRAILS) {
    const m = re.exec(plain);
    if (!m) continue;
    // « est » est aussi le verbe (« le GR20 est magnifique ») : il n'est un tronçon qu'en fin de segment
    // (ponctuation, fin de phrase, « en », chiffre). « ouest » n'est jamais un verbe (« le GR10 ouest est dur »).
    const tail = /^\s+(?:(nord|sud|ouest)\b|(est)(?=\s*(?:[,.;:!?)]|$|en\b|\d)))/.exec(plain.slice((m.index ?? 0) + m[0].length));
    const side = tail?.[1] ?? tail?.[2];
    return side ? `${label} ${side}` : label;
  }
  return null;
}

/** Un parcours (du catalogue) qui porte le nom de ce sentier (« GR 20 » pour « GR20 »). */
export function sameTrailName(name: string, trail: string): boolean {
  const squash = (t: string) => plainOf(t).replace(/[^a-z0-9]+/g, '');
  const want = squash(trail);
  return want.length >= 3 && squash(name).includes(want);
}

/**
 * Nom propre d'un sentier (une envie ou une destination) : un sentier célèbre, un code (« GR 34 »,
 * « HRP »), « chemin / sentier » suivi d'un nom propre (« Chemin de Stevenson », « Sentier des
 * Douaniers »), « camino… », « alta via… », « haute route… », « … way / trail / track / trek ». Pas
 * une forme d'itinéraire (« tour du lac », « traversée des Alpes »), que le calcul sait faire, ni un
 * nom commun (« chemin de halage », « sentier côtier », « sentier botanique », « chemin de fer »).
 */
export function isNamedTrail(label: string): boolean {
  const raw = label.normalize('NFC').trim();
  const plain = plainOf(raw);
  if (FAMOUS_TRAILS.some(([re]) => re.test(plain))) return true;
  if (/^(?:gr|grp|hrp)\s?\d|^(?:camino|alta via|haute route)\s|\s(?:way|trail|track|trek)$/.test(plain)) return true;
  // « chemin » et « sentier » sont des mots courants : le nom propre qui les suit (majuscule ou chiffre
  // après l'éventuelle préposition) fait le sentier ; Compostelle et Saint-Jacques se disent aussi en minuscules.
  return (
    /^(?:[Cc]hemin|[Ss]entier)\s+(?:(?:de la|de l['’]|du|des|de|d['’])\s*)?[\p{Lu}\d]/u.test(raw) ||
    /^(?:chemin|sentier)\s+(?:de |du )?(?:compostelle|saint[- ]jacques|santiago)\b/.test(plain)
  );
}

/** Noms communs de paysage ou de moment : jamais une destination à eux seuls. */
const COMMON_PLACE_WORDS =
  /^(?:soleil|chaleur|calme|repos|detente|vacances|bois|foret|forets|montagnes?|campagne|nature|mer|plage|plages|neige|environs|alentours|coin|region|parc|fjords?|calanques?|lacs?|riviere|vallee|ville|famille|couple|groupe|solo|van|velo|pied|cheval|ski|bord|mer|lac|journee|semaine|soiree|matinee|apres-?midi|hiver|ete|automne|printemps|depart|partant)$/;

/**
 * Fin d'un nom de lieu : un mot qui ouvre une autre idée (durée, date,
 * compagnie, lieu de départ). « du », « le », « la » ne coupent que devant un
 * nombre (« Afrique du Sud », mais « Vercors du 3 au 10 juin »).
 */
const PLACE_END =
  /\s(?:(?:du|le|la|les)(?=\s+(?:\d|mois\b|semaine\b|prochaine?\b))|du (?:nord|sud|centre) (?:au|jusqu['’]au) (?:nord|sud|centre)|d['’](?:est|ouest) en (?:est|ouest)|de l['’](?:est|ouest) (?:a|à) l['’](?:est|ouest)|near|around|close to|pr[eè]s de|à côté de|a cote de|jusqu['’](?:au|aux|à|a|en)|pour|avec|en|a|à|à partir|pendant|durant|sur|et|sans|budget|plage|plages|temples?|musees?|fjords?|autour|via|pas|safari|un|une|deux|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|cette|ce|tout|toute|semaines?|jours?|nuits?|days?|weeks?|nights?|for|from|to|until|week[- ]?end|début|debut|mi|fin|noël|noel|pâques|paques|toussaint|demain|après-demain|apres-demain|aujourd['’]hui|prochain|prochaine|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|depuis|au départ|au depart|en partant|on part|je pars|nous partons)(?=[\s-]|$)/i;

/**
 * Fin d'un lieu de DÉPART, en plus de `PLACE_END` : ce qui continue la phrase
 * après lui (« Lyon vers le Vercors », « Chamonix jusqu'à Zermatt », « Paris par
 * le train », « Marseille puis retour », « Marseille ou Nice »).
 */
const ORIGIN_END = /\s(?:(?:vers|dans|par|puis|ou|ensuite|apres|après|direction)(?=[\s-]|$)|jusqu)/i;

/** Ce qui annonce le lieu de départ : « depuis Lyon », « au départ de Genève », « en partant d'Annecy ». */
const ORIGIN_LEAD =
  /(?:^|[\s,(])(?:depuis|(?:au depart|le depart|depart|en partant|on part|je pars|nous partons) (?:de|du|des|d'))(?:\s+|(?<='))(?!\d)/g;

/**
 * Premier mot, après « depuis » dans une phrase sans majuscule, qui n'est jamais
 * un lieu de départ : un moment, un déterminant ou un nom commun de lieu. Écrits
 * sans accent : le mot testé est déjà normalisé. Un départ faux est appliqué
 * sans qu'on le voie : mieux vaut en manquer un que d'en inventer un.
 */
const NOT_ORIGIN_WORDS = [
  // moments et durées
  'longtemps', 'toujours', 'hier', 'demain', "aujourd'hui", 'lendemain', 'veille', 'matin', 'soir', 'nuit',
  'midi', 'minuit', 'debut', 'semaines?', 'mois', 'ans?', 'jours?', 'heures?', 'week-?end', 'temps', 'zero',
  // quantités, liaisons, déterminants
  'peu', 'plus', 'moins', 'tout', 'toute', 'tous', 'plusieurs', 'quelques', 'chez', 'que', 'qu', 'quand', 'ici',
  'des', 'ce', 'cet', 'cette', 'ces', 'les', 'bon', 'bonne', 'principe',
  // possessifs : « depuis votre arrivée », « depuis ton départ » (jamais un nom de lieu)
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  // adverbes et mots de liaison : « depuis tôt », « depuis environ un mois », « depuis cela »
  'tot', 'tard', 'deja', 'maintenant', 'bientot', 'presque', 'environ', 'cela', 'ceci', 'combien', 'petit',
  'petite', 'derniere', 'dernier', 'annee', 'autre', 'autres', 'meme', 'chaque', 'avant', 'lors', 'pres', 'loin',
  // noms communs de lieu : sans « de X » derrière, pas un lieu (« gare de X » est lue à part)
  'sommet', 'maison', 'boulot', 'travail', 'bureau', 'parking', 'refuge', 'village', 'col', 'gare', 'aeroport',
  'station', 'nord', 'sud', 'est', 'ouest',
  // hébergement et lieux de vie ou d'études
  'camping', 'hotel', 'chalet', 'gite', 'cabane', 'hameau', 'centre', 'fac', 'lycee', 'ecole', 'ferme', 'abri',
  'bivouac', 'camp', 'auberge', 'appartement', 'appart', 'studio', 'chambre', 'tente', 'domicile', 'hopital',
  'universite', 'college', 'mairie', 'eglise', 'quartier', 'residence', 'restaurant',
  // transport et chemins
  'port', 'pont', 'sentier', 'chemin', 'piste', 'voiture', 'train', 'bus', 'route', 'bateau', 'avion', 'metro',
  'tram', 'taxi',
  // relief et eau
  'pic', 'cime', 'crete', 'source', 'massif', 'ile', 'plage', 'colline', 'glacier', 'falaise', 'plateau',
  'grotte', 'gorges', 'fleuve', 'chateau',
];
const NOT_ORIGIN = new RegExp(`^(?:${NOT_ORIGIN_WORDS.join('|')})$`);

/**
 * Mots qui ne prolongent jamais un nom de lieu de départ tapé sans majuscule : le
 * lieu s'arrête avant (« depuis lyon vendredi », « depuis lyon svp », « depuis
 * lyon fin juin », « depuis lyon pendant les vacances »). Sans accent.
 */
const LOWER_ORIGIN_STOP = [
  // liaisons et compagnie
  'pour', 'avec', 'en', 'a', 'et', 'du', 'de', 'des', 'le', 'la', 'les', 'sans', 'dans', 'sur', 'pendant', 'vers',
  'depuis', 'par', 'puis', 'ou', 'ensuite', 'apres', 'direction', "jusqu[a-z']*", 'ce', 'cet', 'cette',
  // moments
  'demain', 'apres-demain', "aujourd'hui", 'prochain', 'prochaine', 'matin', 'soir', 'midi', 'fin', 'lundi',
  'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'hiver', 'ete', 'printemps', 'automne',
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre',
  'decembre', 'week-?end', 'jours?', 'semaines?', 'nuits?', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six',
  'sept', 'huit', 'neuf', 'dix', 'quinze', 'vingt',
  // la suite de la demande ou de la phrase
  'on', 'je', 'nous', 'tu', 'il', 'ils', 'elle', 'elles', 'vous', 'retour', 'rentre', 'rentrer', 'rentrons',
  'svp', 'stp', 'merci', 'rando', 'randonnee', 'train', 'trek', 'trekking', 'velo', 'ski', 'sortie', 'voyage', 'bivouac',
];
const LOWER_ORIGIN = new RegExp(
  `^([a-z][a-z'-]{2,}(?:\\s(?!(?:${LOWER_ORIGIN_STOP.join('|')})\\b)[a-z][a-z'-]{2,})?)`
);

const LOWER_STOP_FIRST = new RegExp(`^(?:${LOWER_ORIGIN_STOP.join('|')})$`);

/** Un mot qui ne peut pas faire partie d'un nom de lieu de départ tapé en minuscules. */
function notNameWord(word: string): boolean {
  return (
    NOT_ORIGIN.test(word) ||
    LOWER_STOP_FIRST.test(word) ||
    WEEKDAYS.includes(word) ||
    COMMON_PLACE_WORDS.test(word) ||
    toNumber(word) != null ||
    notAPlace(word)
  );
}

/** Mots qui relient les parties d'un nom propre (« Saint-Jean-de-Luz », « Aix-les-Bains », « Boulogne-sur-Mer »). */
const NAME_LINKS = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'sur', 'en', 'sous', 'lez', 'et', "d'", "l'"]);

/**
 * « Bourg en Bresse », « La Roche sur Yon », « Saint Pierre et Miquelon » : « en », « sur » ou « et »
 * suivi d'un nom propre peut faire partie du nom du départ, ou ouvrir une autre idée
 * (« depuis Lyon en Corse »). Rien dans la phrase ne départage les deux : le nom long
 * est proposé à côté du nom court, et la carte tranche (`settleLinkedOrigin`).
 * Ni un moment, ni un transport, ni un nom commun (« en juin », « en train », « en famille »).
 * `end` est la fin du nom court dans `src` ; `plain` est `src` normalisé, aux mêmes positions ;
 * `lead` est l'article tombé devant le nom court (« la », « l' »), s'il y en a un.
 */
function linkedName(src: string, plain: string, end: number, place: string, lead: string): string | undefined {
  const link = /^\s+(en|sur|et)\s+/.exec(plain.slice(end, end + 12));
  if (!link) return undefined;
  // « sur la Sorgue », « sur l'Isère » : l'article fait partie du bout du nom.
  const article = /^(?:(?:la|le|les)\s+|l['’])/.exec(plain.slice(end + link[0].length, end + link[0].length + 6))?.[0] ?? '';
  const from = end + link[0].length + article.length;
  const named = /^\p{Lu}[\p{L}'’]*(?:[\s-]\p{Lu}[\p{L}'’]*)*/u.exec(src.slice(from, from + 60));
  if (!named || notAPlace(named[0])) return undefined;
  const tail = src.slice(from - article.length, from) + named[0];
  // L'article tombé devant le nom court en fait partie (« la roche sur yon » → « La Roche sur yon »).
  const longer = capitalized(`${lead}${place} ${link[1]} ${tail}`);
  return longer.length <= 80 ? longer : undefined;
}

/**
 * Phrase sans majuscule : le lecteur s'arrête à deux mots et à tout connecteur, donc
 * « saint jean de luz » se lit « Saint Jean », « aix les bains » « Aix ». Le nom prolongé
 * par ses connecteurs (de, du, des, le, la, les, sur, en, sous, lez) et les mots qui les
 * suivent est proposé comme nom long, jusqu'au premier mot qui n'est pas un bout de nom
 * (un moment, un transport, un nom commun, un mot de la suite de la phrase). La carte tranche.
 */
function lowerLinkedName(src: string, plain: string, end: number, place: string, lead: string): string | undefined {
  let pos = end;
  let lastName = end;
  for (let i = 0; i < 6; i += 1) {
    const m = /^\s+([a-z][a-z'-]*)/.exec(plain.slice(pos, pos + 30));
    if (!m) break;
    const word = m[1];
    const link = word.startsWith("d'") || word.startsWith("l'") ? word.slice(0, 2) : word;
    if (NAME_LINKS.has(link) && link === word) {
      pos += m[0].length;
      continue;
    }
    // « d'olonne » : le bout du nom est ce qui suit l'apostrophe.
    const core = word.includes("'") ? word.slice(word.lastIndexOf("'") + 1) : word;
    if (core.length < 2 || notNameWord(core)) break;
    pos += m[0].length;
    lastName = pos;
  }
  if (lastName === end) return undefined;
  const longer = capitalized(`${lead}${place}${src.slice(end, lastName)}`);
  return longer.length <= 80 ? longer : undefined;
}

/** « la gare de Briançon », « l'aéroport de Lyon » : le lieu de départ est ce qui suit « de ». */
const FACILITY = /^(?:gare|aeroport|station)\s+(?:de la\s+|de l'\s*|du\s+|des\s+|de\s+|d'\s*)/;

/**
 * Lieu de départ dit dans la phrase (« depuis Lyon », « depuis la Suisse »,
 * « au départ du Grand-Bornand ») et sa place dans `src`, pour que la
 * destination ne le reprenne jamais. Nom propre seulement ; dans une phrase
 * tapée sans majuscule, après « depuis » ou « au départ de » seulement, le mot
 * qui suit s'il n'est ni un moment ni un nom commun (`NOT_ORIGIN_WORDS`).
 * `plain` est `src` normalisé, aux mêmes positions.
 */
function readOrigin(
  src: string,
  plain: string,
  en = false
): { place: string; longer?: string; start: number; end: number } | null {
  const lower = !/\p{Lu}/u.test(src);
  const leads = [...plain.matchAll(ORIGIN_LEAD)];
  // « from Lyon » (anglais) : après les formes françaises, nom propre seulement.
  if (en) leads.push(...[...plain.matchAll(ORIGIN_LEAD_EN)].map((m) => Object.assign(m, { english: true })));
  for (const m of leads) {
    const english = 'english' in m;
    let at = (m.index ?? 0) + m[0].length;
    // « depuis la Suisse » : l'article en minuscule tombe ; « depuis Le Puy » le garde.
    const article = /^(?:(?:la|le|les)\s+|l['’]\s*)/.exec(src.slice(at));
    const dropped = article && !/^\p{Lu}/u.test(src.slice(at)) ? article[0] : '';
    at += dropped.length;
    const original = src.slice(at, at + 60);
    if (properLead(original)) {
      // « depuis GR20 » : un code de sentier, pas un lieu de départ.
      if (/^\p{Lu}{1,4}\s?\d/u.test(original)) continue;
      const head = original.split(/[,.;!?\d]/)[0].split(PLACE_END)[0].split(ORIGIN_END)[0];
      const place = clean(en ? cutEn(head, true) : head, 50).replace(
        /\s+(?:dans|in|sur|vers|près|pres)$/i,
        ''
      );
      if (place.length >= 2 && !notAPlace(place, en) && !(english && enStopLead(place))) {
        const end = at + place.length;
        const longer = linkedName(src, plain, end, place, dropped);
        return { place, ...(longer ? { longer } : {}), start: at, end };
      }
      continue;
    }
    if (!lower || english) continue;
    // Phrase sans majuscule : « depuis » et « au départ de » seulement. « je pars de nuit »,
    // « on part du principe que » ne disent pas d'où l'on part (la majuscule le montre).
    if (!/\b(?:depuis|au depart)\b/.test(m[0])) continue;
    const from = at + (FACILITY.exec(plain.slice(at, at + 60))?.[0].length ?? 0);
    const low = LOWER_ORIGIN.exec(plain.slice(from, from + 60));
    const words = low ? low[1].trim() : '';
    const first = words.split(/\s/)[0];
    if (
      !words ||
      NOT_ORIGIN.test(first) ||
      WEEKDAYS.includes(first) ||
      COMMON_PLACE_WORDS.test(first) ||
      toNumber(first) != null ||
      notAPlace(words)
    )
      continue;
    const place = words.split(/\s/).map(capitalized).join(' ');
    const longer = lowerLinkedName(src, plain, from + words.length, place, dropped);
    return { place, ...(longer ? { longer } : {}), start: from, end: from + words.length };
  }
  return null;
}

/**
 * « sans voiture », « sans louer de voiture », « pas de voiture », « en transports en commun »,
 * « without a car », « car-free » (texte « plain »). Pas « village sans voiture » : c'est un lieu
 * qui est décrit, pas une préférence. Le nom du véhicule n'est pas suivi d'un trait d'union ni
 * d'une lettre : « sans auto-stop » (l'auto-stop est à éviter, la voiture non), « sans voiture-balai ».
 */
const CAR_FREE_SOURCE = [
  `(?<!\\b(?:village|station|ville|zone|ile|centre|quartier|rue|route|vallee|hameau|domaine|plage|parc|site)s?\\s)\\b(?:sans|pas)\\s+(?:(?:louer|location|prendre|conduire|utiliser)\\s+)?(?:(?:la|une|ma|notre|des|de)\\s+|d')?(?:voiture|vehicule|auto|bagnole)s?(?![-\\w])`,
  // Pas « car free » avec une espace : « rental car free of charge » ne dit rien du voyage.
  `\\bwithout\\s+(?:a\\s+|any\\s+|the\\s+)?(?:car|vehicle)s?(?![-\\w])|\\bcar-?free\\b|\\bno car(?![-\\w])`,
  `\\b(?:en|par les|via les|avec les|uniquement en)\\s+transports?\\s+en\\s+commun\\b`,
].join('|');

/** Où la phrase dit « sans voiture » (début, fin dans le texte « plain »). */
function carFreeSpans(plain: string): Array<[number, number]> {
  return [...plain.matchAll(new RegExp(CAR_FREE_SOURCE, 'g'))].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
}

/** « en voiture », « avec ma/notre/la voiture », « by car » : la personne vient avec sa voiture. */
const OWN_CAR_SOURCE = [
  `\\ben\\s+(?:voiture|vehicule|auto|bagnole)s?(?![-\\w])`,
  `\\bavec\\s+(?:ma|mon|notre|nos|la|sa|leur)\\s+(?:voiture|vehicule|auto|bagnole)(?![-\\w])`,
  `\\bby\\s+car(?![-\\w])|\\b(?:with|in)\\s+(?:my|our|the)\\s+car(?![-\\w])`,
].join('|');

/**
 * La phrase dit-elle aussi qu'on vient avec sa voiture (hors d'une plage « sans voiture » et hors
 * d'une négation : « je ne viens pas en voiture ») ? Alors ce n'est pas « sans voiture » : le trajet
 * d'approche se fait en voiture, il ne doit pas être traité comme absent.
 */
function drivesOwnCar(plain: string, spans: Array<[number, number]>): boolean {
  for (const m of plain.matchAll(new RegExp(OWN_CAR_SOURCE, 'g'))) {
    const at = m.index ?? 0;
    if (spans.some(([from, to]) => at >= from && at < to)) continue;
    const clauseStart =
      Math.max(plain.lastIndexOf(',', at), plain.lastIndexOf(';', at), plain.lastIndexOf(':', at), plain.lastIndexOf('.', at)) + 1;
    const before = plain.slice(Math.max(clauseStart, at - 40), at);
    if (/\b(?:pas|sans|jamais|ni|aucun|aucune|not|never|no|without)\b/.test(before)) continue;
    return true;
  }
  return false;
}

/** « Sans voiture » est dit, et la phrase ne dit pas le contraire. */
function saysCarFree(plain: string): boolean {
  const spans = carFreeSpans(plain);
  return spans.length > 0 && !drivesOwnCar(plain, spans);
}

/** Dormir dehors, dit dans la phrase (texte « plain »). */
const SLEEP_OUTSIDE = /\b(bivouac|bivouaquer|bivouaque|sous (?:la )?tente|camper|camping(?![- ]car)|dormir dehors|belle etoile)\b/;

/**
 * La distance se dit par jour (« 15 km par jour », « 20 km/jour », « 20 km per day ») : elle ne dit
 * rien de la durée du voyage. S'applique au texte qui SUIT la distance (texte « plain »).
 */
const DISTANCE_PER_DAY = /^[^,.;!?]{0,20}?(?:\bpar jour\b|\bpar j\b|\/\s*(?:jour|j)\b|\bper day\b|\ba day\b|\bchaque jour\b|\bquotidien\w*)/;

/**
 * Partenaire dit comme compagnon de voyage (« avec ma femme », « with my husband ») : un groupe de
 * deux, sauf si d'autres personnes suivent (« avec ma femme et nos 3 enfants »).
 */
const PARTNER_COMPANION =
  /\b(?:avec (?:ma|mon) (?:copine|copain|femme|mari|compagne|compagnon|cherie|cheri|amoureuse|amoureux|partenaire|moitie|epouse|epoux)|with my (?:girlfriend|boyfriend|wife|husband|partner))\b/;

/** Noms de personnes qui s'ajoutent au partenaire (« et nos 3 enfants », « , mes parents »). Pas un animal, pas un lieu. */
const MORE_PEOPLE = new RegExp(
  '^\\s*(?:,|\\bet\\b|\\band\\b|\\+)\\s*' +
    // Un ou deux déterminants (« toute la famille », « et le petit », « et tous nos amis »).
    "(?:(?:notre|nos|mon|ma|mes|ses|son|sa|leurs?|les|le|la|l'|des|d'|toute|tous|my|our|his|her|the|other)\\s*){0,2}" +
    '(?:(?:\\d+|deux|trois|quatre|cinq|six|un|une|two|three|four)\\s+)?' +
    '(?:(?:petits?|jeunes|grands?|autres?|young|little|other)\\s+)?' +
    '(?:enfants?|gamins?|bebes?|fils|filles?|garcons?|(?:petits?|petites?)(?!\\s+(?:lacs?|villages?|chemins?|sentiers?|ports?|sommets?|cols?|prix|budget))|bambins|jumeaux|jumelles|gosses|loulous|tribu|' +
    'parents?|amis?|amies?|copains|copines|potes|famille|freres?|soeurs?|cousins?|cousines?|neveux|nieces?|' +
    'grands-parents|grand-mere|grand-pere|meres?|peres?|maman|papa|beaux-parents|belle-famille|belle-mere|beau-pere|collegues?|voisins?|ados?|' +
    'adolescents?|couples?|personnes?|adultes?|kids?|children|child|friends?|family|son|daughter|brothers?|sisters?|mother|father|' +
    'cousins|colleagues?|people|persons)\\b'
);

/**
 * Ce qui suit le partenaire ajoute-t-il des personnes ? Un prénom (« et Paul », « , Paul et Marie ») en est
 * une, un animal ou un projet non. « with my wife and I » : « I », c'est moi, pas une personne de plus.
 */
function morePeopleAfter(rest: string, srcRest: string): boolean {
  return (
    MORE_PEOPLE.test(rest) ||
    /^\s*(?:\bet\b|\band\b)\s+(?!I\b)\p{Lu}/u.test(srcRest) ||
    // Après une virgule, une liste de prénoms seulement (« , Paul et Marie ») : « , Annecy » reste un lieu.
    /^\s*,\s*(?!I\b)\p{Lu}[\p{L}'’-]*\s*(?:,|\bet\b|\band\b)\s*\p{Lu}/u.test(srcRest)
  );
}

/** Fête dite en anglais (« Christmas », « Easter ») : la prochaine à partir d'aujourd'hui. */
function holidayDateEn(plain: string, today: string): string | null {
  const kind = HOLIDAYS_EN.find(([re]) => re.test(plain))?.[1];
  if (!kind) return null;
  const at = (y: number) => (kind === 'christmas' ? `${y}-12-25` : kind === 'newyear' ? `${y}-12-31` : easterSunday(y));
  const year = Number(today.slice(0, 4));
  return at(year) >= today ? at(year) : at(year + 1);
}

/**
 * `locale` : langue de l'interface (`'fr'` par défaut). Les règles anglaises
 * (PLAN-100 6.2) s'ajoutent aux françaises quand l'interface est en anglais ou
 * que la phrase est sans équivoque anglaise (`looksEnglish`) ; une phrase
 * française sans locale est lue exactement comme avant.
 */
export function parseIntentRules(
  text: string,
  today: string,
  locale: Locale = 'fr',
  context: RulesContext = {}
): CompasIntentAction[] {
  // Espagnol, allemand, italien : la phrase est réécrite en anglais simple puis lue par les
  // règles anglaises ; une phrase française ou anglaise ne passe jamais par là (`detectPivot`).
  const pivot = detectPivot(text.normalize('NFC'), PIVOT_LIST, locale);
  if (pivot) return parseRulesCore(pivotText(text, PIVOTS[pivot], today), today, 'en', true, context);
  return parseRulesCore(text, today, locale, false, context);
}

/** Ce que la lecture sait en dehors de la phrase. */
export interface RulesContext {
  /**
   * L'activité choisie ailleurs que dans la phrase (« Préciser », bouton du voyage, ou celle que l'IA a
   * lue), quand la phrase n'en dit pas : « dans le Jura de Gex à Pontarlier » à pied fait l'itinéraire
   * de Gex à Pontarlier (`walksOrRides`). Jamais devinée ici.
   */
  activity?: CompasActivity | null;
}

function parseRulesCore(
  text: string,
  today: string,
  locale: Locale,
  pivoted = false,
  context: RulesContext = {}
): CompasIntentAction[] {
  const src = text.normalize('NFC').slice(0, 400);
  const en = locale === 'en' || looksEnglish(src);
  // Nombres en lettres écrits en chiffres, aux mêmes positions que dans `src`.
  const frPlain = spellNumbers(plainOf(src));
  const plain = en ? spellNumbersEn(frPlain) : frPlain;
  const out: CompasIntentAction[] = [];
  // Mois : en anglais, les abrégés aussi (« Oct 12 »), jamais le début d'un mot (« Marrakech »).
  const MR = en ? `(${MONTH_RE.slice(1, -1)}|${EN_MONTH_ABBR})(?![a-z])` : MONTH_RE;
  const EN_M = `(january|february|march|april|may|june|july|august|september|october|november|december|${EN_MONTH_ABBR}|oct\\.?|nov\\.?|dec\\.?)(?![a-z])`;
  const notPlace = (name: string) => notAPlace(name, en);
  // Jour et mois d'une date « 25/12 » : en anglais, l'ordre ambigu (« 10/12 ») n'est jamais deviné.
  const slashDate = (from: string, a: number, b: number, year: number | null) => {
    if (!en) return dayMonthAnyOrder(from, a, b, year);
    const order = slashOrderEn(a, b);
    return order ? resolveDayMonth(from, order[0], order[1], year) : null;
  };

  /* Dates */
  let start: string | null = null;
  let end: string | null = null;
  // « dans 3 semaines », « dans quinze jours » : un départ, pas une durée.
  const inSaid = new RegExp(`\\b(?:dans|in)\\s+${NUM}\\s*(jours?|j|semaines?|mois|days?|weeks?|months?)\\b`).exec(plain);
  // Anglais : « from Nantes to Bordeaux in 6 days » dit le temps du parcours, pas le départ.
  const inN =
    en && inSaid && /^in\b/.test(inSaid[0]) && /\bfrom\s+\S.*\bto\s+\S/.test(plain.slice(0, inSaid.index)) ? null : inSaid;
  const iso = [...plain.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map((m) =>
    resolveDayMonth(today, Number(m[3]), Number(m[2]), Number(m[1]))
  );
  const slashRange = new RegExp(
    `\\b(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?\\s*(?:au|al|a|hasta el|hasta|fino al|fino a|bis zum|bis|-|–|->|jusqu'au${en ? '|to|until|till|through' : ''})\\s*(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?\\b`
  ).exec(plain);
  // Anglais : le mois avant le jour (« from July 3 to July 12 », « July 3rd »).
  const EN_MONTH = '(january|february|march|april|may|june|july|august|september|october|november|december)';
  const enRange = (
    en
      ? // « Oct 12 to 15 », « October 12-15 », « from July 3rd through 12th »
        new RegExp(
          `\\b(?:from\\s+)?${EN_M}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|till|through|thru|-|–)\\s*(?:${EN_M}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`
        )
      : new RegExp(
          `\\bfrom\\s+${EN_MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:to|until|-)\\s+(?:${EN_MONTH}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`
        )
  ).exec(plain);
  // Anglais, le jour d'abord (« 12-15 October », « from 3 to 7 August », « 3 Aug to 7 Aug »).
  const enDayRange = en
    ? new RegExp(
        `\\b(?:from\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:of\\s+)?${EN_M})?\\s*(?:to|until|till|through|thru|-|–)\\s*(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${EN_M}`
      ).exec(plain)
    : null;
  const holiday = holidayDate(plain, today) ?? (en ? holidayDateEn(plain, today) : null);
  const enSingle = new RegExp(`\\b${en ? EN_M : EN_MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:days?|nights?|weeks?|jours?|nuits?))`).exec(plain);
  const range = new RegExp(
    `\\bdu\\s+(\\d{1,2})(?:er)?(?:\\s+${MR})?\\s+au\\s+(\\d{1,2})(?:er)?\\s+${MR}(?:\\s+(\\d{4}))?`
  ).exec(plain);
  const single = new RegExp(
    en ? `\\b(\\d{1,2})(?:er|st|nd|rd|th)?\\s+(?:of\\s+)?${MR}(?:\\s+(\\d{4}))?` : `\\b(\\d{1,2})(?:er)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?`
  ).exec(plain);
  const slash = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(plain);
  const yearOf = (y: string | undefined) => (y ? Number(y.length === 2 ? `20${y}` : y) : null);
  if (iso[0]) {
    start = iso[0];
    end = iso[1] && iso[1] >= iso[0] ? iso[1] : null;
  } else if (slashRange) {
    start = slashDate(today, Number(slashRange[1]), Number(slashRange[2]), yearOf(slashRange[3]));
    end = start
      ? slashDate(start, Number(slashRange[4]), Number(slashRange[5]), yearOf(slashRange[6]) ?? Number(start.slice(0, 4)))
      : null;
    if (start && end && end < start)
      end = slashDate(start, Number(slashRange[4]), Number(slashRange[5]), Number(start.slice(0, 4)) + 1);
  } else if (enRange) {
    const m1 = monthOf(enRange[1]) ?? 0;
    const m2 = enRange[3] ? (monthOf(enRange[3]) ?? m1) : m1;
    start = resolveDayMonth(today, Number(enRange[2]), m1, null);
    end = start ? resolveDayMonth(start, Number(enRange[4]), m2, Number(start.slice(0, 4))) : null;
    if (start && end && end < start) end = resolveDayMonth(start, Number(enRange[4]), m2, Number(start.slice(0, 4)) + 1);
  } else if (enDayRange) {
    const m2 = monthOf(enDayRange[4]) ?? 0;
    const m1 = enDayRange[2] ? (monthOf(enDayRange[2]) ?? m2) : m2;
    start = resolveDayMonth(today, Number(enDayRange[1]), m1, null);
    end = start ? resolveDayMonth(start, Number(enDayRange[3]), m2, Number(start.slice(0, 4))) : null;
    if (start && end && end < start) end = resolveDayMonth(start, Number(enDayRange[3]), m2, Number(start.slice(0, 4)) + 1);
  } else if (range) {
    const m2 = monthOf(range[4]) ?? 0;
    const m1 = range[2] ? (monthOf(range[2]) ?? m2) : m2;
    const year = range[5] ? Number(range[5]) : null;
    start = resolveDayMonth(today, Number(range[1]), m1, year);
    end = start
      ? resolveDayMonth(start, Number(range[3]), m2, year ?? Number(start.slice(0, 4)))
      : null;
    if (start && end && end < start)
      end = resolveDayMonth(start, Number(range[3]), m2, Number(start.slice(0, 4)) + 1);
  } else if (single) {
    start = resolveDayMonth(
      today,
      Number(single[1]),
      monthOf(single[2]) ?? 0,
      single[3] ? Number(single[3]) : null
    );
  } else if (enSingle) {
    start = resolveDayMonth(today, Number(enSingle[2]), monthOf(enSingle[1]) ?? 0, null);
  } else if (slash) {
    start = slashDate(today, Number(slash[1]), Number(slash[2]), yearOf(slash[3]));
  } else if (inN) {
    const n = toNumber(inN[1]);
    if (n != null && Number.isInteger(n) && n > 0 && n <= 18) {
      start = /^(mois|month)/.test(inN[2])
        ? addMonthsIso(today, n)
        : addDaysIso(today, /^(semaine|week)/.test(inN[2]) ? n * 7 : n);
    } else if (n != null && Number.isInteger(n) && n > 18 && !/^(mois|month|semaine|week)/.test(inN[2])) {
      start = addDaysIso(today, n);
    }
  } else if (holiday) {
    // « Week-end de la Toussaint » (un dimanche), « de Pâques » : le samedi qui l'ouvre.
    const wd = weekday(holiday);
    start = /\bweek[- ]?end\b/.test(plain) && (wd === 0 || wd === 1) ? addDaysIso(holiday, -(wd + 1)) : holiday;
  } else if (/\bfin de (?:la )?semaine prochaine\b/.test(plain)) {
    start = addDaysIso(nextWeekday(today, 1, true), 5);
  } else if (/\bsemaine prochaine\b|\bnext week\b/.test(plain)) {
    start = nextWeekday(today, 1, true);
  } else if (/\bmois prochain\b|\bnext month\b/.test(plain)) {
    const first = addMonthsIso(`${today.slice(0, 8)}01`, 1);
    const part = /\b(debut|mi|fin)[\s-]+(?:du )?mois prochain\b/.exec(plain)?.[1];
    start = addDaysIso(first, part === 'mi' ? 14 : part === 'fin' ? 21 : 0);
  } else if (/\bapres-demain\b/.test(plain)) {
    start = addDaysIso(today, 2);
  } else if (/\bdemain\b/.test(plain)) {
    start = addDaysIso(today, 1);
  } else if (/\b(aujourd'?hui|ce matin|cet apres-?midi|ce soir|tout a l'heure|maintenant|tout de suite)\b/.test(plain)) {
    start = today;
  } else if (en && /\bday after tomorrow\b/.test(plain)) {
    start = addDaysIso(today, 2);
  } else if (en && /\btomorrow\b/.test(plain)) {
    start = addDaysIso(today, 1);
  } else if (en && /\b(today|this morning|this afternoon|this evening|tonight|right now)\b/.test(plain)) {
    start = today;
  } else if (/\bweek[- ]?end\b/.test(plain) && !(en && /\b(?:leaving|starting|departing|from|on)\s+(?:this\s+|next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(plain))) {
    // « long weekend, leaving Friday » : le jour de départ dit l'emporte (anglais).
    const next = /week[- ]?end prochain|prochain week[- ]?end|next week[- ]?end/.test(plain) && weekday(today) >= 5;
    start = addDaysIso(nextWeekday(today, 6, false), next ? 7 : 0);
    if (weekday(today) === 0) start = addDaysIso(today, 6);
  } else {
    const wd = new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`).exec(plain);
    const wdEn = en ? new RegExp(`\\b(${EN_WEEKDAYS.join('|')})\\b`).exec(plain) : null;
    if (wd) start = nextWeekday(today, WEEKDAYS.indexOf(wd[1]), true);
    else if (wdEn) start = nextWeekday(today, EN_WEEKDAYS.indexOf(wdEn[1]), true);
  }
  // Un mois seul : « en janvier », « début mai », « fin août 2027 ». Le départ
  // se pose au début (au 15 pour « mi », au 22 pour « fin ») ; un « week-end »
  // dans ce mois tombe sur son premier samedi. Ce mois-ci : à partir d'aujourd'hui.
  if (!range && !single && !slash && !iso[0] && !slashRange && !enRange && !enDayRange && !enSingle && !inN && !holiday) {
    const monthOnly = new RegExp(
      `\\b(?:(debut|mi|fin${en ? '|early|mid|middle of|late|beginning of|start of|end of' : ''})[\\s-]+(?:de\\s+|d'${en ? '|the\\s+' : ''})?|en\\s+|in\\s+|${en ? 'during\\s+|' : ''}au mois d[e']\\s*|courant\\s+|(?:premier\\s+|1er\\s+)?week[- ]?end\\s+(?:de\\s+|d')|(?:premiere\\s+)?semaine\\s+(?:de\\s+|d'))${MR}(?:\\s+(\\d{4}))?`
    ).exec(plain);
    const month = monthOnly ? monthOf(monthOnly[2]) : null;
    if (monthOnly && month) {
      const part = monthOnly[1] ?? '';
      const day = /^(?:mi|mid|middle)/.test(part) ? 15 : /^(?:fin|late|end)/.test(part) ? 22 : 1;
      const year = monthOnly[3] ? Number(monthOnly[3]) : null;
      const thisMonth = !year && Number(today.slice(5, 7)) === month && Number(today.slice(8, 10)) >= day;
      let base = thisMonth ? today : resolveDayMonth(today, day, month, year);
      // Ce mois-ci pour un voyage de plusieurs jours (« trek de 12 jours au
      // Népal en octobre », dit en octobre) : pas de départ aujourd'hui, le
      // premier samedi dans deux semaines au moins, s'il est encore dans le mois.
      if (thisMonth && longTrip(plain)) {
        const sat = nextWeekday(addDaysIso(today, 14), 6, false);
        if (Number(sat.slice(5, 7)) === month) base = sat;
      }
      if (base && /\bweek[- ]?end\b/.test(plain)) {
        const sat = nextWeekday(base, 6, false);
        if (Number(sat.slice(5, 7)) === month) base = sat;
      }
      if (base) {
        start = base;
        end = null;
      }
    }
  }
  // Une saison seule : « en hiver », « cet été ». Hémisphère nord, saisons météorologiques ;
  // si la saison est en cours, le départ par défaut (prochain week-end) y tombe déjà.
  if (!range && !single && !slash && !iso[0] && !slashRange && !enRange && !enDayRange && !enSingle && !inN && !holiday && !new RegExp(`\\b${MONTH_RE}`).test(plain) && (start == null || (/\bweek[- ]?end\b/.test(plain) && !/prochain|\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(plain)))) {
    const sm = SEASON_RE.exec(plain);
    if (sm) {
      const season = SEASONS[sm[1]];
      if (!season.months.includes(Number(today.slice(5, 7)))) {
        const base = resolveDayMonth(today, 1, season.first, null);
        if (base) {
          start = base;
          end = null;
        }
      }
    }
  }
  /* Nuits dehors (« dormir dehors 3 nuits », « 3 nuits en bivouac ») : une
     contrainte du projet, pas une durée. Le passage est retiré avant la durée. */
  const OUTSIDE = `(?:dehors|a la belle etoile|en bivouac|sous (?:la )?tente)`;
  const outdoor =
    new RegExp(`\\b${NUM}\\s+nuits?\\s+${OUTSIDE}`).exec(plain) ??
    new RegExp(`\\b(?:dormir|coucher|bivouaquer|passer)\\s+${OUTSIDE}\\s+${NUM}\\s+nuits?\\b`).exec(plain) ??
    new RegExp(`\\b(?:dormir|coucher|passer)\\s+${NUM}\\s+nuits?\\s+${OUTSIDE}`).exec(plain);
  const outdoorCount = outdoor ? toNumber(outdoor[1]) : null;
  if (outdoor && outdoorCount != null && Number.isInteger(outdoorCount) && outdoorCount > 0)
    out.push({ type: 'set_outdoor_nights', nights: outdoorCount });
  const blank = (t: string, m: RegExpExecArray | null) =>
    m ? t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length) : t;
  // Ni les nuits dehors ni « dans 3 semaines » (un départ) ne sont la durée.
  const durPlain = blank(blank(plain, outdoor), inN);

  /* Poids maximal du sac (« rester sous 12 kg ») */
  const pack =
    /\b(?:sous|moins de|max(?:imum)?|pas plus de|au plus|en dessous de|ne pas depasser|limite a|limite de)\s+(\d{1,2}(?:[.,]\d)?)\s*(?:kg|kilos?)\b/.exec(
      plain
    );
  if (pack) {
    const kg = Number(pack[1].replace(',', '.'));
    if (kg >= 1 && kg <= 40) out.push({ type: 'set_max_pack', kg });
  }

  /* Niveau et terrain (seulement quand ils sont dits) */
  if (/\b(debutante?s?|je debute|premiere fois|novices?)\b/.test(plain))
    out.push({ type: 'set_level', level: 'debut' });
  else if (/\b(experimentee?s?|aguerrie?s?|confirmee?s?|experte?s?)\b/.test(plain))
    out.push({ type: 'set_level', level: 'aguerri' });
  else if (/\b(niveau moyen|intermediaire|regulier|reguliere)\b/.test(plain))
    out.push({ type: 'set_level', level: 'regulier' });
  // Le VTT se fait sur les hauteurs (« 3 jours de VTT dans les Vosges » passait par
  // Sarrebourg et Obernai, en plaine, 13 oct.).
  if (/\b(montagnes?|haute altitude|sommets?|vtt|mtb|mountain ?bike|enduro)\b/.test(plain))
    out.push({ type: 'set_terrain', terrain: 'montagne' });
  else if (/\bhors[- ]sentiers?\b/.test(plain)) out.push({ type: 'set_terrain', terrain: 'hors_sentier' });

  /* Durée */
  const dur =
    (en
      ? // « 3-day trek », « two weeks and a half », « a fortnight » (anglais)
        new RegExp(
          `\\b${NUM}\\s*-?\\s*(jours?|j|nuits?|semaines?|mois|days?|nights?|weeks?|months?|fortnights?)(\\s+et\\s+demie?|\\s+and\\s+a\\s+half)?\\b(?![- ]?end)`
        ).exec(durPlain)
      : new RegExp(`\\b${NUM}\\s*(jours?|j|nuits?|semaines?|mois|days?|nights?|weeks?|months?)(\\s+et\\s+demie?)?\\b(?![- ]?end)`).exec(durPlain)) ??
    (/\bdemi-journee\b/.test(plain) ? null : /\b(une|la|1)\s+journee\b/.exec(plain));
  const hoursMatch =
    // « 1h30 », « 2 h 15 » ; jamais les minutes d'un nombre suivi d'une unité (« 1h 10 km »).
    /(?<!(?:\ba|\bvers|depart|depart a|des)\s)\b(\d{1,2})\s*h(?:eures?)?(?:\s*(\d{2})(?!\s*(?:km|kilo|m\b|€|eur|kg|g\b|%|pers|min)))?\b(?!\s*du matin)/.exec(
      plain
    );
  const hoursWord = new RegExp(
    en ? `\\b${NUM}\\s*(?:heures?|hours?|hrs?)(\\s+et\\s+demie|\\s+and\\s+a\\s+half)?\\b` : `\\b${NUM}\\s+heures?(\\s+et\\s+demie)?\\b`
  ).exec(plain);
  // Anglais sans nombre : « a week », « a fortnight », « for a month », « day hike » ; « half a day ».
  const enOne = en
    ? /\b(?:a|an|one)\s+(?:full\s+)?(week|fortnight|month|day|night)\b(?![- ]?end)|\b(day)[- ](?:hike|trip|walk|tour|out)\b/.exec(durPlain)
    : null;
  const enHalfDay = en && /\bhalf[- ](?:a[- ])?day\b/.test(plain);
  if (dur && dur[2]) {
    const n = toNumber(dur[1]);
    const unit = dur[2];
    if (n != null && n > 0) {
      // « deux semaines et demie » : 17 jours ; « un mois » : 30 jours.
      const half = dur[3] ? 0.5 : 0;
      const days = /^(nuit|night)/.test(unit)
        ? n + 1
        : /^(semaine|week)/.test(unit)
          ? Math.floor((n + half) * 7)
          : /^(mois|month)/.test(unit)
            ? Math.round((n + half) * 30)
            : /^fortnight/.test(unit)
              ? Math.floor((n + half) * 14)
              : n;
      out.push({ type: 'set_duration', days: Math.round(days), hours: null });
    }
  } else if (dur) {
    out.push({ type: 'set_duration', days: 1, hours: null });
  } else if (enHalfDay) {
    out.push({ type: 'set_duration', days: null, hours: 4 });
  } else if (enOne) {
    const unit = enOne[1] ?? enOne[2];
    const days = { week: 7, fortnight: 14, month: 30, day: 1, night: 2 }[unit] ?? null;
    if (days) out.push({ type: 'set_duration', days, hours: null });
  } else if (/\bdemi-journee\b/.test(plain)) {
    out.push({ type: 'set_duration', days: null, hours: 4 });
  } else if (hoursWord && !/\b(a|vers|depart|at|around|by)\s+$/.test(plain.slice(0, hoursWord.index))) {
    const n = toNumber(hoursWord[1]);
    if (n != null && n > 0 && n < 24)
      out.push({ type: 'set_duration', days: null, hours: n + (hoursWord[2] ? 0.5 : 0) });
  } else if (hoursMatch) {
    const h = Number(hoursMatch[1]) + (hoursMatch[2] ? Number(hoursMatch[2]) / 60 : 0);
    if (h > 0 && h < 24)
      out.push({ type: 'set_duration', days: null, hours: Math.round(h * 4) / 4 });
  } else if (RU_DAYS.test(src)) {
    // « 5 дней » (russe) : cinq jours ; « 2 недели » : deux semaines.
    const m = RU_DAYS.exec(src)!;
    out.push({ type: 'set_duration', days: Math.min(60, Number(m[1]) * (/^нед/i.test(m[2]) ? 7 : 1)), hours: null });
  } else if (WEEK_OF.test(plain)) {
    // « semaine de surf au Pays basque » : une semaine, dite sans nombre (constat C-013).
    out.push({ type: 'set_duration', days: 7, hours: null });
  } else if (vagueSpan(plain)) {
    // « quelques jours » : aucun nombre n'est dit. Seule la borne sûre du pluriel est posée, dite « au moins ».
    out.push({ type: 'set_duration', days: vagueSpan(plain)!.minDays, hours: null, atLeast: true });
  } else if (/\bweek[- ]?end\b/.test(plain)) {
    out.push({ type: 'set_duration', days: 2, hours: null });
  } else if (/\b(cet apres-?midi|ce matin|ce soir)\b/.test(plain)) {
    // Un moment de la journée sans durée dite : quelques heures, pas un séjour.
    out.push({ type: 'set_duration', days: null, hours: /\bce soir\b/.test(plain) ? 2 : 3 });
  } else if (en && /\b(this afternoon|this morning|this evening|tonight)\b/.test(plain)) {
    out.push({ type: 'set_duration', days: null, hours: /\b(this evening|tonight)\b/.test(plain) ? 2 : 3 });
  } else if (/\bsortie\b/.test(plain)) {
    // « sortie vélo route 80 km » : une sortie sans durée dite tient dans la journée.
    out.push({ type: 'set_duration', days: 1, hours: null });
  }

  // Une sortie de quelques heures sans jour dit : aujourd'hui (proposé, décochable).
  if (!start && out.some((a) => a.type === 'set_duration' && a.days == null && a.hours != null)) start = today;
  if (start) out.unshift({ type: 'set_dates', start, end });

  /* Distance visée (« trail de 20 km ») */
  const km = /\b(\d{1,3}(?:[.,]\d)?)\s*(?:km|kilometres?)\b/.exec(plain);
  if (km) {
    const n = Number(km[1].replace(',', '.'));
    if (n >= 1 && n <= 300) out.push({ type: 'set_distance', km: n });
    // « marche 10 km en bord de mer » sans durée dite : une sortie qui tient dans la
    // journée, pas un séjour d'une semaine (elle a pris 7 jours, 13 oct.).
    // Pas la journée quand la distance se dit par jour (« 15 km par jour »), ni quand la phrase parle
    // de nuits, d'un trek, d'une itinérance ou d'un sentier nommé : la distance ne borne alors pas la
    // durée (« 3 nuits sous tente, 15 km par jour » passait à 1 jour, « Laugavegur 55 km » aussi).
    const perDay = DISTANCE_PER_DAY.test(plain.slice((km.index ?? 0) + km[0].length));
    const multiDay =
      out.some((a) => a.type === 'set_outdoor_nights') ||
      SLEEP_OUTSIDE.test(plain) ||
      (en && NIGHTS_EN.bivouac.test(plain)) ||
      /\bnuits?\b|\bnights?\b/.test(plain) ||
      /\btreks?\b|\btrekking\b|\bitinerance\b|\bitinerant\w*|\b(?:gr|grp|hrp) ?\d/.test(plain) ||
      famousTrailIn(src) != null;
    const dayReach = /\b(?:velo|vtt|gravel|cyclo|bike|cycling|biking)\b/.test(plain) ? 200 : 60;
    if (n >= 1 && n <= dayReach && !perDay && !multiDay && !out.some((a) => a.type === 'set_duration'))
      out.push({ type: 'set_duration', days: 1, hours: null });
  }

  /* Personnes */
  const counted = new RegExp(
    `\\b${NUM}\\s+(personnes?|pers\\b|randonneurs?|adultes?|amis|copains|participants${en ? '|of us|people|persons|ppl\\b|pax\\b|adults?|friends|hikers|travell?ers' : ''})`
  ).exec(plain);
  // Anglais : « we are 6 », « party of 4 », « for 4 » ; jamais « a 3 day hike » ni « for 5 days ».
  const EN_LEADS = "|we are|we're|we'll be|we will be|there are|there will be|party of|group of|family of|team of|for|total of";
  const EN_UNITS = '|[- ]?(?:days?|nights?|weeks?|months?|fortnights?|hours?|hrs?|miles?|mi\\b|ft\\b|feet|bucks|years?|yrs?|am\\b|pm\\b|st\\b|nd\\b|rd\\b|th\\b)|[-/:.,]\\d';
  const afterAll = new RegExp(
    `\\b(?:a|pour|on est|on sera|nous sommes|nous serons|(?:une |en )?famille de|(?:un )?groupe de|bande de|equipe de${en ? EN_LEADS : ''})\\s+${NUM}\\b(?!\\s*(?:jours?|j\\b|h\\b|heures?|nuits?|km|kilos?|kg|g\\b|m\\b|metres?|€|euros?|eur\\b|semaines?|mois|min|%|ans|personnes?|k\\b|\\$|£|¥|dollars?|livres?|chf|usd|gbp|cad${en ? EN_UNITS : ''}))`,
    'g'
  );
  // « nous sommes une famille de 5 » : « une » est un article, le nombre vient après.
  const after = [...plain.matchAll(afterAll)].find((m) => !/^(un|une)$/.test(m[1])) ?? null;
  const people = counted ?? after;
  const total = partySum(plain, en);
  // « with my wife and 2 kids » : moi et ceux qui viennent ; « with the kids » (sans nombre) : non compris.
  const companyEn = en && total == null ? companionsParty(plain) : undefined;
  const companyFr = total == null && companyEn === undefined ? companionsPartyFr(plain, src) : null;
  const company = companyEn !== undefined ? companyEn : companyFr != null ? companyFr : undefined;
  if (total != null) {
    out.push({ type: 'set_party_size', count: total });
  } else if (company !== undefined) {
    if (company != null) out.push({ type: 'set_party_size', count: company });
  } else if (people) {
    const n = toNumber(people[1]);
    if (n != null && Number.isInteger(n) && n >= 1 && (!en || n <= 99)) out.push({ type: 'set_party_size', count: n });
  } else if (/\b(en solo|seul|seule)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 1 });
  } else if (/\b(?:en couple|en duo|en amoureux)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 2 });
  } else if (en && /\b(solo|alone|on my own|by myself|just me)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 1 });
  } else if (en && /\bas a couple\b|\bcouple'?s? (?:trip|holiday|getaway)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 2 });
  } else {
    // « avec ma femme » : deux, sauf si d'autres personnes suivent (« avec ma femme et nos 3 enfants »).
    // « à deux » dit seul (« week-end à deux ») est lu plus haut, comme « à 2 » ; « à deux heures de
    // Paris », « d'une à deux semaines » ne sont pas un groupe.
    const partner = PARTNER_COMPANION.exec(plain);
    const partnerEnd = partner ? (partner.index ?? 0) + partner[0].length : 0;
    if (partner && !morePeopleAfter(plain.slice(partnerEnd), src.slice(partnerEnd)))
      out.push({ type: 'set_party_size', count: 2 });
  }

  /* Enveloppe : « 800 € », « 2000 $ », « 1,500 € », « 3k€ », « budget de 1 500 » */
  const money = readMoney(plain, src);
  if (money && money.amount <= 1_000_000)
    out.push({
      type: 'set_budget',
      amount: money.amount,
      ...(money.currency ? { currency: money.currency } : {}),
      // « 50 € par personne » : multiplié par le groupe à la validation, jamais lu comme l'enveloppe du groupe.
      ...(saidPerPerson(plain, money) ? { perPerson: true as const } : {}),
    });

  /* Rythme */
  if (
    /\b(tranquille|tranquillement|cool|doucement|pepere|zen|lentement|sans forcer)\b/.test(plain)
  ) {
    out.push({ type: 'set_pace', pace: 'tranquille' });
  } else if (/\b(soutenu|rapide|sportif|sportive|intense|vite|engage)\b/.test(plain)) {
    out.push({ type: 'set_pace', pace: 'soutenu' });
  } else if (/\brythme normal\b/.test(plain)) {
    out.push({ type: 'set_pace', pace: 'normal' });
  } else if (withChildren(plain)) {
    // Des enfants dans le groupe : des journées courtes (22 km par jour avec un enfant de 6 ans, 13 oct.).
    out.push({ type: 'set_pace', pace: 'tranquille' });
  }

  /* Nuits */
  const nights = new Set<CompasNights>();
  if (!outdoor && SLEEP_OUTSIDE.test(plain)) nights.add('bivouac');
  if (/\brefuges?\b/.test(plain)) nights.add('refuge');
  if (/\b(gites?|hotels?|chambres? d'hotes?|auberges?|hebergements?)\b/.test(plain))
    nights.add('hebergement');
  if (en) {
    if (!outdoor && NIGHTS_EN.bivouac.test(plain)) nights.add('bivouac');
    if (NIGHTS_EN.refuge.test(plain)) nights.add('refuge');
    if (NIGHTS_EN.hebergement.test(plain)) nights.add('hebergement');
  }
  if (nights.size === 1) out.push({ type: 'set_nights', nights: [...nights][0] });
  else if (nights.size > 1) out.push({ type: 'set_nights', nights: 'mixte' });

  /* Activité (seulement quand elle est nommée) */
  // Du plus précis au plus large : « ski de rando » est du ski, pas une rando.
  const activity: Array<[RegExp, CompasActivity]> = [
    [/\b(ski|skis|skier|skiing|freeride|splitboard|raquettes?|snowshoeing)\b/, 'ski'],
    [/\b(alpinisme|alpi|cordee|glacier|course d'arete|4000|mountaineering)\b/, 'mountaineering'],
    [/\b(trail|ultra-?trail|skyrace)\b/, 'trail'],
    [/\b(courir|course a pied|footing|jogging|running|fractionne|run)\b/, 'running'],
    [/\b(escalade|grimpe|grimper|bloc|via ferrata|falaise|climbing|bouldering)\b/, 'climbing'],
    [/\b(velo|velos|bikepacking|cyclo|cyclotourisme|vtt|gravel|cycling|biking|bike)\b/, 'cycling'],
    [/\b(kayak|kayaking|canoe|canoes|canoeing|paddle|paddling|packraft|rafting|voile|voilier|sailing|plongee|diving|snorkeling|surf|surfing)\b/, 'water'],
    [/\b(van|vanlife|camping[- ]car|fourgon|fourgonnette)\b/, 'vanlife'],
    [/\b(city ?trip|citytrip)\b/, 'citytrip'],
    [/\b(plage|plages|farniente|bord de mer|baignade|beach)\b/, 'beach'],
    [/\b(rando+s?|randon+ee?s?|hiking|hike|marche nordique|marche a pied|a pied|balades?|promenades?)\b|(?<!\b(?:au|du|le|un|des) )\bmarcher?\b/, 'hiking'],
    [/\btreks?\b|\btrekking\b|\bgr ?\d{1,3}\b|\bhrp\b|\btmb\b|\btraversee\b|\btour (?:du|des|de la|de l') ?\S|\bchemin de l'inca\b|\binca trail\b|\bcompostelle\b|\b[a-z]+ way\b|\bkilimandjaro\b/, 'trekking'],
    [/\broad ?trip\b/, 'roadtrip'],
    [/\bbushcraft\b/, 'bushcraft'],
    [/\b(culturel|culturelle|musees?)\b/, 'cultural'],
    // En dernier : « rando avec bivouac » reste une rando, « bivouac 1 nuit » est un bivouac.
    [/\b(bivouac|bivouacs|bivouaquer)\b/, 'bivouac'],
  ];
  // Anglais : les mots ajoutés à chaque activité, dans le même ordre.
  const activities = en
    ? activity.map(([re, a]): [RegExp, CompasActivity] => [ACTIVITY_EN[a] ? new RegExp(`${re.source}|\\b(?:${ACTIVITY_EN[a]})\\b`) : re, a])
    : activity;
  // Phrase réécrite depuis l'italien : « Alpi » est le nom des Alpes, pas « alpi(nisme) ».
  const activityPlain = pivoted ? plain.replace(/\balpi\b/g, '    ') : plain;
  // « marche 10 km en bord de mer » : le bord de mer est le lieu, la marche l'activité.
  const walkByTheSea =
    /\b(?:marche|marcher|balades?|promenades?|rando+s?|randon+ee?s?)\b/.test(plain) &&
    !/\b(?:plages?|farniente|baignade|beach)\b/.test(plain);
  // « John Muir Trail », « Inca trail » : le nom d'un sentier, pas du trail (la course). Seul le mot
  // qui fait partie du nom d'un sentier célèbre est écarté : « trail sur le GR20 » reste du trail.
  const namedTrail = famousTrailIn(src);
  const outsideTrailNames = FAMOUS_TRAILS.reduce((t, [re]) => t.replace(new RegExp(re.source, 'g'), ' '), activityPlain);
  const act = activities.find(
    ([re, kind]) => re.test(kind === 'trail' ? outsideTrailNames : activityPlain) && !(kind === 'beach' && walkByTheSea)
  );
  if (act) out.push({ type: 'set_activity', activity: act[1] });
  // « 5 jours dans les Dolomites en refuge » : dormir en refuge, c'est marcher.
  else if (nights.has('refuge')) out.push({ type: 'set_activity', activity: 'hiking' });
  // « Laugavegur en 4 jours », « le chemin de Stevenson » : un sentier célèbre se parcourt à pied.
  else if (namedTrail) out.push({ type: 'set_activity', activity: 'trekking' });

  /* Sans voiture : un réglage à part, pas une chose « à éviter » */
  const noCar = carFreeSpans(plain);
  if (noCar.length && !drivesOwnCar(plain, noCar)) out.push({ type: 'set_car_free' });

  /* Éviter, envies */
  for (const m of plain.matchAll(
    /\b(?:sans|eviter|evite|pas de|pas d'|aucun|aucune)\s+([^,.;!?]+)/g
  )) {
    const matchEnd = (m.index ?? 0) + m[0].length;
    let at = matchEnd - m[1].length;
    let length = m[1].length;
    const inCarFree = noCar.find(([from, to]) => (m.index ?? 0) >= from && (m.index ?? 0) < to);
    if (inCarFree) {
      // « sans voiture ni foule » : seul le nom du véhicule est un réglage ; ce qui suit, après
      // « ni », « et » ou « ou » (et un éventuel « sans »), reste à éviter.
      const rest = /^\s*(?:ni|et|ou)\s+(?:(?:sans|eviter|evite|pas de|pas d'|aucun|aucune)\s+)?/.exec(
        plain.slice(inCarFree[1], matchEnd)
      );
      if (!rest) continue;
      at = inCarFree[1] + rest[0].length;
      length = matchEnd - at;
      if (length <= 0) continue;
    }
    const value = clean(upToBreak(src.slice(at, at + length)));
    if (value.length >= 3 && !/^(souci|probleme|problème|soucis)$/i.test(value))
      out.push({ type: 'avoid', label: value });
  }
  for (const m of plain.matchAll(
    /\b(?:envie (?:de |d')|voir (?:un |une |des |le |la |les |l'))([^,.;!?]+)/g
  )) {
    const at = (m.index ?? 0) + m[0].length - m[1].length;
    const value = clean(upToBreak(src.slice(at, at + m[1].length)));
    if (value.length >= 3) out.push({ type: 'wish', label: value });
  }

  /* Objet à ajouter */
  for (const m of plain.matchAll(
    new RegExp(
      `\\b(?:ajoute|ajouter|rajoute|prends|prendre|emporte|emporter|n'oublie pas|pense a|il (?:me|nous) faut)\\s+(?:${NUM}\\s+)?(?:le |la |les |l'|un |une |des |du |de la |mon |ma |mes |nos |notre )?([^,.;!?]+)`,
      'g'
    )
  )) {
    const raw = m[2];
    const at = (m.index ?? 0) + m[0].length - raw.length;
    const name = clean(src.slice(at, at + raw.length).split(/\s(?:et|pour|avec|dans)\s/i)[0], 60);
    if (
      name.length < 2 ||
      /^(jours?|nuits?|heures?|personnes?|semaines?|budget)\b/i.test(plainOf(name))
    )
      continue;
    const q = m[1] ? toNumber(m[1]) : null;
    out.push({
      type: 'add_item',
      name,
      quantity: q != null && Number.isInteger(q) && q > 0 ? q : 1,
    });
  }

  /* Lieu de départ : « depuis Lyon », « au départ de Genève ». Lu avant la
     destination, qui ne le reprend jamais (« rando dans le Vercors depuis Lyon »). */
  const origin = readOrigin(src, plain, en);
  const inOrigin = (i: number) => origin != null && i >= origin.start && i < origin.end;
  if (origin) out.push({ type: 'set_origin', place: origin.place, ...(origin.longer ? { longer: origin.longer } : {}) });

  /* Destination : « au Népal », « en Islande », « à Chamonix » (nom propre) */
  // « à la Réunion », « à l’Île de Ré », « dans l’Ain » ; « in Iceland » (anglais).
  // « sur la Dordogne », « autour du lac d'Annecy », « traversée des Pyrénées »,
  // « in the Swiss Alps » ; un nom commun de lieu (« lac », « calanques ») suivi
  // d'un nom propre compte (« dans les calanques de Marseille »).
  // « de X à Y », lu plus bas ; le lieu qui l'avale (« au Japon de Tokyo à Kyoto ») le laisse passer.
  const fromTo = fromToIn(src);
  const destLeads = [
    ...plain.matchAll(
      /(?:^|[\s,(])(?:(?:a|dans|sur|autour de|le long de|descente de) l'\s*|autour d'\s*|(?:au|aux|en|in the|in|a la|a|dans le|dans la|dans les|sur le|sur la|sur les|autour du|autour de|autour des|le long (?:du|des|de la)|(?:traversee|tour|trek|ascension|circuit|rando|randonnee|boucle|descente) (?:des|du|de la|de))\s+)/g
    ),
  ];
  // Anglais : « to Sardinia », « near Chamonix », « on Mont Blanc », « visiting Rome », dans l'ordre de la phrase.
  if (en) {
    destLeads.push(...plain.matchAll(new RegExp(`(?:^|[\\s,(])${DEST_LEAD_EN}\\s+`, 'g')));
    destLeads.sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
  }
  for (const m of destLeads) {
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original) || inOrigin(at)) continue;
    // « sur le GR20 » : un code de sentier, pas une destination.
    if (/^\p{Lu}{1,4}\s?\d/u.test(original)) continue;
    // Coupe à la ponctuation ou au premier chiffre, puis au premier mot d'une
    // autre idée (`PLACE_END`, « depuis Lyon » compris).
    const head = original.split(/[,.;!?\d]/)[0].split(PLACE_END)[0];
    const place = clean(en ? cutEn(head) : head, 50)
      // « Norvège dans les fjords » : le nom s'arrête avant la préposition restée seule.
      .replace(/\s+(?:dans|in|sur|vers|près|pres)$/i, '')
      // « Corse GR20 » : le code du sentier coupé au chiffre n'est pas le nom du lieu.
      .replace(/\s+(?:GR|HRP|GTA|TMB)$/u, '');
    if (place.length >= 2 && !notPlace(place) && !(en && enStopLead(place))) {
      // « Maroc dans l'Atlas » : la destination est le pays, le lieu précis une
      // envie (la recherche de parcours le reprend plus bas).
      const inner = /\s+dans\s+(?:l'|l’|le\s|la\s|les\s)\s*(\S.*)$/u.exec(place);
      if (inner) {
        const country = clean(place.slice(0, inner.index), 50);
        if (country.length >= 2) {
          out.push({ type: 'set_destination', place: capitalized(country) });
          if (inner[1].trim().length >= 3) out.push({ type: 'wish', label: clean(inner[1], 40) });
          break;
        }
      }
      // « in the Swiss Alps near Zermatt », « dans les Alpes près de Chamonix » : le lieu
      // dit ensuite est le plus précis ; la région reste une envie.
      const nearBy = /^\s*,?\s*(?:near|around|close to|pr[eè]s de|à côté de|a cote de)\s+(\p{Lu}[\p{L}'’-]+(?:[\s-]\p{Lu}[\p{L}'’-]+)*)/u.exec(
        src.slice(at + place.length, at + place.length + 60)
      );
      if (nearBy && !notPlace(nearBy[1])) {
        out.push({ type: 'set_destination', place: clean(nearBy[1], 50) });
        out.push({ type: 'wish', label: capitalized(place) });
        break;
      }
      // « au Maroc à Marrakech » : la ville dite ensuite précise le pays. Pas « au Japon de Tokyo à
      // Kyoto » : le lieu a avalé le départ d'un « de X à Y », lu plus bas (`walksOrRides`). « au Pays
      // de Galles à Cardiff » en reste un : ce « de » est celui du nom (`fromToIn`).
      const fromToTail = fromTo != null && fromTo.at > at && fromTo.at < at + place.length;
      const city = /^(?:en|au|aux)\s/.test(m[0].trimStart()) && !fromToTail
        ? /^\s*,?\s*(?:à|a)\s+(\p{Lu}[\p{L}'’-]+(?:[\s-]\p{Lu}[\p{L}'’-]+)*)/u.exec(src.slice(at + place.length, at + place.length + 60))
        : null;
      if (city && !notAPlace(city[1])) {
        out.push({ type: 'set_destination', place: clean(city[1], 50) });
        // « au lac Blanc à Chamonix » : la ville départage les homonymes, le lieu
        // naturel reste un passage voulu.
        if (PLACE_NOUN.test(place)) out.push({ type: 'wish', label: capitalized(place) });
        break;
      }
      out.push({ type: 'set_destination', place: capitalized(place) });
      // « en Patagonie, Torres del Paine » : le lieu précis qui suit devient une
      // envie, transmise au spécialiste de l'itinéraire (sans resserrer la
      // destination : « Japon, Tokyo et Kyoto » reste un voyage au Japon).
      // « en Italie, Florence et Venise » : chaque lieu nommé (trois au plus).
      const after = /^\s*,\s*(\p{Lu}[^.;!?\d]*)/u.exec(src.slice(at + place.length, at + place.length + 80));
      const precise = after
        ? after[1]
            .split(/\s*,\s*|\s+(?:et|and)\s+/i)
            .map((part) => clean(part.split(/\s(?:pour|avec|en|du|pendant|durant|à|a)\s/i)[0], 40))
            .filter((label) => label.length >= 3 && /^\p{Lu}/u.test(label) && !notAPlace(label))
            .slice(0, 3)
        : [];
      for (const label of precise) out.push({ type: 'wish', label });
      break;
    }
  }

  /* Anglais, le lieu en tête : « Iceland road trip », « Corsica trek » (jamais « Ski trip »). */
  if (en && !out.some((a) => a.type === 'set_destination')) {
    const lead = /^(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)*)\s+(?:road trip|trip|trek|hike|holiday|vacation|getaway|tour|adventure)\b/u.exec(src.trim());
    const name = lead ? clean(lead[1], 50) : '';
    if (
      name.length >= 3 &&
      !notPlace(name) &&
      !enStopLead(name) &&
      !activities.some(([re]) => re.test(plainOf(name)))
    )
      out.push({ type: 'set_destination', place: name });
  }

  /* Sans préposition, juste après le genre de voyage : « road trip Norvège
     fjords », « city trip Tokyo et Kyoto » (nom propre seulement). */
  if (!out.some((a) => a.type === 'set_destination')) {
    const kind = /\b(?:road ?trip|city ?trip|van|voyage|sejour|vacances|week[- ]?end|trek|rando|randonnee)\s+/.exec(plain);
    if (kind) {
      const at = (kind.index ?? 0) + kind[0].length;
      const bare = /^(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)*)/u.exec(src.slice(at, at + 50));
      const name = bare ? clean(bare[1], 50) : '';
      if (name.length >= 3 && !notAPlace(name))
        out.push({ type: 'set_destination', place: name });
    }
  }

  /* D'un lieu à un autre : « de Genève à Nice », « de Chamonix à Zermatt ». Le premier est le départ
     de l'itinéraire, le second la destination ; « de X à Y » reste une envie (forme du voyage). Une
     destination déjà lue (« traversée des Alpes ») devient une envie (13 oct. : la traversée partait
     de Menton vers l'est, sans jamais passer par Genève), mais seulement à pied ou à vélo : ailleurs,
     elle reste la destination et X et Y deviennent des envies (`walksOrRides`). Le « de » d'un nom de
     lieu (« au Pays de Galles à Cardiff », « au lac de Côme à Bellagio ») n'en ouvre pas un (`fromToIn`). */
  if (fromTo && !notAPlace(fromTo.from) && !notAPlace(fromTo.to) && !out.some((a) => a.type === 'set_origin')) {
    const from = clean(fromTo.from, 50);
    const to = clean(fromTo.to, 50);
    const said = out.findIndex((a) => a.type === 'set_destination');
    const read = said >= 0 ? out[said] : null;
    // « dans le Jura de Gex à Pontarlier » : la destination lue avait avalé « de Gex » (« en Italie
    // du lac de Côme à Milan » : « du lac de Côme »).
    const saidFrom = fromTo.said.replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before =
      read?.type === 'set_destination'
        ? { ...read, place: read.place.replace(new RegExp(`\\s+${saidFrom}$`, 'u'), '') }
        : read;
    // « le long de la côte de Collioure à Banyuls » : la destination lue n'est que « Côte », un nom commun seul,
    // ni un lieu à garder ni une envie.
    const bareNoun = before?.type === 'set_destination' && NAME_NOUN_BEFORE_DE.exec(plainOf(before.place))?.index === 0;
    const other =
      before?.type === 'set_destination' && !bareNoun && plainOf(before.place) !== plainOf(to) && plainOf(before.place) !== plainOf(from);
    if (other && before?.type === 'set_destination' && !walksOrRides(out, context.activity)) {
      // Ni à pied ni à vélo (« voyage au Japon de Tokyo à Kyoto ») : la destination lue reste (le pays,
      // ses bases) ; les deux lieux sont des envies, dans l'ordre. Pas de départ : on part de chez soi.
      out[said] = before;
      for (const label of [from, to])
        if (!out.some((a) => a.type === 'wish' && plainOf(a.label) === plainOf(label))) out.push({ type: 'wish', label });
    } else {
      if (said >= 0) out.splice(said, 1);
      out.push({ type: 'set_origin', place: from });
      out.push({ type: 'set_destination', place: to });
      out.push({ type: 'wish', label: `de ${from} à ${to}` });
      // Gardée en envie sauf si elle est déjà dite (« traversée des Alpes » plus loin dans la phrase).
      if (
        other &&
        before?.type === 'set_destination' &&
        !plainOf(src).replace(/^.*?\bde\s+\S+\s+(?:a|jusqu'a)\s+\S+/, '').includes(`traversee des ${plainOf(before.place)}`) &&
        !/\b(?:traversee|tour) (?:de la |des |du |de l'|d')/.test(plainOf(src))
      )
        out.push({ type: 'wish', label: before.place });
    }
  }

  /* Sentier célèbre sans lieu dit (« GR20 en 12 jours ») : sa région. */
  if (!out.some((a) => a.type === 'set_destination')) {
    const known = FAMOUS_TRAILS.find(([re]) => re.test(plain));
    // La référence dite (« GR34 ») accompagne la région, si c'est bien ce sentier-là.
    const ref = known ? trailRefIn(src) : null;
    if (known)
      out.push({
        type: 'set_destination',
        place: known[1],
        ...(ref && trailRegion(ref) === known[1] ? { trail: ref } : {}),
      });
  }

  /* Le lieu en tête de phrase, suivi de la durée : « Bali 8 jours en juillet », « Kyoto weekend in November »,
     « Corée du Sud 10 jours ». Seulement avec la durée juste derrière : « Rando en Juillet » n'est pas un lieu.
     Mots séparés par des espaces seulement (le trait d'union est une lettre du mot) : sinon 2^n découpages
     quand la durée manque (« Ab-Ab-… x », relecture de la PR #108). */
  if (!out.some((a) => a.type === 'set_destination')) {
    const lead = new RegExp(
      `^(\\p{Lu}[\\p{L}'’-]+(?:(?:\\s+|\\s+(?:de la|de l['’]|du|des|del|della|de|di|d['’])\\s*|\\s+et\\s+)\\p{Lu}[\\p{L}'’-]+)*)\\s+(?:[\\p{L}'’-]+\\s+){0,4}?(?=${NUM}\\s*(?:jours?|j\\b|nuits?|semaines?|days?|nights?|weeks?)|week[- ]?end|weekend)`,
      'u'
    ).exec(src.trim());
    // « Corse GR20 nord » : le code du sentier n'est pas le nom du lieu.
    const name = lead ? clean(lead[1].replace(/\s+(?:GR|HRP|GTA|TMB)$/u, ''), 50) : '';
    if (name.length >= 3 && !notPlace(name) && !notAPlace(name, en) && !ACTIVITY_LEAD.test(plainOf(name).split(' ')[0]) && !SENTENCE_OPENER.test(plainOf(name)))
      out.push({ type: 'set_destination', place: name });
  }

  /* Dernier recours : un nom propre composé hors du premier mot
     (« alpinisme 4 jours Mont Blanc »). */
  if (!out.some((a) => a.type === 'set_destination')) {
    // Jamais une personne (« rando avec Paul ») : pas après « avec », « et », « chez »…
    for (const m of src.matchAll(/(?<!\b(?:avec|et|chez|pour|par|mon|ma|mes|ton|ta|copain|copine|ami|amie)\s)(?<=\s)(\p{Lu}[\p{L}'’-]+(?:(?:[\s-]+|\s+(?:de la|de l['’]|du|des|del|della|de|di|d['’])\s*)\p{Lu}[\p{L}'’-]+)*)/gu)) {
      // Le lieu de départ n'est jamais la destination (« rando 3 jours depuis Lyon »).
      if (inOrigin(m.index ?? 0)) continue;
      // Anglais : pas un début de phrase (« … 4 of us. Leaving »), ni « I'm », ni « with Sarah ».
      const before = src.slice(0, m.index ?? 0);
      if (en && (enStopLead(clean(m[1], 50)) || /[.!?]\s*$/.test(before) || /\b(?:with|and|my|our|for|by|me)\s$/i.test(before)))
        continue;
      // « jusqu'au lac Blanc » : le nom commun de lieu qui précède fait partie du nom (pas « Blanc » seul).
      const tail = PLACE_NOUN_TAIL.exec(before)?.[1] ?? '';
      const name = capitalized(clean(tail + m[1].replace(/\s+(?:GR|HRP|GTA|TMB)$/u, ''), 50));
      if (name.length >= 3 && !notPlace(name) && !/^(?:je|j|on|nous|il|elle)$/i.test(name)) {
        out.push({ type: 'set_destination', place: name });
        break;
      }
    }
  }

  /* Phrase en chinois (« 东京三天自由行 ») : le lieu est la suite de caractères en tête, avant le nombre de jours. */
  if (!out.some((a) => a.type === 'set_destination')) {
    const han = /^\s*(\p{Script=Han}{2,6}?)(?=[一二三四五六七八九十两\d]|\p{Script=Han}?[天日夜周週]|$)/u.exec(src);
    if (han) out.push({ type: 'set_destination', place: han[1] });
  }

  /* Phrase tapée sans majuscule (« randoo 3 jour dans les vosges ») : le nom
     après une préposition de lieu, hors noms communs de paysage. */
  if (!out.some((a) => a.type === 'set_destination') && !/\p{Lu}/u.test(src)) {
    const low = /\b(?:dans l'\s*|(?:dans les|dans le|dans la|en|au|aux|a|vers|pres de)\s+)([a-z][a-z'-]{2,}(?:\s(?!(?:pour|avec|en|a|et|du|de|des|le|la|les|sans|dans|ce|cet|cette|demain|apres-demain|aujourd'hui|prochain|prochaine|matin|soir|depuis)\b)[a-z][a-z'-]{2,})?)/.exec(plain);
    const word = low ? low[1].trim() : '';
    if (word && !COMMON_PLACE_WORDS.test(word.split(/\s/)[0]) && toNumber(word.split(/\s/)[0]) == null && !notAPlace(word))
      out.push({ type: 'set_destination', place: word.split(/\s/).map(capitalized).join(' ') });
  }

  /* Lieu nommé en plus de la destination : « 7 jours en Sicile avec l'Etna », « en Crète
     avec les gorges de Samaria », « en Égypte en mer Rouge ». Après « avec », un article
     est exigé (« avec Paul » est une personne) ; après « en », « dans », « sur », un nom
     commun de lieu (« en Norvège » ne double pas la destination). */
  const destination = out.find((a): a is Extract<CompasIntentAction, { type: 'set_destination' }> => a.type === 'set_destination');
  for (const m of src.matchAll(/(?:^|\s)(avec|en|dans|sur|et|vers|jusqu['’]à|jusqu['’]au|jusqu['’]aux)\s+(l['’]\s*|le\s+|la\s+|les\s+)?/giu)) {
    const at = (m.index ?? 0) + m[0].length;
    const fragment = src.slice(at, at + 60);
    const lead = PLACE_NOUN.exec(fragment)?.[0] ?? '';
    const word = m[1].toLowerCase();
    // Après « avec » : un nom commun de lieu (« avec les gorges de Samaria ») ou l'élision devant un
    // nom propre (« avec l'Etna »). « avec les Dupont », « avec la Team » sont des personnes, pas des lieux.
    if (word === 'avec' ? !m[2] || !(lead || /^l['’]/i.test(m[2])) || !properLead(fragment) : !lead || !properLead(fragment)) continue;
    if (inOrigin(at)) continue;
    const label = capitalized(clean(lead + upToBreak(fragment.slice(lead.length)), 40));
    const same = (other: string) => plainOf(other) === plainOf(label);
    if (label.length < 3 || notAPlace(label) || (destination && same(destination.place))) continue;
    if (out.some((a) => a.type === 'wish' && same(a.label))) continue;
    out.push({ type: 'wish', label });
    if (out.filter((a) => a.type === 'wish').length >= 4) break;
  }

  /* Le même, tapé sans majuscule : « paris 3 jours en famille ». Jamais un mot d'activité, d'ouverture ou un nom commun. */
  if (!out.some((a) => a.type === 'set_destination')) {
    const low = new RegExp(
      `^\\s*(\\p{Ll}[\\p{L}'’-]{2,}(?:\\s+\\p{Ll}[\\p{L}'’-]+){0,2}?)\\s+(?=${NUM}\\s*(?:jours?|j\\b|nuits?|semaines?)|week[- ]?end|weekend)`,
      'u'
    ).exec(src.trim());
    // « mont blanc ascension » : les mots d'activité en fin de nom ne sont pas le lieu.
    const guess = low
      ? clean(low[1].replace(/(?:\s+(?:ascension|randonnee|randonnée|rando|trek|trekking|velo|vélo|ski|escalade|alpinisme|bivouac|kayak|surf|camping))+$/iu, ''), 40)
      : '';
    const first = plainOf(guess).split(' ')[0] ?? '';
    if (
      guess.length >= 3 &&
      !ACTIVITY_LEAD.test(first) &&
      !SENTENCE_OPENER.test(first) &&
      !FUNCTION_WORD.test(first) &&
      !COMMON_PLACE_WORDS.test(first) &&
      !notAPlace(guess, en) &&
      toNumber(first) == null
    )
      out.push({ type: 'set_destination', place: guess.split(/\s+/).map(capitalized).join(' ') });
  }

  /* Sentier nommé : « sur le GR20 », « sur le chemin de l'Inca », « le Tour du
     Mont-Blanc » : une envie transmise au spécialiste de l'itinéraire. */
  const trail = /\b(?:sur|par) (?:le |la |les |l')\s*((?:gr|hrp)\s?\d+\w*|(?:chemin|tour|sentier|haute route|route|camino|via)\s[^,.;!?]+|[a-z][^,.;!?]* (?:way|trail|path|track)\b)/.exec(plain);
  if (trail) {
    const at = (trail.index ?? 0) + trail[0].length - trail[1].length;
    const label = clean(
      src
        .slice(at, at + trail[1].length)
        .split(/\s(?:en|pour|avec|pendant|durant|et|à|a|dans)\s/i)[0]
        .replace(/\s+\d.*$/, ''),
      40
    );
    if (label.length >= 3 && /\p{Lu}|\d/u.test(label)) out.push({ type: 'wish', label });
  }

  /* Sentier célèbre nommé sans « sur le » (« le GR20 sud en 6 jours », « Laugavegur en 4 jours ») :
     une envie aussi, pour que le spécialiste en suive les étapes. */
  const famous = famousTrailIn(src);
  if (famous && !out.some((a) => a.type === 'wish' && famousTrailIn(a.label) != null))
    out.push({ type: 'wish', label: famous });

  /* « traversée des Pyrénées », « tour du lac d'Annecy » : une envie de forme
     d'itinéraire (ligne ou boucle), transmise au spécialiste. */
  const shape = /\b(traversee|tour) (?:de la |des |du |de l'|d')\s*/.exec(plain);
  if (shape) {
    const at = (shape.index ?? 0) + shape[0].length;
    if (properLead(src.slice(at, at + 60))) {
      const label = clean(src.slice(shape.index ?? 0, at) + upToBreak(src.slice(at, at + 60)), 40);
      const known = out.some((a) => a.type === 'wish' && plainOf(a.label) === plainOf(label));
      if (label.length >= 8 && !known) out.push({ type: 'wish', label });
    }
  }

  /* Lieu → recherche de parcours (nom propre seulement) */
  const place =
    /\b(?:dans (?:le |la |les |l')|vers |autour (?:de |d')|du cote (?:de |d')|pres (?:de |d')|a cote (?:de |d'))/g;
  for (const m of plain.matchAll(place)) {
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original) || inOrigin(at)) continue;
    const lead = /^\p{Lu}/u.test(original) ? '' : (PLACE_NOUN.exec(original)?.[0] ?? '');
    const query = capitalized(clean(lead + upToBreak(original.slice(lead.length)), 50));
    if (query.length >= 3 && !notAPlace(query)) {
      out.push({ type: 'search_route', query });
      break;
    }
  }

  // Le pays dit dans la phrase se joint au lieu (« Tatras, Pologne ») : la recherche ne choisit plus au hasard.
  return out.map((a) => {
    // « Corse GR20 » coupé au chiffre : le code du sentier n'est pas le nom du lieu.
    if (a.type === 'set_destination' && /\s(?:GR|HRP|GTA|TMB)$/u.test(a.place) && a.place.length > 6)
      a = { ...a, place: a.place.replace(/\s+(?:GR|HRP|GTA|TMB)$/u, '') };
    if (a.type !== 'set_destination' || a.place.includes(',')) return a;
    // « 5 jours en Norvège, Lofoten, en juin » : le pays est lu en premier, mais le lieu précis qui le suit
    // (après une virgule) est la destination, avec ce pays.
    const finer = saidPlaceAfterCountry(src, a.place);
    if (finer) return { ...a, place: `${finer}, ${a.place}` };
    const country = saidCountryFor(src, a.place);
    return country ? { ...a, place: `${a.place}, ${country}` } : a;
  });
}

/* ---------- Ancrage d'une action proposée par l'IA ---------- */

function tokensIn(text: string, value: string): boolean {
  const plain = plainOf(text);
  return plainOf(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .some((t) => plain.includes(t));
}

/**
 * Adultes et enfants comptés à part (« 2 adultes et 3 enfants ») : le groupe
 * est leur somme. Null s'il n'y a pas au moins deux catégories comptées.
 */
function partySum(plain: string, en = false): number | null {
  const kinds = new Map<string, number>();
  const words = `adultes?|enfants?|ados?|adolescente?s?|bebes?|grands-parents|parents${en ? '|adults?|kids?|children|child|teens?|teenagers?|babies|baby|toddlers?|grandparents' : ''}`;
  for (const m of plain.matchAll(new RegExp(`\\b${NUM}\\s+(${words})\\b`, 'g'))) {
    const n = toNumber(m[1]);
    const kind = m[2].replace(/s$/, '').replace(/e$/, '');
    if (n != null && Number.isInteger(n) && n > 0 && !kinds.has(kind)) kinds.set(kind, n);
  }
  return kinds.size >= 2 ? [...kinds.values()].reduce((a, b) => a + b, 0) : null;
}

/**
 * « avec ma femme », « avec mon couple », « avec 2 enfants », « avec mes parents » : moi et ceux
 * qui viennent (comme `companionsParty` en anglais). Null si rien de sûr n'est dit
 * (« avec des amis », « avec mon sac ») : le groupe reste alors non compris.
 */
export function companionsPartyFr(plain: string, src = ''): number | null {
  const m = /\bavec\s+([^,.;!?]+)/.exec(plain);
  if (!m) return null;
  // D'autres personnes après la virgule (« avec ma copine, mes frères et mes amis », « avec ma femme,
  // Paul et Marie » ; les prénoms se lisent sur la phrase d'origine `src`) : rien de sûr.
  const end = (m.index ?? 0) + m[0].length;
  if (morePeopleAfter(plain.slice(end), src.slice(end))) return null;
  const clause = m[1].split(
    /\s(?:pour|en|dans|a|au|aux|sur|vers|depuis|jusqu|budget|autour|durant|pendant|cet|cette|ce|le|la|les|\d+\s*(?:jours?|nuits?|semaines?))\b/
  )[0];
  const ONE_FR =
    /^(?:femme|mari|epoux|epouse|conjointe?|compagne|compagnon|copine|copain|chéri|cheri|cherie|amie?|fils|fille|frere|soeur|enfant|bebe|ado|adolescente?|pere|mere|papa|maman|collegue|cousine?|neveu|niece|grand-?mere|grand-?pere|mamie|papy)$/;
  const MANY_FR = /^(?:amis|amies|copains|copines|potes|enfants|ados|adolescents|adolescentes|bebes|cousins|cousines|collegues|neveux|nieces)$/;
  let extra = 0;
  for (const raw of clause.split(/\s+et\s+|\s*&\s*/)) {
    const seg = /^(?:(?:mon|ma|mes|ses|nos|notre|des|les|le|la|un|une|deux|trois|quatre|cinq)\s+)?(?:(\d{1,2})\s+)?([a-z-]+)$/.exec(
      raw.trim()
    );
    if (!seg) return null;
    const n = seg[1] ? Number(seg[1]) : null;
    const word = seg[2];
    if (/^(?:couple|duo)$/.test(word)) extra += 1;
    else if (/^(?:parents|grands-parents)$/.test(word)) extra += n ?? 2;
    else if (ONE_FR.test(word)) extra += n ?? 1;
    else if (MANY_FR.test(word) && n) extra += n;
    else return null;
  }
  return extra > 0 ? 1 + extra : null;
}

/** Le nombre de personnes est-il dit comme tel dans la phrase (texte « plain ») ? */
function partyGrounded(plain: string, count: number): boolean {
  const patterns = [
    `\\b${NUM}\\s+(?:personnes?|pers\\b|randonneurs?|adultes?|enfants?|amis|amies|copains|copines|potes|participants|voyageurs?|people|persons|friends|adults)`,
    `\\b(?:a|pour|on est|on sera|nous sommes|nous serons|groupe de|famille de|entre|we are|for)\\s+${NUM}\\b(?!\\s*(?:jours?|j\\b|h\\b|heures?|nuits?|km|kilos?|kg|g\\b|m\\b|metres?|€|euros?|eur\\b|semaines?|min|%|ans|days?|nights?))`,
  ];
  return (
    partySum(plain) === count ||
    patterns.some((p) => [...plain.matchAll(new RegExp(p, 'g'))].some((m) => toNumber(m[1]) === count))
  );
}

/** Refuse ce que la phrase ne dit pas. Renvoie la raison, ou null si ancré. */
export function groundingIssue(action: CompasIntentAction, text: string): string | null {
  const plain = plainOf(text);
  switch (action.type) {
    case 'set_dates':
      return dateGrounded(text, action.start) && (!action.end || dateGrounded(text, action.end, true))
        ? null
        : 'Date absente de ta phrase';
    case 'set_duration': {
      if (action.hours != null) {
        const h = action.hours;
        return numberInText(text, Math.floor(h)) || (h === 4 && /demi-journee/.test(plain))
          ? null
          : 'Durée absente de ta phrase';
      }
      const d = action.days ?? 0;
      const ok =
        numberInText(text, d) ||
        (/nuit/.test(plain) && numberInText(text, d - 1)) ||
        (/semaine/.test(plain) && d % 7 === 0 && numberInText(text, d / 7)) ||
        (d === 2 && /week[- ]?end/.test(plain)) ||
        (d === 7 && WEEK_OF.test(plain)) ||
        (d === 1 && /journee/.test(plain));
      // La borne d'une durée vague est celle du pluriel, pas un chiffre au choix de celui qui la propose.
      if (action.atLeast) return vagueSpan(plain)?.minDays === action.days ? null : 'Durée vague absente de ta phrase';
      if (!ok && vagueSpan(plain))
        return `Durée vague dans ta phrase (« ${vagueSpan(plain)!.said} ») : dis le nombre de jours`;
      return ok ? null : 'Durée absente de ta phrase';
    }
    case 'set_party_size':
      // Le nombre doit être dit À PROPOS DES PERSONNES (« à 4 », « 4 amis ») :
      // « 4 jours de rando » ne fait pas un groupe de 4.
      return partyGrounded(spellNumbers(plain), action.count) ||
        (action.count === 1 && /\b(seul|seule|solo)\b/.test(plain)) ||
        (action.count === 2 && /\b(couple|duo)\b/.test(plain)) ||
        companionsPartyFr(plain) === action.count ||
        companionsParty(plain) === action.count
        ? null
        : 'Nombre absent de ta phrase';
    case 'set_budget': {
      // Le groupe n'est multiplié que par `validateActions` : une action qui arrive déjà multipliée est refusée.
      if (action.groupOf) return 'Multiplication par le groupe faite par le Compas seulement';
      if (!numberInText(text, action.amount)) return 'Montant absent de ta phrase';
      // Une devise n'est retenue que si la phrase la dit (« 2000 $ »).
      const money = readMoney(spellNumbers(plain), text.normalize('NFC'));
      const said = money?.currency ?? null;
      if (action.currency && action.currency !== said) return 'Devise absente de ta phrase';
      // « par personne » doit être dit ; et un montant dit par personne n'est pas l'enveloppe du groupe.
      const perPerson = money ? saidPerPerson(spellNumbers(plain), money) : false;
      if (action.perPerson && !perPerson) return 'Montant par personne absent de ta phrase';
      if (!action.perPerson && perPerson) return 'Montant dit par personne : à multiplier par le groupe';
      return null;
    }
    case 'avoid':
      // Une chose à éviter se dit par une négation (« sans », « éviter », « pas de ») : l'IA rangeait
      // « gorges de Samaria », voulues, dans les choses à éviter (13 oct.).
      if (!tokensIn(text, action.label)) return 'Absent de ta phrase';
      return /\b(?:sans|eviter|evite|evitons|pas|aucun|aucune|ni|jamais|without|avoid|no|not)\b/.test(plain) ? null : 'Rien à éviter dans ta phrase';
    case 'wish':
      return tokensIn(text, action.label) ? null : 'Absent de ta phrase';
    case 'add_item':
      return tokensIn(text, action.name) &&
        (action.quantity === 1 || numberInText(text, action.quantity))
        ? null
        : 'Objet absent de ta phrase';
    case 'search_route':
      return tokensIn(text, action.query) ? null : 'Lieu absent de ta phrase';
    case 'set_destination':
    case 'set_origin':
      return tokensIn(text, action.place) ? null : 'Lieu absent de ta phrase';
    // Rythme et nuits : seulement s'ils sont dits (l'IA posait « bivouac » et
    // « rythme normal » sur « Hiking in Iceland 5 days »).
    case 'set_pace':
      return /\b(rythme|tranquille|tranquillement|doucement|cool|calme|pepere|lent|lentement|relax|normal|moyen|soutenu|sportif|rapide|intense|pace|slow|easy|fast)/.test(plain)
        ? null
        : 'Rythme absent de ta phrase';
    // Nuits dehors : le nombre ET le dehors doivent être dits. L'IA posait
    // « 6 nuits dehors » sur « tour du Queyras en 6 jours » (le nombre de jours).
    case 'set_outdoor_nights':
      if (!/\b(dehors|bivouac\w*|tente|belle etoile|camper|camping|outside|wild ?camp\w*)\b/.test(plain))
        return 'Nuits dehors absentes de ta phrase';
      return numberInText(text, action.nights) ? null : 'Nombre de nuits absent de ta phrase';
    case 'set_max_pack':
      return numberInText(text, action.kg) ? null : 'Poids absent de ta phrase';
    case 'set_distance':
      return numberInText(text, action.km) ? null : 'Distance absente de ta phrase';
    case 'set_level':
      return /\b(debut|novice|premiere fois|experiment|aguerri|confirme|expert|niveau|intermediaire|regulier|beginner|experienced)/.test(plain)
        ? null
        : 'Niveau absent de ta phrase';
    case 'set_terrain':
      return /\b(montagne|altitude|sommet|hors[- ]sentier|sentier|mountain|vtt|mtb)/.test(plain) ? null : 'Terrain absent de ta phrase';
    case 'set_car_free':
      return saysCarFree(plain) ? null : 'Sans voiture absent de ta phrase';
    case 'set_nights':
      return /\b(dehors|belle etoile|bivouac|bivouaquer|tente|camping|camper|refuges?|hotels?|gites?|chambres?|auberges?|hebergements?|airbnb|tent|hut|hostel)/.test(plain)
        ? null
        : 'Nuits absentes de ta phrase';
    default:
      return null;
  }
}

/* ---------- Limites réelles et libellés ---------- */

const PACE_LABEL: Record<Pace, string> = {
  tranquille: 'tranquille',
  normal: 'normal',
  soutenu: 'soutenu',
};
const NIGHTS_LABEL: Record<CompasNights, string> = {
  bivouac: 'en bivouac',
  refuge: 'en refuge',
  hebergement: 'en hébergement',
  mixte: 'mixtes',
};

export function actionLabel(action: CompasIntentAction, currency = 'EUR'): string {
  switch (action.type) {
    case 'set_dates':
      return action.end && action.end !== action.start
        ? `Dates : ${formatDayMonth(action.start)} → ${formatDayMonth(action.end)}`
        : `Départ : ${formatDayMonth(action.start)}`;
    case 'set_duration':
      return action.atLeast
        ? `Durée : au moins ${formatHours((action.days ?? 1) * 24)} (durée vague dans ta phrase : précise-la)`
        : `Durée : ${formatHours(action.hours ?? (action.days ?? 1) * 24)}`;
    case 'set_party_size':
      return `${action.count} personne${action.count > 1 ? 's' : ''}`;
    case 'set_budget': {
      const money = (n: number) => formatMoney(n, action.currency ?? currency);
      // Converti par le serveur : le montant dit et le taux restent visibles.
      const rate = action.said
        ? `${formatMoney(action.said.amount, action.said.currency)}${action.perPerson || action.groupOf ? ' par personne' : ''}, taux du ${formatDayMonth(action.said.date)}, ${action.said.source}`
        : null;
      if (action.groupOf) {
        // Multiplié par le groupe : le calcul reste visible (« 200 € (50 € par personne × 4 personnes) »).
        const each = Math.round((action.amount / action.groupOf) * 100) / 100;
        return `Enveloppe : ${money(action.amount)} (${money(each)} par personne × ${action.groupOf} personne${action.groupOf > 1 ? 's' : ''}${rate ? ` ; ${rate}` : ''})`;
      }
      if (action.perPerson) return `Enveloppe : ${money(action.amount)} par personne (groupe à préciser)${rate ? ` (${rate})` : ''}`;
      return rate ? `Enveloppe : ${money(action.amount)} (${rate})` : `Enveloppe : ${money(action.amount)}`;
    }
    case 'set_pace':
      return `Rythme ${PACE_LABEL[action.pace]}`;
    case 'set_nights':
      return `Nuits ${NIGHTS_LABEL[action.nights]}`;
    case 'set_activity':
      return `Activité : ${activityLabel(action.activity) ?? action.activity}`;
    case 'avoid':
      return `Éviter : ${action.label}`;
    case 'wish':
      return `Envie : ${action.label}`;
    case 'add_item':
      return `Ajouter au kit : ${action.quantity > 1 ? `${action.quantity} × ` : ''}${action.name}`;
    case 'search_route':
      return `Chercher un parcours : ${action.query}`;
    case 'set_destination':
      return `Destination : ${action.place}`;
    case 'set_origin':
      return `Départ : ${action.place}`;
    case 'set_outdoor_nights':
      return `${action.nights} nuit${action.nights > 1 ? 's' : ''} dehors`;
    case 'set_distance':
      return `Distance visée : ${String(action.km).replace('.', ',')} km`;
    case 'set_max_pack':
      return `Sac de base sous ${String(action.kg).replace('.', ',')} kg`;
    case 'set_level':
      return `Niveau : ${LEVEL_LABEL[action.level]}`;
    case 'set_terrain':
      return `Terrain : ${TERRAIN_LABEL[action.terrain]}`;
    case 'set_car_free':
      return 'Sans voiture : train, bus, vélo ou à pied';
  }
}

const LEVEL_LABEL = { debut: 'débutant', regulier: 'régulier', aguerri: 'aguerri' } as const;
const TERRAIN_LABEL = {
  sentier: 'sentiers',
  montagne: 'montagne',
  hors_sentier: 'hors sentier',
  itinerance: 'itinérance',
  urbain_transit: 'ville et transports',
} as const;

function key(a: CompasIntentAction): string {
  switch (a.type) {
    case 'avoid':
    case 'wish':
      return `${a.type}:${plainOf(a.label)}`;
    case 'add_item':
      return `${a.type}:${plainOf(a.name)}`;
    default:
      return a.type;
  }
}

/**
 * L'activité dite (par l'IA ou par les règles, la première comme à la fusion ; sinon `fallback`, celle
 * choisie hors de la phrase) est-elle de celles dont un « de X à Y » fait l'itinéraire, à pied ou à vélo
 * (`pointToPointRide`) ? Ailleurs (voyage, road trip, train), « au Japon de Tokyo à Kyoto » reste un
 * voyage au Japon : les bases du pays, pas un séjour autour de Kyoto (relecture de la PR #108, 23 oct.).
 */
function walksOrRides(actions: readonly CompasIntentAction[], fallback: CompasActivity | null = null): boolean {
  const said = actions.find((a) => a.type === 'set_activity');
  const activity = said?.type === 'set_activity' ? said.activity : fallback;
  return activity != null && ['marche', 'velo'].includes(profileFor(activity).move);
}

/** Un autre moyen que la marche ou le vélo, dit dans la phrase (texte simplifié). */
const OTHER_MEANS =
  /\b(?:train|tgv|ter|trains|voiture|bus|autocar|avion|bateau|ferry|croisiere|road ?trip|roadtrip|voyage|van|camping[- ]car|moto|by (?:train|car|bus|plane)|flight|drive)\b/;

/**
 * L'activité du VOYAGE (bouton du Compas vide, création rapide du Hub, ou « hiking », valeur par défaut de
 * la base) comme repère de lecture d'un « de X à Y » : un repère faible, ignoré quand la phrase dit un autre
 * moyen (« en train », « voyage au Japon ») ou, pour une activité à pied, quand la destination lue est un
 * pays (« au Japon de Tokyo à Kyoto » sur un voyage « Randonnée » par défaut reste un voyage au Japon,
 * relecture 3 de la PR #108). À vélo, le choix est toujours explicite : « 10 jours en Italie de Rome à
 * Florence » sur un voyage « Vélo » fait le trajet. « Préciser » et l'IA ne passent pas par ici. `read` :
 * la lecture de la phrase sans activité.
 */
export function tripActivityHint(
  text: string,
  activity: CompasActivity | null,
  read: readonly CompasIntentAction[]
): CompasActivity | null {
  if (!activity || OTHER_MEANS.test(plainOf(text))) return null;
  const dest = read.find((a) => a.type === 'set_destination');
  const country = dest?.type === 'set_destination' && canonicalCountryName(dest.place.split(',')[0].trim()) != null;
  return country && profileFor(activity).move === 'marche' ? null : activity;
}

/** Les mots d'un lieu (minuscules, sans accent ni ponctuation) : « Saint-Claude » → « saint claude ». */
const placeWords = (place: string) => plainOf(place).replace(/[^\p{L}\p{N}']+/gu, ' ').trim();

/** Un lieu en contient-il un autre, mot à mot (« Ain » n'est pas dans « Saint-Claude ») ? */
const hasPlaceWords = (hay: string, needle: string) => ` ${placeWords(hay)} `.includes(` ${placeWords(needle)} `);

/**
 * Le lieu de l'IA est-il celui des règles avec la suite de la phrase collée ? Il commence par
 * lui (« vietnam du nord au sud »), ou le contient après un mot de liaison (« swiss alps near
 * zermatt », « nepal jusqu'au camp de base »). « lac d'annecy » pour « annecy » n'en est pas un.
 */
function gluedPlace(ai: string, rule: string): boolean {
  if (ai.startsWith(`${rule} `)) return true;
  if (!` ${ai} `.includes(` ${rule} `) && !ai.endsWith(` ${rule}`)) return false;
  return /\b(?:near|around|close to|pres de|a cote de|jusqu|du nord|du sud|de l'est|de l'ouest|avec|with)\b/.test(ai);
}

/**
 * Les actions de l'IA d'abord ; les règles complètent ce qu'elle a oublié. `activity` : celle du voyage
 * (bouton), quand ni l'IA ni la phrase n'en disent (`walksOrRides`) ; les règles doivent avoir été lues
 * avec la même (`RulesContext`).
 */
export function mergeActions(
  ai: CompasIntentAction[],
  rules: CompasIntentAction[],
  activity: CompasActivity | null = null
): Array<{ action: CompasIntentAction; source: IntentSource }> {
  const seen = new Set<string>();
  const out: Array<{ action: CompasIntentAction; source: IntentSource }> = [];
  // Le lieu de départ lu par les règles (« depuis Lyon ») n'est jamais la
  // destination, même si l'IA le donne comme tel.
  const origins = new Set(rules.flatMap((a) => (a.type === 'set_origin' ? [plainOf(a.place)] : [])));
  const ruleDest = rules.find((a) => a.type === 'set_destination');
  const ruleKey = ruleDest?.type === 'set_destination' ? plainOf(ruleDest.place) : '';
  // « de X à Y » lu par les règles (départ X, destination Y, et l'envie « de X à Y ») : le trajet est
  // la demande, sa destination reste celle des règles. L'IA rendait « Alpes » pour « traversée des
  // Alpes de Genève à Nice » : l'itinéraire n'arrivait jamais à Nice.
  // Seulement à pied ou à vélo : l'itinéraire « de X à Y » ne se construit pas autrement (`walksOrRides`).
  // Le pays joint par les règles (« Zermatt, Suisse ») ne compte pas dans l'envie « de X à Y ».
  const ruleOrigin = rules.find((a) => a.type === 'set_origin');
  const placeCore = (place: string) => plainOf(place.split(',')[0]).trim();
  const readFromTo =
    walksOrRides([...ai, ...rules], activity) &&
    ruleDest?.type === 'set_destination' &&
    ruleOrigin?.type === 'set_origin' &&
    rules.some(
      (w) => w.type === 'wish' && plainOf(w.label) === plainOf(`de ${ruleOrigin.place} à ${ruleDest.place.split(',')[0].trim()}`)
    );
  // Le lieu des règles qui commence le lieu de l'IA (« Vietnam » / « Vietnam du nord au sud »,
  // « Népal » / « Népal camp de base de l'Everest », 13 oct.) : l'IA a collé la suite de la
  // phrase au nom, introuvable sur la carte ; le nom des règles est gardé.
  const placed = ai
    .filter((a) => !(a.type === 'set_destination' && origins.has(plainOf(a.place))))
    .map((a) =>
      a.type === 'set_destination' && ruleDest?.type === 'set_destination' && ruleKey && gluedPlace(plainOf(a.place), ruleKey)
        ? ruleDest
        : a
    )
    .flatMap((a): CompasIntentAction[] => {
      if (a.type !== 'set_destination') return [a];
      if (readFromTo && ruleDest?.type === 'set_destination' && plainOf(a.place) !== ruleKey) {
        // Même lieu, précisé par l'IA (« Zermatt, Suisse » pour « Zermatt ») : la précision qui
        // départage les homonymes est gardée.
        if (placeCore(a.place) === placeCore(ruleDest.place))
          return [a.place.includes(',') && !ruleDest.place.includes(',') ? { ...ruleDest, place: a.place } : ruleDest];
        // Le lieu de l'IA (« Alpes ») reste une envie, sauf s'il est déjà dit ou redit celui des règles,
        // mot à mot : « Ain » n'est pas dans « Saint-Claude ».
        const said =
          hasPlaceWords(ruleDest.place, a.place) ||
          hasPlaceWords(a.place, ruleDest.place) ||
          [...ai, ...rules].some((w) => w.type === 'wish' && hasPlaceWords(w.label, a.place));
        return said ? [ruleDest] : [ruleDest, { type: 'wish', label: a.place }];
      }
      // « GR34 » n'est pas un lieu sur la carte (l'IA le donnait comme destination :
      // étapes dans l'Indre) : la région du sentier, comme pour les règles.
      const region = trailRegion(a.place);
      const place = region ?? a.place;
      // La référence du sentier vient de la phrase (règles), jamais de l'IA : reprise seulement
      // si l'IA propose la même destination.
      const trail =
        ruleDest?.type === 'set_destination' && ruleDest.trail && plainOf(ruleDest.place) === plainOf(place)
          ? ruleDest.trail
          : null;
      const dest: CompasIntentAction = { type: a.type, place, ...(trail ? { trail } : {}) };
      if (!region) return [dest];
      // Le sentier donné comme lieu reste une envie : le spécialiste en suit les étapes.
      const named = famousTrailIn(a.place);
      const wished = [...ai, ...rules].some((w) => w.type === 'wish' && famousTrailIn(w.label) != null);
      return named && !wished ? [dest, { type: 'wish', label: named }] : [dest];
    });
  for (const [list, source] of [
    [placed, 'ia'],
    [rules, 'regles'],
  ] as const) {
    for (const action of list) {
      const k = key(action);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ action, source });
    }
  }
  // Deux lieux différents (« Jordanie » pour l'IA, « Désert du Wadi Rum » pour les règles, 13 oct.) :
  // la destination de l'IA reste, celui des règles devient une envie au lieu de disparaître.
  // Le pays joint par les règles (« Tatras, Pologne ») ne fait pas deux lieux : seul le nom compte.
  // Le pays des règles quand l'IA a choisi un lieu plus précis (« Japon » pour « Kyoto ») non plus :
  // l'envie « Japon » n'apprenait rien au calcul (relecture de la PR #108, 23 oct.).
  const aiDest = out.find((x) => x.action.type === 'set_destination')?.action;
  if (
    ruleDest?.type === 'set_destination' &&
    aiDest?.type === 'set_destination' &&
    placeCore(aiDest.place) !== placeCore(ruleDest.place) &&
    !origins.has(ruleKey) &&
    !(canonicalCountryName(ruleDest.place.split(',')[0]) && !canonicalCountryName(aiDest.place.split(',')[0])) &&
    !out.some((x) => x.action.type === 'wish' && plainOf(x.action.label) === placeCore(ruleDest.place))
  )
    out.push({ action: { type: 'wish', label: ruleDest.place.split(',')[0].trim() }, source: 'regles' });
  // Une envie qui redit la destination retenue ou son pays (« Kyoto » pour Kyoto, « Italie » pour
  // « Florence, Italie ») n'apprend rien au calcul : retirée (relecture de la PR #108, 23 oct.).
  const finalDest = out.find((x) => x.action.type === 'set_destination')?.action;
  const destParts = finalDest?.type === 'set_destination' ? finalDest.place.split(',').map((part) => placeWords(part)) : [];
  return out
    .filter((x) => x.action.type !== 'wish' || !destParts.includes(placeWords(x.action.label)))
    .slice(0, 10);
}

/** Le départ lu avec un nom long possible (« Bourg » / « Bourg en Bresse »), s'il y en a un. */
export interface LinkedOrigin {
  place: string;
  longer: string;
}

export function linkedOriginOf(actions: readonly CompasIntentAction[]): LinkedOrigin | null {
  for (const a of actions) if (a.type === 'set_origin' && a.longer) return { place: a.place, longer: a.longer };
  return null;
}

/**
 * Ce que la carte a tranché pour un départ à nom long possible. Nom long confirmé
 * (`accepted`) : il devient le départ et son bout (« Bresse ») n'est plus une
 * destination, qu'elle vienne des règles ou de l'IA. Sinon le départ est le nom court,
 * la destination reste (« Lyon » puis « Corse »). Le nom long ne sort jamais d'ici.
 */
export function settleLinkedOrigin(
  actions: readonly CompasIntentAction[],
  link: LinkedOrigin | null,
  accepted: boolean
): CompasIntentAction[] {
  // Les bouts du nom long : ce qui suit chaque connecteur après le nom court (un article peut le
  // précéder) — « Luz » pour « Saint Jean de luz », « Bains » pour « Aix les bains », « Miquelon »,
  // « Sorgue » pour « L'Isle sur la Sorgue ». Une destination qui est l'un d'eux n'en est plus une.
  const tails = new Set<string>();
  if (link && accepted) {
    const long = plainOf(link.longer);
    const at = long.indexOf(plainOf(link.place));
    if (at >= 0) {
      const words = long
        .slice(at + plainOf(link.place).length)
        .replace(/'/g, "' ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      for (let i = 0; i < words.length; i += 1) {
        let j = i;
        while (j < words.length && NAME_LINKS.has(words[j])) j += 1;
        if (j < words.length) tails.add(words.slice(j).join(' '));
      }
    }
  }
  return actions.flatMap((a): CompasIntentAction[] => {
    if (a.type === 'set_origin') return [{ type: 'set_origin', place: accepted && a.longer ? a.longer : a.place }];
    if (a.type === 'set_destination' && tails.has(plainOf(a.place))) return [];
    return [a];
  });
}

export function validateActions(
  list: Array<{ action: CompasIntentAction; source: IntentSource; issue?: string | null }>,
  ctx: IntentContext
): CompasProposal[] {
  // Des dates refusées (absentes de la phrase) ne masquent ni la durée ni rien d'autre.
  const dates = list.find((x) => x.action.type === 'set_dates' && !x.issue)?.action as
    Extract<CompasIntentAction, { type: 'set_dates' }> | undefined;
  const hasStart = Boolean(dates?.start ?? ctx.startDate);
  const known = (values: string[]) => new Set(values.map(plainOf));
  const avoid = known(ctx.avoid);
  const wishes = known(ctx.wishes);
  // Une « envie » qui ne fait que redire la destination ou l'activité
  // (« voyage au Japon », « plaisir du trail ») n'apporte rien au spécialiste.
  const places = list
    .filter((x) => x.action.type === 'set_destination' && !x.issue)
    .map((x) => plainOf((x.action as { place: string }).place));
  const restatesPlace = (label: string) => {
    const core = plainOf(label)
      .replace(
        /\b(voyage|voyages|sejour|sejours|trip|vacances|visite|visiter|decouvrir|decouverte|plaisir|profiter|fun|kiffer|aventure|activite|sortie|trail|rando|randonnee|trek|trekking|ski|velo|course|courir|escalade|kayak|canoe|plage|bivouac|road|city|au|aux|en|a|le|la|les|l|du|de|des|d|dans|un|une)\b/g,
        ' '
      )
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return !core || places.some((p) => p.replace(/[^a-z0-9]+/g, ' ').trim() === core);
  };

  // Le groupe d'un montant « par personne » : celui de la phrase (une taille valide), sinon celui du voyage.
  const saidParty = list.find(
    (x) => x.action.type === 'set_party_size' && !x.issue && x.action.count >= 1 && x.action.count <= 50
  )?.action as Extract<CompasIntentAction, { type: 'set_party_size' }> | undefined;
  const group = saidParty?.count ?? (ctx.partySize != null && ctx.partySize >= 1 ? ctx.partySize : null);

  return list
    .filter((x) => !(x.action.type === 'set_duration' && dates?.end && x.action.hours == null))
    .map((x, i) => {
      let a = x.action;
      let reason: string | null = x.issue ?? null;
      if (!reason && a.type === 'set_budget' && a.perPerson) {
        if (group == null) {
          reason = 'Dis aussi combien vous êtes (« à 4 ») : un montant par personne se multiplie par le groupe';
        } else {
          const { perPerson: _per, ...rest } = a;
          a = { ...rest, amount: Math.round(a.amount * group * 100) / 100, groupOf: group };
        }
      }
      if (!reason) {
        switch (a.type) {
          case 'set_dates': {
            if (a.start < ctx.today) reason = 'Date passée';
            else if (daysBetweenIso(ctx.today, a.start) > MAX_AHEAD_DAYS)
              reason = 'Plus de 18 mois à l’avance';
            else if (a.end && a.end < a.start) reason = 'La fin précède le départ';
            else if (a.end && daysBetweenIso(a.start, a.end) + 1 > MAX_TRIP_DAYS)
              reason = `Plus de ${MAX_TRIP_DAYS} jours`;
            break;
          }
          case 'set_duration':
            if (a.days != null && a.days > MAX_TRIP_DAYS) reason = `Plus de ${MAX_TRIP_DAYS} jours`;
            else if (a.days == null && a.hours == null) reason = 'Durée illisible';
            // Sans date de départ, une durée en jours se garde (préremplissage) ;
            // une durée en heures n'a de sens qu'avec un jour.
            else if (!hasStart && a.days == null) reason = 'Donne aussi le jour de départ';
            break;
          case 'set_party_size':
            if (a.count > 50) reason = 'Plus de 50 personnes';
            break;
          case 'set_budget':
            if (a.currency && a.currency !== ctx.currency)
              reason = `Taux de change indisponible : redis le montant en ${ctx.currency === 'EUR' ? 'euros' : ctx.currency}`;
            else if (a.amount < ctx.engaged)
              reason = `Sous les ${formatMoney(ctx.engaged, ctx.currency)} déjà engagés`;
            break;
          case 'avoid':
            if (avoid.has(plainOf(a.label))) reason = 'Déjà noté';
            else if (avoid.size >= 8) reason = 'Déjà 8 choses à éviter';
            break;
          case 'wish':
            if (wishes.has(plainOf(a.label))) reason = 'Déjà noté';
            else if (restatesPlace(a.label)) reason = 'Rien de plus que la destination ou l’activité';
            else if (wishes.size >= 8) reason = 'Déjà 8 envies';
            break;
          default:
            break;
        }
      }
      return {
        id: `${i}-${a.type}`,
        action: a,
        label: actionLabel(a, ctx.currency),
        ok: reason == null,
        reason,
        source: x.source,
      };
    });
}

/* ---------- Plan d'application (côté écran) ---------- */

export interface ApplyCurrent {
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  /** Durée courte en heures si la sortie tient en moins d'un jour. */
  shortHours: number | null;
  /** Durée retenue sans date de départ (« 20 jours ») : reprise quand le départ arrive. */
  plannedDays?: number | null;
  preferences: CompasPreferences;
  hasRoute: boolean;
  /** Nom du lieu de départ déjà rangé sur le voyage : le redire ne le cherche pas à nouveau. */
  originName?: string | null;
}

export type ApplyOp =
  | {
      op: 'dates';
      startDate: string;
      endDate: string;
      durationHours: number | null;
      resplit: boolean;
    }
  | { op: 'party'; partySize: number }
  | { op: 'budget'; amount: number }
  | { op: 'prefs'; preferences: CompasPreferences }
  | { op: 'activity'; activity: CompasActivity }
  | { op: 'item'; name: string; quantity: number }
  | { op: 'route'; query: string }
  /** `trail` : référence du sentier dite (« GR34 »), pour le référentiel `geo_trails`. */
  | { op: 'destination'; place: string | null; trail?: string }
  /**
   * Lieu de départ dit (« depuis Lyon ») ; null l'efface. `restore` : le départ
   * d'avant tel qu'il était rangé (« Annuler »), écrit sans le rechercher à nouveau.
   */
  | {
      op: 'origin';
      place: string | null;
      restore?: { name: string; lat: number; lon: number; countryCode: string | null };
    }
  /** Durée connue sans date de départ (« 20 jours ») ; null efface. */
  | { op: 'span'; days: number | null };

/** Regroupe les actions retenues en opérations serveur (une par réglage). */
export function planApplication(actions: CompasIntentAction[], current: ApplyCurrent): ApplyOp[] {
  const ops: ApplyOp[] = [];
  const dates = actions.find((a) => a.type === 'set_dates') as
    Extract<CompasIntentAction, { type: 'set_dates' }> | undefined;
  const said = actions.find((a) => a.type === 'set_duration') as
    Extract<CompasIntentAction, { type: 'set_duration' }> | undefined;
  // « 3 nuits sous tente en Ardèche » sur un projet sans durée : 3 nuits = 4 jours.
  // Un projet qui a déjà sa durée la garde (les nuits dehors s'y répartissent).
  const outdoor = actions.find((a) => a.type === 'set_outdoor_nights') as
    Extract<CompasIntentAction, { type: 'set_outdoor_nights' }> | undefined;
  const implied =
    !said && outdoor && !dates?.end && current.days == null && current.plannedDays == null && current.shortHours == null
      ? { type: 'set_duration' as const, days: outdoor.nights + 1, hours: null }
      : undefined;
  const duration = said ?? implied;
  const start = dates?.start ?? current.startDate;
  if (start && (dates || duration)) {
    let endDate: string;
    let durationHours: number | null = null;
    if (duration?.hours != null) {
      endDate = start;
      durationHours = duration.hours;
    } else if (duration?.days != null) {
      endDate = addDaysIso(start, Math.min(MAX_TRIP_DAYS, duration.days) - 1);
    } else if (dates?.end) {
      endDate = dates.end;
    } else {
      const keep = current.days ?? current.plannedDays ?? null;
      endDate = addDaysIso(start, Math.min(MAX_TRIP_DAYS, keep ?? 1) - 1);
      durationHours = keep == null || current.days != null ? current.shortHours : null;
    }
    const days = daysBetweenIso(start, endDate) + 1;
    ops.push({
      op: 'dates',
      startDate: start,
      endDate,
      durationHours,
      resplit: current.hasRoute && days !== current.days,
    });
  } else if (!start && duration?.days != null) {
    ops.push({ op: 'span', days: Math.min(MAX_TRIP_DAYS, duration.days) });
  }
  // La destination d'abord : le reste (parcours, préremplissage) en dépend.
  const destination = actions.find((a) => a.type === 'set_destination') as
    Extract<CompasIntentAction, { type: 'set_destination' }> | undefined;
  if (destination)
    ops.unshift({
      op: 'destination',
      place: destination.place,
      ...(destination.trail ? { trail: destination.trail } : {}),
    });

  const prefs: CompasPreferences = {
    ...current.preferences,
    avoid: [...current.preferences.avoid],
    wishes: [...current.preferences.wishes],
  };
  let prefsChanged = false;
  for (const a of actions) {
    switch (a.type) {
      case 'set_party_size':
        ops.push({ op: 'party', partySize: a.count });
        break;
      case 'set_budget':
        ops.push({ op: 'budget', amount: a.amount });
        break;
      case 'set_activity':
        ops.push({ op: 'activity', activity: a.activity });
        break;
      case 'add_item':
        ops.push({ op: 'item', name: a.name, quantity: a.quantity });
        break;
      case 'search_route':
        ops.push({ op: 'route', query: a.query });
        break;
      case 'set_pace':
        prefs.pace = a.pace;
        prefsChanged = true;
        break;
      case 'set_nights':
        prefs.nights = a.nights;
        prefsChanged = true;
        break;
      case 'avoid':
        prefs.avoid = [...prefs.avoid, a.label].slice(0, 8);
        prefsChanged = true;
        break;
      case 'wish':
        prefs.wishes = [...prefs.wishes, a.label].slice(0, 8);
        prefsChanged = true;
        break;
      case 'set_outdoor_nights':
        prefs.outdoorNights = a.nights;
        prefsChanged = true;
        break;
      case 'set_distance':
        prefs.targetKm = a.km;
        prefsChanged = true;
        break;
      case 'set_max_pack':
        prefs.maxPackKg = a.kg;
        prefsChanged = true;
        break;
      case 'set_level':
        prefs.level = a.level;
        prefsChanged = true;
        break;
      case 'set_terrain':
        prefs.terrain = a.terrain;
        prefsChanged = true;
        break;
      case 'set_car_free':
        prefs.carFree = true;
        prefsChanged = true;
        break;
      default:
        break;
    }
  }
  if (prefsChanged) ops.push({ op: 'prefs', preferences: prefs });
  // Le lieu de départ (« depuis Lyon ») en dernier : le trajet d'approche se chiffre depuis là,
  // rien ne dépend de lui, et s'il échoue (lieu inconnu) tout le reste est déjà appliqué.
  const origin = actions.find((a) => a.type === 'set_origin') as
    Extract<CompasIntentAction, { type: 'set_origin' }> | undefined;
  if (origin && !(current.originName && samePlaceName(current.originName, origin.place)))
    ops.push({ op: 'origin', place: origin.place });
  return ops;
}
