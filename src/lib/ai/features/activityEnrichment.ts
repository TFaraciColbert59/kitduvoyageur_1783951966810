import { z } from 'zod';
import {
  buildTrailRawInput,
  isWithinCorridor,
  type TrailInput,
  type TrailMetaInput,
  type TrailPoint,
} from '@/features/trips/domain/trailToActivity';

/**
 * Feature « activity-enrichment » — enrichissement LLM d'une activité préparée
 * depuis un sentier réel (« Préparer », Chantier 3).
 *
 * tier heavy (raisonnement sur l'itinéraire complet), cache NUL : le contexte
 * est unique par activité (sentier + POI + couches) — jamais de partage entre
 * utilisateurs. Traitée ASYNCHRONEMENT via ai_jobs + cron.
 *
 * Règle dure : aucune donnée inventée. Le sanitizer valide le schéma complet,
 * filtre tout point hors corridor réel de 3 km et tronque les tableaux aux
 * bornes du produit (jamais de rejet global d'un lot partiellement invalide).
 */

export const ACTIVITY_ENRICHMENT_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 8000,
  cacheTtlSeconds: 0, // contexte unique par activité — aucun partage possible
  // Plus strict que la garde tier (20 heavy/jour) : un run = un itinéraire complet.
  maxPerUserPerDay: 10,
};

/** Bornes produit appliquées par le sanitizer (troncature, jamais d'échec). */
export const MAX_ENRICHMENT_DAYS = 14;
export const MAX_ENRICHMENT_STEPS_PER_DAY = 8;
export const MAX_ENRICHMENT_SUGGESTIONS = 12;
export const MAX_ENRICHMENT_KIT_ADDITIONS = 12;
export const MAX_ENRICHMENT_CHECKLIST_ADDITIONS = 12;

/**
 * Bornes larges du schéma : elles protègent des sorties aberrantes, mais
 * restent au-dessus des bornes produit pour que le sanitizer tronque au lieu
 * de rejeter un lot légèrement trop long.
 */
const SCHEMA_MAX_DAYS = 60;
const SCHEMA_MAX_STEPS_PER_DAY = 24;
const SCHEMA_MAX_ADDITIONS = 40;
const SCHEMA_MAX_MOMENTS = 20;

/** Payload d'un job « activity-enrichment » (miroir de `enqueue.ts`). */
export const activityEnrichmentJobSchema = z.object({
  tripId: z.string().uuid(),
});

export type ActivityEnrichmentJobPayload = z.output<typeof activityEnrichmentJobSchema>;

export const suggestionCategoryEnum = z.enum([
  'flight',
  'hotel',
  'activity',
  'insurance',
  'esim',
]);

const enrichmentStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  /** Réparé en `null` par le sanitizer si hors format `HH:MM`. */
  startTime: z.string().trim().max(20).nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  distanceKm: z.number().min(0).max(500).nullable(),
  transportMode: z.string().trim().max(100).nullable(),
  accommodation: z.string().trim().max(200).nullable(),
});

const enrichmentDaySchema = z.object({
  day: z.number().int().min(1).max(SCHEMA_MAX_DAYS),
  title: z.string().trim().min(1).max(200),
  steps: z.array(enrichmentStepSchema).max(SCHEMA_MAX_STEPS_PER_DAY),
  moments: z.object({
    matin: z.array(z.string().trim().min(1).max(300)).max(SCHEMA_MAX_MOMENTS),
    apresMidi: z.array(z.string().trim().min(1).max(300)).max(SCHEMA_MAX_MOMENTS),
    soir: z.array(z.string().trim().min(1).max(300)).max(SCHEMA_MAX_MOMENTS),
  }),
});

export const activityEnrichmentOutputSchema = z.object({
  days: z.array(enrichmentDaySchema).max(SCHEMA_MAX_DAYS),
  suggestions: z
    .array(
      z.object({
        category: suggestionCategoryEnum,
        label: z.string().trim().min(1).max(200),
        /** Intention de recherche uniquement — jamais un nom d'établissement ni un prix. */
        searchTerms: z.string().trim().min(1).max(120),
      })
    )
    .max(SCHEMA_MAX_ADDITIONS),
  kitAdditions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        reason: z.string().trim().min(1).max(1000),
        category: z.string().trim().min(1).max(100),
      })
    )
    .max(SCHEMA_MAX_ADDITIONS),
  checklistAdditions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        dueOffsetDays: z.number().int().min(0).max(365),
      })
    )
    .max(SCHEMA_MAX_ADDITIONS),
});

