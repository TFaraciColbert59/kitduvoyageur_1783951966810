import { z } from 'zod';
import {
  ConfidenceLevelEnum,
  LayerIdEnum,
  ProvenanceTypeEnum,
  TripBriefSchema,
} from './autoGen.schema';

/** Version du pipeline de la commande Phase 3 (traçabilité metadata/événements). */
export const AUTOGEN_TRIP_PIPELINE_VERSION = 'phase3-autogen-v1';

/**
 * Phase 3 — Entrée stricte de la commande `createTripFromAutogenIntent`.
 *
 * Le client envoie le brief original, les 12 couches déterministes et les
 * verrous éventuels ; le serveur re-valide tout (jamais de confiance implicite)
 * et borne le payload persistable. `layers` est volontairement réduit aux
 * champs utiles : les `alternatives` (récursives) ne sont pas persistées.
 */

export const autogenConstraintSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(['hard', 'soft']),
  label: z.string().min(1).max(200),
  value: z.unknown(),
  locked: z.boolean(),
  source: z.enum(['user', 'system', 'safety']),
});

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const autogenProposalLayerSchema = z.object({
  id: z.string().min(1).max(200),
  layer: LayerIdEnum,
  slotId: z.string().min(1).max(200),
  value: z.unknown(),
  provenance: z.object({
    source: ProvenanceTypeEnum,
    sourceRef: z.string().max(500).optional(),
    observedAt: z.string().max(100).optional(),
  }),
  confidence: ConfidenceLevelEnum,
  verifyUrl: z.string().max(2000).optional(),
  rationale: z.string().max(3000),
  tradeoffs: z.array(z.string().max(1000)).max(20).optional(),
  locked: z.boolean().default(false),
  editedByUser: z.boolean().default(false),
  impacts: z.array(z.string().max(1000)).max(50).default([]),
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

export const createTripFromAutogenIntentSchema = z.object({
  /** Brief original tel que saisi par l'utilisateur (jamais tronqué en base). */
  rawInput: z
    .string()
    .trim()
    .min(10, 'Le brief doit contenir au moins 10 caractères')
    .max(4000, 'Le brief ne peut pas dépasser 4000 caractères'),
  brief: TripBriefSchema.nullish(),
  /**
   * Couches présentes parmi les 12 déterministes (record partiel : toutes les
   * couches ne sont pas toujours produites par le blueprint).
   */
  layers: z.partialRecord(LayerIdEnum, autogenProposalLayerSchema).optional(),
  /** Verrous utilisateur (dates, budget, région…) propagés à la génération. */
  locks: z.array(autogenConstraintSchema).max(50).default([]),
  /** Point unique (météo) ou polyline ≥ 2 points (ETA réelle). */
  coordinates: z
    .union([coordinateSchema, z.array(coordinateSchema).min(1).max(5000)])
    .optional(),
  startDate: isoDateSchema.nullish(),
  endDate: isoDateSchema.nullish(),
  title: z.string().trim().min(3).max(120).optional(),
  /** Corrélation de chaîne : fournie ⇒ idempotence/reprise garanties. */
  correlationId: z.string().uuid('correlationId doit être un UUID').optional(),
  /** Clé d'idempotence du registre de génération (défaut : corrélation). */
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  /** Sélection automatique du meilleur parcours réel (défaut true). */
  autoSelectRoute: z.boolean().default(true),
});

export type CreateTripFromAutogenIntentInput = z.input<
  typeof createTripFromAutogenIntentSchema
>;
export type CreateTripFromAutogenIntentParsed = z.output<
  typeof createTripFromAutogenIntentSchema
>;
