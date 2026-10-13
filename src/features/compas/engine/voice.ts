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