export type ActivityEnrichmentOutput = z.output<typeof activityEnrichmentOutputSchema>;

const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Horodatage `HH:MM` valide conservé, tout le reste (dont `null`) → `null`. */
function sanitizeStartTime(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return START_TIME_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Valide la sortie LLM contre le schéma complet, puis filtre et borne :
 * - steps hors corridor réel de 3 km supprimés (les autres conservés ;
 *   polyline vide → aucun point vérifiable → tous les steps filtrés) ;
 * - `startTime` hors `HH:MM` réparé en `null` ;
 * - troncature : days ≤ 14, steps/jour ≤ 8, additions ≤ 12.
 * Un JSON hors schéma lève (aucune réparation silencieuse).
 */
export function sanitizeEnrichmentOutput(
  raw: unknown,
  polyline: { lat: number; lng: number }[]
): ActivityEnrichmentOutput {
  const parsed = activityEnrichmentOutputSchema.parse(raw);

  const days = parsed.days.slice(0, MAX_ENRICHMENT_DAYS).map((day) => ({
    ...day,
    steps: day.steps
      .filter((step) => isWithinCorridor({ lat: step.lat, lng: step.lng }, polyline))
      .slice(0, MAX_ENRICHMENT_STEPS_PER_DAY)
      .map((step) => ({ ...step, startTime: sanitizeStartTime(step.startTime) })),
  }));

  return {
    days,
    suggestions: parsed.suggestions.slice(0, MAX_ENRICHMENT_SUGGESTIONS),
    kitAdditions: parsed.kitAdditions.slice(0, MAX_ENRICHMENT_KIT_ADDITIONS),
    checklistAdditions: parsed.checklistAdditions.slice(0, MAX_ENRICHMENT_CHECKLIST_ADDITIONS),
  };
}

/** POI réel du vivier fourni au prompt (issu de `trail_pois`, corridor ≤ 750 m). */
export interface ActivityEnrichmentPoi {
  name: string;
  category?: string | null;
  lat: number;
  lng: number;
}

/** Couche blueprint minimale lue (compatible `PreparationLayers`). */
export interface ActivityEnrichmentLayer {
  value?: unknown;
}

export interface ActivityEnrichmentPromptContext {
  trail: TrailInput;
  meta?: TrailMetaInput | null;
  /** Tracé réel échantillonné (Task 2) — jamais un itinéraire inventé. */
  polyline: TrailPoint[];
  pois?: ActivityEnrichmentPoi[] | null;
  /** Couches blueprint réelles (transport / hébergement / food) fournies par l'appelant. */
  layers?: Record<string, ActivityEnrichmentLayer | undefined> | null;
}

/** Budget du prompt : au-delà, échantillonnage régulier des points réels. */
const MAX_PROMPT_POLYLINE_POINTS = 60;
const MAX_PROMPT_POIS = 60;
const MAX_LAYER_SUMMARY_LENGTH = 400;

/** Jamais de prix dans le prompt : le contrat suggestions = intentions de recherche. */
const PRICE_KEY_PATTERN = /price|cost|amount|budget|eur|tarif|prix/i;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function samplePoints(points: TrailPoint[], maxPoints: number): TrailPoint[] {
  if (points.length <= maxPoints) return points;
  if (maxPoints <= 1) return points.slice(0, 1);
  const lastIndex = points.length - 1;
  return Array.from({ length: maxPoints }, (_, index) =>
    points[Math.round((index * lastIndex) / (maxPoints - 1))]
  );
}

function formatPoint(point: TrailPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function formatPoi(poi: ActivityEnrichmentPoi): string {
  const category =
    typeof poi.category === 'string' && poi.category.trim() !== ''
      ? ` (${poi.category.trim()})`
      : '';
  return `- ${poi.name.trim()}${category} — ${formatPoint(poi)}`;
}

/**
 * Résumé textuel borné d'une valeur de couche réelle. Les clés de prix sont
 * écartées (aucun prix ne doit entrer dans le contrat d'enrichissement).
 */
function summarizeLayerValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : truncate(trimmed, MAX_LAYER_SUMMARY_LENGTH);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const parts: string[] = [];
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (PRICE_KEY_PATTERN.test(key)) continue;
    if (entry === null || entry === undefined) continue;
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed !== '') parts.push(`${key}: ${trimmed}`);
    } else if (typeof entry === 'number' || typeof entry === 'boolean') {
      parts.push(`${key}: ${String(entry)}`);
    }
  }
  return parts.length > 0 ? truncate(parts.join('; '), MAX_LAYER_SUMMARY_LENGTH) : null;
}

