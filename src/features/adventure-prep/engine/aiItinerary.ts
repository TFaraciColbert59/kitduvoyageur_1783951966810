import { askAI } from '@/lib/ai/askAI';
import {
  buildItineraryPrompt,
  itineraryOutputSchema,
  strictItineraryOutputSchema,
  normalizeOutputStepKinds,
  ITINERARY_SPEC,
  sanitizeStartTime,
  type StrictItineraryOutput,
} from '@/lib/ai/features/itinerary';
import { activityById } from '../catalog';
import { acceptedSuggestedStartDate, todayIso } from './calendar';
import { acceptSuggestedDurationDays, briefRequestedDays } from './briefDays';
import { shouldRetryAfterFailure } from './aiFailure';
import {
  assembleModel,
  buildSteps,
  extractJsonObject,
  runItineraryGeneration,
  type ProposalFetcher,
} from './itineraryPhases';
import { rulesItineraryEngine, validateDrafted, type DraftedItinerary, type DraftedStep, type ItineraryEngine } from './itineraryEngine';
import type { AdventurePrepDraft } from '../types';

/**
 * Moteur IA — PARTIE SERVEUR.
 *
 * `askAI` est serveur-only (la cle NVIDIA vit dans `.env.local`, jamais dans le
 * bundle navigateur). Ce fichier est donc le seul point du preparateur qui
 * touche le reseau ; tout le reste du rail vit dans `itineraryPhases.ts`, en
 * pur, et tourne dans le navigateur.
 *
 * Regle unique du module : l'IA PROPOSE, elle ne decide pas. Elle peut
 * structurer, ordonner, nommer un besoin. Elle ne peut pas produire un prix,
 * une disponibilite ou un lieu que l'utilisateur n'a pas donnes. Le schema de
 * sortie ne contient volontairement aucun champ de prix : ce qui n'est pas
 * verifiable reste « à vérifier », jamais un chiffre plausible.
 */

/** 4096 tokens : 30 jours x 12 etapes tiennent avec marge. Au-dela, on tronque. */
const MAX_TOKENS = 4_096;

function partySize(draft: AdventurePrepDraft): number {
  return Math.max(1, draft.group.adults + draft.group.children);
}

/** Lignes de preferences : uniquement ce que l'utilisateur a reellement coche. */
function preferenceLines(draft: AdventurePrepDraft): string[] {
  const lines: string[] = [];
  lines.push(`budget : ${draft.preferences.budgetLevel}`);
  lines.push(`transport : ${draft.preferences.transport}`);
  if (draft.preferences.interests.length > 0) {
    lines.push(`centres d interet : ${draft.preferences.interests.join(', ')}`);
  }
  if (draft.preferences.accessibilityNeeds.length > 0) {
    lines.push(`accessibilite : ${draft.preferences.accessibilityNeeds.join(', ')}`);
  }
  if (draft.group.hasPets) lines.push('un animal de compagnie accompagne le groupe');
  if (draft.group.children > 0) {
    lines.push(`${draft.group.children} enfant(s) dans le groupe : adapter la longueur des etapes`);
  }
  return lines;
}

/** Lieux reellement connus : uniquement ceux que l'utilisateur a choisis. */
function knownPlaces(draft: AdventurePrepDraft) {
  return [draft.route.origin, draft.route.destination]
    .filter((place): place is NonNullable<typeof place> => place !== null)
    .map((place) => ({ name: place.name, lat: place.lat as number | null, lon: place.lon as number | null }));
}

/**
 * Etiquette du parcours, normalisee comme tous les libelles affiches.
 *
 * Le schema borne deja la longueur, mais une reponse peut contourner le schema
 * : on reborne ici plutot que de faire confiance a l appelant. Une etiquette
 * vide n est pas une etiquette : elle devient `null`, jamais une chaine vide
 * qui s afficherait comme un titre casse a l ecran.
 */
