import { metricsContextFor } from '../catalog';
import { buildContingencies } from './resilience';
import { renumberByDay } from './itinerary';
import { rulesItineraryEngine } from './itineraryEngine';
import {
  materializeSteps,
  validateDrafted,
  type DraftedItinerary,
  type RejectionReason,
} from './itineraryEngine';
import type {
  AdventurePrepDraft,
  GenerationPhaseId,
  ItineraryModel,
  ItineraryStep,
} from '../types';

/**
 * Les quatre phases de la generation, en pur.
 *
 * Ce module ne fait AUCUN appel reseau et n'importe aucun module serveur-only :
 * il peut donc tourner dans le navigateur. C'est ce qui permet au rail de
 * cocher chaque phase APRES son propre travail, au lieu d'animer un minuteur.
 *
 * La seule phase qui sort du navigateur est la premiere, et elle est injectee
 * sous forme de fonction. En hors-ligne, on lui passe simplement une fonction
 * qui renvoie `null` : le repli regles s'enchaine sans aucune branche speciale.
 */

/** Recuperation de la proposition. `null` = indisponible, on bascule sur les regles. */
export type ProposalFetcher = (
  draft: AdventurePrepDraft,
  signal: AbortSignal,
) => Promise<DraftedItinerary | null>;

export const AI_ENRICHMENT_UNAVAILABLE =
  "Parcours construit sur tes critères — l’enrichissement est indisponible.";

export const AI_ACCEPTED =
  'Parcours enrichi par l’IA, puis vérifié : les prix et les disponibilités restent à confirmer.';

export interface GenerationOutcome {
  model: ItineraryModel | null;
  engineId: 'rules' | 'ai';
  /** `true` quand le parcours vient des regles et non du modele. */
  degraded: boolean;
  /** Phrase a afficher telle quelle. `null` quand rien n'a degrade. */
  message: string | null;
  rejectedReason: RejectionReason | null;
}

export type PhaseReporter = (phase: GenerationPhaseId) => void;

/* ------------------------------------------------------------------ */
/* Phase 1 — analyse de la reponse brute                               */
/* ------------------------------------------------------------------ */

/**
 * Extrait l'objet JSON d'une reponse qui peut etre entouree de prose ou d'un
 * bloc markdown. On echoue si on ne trouve pas exactement un objet : mieux
 * vaut aucun parcours qu'un parcours a moitie lu.
 */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  if (start === -1) return null;
  // Balayage a profondeur plutot que dernierIndexOf : un modele peut ecrire
  // une accolade DANS une chaine ("halle {d-epot}") et un simple
  // premier-dernier decouperait alors le JSON au mauvais endroit.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];
    if (escaped) {
      escaped = false;
    } else if (inString && char === '\\') {
      escaped = true;
    } else if (char === '"') {
      inString = !inString;
    } else if (!inString && char === '{') {
      depth += 1;
    } else if (!inString && char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) return null;
  // Un second objet colle juste apres le premier signale une sortie
  // tronquee ou dupliquee : on ne devine pas laquelle des deux vaut
  // la verite, on renvoie null et le repli regles prend le relais.
  const trailing = withoutFence.slice(end + 1).trimStart();
  if (trailing.startsWith('{')) return null;
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Phase 3 — Disponibilites : ce qui doit imperativement etre reserve   */
/* ------------------------------------------------------------------ */

/**
 * Toute nuit et tout transport demande une reservation : l'etat passe donc a
 * « a reserver ». Le reste reste une proposition. Aucune etape ne passe en
 * « confirme » ici — la confirmation vient de l'utilisateur ou de la
 * communaute, jamais du modele.
 */
export function annotateAvailability(steps: readonly ItineraryStep[]): ItineraryStep[] {
  return steps.map((step) => {
    const needsBooking = step.kind === 'nuit' || step.kind === 'trajet';
    const state = needsBooking ? ('a_reserver' as const) : ('propose' as const);
    return state === step.state ? step : { ...step, state };
  });
}

/* ------------------------------------------------------------------ */
/* Phase 4 — Assemblage                                                */
/* ------------------------------------------------------------------ */

