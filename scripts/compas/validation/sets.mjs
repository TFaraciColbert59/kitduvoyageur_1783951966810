// Jeux de validation du Compas (PLAN-100, phase 7) : lecture et contrôle de forme.
//
// Un jeu est un tableau d'objets { id, phrase, expect } :
//   - id      : identifiant stable (r01… pour les 20 parcours réels, n01… pour les 50 demandes
//               nouvelles, m01… pour les 50 demandes monde) ; il relie phrase, journal et base ;
//   - phrase  : ce que la personne tape dans « Où », tel quel ;
//   - expect  : ce qui se vérifie mécaniquement en base une fois la préparation finie (voir
//               README.md). Rien n'y est écrit qui ne soit dans la phrase : jamais un nom de
//               ville attendu si la phrase ne le nomme pas.
//
// Module sans effet de bord : importé par le passage en ligne (validate-online.mjs), par
// compare.mjs et par les tests.
import fs from 'node:fs';

/**
 * Valeurs de `trips.primary_activity` (type `trip_activity_type`) : les sept de
 * 20260904050000_trips_core.sql, plus celles ajoutées par 20261005185311_trip_activity_types_more.sql
 * et 20261006080449_trip_activity_running_trail.sql. Un test relit les migrations et échoue si
 * cette liste s'en écarte.
 */
export const ACTIVITIES = [
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
];

/** Types de `metadata.compas.prefs.nights` vérifiables en base. */
export const NIGHTS = ['bivouac', 'refuge', 'hebergement', 'mixte'];

/** Les clés permises dans `expect`, avec leur forme. */
export const EXPECT_KEYS = {
  country: 'code ISO 3166-1 alpha-2, ou liste (l’un d’eux)',
  activity: 'valeur de trip_activity_type, ou liste (l’une d’elles)',
  days: 'nombre de jours, ou [min, max]',
  party: 'nombre de personnes dit dans la phrase',
  origin: 'départ dit (texte), ou null si la phrase n’en dit aucun',
  carFree: 'true : « sans voiture » dit',
  nights: 'refuge | bivouac | hebergement | mixte',
  budget: '{ amount, currency } : budget dit',
  perPersonBudget: 'true : le budget dit est par personne',
  startMonth: 'mois de départ (1 à 12)',
  startMonthDay: 'jour de départ « MM-JJ » (dates dites)',
  startOffsetDays: '[min, max] jours entre la création et le départ (« dans 3 semaines »)',
  hemisphere: '"S" : toutes les étapes dans l’hémisphère sud',
  linearRoute: 'true : parcours linéaire, jamais deux étapes consécutives au même lieu',
};

/** Minuscules, sans accents, ponctuation en espaces : « Bourg-en-Bresse » = « bourg en bresse ». */
export function plain(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const asList = (v) => (Array.isArray(v) ? v : [v]);

/**
 * Accepte un tableau de chaînes (ancien format du passage en ligne) ou d'objets { id, phrase,
 * expect }. Une chaîne devient { id: "p01", phrase, expect: {} }.
 */
export function normalizeSet(raw) {
  if (!Array.isArray(raw)) throw new Error('Le jeu doit être un tableau.');
  return raw.map((entry, i) => {
    if (typeof entry === 'string')
      return { id: `p${String(i + 1).padStart(2, '0')}`, phrase: entry, expect: {} };
    if (isObject(entry))
      return {
        id: String(entry.id ?? `p${String(i + 1).padStart(2, '0')}`),
        phrase: String(entry.phrase ?? entry.say ?? ''),
        expect: isObject(entry.expect) ? entry.expect : {},
      };
    throw new Error(`Entrée ${i + 1} du jeu : chaîne ou objet attendu.`);
  });
}

/** Lit un jeu depuis un fichier JSON. */
export function loadSet(file) {
  return normalizeSet(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Contrôle de forme d'un jeu ; rend la liste des défauts (vide : le jeu est bon). */
export function validateSet(items) {
  const errors = [];
  const ids = new Set();
  const phrases = new Set();
  for (const item of items) {
    const at = `${item.id}`;
    if (ids.has(item.id)) errors.push(`${at} : identifiant en double`);
    ids.add(item.id);
    const phrase = item.phrase.trim();
    if (phrase.length < 2) errors.push(`${at} : phrase vide`);
    // Le Compas lit 240 caractères au plus (understandRequest).
    if (phrase.length > 240) errors.push(`${at} : phrase de plus de 240 caractères`);
    if (phrase !== item.phrase) errors.push(`${at} : espaces autour de la phrase`);
    if (phrases.has(plain(phrase))) errors.push(`${at} : phrase en double`);
    phrases.add(plain(phrase));
    errors.push(...validateExpect(item.expect).map((e) => `${at} : ${e}`));
  }
  return errors;
}

/** Contrôle de forme d'un `expect`. */
export function validateExpect(expect) {
  const errors = [];
  for (const [key, value] of Object.entries(expect)) {
    if (!(key in EXPECT_KEYS)) {
      errors.push(`clé inconnue « ${key} »`);
      continue;
    }
    switch (key) {
      case 'country':
        if (!asList(value).every((c) => typeof c === 'string' && /^[A-Z]{2}$/.test(c)))
          errors.push('country : code(s) ISO alpha-2 en majuscules');
        break;
      case 'activity':
        if (!asList(value).every((a) => ACTIVITIES.includes(a)))
          errors.push(`activity : valeur(s) hors trip_activity_type (${asList(value).join(', ')})`);
        break;
      case 'days':
        if (!(
          (Number.isInteger(value) && value >= 1 && value <= 60) ||
          (Array.isArray(value) &&
            value.length === 2 &&
            value.every(Number.isInteger) &&
            value[0] >= 1 &&
            value[0] <= value[1] &&
            value[1] <= 60)
        ))
          errors.push('days : entier de 1 à 60, ou [min, max]');
        break;
      case 'party':
        if (!(Number.isInteger(value) && value >= 2 && value <= 99))
          errors.push('party : entier de 2 à 99 (seul·e ne se dit pas)');
        break;
      case 'origin':
        if (!(value === null || (typeof value === 'string' && plain(value).length >= 2)))
          errors.push('origin : texte, ou null');
        break;
      case 'carFree':
      case 'perPersonBudget':
      case 'linearRoute':
        if (value !== true) errors.push(`${key} : true ou absent`);
        break;
      case 'nights':
        if (!NIGHTS.includes(value)) errors.push(`nights : ${NIGHTS.join(' | ')}`);
        break;
      case 'budget':
        if (!(
          isObject(value) &&
          typeof value.amount === 'number' &&
          value.amount > 0 &&
          typeof value.currency === 'string' &&
          /^[A-Z]{3}$/.test(value.currency)
        ))
          errors.push('budget : { amount > 0, currency ISO 4217 }');
        break;
      case 'startMonth':
        if (!(Number.isInteger(value) && value >= 1 && value <= 12))
          errors.push('startMonth : 1 à 12');
        break;
      case 'startMonthDay':
        if (!(typeof value === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)))
          errors.push('startMonthDay : « MM-JJ »');
        break;
      case 'startOffsetDays':
        if (!(
          Array.isArray(value) &&
          value.length === 2 &&
          value.every(Number.isInteger) &&
          value[0] <= value[1]
        ))
          errors.push('startOffsetDays : [min, max]');
        break;
      case 'hemisphere':
        if (value !== 'S') errors.push('hemisphere : "S"');
        break;
      default:
        break;
    }
  }
  if (expect.perPersonBudget && !expect.budget) errors.push('perPersonBudget demande un budget');
  return errors;
}
