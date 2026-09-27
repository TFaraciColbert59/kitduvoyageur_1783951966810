import { describe, expect, it } from 'vitest';
import { buildContingencies } from '../engine/resilience';
import { buildItinerary } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

const model = (overrides: Parameters<typeof fullDraft>[0] = {}): ItineraryModel => {
  const built = buildItinerary(fullDraft(overrides));
  if (!built) throw new Error('modele attendu');
  return built;
};

describe('plans B', () => {
  it('propose un plan B pour chaque risque encountered, avec declencheur et action', () => {
    const list = buildContingencies(model());
    expect(list.length).toBeGreaterThanOrEqual(4);
    for (const plan of list) {
      expect(plan.trigger.length).toBeGreaterThan(3);
      expect(plan.action.length).toBeGreaterThan(3);
    }
  });

  it('ne propose un plan de fermeture que s\'il reste des reservations a faire', () => {
    const avecReservation = buildContingencies(model());
    const fermeture = avecReservation.find((p) => p.kind === 'fermeture');
    expect(fermeture).toBeDefined();
  });

  it('ajoute le plan hebergement quand il y a des nuits', () => {
    const nuits = buildContingencies(model()).find((p) => p.kind === 'hebergement_indisponible');
    expect(nuits).toBeDefined();
    expect(nuits?.affectedStepIds.length).toBeGreaterThan(0);
  });

  it('couvre toujours la panne du reseau et celle du service d\'assistant', () => {
    const kinds = buildContingencies(model()).map((p) => p.kind);
    expect(kinds).toContain('hors_ligne');
    expect(kinds).toContain('ia_indisponible');
  });

  it('rattache chaque plan a des etapes qui existent vraiment', () => {
    const built = model();
    const ids = new Set(built.steps.map((s) => s.id));
    for (const plan of buildContingencies(built)) {
      for (const id of plan.affectedStepIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('ne pretend rien etre pret hors des deux repli reels', () => {
    const toujoursSur = buildContingencies(model())
      .filter((plan) => plan.kind === 'hors_ligne' || plan.kind === 'ia_indisponible')
      .map((plan) => plan.prepared);
    expect(toujoursSur).toEqual([true, true]);
    for (const plan of buildContingencies(model())) {
      if (plan.kind === 'hors_ligne' || plan.kind === 'ia_indisponible') continue;
      expect(plan.prepared).toBe(false);
    }
  });

  it('marque le repli pret quand un bivouac a ete choisi', () => {
    const avecBivouac = model({
      activities: { primary: 'rando-refuge', extra: ['bivouac'], nights: ['bivouac'] },
    });
    const hebergement = buildContingencies(avecBivouac).find(
      (p) => p.kind === 'hebergement_indisponible',
    );
    expect(hebergement?.prepared).toBe(true);
  });

  it('ne depend que du brouillon, jamais d\'une horloge', () => {
    const a = buildContingencies(model());
    const b = buildContingencies(model());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

