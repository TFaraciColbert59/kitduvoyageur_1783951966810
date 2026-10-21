/**
 * Compas — « Dis-le » en espagnol, allemand et italien (PLAN-100 6.2), lu sans IA.
 *
 * Le lecteur de règles (`parseIntentRules`) sait lire le français et l'anglais. Une phrase
 * espagnole, allemande ou italienne est d'abord RÉÉCRITE mot à mot en anglais simple
 * (« pivot ») par un lexique fermé et des règles ordonnées (`intentEs.ts`, `intentDe.ts`,
 * `intentIt.ts`), puis lue par les règles anglaises. Les noms propres (lieux) passent tels
 * qu'écrits : « Sierra de Guadarrama », « Val di Fassa », « La Rioja » ne sont pas traduits.
 * Les fêtes locales (« Semana Santa », « Pfingsten », « Ferragosto ») deviennent une date
 * exacte, calculée ici ; ce qui reste vague (une saison, « un puente », « mit den Kindern »)
 * n'est pas changé en chiffre : non compris, jamais deviné.
 *
 * Fonctions pures et déterministes ; aucune IA, aucun réseau.
 */

import { addDaysIso } from './format';
import { easterSunday } from './intentWords';

export type PivotLang = 'es' | 'de' | 'it';

/** Groupes de la correspondance, tels qu'écrits dans la phrase (casse et accents gardés). */
type Groups = Array<string | undefined>;

export interface PivotRule {
  /** Motif sur le texte replié (minuscules, sans accents) ; `\b` = frontière de mot Unicode. */
  re: RegExp;
  /** Remplacement : `$1`… reprennent le texte tel qu'écrit. */
  to: string | ((g: Groups) => string);
  /** La règle ne s'applique que si ce test passe (g = groupes tels qu'écrits). */
  when?: (g: Groups, before: string, after: string) => boolean;
}

export interface PivotHoliday {
  re: RegExp;
  /** Jour de la fête pour une année donnée (AAAA-MM-JJ). */
  at: (year: number) => string;
}

export interface PivotLexicon {
  lang: PivotLang;
  /** Mots propres à la langue (repliés) : 1 point ; `strong` : 2 points (unités de temps, etc.). */
  markers: readonly string[];
  strong: readonly string[];
  /** Nombres en lettres → chiffres (repliés), du plus long au plus court déjà géré par `numberRules`. */
  numbers: Record<string, number>;
  holidays: readonly PivotHoliday[];
  /** Règles appliquées avant les nombres (expressions figées qui contiennent un nombre en lettres). */
  early: readonly PivotRule[];
  /** Règles appliquées après les nombres et les fêtes, dans l'ordre. */
  rules: readonly PivotRule[];
}

/* ---------- Texte replié, aux mêmes positions ---------- */

/** Minuscules, accents retirés, apostrophes droites : un caractère pour un caractère. */
export function fold(text: string): string {
  let out = '';
  for (const c of text) {
    if (c === '’' || c === '`' || c === 'ʼ') {
      out += "'";
      continue;
    }
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const one = base.length === c.length ? base : c;
    const low = one.toLowerCase();
    out += low.length === one.length ? low : one;
  }
  return out;
}

const WORD_EDGE = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))';

/** Compile un motif : `\b` devient une frontière de mot Unicode (« días », « über »). */
export function rx(source: string): RegExp {
  return new RegExp(source.replace(/\\b/g, WORD_EDGE), 'gdu');
}

/** Raccourci : règle simple. */
export function r(source: string, to: PivotRule['to'], when?: PivotRule['when']): PivotRule {
  return { re: rx(source), to, ...(when ? { when } : {}) };
}

export const isCap = (s: string | undefined): boolean => !!s && /^\p{Lu}/u.test(s);

