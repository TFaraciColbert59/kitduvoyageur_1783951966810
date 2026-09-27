import { askAI } from '@/lib/ai/askAI';
import {
  buildItineraryPrompt,
  itineraryOutputSchema,
  ITINERARY_SPEC,
  sanitizeStartTime,
  type ItineraryOutput,
} from '@/lib/ai/features/itinerary';
import { activityById } from '../catalog';
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

function toDrafted(output: ItineraryOutput, days: number): DraftedItinerary {
  const steps: DraftedStep[] = output.steps
    .filter((step) => step.day >= 1 && step.day <= days)
    .map((step) => ({
      day: step.day,
      kind: step.kind,
      title: step.title,
      placeName: step.placeName,
      startTime: sanitizeStartTime(step.startTime),
      durationMin: step.durationMin,
      reason: step.reason,
      lat: step.lat,
      lon: step.lon,
    }));
  return { days, steps, hypotheses: output.hypotheses };
}

/**
 * Demande une proposition au modele et la valide au mieux.
 *
 * `null` couvre trois situations indistinguables pour l'appelant — quota
 * epuise, provider tombe, reponse illisible — et c'est volontaire : peu importe
 * la cause, la seule reponse correcte est le repli regles. Distinguer les
 * cas servirait a afficher une erreur technique a l'utilisateur.
 */
export const requestDraftedItinerary: ProposalFetcher = async (draft, signal) => {
  const origin = draft.route.origin;
  if (!origin) return null;
  const days = Math.max(1, Math.trunc(draft.calendar.durationDays ?? 1));
  const activity = activityById(draft.activities.primary ?? '');

  const { system, prompt } = buildItineraryPrompt({
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
  });

  const response = await askAI({
    feature: 'itinerary',
    tier: ITINERARY_SPEC.tier,
    system,
    prompt,
    maxTokens: MAX_TOKENS,
    cacheTtlSeconds: 0,
  });

  if (signal.aborted) return null;
  // Le fallback du registre renvoie un JSON vide : c'est le signal fiable que
  // l'appel n'a pas abouti, sans avoir a deviner depuis le contenu.
  if (response.degraded || response.provider === 'fallback') return null;

  const parsed = itineraryOutputSchema.safeParse(extractJsonObject(response.text));
  if (!parsed.success) return null;

  const drafted = toDrafted(parsed.data, days);
  return drafted.steps.length > 0 ? drafted : null;
};

/**
 * Le moteur complet, pour un appel serveur direct (tests de bout en bout,
 * usages hors navigateur). L'ecran, lui, utilise `runItineraryGeneration` avec
 * une Server Action comme `ProposalFetcher`.
 */
export const aiItineraryEngine: ItineraryEngine = {
  id: 'ai',
  async generate(draft, signal) {
    const drafted = await requestDraftedItinerary(draft, signal);
    if (!drafted) return rulesItineraryEngine.generate(draft, signal);
    const verdict = validateDrafted(drafted);
    if (!verdict.ok) return rulesItineraryEngine.generate(draft, signal);
    return assembleModel(draft, drafted, buildSteps(drafted));
  },
};

export { runItineraryGeneration };