function sanitizeItineraryTitle(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return null;
  const capped = collapsed.length > 80 ? `${collapsed.slice(0, 79)}…` : collapsed;
  return frenchTypography(capped);
}

function toDrafted(output: StrictItineraryOutput, days: number): DraftedItinerary {
  const steps: DraftedStep[] = output.steps
    .filter((step) => step.day >= 1 && step.day <= days)
    .map((step) => ({
      day: step.day,
      kind: step.kind,
      // Le modele ecrit comme il a appris : sans accents, sans espaces
      // insecables. C est un libelle affiche tel quel, donc il se repare
      // AVANT d arriver dans le modele — jamais apres, pour que l ecran et le
      // test voient exactement la meme chaine.
      title: frenchTypography(step.title),
      placeName: step.placeName === null ? null : frenchTypography(step.placeName),
      startTime: sanitizeStartTime(step.startTime),
      durationMin: step.durationMin,
      reason: step.reason === null ? null : frenchTypography(step.reason),
    }));
  return {
    title: sanitizeItineraryTitle(output.title),
    days,
    steps,
    hypotheses: output.hypotheses.map((hypothese) => frenchTypography(hypothese)),
  };
}

/**
 * Nombre d'essais : deux, et pas trois.
 *
 * Une deuxieme tentative suffit parce qu'un delai ne se prolonge pas — mesure
 * du 2026-09-28, un appel a 45 010 ms suivi d'un autre a 2 682 ms sur le meme
 * brouillon. Au-dela, on paie deux delais pour aboutir au meme repli regles.
 */
const MAX_ATTEMPTS = 2;

/**
 * Demande une proposition au modele et la valide au mieux.
 *
 * La cause de l'echec remonte AVEC le resultat : c'est elle qui permet a l'ecran
 * de dire « le service a ete lent » plutot que « l'assistant n'est pas active »,
 * deux affirmations dont une seule est vraie.
 */
