import { buildItinerary, isBuildable, renumberByDay } from './itinerary';
import { PRICE_TO_CHECK, type AdventurePrepDraft, type ItineraryModel, type ItineraryStep } from '../types';

/**
 * PORT de generation du parcours.
 *
 * `buildItinerary` est pur et deterministe : c'est une excellente base, mais
 * c'est un cas particulier, pas une interface. Ce fichier DEFINIT le contrat,
 * et `AiItineraryEngine` (aiItinerary.ts) en est le second implementation.
 *
 * Pourquoi le port existe : le preparateur doit fonctionner hors ligne, avec
 * quota epuise, ou provider tombe. Un seul `if (cle)` dans un composant rend
 * cette promesse intenable. Ici, le choix est explicite, testable, et le repli
 * est une implementation au meme niveau que la primaire — pas une branche
 * `catch` qui degrade silencieusement.
 */
export interface ItineraryEngine {
  readonly id: 'rules' | 'ai';
  /**
   * `null` = rien a construire (brouillon incomplet). C'est un contrat
   * volontaire : la regle dit "rien a afficher" plutot qu'un parcours vide.
   */
  generate(draft: AdventurePrepDraft, signal: AbortSignal): Promise<ItineraryModel | null>;
}

/** Moteur de regles : le generateur historique, conserve intact comme filet. */
export const rulesItineraryEngine: ItineraryEngine = {
  id: 'rules',
  async generate(draft, signal) {
    // Le signal n'est pas consulte : ce moteur est synchrone et ne peut pas
    // etre interrompu. Le respecter quand meme evite que le moteur IA
    // devienne le seul point ou l'annulation est comprise.
    void signal;
    return buildItinerary(draft);
  },
};

/* ------------------------------------------------------------------ */
/* Verifications rejouees sur la reponse IA                            */
/* ------------------------------------------------------------------ */

const START_MINUTES = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const match = START_MINUTES.exec(hhmm);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface StepInterval {
  step: ItineraryStep;
  startMin: number;
  endMin: number;
}

/** Convertit les etapes horodatees d'une journee en intervalles ordonnes. */
export function dayIntervals(steps: readonly ItineraryStep[]): StepInterval[] {
  return steps
    .filter((step) => step.startTime !== null && step.durationMin !== null && step.durationMin > 0)
    .map((step) => {
      const startMin = toMinutes(step.startTime as string);
      return { step, startMin, endMin: startMin + (step.durationMin as number) };
    })
    .filter((interval) => Number.isFinite(interval.startMin))
    .sort((a, b) => a.startMin - b.startMin || a.step.order - b.step.order);
}

/**
 * Premiere paire d'etapes qui se chevauchent dans la meme journee, ou `null`.
 *
 * Deux etapes qui se chevauchent sont un symptome : le modele a propose un
 * planning qui ne tient pas. On ne tente pas de reparer en silence — un
 * parcours incoherent est pire qu'un parcours honnete.
 */
export function findTimeOverlap(steps: readonly ItineraryStep[]): [ItineraryStep, ItineraryStep] | null {
  const byDay = new Map<number, ItineraryStep[]>();
  for (const step of steps) {
    const bucket = byDay.get(step.day);
    if (bucket) bucket.push(step);
    else byDay.set(step.day, [step]);
  }
  for (const bucket of byDay.values()) {
    const intervals = dayIntervals(bucket);
    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index].startMin < intervals[index - 1].endMin) {
        return [intervals[index - 1].step, intervals[index].step];
      }
    }
  }
  return null;
}

/**
 * Garde-fou de confiance : rejette toute affirmation de prix ou de
 * disponibilite. Le schema de sortie ne contient volontairement aucun champ
 * de prix (cf. features/itinerary.ts) — mais un modele peut glisser un montant
 * dans un titre ou une raison, et c'est precisement la que un utilisateur la
 * lirait comme un fait.
 *
 * Recall volontairement etroit : on ne cherche pas a attraper tout le vocabulaire
 * du tourisme, seulement les formulations qui se lisent comme un engagement.
 */
const UNSOURCED_CLAIM_PATTERNS: readonly { id: string; pattern: RegExp }[] = [
  { id: 'prix', pattern: /(?:\d\s*€|€\s*\d|\d\s*(?:eur|euros?)\b)/i },
  { id: 'prix', pattern: /(?:\d\s*\$|usd\b)/i },
  { id: 'disponibilite', pattern: /\b(?:reserv(?:e|ee|able))\b/i },
  { id: 'disponibilite', pattern: /\b(?:disponible\s+(?:jusqu|au|encore|seulement))|plus\s+de\s+places?\b/i },
  { id: 'disponibilite', pattern: /\b(?:reservation\s+confirmee|confirme\s+par\s+le\s+prestataire)\b/i },
];

