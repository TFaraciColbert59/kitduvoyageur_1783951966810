import { z } from 'zod';

/** Schémas partagés client/serveur pour le Command Engine (inférés côté serveur). */

export const commandStatusSchema = z.enum([
  'drafted',
  'validated',
  'awaiting_approval',
  'approved',
  'executing',
  'succeeded',
  'partially_succeeded',
  'failed',
  'unknown',
  'cancelled',
  'rolled_back',
]);

export const createCommandSchema = z.object({
  command_key: z.string().min(1).max(120),
  resource_type: z.string().min(1).max(63),
  resource_id: z.string().min(1).max(255),
  reason: z.string().min(10).max(2000),
  ticket_id: z.string().max(120).optional(),
  risk_tier: z.number().int().min(0).max(4),
  idempotency_key: z.string().min(16).max(128),
  expected_version: z.number().int().nonnegative().optional(),
  environment: z.enum(['dev', 'staging', 'production']).default('production'),
});

export type CreateCommandSchema = z.infer<typeof createCommandSchema>;
