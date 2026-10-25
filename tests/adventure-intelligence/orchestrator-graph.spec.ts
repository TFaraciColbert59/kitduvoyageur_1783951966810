import { describe, it, expect } from 'vitest';
import {
  ENGINE_NODES,
  missingDependencies,
  topologicalOrder,
  type EngineNode,
} from '@/features/adventure-intelligence/domain/orchestratorGraph';

describe('A6 — graphe de dépendances des moteurs (TEST-A6-GRAPH)', () => {
  it('TEST-A6-GRAPH-01: ordre topologique conforme à la roadmap et dépendances respectées', () => {
    const order = topologicalOrder();

    expect(order).toEqual(ENGINE_NODES.map((node) => node.id));
    expect(order).toContain('intent');
    expect(order.indexOf('coherence')).toBeGreaterThan(order.indexOf('budget'));
    expect(order.indexOf('adventure_plan')).toBe(order.length - 1);

    const position = new Map(order.map((id, index) => [id, index]));
    for (const node of ENGINE_NODES) {
      for (const dependency of node.dependencies) {
        const dependencyIndex = position.get(dependency) as number;
        const nodeIndex = position.get(node.id) as number;
        expect(dependencyIndex).toBeLessThan(nodeIndex);
      }
    }
  });

  it('TEST-A6-GRAPH-02: un cycle est détecté et rejeté', () => {
    const cyclic: EngineNode[] = [
      { id: 'route', dependencies: ['coherence'], critical: true },
      { id: 'coherence', dependencies: ['route'], critical: true },
    ];

    expect(() => topologicalOrder(cyclic)).toThrow(/cycle/i);
  });

  it('TEST-A6-GRAPH-03: une dépendance manquante est signalée explicitement', () => {
    const broken: EngineNode[] = [
      { id: 'intent', dependencies: [], critical: true },
      { id: 'route', dependencies: ['warp_drive' as EngineNode['id']], critical: true },
    ];

    expect(missingDependencies(broken)).toContain('warp_drive');
    expect(() => topologicalOrder(broken)).toThrow(/manquante/i);
    expect(missingDependencies()).toEqual([]);
  });
});
