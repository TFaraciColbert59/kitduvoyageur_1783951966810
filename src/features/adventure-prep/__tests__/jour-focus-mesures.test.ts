/**
 * P0.28 -- La banniere de mesures doit suivre le jour, sur TOUTES les etapes.
 *
 * Defaut MESURE le 2026-09-28 sur 393x852, apres generation reelle de 2 jours
 * (rail bas de `DayPlateau`, valeurs relevees sur l'ecran) :
 *
 *  - Sur l'etape 2 (`ItineraryStep`) le bon fonctionne : « Tout » affiche le
 *    total, « Jour 1 » affiche 55,1 km / 5 096 m / 15 h 09, « Jour 2 » affiche
 *    « a verifier » / « a verifier » / 1 h. Le selecteur in-screen et le rail
 *    bas donnent la MEME valeur : ils alimentent le meme store.
 *  - Sur l'etape 3 (`DepartureStep`) le bandeau reste FIGE sur le total de
 *    l'aventure quel que soit le jour choisi : 16 h 09 min pour « Tout »,
 *    « Jour 1 » ET « Jour 2 ». Alors que la liste du programme, juste en dessous,
 *    repondait bien (elle ne montrait que le jour choisi).
 *
 * Cause : `DepartureStep` lisait `selectedDay` pour la liste
 * (`focusedDayNumbers`) mais Passing le scope en dur a `metricsFor` :
 * `metricsFor(model, 'aventure')`. Le commentaire du fichier affirmait pourtant
 * « l'onglet choisi plus haut pilote l'ecran 3, il ne decore pas » : la
 * intention etait ecrite, le calcul ne la suivait pas.
 *
 * Ces tests verrouillent les DEUX moities du contrat : la decision de scope
 * (fonction pure, testable) et l'usage reel dans chaque etape.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { metricsFor } from '../engine/metrics';
import { activeDayOrNull } from '../engine/metrics';
import { focusedDayNumbers } from '../components/DepartureStep';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { ItineraryModel } from '../types';

const read = (relative: string): string =>
  readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

const DEPARTURE = read('components/DepartureStep.tsx');
const ITINERARY = read('components/ItineraryStep.tsx');

function modelWithDays(): ItineraryModel {
  const built = buildItinerary(fullDraft({
    calendar: {
      startDate: '2026-10-01',
      startDateIsSuggested: false,
      durationDays: 2,
      durationIsSuggested: false,
      returnDate: '2026-10-02',
    },
  }));
  if (!built) throw new Error('modele attendu');
  return built;
}

// Les mesures sont rendues au format FRANCAIS : « 55,1 km », « 5 096 m ».
// Lire ces nombres avec Number() sanstraitement donnerait 551 et 5096.
const NUM = (s: string | null | undefined): number | null => {
  const m = String(s ?? '').match(/-?\d[\d\s\u00a0\u202f.,]*/);
  if (!m) return null;
  const brut = m[0].trim().replace(/[\s\u00a0\u202f]/g, '');
  // La virgule est ici le separateur decimal ; le point, s'il existe, ne peut
  // etre qu'un separateur de milliers et disparait.
  const norm = brut.includes(',') ? brut.replace(/\./g, '').replace(',', '.') : brut;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};

describe('P0.28-1 -- activeDayOrNull : la decision de perimetre', () => {
  it('sans selection, tout le voyage', () => {
    expect(activeDayOrNull(2, null)).toBeNull();
  });

  it('une selection dans la borne donne ce jour', () => {
    expect(activeDayOrNull(2, 1)).toBe(1);
    expect(activeDayOrNull(3, 3)).toBe(3);
  });

  it('une selection hors borne retombe sur le voyage, jamais sur un ecran vide', () => {
    expect(activeDayOrNull(2, 5)).toBeNull();
    expect(activeDayOrNull(2, 0)).toBeNull();
    expect(activeDayOrNull(2, -1)).toBeNull();
  });

  it('un voyage sans jour ne peut pas focaliser', () => {
    expect(activeDayOrNull(0, 1)).toBeNull();
  });
});

