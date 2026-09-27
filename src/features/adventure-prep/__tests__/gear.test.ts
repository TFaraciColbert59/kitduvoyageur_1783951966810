import { describe, expect, it } from 'vitest';
import { buildGearNeeds, gearGaps, packWeight } from '../engine/gear';
import type { AdventurePrepDraft, GearNeed } from '../types';
import { fullDraft } from './fixtures';

const draft = (overrides: Partial<AdventurePrepDraft> = {}) => fullDraft(overrides);

function withWeights(gear: readonly GearNeed[], grams: number): GearNeed[] {
  return gear.map((g) => ({ ...g, weightGrams: grams }));
}

describe('equipement', () => {
  it('liste le materiel de base et l\'equipement specifique a l\'activite', () => {
    const rando = buildGearNeeds(draft()).map((g) => g.id);
    expect(rando).toContain('eau');
    expect(rando.length).toBeGreaterThan(4);
    const ville = buildGearNeeds(
      draft({ activities: { primary: 'city-break', extra: [], nights: [] } }),
    ).map((g) => g.id);
    expect(ville).not.toEqual(rando);
  });

  it('ajoute un abri des qu\'une nuit en bivouac est choisie', () => {
    const sansNuit = buildGearNeeds(draft()).map((g) => g.category);
    const avecNuit = buildGearNeeds(
      draft({ activities: { primary: 'rando-refuge', extra: [], nights: ['bivouac'] } }),
    ).map((g) => g.category);
    expect(avecNuit).toContain('shelter');
    expect(sansNuit).not.toContain('shelter');
  });

  it('ne marque jamais rien comme deja prepare a la creation', () => {
    for (const item of buildGearNeeds(draft())) expect(item.packed).toBe(false);
  });

  it('laisse le poids a null tant que personne ne l\'a saisi', () => {
    for (const item of buildGearNeeds(draft())) expect(item.weightGrams).toBeNull();
  });

  it('ne laisse personne comme proprietaire par defaut', () => {
    for (const item of buildGearNeeds(draft())) expect(item.ownerId).toBeNull();
  });

  it('additionne les poids seulement quand tout est connu', () => {
    const gear = buildGearNeeds(draft());
    const poids = packWeight(gear);
    expect(poids.grams).toBeNull();
    expect(poids.hasGaps).toBe(true);
    const complet = withWeights(gear, 500);
    expect(packWeight(complet)).toEqual({ grams: 500 * complet.length, hasGaps: false });
  });

  it('signale un seul manque quand un seul poids manque', () => {
    const gear = withWeights(buildGearNeeds(draft()), 500);
    const partial = gear.map((g, i) => (i === 0 ? { ...g, weightGrams: null } : g));
    const poids = packWeight(partial);
    expect(poids.hasGaps).toBe(true);
    expect(poids.grams).toBeNull();
  });

  it('distingue « je ne sais pas » de « je n\'ai pas »', () => {
    const gear = buildGearNeeds(draft());
    const sansProprio = gear.map((g) => ({ ...g, ownerId: null }));
    expect(gearGaps(sansProprio, []).every((gap) => gap.ownership === 'inconnu')).toBe(true);
    const cible = gear[0];
    const tousPrepareSaufUn = gear.slice(1).map((g) => g.id);
    const avecAbsence = gear.map((g) => ({ ...g, ownerId: g.id === cible.id ? 'membre-1' : 'membre-2' }));
    const avecUn = gearGaps(avecAbsence, tousPrepareSaufUn);
    expect(avecUn).toHaveLength(1);
    expect(avecUn[0].name).toBe(cible.name);
    expect(avecUn[0].ownership).toBe('absent');
  });

  it('ne signale plus un manque des que l\'objet est coche', () => {
    const gear = buildGearNeeds(draft());
    const ids = gear.map((g) => g.id);
    const trous = gearGaps(
      gear.map((g) => ({ ...g, ownerId: 'membre-1' })),
      ids,
    );
    expect(trous).toHaveLength(0);
  });

  it('marque comme vital seulement ce qui conditionne le retour', () => {
    const vitaux = buildGearNeeds(draft())
      .filter((g) => g.vital)
      .map((g) => g.id);
    expect(vitaux).toContain('eau');
    expect(vitaux.length).toBeLessThan(buildGearNeeds(draft()).length);
  });
});