/** Identifiants des affirmations non sourcees trouvees dans un texte. */
export function detectUnsourcedClaims(text: string | null): string[] {
  if (text === null || text.trim().length === 0) return [];
  const found = new Set<string>();
  for (const { id, pattern } of UNSOURCED_CLAIM_PATTERNS) {
    if (pattern.test(text)) found.add(id);
  }
  return [...found];
}

/**
 * Etape issue d'une reponse IA, avant validation. Distincte de `ItineraryStep`
 * car tout n'est pas renseigne : le modele ne renvoie pas de prix, donc
 * `price` est materialise ici et seulement ici.
 */
export interface DraftedStep {
  day: number;
  kind: ItineraryStep['kind'];
  title: string;
  placeName: string | null;
  startTime: string | null;
  durationMin: number | null;
  reason: string | null;
}

export interface DraftedItinerary {
  /** Etiquette du parcours, ou `null` quand le modele n en a pas propose. */
  title: string | null;
  days: number;
  steps: readonly DraftedStep[];
  hypotheses: readonly string[];
}

export type RejectionReason =
  | 'chevauchement_horaire'
  | 'affirmation_non_sourcee'
  | 'aucune_etape'
  | 'journee_non_couverte'
  | 'brief_non_honore'
  | 'programme_absent';

/**
 * Ce que la personne a DEMANDE, pour autant que ce soit lisible sans elle.
 *
 * `briefDays` vient de `briefRequestedDays` et vaut `null` quand le brief est
 * muet : l absence d information ne produit donc jamais un refus. Seul une
 * CONTRADICTION mesuree peut faire tomber une proposition.
 */
export interface DraftedExpectations {
  /** Nombre de jours nommes dans le brief, ou `null` si le brief n en nomme aucun. */
  readonly briefDays?: number | null;
}

/**
 * Une etape « programme » : quelque chose que la personne FAIT, par opposition a
 * une etape de transport. Un trajet reste un trajet — mais un parcours entier
 * qui ne contient que du transport ne decrit aucune sortie, et l ecran le
 * presente pourtant comme un voyage complet.
 */
function isProgrammeStep(kind: DraftedStep['kind']): boolean {
  return kind !== 'trajet';
}

export interface ValidationOutcome {
  ok: boolean;
  reason: RejectionReason | null;
  /** Detail lisible, jamais un dump technique : sert au message utilisateur. */
  detail: string | null;
  offending: readonly string[];
}

const REJECTION_MESSAGES: Readonly<Record<RejectionReason, string>> = {
  chevauchement_horaire: 'deux etapes se chevauchent sur la meme journee',
  affirmation_non_sourcee: 'une proposition affirme un prix ou une disponibilite non verifiee',
  aucune_etape: 'aucune etape exploitable n a ete proposee',
  journee_non_couverte: 'au moins une journee n a recu aucune etape',
  brief_non_honore: 'le parcours livre dure moins de jours que le brief en demande',
  programme_absent: 'aucune etape de programme : uniquement du transport',
};

function reject(reason: RejectionReason, offending: readonly string[] = []): ValidationOutcome {
  return {
    ok: false,
    reason,
    detail: REJECTION_MESSAGES[reason],
    offending: [...offending],
  };
}

/**
 * Verifie une proposition avant qu'elle ne devienne un `ItineraryModel`.
 * Regle unique : en cas de doute, on refuse. Le repli regles est meilleur
 * qu'un parcours qui affiche un prix invente comme s'il etait verifie.
 */
