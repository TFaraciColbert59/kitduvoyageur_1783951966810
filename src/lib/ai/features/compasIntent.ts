import { z } from 'zod';
import type { AIRequest, AIResponse } from '../providers/types';
import { intentActionSchema, type CompasIntentAction } from '@/features/compas/engine/intent';

/**
 * Feature « compas-intent » — le « Dis-le » du Compas.
 *
 * Le modèle TRADUIT une phrase en actions d'une liste fermée ; il ne décide de
 * rien. Chaque action repasse ensuite par le moteur (`engine/intent.ts`) :
 * ancrage dans la phrase, limites réelles, puis validation explicite de
 * l'utilisateur. Un repli sans IA (lecteur de règles) couvre l'essentiel.
 *
 * tier `fast`, raisonnement coupé : c'est de l'extraction, pas de la
 * réflexion. Cache 0 : la date du jour et le voyage font partie du contexte.
 */

export const COMPAS_INTENT_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0,
  cacheTtlSeconds: 0,
  maxPerUserPerDay: 60,
};

export const MAX_INTENT_CHARS = 280;

/** Sortie brute : les actions inconnues ou mal formées sont écartées une à une. */
export const compasIntentOutputSchema = z.object({ actions: z.array(z.unknown()).max(12) });

/**
 * L'objet JSON d'une réponse (tolère un bloc markdown ou de la prose). Quand
 * le modèle écrit plusieurs objets à la suite (une ligne par jour, observé
 * avec Nemotron 3.5 Lightning), ils sont fusionnés en un seul.
 */
export function extractIntentJson(text: string): unknown {
  const body = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  const objects: Record<string, unknown>[] = [];
  let from = body.indexOf('{');
  while (from !== -1) {
    const end = objectEnd(body, from);
    if (end === -1) break;
    try {
      const parsed = JSON.parse(body.slice(from, end + 1)) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        objects.push(parsed as Record<string, unknown>);
      }
    } catch {
      break;
    }
    // Seuls des objets séparés par des blancs ou des virgules se fusionnent.
    const rest = body.slice(end + 1);
    const next = rest.search(/\S/);
    if (next === -1 || !/^[\s,]*\{/.test(rest)) break;
    from = body.indexOf('{', end + 1);
  }
  if (!objects.length) return null;
  return objects.length === 1 ? objects[0] : Object.assign({}, ...objects);
}

/** Position de l'accolade fermante qui équilibre celle de `start`, ou -1. */
function objectEnd(body: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i += 1) {
    const c = body[i];
    if (escaped) escaped = false;
    else if (inString && c === '\\') escaped = true;
    else if (c === '"') inString = !inString;
    else if (!inString && c === '{') depth += 1;
    else if (!inString && c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseCompasIntentOutput(raw: unknown): CompasIntentAction[] {
  const parsed = compasIntentOutputSchema.safeParse(raw);
  if (!parsed.success) return [];
  const out: CompasIntentAction[] = [];
  for (const item of parsed.data.actions) {
    const action = intentActionSchema.safeParse(item);
    if (action.success) out.push(action.data);
  }
  return out;
}

const CONTRACT = [
  '{"actions": [',
  '  {"type": "set_dates", "start": "AAAA-MM-JJ", "end": "AAAA-MM-JJ ou null"},',
  '  {"type": "set_duration", "days": 3, "hours": null},',
  '  {"type": "set_party_size", "count": 4},',
  '  {"type": "set_budget", "amount": 300},',
  '  {"type": "set_pace", "pace": "tranquille | normal | soutenu"},',
  '  {"type": "set_nights", "nights": "bivouac | refuge | hebergement | mixte"},',
  '  {"type": "set_activity", "activity": "hiking | trekking | bivouac | roadtrip | cultural | bushcraft | cycling | ski | mountaineering | climbing | water | citytrip | beach | vanlife | running | trail | mixed"},',
  '  {"type": "set_outdoor_nights", "nights": 3},',
  '  {"type": "set_max_pack", "kg": 12},',
  '  {"type": "set_distance", "km": 20},',
  '  {"type": "set_level", "level": "debut | regulier | aguerri"},',
  '  {"type": "set_terrain", "terrain": "sentier | montagne | hors_sentier | itinerance | urbain_transit"},',
  '  {"type": "avoid", "label": "ce qu il faut eviter, 1 a 5 mots"},',
  '  {"type": "wish", "label": "une envie, 1 a 5 mots"},',
  '  {"type": "add_item", "name": "objet a ajouter au sac", "quantity": 1},',
  '  {"type": "search_route", "query": "nom de lieu ou de parcours"},',
  '  {"type": "set_destination", "place": "pays, region, massif ou ville ou l on part, tel qu ecrit dans la phrase"}',
  ']}',
].join('\n');

export function buildCompasIntentSystem(): string {
  return [
    'Tu traduis une phrase en actions pour preparer une sortie en montagne ou un voyage.',
    'Tu reponds UNIQUEMENT par un objet JSON, sans markdown ni commentaire, de cette forme :',
    CONTRACT,
    'Regles imperatives :',
    '1. N utilise que les types ci-dessus. Une idee qui ne rentre dans aucun type est ignoree.',
    '2. Chaque nombre (personnes, montant, jours, heures, quantite) doit figurer dans la phrase, en chiffres ou en lettres. Sinon, n ecris pas l action.',
    '3. Les dates sont absolues (AAAA-MM-JJ), calculees depuis la date du jour fournie. « samedi » = le prochain samedi.',
    '4. « 2 nuits » = 3 jours. « une semaine » = 7 jours. « ce week-end » = samedi, 2 jours.',
    '5. Ne mets jamais de prix, de disponibilite ni de lieu que la phrase ne nomme pas.',
    '6. « dormir dehors 3 nuits » ou « 3 nuits en bivouac » = set_outdoor_nights (ce n est PAS une duree). « sous 12 kg » = set_max_pack. « surtout de la montagne » = set_terrain montagne. « je debute » = set_level debut. « courir », « footing » = running.',
    '7. Phrase vide de demande : {"actions": []}.',
  ].join('\n');
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function buildCompasIntentPrompt(input: {
  text: string;
  today: string;
  startDate: string | null;
  days: number | null;
}): string {
  const wd = WEEKDAYS[new Date(`${input.today}T12:00:00Z`).getUTCDay()];
  return [
    `Date du jour : ${input.today} (${wd}).`,
    input.startDate
      ? `Depart actuel : ${input.startDate}, ${input.days ?? 1} jour(s).`
      : 'Depart actuel : non choisi.',
    `Phrase : « ${input.text.slice(0, MAX_INTENT_CHARS)} »`,
  ].join('\n');
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: JSON.stringify({ actions: [] }),
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
