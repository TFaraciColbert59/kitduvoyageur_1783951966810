/**
 * Lieux reels — le preparateur ne propose pas « Pause nature » dans le vide :
 * il rattache chaque etape a un point d interet qui EXISTE, avec ses
 * coordonnees, et son prix quand la base en fournit un.
 *
 * Regles :
 *  1. un candidat sans nom ou sans coordonnees est refuse ;
 *  2. un point n est jamais attribue a deux etapes ;
 *  3. aucun prix n est invente : `tags.price_per_night` est reporte tel quel,
 *     l absence reste « a verifier » ;
 *  4. le modele d origine n est jamais modifie.
 */
import { describe, expect, it } from 'vitest';
import { assignPlaces, kindCategories, toCandidate, dayBudget, type PlaceCandidate } from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import type { ItineraryModel, ItineraryStepKind } from '../types';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';

/** Point d interet brut tel que `/api/pois` le rend. */
const REFUGE = {
  id: 'outdoor-1',
  name: 'Refuge du Gouter',
  category: 'refuge',
  lat: 45.8447,
  lng: 6.8427,
  altitude_m: 3835,
  description: 'Refuge d altitude sur la voie normale du Mont Blanc',
  region: 'Haute-Savoie',
  country: 'France',
  capacity: 120,
  phone: null,
  website: null,
  tags: { capacity: 120, has_meals: true, is_staffed: true, price_per_night: 75 },
  source: 'outdoor_points',
  is_verified: true,
};

const BELVEDERE = {
  id: 'outdoor-2',
  name: 'Belvedere des Aiguilles',
  category: 'viewpoint',
  lat: 45.879,
  lng: 6.8873,
  description: 'Point de vue sur les Drus',
  region: 'Haute-Savoie',
  country: 'France',
  source: 'outdoor_points',
};

const SOURCE = {
  id: 'outdoor-3',
  name: 'Source de l Arve',
  category: 'water',
  lat: 45.9,
  lng: 6.86,
  is_potable: true,
  source: 'outdoor_points',
};

describe('normalisation d un point d interet', () => {
  it('conserve le nom, la position et le prix reellement stocke', () => {
    const candidate = toCandidate(REFUGE);
    expect(candidate).toMatchObject({
      id: 'outdoor-1',
      name: 'Refuge du Gouter',
      category: 'refuge',
      lat: 45.8447,
      lon: 6.8427,
      pricePerNight: 75,
    });
  });

  it('un point sans coordonnees ou sans nom est refuse', () => {
    expect(toCandidate({ ...REFUGE, lat: null })).toBeNull();
    expect(toCandidate({ ...REFUGE, name: '   ' })).toBeNull();
    expect(toCandidate(null)).toBeNull();
  });

  it('un prix absent reste absent, il ne devient pas zero', () => {
    const candidate = toCandidate({ ...REFUGE, tags: { capacity: 120 } });
    expect(candidate?.pricePerNight).toBeNull();
  });

  it('la categorie inconnue retombe sur « poi » sans inventer de nature', () => {
    expect(toCandidate({ ...BELVEDERE, category: 'xyz' })?.category).toBe('poi');
  });
});

describe('compatibilite avec le type d etape', () => {
  it('une nuit cherche un hebergement, un ravitaillement cherche de l eau', () => {
    expect(kindCategories('nuit')).toContain('refuge');
    expect(kindCategories('ravitaillement')).toContain('water');
    expect(kindCategories('arret')).toContain('viewpoint');
  });

  it('une pause se rattache a un point de vue, un trajet a rien', () => {
    // Une pause se fait quelque part. La laisser sans categorie la rendait
    // introuvable DEFINITIVEMENT, donc chaque journee portant une pause restait
    // « a verifier » sur la distance, le denivele et la duree. Le trajet, lui,
    // ne se remplace pas : ce sont les lieux choisis par la personne.
    expect(kindCategories('repos')).toContain('viewpoint');
    expect(kindCategories('repos')).toContain('col');
    expect(kindCategories('trajet')).toEqual([]);
  });

  it('un type d etape inconnu ne propose rien plutot que tout', () => {
    expect(kindCategories('inconnu' as ItineraryStepKind)).toEqual([]);
  });
});

