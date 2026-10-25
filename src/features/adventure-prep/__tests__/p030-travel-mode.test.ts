import { describe, expect, it, vi } from 'vitest';

import { routeItinerary, travelModeFor, TRAVEL_MODES, type RouteLeg, type RoutingDeps } from '../engine/routing';
import { buildItinerary } from '../engine/itinerary';
import { assembleModel } from '../engine/itineraryPhases';
import { fullDraft } from './fixtures';
import type { ActivitySelection, AdventurePrepDraft, ItineraryModel } from '../types';

/**
 * P0.30 — `velo` etait accepte partout et produit NULLE PART.
 *
 * `isTravelMode('velo')` est vrai, `/api/route` route bien vers
 * `routing.openstreetmap.de/routed-bike`, les tests couvrent le mode. Mais
 * `travelModeFor()` ne pouvait renvoyer que deux valeurs a partir du SEUL
 * `metricsContext` du modele, et `velo` n en etait pas une. Un parcours a
 * velo se faisait donc mesurer sur le graphe pedestre.
 *
 * L ecart n est pas cosmetique. Mesure sur les MEMES points, le 2026-09-29 :
 * 7,139 km valaient **29,8 min** a velo contre **98,5 min** a pied, soit un
 * facteur **x3,4**. C est ce chiffre, faux mais parfaitement plausible, que
 * l ecran affichait — et une duree fausse qui a l air vraie ne se remarque
 * jamais.
 *
 * Ces tests verrouillent trois choses :
 *  1. le mode est PRODUIT a partir d un choix reel de la personne ;
 *  2. il est PORTE par le modele, donc survit au passage par le reseau ;
 *  3. il n est JAMAIS invente : une selection vide donne `pieton`, et un mode
 *     hors vocabulaire fait REFUSER le routage au lieu de retomber sur defaut.
 */

const A = { lat: 45.9237, lon: 6.8694 };
const B = { lat: 45.9819, lon: 6.9269 };

function selection(overrides: Partial<ActivitySelection> = {}): ActivitySelection {
  return { primary: null, extra: [], nights: [], ...overrides };
}

function draftAvec(activites: Partial<ActivitySelection>): AdventurePrepDraft {
  const base = fullDraft();
  return { ...base, activities: { ...base.activities, ...activites } };
}

function modelDepuis(draft: AdventurePrepDraft): ItineraryModel {
  const built = buildItinerary(
    draft.calendar.durationDays === null
      ? draft
      : { ...draft, calendar: { ...draft.calendar, durationIsSuggested: false } },
  );
  if (!built) throw new Error('modele attendu');
  const steps = built.steps.map((step, index) =>
    index % 2 === 0 ? { ...step, lat: A.lat, lon: A.lon } : { ...step, lat: B.lat, lon: B.lon },
  );
  return { ...built, steps };
}

describe('P0.30 — le mode de deplacement est PRODUIT', () => {
  it('P0-01 : une activite a velo produit le mode velo', () => {
    expect(travelModeFor(selection({ primary: 'velo-route' }))).toBe('velo');
  });

  it('P0-02 : le gravel et le bikepacking aussi — toute la categorie compte', () => {
    expect(travelModeFor(selection({ primary: 'gravel' }))).toBe('velo');
    expect(travelModeFor(selection({ primary: 'bikepacking' }))).toBe('velo');
  });

  it('P0-03 : un velo en COMPLEMENT suffit, meme sur une activite principale pietre', () => {
    expect(travelModeFor(selection({ primary: 'rando-journee', extra: ['velo-route'] }))).toBe('velo');
  });

  it('P0-04 : une randonnee seule reste pieton — CONTRE-TEMOIN du renvoi au defaut', () => {
    expect(travelModeFor(selection({ primary: 'rando-journee' }))).toBe('pieton');
    expect(travelModeFor(selection({ primary: 'rando-refuge' }))).toBe('pieton');
  });

  it('P0-05 : un road trip reste voiture — P0.22 ne doit pas avoir regresse', () => {
    expect(travelModeFor(selection({ primary: 'roadtrip' }))).toBe('voiture');
  });

  it('P0-06 : CONTRE-TEMOIN — selection vide ou inconnue => pieton, JAMAIS velo ni voiture', () => {
    expect(travelModeFor(selection())).toBe('pieton');
    expect(travelModeFor(selection({ primary: 'activite-inventee' }))).toBe('pieton');
    expect(travelModeFor(selection({ primary: '' }))).toBe('pieton');
    // Le mode invente ne doit apparaitre dans aucune combinaison possible.
    for (const primaire of [null, '', 'rando-journee', 'velo-route', 'roadtrip', 'inconnu']) {
      for (const extra of [[], ['velo-route'], ['canoe-journee']]) {
        expect(TRAVEL_MODES).toContain(travelModeFor(selection({ primary: primaire, extra })));
      }
    }
  });

  it('P0-07 : une nuit a velo ne bascule PAS le mode — le mode decrit la journee', () => {
    // Un bivouac ne dit rien de la facon de circuler le jour. Si une nuit
    // faisait basculer le mode, tous les kilometres du parcours changeraient
    // sur un choix qui ne les concerne pas.
    expect(travelModeFor(selection({ primary: 'rando-journee', nights: ['bikepacking'] }))).toBe('pieton');
  });
});

