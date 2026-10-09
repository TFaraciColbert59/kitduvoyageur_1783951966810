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
import { HOLIDAY_RE, HOLIDAY_WORD, holidayDate, readMoney, spellNumbers } from './intentWords';

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
  z.object({ type: z.literal('set_destination'), place: label }),
  z.object({ type: z.literal('set_outdoor_nights'), nights: z.number().int().min(1).max(60) }),
  z.object({ type: z.literal('set_max_pack'), kg: z.number().min(1).max(40) }),
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
}

export const MAX_TRIP_DAYS = 30;
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
];
const MONTH_RE =
  '(janvier|janv\\.?|fevrier|fevr?\\.?|mars|avril|avr\\.?|mai|juin|juillet|juil\\.?|aout|septembre|sept\\.?|octobre|oct\\.?|novembre|nov\\.?|decembre|dec\\.?|january|february|march|april|may|june|july|august|september|october|november|december)';
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
    /\s(?:et|puis|mais|pour|avec|sans|en|dans|du|le|la|a|au|à|on|depart|départ|des|dès)\s|\s(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|ce|cette|prochain|prochaine)(?=\s|$)|[,.;!?]|\d/i
  );
  return cut >= 0 ? fragment.slice(0, cut) : fragment;
}

/** Nom commun de lieu qui peut ouvrir un nom propre (« lac d'Annecy »). */
const PLACE_NOUN =
  /^(?:lacs?|calanques?|massifs?|parc(?: national| naturel(?: régional)?)?|gorges|vallée|vallee|îles?|iles?|côte|cote|monts?|col|forêt|foret|plateau|baie|golfe|cirque|presqu['’]île|presqu['’]ile|canyon|désert|desert|volcans?|aiguilles?|dents?)\s+(?:de la |de l['’]|du |des |de |d['’])/iu;

/** Le fragment commence-t-il par un nom de lieu (nom propre, ou « lac de X ») ? */
function properLead(fragment: string): boolean {
  if (/^\p{Lu}/u.test(fragment)) return true;
  const lead = PLACE_NOUN.exec(fragment);
  return !!lead && /^\p{Lu}/u.test(fragment.slice(lead[0].length));
}

