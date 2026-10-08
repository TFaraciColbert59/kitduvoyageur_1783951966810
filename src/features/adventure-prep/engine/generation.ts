import type { AIFailureReason } from '@/lib/ai/providers/types';
import type {
  AdventurePrepDraft,
  GenerationPhase,
  GenerationPhaseId,
  GenerationPhaseVerdict,
  GenerationState,
  ItineraryStep,
} from '../types';
import type { RejectionReason } from './itineraryEngine';

/**
 * Les sept phases reellement executees, dans l'ordre. Elles decrivent un
 * travail reel, jamais une animation : aucune n'est cochee a la construction.
 *
 * `trace` et `meteo` mesurent ce que les regles ne peuvent pas inventer : le
 * Kilometrage vient du routeur (Geoapify, Valhalla), la meteo d Open-Meteo sur
 * les dates reelles de l aventure. Un fournisseur muet laisse la phase
 * cochee et la mesure a `null` — l'ecran affiche « a verifier ».
 */
export const GENERATION_PHASES: readonly { id: GenerationPhaseId; label: string }[] = [
  { id: 'recherche_parcours', label: 'Recherche du parcours' },
  { id: 'verification_etapes', label: 'Vérification des étapes' },
  { id: 'disponibilites', label: 'Vérification des disponibilités' },
  { id: 'lieux', label: 'Recherche des lieux réels' },
  { id: 'trace', label: 'Calcul des distances sur le réseau' },
  { id: 'meteo', label: 'Météo des jours de ton aventure' },
  { id: 'synthese', label: 'Mise en forme de ton aventure' },
];

function phases(done: GenerationPhaseId[] = []): GenerationPhase[] {
  return GENERATION_PHASES.map((phase) => ({ ...phase, done: done.includes(phase.id) }));
}

export function initialGeneration(): GenerationState {
  return {
    status: 'idle',
    phases: phases(),
    steps: [],
    days: 0,
    error: null,
    notice: null,
    failure: null,
    rejectedReason: null,
    outcomes: [],
  };
}

/**
 * Depose les verdicts REELS rendus par le moteur.
 *
 * Ces verdicts sont la seule source de verite sur une phase tombee : le courseur
 * les rend depuis le premier jour, et `phaseHealth` sait deja les resumer, mais
 * ils s'arretaient a la frontiere du runner. Un parcours degrade sans verdict
 * depose se lisait comme un parcours reussi, et l'ecran affichait des « A
 * verifier » sans jamais nommer la panne.
 *
 * La fonction ne trie ni ne complete : elle conserve ce que le moteur a rendu,
 * dans son ordre. Un verdict absent reste absent.
 */
export function setPhaseOutcomes(
  state: GenerationState,
  outcomes: readonly GenerationPhaseVerdict[]
): GenerationState {
  return { ...state, outcomes: [...outcomes] };
}

/**
 * Ouvre une phase a la reprise : son verdict devient PERIME.
 *
 * Le verdict decrit un etat passe. Le garder afficherait « Échec : calcul des
 * distances » pendant que la reprise travaille, alors que l'ecran serait en
 * train de reparer exactement cela.
 */
export function clearPhaseOutcome(
  state: GenerationState,
  phase: GenerationPhaseId
): GenerationState {
  if (!(state.outcomes ?? []).some((verdict) => verdict.id === phase)) return state;
  return { ...state, outcomes: state.outcomes.filter((verdict) => verdict.id !== phase) };
}

export interface GenerationProgress {
  done: number;
  total: number;
  currentLabel: string;
  canResume: boolean;
}

/** Progression reelle : un compte d'etapes, jamais un pourcentage. */
export function generationProgress(state: GenerationState): GenerationProgress {
  const done = state.phases.filter((phase) => phase.done).length;
  const pending = state.phases.find((phase) => !phase.done);
  const interrupted = state.status === 'interrompu' || state.status === 'echec';
  return {
    done,
    total: state.phases.length,
    currentLabel: pending ? pending.label : 'Terminé',
    canResume: interrupted && state.steps.length > 0,
  };
}

export function startGeneration(_previous: GenerationState): GenerationState {
  // `_previous.rejectedReason` n est PAS repris : une NOUVELLE generation n a
  // encore rien refuse. Le garder afficherait le motif d un refus deja
  // remplace, exactement comme une notice d enrichissement perimee.
  return {
    status: 'en_cours',
    phases: phases(),
    steps: [],
    days: 0,
    error: null,
    notice: null,
    failure: null,
    rejectedReason: null,
    outcomes: [],
  };
}

export function resumeGeneration(state: GenerationState): GenerationState {
  return {
    ...state,
    status: 'en_cours',
    error: null,
  };
}

export function markPhaseDone(state: GenerationState, id: GenerationPhaseId): GenerationState {
  return {
    ...state,
    phases: state.phases.map((phase) => (phase.id === id ? { ...phase, done: true } : phase)),
  };
}

/** Enregistre ce qui est deja produit : conserve apres arret, echec ou reprise. */
export function setPartial(
  state: GenerationState,
  steps: readonly ItineraryStep[],
  days: number
): GenerationState {
  return { ...state, steps: [...steps], days: Math.max(0, Math.trunc(days)) };
}

export function interruptGeneration(state: GenerationState): GenerationState {
  return { ...state, status: 'interrompu' };
}

export function failGeneration(state: GenerationState, error: string): GenerationState {
  return { ...state, status: 'echec', error };
}

/**
 * Phrase d'etat a confirmer une fois le parcours construit.
 *
 * Elle survit a une reprise et au changement d'ecran : l'utilisateur qui revient
 * sur le parcours doit encore lire pourquoi il n'a pas ete enrichi, sinon la
 * notice n'a aucun effet.
 */
export function setGenerationNotice(
  state: GenerationState,
  notice: string | null
): GenerationState {
  return state.notice === notice ? state : { ...state, notice };
}

/**
 * La cause, stockee a cote de la phrase.
 *
 * Elle vit dans le store — donc dans `localStorage` — parce que le bandeau de
 * l'ecran suivant doit pouvoir nommer la meme cause que la notice, sans
 * redemander le service qui vient de tomber.
 */
export function setGenerationFailure(
  state: GenerationState,
  failure: AIFailureReason | null
): GenerationState {
  return state.failure === failure ? state : { ...state, failure };
}

/**
 * La phrase du refus, stockee a cote de la notice.
 *
 * Elle vit dans le store pour la meme raison que `failure` : l ecran qui
 * montre le parcours doit pouvoir nommer le refus SANS redemander la
 * generation qui l a produit. Un parcours de regles affiche apres un
 * retour au hub doit encore dire pourquoi il n a pas ete enrichi.
 *
 * `null` efface : c est le seul cas ou l information part, et il correspond
 * a une generation qui n a rien refuse.
 */
export function setGenerationRejection(
  state: GenerationState,
  reason: RejectionReason | null | undefined
): GenerationState {
  // `undefined` ne peut pas survivre au typage : un `GenerationOutcome`
  // construit ailleurs, ou sur un brouillon enregistre avant ce champ,
  // ne doit pas laisser un trou qui se lirait comme une absence de donnee
  // alors qu il s agit d une absence de champ.
  const suivant = reason ?? null;
  return state.rejectedReason === suivant ? state : { ...state, rejectedReason: suivant };
}

export function finishGeneration(state: GenerationState): GenerationState {
  return {
    ...state,
    status: 'termine',
    error: null,
    phases: state.phases.map((phase) => ({ ...phase, done: true })),
  };
}