describe('attribution', () => {
  function model(): ItineraryModel {
    const built = buildItinerary(
      fullDraft({ calendar: { startDate: '2026-07-11', durationDays: 2, durationIsSuggested: false, startDateIsSuggested: false, returnDate: null } }),
    );
    if (!built) throw new Error('modele attendu');
    return built;
  }

  const candidates: PlaceCandidate[] = [REFUGE, BELVEDERE, SOURCE].map(
    (poi) => toCandidate(poi) as PlaceCandidate,
  );

  it('rattache un lieu a chaque etape compatible et ecrit ses coordonnees', () => {
    const out = assignPlaces(model(), candidates, CHAMONIX, ARGENTIERE);
    const placed = out.steps.filter((step) => step.lat !== null);
    expect(placed.length).toBeGreaterThan(0);
    for (const step of placed) {
      expect(step.placeName).toBeTruthy();
      expect(step.lon).not.toBeNull();
    }
  });

  it('n attribue jamais le meme point a deux etapes', () => {
    const out = assignPlaces(model(), candidates, CHAMONIX, ARGENTIERE);
    const ids = out.steps.map((s) => `${s.lat},${s.lon}`).filter((k) => k !== 'null,null');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('le premier et le dernier trajet gardent les lieux choisis par la personne', () => {
    const out = assignPlaces(model(), candidates, CHAMONIX, ARGENTIERE);
    const first = out.steps.find((step) => step.kind === 'trajet');
    expect(first?.placeName).toBe(CHAMONIX.name);
    const last = [...out.steps].reverse().find((step) => step.kind === 'trajet');
    expect(last?.placeName).toBe(ARGENTIERE.name);
  });

  it('reporte le prix reel d une nuit, et rien quand la base n en a pas', () => {
    const out = assignPlaces(model(), candidates, CHAMONIX, ARGENTIERE);
    const nights = out.steps.filter((step) => step.kind === 'nuit');
    expect(nights.length).toBeGreaterThan(0);
    for (const night of nights) {
      expect(night.price.amount).toBe(75);
      expect(night.price.state).toBe('propose');
    }
  });

  it('sans candidat, l etape reste sans lieu et sans prix', () => {
    const out = assignPlaces(model(), [], CHAMONIX, ARGENTIERE);
    expect(out.steps.every((step) => step.lat === null || step.kind === 'trajet')).toBe(true);
  });

  it('le modele d origine reste intact', () => {
    const before = JSON.stringify(model());
    assignPlaces(model(), candidates, CHAMONIX, ARGENTIERE);
    expect(JSON.stringify(model())).toBe(before);
  });
});

describe('budget par journee', () => {
  it('ne presente jamais une somme partielle comme un total complet', () => {
    const built = buildItinerary(fullDraft());
    if (!built) throw new Error('modele attendu');
    const steps = built.steps.map((step, index) =>
      index === 0 ? { ...step, price: { amount: 40, currency: 'EUR' as const, state: 'propose' as const } } : step,
    );
    const budget = dayBudget({ ...built, steps }, 1);
    // La somme connue reste lisible...
    expect(budget.known).toBe(40);
    // ...mais elle n est jamais presentee comme le total du jour.
    expect(budget.unknownCount).toBeGreaterThan(0);
    expect(budget.complete).toBe(false);
  });

  it('compte les etapes sans prix et ne les invente pas', () => {
    const built = buildItinerary(fullDraft());
    if (!built) throw new Error('modele attendu');
    const steps = built.steps.map((step, index) =>
      index === 0 ? { ...step, price: { amount: 40, currency: 'EUR' as const, state: 'propose' as const } } : step,
    );
    const dayOne = steps.filter((step) => step.day === 1);
    const unknownCount = dayOne.filter((step) => step.price.amount === null).length;
    expect(dayBudget({ ...built, steps }, 1).unknownCount).toBe(unknownCount);
  });

  it('un jour entierement depourvu de prix ne presente aucune somme', () => {
    const built = buildItinerary(fullDraft());
    if (!built) throw new Error('modele attendu');
    expect(dayBudget(built, 1).known).toBe(0);
    expect(dayBudget(built, 1).none).toBe(true);
  });

  it('additionne les prix connus quand toute la journee est pricee', () => {
    const built = buildItinerary(fullDraft());
    if (!built) throw new Error('modele attendu');
    const priced = { amount: 10, currency: 'EUR' as const, state: 'propose' as const };
    const steps = built.steps.map((step) => ({ ...step, price: priced }));
    const dayOneSteps = built.steps.filter((step) => step.day === 1).length;
    expect(dayOneSteps).toBeGreaterThan(0);
    const budget = dayBudget({ ...built, steps }, 1);
    expect(budget.known).toBe(10 * dayOneSteps);
    expect(budget.complete).toBe(true);
    expect(budget.unknownCount).toBe(0);
  });

  it('un jour sans etape ne vaut pas zero euros', () => {
    const built = buildItinerary(fullDraft());
    if (!built) throw new Error('modele attendu');
    expect(dayBudget(built, 99).none).toBe(true);
  });
});