function firstLayerSummary(
  layers: Record<string, ActivityEnrichmentLayer | undefined> | null | undefined,
  ids: readonly string[]
): string {
  for (const id of ids) {
    const summary = summarizeLayerValue(layers?.[id]?.value);
    if (summary !== null) return summary;
  }
  return 'non fourni';
}

const LAYER_SECTIONS: { label: string; ids: readonly string[] }[] = [
  { label: 'Transport', ids: ['major_transport', 'local_transport'] },
  { label: 'Hébergement', ids: ['accommodations'] },
  { label: 'Nourriture & eau', ids: ['food_water'] },
];

const OUTPUT_CONTRACT = `{
  "days": [
    {
      "day": 1,
      "title": "titre du jour",
      "steps": [
        {
          "title": "titre de l'étape",
          "description": "description factuelle",
          "startTime": "HH:MM ou null",
          "lat": 45.9,
          "lng": 6.86,
          "distanceKm": 12.5,
          "transportMode": "mode ou null",
          "accommodation": "hébergement réel du contexte ou null"
        }
      ],
      "moments": { "matin": ["..."], "apresMidi": ["..."], "soir": ["..."] }
    }
  ],
  "suggestions": [
    { "category": "flight|hotel|activity|insurance|esim", "label": "...", "searchTerms": "..." }
  ],
  "kitAdditions": [{ "name": "...", "reason": "...", "category": "..." }],
  "checklistAdditions": [{ "label": "...", "dueOffsetDays": 14 }]
}`;

const CONSIGNES = `Consignes impératives :
1. N'invente AUCUNE donnée : chaque jour, étape, moment, suggestion, ajout kit ou checklist doit découler du contexte réel ci-dessus.
2. Chaque coordonnée (lat, lng) doit être située à 3 km maximum du tracé réel fourni. Aucun point hors corridor.
3. Horaires au format HH:MM sur 24 h (ex. 08:30) ; si l'horaire est inconnu, mets null.
4. Les suggestions sont des INTENTIONS DE RECHERCHE : jamais de nom d'établissement précis, jamais de prix. "searchTerms" est une requête courte (120 caractères maximum).
5. Réponds uniquement par le JSON, en français, sans markdown ni commentaire.
6. Bornes : au plus 14 jours, 8 étapes par jour, 12 suggestions, 12 ajouts kit, 12 ajouts checklist.`;

/**
 * Prompt français strict, injecté uniquement avec des données réelles :
 * sentier (nom/ref/distance/durée/difficulté…), tracé échantillonné, POI réels
 * et couches blueprint transport/hébergement/food fournies par l'appelant.
 */
export function buildActivityEnrichmentPrompt(context: ActivityEnrichmentPromptContext): {
  system: string;
  prompt: string;
} {
  const system =
    "Tu es l'assistant de préparation d'itinéraires de LKDV (Le Kit du Voyageur). " +
    'Tu écris en français et tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour, ' +
    "sans markdown et sans commentaire. Tu n'inventes jamais un fait et tu ne présentes une " +
    'information que si elle figure dans le contexte réel fourni.';

  const polylineLines =
    context.polyline.length > 0
      ? samplePoints(context.polyline, MAX_PROMPT_POLYLINE_POINTS)
          .map((point) => `- ${formatPoint(point)}`)
          .join('\n')
      : '- tracé non fourni';

  const pois = (context.pois ?? []).slice(0, MAX_PROMPT_POIS);
  const poiLines =
    pois.length > 0 ? pois.map((poi) => formatPoi(poi)).join('\n') : '- aucun POI réel disponible';

  const layerLines = LAYER_SECTIONS.map(
    (section) => `- ${section.label} : ${firstLayerSummary(context.layers, section.ids)}`
  ).join('\n');

  const prompt = `Prépare l'enrichissement d'une activité de randonnée à partir de ces données réelles.

## Sentier réel
${buildTrailRawInput(context.trail, context.meta ?? null)}

## Tracé réel échantillonné (lat, lng)
${polylineLines}

## POI réels à moins de 3 km du tracé
${poiLines}

## Couches de préparation réelles (blueprint)
${layerLines}

## Format de sortie attendu (JSON strict)
${OUTPUT_CONTRACT}

${CONSIGNES}`;

  return { system, prompt };
}
