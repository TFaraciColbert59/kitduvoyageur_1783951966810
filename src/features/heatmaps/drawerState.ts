/**
 * K3.07, K3.08, K7.06, S3.16..S3.19, S6.17 — Machine d'état pure des sous-drawers
 * de heatmaps et de contrôle de contribution aux agrégats.
 *
 * Exigences UX communes aux 8 fiches :
 * - « Mode : Drawer ou sous-drawer. »
 * - « Règle de visibilité : Ouvrir sur action explicite. Le retour restaure le
 *   contexte du drawer parent. »
 * - « Vérifier ouverture, retour au drawer parent et conservation du choix. »
 */

import type {
  CommunityTimeWindow,
  HeatmapSportFilter,
  PersonalTimeFilter,
} from './types';

export type HeatmapSubDrawerKind =
  | 'closed'
  | 'community_heatmap'
  | 'personal_heatmap'
  | 'privacy_contribution';

/** Snapshot du contexte du drawer parent (Explorer Layers ou Compte Confidentialité). */
export interface ParentDrawerContextSnapshot {
  parentSheet: string;
  parentDetent: 'peek' | 'low' | 'mid' | 'full';
  parentTab: number;
  scrollOffsetPx?: number;
}

export interface HeatmapDrawerState {
  /** Sous-drawer actuellement ouvert (`'closed'` par défaut : jamais ouvert implicitement). */
  activeSubDrawer: HeatmapSubDrawerKind;
  /** Contexte du drawer parent figé à l'ouverture, restauré au retour. */
  savedParentContext: ParentDrawerContextSnapshot | null;
  /** Dernier contexte parent effectivement restauré lors de la fermeture/retour. */
  lastRestoredParentContext: ParentDrawerContextSnapshot | null;
  /** Sélection persistée de la couche communautaire (K3.07, S3.16, S3.17, S3.18). */
  communitySelection: {
    enabled: boolean;
    sport: HeatmapSportFilter;
    timeWindow: CommunityTimeWindow;
  };
  /** Sélection persistée de la couche personnelle (K3.08, S3.19). */
  personalSelection: {
    enabled: boolean;
    sport: HeatmapSportFilter;
    period: PersonalTimeFilter;
    comparePeriod: PersonalTimeFilter | null;
  };
}

export type HeatmapDrawerAction =
  | {
      type: 'OPEN_SUB_DRAWER';
      subDrawer: Exclude<HeatmapSubDrawerKind, 'closed'>;
      parentContext: ParentDrawerContextSnapshot;
    }
  | {
      type: 'BACK_TO_PARENT_DRAWER';
    }
  | {
      type: 'SET_COMMUNITY_FILTER';
      enabled?: boolean;
      sport?: HeatmapSportFilter;
      timeWindow?: CommunityTimeWindow;
    }
  | {
      type: 'SET_PERSONAL_FILTER';
      enabled?: boolean;
      sport?: HeatmapSportFilter;
      period?: PersonalTimeFilter;
      comparePeriod?: PersonalTimeFilter | null;
    };

export function createInitialHeatmapDrawerState(): HeatmapDrawerState {
  return {
    activeSubDrawer: 'closed',
    savedParentContext: null,
    lastRestoredParentContext: null,
    communitySelection: {
      enabled: false,
      sport: 'all',
      timeWindow: 'global',
    },
    personalSelection: {
      enabled: false,
      sport: 'all',
      period: { kind: 'all_time' },
      comparePeriod: null,
    },
  };
}

/**
 * Réducteur pur gérant l'ouverture explicite d'un sous-drawer, la modification
 * et la conservation des filtres (sport, période, fenêtre nocturne/7j), ainsi
 * que la restauration fidèle du contexte du drawer parent au retour.
 */
export function reduceHeatmapDrawerState(
  state: HeatmapDrawerState,
  action: HeatmapDrawerAction
): HeatmapDrawerState {
  switch (action.type) {
    case 'OPEN_SUB_DRAWER': {
      return {
        ...state,
        activeSubDrawer: action.subDrawer,
        savedParentContext: { ...action.parentContext },
      };
    }
    case 'BACK_TO_PARENT_DRAWER': {
      return {
        ...state,
        activeSubDrawer: 'closed',
        lastRestoredParentContext: state.savedParentContext
          ? { ...state.savedParentContext }
          : state.lastRestoredParentContext,
        savedParentContext: null,
      };
    }
    case 'SET_COMMUNITY_FILTER': {
      return {
        ...state,
        communitySelection: {
          enabled: action.enabled ?? state.communitySelection.enabled,
          sport: action.sport ?? state.communitySelection.sport,
          timeWindow: action.timeWindow ?? state.communitySelection.timeWindow,
        },
      };
    }
    case 'SET_PERSONAL_FILTER': {
      return {
        ...state,
        personalSelection: {
          enabled: action.enabled ?? state.personalSelection.enabled,
          sport: action.sport ?? state.personalSelection.sport,
          period: action.period ?? state.personalSelection.period,
          comparePeriod:
            action.comparePeriod !== undefined
              ? action.comparePeriod
              : state.personalSelection.comparePeriod,
        },
      };
    }
    default:
      return state;
  }
}
