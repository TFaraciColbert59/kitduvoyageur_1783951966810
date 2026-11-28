import { z } from 'zod';
import { resolveActivityProfile } from '../specs/resolveActivityProfile';
import type { ActivityCompletedPayload } from '../events/activityEventBus';
import {
  buildAiActivityInsightPayload,
  type AiInsightGuardResult,
} from '../events/consumers/physiologyXpAiConsumer';

/**
 * Lot 11 — Outil MCP Interne LKDV (`lkdv_get_activity_insight_summary`)
 * Expose un résumé d'activité strictement minimisé (< 450 tokens, 0 coordonnée GPS brute, 0 PII)
 * et bloque catégoriquement toute donnée RGPD Art. 9 (`rehab_physio_*`) ou `strava_api`.
 */
export const ACTIVITY_INSIGHT_MCP_TOOL_DEFINITION = {
  name: 'lkdv_get_activity_insight_summary',
  description:
    'Retourne un résumé physiologique et sportif anonymisé (< 450 tokens) pour le coach IA interne LKDV. Refuse systématiquement les activités RGPD Art. 9 et les imports Strava API.',
  inputSchema: {
    type: 'object',
    properties: {
      sportSlug: { type: 'string' },
      sourceOrigin: { type: 'string' },
      distanceM: { type: 'number', minimum: 0 },
      movingS: { type: 'number', minimum: 0 },
      elapsedS: { type: 'number', minimum: 0 },
      elevGainM: { type: 'number', minimum: 0 },
      elevLossM: { type: 'number', minimum: 0 },
      avgHrBpm: { type: ['number', 'null'] },
      rpe: { type: ['number', 'null'], minimum: 1, maximum: 10 },
      notes: { type: 'string' },
    },
    required: ['sportSlug', 'sourceOrigin', 'distanceM', 'movingS', 'elevGainM'],
  },
} as const;

const McpInputSchema = z.object({
  sportSlug: z.string().min(2),
  sourceOrigin: z.enum([
    'lkdv_native',
    'lkdv_web',
    'apple_healthkit',
    'garmin_fit',
    'suunto_fit',
    'coros_fit',
    'strava_api',
    'gpx_import',
    'manual',
  ]),
  distanceM: z.number().min(0),
  movingS: z.number().min(0),
  elapsedS: z.number().min(0).optional(),
  elevGainM: z.number().min(0),
  elevLossM: z.number().min(0).optional(),
  avgHrBpm: z.number().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().optional(),
});

export function executeActivityInsightMcpTool(rawInput: unknown): AiInsightGuardResult {
  const parsed = McpInputSchema.parse(rawInput);
  const profile = resolveActivityProfile(parsed.sportSlug);

  const completedPayload: ActivityCompletedPayload = {
    sportSlug: profile.identity.slugId,
    sourceOrigin: parsed.sourceOrigin,
    distanceM: parsed.distanceM,
    movingS: parsed.movingS,
    elapsedS: parsed.elapsedS ?? parsed.movingS,
    elevGainM: parsed.elevGainM,
    elevLossM: parsed.elevLossM ?? 0,
    avgHrBpm: parsed.avgHrBpm ?? null,
    rpe: parsed.rpe ?? null,
    gearIds: [],
    waypoints: [],
    photosCount: 0,
    title: profile.identity.labelFr,
    notes: parsed.notes,
  };

  return buildAiActivityInsightPayload(profile, completedPayload);
}