describe('P0.28-2 -- la banniere affiche le jour choisi, pas le total', () => {
  // Un modele ou les jours sont MESURES. Sans cela, jour et voyage affichent
  // tous deux « a verifier », le test ne prouve rien — c est exactement le
  // piege rencontre une premiere fois dans ce fichier.
  const model: ItineraryModel = {
    ...modelWithDays(),
    perDay: [
      { distanceKm: 55.1, elevGainM: 5096, elevLossM: 4980, movingMin: 300, activityMin: 909 },
      { distanceKm: 12.4, elevGainM: 310, elevLossM: 290, movingMin: 60, activityMin: 60 },
    ],
    totals: { distanceKm: 67.5, elevGainM: 5406, elevLossM: 5270, movingMin: 360, activityMin: 969 },
  };

  const distance = (scope: 'jour' | 'aventure', day?: number) =>
    NUM(metricsFor(model, scope, day).find((m) => m.id === 'distance')?.formatted);
  const duree = (scope: 'jour' | 'aventure', day?: number) =>
    metricsFor(model, scope, day).find((m) => m.id === 'duree')?.formatted;

  it('le scope jour ne renvoie pas la tuile du voyage', () => {
    expect(distance('jour', 1)).not.toBe(distance('aventure'));
  });

  it('le jour 1 affiche la distance du jour 1', () => {
    expect(distance('jour', 1)).toBe(55.1);
  });

  it('le jour 2 affiche la distance du jour 2', () => {
    expect(distance('jour', 2)).toBe(12.4);
  });

  it('le voyage affiche la somme mesuree des jours', () => {
    expect(distance('aventure')).toBe(67.5);
  });

  it('« Jour 1 » affiche la duree d ACTIVITE du jour, pas le total', () => {
    // 909 min = 15 h 09 : la valeur relevee a l ecran le 2026-09-28.
    expect(duree('jour', 1)).toBe('15 h 09 min');
  });

  it('la duree du voyage reste la somme des jours', () => {
    expect(duree('aventure')).toBe('16 h 09 min');
  });

  it('une journee non mesuree reste « a verifier » plutot que 0', () => {
    const creux: ItineraryModel = {
      ...model,
      perDay: [model.perDay[0]!, { ...model.perDay[1]!, distanceKm: null }],
      totals: { ...model.totals, distanceKm: null },
    };
    const valeur = metricsFor(creux, 'jour', 2).find((m) => m.id === 'distance');
    expect(valeur?.state).toBe('a_verifier');
  });
});

describe('P0.28-3 -- aucune etape ne fige le scope', () => {
  it('DepartureStep ne passe plus le scope en dur', () => {
    expect(DEPARTURE).not.toMatch(/metricsFor\(\s*model\s*,\s*['"]aventure['"]\s*\)/);
  });

  it('DepartureStep pilote son bandeau par le jour selectedDay', () => {
    expect(DEPARTURE).toMatch(/activeDayOrNull\(\s*model\.days\s*,\s*selectedDay\s*\)/);
  });

  it('ItineraryStep utilise la MEME decision de perimetre', () => {
    expect(ITINERARY).toMatch(/activeDayOrNull\(\s*model\.days\s*,\s*focusDay\s*\)/);
  });

  it('la liste du programme et la banniere partagent le meme perimetre', () => {
    // Si les deux divergeaient, l'ecran afficherait un jour et compterait l'autre.
    expect(DEPARTURE).toMatch(/focusedDayNumbers\(\s*model\.days\s*,\s*selectedDay\s*\)/);
  });
});

describe('P0.28-4 -- focusedDayNumbers reste coherent avec activeDayOrNull', () => {
  it('les deux tombes sur la meme decision', () => {
    for (const jours of [1, 2, 5]) {
      for (const sel of [null, 1, 2, 3, 9]) {
        const actif = activeDayOrNull(jours, sel);
        const liste = focusedDayNumbers(jours, sel);
        const attendu = actif === null ? jours : 1;
        expect(liste.length).toBe(attendu);
      }
    }
  });
});
