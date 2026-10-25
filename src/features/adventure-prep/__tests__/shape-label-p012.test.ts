/**
 * P0.12 — le motif du jour 1 doit etre du francais, pas un assemblage.
 *
 * Le symptome mesure : la phrase rendue etait
 *   « Depart choisi, parcours en « et on revient au point de depart » »
 * c est-a-dire « parcours en » suivi d'une relative. Le glyphe manquant du
 * signalement d'origine (« parcours en ▯ et on revient ») avait bien
 * disparu, mais il avait emporte avec lui le mot qui fermait la phrase.
 *
 * Deux formes doivent donc rester grammaticales ET dire la meme chose que le
 * trajet mesure : une boucle revient au depart, un aller simple s'arrete a
 * l'arrivee. Une phrase qui ne tient pas debout a l'ecran est un bug de copie,
 * pas une question de gout.
 *
 * Aucun appel reseau : tout est donne.
 */
import { describe, expect, it } from 'vitest';
import { buildItinerary } from '../engine/itinerary';
import type { AdventurePrepDraft } from '../types';
import { CHAMONIX, fullDraft } from './fixtures';

const PREMIER_JOUR = 0;

function motifJour1(draft: AdventurePrepDraft): string {
  const modele = buildItinerary(draft);
  expect(modele).not.toBeNull();
  const premiere = modele!.steps.find((s) => s.day === 1 && s.kind === 'trajet');
  expect(premiere).toBeDefined();
  return premiere!.reason ?? '';
}

describe('P0.12 — le motif du premier jour est une phrase, pas un assemblage', () => {
  it('P012-01 : la boucle annonce un retour, en une phrase grammaticale', () => {
    const motif = motifJour1(
      fullDraft({
        route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
        calendar: {
          startDate: '2026-07-11', startDateIsSuggested: false,
          durationDays: 2, durationIsSuggested: false, returnDate: null,
        },
      }),
    );

    // Le defaut : « parcours en et on revient ».
    expect(motif).not.toMatch(/parcours en et\b/);
    expect(motif).toMatch(/parcours en boucle/);
    expect(motif).toMatch(/revient au point de d[ée]part/);
    expect(motif.endsWith('.')).toBe(true);
  });

  it('P012-02 : l aller simple annonce l arrivee, sans promettre de retour', () => {
    const motif = motifJour1(
      fullDraft({
        calendar: {
          startDate: '2026-07-11', startDateIsSuggested: false,
          durationDays: 2, durationIsSuggested: false, returnDate: null,
        },
      }),
    );

    expect(motif).not.toMatch(/parcours en et\b/);
    expect(motif).toMatch(/aller simple/);
    // L'aller simple ne revient pas : la phrase ne doit pas l'impliquer.
    expect(motif).not.toMatch(/revient au point de d[ée]part/);
  });

  it('P012-03 : aucune des deux formes ne laisse un mot orphelin', () => {
    const formes = ['boucle', 'aller_simple'] as const;
    for (const shape of formes) {
      const motif = motifJour1(
        fullDraft({
          route: {
            origin: CHAMONIX,
            destination: shape === 'aller_simple' ? CHAMONIX : null,
            shape,
          },
          calendar: {
            startDate: '2026-07-11', startDateIsSuggested: false,
            durationDays: 2, durationIsSuggested: false, returnDate: null,
          },
        }),
      );
      // Une phrase recolee se voit : deux espaces ordinaires, ou une espace
      // avant une ponctuation qui n'en demande pas.
      //
      // ATTENTION au deux-points et au point-virgule : le francais y exige
      // une espace insecable, et `\s` la voit comme une espace. Les verifier
      // ici reviendrait a interdire la typographie correcte du depot.
      expect(motif).not.toMatch(/ {2,}/);
      expect(motif).not.toMatch(/\s+[.,]/);
      expect(motif).not.toMatch(/\s+$/);
    }
  });
});