describe('P0.30 — le mode est PORTE par le modele', () => {
  it('P0-10 : le modele du repli regles porte le mode du parcours velo', () => {
    const model = buildItinerary(draftAvec({ primary: 'velo-route', extra: [], nights: [] }));
    expect(model?.travelMode).toBe('velo');
  });

  it('P0-11 : le modele de l etape 2 (IA) porte le meme mode', () => {
    const draft = draftAvec({ primary: 'velo-route', extra: [], nights: [] });
    const assemble = assembleModel(
      draft,
      { title: 'Boucle', days: 1, steps: [{ day: 1, kind: 'arret', title: 'Pause', placeName: null, startTime: null, durationMin: null, reason: null }], hypotheses: [] },
      [],
    );
    expect(assemble.travelMode).toBe('velo');
  });

  it('P0-12 : les DEUX constructeurs sont d accord — pas de divergence silencieuse', () => {
    for (const primaire of ['velo-route', 'rando-journee', 'roadtrip']) {
      const draft = draftAvec({ primary: primaire, extra: [], nights: [] });
      const regles = buildItinerary(draft);
      const ia = assembleModel(
        draft,
        { title: null, days: 1, steps: [], hypotheses: [] },
        [],
      );
      expect(regles?.travelMode).toBe(ia.travelMode);
    }
  });
});

describe('P0.30 — le mode conduit la MESURE', () => {
  it('P0-20 : un parcours velo interroge le routeur en mode velo', async () => {
    const modes: string[] = [];
    const deps: RoutingDeps = {
      route: async (_points, mode) => {
        modes.push(mode);
        return [{ distanceKm: 7.139, durationMin: 29.8, geometry: [] }];
      },
      elevation: async () => null,
    };
    await routeItinerary(modelDepuis(draftAvec({ primary: 'velo-route', extra: [], nights: [] })), deps);
    expect(modes.length).toBeGreaterThan(0);
    // Le point central de l item : le mode demande au routeur est bien velo.
    expect(new Set(modes)).toEqual(new Set(['velo']));
  });

  it('P0-21 : CONTRE-TEMOIN — un parcours pieton n interroge jamais en mode velo', async () => {
    const modes: string[] = [];
    const deps: RoutingDeps = {
      route: async (_points, mode) => {
        modes.push(mode);
        return null;
      },
      elevation: async () => null,
    };
    await routeItinerary(modelDepuis(draftAvec({ primary: 'rando-journee', extra: [], nights: [] })), deps);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes).not.toContain('velo');
    expect(new Set(modes)).toEqual(new Set(['pieton']));
  });

  it('P0-22 : un mode hors vocabulaire REFUSE le routage au lieu de retomber sur pieton', async () => {
    const route = vi.fn(async () => null);
    const model = { ...modelDepuis(draftAvec({ primary: 'velo-route', extra: [], nights: [] })), travelMode: 'avion' } as unknown as ItineraryModel;
    const avant = model.totals;
    const apres = await routeItinerary(model, { route, elevation: async () => null });
    // Un mode inconnu ne se remplace pas : le modele reste intact et intact
    // mesurable plutot que de porter des kilometres d un graphe devine.
    expect(route).not.toHaveBeenCalled();
    expect(apres.totals).toEqual(avant);
  });
});