export const requestDraftedItinerary: ProposalFetcher = async (draft, signal, availablePlaces) => {
  const origin = draft.route.origin;
  // Sans depart choisi, aucune requete ne part : le repli regles construit seul.
  if (!origin) return { drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null };
  // La duree que le plan DOIT couvrir — P0.18.
  //
  // Avant, elle venait du calendrier seul : aucune date choisie donc 1 jour, et
  // le brief « week-end » se heurtait a un « Duree : 1 jour(s) » que le modele
  // ne pouvait pas contredire sans disobedience. On distingue donc trois cas :
  // la personne a choisi (fait), le brief en nomme une (demande explicite), ou
  // rien n est dit (c est a l IA, qui tranchera sur sa propre proposition).
  const calendarDays = Math.max(1, Math.trunc(draft.calendar.durationDays ?? 1));
  const durationChosenByUser = draft.calendar.durationDays !== null && !draft.calendar.durationIsSuggested;
  const briefDays = briefRequestedDays(draft.brief);
  const days = durationChosenByUser ? calendarDays : Math.max(briefDays ?? 1, 1);
  const activity = activityById(draft.activities.primary ?? '');

  // UN seul jour pour les deux verifications. Le prompt annonce au modele la
  // date a partir de laquelle il peut proposer, et le garde-fou refuse sur la
  // meme reference : si les deux divergeaient, le modele proposerait un jour que
  // le garde-fou renverrait en null, sans un mot.
  const today = todayIso();

  const { system, prompt } = buildItineraryPrompt({
    todayIso: today,
    activityLabel: activity?.label ?? 'activite libre',
    originLabel: origin.name,
    destinationLabel: draft.route.destination?.name ?? origin.name,
    startDateLabel: draft.calendar.startDate,
    durationDays: days,
    partySize: partySize(draft),
    pace: draft.preferences.pace,
    loop: draft.route.shape === 'boucle',
    preferences: preferenceLines(draft),
    knownPlaces: knownPlaces(draft),
    availablePlaces,
    brief: draft.brief,
    durationChosenByUser,
    briefDays,
  });

  // Le prompt est bati ailleurs, sans accents. On ne le modifie pas : on
  // normalise ce qui PART. Sans cette passe, le modele recopie « Diner » et
  // « Eau et ravitaillement » mot pour mot — c est de la que viennent les
  // libelles sans accent que l utilisateur lit ensuite a l ecran.
  const consigne = frenchTypography(system);
  const demande = frenchTypography(prompt);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (signal.aborted) return { drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null };

    const response = await askAI({
      feature: 'itinerary',
      tier: ITINERARY_SPEC.tier,
      system: consigne,
      prompt: demande,
      maxTokens: MAX_TOKENS,
      cacheTtlSeconds: 0,
    });

    // Un run coupe ne produit rien : mieux vaut aucun resultat qu'un resultat
    // que personne ne lira.
    if (signal.aborted) return { drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null };

    // Le fallback du registre renvoie un JSON vide : c'est le signal fiable que
    // l'appel n'a pas abouti, sans avoir a deviner depuis le contenu. La cause
    // vient de askAI ; le defaut 'provider_indisponible' garantit qu'aucune
    // degradation ne sortira sans cause nommee.
    if (response.degraded || response.provider === 'fallback') {
      const failure = response.failureReason ?? 'provider_indisponible';
      if (!shouldRetryAfterFailure(failure) || attempt === MAX_ATTEMPTS) {
        return { drafted: null, failure, suggestedStartDate: null, suggestedDurationDays: null };
      }
      continue;
    }

    // Le `kind` est d'abord ramene au vocabulaire canonique, puis valide par
    // le schema strict. Un type que le modele invente et qu on sait classer
    // (« arrivee », « randonnee ») ne fait plus tomber le parcours entier ;
    // un type qu on ne sait pas classer, si.
    const parsed = strictItineraryOutputSchema.safeParse(
      normalizeOutputStepKinds(extractJsonObject(response.text)),
    );
    if (!parsed.success) {
      // Le modele a REPONDU : repasser la meme demande ne changerait rien au
      // schema, et couteuse un appel de plus pour un resultat identique.
      return { drafted: null, failure: 'reponse_invalide', suggestedStartDate: null, suggestedDurationDays: null };
    }

    // La duree proposee par le modele elle-meme. Elle compte des lors qu elle
    // n est pas imposee : sans elle, `toDrafted` filtrerait les journees 2 et
    // suivantes du plan sur une duree de 1 — le modele aurait fait son travail
    // et le depot l aurait jete, sans un mot a l ecran.
    const proposedDurationDays = acceptSuggestedDurationDays(parsed.data.suggestedDurationDays);
    const effectiveDays = durationChosenByUser
      ? days
      : Math.max(days, proposedDurationDays ?? 0);

    const drafted = toDrafted(parsed.data, effectiveDays);
    if (drafted.steps.length === 0) {
      return { drafted: null, failure: 'reponse_invalide', suggestedStartDate: null, suggestedDurationDays: null };
    }
    // Le serveur est SEUL juge du « passe » : `acceptedSuggestedStartDate` lit
    // SON jour, celui de la machine qui repond. Une date passee ou mal formee
    // devient donc `null` ici, et l ecran garde son « a verifier » plutot que
    // d afficher une date que personne n'a verifiee.
    return {
      drafted,
      failure: null,
      suggestedStartDate: acceptedSuggestedStartDate(parsed.data.suggestedStartDate, today),
      // Meme traitement que la date : une duree hors bornes devient `null`, et
      // l ecran garde alors son « a verifier » plutot qu un nombre plausible
      // que personne n a verifie.
      suggestedDurationDays: durationChosenByUser ? null : proposedDurationDays,
    };
  }

  return { drafted: null, failure: 'provider_indisponible', suggestedStartDate: null, suggestedDurationDays: null };
};

