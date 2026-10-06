import { describe, expect, it } from 'vitest';
import { changedFields, partsText, projectBasis, staleParts, untouchedSince } from '../engine/dependencies';

const basis = (over: Partial<Parameters<typeof projectBasis>[0]> = {}) =>
  projectBasis({
    anchor: { name: 'Allemagne', lat: 51.1657, lon: 10.4515 },
    destinationName: 'Allemagne',
    days: 7,
    hours: null,
    startDate: '2027-06-01',
    activity: 'hiking',
    partySize: 1,
    prefs: { pace: 'normal', nights: null },
    ...over,
  });

describe('Dépendances : ne recalculer que ce qui doit l’être', () => {
  it('rien n’a changé : rien à refaire', () => {
    expect(staleParts(basis(), basis())).toEqual([]);
  });

  it('7 → 10 jours : itinéraire, nuits, trajet, sac, budget', () => {
    expect(staleParts(basis(), basis({ days: 10 }))).toEqual(['steps', 'nights', 'transport', 'kit', 'budget']);
  });

  it('Allemagne → Norvège : tout ce qui dépend du lieu', () => {
    const now = basis({ anchor: { name: 'Norvège', lat: 60.47, lon: 8.47 }, destinationName: 'Norvège' });
    expect(changedFields(basis(), now)).toEqual(['destination']);
    expect(staleParts(basis(), now)).toEqual(['steps', 'nights', 'transport', 'kit', 'budget']);
  });

  it('une personne de plus : trajet, sac et budget, pas l’itinéraire', () => {
    expect(staleParts(basis(), basis({ partySize: 2 }))).toEqual(['transport', 'kit', 'budget']);
  });

  it('« dormir dehors 3 nuits » : nuits, sac, budget', () => {
    expect(staleParts(basis(), basis({ prefs: { pace: 'normal', nights: null, outdoorNights: 3 } }))).toEqual([
      'nights',
      'kit',
      'budget',
    ]);
  });

  it('« surtout de la montagne » : l’itinéraire et ce qui s’y accroche', () => {
    expect(staleParts(basis(), basis({ prefs: { pace: 'normal', nights: null, terrain: 'montagne' } }))).toEqual([
      'steps',
      'nights',
      'transport',
      'budget',
    ]);
  });

  it('choisir « normal » explicitement ne change rien', () => {
    expect(staleParts(basis({ prefs: null }), basis())).toEqual([]);
  });

  it('une empreinte d’une ancienne version (champ absent) ne déclenche rien', () => {
    const old = { ...basis() } as Record<string, unknown>;
    delete old.terrain;
    expect(staleParts(old, basis({ prefs: { pace: 'normal', nights: null, terrain: 'montagne' } }))).toEqual([]);
    expect(staleParts(null, basis())).toEqual([]);
  });

  it('une coordonnée n’est jamais gardée en clair au-delà de ~1 km', () => {
    expect(basis().destination).toBe('Allemagne@51.17,10.45');
  });
});

describe('Choix de l’utilisateur préservés', () => {
  it('une ligne retouchée après le préremplissage n’est plus « à lui »', () => {
    const at = '2026-10-06T08:00:00.000Z';
    expect(untouchedSince('2026-10-06T07:59:59.000Z', at)).toBe(true);
    expect(untouchedSince('2026-10-06T08:00:04.000Z', at)).toBe(true);
    expect(untouchedSince('2026-10-06T08:10:00.000Z', at)).toBe(false);
    expect(untouchedSince(null, at)).toBe(false);
  });

  it('libellé lisible', () => {
    expect(partsText(['steps', 'nights', 'budget'])).toBe('Itinéraire, nuits et budget');
    expect(partsText(['kit'])).toBe('Sac');
  });
});

describe('Itinéraire de secours retenté', () => {
  it('retente l’itinéraire et ce qui en dépend, au plus 2 fois d’affilée', async () => {
    const { retryParts, unionParts } = await import('../engine/dependencies');
    expect(retryParts(undefined)).toEqual([]);
    expect(retryParts(0)).toEqual([]);
    expect(retryParts(1)).toEqual(['steps', 'nights', 'transport', 'budget']);
    expect(retryParts(2)).toEqual(['steps', 'nights', 'transport', 'budget']);
    expect(retryParts(3)).toEqual([]);
    expect(unionParts(['kit', 'budget'], retryParts(1))).toEqual(['steps', 'nights', 'transport', 'kit', 'budget']);
  });
});
