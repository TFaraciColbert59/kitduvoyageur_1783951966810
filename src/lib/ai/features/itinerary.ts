import { z } from 'zod';
import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature "itinerary" - generation du parcours par le preparateur.
 *
 * tier `fast` : le Nemotron 3.5 Lightning est rapide (environ 2 s en
 * raisonnement desactive) et la tache est une composition structuree, pas un
 * raisonnement long. Le tier `heavy` serait ici du cout sans gain.
 *
 * cache 0 : le contexte est unique par brouillon (depart, arrivee, date,
 * participants). Deux utilisateurs qui preparent la meme sortie n'ont pas le
 * meme budget, le meme groupe ni les memes affinites - aucun partage.
 *
 * REGLE STRUCTURELLE : le schema de sortie ne contient AUCUN champ de prix.
 * Le modele ne peut donc pas produire de montant, meme sur instruction
 * contraire ou par hallucination : la confiance ne repose pas sur une
 * validation a posteriori, mais sur l'absence du champ. Les prix sont
 * rattaches ensuite par `AiItineraryEngine` depuis les seules sources
 * verifiees ; tout le reste reste "a verifier" (`MoneyValue.amount = null`).
 */

export const ITINERARY_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0, // raisonnement desactive : cf. nvidia.ts
  cacheTtlSeconds: 0,
  maxPerUserPerDay: 20,
};

export const MAX_ITINERARY_DAYS = 30;
export const MAX_ITINERARY_STEPS = 200;

export const itineraryStepKindSchema = z.enum([
  'trajet',
  'arret',
  'repos',
  'nuit',
  'ravitaillement',
]);

const OUT_STEP_SCHEMA = z.object({
  day: z.number().int().min(1).max(MAX_ITINERARY_DAYS),
  kind: itineraryStepKindSchema,
  title: z.string().trim().min(1).max(160),
  placeName: z.string().trim().max(160).nullable(),
  startTime: z.string().trim().max(8).nullable(),
  durationMin: z.number().int().min(0).max(1440).nullable(),
  reason: z.string().trim().max(240).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
});

export const itineraryOutputSchema = z.object({
  days: z.array(z.number().int().min(1).max(MAX_ITINERARY_DAYS)).max(MAX_ITINERARY_DAYS),
  steps: z.array(OUT_STEP_SCHEMA).max(MAX_ITINERARY_STEPS),
  hypotheses: z.array(z.string().trim().min(1).max(240)).max(12),
});

export type ItineraryOutput = z.output<typeof itineraryOutputSchema>;

const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Horodatage `HH:MM` conserve, tout le reste (y compris null) devient null. */
export function sanitizeStartTime(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return START_TIME_PATTERN.test(trimmed) ? trimmed : null;
}

const OUTPUT_CONTRACT = [
  '{',
  '  "days": [1, 2],',
  '  "steps": [',
  '    {',
  '      "day": 1,',
  '      "kind": "trajet|arret|repos|nuit|ravitaillement",',
  '      "title": "titre court de l etape",',
  '      "placeName": "lieu reellement connu ou null",',
  '      "startTime": "HH:MM ou null",',
  '      "durationMin": 90,',
  '      "reason": "pourquoi cette etape : proximite, confort, acces, ravitaillement",',
  '      "lat": 50.1,',
  '      "lon": 4.2',
  '    }',
  '  ],',
  '  "hypotheses": ["ce que tu as suppose et qui reste a confirmer"]',
  '}',
].join('\n');