/** Un mois, un jour de la semaine ou une fête n'est jamais une destination (« à Noël »). */
function notAPlace(name: string): boolean {
  const plain = plainOf(name);
  return monthOf(plain) != null || WEEKDAYS.includes(plain) || HOLIDAY_WORD.test(plain);
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

/** Sentiers célèbres → région où les préparer (le sentier reste une envie). */
const FAMOUS_TRAILS: Array<[RegExp, string]> = [
  [/\bgr ?20\b/, 'Corse'],
  [/\b(?:gr ?10|hrp|haute route pyreneenne)\b/, 'Pyrénées'],
  [/\bgr ?54\b|\btour de l'oisans\b/, 'Écrins'],
  [/\bgr ?34\b|\bsentier des douaniers\b/, 'Bretagne'],
  [/\bgr ?5\b/, 'Alpes'],
  [/\bgr ?65\b|\bchemin du puy\b|\bvia podiensis\b/, 'Le Puy-en-Velay'],
  [/\bgr ?70\b|\bchemin de stevenson\b/, 'Cévennes'],
  [/\btmb\b|\btour du mont[- ]blanc\b/, 'Mont Blanc'],
  [/\bchemin de l'inca\b|\binca trail\b/, 'Machu Picchu'],
  [/\bkungsleden\b/, 'Laponie suédoise'],
  [/\bwest highland way\b/, 'Écosse'],
];

/** Région d'un sentier célèbre nommé comme un lieu (« GR34 », « Tour du Mont-Blanc »), sinon null. */
export function trailRegion(place: string): string | null {
  const plain = plainOf(place);
  return FAMOUS_TRAILS.find(([re]) => re.test(plain))?.[1] ?? null;
}

/** Noms communs de paysage ou de moment : jamais une destination à eux seuls. */
const COMMON_PLACE_WORDS =
  /^(?:bois|foret|forets|montagnes?|campagne|nature|mer|plage|plages|neige|environs|alentours|coin|region|parc|fjords?|calanques?|lacs?|riviere|vallee|ville|famille|couple|groupe|solo|van|velo|pied|cheval|ski|bord|mer|lac|journee|semaine|soiree|matinee|apres-?midi|hiver|ete|automne|printemps)$/;

export function parseIntentRules(text: string, today: string): CompasIntentAction[] {
  const src = text.normalize('NFC').slice(0, 400);
  // Nombres en lettres écrits en chiffres, aux mêmes positions que dans `src`.
  const plain = spellNumbers(plainOf(src));
  const out: CompasIntentAction[] = [];

  /* Dates */
  let start: string | null = null;
  let end: string | null = null;
  // « dans 3 semaines », « dans quinze jours » : un départ, pas une durée.
  const inN = new RegExp(`\\b(?:dans|in)\\s+${NUM}\\s*(jours?|j|semaines?|mois|days?|weeks?|months?)\\b`).exec(plain);
  const iso = [...plain.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map((m) =>
    resolveDayMonth(today, Number(m[3]), Number(m[2]), Number(m[1]))
  );
  const slashRange =
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:au|a|-|–|->|jusqu'au)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(plain);
  // Anglais : le mois avant le jour (« from July 3 to July 12 », « July 3rd »).
  const EN_MONTH = '(january|february|march|april|may|june|july|august|september|october|november|december)';
  const enRange = new RegExp(
    `\\bfrom\\s+${EN_MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:to|until|-)\\s+(?:${EN_MONTH}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`
  ).exec(plain);
  const holiday = holidayDate(plain, today);
  const enSingle = new RegExp(`\\b${EN_MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:days?|nights?|weeks?|jours?|nuits?))`).exec(plain);
  const range = new RegExp(
    `\\bdu\\s+(\\d{1,2})(?:er)?(?:\\s+${MONTH_RE})?\\s+au\\s+(\\d{1,2})(?:er)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?`
  ).exec(plain);
  const single = new RegExp(`\\b(\\d{1,2})(?:er)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?`).exec(plain);
  const slash = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(plain);
  const yearOf = (y: string | undefined) => (y ? Number(y.length === 2 ? `20${y}` : y) : null);
  if (iso[0]) {
    start = iso[0];
    end = iso[1] && iso[1] >= iso[0] ? iso[1] : null;
  } else if (slashRange) {
    start = dayMonthAnyOrder(today, Number(slashRange[1]), Number(slashRange[2]), yearOf(slashRange[3]));
    end = start
      ? dayMonthAnyOrder(start, Number(slashRange[4]), Number(slashRange[5]), yearOf(slashRange[6]) ?? Number(start.slice(0, 4)))
      : null;
    if (start && end && end < start)
      end = dayMonthAnyOrder(start, Number(slashRange[4]), Number(slashRange[5]), Number(start.slice(0, 4)) + 1);
  } else if (enRange) {
    const m1 = monthOf(enRange[1]) ?? 0;
    const m2 = enRange[3] ? (monthOf(enRange[3]) ?? m1) : m1;
    start = resolveDayMonth(today, Number(enRange[2]), m1, null);
    end = start ? resolveDayMonth(start, Number(enRange[4]), m2, Number(start.slice(0, 4))) : null;
    if (start && end && end < start) end = resolveDayMonth(start, Number(enRange[4]), m2, Number(start.slice(0, 4)) + 1);
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
    start = dayMonthAnyOrder(today, Number(slash[1]), Number(slash[2]), yearOf(slash[3]));
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
    start = holiday;
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
  } else if (/\bweek[- ]?end\b/.test(plain)) {
    const next = /week[- ]?end prochain|prochain week[- ]?end/.test(plain) && weekday(today) >= 5;
    start = addDaysIso(nextWeekday(today, 6, false), next ? 7 : 0);
    if (weekday(today) === 0) start = addDaysIso(today, 6);
  } else {
    const wd = new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`).exec(plain);
    if (wd) start = nextWeekday(today, WEEKDAYS.indexOf(wd[1]), true);
  }
  // Un mois seul : « en janvier », « début mai », « fin août 2027 ». Le départ
  // se pose au début (au 15 pour « mi », au 22 pour « fin ») ; un « week-end »
  // dans ce mois tombe sur son premier samedi. Ce mois-ci : à partir d'aujourd'hui.
  if (!range && !single && !slash && !iso[0] && !slashRange && !enRange && !enSingle && !inN && !holiday) {
    const monthOnly = new RegExp(
      `\\b(?:(debut|mi|fin)[\\s-]+(?:de\\s+|d')?|en\\s+|in\\s+|au mois d[e']\\s*|courant\\s+)${MONTH_RE}(?:\\s+(\\d{4}))?`
    ).exec(plain);
    const month = monthOnly ? monthOf(monthOnly[2]) : null;
    if (monthOnly && month) {
      const day = monthOnly[1] === 'mi' ? 15 : monthOnly[1] === 'fin' ? 22 : 1;
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
  if (/\b(montagnes?|haute altitude|sommets?)\b/.test(plain))
    out.push({ type: 'set_terrain', terrain: 'montagne' });
  else if (/\bhors[- ]sentiers?\b/.test(plain)) out.push({ type: 'set_terrain', terrain: 'hors_sentier' });

  /* Durée */
  const dur =
    new RegExp(`\\b${NUM}\\s*(jours?|j|nuits?|semaines?|mois|days?|nights?|weeks?|months?)(\\s+et\\s+demie?)?\\b(?![- ]?end)`).exec(durPlain) ??
    (/\bdemi-journee\b/.test(plain) ? null : /\b(une|la|1)\s+journee\b/.exec(plain));
  const hoursMatch =
    // « 1h30 », « 2 h 15 » ; jamais les minutes d'un nombre suivi d'une unité (« 1h 10 km »).
    /(?<!(?:\ba|\bvers|depart|depart a|des)\s)\b(\d{1,2})\s*h(?:eures?)?(?:\s*(\d{2})(?!\s*(?:km|kilo|m\b|€|eur|kg|g\b|%|pers|min)))?\b(?!\s*du matin)/.exec(
      plain
    );
  const hoursWord = new RegExp(`\\b${NUM}\\s+heures?(\\s+et\\s+demie)?\\b`).exec(plain);
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
            : n;
      out.push({ type: 'set_duration', days: Math.round(days), hours: null });
    }
  } else if (dur) {
    out.push({ type: 'set_duration', days: 1, hours: null });
  } else if (/\bdemi-journee\b/.test(plain)) {
    out.push({ type: 'set_duration', days: null, hours: 4 });
  } else if (hoursWord && !/\b(a|vers|depart)\s+$/.test(plain.slice(0, hoursWord.index))) {
    const n = toNumber(hoursWord[1]);
    if (n != null && n > 0 && n < 24)
      out.push({ type: 'set_duration', days: null, hours: n + (hoursWord[2] ? 0.5 : 0) });
  } else if (hoursMatch) {
    const h = Number(hoursMatch[1]) + (hoursMatch[2] ? Number(hoursMatch[2]) / 60 : 0);
    if (h > 0 && h < 24)
      out.push({ type: 'set_duration', days: null, hours: Math.round(h * 4) / 4 });
  } else if (/\bweek[- ]?end\b/.test(plain)) {
    out.push({ type: 'set_duration', days: 2, hours: null });
  } else if (/\b(cet apres-?midi|ce matin|ce soir)\b/.test(plain)) {
    // Un moment de la journée sans durée dite : quelques heures, pas un séjour.
    out.push({ type: 'set_duration', days: null, hours: /\bce soir\b/.test(plain) ? 2 : 3 });
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
  }

  /* Personnes */
  const counted = new RegExp(
    `\\b${NUM}\\s+(personnes?|pers\\b|randonneurs?|adultes?|amis|copains|participants)`
  ).exec(plain);
  const afterAll = new RegExp(
    `\\b(?:a|pour|on est|on sera|nous sommes|nous serons|(?:une |en )?famille de|(?:un )?groupe de|bande de|equipe de)\\s+${NUM}\\b(?!\\s*(?:jours?|j\\b|h\\b|heures?|nuits?|km|kilos?|kg|g\\b|m\\b|metres?|€|euros?|eur\\b|semaines?|mois|min|%|ans|personnes?|k\\b|\\$|£|¥|dollars?|livres?|chf|usd|gbp|cad))`,
    'g'
  );
  // « nous sommes une famille de 5 » : « une » est un article, le nombre vient après.
  const after = [...plain.matchAll(afterAll)].find((m) => !/^(un|une)$/.test(m[1])) ?? null;
  const people = counted ?? after;
  const total = partySum(plain);
  if (total != null) {
    out.push({ type: 'set_party_size', count: total });
  } else if (people) {
    const n = toNumber(people[1]);
    if (n != null && Number.isInteger(n) && n >= 1) out.push({ type: 'set_party_size', count: n });
  } else if (/\b(en solo|seul|seule)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 1 });
  } else if (/\b(en couple|en duo)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 2 });
  }

  /* Enveloppe : « 800 € », « 2000 $ », « 1,500 € », « 3k€ », « budget de 1 500 » */
  const money = readMoney(plain, src);
  if (money && money.amount <= 1_000_000)
    out.push({ type: 'set_budget', amount: money.amount, ...(money.currency ? { currency: money.currency } : {}) });

  /* Rythme */
  if (
    /\b(tranquille|tranquillement|cool|doucement|pepere|zen|lentement|sans forcer)\b/.test(plain)
  ) {
    out.push({ type: 'set_pace', pace: 'tranquille' });
  } else if (/\b(soutenu|rapide|sportif|sportive|intense|vite|engage)\b/.test(plain)) {
    out.push({ type: 'set_pace', pace: 'soutenu' });
  } else if (/\brythme normal\b/.test(plain)) {
    out.push({ type: 'set_pace', pace: 'normal' });
  }

  /* Nuits */
  const nights = new Set<CompasNights>();
  if (!outdoor && /\b(bivouac|bivouaquer|bivouaque|sous (?:la )?tente|camper|camping(?![- ]car)|dormir dehors|belle etoile)\b/.test(plain))
    nights.add('bivouac');
  if (/\brefuges?\b/.test(plain)) nights.add('refuge');
  if (/\b(gites?|hotels?|chambres? d'hotes?|auberges?|hebergements?)\b/.test(plain))
    nights.add('hebergement');
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
  const act = activity.find(([re]) => re.test(plain));
  if (act) out.push({ type: 'set_activity', activity: act[1] });
  // « 5 jours dans les Dolomites en refuge » : dormir en refuge, c'est marcher.
  else if (nights.has('refuge')) out.push({ type: 'set_activity', activity: 'hiking' });

  /* Éviter, envies */
  for (const m of plain.matchAll(
    /\b(?:sans|eviter|evite|pas de|pas d'|aucun|aucune)\s+([^,.;!?]+)/g
  )) {
    const at = (m.index ?? 0) + m[0].length - m[1].length;
    const value = clean(upToBreak(src.slice(at, at + m[1].length)));
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

  /* Destination : « au Népal », « en Islande », « à Chamonix » (nom propre) */
  // « à la Réunion », « à l’Île de Ré », « dans l’Ain » ; « in Iceland » (anglais).
  // « sur la Dordogne », « autour du lac d'Annecy », « traversée des Pyrénées »,
  // « in the Swiss Alps » ; un nom commun de lieu (« lac », « calanques ») suivi
  // d'un nom propre compte (« dans les calanques de Marseille »).
  for (const m of plain.matchAll(
    /(?:^|[\s,(])(?:(?:a|dans|sur|autour de|le long de|descente de) l'\s*|autour d'\s*|(?:au|aux|en|in the|in|a la|a|dans le|dans la|dans les|sur le|sur la|sur les|autour du|autour de|autour des|le long (?:du|des|de la)|(?:traversee|tour|trek|ascension|circuit|rando|randonnee|boucle|descente) (?:des|du|de la|de))\s+)/g
  )) {
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!properLead(original)) continue;
    // « sur le GR20 » : un code de sentier, pas une destination.
    if (/^\p{Lu}{1,4}\s?\d/u.test(original)) continue;
    // Coupe à la ponctuation ou au premier chiffre, puis au premier mot d'une autre idée.
    const place = clean(
      original.split(/[,.;!?\d]/)[0].split(
        // Fin du nom : un mot qui ouvre une autre idée (durée, date, compagnie).
        // « du », « le », « la » ne coupent que devant un nombre (« Afrique du Sud »,
        // mais « Vercors du 3 au 10 juin »).
        /\s(?:(?:du|le|la|les)(?=\s+(?:\d|mois\b|semaine\b|prochaine?\b))|pour|avec|en|a|à|à partir|pendant|durant|sur|et|sans|budget|plage|plages|temples?|musees?|fjords?|autour|via|pas|safari|un|une|deux|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|cette|ce|tout|toute|semaines?|jours?|nuits?|days?|weeks?|nights?|for|from|to|until|week[- ]?end|début|debut|mi|fin|noël|noel|pâques|paques|toussaint|demain|après-demain|apres-demain|aujourd['’]hui|prochain|prochaine|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?=[\s-]|$)/i
      )[0],
      50
    )
      // « Norvège dans les fjords » : le nom s'arrête avant la préposition restée seule.
      .replace(/\s+(?:dans|in|sur|vers|près|pres)$/i, '');
    if (place.length >= 2 && !notAPlace(place)) {
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
      // « au Maroc à Marrakech » : la ville dite ensuite précise le pays.
      const city = /^(?:en|au|aux)\s/.test(m[0].trimStart())
        ? /^\s*,?\s*(?:à|a)\s+(\p{Lu}[\p{L}'’-]+(?:[\s-]\p{Lu}[\p{L}'’-]+)*)/u.exec(src.slice(at + place.length, at + place.length + 60))
        : null;
      if (city && !notAPlace(city[1])) {
        out.push({ type: 'set_destination', place: clean(city[1], 50) });
        break;
      }
      out.push({ type: 'set_destination', place: capitalized(place) });
      // « en Patagonie, Torres del Paine » : le lieu précis qui suit devient une
      // envie, transmise au spécialiste de l'itinéraire (sans resserrer la
      // destination : « Japon, Tokyo et Kyoto » reste un voyage au Japon).
      const after = /^\s*,\s*(\p{Lu}[^,.;!?\d]*)/u.exec(original.slice(original.indexOf(place) + place.length));
      const precise = after ? clean(after[1].split(/\s(?:et|pour|avec|en|du|pendant|durant|à|a)\s/i)[0], 40) : '';
      if (precise.length >= 3 && !notAPlace(precise))
        out.push({ type: 'wish', label: precise });
      break;
    }
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

  /* Sentier célèbre sans lieu dit (« GR20 en 12 jours ») : sa région. */
  if (!out.some((a) => a.type === 'set_destination')) {
    const known = FAMOUS_TRAILS.find(([re]) => re.test(plain));
    if (known) out.push({ type: 'set_destination', place: known[1] });
  }

  /* Dernier recours : un nom propre composé hors du premier mot
     (« alpinisme 4 jours Mont Blanc »). */
  if (!out.some((a) => a.type === 'set_destination')) {
    // Jamais une personne (« rando avec Paul ») : pas après « avec », « et », « chez »…
    for (const m of src.matchAll(/(?<!\b(?:avec|et|chez|pour|par|mon|ma|mes|ton|ta|copain|copine|ami|amie)\s)(?<=\s)(\p{Lu}[\p{L}'’-]+(?:[\s-]+\p{Lu}[\p{L}'’-]+)*)/gu)) {
      const name = clean(m[1], 50);
      if (name.length >= 3 && !notAPlace(name) && !/^(?:je|j|on|nous|il|elle)$/i.test(name)) {
        out.push({ type: 'set_destination', place: name });
        break;
      }
    }
  }

  /* Phrase tapée sans majuscule (« randoo 3 jour dans les vosges ») : le nom
     après une préposition de lieu, hors noms communs de paysage. */
  if (!out.some((a) => a.type === 'set_destination') && !/\p{Lu}/u.test(src)) {
    const low = /\b(?:dans l'\s*|(?:dans les|dans le|dans la|en|au|aux|a|vers|pres de)\s+)([a-z][a-z'-]{2,}(?:\s(?!(?:pour|avec|en|a|et|du|de|des|le|la|les|sans|dans|ce|cet|cette|demain|apres-demain|aujourd'hui|prochain|prochaine|matin|soir)\b)[a-z][a-z'-]{2,})?)/.exec(plain);
    const word = low ? low[1].trim() : '';
    if (word && !COMMON_PLACE_WORDS.test(word.split(/\s/)[0]) && toNumber(word.split(/\s/)[0]) == null && !notAPlace(word))
      out.push({ type: 'set_destination', place: word.split(/\s/).map(capitalized).join(' ') });
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
    if (!properLead(original)) continue;
    const lead = /^\p{Lu}/u.test(original) ? '' : (PLACE_NOUN.exec(original)?.[0] ?? '');
    const query = capitalized(clean(lead + upToBreak(original.slice(lead.length)), 50));
    if (query.length >= 3 && !notAPlace(query)) {
      out.push({ type: 'search_route', query });
      break;
    }
  }

  return out;
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
function partySum(plain: string): number | null {
  const kinds = new Map<string, number>();
  for (const m of plain.matchAll(new RegExp(`\\b${NUM}\\s+(adultes?|enfants?|ados?|adolescente?s?|bebes?|grands-parents|parents)\\b`, 'g'))) {
    const n = toNumber(m[1]);
    const kind = m[2].replace(/s$/, '').replace(/e$/, '');
    if (n != null && Number.isInteger(n) && n > 0 && !kinds.has(kind)) kinds.set(kind, n);
  }
  return kinds.size >= 2 ? [...kinds.values()].reduce((a, b) => a + b, 0) : null;
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
        (d === 1 && /journee/.test(plain));
      return ok ? null : 'Durée absente de ta phrase';
    }
    case 'set_party_size':
      // Le nombre doit être dit À PROPOS DES PERSONNES (« à 4 », « 4 amis ») :
      // « 4 jours de rando » ne fait pas un groupe de 4.
      return partyGrounded(spellNumbers(plain), action.count) ||
        (action.count === 1 && /\b(seul|seule|solo)\b/.test(plain)) ||
        (action.count === 2 && /\b(couple|duo)\b/.test(plain))
        ? null
        : 'Nombre absent de ta phrase';
    case 'set_budget': {
      if (!numberInText(text, action.amount)) return 'Montant absent de ta phrase';
      // Une devise n'est retenue que si la phrase la dit (« 2000 $ »).
      const said = readMoney(spellNumbers(plain), text.normalize('NFC'))?.currency ?? null;
      return action.currency && action.currency !== said ? 'Devise absente de ta phrase' : null;
    }
    case 'avoid':
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
      return /\b(montagne|altitude|sommet|hors[- ]sentier|sentier|mountain)/.test(plain) ? null : 'Terrain absent de ta phrase';
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
      return `Durée : ${formatHours(action.hours ?? (action.days ?? 1) * 24)}`;
    case 'set_party_size':
      return `${action.count} personne${action.count > 1 ? 's' : ''}`;
    case 'set_budget':
      // Converti par le serveur : le montant dit et le taux restent visibles.
      return action.said
        ? `Enveloppe : ${formatMoney(action.amount, action.currency ?? currency)} (${formatMoney(action.said.amount, action.said.currency)}, taux du ${formatDayMonth(action.said.date)}, ${action.said.source})`
        : `Enveloppe : ${formatMoney(action.amount, action.currency ?? currency)}`;
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

/** Les actions de l'IA d'abord ; les règles complètent ce qu'elle a oublié. */
export function mergeActions(
  ai: CompasIntentAction[],
  rules: CompasIntentAction[]
): Array<{ action: CompasIntentAction; source: IntentSource }> {
  const seen = new Set<string>();
  const out: Array<{ action: CompasIntentAction; source: IntentSource }> = [];
  // « GR34 » n'est pas un lieu sur la carte (l'IA le donnait comme destination :
  // étapes dans l'Indre) : la région du sentier, comme pour les règles.
  const placed = ai.map((a) => (a.type === 'set_destination' ? { ...a, place: trailRegion(a.place) ?? a.place } : a));
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
  return out.slice(0, 10);
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

  return list
    .filter((x) => !(x.action.type === 'set_duration' && dates?.end && x.action.hours == null))
    .map((x, i) => {
      const a = x.action;
      let reason: string | null = x.issue ?? null;
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
  | { op: 'destination'; place: string | null }
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
  if (destination) ops.unshift({ op: 'destination', place: destination.place });

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
      default:
        break;
    }
  }
  if (prefsChanged) ops.push({ op: 'prefs', preferences: prefs });
  return ops;
}
