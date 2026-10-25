/**
 * A8 — Entitlements, plans et passes (domaine pur).
 *
 * Source de vérité unique du paywall : un plan donne un ensemble
 * d'entitlements, un passe actif en ajoute pour une durée limitée.
 * Un entitlement inconnu ne donne **jamais** accès, et `requiredPlanFor`
 * reste cohérent avec `PLAN_ENTITLEMENTS` (premier plan de la hiérarchie
 * qui le débloque).
 */

export const PLANS = ['free', 'explorer', 'expedition', 'group'] as const;
export type PlanId = (typeof PLANS)[number];

export const PASSES = ['weekend', 'trip', 'expedition'] as const;
export type PassId = (typeof PASSES)[number];

export const ENTITLEMENTS = [
  'full_generation',
  'offline',
  'advanced_profile',
  'live_eta',
  'history',
  'terrain_live_advanced',
  'group',
  'trek',
  'monitoring',
] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Entitlements permanents par plan (hiérarchie croissante, sans fuite). */
export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlement[]> = {
  free: [],
  explorer: ['full_generation', 'advanced_profile', 'history'],
  expedition: [
    'full_generation',
    'offline',
    'advanced_profile',
    'live_eta',
    'history',
    'terrain_live_advanced',
    'trek',
  ],
  group: [
    'full_generation',
    'offline',
    'advanced_profile',
    'live_eta',
    'history',
    'terrain_live_advanced',
    'group',
    'trek',
    'monitoring',
  ],
};

/** Entitlements temporaires apportés par chaque passe. */
export const PASS_ENTITLEMENTS: Record<PassId, Entitlement[]> = {
  weekend: ['full_generation', 'offline'],
  trip: ['full_generation', 'live_eta'],
  expedition: ['full_generation', 'live_eta', 'trek', 'monitoring'],
};

/**
 * Vrai si le plan débloque l'entitlement. Un entitlement (ou un plan)
 * inconnu ne donne jamais accès.
 */
export function hasEntitlement(plan: PlanId, entitlement: Entitlement): boolean {
  const entitlements: Entitlement[] | undefined = PLAN_ENTITLEMENTS[plan];
  if (!entitlements) return false;
  return (entitlements as readonly string[]).includes(entitlement);
}

/**
 * Premier plan de la hiérarchie qui débloque l'entitlement. Un entitlement
 * inconnu retombe sur le plan le plus élevé (`group`), qui ne le débloque
 * pas non plus : il ne peut donc jamais être accordé par erreur.
 */
export function requiredPlanFor(entitlement: Entitlement): PlanId {
  for (const plan of PLANS) {
    if (hasEntitlement(plan, entitlement)) return plan;
  }
  return PLANS[PLANS.length - 1];
}

/**
 * Entitlements effectifs = plan + passes actifs, dédupliqués et ordonnés
 * selon le catalogue canonique. Les passes inconnus sont ignorés.
 */
export function effectiveEntitlements(input: {
  plan: PlanId;
  activePasses: PassId[];
}): Entitlement[] {
  const granted = new Set<Entitlement>();

  for (const entitlement of PLAN_ENTITLEMENTS[input.plan] ?? []) {
    granted.add(entitlement);
  }

  for (const pass of input.activePasses) {
    const passEntitlements: Entitlement[] | undefined = PASS_ENTITLEMENTS[pass];
    if (!passEntitlements) continue;
    for (const entitlement of passEntitlements) {
      granted.add(entitlement);
    }
  }

  return ENTITLEMENTS.filter((entitlement) => granted.has(entitlement));
}
