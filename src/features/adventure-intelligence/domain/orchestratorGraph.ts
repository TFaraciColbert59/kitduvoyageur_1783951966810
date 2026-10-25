/**
 * A6 — Graphe de dépendances des moteurs (roadmap 6.3, normatif).
 *
 * Domaine pur : aucune I/O, aucun import runtime. L'ordre déclaré de
 * `ENGINE_NODES` est l'ordre roadmap ; `topologicalOrder` le respecte à
 * l'identique (tri stable des nœuds prêts par index de déclaration) et jette
 * sur cycle ou dépendance manquante.
 */

export type EngineNodeId =
  | 'intent'
  | 'destination'
  | 'dates'
  | 'participants'
  | 'constraints'
  | 'route'
  | 'transport'
  | 'accommodations'
  | 'weather'
  | 'regulations'
  | 'profile'
  | 'terrain'
  | 'prediction'
  | 'difficulty'
  | 'food_water'
  | 'gear'
  | 'budget'
  | 'safety'
  | 'coherence'
  | 'adventure_plan';

export interface EngineNode {
  id: EngineNodeId;
  dependencies: EngineNodeId[];
  critical: boolean;
}

/**
 * Ordre roadmap (normatif) :
 * intent → destination|dates|participants|constraints → route|transport|accommodations
 * → weather|regulations → profile|terrain → prediction|difficulty → food_water|gear|budget
 * → safety → coherence → adventure_plan
 */
export const ENGINE_NODES: readonly EngineNode[] = [
  { id: 'intent', dependencies: [], critical: true },
  { id: 'destination', dependencies: ['intent'], critical: true },
  { id: 'dates', dependencies: ['intent'], critical: true },
  { id: 'participants', dependencies: ['intent'], critical: false },
  { id: 'constraints', dependencies: ['intent'], critical: false },
  { id: 'route', dependencies: ['destination', 'dates'], critical: true },
  { id: 'transport', dependencies: ['route'], critical: false },
  { id: 'accommodations', dependencies: ['route'], critical: false },
  { id: 'weather', dependencies: ['destination', 'dates'], critical: false },
  { id: 'regulations', dependencies: ['destination'], critical: false },
  { id: 'profile', dependencies: ['participants'], critical: false },
  { id: 'terrain', dependencies: ['route'], critical: false },
  { id: 'prediction', dependencies: ['profile', 'terrain'], critical: false },
  { id: 'difficulty', dependencies: ['prediction'], critical: false },
  { id: 'food_water', dependencies: ['route'], critical: false },
  { id: 'gear', dependencies: ['route'], critical: false },
  { id: 'budget', dependencies: ['transport', 'accommodations', 'food_water', 'gear'], critical: false },
  { id: 'safety', dependencies: ['weather', 'difficulty', 'budget'], critical: false },
  { id: 'coherence', dependencies: ['food_water', 'gear', 'budget', 'safety', 'difficulty'], critical: true },
  { id: 'adventure_plan', dependencies: ['coherence'], critical: true },
];

/** Dépendances référencées mais absentes du graphe (triées, déduplicées). */
export function missingDependencies(nodes: readonly EngineNode[] = ENGINE_NODES): string[] {
  const known = new Set<string>(nodes.map((node) => node.id));
  const missing = new Set<string>();
  for (const node of nodes) {
    for (const dependency of node.dependencies) {
      if (!known.has(dependency)) missing.add(dependency);
    }
  }
  return [...missing].sort();
}

/** Un moteur inconnu du graphe n'est jamais critique par défaut. */
export function isCriticalEngine(id: string): boolean {
  return ENGINE_NODES.find((node) => node.id === id)?.critical === true;
}

/**
 * Tri topologique stable : parmi les nœuds prêts, le plus petit index de
 * déclaration gagne, ce qui garantit exactement l'ordre roadmap.
 * Jette sur dépendance manquante puis sur cycle.
 */
export function topologicalOrder(nodes: readonly EngineNode[] = ENGINE_NODES): EngineNodeId[] {
  const missing = missingDependencies(nodes);
  if (missing.length > 0) {
    throw new Error(`Dépendances manquantes dans le graphe des moteurs : ${missing.join(', ')}`);
  }

  const indexById = new Map<string, number>();
  nodes.forEach((node, index) => indexById.set(node.id, index));

  const remaining = new Set<string>(nodes.map((node) => node.id));
  const emitted = new Set<string>();
  const order: EngineNodeId[] = [];

  while (remaining.size > 0) {
    const ready = nodes
      .filter((node) => remaining.has(node.id))
      .filter((node) => node.dependencies.every((dependency) => emitted.has(dependency)));

    if (ready.length === 0) {
      const cycle = [...remaining].sort(
        (a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0)
      );
      throw new Error(`Cycle détecté dans le graphe des moteurs : ${cycle.join(' → ')}`);
    }

    ready.sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0));
    const next = ready[0];
    remaining.delete(next.id);
    emitted.add(next.id);
    order.push(next.id);
  }

  return order;
}