const CONSIGNES = [
  'Consignes imperatives :',
  "1. N'invente AUCUN fait : un lieu, un horaire ou un point d'eau que le contexte ne mentionne pas ne doit pas apparaitre. En cas de doute, mets null.",
  '2. Tu ne fournis AUCUN prix, AUCUN tarif, AUCUNE disponibilite. Le schema ne contient volontairement aucun champ de prix : ne l invente pas dans un titre, une raison ou une hypothese.',
  '3. startTime au format HH:MM sur 24 h ; null si l heure est inconnue.',
  '4. reason explique le choix en une phrase courte et factuelle, jamais une publicite.',
  '5. Les coordonnees ne servent que si elles sont STRICTEMENT issues du contexte fourni ; sinon null.',
  '6. Reponds uniquement par le JSON, en francais, sans markdown ni commentaire.',
  '7. Bornes : au plus 30 jours, 12 etapes par jour, 200 etapes au total.',
].join('\n');

export interface ItineraryPromptInput {
  activityLabel: string;
  originLabel: string;
  destinationLabel: string;
  startDateLabel: string | null;
  durationDays: number;
  partySize: number;
  pace: string | null;
  loop: boolean;
  preferences: readonly string[];
  knownPlaces: readonly { name: string; lat: number | null; lon: number | null }[];
}

function listOr(value: readonly string[], fallback: string): string {
  return value.length > 0 ? value.map((entry) => `- ${entry}`).join('\n') : `- ${fallback}`;
}

/** Neutralise les sauts de ligne : le prompt est une seule ligne par champ. */
function sanitizeScalar(value: string | null, max: number): string {
  if (value === null) return 'inconnu';
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}...` : collapsed;
}

const SYSTEM_PROMPT = [
  'Tu es le moteur de preparation d aventures de LKDV (Le Kit du Voyageur).',
  'Tu ecris en francais et tu reponds UNIQUEMENT par un objet JSON valide,',
  'sans texte autour, sans markdown et sans commentaire.',
  "Tu n inventes jamais un fait, un lieu, un horaire ni un prix :",
  'une information absente du contexte reste null.',
].join(' ');

/**
 * Prompt construit EXCLUSIVEMENT a partir de donnees reelles du brouillon.
 * Aucune coordonnee, aucun horaire et aucun nom de lieu n est ajoute ici : ce
 * que le modele ne voit pas, il ne peut pas l inventer.
 */
export function buildItineraryPrompt(input: ItineraryPromptInput): {
  system: string;
  prompt: string;
} {
  const places =
    input.knownPlaces.length > 0
      ? input.knownPlaces
          .slice(0, 40)
          .map((place) => {
            const coords =
              place.lat != null && place.lon != null ? ` (${place.lat}, ${place.lon})` : '';
            return `- ${place.name}${coords}`;
          })
          .join('\n')
      : '- aucun lieu connu de l utilisateur';

  const prompt = [
    'Construis un parcours realiste pour cette aventure.',
    '',
    "## Ce que l'utilisateur a choisi",
    `- Activite : ${sanitizeScalar(input.activityLabel, 80)}`,
    `- Depart : ${sanitizeScalar(input.originLabel, 120)}`,
    `- Arrivee : ${sanitizeScalar(input.destinationLabel, 120)}`,
    `- Date : ${sanitizeScalar(input.startDateLabel, 40)}`,
    `- Duree : ${input.durationDays} jour(s)`,
    `- Participants : ${input.partySize}`,
    `- Rythme : ${sanitizeScalar(input.pace, 40)}`,
    `- Parcours en boucle : ${input.loop ? 'oui' : 'non'}`,
    '',
    '## Preferences exprimees',
    listOr(input.preferences, 'aucune preference particuliere'),
    '',
    '## Lieux reels connus (seule source de verite geographique)',
    places,
    '',
    '## Format de sortie attendu (JSON strict)',
    OUTPUT_CONTRACT,
    '',
    CONSIGNES,
  ].join('\n');

  return { system: SYSTEM_PROMPT, prompt };
}

/**
 * Fallback deterministe, JAMAIS un throw : `askAI` ne doit pas casser quand le
 * provider tombe. Le moteur de regles prend le relais - voir
 * `AiItineraryEngine` et `RulesItineraryEngine`.
 */
export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: JSON.stringify({ days: [], steps: [], hypotheses: [] }),
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
