import { describe, expect, it } from 'vitest';
import {
  GENERATION_PHASES,
  failGeneration,
  finishGeneration,
  generationProgress,
  initialGeneration,
  interruptGeneration,
  markPhaseDone,
  resumeGeneration,
  setPartial,
  startGeneration,
} from '../engine/generation';
import type { ItineraryStep } from '../types';

function step(id: string): ItineraryStep {
  return {
    id,
    day: 1,
    order: 0,
    kind: 'arret',
    title: 'Pause',
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { amount: null, currency: 'EUR', state: 'a_reserver' },
    state: 'a_reserver',
    kept: false,
    icon: 'clock',
    lat: null,
    lon: null,
  };
}

describe('generation du parcours', () => {
  it('demarre a l\'arret complet, sans etape ni progression inventee', () => {
    const state = initialGeneration();
    expect(state.status).toBe('idle');
    expect(state.steps).toHaveLength(0);
    expect(state.days).toBe(0);
    expect(state.error).toBeNull();
    expect(state.phases).toHaveLength(GENERATION_PHASES.length);
    expect(state.phases.every((p) => p.done === false)).toBe(true);
  });

  it('liste les sept phases du parcours, des etapes jusqu a la mise en forme', () => {
    expect(GENERATION_PHASES.map((p) => p.id)).toEqual([
      'recherche_parcours',
      'verification_etapes',
      'disponibilites',
      'lieux',
      'trace',
      'meteo',
      'synthese',
    ]);
    for (const phase of GENERATION_PHASES) {
      expect(phase.label.length).toBeGreaterThan(3);
    }
  });

  it('progresse phase par phase, jamais en pourcentage', () => {
    let state = startGeneration(initialGeneration());
    expect(state.status).toBe('en_cours');
    state = markPhaseDone(state, 'recherche_parcours');
    const progress = generationProgress(state);
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(GENERATION_PHASES.length);
    expect(progress.currentLabel).toBe('Vérification des étapes');
    expect(JSON.stringify(progress)).not.toContain('%');
  });

  it('conserve les etapes deja produites quand on arrete', () => {
    let state = startGeneration(initialGeneration());
    state = markPhaseDone(state, 'recherche_parcours');
    state = setPartial(state, [step('a'), step('b')], 2);
    state = interruptGeneration(state);
    expect(state.status).toBe('interrompu');
    expect(state.steps).toHaveLength(2);
    expect(state.days).toBe(2);
    expect(state.phases.filter((p) => p.done)).toHaveLength(1);
  });

  it('reprend la ou l\'on s\'etait arrete', () => {
    let state = startGeneration(initialGeneration());
    state = markPhaseDone(state, 'recherche_parcours');
    state = setPartial(state, [step('a')], 1);
    state = interruptGeneration(state);
    const resumed = resumeGeneration(state);
    expect(resumed.status).toBe('en_cours');
    expect(resumed.steps).toHaveLength(1);
    expect(resumed.phases.filter((p) => p.done)).toHaveLength(1);
  });

  it('conserve les etapes et affiche un message honnete en cas d\'echec', () => {
    let state = startGeneration(initialGeneration());
    state = setPartial(state, [step('a')], 1);
    state = failGeneration(state, 'Le service de cartographie ne repond plus.');
    expect(state.status).toBe('echec');
    expect(state.error).toBe('Le service de cartographie ne repond plus.');
    expect(state.steps).toHaveLength(1);
  });

  it('termine avec le nombre de jours reellement produit', () => {
    let state = startGeneration(initialGeneration());
    state = setPartial(state, [step('a'), step('b'), step('c')], 3);
    state = finishGeneration(state);
    expect(state.status).toBe('termine');
    expect(state.days).toBe(3);
    expect(state.phases.every((p) => p.done)).toBe(true);
    expect(generationProgress(state).done).toBe(GENERATION_PHASES.length);
  });

  it('ne propose pas de reprise quand rien n\'a ete produit', () => {
    expect(generationProgress(interruptGeneration(startGeneration(initialGeneration()))).canResume).toBe(
      false,
    );
  });
});
