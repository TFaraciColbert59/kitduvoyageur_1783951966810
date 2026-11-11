/**
 * Compas v6 — interrupteurs du nouveau moteur (SPEC-V6-MOTEUR R3, ADR-V6-001 §2.1).
 *
 * Tout est éteint par défaut. Un interrupteur n'est allumé que si sa variable
 * vaut exactement « 1 ». Un maillon dont le prérequis est éteint reste éteint :
 * une combinaison incohérente ne casse jamais une préparation.
 *
 * Module PUR : l'environnement est passé en argument. Lecture côté serveur
 * uniquement (aucune variable `NEXT_PUBLIC_`).
 */
export interface V6Flags {
  brief: boolean;
  archetypes: boolean;
  checks: boolean;
  planner: boolean;
  graph: boolean;
}

export const V6_FLAG_VARS = {
  brief: 'COMPAS_V6_BRIEF',
  archetypes: 'COMPAS_V6_ARCHETYPES',
  checks: 'COMPAS_V6_CHECKS',
  planner: 'COMPAS_V6_PLANNER',
  graph: 'COMPAS_V6_GRAPH',
} as const satisfies Record<keyof V6Flags, string>;

export const V6_OFF: V6Flags = { brief: false, archetypes: false, checks: false, planner: false, graph: false };

export function v6Flags(env: Record<string, string | undefined>): V6Flags {
  const on = (k: keyof V6Flags) => env[V6_FLAG_VARS[k]] === '1';
  const brief = on('brief');
  const archetypes = on('archetypes') && brief;
  // Un invariant reçoit (voyage, brief, archétype) : sans Brief, pas de contrôle.
  const checks = on('checks') && brief;
  return {
    brief,
    archetypes,
    checks,
    planner: on('planner') && archetypes && checks,
    graph: on('graph') && brief,
  };
}
