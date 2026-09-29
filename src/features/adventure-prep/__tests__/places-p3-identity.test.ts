import { describe, expect, it } from 'vitest';
import {
  assignPlaces,
  toCandidate,
  type BoundItineraryModel,
  type PlaceCandidate,
} from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

/**
 * P3.3 - IDENTITE.
 *
 * `placeId` doit porter l'identifiant du CATALOGUE quand la source en fournit
 * un, et `null` sinon. Le defaut historique etait un identifiant FABRIQUE
 * (`${name}:${lat}:${lng}`) qui passait pour une reference de catalogue alors
 * qu'aucune source ne l'avait jamais produit : une ligne OSM sans `id`
 * devenait une fausse reference cliquable et introuvable.
 *
 * Ces tests distinguent les deux : `catalogId` est la seule identite publiee,
 * `id` reste une cle interne de deduplication.
 */

/** Point d'interet tel que `/api/pois` le rend : la seule source d'identifiants. */
const REFUGE_CATALOGUE = {
  id: 'outdoor-1',
  name: 'Refuge du Gouter',
  category: 'refuge',
  lat: 45.8447,
  lng: 6.8427,
  tags: { price_per_night: 75 },
  is_verified: true,
};

/** Source OSM (amenities) : des coordonnees et un nom, mais AUCUN identifiant. */
const COMMERCE_OSM = {
  name: 'Boutique de randonnee',
  category: 'shop',
  lat: 45.9312,
  lon: 6.8701,
};

function model() {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

describe('P3.3 - ce que la source affirme, et rien de plus', () => {
  it('un identifiant de catalogue est conserve tel quel, sans derivation', () => {
    const candidate = toCandidate(REFUGE_CATALOGUE);
    expect(candidate?.catalogId).toBe('outdoor-1');
  });

  it('une source sans identifiant n en recoit AUCUN : jamais de "nom:lat:lon"', () => {
    const candidate = toCandidate(COMMERCE_OSM);
    expect(candidate).not.toBeNull();
    // Le defaut historique synthetisait `${name}:${lat}:${lng}` et le
    // publiait ensuite comme si un catalogue l'avait produit.
    expect(candidate?.catalogId).toBeNull();
    expect(typeof candidate?.catalogId).toBe('object'); // null explicite, jamais une chaine
    expect(String(candidate?.id)).toContain(':'); // la cle interne, elle, reste derivee
  });

  it('un identifiant vide ou blanc reste absent, il ne devient pas un nom', () => {
    expect(toCandidate({ ...REFUGE_CATALOGUE, id: '   ' })?.catalogId).toBeNull();
    expect(toCandidate({ ...REFUGE_CATALOGUE, id: 42 })?.catalogId).toBeNull();
  });

  it('sans mention explicite, un lieu n est pas "verifiable" : l absence se dit', () => {
    // `poi.is_verified !== false` affirmait la confiance de la base sur tous
    // les points qui n'en parlaient pas.
    expect(toCandidate(REFUGE_CATALOGUE)?.isVerifiable).toBe(true);
    expect(toCandidate({ ...REFUGE_CATALOGUE, is_verified: true })?.isVerifiable).toBe(true);
    expect(toCandidate({ ...REFUGE_CATALOGUE, is_verified: false })?.isVerifiable).toBe(false);
    expect(toCandidate({ ...COMMERCE_OSM, category: 'refuge' })?.isVerifiable).toBe(false);
  });
});

describe('P3.3 - placeId sur les etapes', () => {
  function assigner(candidates: readonly PlaceCandidate[]) {
    return assignPlaces(model(), candidates, CHAMONIX, ARGENTIERE) as BoundItineraryModel;
  }

  it('chaque etape porte un placeId explicite : identifiant de catalogue ou null', () => {
    const out = assigner([toCandidate(REFUGE_CATALOGUE)].filter((candidat): candidat is PlaceCandidate => candidat !== null));
    expect(out.steps.length).toBeGreaterThan(0);
    for (const step of out.steps) {
      expect(step, 'placeId doit toujours etre present, meme a null').toHaveProperty('placeId');
      expect(
        step.placeId === null || typeof step.placeId === 'string',
        'placeId doit valoir une chaine du catalogue ou null',
      ).toBe(true);
    }
  });

  it('un trajet qui part du lieu choisi par la personne reprend SON identifiant', () => {
    const out = assigner([toCandidate(REFUGE_CATALOGUE)].filter((candidat): candidat is PlaceCandidate => candidat !== null));
    const depart = out.steps.find((step) => step.kind === 'trajet');
    expect(depart?.placeName).toBe(CHAMONIX.name);
    expect(depart?.placeId).toBe(CHAMONIX.id);

    const arrivee = [...out.steps].reverse().find((step) => step.kind === 'trajet');
    expect(arrivee?.placeName).toBe(ARGENTIERE.name);
    expect(arrivee?.placeId).toBe(ARGENTIERE.id);
  });

  it('un point sans identifiant de catalogue ne laisse fuiter aucun identifiant fabrique', () => {
    const out = assigner([toCandidate(COMMERCE_OSM)].filter((candidat): candidat is PlaceCandidate => candidat !== null));
    for (const step of out.steps) {
      if (step.placeId === null) continue;
      // Toute valeur non nulle doit venir d'une source, jamais d'une
      // Seuls les lieux CHOISIS par la personne portent un identifiant ici :
      // le catalogue ne fournit aucun `id` pour ce commerce.
      expect([CHAMONIX.id, ARGENTIERE.id]).toContain(step.placeId);
    }
    const rattaches = out.steps.filter((step) => step.lat !== null);
    expect(rattaches.every((step) => step.placeId === null || [CHAMONIX.id, ARGENTIERE.id].includes(step.placeId))).toBe(true);
  });

  it('placeId survit a la copie, a la serialisation et au rechargement', () => {
    const out = assigner([toCandidate(REFUGE_CATALOGUE)].filter((candidat): candidat is PlaceCandidate => candidat !== null));
    const copie = { ...out, steps: out.steps.map((step) => ({ ...step })) };
    expect(copie.steps.every((step) => 'placeId' in step)).toBe(true);

    const relu = JSON.parse(JSON.stringify(out)) as BoundItineraryModel;
    expect(relu.steps.every((step) => 'placeId' in step)).toBe(true);
    expect(relu.steps.filter((s) => s.kind === 'trajet').map((s) => s.placeId)).toEqual([
      CHAMONIX.id,
      ARGENTIERE.id,
    ]);
  });

  it('sans aucun candidat, chaque etape reste explicitement sans identite', () => {
    const out = assigner([]);
    for (const step of out.steps) {
      expect(step).toHaveProperty('placeId');
      if (step.lat === null) expect(step.placeId).toBeNull();
    }
  });
});
