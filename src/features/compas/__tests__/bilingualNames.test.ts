import { describe, expect, it } from 'vitest';
import { pickPlace, stageTitleFor } from '../engine/places';

/**
 * Plan 4.5, défaut ouvert « Mòguru/Mogoro » : en Sardaigne (Italie, Alto Adige…)
 * OpenStreetMap écrit certains noms dans les deux langues, « Mòguru/Mogoro »,
 * « Bolzano - Bozen ». L'étape proposée « Mogoro » devenait « Mòguru/Mogoro ».
 */
describe('titre d’une étape : le nom à deux langues de la carte', () => {
  it('« Mogoro » proposé, « Mòguru/Mogoro » sur la carte : le nom proposé, pas les deux', () => {
    expect(stageTitleFor('Mogoro', 'Mòguru/Mogoro')).toBe('Mogoro');
  });

  it('le nom proposé peut être l’une ou l’autre des langues (comme pour un seul nom, il reste tel qu’écrit)', () => {
    expect(stageTitleFor('Moguru', 'Mòguru/Mogoro')).toBe('Moguru');
    expect(stageTitleFor('Bozen', 'Bolzano - Bozen')).toBe('Bozen');
    expect(stageTitleFor('Bolzano', 'Bolzano - Bozen')).toBe('Bolzano');
  });

  it('un nom proposé qui n’est aucune des deux langues prend le nom de la carte, en entier', () => {
    expect(stageTitleFor('Mogoro Oristano', 'Mòguru/Mogoro')).toBe('Mòguru/Mogoro');
  });

  it('CONTRE-EXEMPLES — un trait d’union sans espaces n’est pas un second nom', () => {
    expect(stageTitleFor('Chamonix', 'Chamonix-Mont-Blanc')).toBe('Chamonix');
    // « Étienne » serait l'un des morceaux si le trait d'union séparait deux noms : il n'en sépare pas.
    expect(stageTitleFor('Étienne', 'Saint-Étienne-de-Tinée')).toBe('Saint-Étienne-de-Tinée');
    expect(stageTitleFor('Bielsa', 'Bielsa')).toBe('Bielsa');
  });
});

describe('noms d’étape d’autres écritures et lettres nordiques (14 oct.)', () => {
  it('nom de la carte dans une autre écriture (devanagari, arabe) : le nom proposé, lisible', () => {
    expect(stageTitleFor('Gorak Shep', 'गोरक शेप')).toBe('Gorak Shep');
    expect(stageTitleFor('Wadi Rum', 'وادي رم')).toBe('Wadi Rum');
  });
  it('« Thorsmork » proposé, « Þórsmörk » sur la carte : le même lieu, le nom de la carte gardé', () => {
    expect(stageTitleFor('Thorsmork', 'Þórsmörk')).toBe('Thorsmork');
    const hit = pickPlace(
      [{ name: 'Þórsmörk', lat: 63.69, lon: -19.52, countryCode: 'IS', country: 'Islande', kind: 'other', extent: null }],
      { query: 'Thorsmork', strict: true }
    );
    expect(hit?.name).toBe('Þórsmörk');
  });
});
