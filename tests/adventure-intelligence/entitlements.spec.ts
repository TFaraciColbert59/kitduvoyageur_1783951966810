import { describe, it, expect } from 'vitest';
import {
  ENTITLEMENTS,
  PASSES,
  PLAN_ENTITLEMENTS,
  PLANS,
  effectiveEntitlements,
  hasEntitlement,
  requiredPlanFor,
  type Entitlement,
  type PassId,
  type PlanId,
} from '@/features/adventure-intelligence/domain/entitlements';

describe('A8 — entitlements et passes (TEST-A8-ENT)', () => {
  it('TEST-A8-ENT-01: l’accès est gouverné par le plan, du gratuit au groupe', () => {
    expect(hasEntitlement('free', 'full_generation')).toBe(false);
    expect(hasEntitlement('explorer', 'full_generation')).toBe(true);
    expect(hasEntitlement('explorer', 'advanced_profile')).toBe(true);
    expect(hasEntitlement('explorer', 'group')).toBe(false);
    expect(hasEntitlement('expedition', 'live_eta')).toBe(true);
    expect(hasEntitlement('expedition', 'trek')).toBe(true);
    expect(hasEntitlement('expedition', 'group')).toBe(false);
    expect(hasEntitlement('group', 'group')).toBe(true);
    expect(hasEntitlement('group', 'monitoring')).toBe(true);
  });

  it('TEST-A8-ENT-02: les passes effectifs ajoutent leurs entitlements sans doublon', () => {
    const weekend = effectiveEntitlements({ plan: 'free', activePasses: ['weekend'] });
    expect(weekend).toContain('full_generation');
    expect(weekend).toContain('offline');
    expect(weekend).not.toContain('live_eta');

    const trip = effectiveEntitlements({ plan: 'free', activePasses: ['trip'] });
    expect(trip).toContain('full_generation');
    expect(trip).toContain('live_eta');
    expect(trip).not.toContain('trek');

    const expedition = effectiveEntitlements({ plan: 'free', activePasses: ['expedition'] });
    expect(expedition).toContain('trek');
    expect(expedition).toContain('monitoring');

    const stacked = effectiveEntitlements({
      plan: 'explorer',
      activePasses: ['weekend', 'trip'],
    });
    for (const entitlement of PLAN_ENTITLEMENTS.explorer) {
      expect(stacked).toContain(entitlement);
    }
    expect(new Set(stacked).size).toBe(stacked.length);

    for (const pass of PASSES) {
      const passEntitlements = effectiveEntitlements({ plan: 'free', activePasses: [pass] });
      for (const entitlement of passEntitlements) {
        expect(ENTITLEMENTS).toContain(entitlement);
      }
    }
  });

  it('TEST-A8-ENT-03: un entitlement inconnu ne donne jamais accès', () => {
    const unknown = 'entitlement_inexistant' as Entitlement;
    expect(hasEntitlement('group', unknown)).toBe(false);
    expect(hasEntitlement('expedition', unknown)).toBe(false);
    expect(hasEntitlement('unknown_plan' as PlanId, 'full_generation')).toBe(false);

    const effective = effectiveEntitlements({
      plan: 'group',
      activePasses: ['pass_inconnu' as PassId],
    });
    expect(effective).not.toContain(unknown);
    for (const entitlement of effective) {
      expect(ENTITLEMENTS).toContain(entitlement);
    }
  });

  it('TEST-A8-ENT-04: requiredPlanFor est cohérent avec PLAN_ENTITLEMENTS', () => {
    for (const entitlement of ENTITLEMENTS) {
      const plan = requiredPlanFor(entitlement);
      expect(PLANS).toContain(plan);
      expect(hasEntitlement(plan, entitlement)).toBe(true);

      const planIndex = PLANS.indexOf(plan);
      for (const lowerPlan of PLANS.slice(0, planIndex)) {
        expect(hasEntitlement(lowerPlan, entitlement)).toBe(false);
      }
    }

    const unknownPlan = requiredPlanFor('entitlement_inexistant' as Entitlement);
    expect(PLANS).toContain(unknownPlan);
    expect(hasEntitlement(unknownPlan, 'entitlement_inexistant' as Entitlement)).toBe(false);
  });

  it('TEST-A8-ENT-05: aucune fuite entre plans et aucun entitlement hors catalogue', () => {
    for (const plan of PLANS) {
      for (const entitlement of ENTITLEMENTS) {
        expect(hasEntitlement(plan, entitlement)).toBe(
          PLAN_ENTITLEMENTS[plan].includes(entitlement)
        );
      }
      for (const entitlement of PLAN_ENTITLEMENTS[plan]) {
        expect(ENTITLEMENTS).toContain(entitlement);
      }
    }

    for (let index = 1; index < PLANS.length; index += 1) {
      for (const inherited of PLAN_ENTITLEMENTS[PLANS[index - 1]]) {
        expect(hasEntitlement(PLANS[index], inherited)).toBe(true);
      }
    }
  });
});
