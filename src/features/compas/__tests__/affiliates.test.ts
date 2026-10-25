import { describe, expect, it } from 'vitest';
import { relevantAffiliateLinks } from '../engine/affiliates';

const chamonix = { id: 'a', country_code: 'FR', destination_name: 'Chamonix-Mont-Blanc' };
const katmandou = { id: 'b', country_code: 'NP', destination_name: 'Katmandou et Pokhara' };
const generique = { id: 'c', country_code: null, destination_name: null };
const france = { id: 'd', country_code: 'fr', destination_name: null };
const paysFrance = { id: 'e', country_code: 'FR', destination_name: 'France' };

describe('relevantAffiliateLinks', () => {
  it('pays connu : liens de ce pays, d’échelle pays ou sans pays, jamais un autre lieu précis (C-004)', () => {
    const ids = relevantAffiliateLinks([chamonix, katmandou, generique, france, paysFrance], 'FR', 'Vercors').map((l) => l.id);
    expect(ids).toEqual(['c', 'd', 'e']);
  });

  it('le lieu précis du lien est montré à un voyage qui y va (Chamonix → Chamonix-Mont-Blanc)', () => {
    const ids = relevantAffiliateLinks([chamonix, paysFrance], 'FR', 'Chamonix').map((l) => l.id);
    expect(ids).toEqual(['a', 'e']);
  });

  it('lieu du voyage inconnu : seuls les liens d’échelle pays restent', () => {
    const ids = relevantAffiliateLinks([chamonix, paysFrance], 'FR', null).map((l) => l.id);
    expect(ids).toEqual(['e']);
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