export function validateDrafted(
  drafted: DraftedItinerary,
  expectations: DraftedExpectations = {},
): ValidationOutcome {
  if (drafted.steps.length === 0) return reject('aucune_etape');

  const offending: string[] = [];
  for (const step of drafted.steps) {
    const claims = [
      ...detectUnsourcedClaims(step.title),
      ...detectUnsourcedClaims(step.reason),
      ...detectUnsourcedClaims(step.placeName),
    ];
    for (const claim of claims) {
      if (!offending.includes(claim)) offending.push(claim);
    }
  }
  if (offending.length > 0) return reject('affirmation_non_sourcee', offending);

  // Le chevauchement est verifie sur des etapes materialisees : on reutilise
  // exactement la meme fonction que le moteur de regles, donc un seul endroit
  // peut se tromper sur la definition d'un chevauchement.
  const materialized = materializeSteps(drafted, drafted.days);
  const overlap = findTimeOverlap(materialized);
  if (overlap) {
    return reject('chevauchement_horaire', [overlap[0].id, overlap[1].id]);
  }

  // Couverture des journees, verifiee EN DERNIER : les regles de fond
  // d abord (un prix invente, un chevauchement), la structure ensuite. Une
  // reponse qui ne remplit pas chaque jour affiche un « Jour 3 » vide sous un
  // titre « 3 jours » : le parcours annonce n existe pas. On refuse plutot
  // que de laisser l ecupuchon mentir — le repli regles prend le relais, et il
  // ne propose qu une structure, sans jamais fabriquer un chiffre.
  const covered = new Set(drafted.steps.map((step) => step.day));
  const missing: number[] = [];
  for (let day = 1; day <= drafted.days; day += 1) {
    if (!covered.has(day)) missing.push(day);
  }
  if (missing.length > 0) return reject('journee_non_couverte', missing.map(String));

  // Le brief FACE au plan — P0.18.
  //
  // Mesure du 2026-09-28, generation reelle : « Week-end de randonnee au
  // depart de Chamonix, refuge la premiere nuit » a produit 1 jour et une seule
  // etape, de nature `trajet`. Les quatre garde-fous ci-dessus passent : un
  // trajet ne chevauche rien, n affirme aucun prix, et couvre sa journee. C est
  // exactement le trou qu ils laissaient — ils verifient la FORME du parcours,
  // jamais qu il soit celui demande.
  //
  // Ces deux gardes ne cherchent pas a etre severes : elles ne lisent que ce
  // qui est ecrit et ne refusent que sur une contradiction mesuree. Un brief
  // muet (`briefDays === null`) ne peut rien faire tomber.
  const briefDays = expectations.briefDays ?? null;
  if (briefDays !== null) {
    // On compte les journees REELLEMENT couvertes, pas `drafted.days` : une
    // reponse peut declarer trois jours et n en couvrir qu un.
    const coveredDays = new Set(drafted.steps.map((step) => step.day)).size;
    if (coveredDays < briefDays) {
      return reject('brief_non_honore', [
        `brief: ${briefDays} jour(s)`,
        `plan: ${coveredDays} jour(s)`,
      ]);
    }
  }

  // Un plan entierement compose de transport ne decrit aucune sortie. La regle
  // porte sur l ENSEMBLE, pas sur chaque journee : un jour d arrivee qui ne
  // contient qu un trajet est normal, un voyage entier qui ne contient que ca ne
  // l est pas.
  if (!drafted.steps.some((step) => isProgrammeStep(step.kind))) {
    return reject('programme_absent', drafted.steps.map((step) => step.title));
  }

  return { ok: true, reason: null, detail: null, offending: [] };
}

const ICONS: Readonly<Record<ItineraryStep['kind'], string>> = {
  trajet: 'navigation',
  arret: 'map',
  repos: 'clock',
  nuit: 'bed-double',
  ravitaillement: 'backpack',
};

/**
 * Transforme une proposition validee en etapes d domaine.
 *
 * Prix : `PRICE_TO_CHECK` inchange. Ce n'est pas un oubli — c'est la
 * consequence directe de l'absence de champ prix dans le schema IA. Un jour
 * ou une source verifiee alimentera cette table, elle viendra ici, jamais du
 * texte du modele.
 */
export function materializeSteps(
  drafted: DraftedItinerary,
  days: number,
): ItineraryStep[] {
  return drafted.steps.map((step, index) => ({
    id: `ia-d${step.day}-${step.kind}-${index}`,
    day: step.day,
    order: 0,
    kind: step.kind,
    title: step.title,
    placeName: step.placeName,
    startTime: step.startTime,
    durationMin: step.durationMin,
    reason: step.reason,
    price: PRICE_TO_CHECK,
    state: 'propose' as const,
    kept: false,
    icon: ICONS[step.kind],
    // Aucune position ici, jamais. Le schema de sortie ne porte pas de
    // coordonnee, donc la seule source de position est l inventaire REEL,
    // branche plus tard par `assignPlaces`.
    lat: null,
    lon: null,
    mealSlot: null,
  }));
}

export { renumberByDay, isBuildable };
