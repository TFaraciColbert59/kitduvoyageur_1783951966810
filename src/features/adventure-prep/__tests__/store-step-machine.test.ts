/**
 * Machine d etats du preparateur — on ne saute jamais une etape.
 *
 * Le defaut corrige : `goToStep` posait `currentStep` sans rien verifier. Un
 * « Revenir a Preparation » suivi d un retour vers l amont laissait
 * `currentStep` pointer une etape jamais validee, et le parcours pouvait
 * ainsi passer de l etape 1 a l etape 3 sans que l etape 2 soit JUSTE.
 *
 * Ces tests sont ecrits comme des invariants, pas comme des cas : quel que
 * soit le saut demande, l etape affichee reste ouvrable.
 */

import { describe, it, expect } from 'vitest';
import { draftActions } from '../store/reducer';
import { canOpenStep, isStepSatisfied } from '../engine/steps';
import { PREP_STEPS, type AdventurePrepDraft, type PrepStepId } from '../types';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';

/** Etape 1 incomplete : aucune origine, donc aucune etape 2 possible. */
function sansOrigine(): AdventurePrepDraft {
  return fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
}

/** Etape 1 validee, etape 2 pas encore construite. */
function base(): AdventurePrepDraft {
  return fullDraft({ currentStep: 'destination', completedSteps: [] });
}

/** Les deux premieres etapes valides : le parcours existe. */
function avecParcours(): AdventurePrepDraft {
  const draft = fullDraft();
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: model, currentStep: 'itinerary', completedSteps: ['destination'] };
}

describe('Machine d etats — une etape ne se saute pas', () => {
  it('SM-01: l etape 2 reste refusee tant que l etape 1 n est pas validee', () => {
    const draft = sansOrigine();
    const suivant = draftActions.goToStep(draft, 'itinerary');
    // Refus total : meme objet, donc ni version bump ni re-rendu.
    expect(suivant).toBe(draft);
    expect(suivant.currentStep).toBe('destination');
  });

  it('SM-02: impossible d aller directement a l etape 3 sans passer par l etape 2', () => {
    // C est exactement le defaut signale : le saut de l etape 1 a l etape 3.
    const draft = base();
    expect(isStepSatisfied(draft, 'itinerary')).toBe(false);
    const suivant = draftActions.goToStep(draft, 'departure');
    expect(suivant).toBe(draft);
    expect(suivant.currentStep).not.toBe('departure');
  });

  it('SM-03: un aller-retour « Revenir a Preparer » ne peut pas invalider l avance', () => {
    // Le parcours reel : l etape 1 validee, passage a l etape 2, retour sur
    // l etape 1, puis tentative vers l etape 3. Elle doit rester refusee tant
    // que l etape 2 n a pas produit de parcours.
    let draft = base();
    draft = draftActions.completeStep(draft, 'destination');
    expect(draft.currentStep).toBe('itinerary');
    draft = draftActions.goToStep(draft, 'destination');
    expect(draft.currentStep).toBe('destination');
    const saute = draftActions.goToStep(draft, 'departure');
    expect(saute.currentStep).toBe('destination');
    expect(saute.completedSteps).not.toContain('departure');
  });

  it('SM-04: revenir en arriere reste toujours possible', () => {
    const draft = avecParcours();
    const retour = draftActions.goToStep(draft, 'destination');
    expect(retour.currentStep).toBe('destination');
    expect(retour).not.toBe(draft);
  });

  it('SM-05: avancer vers une etape ouverte est autorise, et versionne', () => {
    const draft = base();
    const suivant = draftActions.goToStep(draft, 'itinerary');
    expect(suivant.currentStep).toBe('itinerary');
    expect(suivant.version).toBe(draft.version + 1);
  });

  it('SM-06: l etape courante est un no-op sans effet de bord', () => {
    const draft = avecParcours();
    expect(draftActions.goToStep(draft, 'itinerary')).toBe(draft);
  });

  it('SM-07: completeStep ne valide ni n avance une etape non satisfaite', () => {
    const draft = base();
    const suivant = draftActions.completeStep(draft, 'itinerary');
    expect(suivant).toBe(draft);
    expect(suivant.completedSteps).not.toContain('itinerary');
  });

  it('SM-08: completeStep valide puis avance quand l etape est satisfaite', () => {
    const draft = base();
    const valide = draftActions.completeStep(draft, 'destination');
    expect(valide.completedSteps).toContain('destination');
    expect(valide.currentStep).toBe('itinerary');
  });

  it('SM-09: l etape 3 devient atteignable des que l etape 2 est validee', () => {
    const draft = avecParcours();
    expect(draftActions.goToStep(draft, 'departure').currentStep).toBe('departure');
  });
});

describe('Machine d etats — invariant de bout en bout', () => {
  it('SM-10: quel que soit le saut demande, l etape resultante reste ouvrable', () => {
    const sources = [sansOrigine(), base(), avecParcours()];
    for (const source of sources) {
      for (const cible of PREP_STEPS as readonly PrepStepId[]) {
        const resultat = draftActions.goToStep(source, cible);
        expect(
          canOpenStep(resultat, resultat.currentStep),
          `${cible} depuis etape ${source.currentStep} a produit une etape fermee`,
        ).toBe(true);
      }
    }
  });

  it('SM-11: une etape non satisfaite n entre jamais dans completedSteps', () => {
    const draft = base();
    for (const etape of PREP_STEPS as readonly PrepStepId[]) {
      const resultat = draftActions.completeStep(draft, etape);
      if (!isStepSatisfied(draft, etape)) {
        expect(resultat.completedSteps).not.toContain(etape);
      }
    }
  });
});
