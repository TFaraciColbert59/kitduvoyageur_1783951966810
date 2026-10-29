/**
 * Modération légère des textes courts saisis à la création (activité, nom de club).
 *
 * Filet côté client, pas une garantie : il refuse les contenus évidents (liens, contacts,
 * chiffres, mots haineux, sexuels, violents ou illicites) avant l'envoi. Les signalements
 * (`place_reports`, `ReportBlockModal`) et les règles de la base restent la protection de fond.
 */

const BLOCKED_STEMS = [
  // haine / harcèlement
  'nazi',
  'negre',
  'nègre',
  'bougnoul',
  'youpin',
  'pede',
  'pédé',
  'enculé',
  'encule',
  'salope',
  'connard',
  'pute',
  'retarde',
  'raciste',
  'terroris',
  // sexuel
  'porn',
  'sexe',
  'sexy',
  'escort',
  'xxx',
  'nude',
  'nu',
  // violence / armes
  'tuer',
  'meurtre',
  'viol',
  'arme',
  'bombe',
  'kill',
  'suicid',
  // illicite
  'drogue',
  'cocaine',
  'cocaïne',
  'heroine',
  'héroïne',
  'cannabis',
  'weed',
  'arnaque',
  'casino',
  'paris sportif',
  'crypto',
] as const;

/** Mots entiers refusés tels quels (trop courts pour être testés en radical). */
const BLOCKED_WORDS = new Set(['nu', 'nus', 'cul', 'sm', 'bdsm']);

const ACTIVITY_MIN = 2;
const ACTIVITY_MAX = 40;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `null` si le texte passe, sinon le message à afficher. */
export function moderateText(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (/(https?:\/\/|www\.|\.[a-z]{2,}\/|@[a-z0-9_.]+|\b[\w.+-]+@[\w-]+\.[a-z]{2,})/i.test(text)) {
    return 'Pas de lien ni d’adresse e-mail ici.';
  }
  if (/(\+?\d[\s.-]?){8,}/.test(text)) return 'Pas de numéro de téléphone ici.';
  const clean = normalize(text);
  const words = clean.split(' ');
  for (const word of words) {
    if (BLOCKED_WORDS.has(word)) return 'Ce mot n’est pas accepté dans la communauté.';
  }
  for (const stem of BLOCKED_STEMS) {
    if (stem.length < 4) continue;
    const needle = normalize(stem);
    if (needle.length >= 4 && clean.includes(needle))
      return 'Ce mot n’est pas accepté dans la communauté.';
  }
  return null;
}

/** Activité d'un club : 2 à 40 lettres (espaces et tirets permis), sans contenu refusé. */
export function validateActivity(value: string): string | null {
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < ACTIVITY_MIN) return 'Indique l’activité du club (ex. Randonnée, Trail, Ski…).';
  if (text.length > ACTIVITY_MAX) return `L’activité fait ${ACTIVITY_MAX} caractères au plus.`;
  if (!/^[\p{L}][\p{L}\s'’-]*$/u.test(text)) return 'L’activité ne contient que des lettres.';
  return moderateText(text);
}
