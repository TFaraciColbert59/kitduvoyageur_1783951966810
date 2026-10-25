import { describe, expect, it } from 'vitest';
import { applyAdjustment, previewAdjustment } from '../engine/adjustments';
import { buildItinerary, setStepKept } from '../engine/itinerary';
import type { AdjustmentId, ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

const model = (): ItineraryModel => {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
};

const ALL: readonly AdjustmentId[] = [
  'moins_cher',
  'moins_de_transport',
  'plus_de_nature',
  'plus_tranquille',
  'plus_de_decouvertes',
];

describe('ajustement du parcours', () => {
  it('explique chaque reglage en mots, sans pourcentage', () => {
    for (const id of ALL) {
      const preview = previewAdjustment(model(), id);
      expect(preview.id).toBe(id);
      expect(preview.impact.length).toBeGreaterThan(10);
      expect(preview.impact).not.toMatch(/%/);
    }
  });

  it('conserve les etapes validees et ne touche qu\'aux autres', () => {
    const built = model();
    const aGarder = setStepKept(built, built.steps[0].id, true);
    const preview = previewAdjustment(aGarder, 'moins_de_transport');
    expect(preview.preservedStepIds).toContain(built.steps[0].id);
    expect(preview.changedStepIds).not.toContain(built.steps[0].id);
  });

  it('reduit le nombre d\'etapes facultatives quand on cherche moins cher', () => {
    const built = model();
    const suivant = applyAdjustment(built, 'moins_cher');
    expect(suivant.steps.length).toBeLessThan(built.steps.length);
    expect(suivant.days).toBe(built.days);
  });

  it('ajoute des temps dehors quand on veut plus de nature', () => {
    const built = model();
    const suivant = applyAdjustment(built, 'plus_de_nature');
    expect(suivant.steps.length).toBeGreaterThan(built.steps.length);
    expect(suivant.steps.some((s) => s.title === 'Temps dehors')).toBe(true);
  });

  it('ne deplace jamais une nuit conservee', () => {
    const built = model();
    const nuit = built.steps.find((s) => s.kind === 'nuit');
    if (!nuit) throw new Error('nuit attendue');
    const conservee = setStepKept(built, nuit.id, true);
    for (const id of ALL) {
      const suivant = applyAdjustment(conservee, id);
      const trouvee = suivant.steps.find((s) => s.id === nuit.id);
      expect(trouvee).toBeDefined();
      expect(trouvee?.kept).toBe(true);
    }
  });

  it('garde des identifiants uniques apres plusieurs ajustements', () => {
    let built = model();
    for (const id of ALL) built = applyAdjustment(built, id);
    const ids = built.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ne change ni les jours ni le contexte de metrique', () => {
    const built = model();
    for (const id of ALL) {
      const suivant = applyAdjustment(built, id);
      expect(suivant.days).toBe(built.days);
      expect(suivant.metricsContext).toBe(built.metricsContext);
    }
  });

  it('ne modifie pas le modele d\'origine', () => {
    const built = model();
    const avant = JSON.stringify(built);
    for (const id of ALL) applyAdjustment(built, id);
    expect(JSON.stringify(built)).toBe(avant);
  });
});
