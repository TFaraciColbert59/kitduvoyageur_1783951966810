import { describe, it, expect } from 'vitest';
import {
  TERRAIN_FLOW_MAX_DESCRIPTION_LENGTH,
  canSubmit,
  createTerrainFlowState,
  terrainFlowReducer,
  type TerrainFlowState,
} from '@/features/adventure-intelligence/domain/terrainReportFlow';

function reduce(
  state: TerrainFlowState,
  ...actions: Parameters<typeof terrainFlowReducer>[1][]
): TerrainFlowState {
  return actions.reduce(terrainFlowReducer, state);
}

describe('Terrain Live — flux de création 3 gestes (TEST-A5-FLOW)', () => {
  it('TEST-A5-FLOW-01: parcours nominal catégorie → gravité → confirmation', () => {
    const initial = createTerrainFlowState();
    expect(initial.step).toBe('idle');

    const state = reduce(
      initial,
      { type: 'start' },
      { type: 'select_category', category: 'obstacle' },
      { type: 'select_severity', severity: 'critical' }
    );

    expect(state.step).toBe('confirm');
    expect(state.category).toBe('obstacle');
    expect(state.severity).toBe('critical');
    expect(canSubmit(state)).toBe(true);
  });

  it('TEST-A5-FLOW-02: le retour arrière revient écran par écran sans perdre la saisie', () => {
    const state = reduce(
      createTerrainFlowState(),
      { type: 'start' },
      { type: 'select_category', category: 'mud' },
      { type: 'select_severity', severity: 'warning' }
    );

    const severity = terrainFlowReducer(state, { type: 'back' });
    expect(severity.step).toBe('severity');
    expect(severity.category).toBe('mud');
    expect(severity.severity).toBe('warning');

    const category = terrainFlowReducer(severity, { type: 'back' });
    expect(category.step).toBe('category');
    expect(category.category).toBe('mud');

    const idle = terrainFlowReducer(category, { type: 'back' });
    expect(idle.step).toBe('idle');
  });

  it('TEST-A5-FLOW-03: l’annulation réinitialise complètement le flux', () => {
    const state = reduce(
      createTerrainFlowState(),
      { type: 'start' },
      { type: 'select_category', category: 'water' },
      { type: 'select_severity', severity: 'info' },
      { type: 'set_description', description: 'gué impraticable' },
      { type: 'set_photo', hasPhoto: true }
    );

    const cancelled = terrainFlowReducer(state, { type: 'cancel' });
    expect(cancelled).toEqual(createTerrainFlowState());
  });

  it('TEST-A5-FLOW-04: canSubmit n’est vrai qu’avec catégorie ET gravité', () => {
    const initial = createTerrainFlowState();
    expect(canSubmit(initial)).toBe(false);

    const started = terrainFlowReducer(initial, { type: 'start' });
    expect(canSubmit(started)).toBe(false);

    const categorised = terrainFlowReducer(started, {
      type: 'select_category',
      category: 'danger',
    });
    expect(canSubmit(categorised)).toBe(false);

    const complete = terrainFlowReducer(categorised, {
      type: 'select_severity',
      severity: 'warning',
    });
    expect(canSubmit(complete)).toBe(true);

    // Les actions hors étape sont ignorées (pas de saut d'écran).
    expect(
      terrainFlowReducer(started, { type: 'select_severity', severity: 'critical' }).step
    ).toBe('category');

    const longText = terrainFlowReducer(complete, {
      type: 'set_description',
      description: 'x'.repeat(TERRAIN_FLOW_MAX_DESCRIPTION_LENGTH + 50),
    });
    expect(longText.description).toHaveLength(TERRAIN_FLOW_MAX_DESCRIPTION_LENGTH);
  });
});
