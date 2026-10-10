import { z } from 'zod';

/** Schémas partagés pour l'Approval Engine. */

export const approvalDecisionSchema = z.enum(['approve', 'reject']);

export const requestApprovalSchema = z.object({
  command_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});

export const decideApprovalSchema = z.object({
  approval_id: z.string().uuid(),
  decision: approvalDecisionSchema,
  reason: z.string().min(10).max(2000),
});

export type DecideApprovalSchema = z.infer<typeof decideApprovalSchema>;