const EMPTY_TOTALS = {
  distanceKm: null,
  movingMin: null,
  elevGainM: null,
  elevLossM: null,
} as const;

/** Etapes materialisees puis classees par ce qui doit etre reserve. */
export function buildSteps(drafted: DraftedItinerary): ItineraryStep[] {
  return annotateAvailability(materializeSteps(drafted, drafted.days));
}

/**
 * Assemblage final. Les etapes sont deja materialisees et annotees : cette
 * fonction ne fait que racorder le modele, les compteurs et les points de
 * repli. Aucune donnee n est ajoutee ici.
 */
export function assembleModel(
  draft: AdventurePrepDraft,
  drafted: DraftedItinerary,
  steps: readonly ItineraryStep[],
): ItineraryModel {
  const days = drafted.days;
  const model: ItineraryModel = {
    days,
    steps: renumberByDay([...steps]),
    totals: { ...EMPTY_TOTALS },
    perDay: Array.from({ length: days }, () => ({ ...EMPTY_TOTALS })),
    metricsContext: metricsContextFor(draft.activities),
    budgetPerPerson:
      draft.preferences.budgetPerPerson === null
        ? { amount: null, currency: 'EUR', state: 'a_reserver' }
        : {
            amount: draft.preferences.budgetPerPerson,
            currency: 'EUR',
            state: 'propose',
          },
    activityCount: 1 + draft.activities.extra.length,
    contingencies: [],
  };
  return { ...model, contingencies: buildContingencies(model) };
}

async function fallbackOutcome(
  draft: AdventurePrepDraft,
  signal: AbortSignal,
  reason: RejectionReason | null,
): Promise<GenerationOutcome> {
  const model = await rulesItineraryEngine.generate(draft, signal);
  return {
    model,
    engineId: 'rules',
    degraded: true,
    // Un brouillon incomplet n'est pas une degradation : il n'y a rien a
    // construire, et afficher un avertissement serait mentiraire.
    message: model ? AI_ENRICHMENT_UNAVAILABLE : null,
    rejectedReason: reason,
  };
}

/* ------------------------------------------------------------------ */
/* Pilote                                                              */
/* ------------------------------------------------------------------ */

/**
 * Enchaine les quatre phases en cochant chacune APRES son propre travail
 * acheve. C'est la difference entre une barre de progression honnete et une
 * animation : « Verification des etapes » n'est cochee que lorsque la
 * verification a reellement rendu la main, et une phase qui echoue n'est
 * jamais cochee du tout.
 */
export async function runItineraryGeneration(
  draft: AdventurePrepDraft,
  signal: AbortSignal,
  fetchProposal: ProposalFetcher,
  onPhase: PhaseReporter,
): Promise<GenerationOutcome> {
  // 1. Recherche du parcours — la seule phase reseau.
  onPhase('recherche_parcours');
  // Le proposeur est une frontiere reseau : il peut rejeter pour une raison
  // que l'utilisateur n'a pas a connaitre. Toute rejection est un « pas de
  // proposition », jamais une exception qui casserait l'ecran de preparation.
  let drafted: DraftedItinerary | null = null;
  try {
    drafted = await fetchProposal(draft, signal);
  } catch {
    drafted = null;
  }
  if (signal.aborted || drafted === null) {
    return fallbackOutcome(draft, signal, null);
  }

  // 2. Verification des etapes — invariants metier, sur les donnees reelles.
  onPhase('verification_etapes');
  const verdict = validateDrafted(drafted);
  if (!verdict.ok) return fallbackOutcome(draft, signal, verdict.reason);

  // 3. Disponibilites — classement de ce qui doit imperativement etre reserve.
  onPhase('disponibilites');
  const steps = buildSteps(drafted);

  // 4. Mise en forme — renumerotation, compteurs, points de repli.
  onPhase('synthese');
  return {
    model: assembleModel(draft, drafted, steps),
    engineId: 'ai',
    degraded: false,
    message: AI_ACCEPTED,
    rejectedReason: null,
  };
}
