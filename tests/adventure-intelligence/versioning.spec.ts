import { describe, it, expect } from 'vitest';
import {
  diffPlanVersions,
  nextVersionMeta,
} from '@/features/adventure-intelligence/domain/versioning';
import type {
  AdventurePlan,
  AdventurePlanSections,
  PlanValue,
} from '@/features/adventure-intelligence/domain/adventurePlan';
import { ADVENTURE_PLAN_SECTION_KEYS } from '@/features/adventure-intelligence/domain/adventurePlan';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';

const NOW = '2026-09-11T12:00:00.000Z';

function nullSections(): AdventurePlanSections {
  return Object.fromEntries(
    ADVENTURE_PLAN_SECTION_KEYS.map((key) => [key, null])
  ) as AdventurePlanSections;
}

function planValue(value: unknown): PlanValue<unknown> {
  return {
    value,
    confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'test' }),
    provenance: [{ source: 'computed', sourceRef: 'test' }],
    assumptions: [],
    warnings: [],
    impacts: [],
    computedAt: NOW,
  };
}

function planWithSections(sections: Partial<AdventurePlanSections>): AdventurePlan {
  return {
    id: 'a6000000-0000-4000-8000-0000000000bb',
    ownerId: 'a6000000-0000-4000-8000-0000000000cc',
    status: 'draft',
    currentVersion: 1,
    intent: { rawInput: 'test', activities: [], constraints: [] },
    participants: [],
    dates: { flexible: true },
    destinations: [],
    sections: { ...nullSections(), ...sections },
    confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'test' }),
    monitoringRules: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('A6 — versionnement du plan (TEST-A6-VER)', () => {
  it('TEST-A6-VER-01: le diff est calculé section par section', () => {
    const prev = planWithSections({ budget: planValue({ totalEur: 800 }) });
    const next = planWithSections({
      budget: planValue({ totalEur: 950 }),
      gearPlan: planValue({ items: ['drap'] }),
      safetyPlan: planValue({ rescueUnit: 'PGHM' }),
    });

    const diff = diffPlanVersions(prev, next);

    expect(diff.changes.map((change) => change.path)).toEqual([
      'sections.gearPlan',
      'sections.budget',
      'sections.safetyPlan',
    ]);
    const budget = diff.changes.find((change) => change.path === 'sections.budget');
    expect(budget?.before).toEqual(planValue({ totalEur: 800 }));
    expect(budget?.after).toEqual(planValue({ totalEur: 950 }));
    expect(budget?.requiresConfirmation).toBe(true);
    expect(diff.changes.find((change) => change.path === 'sections.gearPlan')?.requiresConfirmation).toBe(false);

    const noChange = diffPlanVersions(prev, prev);
    expect(noChange.changes).toEqual([]);
    expect(noChange.reason).toContain('Aucun');
  });

  it('TEST-A6-VER-02: chaque changement produit un impact avec section et gravité', () => {
    const prev = planWithSections({});
    const next = planWithSections({
      budget: planValue({ totalEur: 950 }),
      safetyPlan: planValue({ rescueUnit: 'PGHM' }),
    });

    const diff = diffPlanVersions(prev, next);
    const byId = new Map(diff.impacts.map((impact) => [impact.section, impact]));

    expect(diff.impacts).toHaveLength(2);
    expect(byId.get('sections.safetyPlan')?.severity).toBe('critical');
    expect(byId.get('sections.budget')?.severity).toBe('warning');
    for (const impact of diff.impacts) {
      expect(impact.label.trim().length).toBeGreaterThan(0);
      expect(impact.id.trim().length).toBeGreaterThan(0);
    }
  });

  it('TEST-A6-VER-03: nextVersionMeta incrémente la version et horodate', () => {
    const confidence = makeConfidence({ score: 0.7, sampleCount: 4, method: 'test' });
    const meta = nextVersionMeta(2, 'Budget ajusté', 'a6-orchestrator', confidence);

    expect(meta.version).toBe(3);
    expect(meta.reason).toBe('Budget ajusté');
    expect(meta.generatedBy).toBe('a6-orchestrator');
    expect(meta.confidence).toBe(confidence);
    expect(Number.isNaN(Date.parse(meta.createdAt))).toBe(false);
    expect(Object.keys(meta)).not.toContain('planId');
  });
});
