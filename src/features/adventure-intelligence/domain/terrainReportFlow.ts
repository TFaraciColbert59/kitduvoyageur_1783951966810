/**
 * A5 — Flux de création « 3 gestes » (machine pure).
 *
 * `idle → category → severity → confirm` avec retour arrière et annulation.
 * Position, précision, heure, segment et sens sont capturés côté client par
 * la couche UI ; cette machine ne porte que le parcours de saisie.
 */
import type {
  TerrainPassability,
  TerrainReportCategory,
  TerrainSeverity,
} from '../schemas/live.schema';

export type TerrainFlowStep = 'idle' | 'category' | 'severity' | 'confirm';

export interface TerrainFlowState {
  step: TerrainFlowStep;
  category: TerrainReportCategory | null;
  severity: TerrainSeverity | null;
  passability: TerrainPassability | null;
  description: string;
  hasPhoto: boolean;
}

export type TerrainFlowAction =
  | { type: 'start' }
  | { type: 'select_category'; category: TerrainReportCategory }
  | { type: 'select_severity'; severity: TerrainSeverity }
  | { type: 'set_passability'; passability: TerrainPassability }
  | { type: 'set_description'; description: string }
  | { type: 'set_photo'; hasPhoto: boolean }
  | { type: 'back' }
  | { type: 'cancel' };

/** Même borne que la modération et le schéma A1. */
export const TERRAIN_FLOW_MAX_DESCRIPTION_LENGTH = 1000;

export function createTerrainFlowState(): TerrainFlowState {
  return {
    step: 'idle',
    category: null,
    severity: null,
    passability: null,
    description: '',
    hasPhoto: false,
  };
}

/** Soumission possible dès que catégorie et gravité sont choisies. */
export function canSubmit(state: TerrainFlowState): boolean {
  return state.category !== null && state.severity !== null;
}

/**
 * Réducteur pur du flux. Les actions reçues hors de leur étape sont ignorées
 * (aucun saut d'écran). `back` remonte d'un cran sans effacer la saisie ;
 * `cancel` réinitialise tout.
 */
export function terrainFlowReducer(
  state: TerrainFlowState,
  action: TerrainFlowAction
): TerrainFlowState {
  switch (action.type) {
    case 'start':
      return { ...createTerrainFlowState(), step: 'category' };

    case 'cancel':
      return createTerrainFlowState();

    case 'select_category':
      if (state.step !== 'category') return state;
      return { ...state, category: action.category, step: 'severity' };

    case 'select_severity':
      if (state.step !== 'severity') return state;
      return { ...state, severity: action.severity, step: 'confirm' };

    case 'set_passability':
      if (state.step !== 'severity' && state.step !== 'confirm') return state;
      return { ...state, passability: action.passability };

    case 'set_description':
      if (state.step !== 'confirm') return state;
      return {
        ...state,
        description: action.description.slice(0, TERRAIN_FLOW_MAX_DESCRIPTION_LENGTH),
      };

    case 'set_photo':
      if (state.step !== 'confirm') return state;
      return { ...state, hasPhoto: action.hasPhoto };

    case 'back':
      if (state.step === 'confirm') return { ...state, step: 'severity' };
      if (state.step === 'severity') return { ...state, step: 'category' };
      if (state.step === 'category') return { ...state, step: 'idle' };
      return state;

    default:
      return state;
  }
}
