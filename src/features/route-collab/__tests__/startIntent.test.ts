import { describe, expect, it } from 'vitest';
import { placeLabel, readGeocodeMatches, readStartPhrase } from '../startIntent';

const TODAY = '2026-11-22';

describe('startIntent · phrase libre lue par le moteur du Compas (1.4)', () => {
  it('« Boucle de 15 km autour d’Annecy » : lieu, distance, forme', () => {
    const r = readStartPhrase('Boucle de 15 km autour d’Annecy', TODAY);
    expect(r.empty).toBe(false);
    expect(r.place).toMatch(/Annecy/i);
    expect(r.distanceKm).toBe(15);
    expect(r.shape).toBe('loop');
    expect(r.lines.length).toBeGreaterThan(0);
  });

  it('une activité dite donne le profil de routage ; sans activité dite, rien n’est supposé', () => {
    expect(readStartPhrase('Sortie vélo autour de Grenoble', TODAY).sport).toBe('route');
    expect(readStartPhrase('Randonnée dans le Vercors', TODAY).sport).toBe('marche');
    expect(readStartPhrase('Boucle autour d’Annecy', TODAY).activity).toBeNull();
  });

  it('aller-retour est reconnu ; une phrase vide est vide', () => {
    expect(readStartPhrase('Aller-retour jusqu’au lac Blanc', TODAY).shape).toBe('out_and_back');
    expect(readStartPhrase('   ', TODAY).empty).toBe(true);
  });

  it('une phrase sans lieu ne fabrique aucun lieu', () => {
    expect(readStartPhrase('Bonne idée', TODAY).place).toBeNull();
  });
});

describe('startIntent · lieu confirmé avec son pays (1.5)', () => {
  it('le libellé contient toujours le pays et ne répète rien', () => {
    expect(placeLabel({ name: 'Annecy', context: 'Haute-Savoie', country: 'France' })).toBe('Annecy · Haute-Savoie · France');
    expect(placeLabel({ name: 'Monaco', context: '', country: 'Monaco' })).toBe('Monaco');
  });

  it('lit la réponse de /api/geocode et écarte une entrée sans coordonnée valide', () => {
    const out = readGeocodeMatches({
      status: 'ok',
      matches: [
        { id: 'a', name: 'Annecy', context: '74', country: 'France', lat: 45.9, lon: 6.12, precision: 'commune' },
        { id: 'b', name: 'Sans coordonnée', context: '', country: 'X' },
        { id: 'c', name: 'Hors bornes', context: '', country: 'X', lat: 200, lon: 0 },
        { id: 'd', name: 'Null', context: '', country: 'X', lat: null, lon: null },
      ],
    });
    expect(out.map((m) => m.id)).toEqual(['a']);
    expect(readGeocodeMatches(null)).toEqual([]);
  });
});
