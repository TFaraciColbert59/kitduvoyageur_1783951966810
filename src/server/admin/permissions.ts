import 'server-only';

/**
 * Registre canonique des permissions Admin OS — SERVEUR UNIQUEMENT.
 * Format `domain.resource.action` + tier de risque 0-4.
 * Source de vérité applicative : `public.permissions(code)` en base.
 * Ce registre documente les clés attendues et leurs contrôles ;
 * l'autorisation réelle est évaluée côté serveur via `has_permission(code)`.
 */

export type RiskTier = 0 | 1 | 2 | 3 | 4;

export interface PermissionDef {
  resource: string;
  action: string;
  tier: RiskTier;
  requiresApproval: boolean;
}

export const PERMISSION_REGISTRY: Record<string, PermissionDef> = {
  'admin.access': { resource: 'admin', action: 'access', tier: 0, requiresApproval: false },
  'users.profile.read': { resource: 'users.profile', action: 'read', tier: 0, requiresApproval: false },
  'users.pii.reveal': { resource: 'users.pii', action: 'reveal', tier: 2, requiresApproval: false },
  'users.read': { resource: 'users', action: 'read', tier: 0, requiresApproval: false },
  'users.write': { resource: 'users', action: 'write', tier: 2, requiresApproval: false },
  'support.ticket.assign': { resource: 'support.ticket', action: 'assign', tier: 1, requiresApproval: false },
  'commerce.refund.request': { resource: 'commerce.refund', action: 'request', tier: 3, requiresApproval: false },
  'commerce.refund.approve': { resource: 'commerce.refund', action: 'approve', tier: 4, requiresApproval: true },
  'marketplace.listing.restrict': {
    resource: 'marketplace.listing',
    action: 'restrict',
    tier: 3,
    requiresApproval: false,
  },
  'trust.case.decide': { resource: 'trust.case', action: 'decide', tier: 3, requiresApproval: true },
  'features.flag.update': { resource: 'features.flag', action: 'update', tier: 3, requiresApproval: false },
  'ai.prompt.promote': { resource: 'ai.prompt', action: 'promote', tier: 3, requiresApproval: true },
  'ops.job.retry': { resource: 'ops.job', action: 'retry', tier: 2, requiresApproval: false },
  // Canonique octroi de rôles : `roles.grant` (utilisé par routes + policies RLS).
  // `security.role.grant` déprécié (doublon) — ne pas réintroduire.
  'roles.grant': { resource: 'roles', action: 'grant', tier: 4, requiresApproval: true },
  'audit.export.create': { resource: 'audit.export', action: 'create', tier: 3, requiresApproval: false },
  'access.elevate': { resource: 'access', action: 'elevate', tier: 3, requiresApproval: false },
  'audit.read': { resource: 'audit', action: 'read', tier: 0, requiresApproval: false },
  'products.read': { resource: 'products', action: 'read', tier: 0, requiresApproval: false },
  'products.write': { resource: 'products', action: 'write', tier: 2, requiresApproval: false },
  'orders.read': { resource: 'orders', action: 'read', tier: 0, requiresApproval: false },
  'orders.write': { resource: 'orders', action: 'write', tier: 2, requiresApproval: false },
  'moderation.read': { resource: 'moderation', action: 'read', tier: 0, requiresApproval: false },
  'moderation.write': { resource: 'moderation', action: 'write', tier: 2, requiresApproval: false },
  'trips.read': { resource: 'trips', action: 'read', tier: 0, requiresApproval: false },
  'geo.read': { resource: 'geo', action: 'read', tier: 0, requiresApproval: false },
  'countries.read': { resource: 'countries', action: 'read', tier: 0, requiresApproval: false },
  'rewards.read': { resource: 'rewards', action: 'read', tier: 0, requiresApproval: false },
  'rewards.write': { resource: 'rewards', action: 'write', tier: 3, requiresApproval: false },
  'config.write': { resource: 'config', action: 'write', tier: 3, requiresApproval: false },
};

export function requiresApproval(code: string): boolean {
  return PERMISSION_REGISTRY[code]?.requiresApproval === true;
}

export function riskTierOf(code: string): RiskTier {
  return PERMISSION_REGISTRY[code]?.tier ?? 2;
}