/**
 * Le moteur complet, pour un appel serveur direct (tests de bout en bout,
 * usages hors navigateur). L'ecran, lui, utilise `runItineraryGeneration` avec
 * une Server Action comme `ProposalFetcher`.
 */
export const aiItineraryEngine: ItineraryEngine = {
  id: 'ai',
  async generate(draft, signal) {
    const { drafted } = await requestDraftedItinerary(draft, signal);
    if (!drafted) return rulesItineraryEngine.generate(draft, signal);
    const verdict = validateDrafted(drafted);
    if (!verdict.ok) return rulesItineraryEngine.generate(draft, signal);
    return assembleModel(draft, drafted, buildSteps(drafted));
  },
};

export { runItineraryGeneration };



/* ------------------------------------------------------------------ */
/* P0.7 — Typographie francaise                                          */
/* ------------------------------------------------------------------ */

/**
 * Repare la typographie francaise, et rien d autre.
 *
 * Ce n'est pas un correcteur orthographique : c'est une liste ferme de mots du
 * voyage sans accents, qu on sait reecrire sans hesiter. Un mot inconnu passe
 * intact — mieux vaut un libelle imparfait qu un mot invente.
 *
 * Deux exclusions deliberes :
 *
 * 1. `a` et `ou` n sont JAMAIS remplaces. « Il y a » deviendrait « il y à ».
 *    Ces deux mots ne se traitent qu au sein d une PHRASE complete, où le
 *    contexte tranche sans ambiguïté.
 * 2. Les nombres, heures et coordonnees ne sont jamais concernes. « 08:30 »
 *    reste « 08:30 » : une heure cassee est pire qu une heure sans typographie.
 */

/** Mots isoles dont la forme sans accent n existe pas en francais. */
const MOTS_REPARES: Readonly<Record<string, string>> = {
  // Les valeurs sont en minuscules : la majuscule d origine est reappliquee
  // ensuite. « Diner » en tete de titre doit rester « Dîner », alors que
  // « diner » au milieu d une phrase est un verbe et reste « dîner ».
  diner: 'dîner',
  dejeuner: 'déjeuner',
  dejeun: 'déjeuner',
  gouter: 'goûter',
  arret: 'arrêt',
  arrets: 'arrêts',
  activite: 'activité',
  activites: 'activités',
  necessaire: 'nécessaire',
  necessaires: 'nécessaires',
  verifier: 'vérifier',
  verifie: 'vérifié',
  verifiee: 'vérifiée',
  interet: 'intérêt',
  interessant: 'intéressant',
  reperage: 'repérage',
  reperer: 'repérer',
  prevoir: 'prévoir',
  prealable: 'préalable',
  acces: 'accès',
  deja: 'déjà',
  apres: 'après',
  tres: 'très',
  cles: 'clés',
  eglise: 'église',
  foret: 'forêt',
  critere: 'critère',
  criteres: 'critères',
  duree: 'durée',
  etape: 'étape',
  etapes: 'étapes',
  etee: 'étée',
  etees: 'étées',
  depart: 'départ',
  arrivee: 'arrivée',
  cadre: 'cadre',
  ecrans: 'écrans',
  epreuve: 'épreuve',
  proposee: 'proposée',
  proposees: 'proposées',
  prevue: 'prévue',
  prevues: 'prévues',
  mesuree: 'mesurée',
  mesurees: 'mesurées',
};

/**
 * Phrases ou le contexte suffit. Le séparateur tolere une apostrophe comme une
 * espace : « a l'arrivee », « a l arrivee » et « a l’arrivée » se réparent
 * tous les trois, parce que la personne n'écrit pas la même chose à chaque fois.
 */
