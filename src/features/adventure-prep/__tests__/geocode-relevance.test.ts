import { describe, expect, it } from 'vitest';
import { normalizeOpenMeteo } from '../geocodeService';

// GR-01 : une requete de lieu ne doit JAMAIS proposer un pays.
//
// Constat reel (2026-09-28) : « Argenti » renvoie
//   [0] Argenta        (Nevada, US)   PPL
//   [1] Argentine      (Argentine)    PCLI   <-- pays
//   [2] Argentine      (Rhone-Alpes)   PPL
// Aucun geocodeur libre ne classe la pertinence : il approxime. Sans filtre
// local, une saisie tronquee propose un pays a cote de localites, et
// l utilisateur voit « Argentine » la ou il voulait « Argentiere ».
describe('normalizeOpenMeteo — pertinence administrative', () => {
  const row = (name: string, feature_code: string, country: string) => ({
    name,
    latitude: 45,
    longitude: 6,
    country,
    admin1: '',
    feature_code,
  });

  it('GR-01 : ecarte un resultat de niveau pays (PCLI)', () => {
    const out = normalizeOpenMeteo({
      results: [
        row('Argenta', 'PPL', 'États-Unis'),
        row('Argentine', 'PCLI', 'Argentine'),
        row('Argentine', 'PPL', 'France'),
      ],
    });
    expect(out.map((m) => `${m.name}/${m.country}`)).toEqual([
      'Argenta/États-Unis',
      'Argentine/France',
    ]);
  });

  it('GR-02 : conserve les localites (PPL) et les lieux nommes (PPLL)', () => {
    const out = normalizeOpenMeteo({
      results: [
        row('Chamonix-Mont-Blanc', 'PPL', 'France'),
        row('Lac Blanc', 'PPLL', 'France'),
      ],
    });
    expect(out).toHaveLength(2);
  });

  it('GR-03 : un resultat sans feature_code reste accepte (fournisseur evolue)', () => {
    const out = normalizeOpenMeteo({
      results: [{ name: 'Chamonix', latitude: 45.92, longitude: 6.87, country: 'France' }],
    });
    expect(out).toHaveLength(1);
  });

  it('GR-04 : si le pays est le seul resultat, la liste est vide plutot que trompeuse', () => {
    const out = normalizeOpenMeteo({
      results: [row('Argentine', 'PCLI', 'Argentine')],
    });
    expect(out).toEqual([]);
  });
});
