/**
 * P2.7 / P3.3 - UN LIEU CHOISI EST RATTACHE.
 *
 * Un point pose a la main sur la carte n appartient a aucun catalogue, et le
 * modele le dit : `placeName` et `placeId` a `null`.
 *
 * Mais l inverse existe deja dans l produit : la liste geolocalisee propose
 * des LIEUX REELS proches du trajet. Choisir l un d entre eux doit rattacher
 * l etape a ce lieu — son nom et son identifiant de catalogue — sinon le
 * parcours affiche « Point de passage » la ou il connaît un vrai nom, et la
 * liste ne peut plus dire quelle ligne a ete ajoutee.
 *
 * Regle de fer : sans lieu fourni, le comportement actuel ne change pas. Un
 * identifiant n est jamais fabrique pour un point qui n en a pas.
 */
import { describe, expect, it } from 'vitest';
import { insertWaypoint } from '../engine/dayNavigation';
import type { ItineraryModel } from '../types';

const JOUR: ItineraryModel = {
  title: null,
  days: 1,
  steps: [],
  totals: { distanceKm: 0, movingMin: 0, activityMin: 0, elevGainM: 0, elevLossM: 0 },
  perDay: [],
  weather: [],
  metricsContext: 'voyage',
    travelMode: 'voiture',
  budgetPerPerson: { amount: null, currency: 'EUR', state: 'a_reserver' },
  activityCount: 0,
  contingencies: [],
};

const COORD = { lat: 45.9312, lon: 6.8701 };

function premiere(model: ItineraryModel) {
  const step = model.steps[0];
  if (!step) throw new Error('aucune etape inseree');
  return step;
}

describe('P2.7 - un lieu choisi porte son identite, un point nu reste nu', () => {
  it('WP-ID-01 : sans lieu, le point nu reste sans nom ni identifiant', () => {
    // Comportement historique : ne doit pas bouger.
    const step = premiere(insertWaypoint(JOUR, COORD, 1));
    expect(step.placeName).toBeNull();
    expect(step.placeId).toBeNull();
  });

  it('WP-ID-02 : un lieu de catalogue rattache nom ET identifiant', () => {
    const step = premiere(
      insertWaypoint(JOUR, COORD, 1, undefined, undefined, {
        name: 'Marché U',
        catalogId: 'osm-amenity-42',
      }),
    );
    expect(step.placeName).toBe('Marché U');
    expect(step.placeId).toBe('osm-amenity-42');
  });

  it('WP-ID-03 : un lieu SANS identifiant conserve son nom et ne recoit rien de fabriqué', () => {
    const step = premiere(
      insertWaypoint(JOUR, COORD, 1, undefined, undefined, { name: 'Commerce de proximité' }),
    );
    expect(step.placeName).toBe('Commerce de proximité');
    expect(step.placeId).toBeNull();
    // Une cle synthetique se lirait comme une reference cliquable qui ne
    // mene nulle part.
    expect(String(step.placeId)).not.toContain(':');
  });

  it('WP-ID-04 : un nom vide ne fait pas disparaitre le lieu par hasard', () => {
    const step = premiere(
      insertWaypoint(JOUR, COORD, 1, undefined, undefined, { name: '   ', catalogId: 'osm-9' }),
    );
    // Le nom vide ne vaut pas nom : l ecran doit afficher « a verifier ».
    expect(step.placeName).toBeNull();
    // Mais l identifiant, lui, est reel : il se garde.
    expect(step.placeId).toBe('osm-9');
  });

  it('WP-ID-05 : les coordonnees du lieu restent celles du pointchoisi', () => {
    const step = premiere(
      insertWaypoint(JOUR, COORD, 1, undefined, undefined, { name: 'Marché U', catalogId: 'osm-42' }),
    );
    // Rattacher un nom ne doit pas deplacer le point sur la carte.
    expect(step.lat).toBe(COORD.lat);
    expect(step.lon).toBe(COORD.lon);
  });
});