const PHRASES_REPAREES: Readonly<Record<string, string>> = {
  'a verifier': 'à vérifier',
  'a prevoir': 'à prévoir',
  'a confirmer': 'à confirmer',
  'a trouver': 'à trouver',
  'a proximite': 'à proximité',
  'a partir': 'à partir',
  'a l arrivee': 'à l’arrivée',
  'a l eau': 'à l’eau',
  'a pied': 'à pied',
  'a la journee': 'à la journée',
  'c est': 'c’est',
  'n est': 'n’est',
  'qu il': 'qu’il',
  'l eau': 'l’eau',
  'd eau': 'd’eau',
};

/** Une suite deja accentuee est correcte : on ne la retouche pas. */
const CONTIENT_ACCENT = /[À-ÿ]/;

const MOT = /[A-Za-zÀ-ÿ]+(?:'[A-Za-zÀ-ÿ]+)*/g;
const DIGIT = /[0-9]/;

const PHRASE_RE = new RegExp(
  Object.keys(PHRASES_REPAREES)
    .map((key) => key.split(' ').join("[ '\\u2019]"))
    .join('|'),
  'gi',
);

/** La cle du lexique, quel que soit le separateur reellement ecrit. */
const clePhrase = (texte: string): string =>
  texte.toLowerCase().replace(/['\u2019]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Reprend la majuscule d origine. `Arret` en tete de titre doit devenir
 * `Arrêt`, pas `arrêt` : la casse porte une information de lecture.
 */
function enMajusculeSiNecessaire(entree: string, sortie: string): string {
  return /^[A-ZÀ-Þ]/.test(entree) ? sortie.charAt(0).toUpperCase() + sortie.slice(1) : sortie;
}

/**
 * Passe de typographie, appliquee au prompt ET a la reponse.
 *
 * Idempotente par construction : une fois reecrit, un mot accentue ne reapparait
 * plus dans le lexique, et l apostrophe typographique n est plus capturee par le
 * motif de mot. On peut donc l'appeler deux fois sans deformer le texte.
 */
export function frenchTypography(text: string): string {
  if (!text) return text;

  // 1. Phrases : le contexte tranche les cas ambigus (`a` vers `à`).
  let out = text.replace(PHRASE_RE, (motif) => PHRASES_REPAREES[clePhrase(motif)] ?? motif);

  // 2. Mots isoles. Le motif n attrape que des lettres, donc ni un nombre, ni
  //    une heure, ni une coordonnee. L apostrophe sert de separateur :
  //    « d'interet » se lit comme deux morceaux, « d » reste tel quel et
  //    « interet » est repare.
  out = out.replace(MOT, (mot) => {
    if (CONTIENT_ACCENT.test(mot)) return mot;
    const morceaux = mot.split("'");
    return morceaux
      .map((morceau, index) => {
        const repare = MOTS_REPARES[morceau.toLowerCase()];
        const texte = repare === undefined ? morceau : enMajusculeSiNecessaire(morceau, repare);
        return index < morceaux.length - 1 ? `${texte}\u2019` : texte;
      })
      .join('');
  });

  // 3. Espaces insecables avant la ponctuation haute, sauf apres un chiffre.
  //    Les espaces ordinaires devant la ponctuation sont ABSORBES : les garder
  //    laisserait « Activite\u00A0: », deux espaces, plus laid que le texte d avant.
  return out.replace(/[ ]*([;:!?])/g, (match, ponctuation: string, decalage: number, tout: string) => {
    let avant = decalage - 1;
    while (avant >= 0 && tout[avant] === ' ') avant -= 1;
    const precedent = tout[avant] ?? '';
    if (precedent === '') return match;
    // Une heure (« 08:30 ») ou un rapport (« 3:1 ») ne sont pas de la ponctuation.
    if (DIGIT.test(precedent)) return match;
    // Un saut de ligne devant la ponctuation appartient au gabarit du prompt.
    if (/\s/.test(precedent)) return match;
    // Deja insecable : sans ce test, une seconde passe empilerait une seconde
    // insecable et la normalisation ne serait plus idempotente.
    return `\u00A0${ponctuation}`;
  });
}
