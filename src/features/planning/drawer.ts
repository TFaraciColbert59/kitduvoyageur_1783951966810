/**
 * Pile unique de navigation des drawers de planification (contrat C-UI).
 * Garantit que le retour d'un sous-drawer (détail, découpage, choix de refuge,
 * prévisualisation) restaure exactement le contexte parent (requête et scroll).
 */

import type { PlanningDrawerState, PlanningDrawerView } from './models';

export type PlanningDrawerAction =
  | { type: 'open'; view: PlanningDrawerView }
  | { type: 'replace_top'; view: PlanningDrawerView }
  | { type: 'back' }
  | { type: 'close_all' };

export function createPlanningDrawerState(
  initialView: PlanningDrawerView | null = null,
): PlanningDrawerState {
  if (!initialView) {
    return { stack: [], active: null };
  }
  return { stack: [initialView], active: initialView };
}

export function reducePlanningDrawerState(
  state: PlanningDrawerState,
  action: PlanningDrawerAction,
): PlanningDrawerState {
  switch (action.type) {
    case 'open': {
      const stack = [...state.stack, action.view];
      return { stack, active: action.view };
    }
    case 'replace_top': {
      if (state.stack.length === 0) {
        return { stack: [action.view], active: action.view };
      }
      const stack = [...state.stack.slice(0, -1), action.view];
      return { stack, active: action.view };
    }
    case 'back': {
      if (state.stack.length <= 1) {
        return { stack: [], active: null };
      }
      const stack = state.stack.slice(0, -1);
      return { stack, active: stack[stack.length - 1] };
    }
    case 'close_all':
      return { stack: [], active: null };
  }
}