/** Dernier mot avant la position (tel qu'écrit), ou ''. */
export function wordBefore(before: string): string {
  return /([\p{L}'’-]+)\s*$/u.exec(before)?.[1] ?? '';
}
/** Premier mot après la position (tel qu'écrit), ou ''. */
export function wordAfter(after: string): string {
  return /^\s*([\p{L}\p{N}'’-]+)/u.exec(after)?.[1] ?? '';
}

/** Mot écrit avec majuscule au milieu de la phrase (pas en tête, pas après un point) : un nom propre. */
export function properMid(g0: string | undefined, before: string): boolean {
  return isCap(g0) && /\S/.test(before) && !/[.!?:]\s*$/.test(before);
}

/** Entre deux mots à majuscule (« Sierra de Guadarrama », « Val di Fassa ») : fait partie du nom. */
export function insideName(before: string, after: string): boolean {
  return isCap(wordBefore(before)) && isCap(wordAfter(after));
}

/**
 * Ce qu'une règle a déjà écrit en anglais est protégé (entre OPEN et CLOSE) : une règle suivante
 * ne le relit pas (« as a couple » ne redevient pas « as to couple » par la règle « a » → « to »).
 */
const OPEN = '\u0001';
const CLOSE = '\u0002';
const bare = (s: string) => s.replace(/[\u0001\u0002]/g, '');

function applyRule(text: string, rule: PivotRule): string {
  const folded = fold(text);
  let out = '';
  let last = 0;
  let depth = 0;
  let scanned = 0;
  rule.re.lastIndex = 0;
  for (const m of folded.matchAll(rule.re)) {
    const idx = (m as RegExpMatchArray & { indices: Array<[number, number] | undefined> }).indices;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    for (; scanned < start; scanned += 1) {
      if (text[scanned] === OPEN) depth += 1;
      else if (text[scanned] === CLOSE) depth -= 1;
    }
    if (depth > 0 || m[0].includes(OPEN) || m[0].includes(CLOSE)) continue;
    const g: Groups = idx.map((span) => (span ? text.slice(span[0], span[1]) : undefined));
    if (rule.when && !rule.when(g, bare(text.slice(0, start)), bare(text.slice(end)))) continue;
    const rep =
      typeof rule.to === 'function' ? rule.to(g) : rule.to.replace(/\$(\d)/g, (_, n: string) => g[Number(n)] ?? '');
    out += text.slice(last, start) + (/\p{L}/u.test(rep) ? OPEN + rep + CLOSE : rep);
    last = end;
  }
  return last === 0 ? text : out + text.slice(last);
}

/** Mots qui relient les parties d'un nom propre (« Sierra de Guadarrama », « Val di Fassa »). */
const NAME_LINK = /^(?:de|del|la|las|los|el|di|della|delle|dei|degli|dello|da|d|y|e|lo|le|sul|al)$/;

/**
 * Un mot resté dans la langue, en minuscule, juste après un nom propre (« los Alpes suizos » ;
 * pas « Picos de Europa ») : le nom s'arrête avant, une virgule le dit aux règles anglaises.
 */
function endNames(text: string, lang: PivotLang): string {
  // Après un nom propre : un mot traduit (protégé, « late », « of ») ou, sauf en allemand où les noms
  // communs ont aussi la majuscule, un mot resté dans la langue en minuscules.
  return text.replace(
    /(?<=[\s\u0001\u0002])(\p{Lu}[\p{L}'-]*)(\s+)(?=(\u0001?)(\p{Ll}\p{L}*))/gu,
    (whole, name: string, sp: string, open: string, next: string) =>
      (!open && (lang === 'de' || NAME_LINK.test(fold(next)))) ? whole : `${name},${sp}`
  );
}

export function applyRules(text: string, rules: readonly PivotRule[]): string {
  return rules.reduce(applyRule, text);
}

/* ---------- Dates communes ---------- */

const EN_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** « 10/12 », « 10.12. », « 10.12.2026 » : toujours jour/mois en espagnol, allemand et italien. */
export const NUMERIC_DATES: readonly PivotRule[] = [
  r('(?<![\\d/.,])(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{4}|\\d{2}))?(?![\\d/])', (g) => dayMonth(g)),
  r('(?<![\\d/.,])(\\d{1,2})\\.(\\d{1,2})\\.(?:(\\d{4}|\\d{2})(?!\\d))?', (g) => dayMonth(g)),
];

function dayMonth(g: Groups): string {
  const day = Number(g[1]);
  const month = Number(g[2]);
  if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12)) return g[0] ?? '';
  const year = g[3] ? ` ${g[3].length === 2 ? `20${g[3]}` : g[3]}` : '';
  return `${day} ${EN_MONTHS[month - 1]}${year}`;
}

/** Fêtes → date ISO, la prochaine à partir d'aujourd'hui (ou l'année dite : « Ostern 2027 »). */
function holidayRules(holidays: readonly PivotHoliday[], today: string): PivotRule[] {
  return holidays.map((h) => ({
    re: rx(`${h.re.source}(?:\\s+(20\\d{2}))?`),
    to: (g: Groups) => {
      const said = g[g.length - 1];
      if (said && /^20\d{2}$/.test(said)) return h.at(Number(said));
      const year = Number(today.slice(0, 4));
      return h.at(year) >= today ? h.at(year) : h.at(year + 1);
    },
  }));
}

/** Fête à date mobile : décalage (jours) depuis le dimanche de Pâques. */
export const fromEaster =
  (days: number) =>
  (year: number): string =>
    addDaysIso(easterSunday(year), days);
/** Fête à date fixe. */
export const fixed =
  (mmdd: string) =>
  (year: number): string =>
    `${year}-${mmdd}`;

/** Nombres en lettres → chiffres ; un nombre suivi d'un nom propre (« Cinque Terre », « Dos Hermanas ») reste. */
function numberRule(numbers: Record<string, number>, lang: PivotLang): PivotRule {
  const words = Object.keys(numbers).sort((a, b) => b.length - a.length);
  return r(`\\b(${words.join('|')})\\b`, (g) => String(numbers[fold(g[1] ?? '')] ?? g[1]), (g, before, after) => {
    // En allemand tous les noms ont la majuscule (« Drei Wochen ») : le test ne vaut pas.
    if (lang === 'de') return true;
    return !(isCap(g[1]) && isCap(wordAfter(after)));
  });
}

/* ---------- Détection de langue ---------- */

/** Mots-outils et mots français qui n'existent dans aucune des trois langues. */
const FR_ONLY = new Set([
  'avec', 'jours', 'jour', 'semaine', 'semaines', 'nuits', 'nuit', 'nous', 'et', 'pour', 'dans', 'depuis', 'les',
  'au', 'aux', 'je', 'mon', 'une', 'sur', 'chez', 'vers', 'prochain', 'prochaine', 'demain',
  'personnes', 'voyage', 'rando', 'randonnee', 'sommes', 'pars', 'mois', 'cette', 'ou', 'sans', 'femme', 'enfants',
  'amis', 'vacances', 'samedi', 'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'janvier', 'fevrier',
  'avril', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'quelques', 'deux', 'trois',
  'quatre', 'cinq', 'est', "j'", 'week', 'heures', 'velo', 'escalade', 'aussi', 'ete', 'hiver',
  'avons', 'veux', 'voudrais', 'on', 'part', 'puis', 'mais', 'sa', 'votre', 'pas', 'qu', 'jamais', 'rien', 'tout',
  'tous', 'faut', 'peut', 'sont', 'ont', 'reste', 'leur', 'ce', 'cet', 'ces', 'qui', 'quoi', 'elle', 'ils', 'encore',
  'toujours', 'deja', 'avant', 'apres', 'aussi', 'ici',
  // Portugais (« do », « ao », « os », « não ») : lu comme avant, jamais comme de l'espagnol ou de l'italien.
  'do', 'ao', 'os', 'nao', 'em', 'uma', 'voce',
]);

/** Mots anglais qui n'existent pas dans les trois langues (« in », « camping », « weekend » y existent). */
const EN_ONLY = new Set([
  'the', 'with', 'and', 'of', 'my', 'our', 'we', "we're", "i'm", "i'd", 'days', 'day', 'weeks', 'nights', 'night',
  'from', 'to', 'for', 'near', 'around', 'next', 'this', 'tomorrow', 'today', 'leaving', 'starting', 'going',
  'people', 'kids', 'children', 'wife', 'husband', 'alone', 'want', 'like', 'month', 'months', 'under', 'about',
  'friends', 'adults', 'holiday', 'vacation', 'trip', 'week', 'us', 'just', 'by', 'myself', 'at', 'on',
  'through', 'across', 'visiting', 'looking', 'planning',
]);

interface Token {
  /** Mot replié. */
  w: string;
  /** Écrit avec une majuscule ailleurs qu'en tête de phrase (un nom propre en espagnol ou en italien). */
  name: boolean;
  /** Tout en capitales (« DEN », « IPMA ») : un sigle, jamais un mot de la langue. */
  acronym: boolean;
  /** Le mot tel qu'écrit. */
  raw: string;
}

function tokens(text: string): Token[] {
  // Les mots qui relient un nom propre (« Riva del Garda », « Sierra de Gredos ») ne disent pas la langue.
  const named = text
    .normalize('NFC')
    .replace(/[’`ʼ]/g, "'")
    .replace(/\bon the road\b/gi, ' ')
    .replace(/(\p{Lu}[\p{L}'-]*)\s+(?:de|del|de la|de los|di|della|delle|dei|degli|da|von|der|y|e|und)\s+(?=\p{Lu})/gu, '$1 ');
  const out: Token[] = [];
  for (const m of named.matchAll(/[\p{L}']+/gu)) {
    const raw = m[0];
    const at = m.index ?? 0;
    const first = !/\p{L}/u.test(named.slice(0, at)) || /[.!?:]\s*$/.test(named.slice(0, at));
    const parts = /^[dlj]'/i.test(raw) ? [raw.slice(0, 2), raw.slice(2)] : [raw];
    for (const p of parts.filter(Boolean))
      out.push({
        w: fold(p),
        raw: p,
        name: !first && /^\p{Lu}/u.test(p),
        acronym: p.length >= 2 && p === p.toUpperCase() && /\p{Lu}/u.test(p),
      });
  }
  return out;
}

const FOREIGN_MARKS: Record<PivotLang, RegExp> = {
  // Ni « à », ni « è », ni « ç », ni « ê » en espagnol ; ni « ñ », ni « á », ni « ç » en italien ; en allemand,
  // seuls « ä ö ü ß ».
  es: /[àèìòùâêîôûçœëïäöß]/,
  it: /[áíúñâêîôûçœëïäöüß]/,
  de: /[àâçéèêëîïôûùœáíóúñìò]/,
};

export interface LanguageScores {
  scores: Record<PivotLang, number>;
  french: boolean;
  english: boolean;
  /** Une langue exclue par un mot en minuscules qui porte un signe qu'elle n'a pas (« à » en espagnol). */
  excluded: Set<PivotLang>;
}

export function languageScores(text: string, lexicons: readonly PivotLexicon[]): LanguageScores {
  const scores = { es: 0, de: 0, it: 0 } as Record<PivotLang, number>;
  const excluded = new Set<PivotLang>();
  const sets = lexicons.map((l) => [l.lang, new Set(l.markers), new Set(l.strong)] as const);
  let french = false;
  let english = false;
  for (const t of tokens(text)) {
    if (t.acronym) continue;
    if (FR_ONLY.has(t.w)) french = true;
    if (EN_ONLY.has(t.w)) english = true;
    const lower = /^\p{Ll}/u.test(t.raw);
    for (const [lang, markers, strong] of sets) {
      if (lower && FOREIGN_MARKS[lang].test(t.raw)) excluded.add(lang);
      // Un nom propre (« Rifugio Due », « Dos Hermanas ») ne compte pas ; en allemand tous les noms ont la majuscule.
      if (t.name && lang !== 'de') continue;
      if (strong.has(t.w)) scores[lang] += 2;
      else if (markers.has(t.w)) scores[lang] += 1;
    }
  }
  return { scores, french, english, excluded };
}

/**
 * La phrase est-elle en espagnol, en allemand ou en italien ? Une langue l'emporte quand ses
 * mots propres pèsent au moins 2 et plus que ceux des deux autres (à égalité, la langue de
 * l'interface), sans aucun mot-outil seulement français ou seulement anglais, ni mot en
 * minuscules accentué d'une façon que la langue ne connaît pas. Sinon null : la phrase est lue
 * comme avant (français, ou anglais sans équivoque).
 */
export function detectPivot(
  text: string,
  lexicons: readonly PivotLexicon[],
  locale?: string
): PivotLang | null {
  const { scores, french, english, excluded } = languageScores(text, lexicons);
  if (french || english) return null;
  const ranked = (Object.keys(scores) as PivotLang[])
    .filter((l) => !excluded.has(l))
    .sort((a, b) => scores[b] - scores[a] || (b === locale ? 1 : 0) - (a === locale ? 1 : 0));
  const best = ranked[0];
  if (!best || scores[best] < 2) return null;
  if (ranked[1] && scores[ranked[1]] === scores[best] && best !== locale) return null;
  return best;
}

/**
 * Réécrit la phrase en anglais simple pour les règles anglaises. Ordre : expressions figées,
 * fêtes, dates chiffrées, nombres en lettres, puis les règles de la langue.
 */
export function pivotText(text: string, lex: PivotLexicon, today: string): string {
  let t = text.normalize('NFC').replace(/[’`ʼ]/g, "'");
  t = applyRules(t, lex.early);
  t = applyRules(t, holidayRules(lex.holidays, today));
  t = applyRules(t, NUMERIC_DATES);
  t = applyRules(t, [numberRule(lex.numbers, lex.lang)]);
  t = applyRules(t, lex.rules);
  t = endNames(t, lex.lang);
  return bare(t).replace(/[ \t]+/g, ' ').replace(/\s+([,.;!?])/g, '$1').trim();
}

/** Mois de la langue → mois anglais (motif replié ⇒ nom anglais). */
export function monthRules(months: Record<string, number>): PivotRule {
  const keys = Object.keys(months).sort((a, b) => b.length - a.length);
  return r(`\\b(${keys.join('|')})\\b`, (g) => EN_MONTHS[months[fold(g[1] ?? '')] - 1] ?? g[1] ?? '');
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Table de mots (clés repliées, littérales, espaces permis) → mots anglais. */
export function lexiconRule(table: Record<string, string>, when?: PivotRule['when']): PivotRule {
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  return r(
    `\\b(${keys.map(escape).join('|')})\\b`,
    (g) => table[fold(g[1] ?? '').replace(/\s+/g, ' ')] ?? g[1] ?? '',
    when
  );
}

/** Nombres composés : dizaines et unités (« veintidós », « dreiundzwanzig », « ventidue »). */
export function compose(
  units: Record<string, number>,
  tens: Record<string, number>,
  join: (ten: string, unit: string) => string[]
): Record<string, number> {
  const out: Record<string, number> = { ...units, ...tens };
  for (const [t, tv] of Object.entries(tens))
    for (const [u, uv] of Object.entries(units)) {
      if (uv < 1 || uv > 9) continue;
      for (const w of join(t, u)) out[w] = tv + uv;
    }
  return out;
}
