import { describe, expect, it } from 'vitest';
import { formatCoordinates, moveDistanceKm, parseCoordinates, searchAddress } from '../pointEdit';

describe('5.6 coordonnées saisies', () => {
  it.each([
    ['45.0512, 5.5103', 45.0512, 5.5103],
    ['45,0512 ; 5,5103', 45.0512, 5.5103],
    ['45.0512 5.5103', 45.0512, 5.5103],
    ['  -33.8688,  151.2093 ', -33.8688, 151.2093],
    ['45,0512 5,5103', 45.0512, 5.5103],
  ])('%s', (input, lat, lon) => {
    const r = parseCoordinates(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lat).toBeCloseTo(lat, 5);
      expect(r.value.lon).toBeCloseTo(lon, 5);
    }
  });

  it('longitude puis latitude : relu à l’envers, et dit', () => {
    const r = parseCoordinates('151.2093, -33.8688');
    expect(r.ok && r.swapped).toBe(true);
    if (r.ok) expect(r.value.lat).toBeCloseTo(-33.8688, 4);
  });

  it('refuse vide, texte, trop de valeurs, hors bornes', () => {
    for (const bad of ['', 'abc, def', '1, 2, 3', '95, 200', '45, 190', '120, 150']) expect(parseCoordinates(bad).ok).toBe(false);
  });

  it('formatCoordinates et distance de déplacement', () => {
    expect(formatCoordinates({ lat: 45.05123, lon: 5.5 })).toBe('45.05123, 5.50000');
    expect(moveDistanceKm({ lat: 45, lon: 6 }, { lat: 45.01, lon: 6 })).toBeCloseTo(1.11, 1);
  });
});

describe('5.6 adresse cherchée', () => {
  const ok = (body: unknown, status = true) => async () => ({ ok: status, json: async () => body });

  it('propose des résultats avec leur précision ; rien n’est posé sans choix', async () => {
    const r = await searchAddress('Annecy', ok({ status: 'ok', matches: [{ id: '1', name: 'Annecy', context: 'Haute-Savoie', country: 'France', lat: 45.9, lon: 6.12, precision: 'commune' }, { id: '2', name: 'Rue X', lat: 'x', lon: 1 }] }));
    expect(r.status).toBe('ok');
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ name: 'Annecy', context: 'Haute-Savoie, France', precision: 'commune' });
  });

  it('court, sans résultat, ou service muet', async () => {
    expect((await searchAddress('a', ok({}))).status).toBe('invalid');
    expect((await searchAddress('Zzzz', ok({ status: 'no_result', matches: [] }))).status).toBe('no_result');
    expect((await searchAddress('Zzzz', ok({ status: 'unavailable' }, false))).status).toBe('unavailable');
    expect((await searchAddress('Zzzz', async () => { throw new Error('x'); })).status).toBe('unavailable');
  });
});
