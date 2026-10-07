import { describe, expect, it } from 'vitest';
import { trainTrip } from '../engine/rail';

describe('trainTrip — le train plutôt que l’avion en Europe de l’Ouest', () => {
  it('Annecy → Ardennes (500 km, 640 km de route) : le train', () => {
    const t = trainTrip({ fromCountry: 'FR', toCountry: 'FR', straightKm: 500, roadKm: 640, days: 3 })!;
    expect(t).toMatchObject({ railKm: 625, eurRoundTrip: 2 * 81 });
    expect(t.minutesOneWay).toBe(Math.round((625 / 110) * 60 + 30));
    expect(t.basis).toContain('Résa · Trajets');
  });

  it('Annecy → Bruges : pays reliés', () => {
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'BE', straightKm: 620, roadKm: 820, days: 6 })).not.toBeNull();
  });

  it('week-end à Barcelone (520 km, ~6 h 30 de train) : l’avion reste', () => {
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'ES', straightKm: 520, roadKm: 760, days: 2 })).toBeNull();
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'ES', straightKm: 520, roadKm: 760, days: 5 })).not.toBeNull();
  });

  it('Corse : la route mesurée passe par un ferry (3,7 fois le vol d’oiseau), pas de train', () => {
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'FR', straightKm: 480, roadKm: 1783 })).toBeNull();
  });

  it('route non mesurée, pays non relié, trop près ou trop loin : rien', () => {
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'FR', straightKm: 500, roadKm: null })).toBeNull();
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'PT', straightKm: 1100, roadKm: 1400 })).toBeNull();
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'FR', straightKm: 90, roadKm: 110 })).toBeNull();
    expect(trainTrip({ fromCountry: 'FR', toCountry: 'ES', straightKm: 1500, roadKm: 1800 })).toBeNull();
  });
});
