import { describe, expect, it } from 'vitest';
import { relevantAffiliateLinks } from '../engine/affiliates';

const chamonix = { id: 'a', country_code: 'FR', destination_name: 'Chamonix-Mont-Blanc' };
const katmandou = { id: 'b', country_code: 'NP', destination_name: 'Katmandou et Pokhara' };
const generique = { id: 'c', country_code: null, destination_name: null };
const france = { id: 'd', country_code: 'fr', destination_name: null };

describe('relevantAffiliateLinks', () => {
  it('pays connu : liens de ce pays et liens sans pays', () => {
    const ids = relevantAffiliateLinks([chamonix, katmandou, generique, france], 'FR').map((l) => l.id);
    expect(ids).toEqual(['a', 'c', 'd']);
  });

  it('CONTRE-EXEMPLE — pays inconnu : aucun lien attaché à un lieu', () => {
    const ids = relevantAffiliateLinks([chamonix, katmandou, generique, france], null).map((l) => l.id);
    expect(ids).toEqual(['c']);
  });

  it('un autre pays ne laisse passer ni la France ni le Népal', () => {
    const ids = relevantAffiliateLinks([chamonix, katmandou, generique], ' it ').map((l) => l.id);
    expect(ids).toEqual(['c']);
  });
});
