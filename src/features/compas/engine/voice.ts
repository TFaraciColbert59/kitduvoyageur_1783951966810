/**
 * Compas — le tutoiement des conseils de l'IA, par règle.
 *
 * La consigne demande de tutoyer ; le modèle vouvoie encore parfois (Bruges,
 * 8 octobre : « Prévoyez », « Pensez à », « Réservez vos billets… si vous
 * voyagez »). Les impératifs courants passent au tutoiement ; un conseil qui
 * vouvoie encore après cela est écarté plutôt que de mêler les deux tons.
 * Aucune I/O ici.
 */

const IMPERATIVE: Record<string, string> = {
  achetez: 'achète',
  allez: 'va',
  anticipez: 'anticipe',
  apportez: 'apporte',
  ayez: 'aie',
  buvez: 'bois',
  chargez: 'charge',
  choisissez: 'choisis',
  commencez: 'commence',
  comptez: 'compte',
  consultez: 'consulte',
  contrôlez: 'contrôle',
  demandez: 'demande',
  emmenez: 'emmène',
  emportez: 'emporte',
  évitez: 'évite',
  faites: 'fais',
  gardez: 'garde',
  laissez: 'laisse',
  louez: 'loue',
  mettez: 'mets',
  notez: 'note',
  oubliez: 'oublie',
  partez: 'pars',
  pensez: 'pense',
  planifiez: 'planifie',
  portez: 'porte',
  prenez: 'prends',
  préparez: 'prépare',
  prévenez: 'préviens',
  prévoyez: 'prévois',
  privilégiez: 'privilégie',
  profitez: 'profite',
  renseignez: 'renseigne',
  réservez: 'réserve',
  respectez: 'respecte',
  sachez: 'sache',
  soyez: 'sois',
  téléchargez: 'télécharge',
  testez: 'teste',
  utilisez: 'utilise',
  vérifiez: 'vérifie',
};

/** « Renseignez-vous » → « Renseigne-toi ». */
const REFLEXIVE: Record<string, string> = {
  assurez: 'assure',
  équipez: 'équipe',
  hydratez: 'hydrate',
  informez: 'informe',
  munissez: 'munis',
  protégez: 'protège',
  renseignez: 'renseigne',
};

const WORD = /[A-Za-zÀ-ÖØ-öø-ÿŒœ]+/g;
const keepCase = (from: string, to: string) =>
  from.charAt(0) === from.charAt(0).toUpperCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to;

/** Vouvoiement restant : « vous », « votre », ou un impératif en « -ez » en tête de phrase. */
const STILL_FORMAL = /\b(vous|votre|vôtre)\b|(?:^|[.!?]\s+)(?!chez\b|assez\b)[A-Za-zÀ-ÿ]+ez\b/i;

/**
 * Le conseil au tutoiement, ou null s'il vouvoie encore (écarté). Un conseil
 * déjà au tutoiement, ou à l'infinitif, revient tel quel.
 */
export function tutoyer(note: string): string | null {
  // Pas de \b : il ne voit pas « é » comme une lettre (« Équipez-vous »).
  let out = note.replace(/(?<![A-Za-zÀ-ÿ])([A-Za-zÀ-ÿ]+)ez-vous\b/g, (m, base: string) => {
    const t = REFLEXIVE[`${base.toLowerCase()}ez`];
    return t ? `${keepCase(base, t)}-toi` : m;
  });
  out = out.replace(WORD, (w) => {
    const t = IMPERATIVE[w.toLowerCase()];
    return t ? keepCase(w, t) : w;
  });
  out = out.replace(/\bvos\b/g, 'tes').replace(/\bVos\b/g, 'Tes');
  return STILL_FORMAL.test(out) ? null : out;
}

/* ---------- Par langue (PLAN-100 6.2) ---------- */

/** Langue des conseils : celle de l'interface du lanceur (`src/lib/i18n/locale`). */
export type VoiceLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

/**
 * Mots-outils français qu'un conseil anglais ne contient pas. Deux au moins font
 * juger le conseil écrit en français (un seul peut être un nom de lieu : « La Paz »).
 */
const FRENCH_WORDS =
  /(?<![\p{L}\d])(le|la|les|des|du|une|et|est|pour|avec|dans|sur|tes|ton|ta|pense|prévois|réserve|vérifie|n’oublie|n'oublie)(?![\p{L}\d])/giu;

/** Le conseil semble écrit en français (au moins deux mots-outils distincts). */
export function looksFrench(note: string): boolean {
  const seen = new Set((note.match(FRENCH_WORDS) ?? []).map((w) => w.toLowerCase()));
  return seen.size >= 2;
}

/**
 * Mots que seul le français emploie (ni « la », « le », « des », « du » : ils existent en espagnol,
 * italien ou allemand). Pour juger qu'un conseil espagnol, allemand ou italien est resté en français.
 */
const FRENCH_ONLY_WORDS =
  /(?<![\p{L}\d])(pour|avec|dans|une|les|est|et|sur|tes|ton|pense|prévois|réserve|vérifie|n’oublie|n'oublie)(?![\p{L}\d])/giu;

export function looksFrenchStrict(note: string): boolean {
  const seen = new Set((note.match(FRENCH_ONLY_WORDS) ?? []).map((w) => w.toLowerCase()));
  return seen.size >= 2;
}

/**
 * Le ton d'un conseil de l'IA selon la langue :
 *  - français : tutoiement (`tutoyer`), un conseil qui vouvoie encore est écarté ;
 *  - anglais : pas de tu ni de vous ; un conseil rendu en français (le modèle n'a pas
 *    suivi la consigne) est écarté plutôt que de mêler deux langues à l'écran.
 */
export function voiceFor(note: string, locale: VoiceLocale = 'fr'): string | null {
  if (locale === 'fr') return tutoyer(note);
  if (locale === 'es' || locale === 'de' || locale === 'it') return looksFrenchStrict(note) ? null : note;
  return looksFrench(note) ? null : note;
}
