import type { AIFailureReason } from '@/lib/ai/providers/types';
import type {
  AdventurePrepDraft,
  GenerationPhase,
  GenerationPhaseId,
  GenerationState,
  ItineraryStep,
} from '../types';

/**
 * Les sept phases reellement executees, dans l'ordre. Elles decrivent un
 * travail reel, jamais une animation : aucune n'est cochee a la construction.
 *
 * `trace` et `meteo` mesurent ce que les regles ne peuvent pas inventer : le
 * Kilometrage vient d OSRM sur le reseau routier, la meteo d Open-Meteo sur
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
  return { status: 'idle', phases: phases(), steps: [], days: 0, error: null, notice: null, failure: null };
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
  return { status: 'en_cours', phases: phases(), steps: [], days: 0, error: null, notice: null, failure: null };
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
  days: number,
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
export function setGenerationNotice(state: GenerationState, notice: string | null): GenerationState {
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
  failure: AIFailureReason | null,
): GenerationState {
  return state.failure === failure ? state : { ...state, failure };
}

export function finishGeneration(state: GenerationState): GenerationState {
  return {
    ...state,
    status: 'termine',
    error: null,
    phases: state.phases.map((phase) => ({ ...phase, done: true })),
  };
}
