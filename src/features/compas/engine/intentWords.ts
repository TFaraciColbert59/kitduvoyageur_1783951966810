import { addDaysIso } from './format';

/**
 * Compas — mots de la phrase lus sans IA (plan 4.10) : nombres en lettres,
 * montants et devises, jours fériés. Fonctions pures, appelées sur le texte
 * déjà « à plat » du lecteur de règles (minuscules, sans accents).
 */

/* ---------- Nombres en lettres ---------- */

const UNITS: Record<string, number> = {
  zero: 0,
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
};
const TENS: Record<string, number> = { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
const BIG: Record<string, number> = { cent: 100, cents: 100, mille: 1000 };
const VALUE: Record<string, number> = { ...UNITS, ...TENS, ...BIG };

/** Mots que le lecteur de règles comprend déjà seuls (« trois jours ») : laissés tels quels. */
const SIMPLE = new Set([...Object.keys(UNITS), 'vingt', 'trente']);

/** « une dizaine de jours » : un ordre de grandeur dit, lu comme tel. */
const APPROX: Record<string, number> = {
  dizaine: 10,
  douzaine: 12,
  quinzaine: 15,
  vingtaine: 20,
  trentaine: 30,
  quarantaine: 40,
  cinquantaine: 50,
  centaine: 100,
};

const WORD_RE = Object.keys(VALUE)
  .sort((a, b) => b.length - a.length)
  .join('|');
const RUN = new RegExp(`\\b(?:${WORD_RE})(?:(?:-et-|-| et | )(?:${WORD_RE}))*\\b`, 'g');

/** Remplace `from..to` par `value`, complété d'espaces : les positions ne bougent pas. */
function pad(text: string, from: number, to: number, value: number): string {
  const digits = String(value);
  const width = to - from;
  if (digits.length > width) return text;
  return text.slice(0, from) + digits + ' '.repeat(width - digits.length) + text.slice(to);
}

interface Group {
  from: number;
  to: number;
  value: number;
  words: string[];
}

/** Découpe une suite de mots-nombres en nombres (« deux trois » = 2 et 3, « vingt-cinq » = 25). */
function groups(run: string, offset: number): Group[] {
  const out: Group[] = [];
  const re = /(-et-|-| et | )?([a-z]+)/g;
  let cur: Group | null = null;
  let total = 0;
  let part = 0;
  const close = () => {
    if (cur) out.push({ ...cur, value: total + part });
    cur = null;
    total = 0;
    part = 0;
  };
  for (const m of run.matchAll(re)) {
    const sep = m[1] ?? '';
    const word = m[2];
    const v = VALUE[word];
    const at = offset + (m.index ?? 0) + sep.length;
    const end = at + word.length;
    const low = part % 100;
    const isEt = sep.includes('et');
    let fits = false;
    if (cur) {
      if (word === 'mille') fits = total === 0;
      else if (word === 'cent' || word === 'cents') fits = part < 10 && total % 1000 === 0;
      else if ((word === 'vingt' || word === 'vingts') && low === 4) fits = true; // quatre-vingt(s)
      else if (TENS[word]) fits = low === 0 && (part >= 100 || total > 0);
      else if (v >= 1 && v <= 16)
        fits = isEt
          ? [20, 30, 40, 50, 60].includes(low) && (v === 1 || v === 11)
          : low === 0
            ? part >= 100 || total > 0
            : ([20, 30, 40, 50].includes(low) && v <= 9) ||
              ((low === 60 || low === 80) && v <= 16) ||
              ([10, 70, 90].includes(low) && v >= 7 && v <= 9);
    }
    if (!fits) {
      close();
      cur = { from: at, to: end, value: 0, words: [] };
    }
    const g = cur as unknown as Group;
    g.to = end;
    g.words.push(word);
    if (word === 'mille') {
      total += (part || 1) * 1000;
      part = 0;
    } else if (word === 'cent' || word === 'cents') {
      part = (part || 1) * 100;
    } else if ((word === 'vingt' || word === 'vingts') && low === 4 && g.words.length > 1) {
      part += 76; // 4 → 80
    } else {
      part += v;
    }
  }
  close();
  return out;
}

/**
 * Écrit en chiffres les nombres composés ou grands dits en lettres
 * (« dix-huit » → 18, « trois cents » → 300, « une dizaine de » → 10), sans
 * déplacer le reste du texte : le lecteur de règles relit ses positions dans
 * la phrase d'origine. Les nombres simples (« trois », « vingt ») restent en
 * lettres, comme « un »/« une », qui sont aussi des articles.
 */
export function spellNumbers(plain: string): string {
  let text = plain.replace(
    /\b(?:une |d'une )(dizaine|douzaine|quinzaine|vingtaine|trentaine|quarantaine|cinquantaine|centaine)(?: de | d'|\b)/g,
    (whole: string, word: string) =>
      // « partir une quinzaine » : quinze jours, pas quinze personnes.
      (word === 'quinzaine' && !/ d(?:e |')$/.test(whole) ? '15 jours' : String(APPROX[word])).padEnd(whole.length, ' ')
  );
  for (const m of [...text.matchAll(RUN)]) {
    for (const g of groups(m[0], m.index ?? 0)) {
      if (g.words.length === 1 && SIMPLE.has(g.words[0])) continue;
      text = pad(text, g.from, g.to, g.value);
    }
  }
  return text;
}

/* ---------- Montants et devises ---------- */

/** Symboles et mots de devise → code ISO 4217. */
const CURRENCY_WORDS: Array<[RegExp, string]> = [
  [/^(?:dollars? canadiens?|cad|ca\$|c\$)$/, 'CAD'],
  [/^(?:dollars? australiens?|aud|a\$|au\$)$/, 'AUD'],
  [/^(?:dollars? neo-zelandais|nzd|nz\$)$/, 'NZD'],
  [/^(?:\$|us\$|usd|dollars?(?: us| americains?)?)$/, 'USD'],
  [/^(?:€|eur|euros?|balles)$/, 'EUR'],
  [/^(?:£|gbp|livres?(?: sterling)?)$/, 'GBP'],
  [/^(?:chf|francs? suisses)$/, 'CHF'],
  [/^(?:¥|jpy|yens?)$/, 'JPY'],
  [/^(?:cny|rmb|yuans?)$/, 'CNY'],
];
const CURRENCY_TOKEN =
  "dollars? canadiens?|dollars? australiens?|dollars? neo-zelandais|dollars? us|dollars? americains?|dollars?|livres? sterling|livres?|francs? suisses|euros?|balles|yens?|yuans?|rmb|ca\\$|c\\$|au\\$|a\\$|nz\\$|us\\$|[a-z]{3}|€|\\$|£|¥";
/** Montant : « 1 500 », « 1,500 », « 1.500,50 », « 2,5 » ; « k » = mille. */
const AMOUNT = '(\\d{1,3}(?:[\\s\\u202f\\u00a0.,]\\d{3})+(?!\\d)|\\d+)(?:[.,](\\d{1,2}))?(?!\\d)\\s*(k\\b)?';

let isoCodes: Set<string> | null = null;
/** Codes ISO 4217 connus du moteur `Intl` (repli : 14 devises courantes s'il ne les liste pas). */
export function isoCurrencyCodes(): ReadonlySet<string> {
  if (!isoCodes) {
    try {
      isoCodes = new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('currency'));
    } catch {
      isoCodes = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD', 'NZD', 'NOK', 'SEK', 'DKK', 'ISK', 'MAD', 'THB']);
    }
  }
  return isoCodes;
}
export function knownIsoCode(code: string): boolean {
  return isoCurrencyCodes().has(code);
}

/** Code ISO d'un symbole ou d'un mot de devise ; `src` = le même passage tel qu'écrit. */
function currencyOf(token: string, src: string): string | null {
  const t = token.trim();
  const known = CURRENCY_WORDS.find(([re]) => re.test(t))?.[1];
  if (known) return known;
  // Un code ISO n'est pris qu'écrit en capitales (« 50 000 ISK ») : « 10 ans » n'est pas une devise.
  if (/^[a-z]{3}$/.test(t) && /^[A-Z]{3}$/.test(src.trim()) && knownIsoCode(src.trim())) return src.trim();
  return null;
}

function amountOf(int: string, dec: string | undefined, k: string | undefined): number | null {
  const n = Number(`${int.replace(/[\s  .,]/g, '')}${dec ? `.${dec}` : ''}`);
  if (!Number.isFinite(n) || n <= 0) return null;
  return k ? Math.round(n * 1000) : n;
}

export interface SaidMoney {
  amount: number;
  /** Code ISO dit dans la phrase ; null : « budget 800 » sans devise. */
  currency: string | null;
  index: number;
}

/**
 * Le budget dit dans la phrase : « 2000 $ », « 1,500 € », « 3k€ », « £800 »,
 * « 50 000 ISK », « budget de 1 500 ». `plain` = phrase à plat, `src` = même
 * phrase telle qu'écrite (mêmes positions), pour les codes en capitales.
 */
export function readMoney(plain: string, src: string): SaidMoney | null {
  const after = new RegExp(`(?<![\\d.,])${AMOUNT}\\s*(${CURRENCY_TOKEN})(?![a-z])`, 'g');
  for (const m of plain.matchAll(after)) {
    const at = (m.index ?? 0) + m[0].length - m[4].length;
    const currency = currencyOf(m[4], src.slice(at, at + m[4].length));
    if (!currency) continue;
    const amount = amountOf(m[1], m[2], m[3]);
    if (amount != null) return { amount, currency, index: m.index ?? 0 };
  }
  const before = new RegExp(`(€|\\$|£|¥|us\\$|ca\\$|c\\$|a\\$|au\\$|nz\\$|chf|usd|gbp|eur)\\s*${AMOUNT}`, 'g');
  for (const m of plain.matchAll(before)) {
    const currency = currencyOf(m[1], m[1]);
    const amount = amountOf(m[2], m[3], m[4]);
    if (currency && amount != null) return { amount, currency, index: m.index ?? 0 };
  }
  const bare = new RegExp(
    `\\bbudget\\s*(?:de|d'environ|d'|:|max(?:imum)?|maxi|environ|autour de|total)?\\s*${AMOUNT}(?!\\s*(?:jours?|j\\b|nuits?|semaines?|km|kg|personnes?|pers\\b|%))`
  ).exec(plain);
  if (bare) {
    const amount = amountOf(bare[1], bare[2], bare[3]);
    if (amount != null) return { amount, currency: null, index: bare.index };
  }
  return null;
}

/* ---------- Jours fériés ---------- */

/** Dimanche de Pâques (calendrier grégorien, algorithme anonyme). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const HOLIDAYS: Array<[RegExp, (year: number) => string]> = [
  [/\blundi de paques\b/, (y) => addDaysIso(easterSunday(y), 1)],
  [/\bpaques\b/, (y) => easterSunday(y)],
  [/\bascension\b/, (y) => addDaysIso(easterSunday(y), 39)],
  [/\bpentecote\b/, (y) => addDaysIso(easterSunday(y), 49)],
  [/\b(?:nouvel an|jour de l'an|reveillon|saint[- ]sylvestre)\b/, (y) => `${y}-12-31`],
  [/\bnoel\b/, (y) => `${y}-12-25`],
  [/\btoussaint\b/, (y) => `${y}-11-01`],
  [/\bassomption\b/, (y) => `${y}-08-15`],
];

/** Noms de fêtes : jamais une destination (« à Noël en Laponie »). */
export const HOLIDAY_WORD =
  /^(?:noel|paques|lundi de paques|ascension|pentecote|toussaint|assomption|nouvel an|reveillon|saint[- ]sylvestre|jour de l'an)$/;
export const HOLIDAY_RE =
  /\b(?:noel|paques|ascension|pentecote|toussaint|assomption|nouvel an|jour de l'an|reveillon|saint[- ]sylvestre)\b/;

/**
 * Jour d'une fête dite (« à Noël », « pour Pâques », « Toussaint 2027 »), le
 * prochain à partir d'aujourd'hui. Les « vacances de … » ne donnent pas de
 * jour : elles durent, et leurs dates changent selon les zones.
 */
export function holidayDate(plain: string, today: string): string | null {
  for (const [re, at] of HOLIDAYS) {
    const m = re.exec(plain);
    if (!m) continue;
    if (/\bvacances (?:de |d')(?:la |l')?\s*$/.test(plain.slice(0, m.index))) return null;
    const said = /^\s*(20\d{2})\b/.exec(plain.slice(m.index + m[0].length));
    if (said) return at(Number(said[1]));
    const year = Number(today.slice(0, 4));
    const day = at(year);
    return day >= today ? day : at(year + 1);
  }
  return null;
}
