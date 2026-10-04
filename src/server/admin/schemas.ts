import { z } from 'zod';

/** Schémas d'entrée stricts des APIs `/api/admin/*`. Refus = 400, jamais de coercition silencieuse. */

export const adminRoleNameSchema = z.enum(['super_admin', 'admin', 'moderateur']);

export const roleGrantSchema = z.object({
  role: adminRoleNameSchema,
  /** ISO 8601 futur optionnel ; absent = sans expiration. */
  expires_at: z.string().datetime({ offset: true }).optional(),
});

export const roleRevokeSchema = z.object({
  role: adminRoleNameSchema,
});

/** Identifiant période récompenses : TEXT 'YYYY-MM' (reward_periods.id). */
export const periodIdSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'période attendue au format AAAA-MM');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).default(''),
});

export const auditQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(120).optional(),
  target_table: z.string().trim().max(63).optional(),
  actor_id: z.string().uuid().optional(),
});

const baseAdminActionSchema = z.object({
  action: z.string().min(1).max(64),
});

/** Actions legacy `/api/admin/rewards` — validées strictement (remplace les `if (!x)` manuels). */
export const rewardsActionSchema = z.discriminatedUnion('action', [
  baseAdminActionSchema.extend({
    action: z.literal('finalize_period'),
    period_id: periodIdSchema,
    eligible_revenue: z.number().finite().min(0),
  }),
  baseAdminActionSchema.extend({
    action: z.literal('process_withdrawal'),
    withdrawal_id: z.string().uuid(),
    approve: z.boolean(),
    reference: z.string().max(255).nullable().default(null),
    reason: z.string().max(1024).nullable().default(null),
  }),
  baseAdminActionSchema.extend({
    action: z.literal('process_contribution'),
    contribution_id: z.string().uuid(),
    approve: z.boolean(),
    reason: z.string().max(1024).nullable().default(null),
  }),
  baseAdminActionSchema.extend({
    action: z.literal('update_config'),
    key: z.string().min(1).max(120),
    value: z.unknown(),
    description: z.string().max(1024).nullable().default(null),
  }),
]);

export type RewardsAction = z.infer<typeof rewardsActionSchema>;
