import { z } from 'zod';
import { RouteOperationSchema } from './_schemas';

/**
 * Schémas zod de la catégorie « Équipe » (membres, présence, commentaires, propositions).
 * Mêmes conventions que `_schemas.ts` : objets stricts (une clé inconnue est refusée, pas ignorée),
 * longueurs et nombres bornés, enums fermés.
 */

const IdText = z.string().min(1).max(120);

export const MemberActionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('member'),
      targetUserId: IdText,
      displayName: z.string().max(120).optional(),
      role: z.enum(['owner', 'co_organizer', 'editor', 'contributor', 'participant', 'external_viewer']).optional(),
      delegatedPublish: z.boolean().optional(),
      revoke: z.boolean().optional(),
      // 8.3 : étapes confiées à ce membre ; `[]` retire la portée.
      stageScopeIds: z.array(IdText).max(200).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('share_link'),
      action: z.enum(['create', 'revoke']),
      expiresInHours: z.number().positive().max(720).optional(),
      // 200 m minimum : la zone de départ privée ne peut pas être désactivée (aligné sur la base).
      hidePrivateStartRadiusM: z.number().min(200).max(5000).optional(),
    })
    .strict(),
]);

export const PresenceSchema = z
  .object({
    activeStageId: z.string().max(80).nullable().optional(),
    selectedEntityId: z.string().max(80).nullable().optional(),
    softLockEntityId: z.string().max(80).nullable().optional(),
    mode: z.enum(['viewing', 'editing', 'reviewing']).default('viewing'),
  })
  .strict();

/** 8.7 : un commentaire s'ancre sur un point, un tronçon, un jour ou une position. */
export const AnchorSchema = z
  .object({
    anchorType: z.enum(['point', 'section', 'stage', 'position']),
    entityId: IdText,
    entityVersion: z.number().int().nonnegative(),
    fraction: z.number().min(0).max(1).optional(),
    originalLat: z.number().min(-90).max(90),
    originalLon: z.number().min(-180).max(180),
    maxRelocateMeters: z.number().positive().max(50_000).default(250),
  })
  .strict();

export const CommentSchema = z
  .object({
    body: z.string().trim().min(1).max(1000),
    anchor: AnchorSchema,
  })
  .strict();

export const RelocateSchema = z.object({ newAnchor: AnchorSchema }).strict();

export const ProposalSchema = z
  .object({
    title: z.string().min(2).max(160),
    rationale: z.string().max(500).default(''),
    // Chaque opération proposée est validée comme une opération directe (union discriminée).
    operations: z.array(RouteOperationSchema).min(1).max(50),
  })
  .strict();

export const VoteSchema = z.object({ vote: z.enum(['up', 'down']) }).strict();

export const DecideSchema = z
  .object({
    decision: z.enum(['accept', 'reject']),
    expectedHeadSeq: z.number().int().nonnegative().optional(),
  })
  .strict();
