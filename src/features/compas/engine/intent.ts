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
] as const;
export type CompasActivity = (typeof COMPAS_ACTIVITIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const label = z.string().trim().min(1).max(60);

export const intentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_dates'), start: isoDate, end: isoDate.nullable() }),
  z.object({
    type: z.literal('set_duration'),
    days: z.number().int().min(1).max(60).nullable(),
    hours: z.number().min(0.25).max(23.75).nullable(),
  }),
  z.object({ type: z.literal('set_party_size'), count: z.number().int().min(1).max(99) }),
  z.object({ type: z.literal('set_budget'), amount: z.number().positive().max(1_000_000) }),
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
  const plain = plainOf(text).replace(/(\d)[\s\u202f\u00a0.](?=\d{3}\b)/g, '$1');
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
  /\b(aujourd'hui|demain|apres-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week-?end|semaine prochaine|mois prochain)\b/;

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

function nextWeekday(today: string, target: number, strict: boolean): string {
  const delta = (target - weekday(today) + 7) % 7;
  return addDaysIso(today, delta === 0 && strict ? 7 : delta);
}

/** La date proposée est-elle ancrée dans la phrase ? */
function dateGrounded(text: string, iso: string, end = false): boolean {
  const plain = plainOf(text);
  if (RELATIVE_DATE.test(plain)) return true;
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
    /\s(?:et|puis|mais|pour|avec|en|du|le|la|a|au|à|on|depart|départ|des|dès)\s|[,.;!?]|\d/i
  );
  return cut >= 0 ? fragment.slice(0, cut) : fragment;
}

export function parseIntentRules(text: string, today: string): CompasIntentAction[] {
  const src = text.normalize('NFC').slice(0, 400);
  const plain = plainOf(src);
  const out: CompasIntentAction[] = [];

  /* Dates */
  let start: string | null = null;
  let end: string | null = null;
  const range = new RegExp(
    `\\bdu\\s+(\\d{1,2})(?:er)?(?:\\s+${MONTH_RE})?\\s+au\\s+(\\d{1,2})(?:er)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?`
  ).exec(plain);
  const single = new RegExp(`\\b(\\d{1,2})(?:er)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?`).exec(plain);
  const slash = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(plain);
  if (range) {
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
  } else if (slash) {
    const y = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : null;
    start = resolveDayMonth(today, Number(slash[1]), Number(slash[2]), y);
  } else if (/\bapres-demain\b/.test(plain)) {
    start = addDaysIso(today, 2);
  } else if (/\bdemain\b/.test(plain)) {
    start = addDaysIso(today, 1);
  } else if (/\bweek-?end\b/.test(plain)) {
    const next = /week-?end prochain|prochain week-?end/.test(plain) && weekday(today) >= 5;
    start = addDaysIso(nextWeekday(today, 6, false), next ? 7 : 0);
    if (weekday(today) === 0) start = addDaysIso(today, 6);
  } else {
    const wd = new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`).exec(plain);
    if (wd) start = nextWeekday(today, WEEKDAYS.indexOf(wd[1]), true);
  }
  // Un mois seul : « en janvier », « début mai », « fin août 2027 ». Le départ
  // se pose au début (au 15 pour « mi », au 22 pour « fin ») ; un « week-end »
  // dans ce mois tombe sur son premier samedi. Ce mois-ci : à partir d'aujourd'hui.
  if (!range && !single && !slash) {
    const monthOnly = new RegExp(
      `\\b(?:(debut|mi|fin)[\\s-]+(?:de\\s+|d')?|en\\s+|in\\s+|au mois d[e']\\s*|courant\\s+)${MONTH_RE}(?:\\s+(\\d{4}))?`
    ).exec(plain);
    const month = monthOnly ? monthOf(monthOnly[2]) : null;
    if (monthOnly && month) {
      const day = monthOnly[1] === 'mi' ? 15 : monthOnly[1] === 'fin' ? 22 : 1;
      const year = monthOnly[3] ? Number(monthOnly[3]) : null;
      const thisMonth = !year && Number(today.slice(5, 7)) === month && Number(today.slice(8, 10)) >= day;
      let base = thisMonth ? today : resolveDayMonth(today, day, month, year);
      if (base && /\bweek-?end\b/.test(plain)) {
        const sat = nextWeekday(base, 6, false);
        if (Number(sat.slice(5, 7)) === month) base = sat;
      }
      if (base) {
        start = base;
        end = null;
      }
    }
  }
  if (start) out.push({ type: 'set_dates', start, end });

  /* Durée */
  const dur =
    new RegExp(`\\b${NUM}\\s*(jours?|j|nuits?|semaines?|days?|nights?|weeks?)\\b`).exec(plain) ??
    (/\bdemi-journee\b/.test(plain) ? null : /\b(une|la|1)\s+journee\b/.exec(plain));
  const hoursMatch =
    /(?<!(?:\ba|\bvers|depart|depart a|des)\s)\b(\d{1,2})\s*h(?:eures?)?\s*(\d{2})?\b(?!\s*du matin)/.exec(
      plain
    );
  const hoursWord = new RegExp(`\\b${NUM}\\s+heures?(\\s+et\\s+demie)?\\b`).exec(plain);
  if (dur && dur[2]) {
    const n = toNumber(dur[1]);
    const unit = dur[2];
    if (n != null && n > 0) {
      const days = /^(nuit|night)/.test(unit) ? n + 1 : /^(semaine|week)/.test(unit) ? n * 7 : n;
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
  } else if (/\bweek-?end\b/.test(plain)) {
    out.push({ type: 'set_duration', days: 2, hours: null });
  }

  /* Personnes */
  const counted = new RegExp(
    `\\b${NUM}\\s+(personnes?|pers\\b|randonneurs?|adultes?|amis|copains|participants)`
  ).exec(plain);
  const after = new RegExp(
    `\\b(?:a|pour|on est|on sera|nous sommes|nous serons)\\s+${NUM}\\b(?!\\s*(?:jours?|j\\b|h\\b|heures?|nuits?|km|kilos?|kg|g\\b|m\\b|metres?|€|euros?|eur\\b|semaines?|min|%|ans|personnes?))`
  ).exec(plain);
  const people = counted ?? (after && !/^(un|une)$/.test(after[1]) ? after : null);
  if (people) {
    const n = toNumber(people[1]);
    if (n != null && Number.isInteger(n) && n >= 1) out.push({ type: 'set_party_size', count: n });
  } else if (/\b(en solo|seul|seule)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 1 });
  } else if (/\b(en couple|en duo)\b/.test(plain)) {
    out.push({ type: 'set_party_size', count: 2 });
  }

  /* Enveloppe */
  const money =
    /(\d[\d\s\u202f\u00a0]*(?:[.,]\d+)?)\s*(?:€|euros?\b|eur\b)/.exec(plain) ??
    /\bbudget\s*(?:de|:)?\s*(\d[\d\s\u202f\u00a0]*)/.exec(plain);
  if (money) {
    const amount = Number(money[1].replace(/[\s\u202f\u00a0]/g, '').replace(',', '.'));
    if (Number.isFinite(amount) && amount > 0) out.push({ type: 'set_budget', amount });
  }

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
  if (/\b(bivouac|bivouaquer|bivouaque|sous (?:la )?tente|camper)\b/.test(plain))
    nights.add('bivouac');
  if (/\brefuges?\b/.test(plain)) nights.add('refuge');
  if (/\b(gites?|hotels?|chambres? d'hotes?|auberges?|hebergements?)\b/.test(plain))
    nights.add('hebergement');
  if (nights.size === 1) out.push({ type: 'set_nights', nights: [...nights][0] });
  else if (nights.size > 1) out.push({ type: 'set_nights', nights: 'mixte' });

  /* Activité (seulement quand elle est nommée) */
  // Du plus précis au plus large : « ski de rando » est du ski, pas une rando.
  const activity: Array<[RegExp, CompasActivity]> = [
    [/\b(ski|skis|skier|freeride|splitboard|raquettes?)\b/, 'ski'],
    [/\b(alpinisme|alpi|cordee|glacier|course d'arete|4000)\b/, 'mountaineering'],
    [/\b(escalade|grimpe|grimper|bloc|via ferrata|falaise)\b/, 'climbing'],
    [/\b(velo|velos|bikepacking|cyclo|cyclotourisme|vtt|gravel)\b/, 'cycling'],
    [/\b(kayak|canoe|canoes|paddle|packraft|rafting|voile|voilier|plongee|snorkeling|surf)\b/, 'water'],
    [/\b(van|vanlife|camping[- ]car|fourgon|fourgonnette)\b/, 'vanlife'],
    [/\b(city ?trip|citytrip)\b/, 'citytrip'],
    [/\b(plage|plages|farniente|bord de mer|baignade)\b/, 'beach'],
    [/\b(rando|randos|randonnee|randonnees)\b/, 'hiking'],
    [/\btreks?\b|\btrekking\b/, 'trekking'],
    [/\broad ?trip\b/, 'roadtrip'],
    [/\bbushcraft\b/, 'bushcraft'],
    [/\b(culturel|culturelle|musees?)\b/, 'cultural'],
  ];
  const act = activity.find(([re]) => re.test(plain));
  if (act) out.push({ type: 'set_activity', activity: act[1] });

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
  for (const m of plain.matchAll(/(?:^|[\s,(])(?:au|aux|en|a|dans le|dans la|dans les)\s+/g)) {
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!/^\p{Lu}/u.test(original)) continue;
    const place = clean(
      upToBreak(original).split(
        /\s(?:pour|avec|du|le|la|les|en|a|à|à partir|pendant|durant|sur|et|un|une|cette|ce|tout|toute|week-?end|début|debut|mi|fin|janvier|février|fevrier|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s|$)/i
      )[0],
      50
    );
    if (place.length >= 2 && !monthOf(plainOf(place)) && !WEEKDAYS.includes(plainOf(place))) {
      out.push({ type: 'set_destination', place });
      // « en Patagonie, Torres del Paine » : le lieu précis qui suit devient une
      // envie, transmise au spécialiste de l'itinéraire (sans resserrer la
      // destination : « Japon, Tokyo et Kyoto » reste un voyage au Japon).
      const after = /^\s*,\s*(\p{Lu}[^,.;!?\d]*)/u.exec(original.slice(original.indexOf(place) + place.length));
      const precise = after ? clean(after[1].split(/\s(?:et|pour|avec|en|du|pendant|durant|à|a)\s/i)[0], 40) : '';
      if (precise.length >= 3 && !monthOf(plainOf(precise)) && !WEEKDAYS.includes(plainOf(precise)))
        out.push({ type: 'wish', label: precise });
      break;
    }
  }

  /* Lieu → recherche de parcours (nom propre seulement) */
  const place =
    /\b(?:dans (?:le |la |les |l')|vers |autour (?:de |d')|du cote (?:de |d')|pres (?:de |d')|a cote (?:de |d'))/g;
  for (const m of plain.matchAll(place)) {
    const at = (m.index ?? 0) + m[0].length;
    const original = src.slice(at, at + 60);
    if (!/^\p{Lu}/u.test(original)) continue;
    const query = clean(upToBreak(original), 50);
    if (query.length >= 3 && !monthOf(plainOf(query))) {
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
        (d === 2 && /week-?end/.test(plain)) ||
        (d === 1 && /journee/.test(plain));
      return ok ? null : 'Durée absente de ta phrase';
    }
    case 'set_party_size':
      return numberInText(text, action.count) ||
        (action.count === 1 && /\b(seul|seule|solo)\b/.test(plain)) ||
        (action.count === 2 && /\b(couple|duo)\b/.test(plain))
        ? null
        : 'Nombre absent de ta phrase';
    case 'set_budget':
      return numberInText(text, action.amount) ? null : 'Montant absent de ta phrase';
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
    case 'set_nights':
      return /\b(bivouac|bivouaquer|tente|camping|camper|refuges?|hotels?|gites?|chambres?|auberges?|hebergements?|airbnb|tent|hut|hostel)/.test(plain)
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
      return `Enveloppe : ${formatMoney(action.amount, currency)}`;
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
  }
}

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
  for (const [list, source] of [
    [ai, 'ia'],
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
            if (a.amount < ctx.engaged)
              reason = `Sous les ${formatMoney(ctx.engaged, ctx.currency)} déjà engagés`;
            break;
          case 'avoid':
            if (avoid.has(plainOf(a.label))) reason = 'Déjà noté';
            else if (avoid.size >= 8) reason = 'Déjà 8 choses à éviter';
            break;
          case 'wish':
            if (wishes.has(plainOf(a.label))) reason = 'Déjà noté';
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
  const duration = actions.find((a) => a.type === 'set_duration') as
    Extract<CompasIntentAction, { type: 'set_duration' }> | undefined;
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
      default:
        break;
    }
  }
  if (prefsChanged) ops.push({ op: 'prefs', preferences: prefs });
  return ops;
}
