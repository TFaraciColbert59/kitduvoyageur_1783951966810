import { describe, expect, it } from 'vitest';
import { buildItinerary, daySteps } from '../engine/itinerary';
import type { ItineraryModel, MealSlot } from '../types';
import { CHAMONIX, fullDraft } from './fixtures';

/** Rando a la journee : le cas le plus simple, celui qui donnait une seule etape. */
function outing(overrides: Parameters<typeof fullDraft>[0] = {}): ItineraryModel {
  const draft = fullDraft({
    activities: { primary: 'rando-journee', extra: [], nights: [] },
    route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
    calendar: {
      startDate: '2026-07-11',
      durationDays: 1,
      durationIsSuggested: true,
      returnDate: '2026-07-11',
    },
    preferences: {
      budgetPerPerson: null,
      budgetLevel: 'modere',
      pace: 'normal',
      transport: 'peigne',
      interests: [],
      accessibilityNeeds: [],
    },
    group: { mode: 'solo', adults: 1, children: 0, hasPets: false, knownMembers: [] },
    ...overrides,
  });
  const built = buildItinerary(draft);
  if (!built) throw new Error('modele attendu');
  return built;
}

const kinds = (model: ItineraryModel, day = 1) => daySteps(model, day).map((s) => s.kind);
const mealSlots = (model: ItineraryModel) =>
  model.steps.map((s) => s.mealSlot).filter((s): s is MealSlot => s !== null && s !== undefined);

describe('parcours propose : une sortie n est jamais reduite au depart', () => {
  it('propose plusieurs etapes pour une sortie a la journee', () => {
    const model = outing();
    expect(model.steps.length).toBeGreaterThanOrEqual(4);
  });

  it('garde le depart en premiere position', () => {
    const model = outing();
    expect(model.steps[0].kind).toBe('trajet');
    expect(model.steps[0].placeName).toBe(CHAMONIX.name);
  });

  it('propose de quoi se ravitailler et une pause sur le parcours', () => {
    const model = outing();
    expect(kinds(model)).toContain('ravitaillement');
    expect(kinds(model)).toContain('arret');
  });

  it('propose un repas pour chaque journee', () => {
    const model = outing();
    expect(mealSlots(model)).toContain('dejeuner');
  });

  it('donne une raison lisible a chaque etape proposee', () => {
    for (const step of outing().steps) {
      expect(typeof step.reason).toBe('string');
      expect((step.reason ?? '').length).toBeGreaterThan(4);
    }
  });
});

describe('parcours propose : aucune donnee inventee', () => {
  it('ne sort ni duree, ni coordonnee, ni nom de lieu trouve', () => {
    for (const step of outing().steps) {
      expect(step.durationMin).toBeNull();
      expect(step.lat).toBeNull();
      expect(step.lon).toBeNull();
      expect(step.startTime).toBeNull();
      if (step.kind !== 'trajet') expect(step.placeName).toBeNull();
    }
  });

  it('ne propose un prix que pour le trajet a pied, seul cout deduit du choix', () => {
    const model = outing();
    const tarifs = model.steps.filter((s) => s.price.amount !== null);
    expect(tarifs.every((s) => s.kind === 'trajet')).toBe(true);
    for (const step of tarifs) {
      expect(step.price.amount).toBe(0);
      expect(step.price.state).toBe('propose');
    }
  });

  it('n announce ni distance ni denivele pendant la generation', () => {
    const model = outing();
    expect(model.totals.distanceKm).toBeNull();
    expect(model.totals.elevGainM).toBeNull();
  });

  it('produit le meme parcours deux fois de suite', () => {
    expect(JSON.stringify(outing())).toBe(JSON.stringify(outing()));
  });
});

describe('parcours propose : il s adapte au groupe et aux choix', () => {
  it('ajoute une pause quand des enfants participent', () => {
    const model = outing({
      group: { mode: 'groupe', adults: 2, children: 2, hasPets: false, knownMembers: [] },
    });
    expect(kinds(model)).toContain('repos');
  });

  it('ajoute une pause quand un besoin d accessibilite est declare', () => {
    const model = outing({
      preferences: {
        budgetPerPerson: null,
        budgetLevel: 'modere',
        pace: 'normal',
        transport: 'peigne',
        interests: [],
        accessibilityNeeds: ['poussette'],
      },
    });
    expect(kinds(model)).toContain('repos');
  });

  it('conserve le repas meme en rythme rapide, et ne garde que les pauses utiles', () => {
    const rapide = outing({
      preferences: {
        budgetPerPerson: null,
        budgetLevel: 'modere',
        pace: 'rapide',
        transport: 'peigne',
        interests: [],
        accessibilityNeeds: [],
      },
    });
    expect(kinds(rapide)).not.toContain('repos');
    expect(mealSlots(rapide)).toContain('dejeuner');
  });

  it('transforme un interet declare en etape proposee', () => {
    const gastronomie = outing({
      preferences: {
        budgetPerPerson: null,
        budgetLevel: 'modere',
        pace: 'normal',
        transport: 'peigne',
        interests: ['Gastronomie'],
        accessibilityNeeds: [],
      },
    });
    const patrimoine = outing({
      preferences: {
        budgetPerPerson: null,
        budgetLevel: 'modere',
        pace: 'normal',
        transport: 'peigne',
        interests: ['Patrimoine'],
        accessibilityNeeds: [],
      },
    });
    const gastronomes = gastronomie.steps.filter((s) => /repas|restaurant/i.test(s.title));
    const patrimoineSteps = patrimoine.steps.filter((s) => /visite|patrimoine/i.test(s.title));
    expect(gastronomes.length).toBeGreaterThan(0);
    expect(patrimoineSteps.length).toBeGreaterThan(0);
  });

  it('ne propose pas deux fois le meme interet dans la meme journee', () => {
    const model = outing({
      preferences: {
        budgetPerPerson: null,
        budgetLevel: 'modere',
        pace: 'normal',
        transport: 'peigne',
        interests: ['Gastronomie', 'gastronomie'],
        accessibilityNeeds: [],
      },
    });
    const repas = model.steps.filter((s) => /repas/i.test(s.title));
    expect(repas).toHaveLength(1);
  });
});

describe('parcours propose : la structure sur plusieurs jours reste intacte', () => {
  it('garde une nuit par journee terminee et pas pour le dernier soir', () => {
    const draft = fullDraft();
    const built = buildItinerary(draft);
    if (!built) throw new Error('modele attendu');
    const nuits = built.steps.filter((s) => s.kind === 'nuit');
    expect(nuits).toHaveLength(2);
    expect(nuits.map((n) => n.day)).toEqual([1, 2]);
  });

  it('garde le retour du dernier jour quand l arrivee existe', () => {
    const draft = fullDraft();
    const built = buildItinerary(draft);
    if (!built) throw new Error('modele attendu');
    const derniers = daySteps(built, 3);
    expect(derniers.some((s) => s.kind === 'trajet' && s.day === 3)).toBe(true);
  });

  it('chaque journee du sejour porte au moins un ravitaillement', () => {
    const draft = fullDraft();
    const built = buildItinerary(draft);
    if (!built) throw new Error('modele attendu');
    for (let day = 1; day <= built.days; day += 1) {
      expect(daySteps(built, day).some((s) => s.kind === 'ravitaillement')).toBe(true);
    }
  });
});
/* ------------------------------------------------------------------ */
/* Activites combinees                                                 */
/* ------------------------------------------------------------------ */

describe('parcours propose : une aventure peut combiner plusieurs activites', () => {
  it('fait apparaitre l activite complementaire choisie dans la journee', () => {
    // Le catalogue autorise une aventure multi-activites (une randonnee qui
    // finit en canoe). Tant que la structure ne porte que la principale, le
    // choix de l utilisateur disparait du parcours alors qu il s affiche dans
    // le resume de l etape 1.
    const model = outing({
      activities: { primary: 'rando-journee', extra: ['canoe-journee'], nights: [] },
    });
    const canoE = daySteps(model, 1).filter((s) => /cano/i.test(s.title));
    expect(canoE).toHaveLength(1);
  });

  it('n invente ni lieu ni heure pour l activite complementaire', () => {
    const model = outing({
      activities: { primary: 'rando-journee', extra: ['canoe-journee'], nights: [] },
    });
    const canoE = daySteps(model, 1).find((s) => /cano/i.test(s.title));
    expect(canoE?.placeName).toBeNull();
    expect(canoE?.startTime).toBeNull();
  });

  it('donne une raison lisible qui reprend le choix de la personne', () => {
    const model = outing({
      activities: { primary: 'rando-journee', extra: ['canoe-journee'], nights: [] },
    });
    const canoE = daySteps(model, 1).find((s) => /cano/i.test(s.title));
    expect(canoE?.reason).toMatch(/cano/i);
  });

  it('ne cree pas de doublon quand l activite complementaire est la principale', () => {
    const model = outing({
      activities: { primary: 'rando-journee', extra: ['rando-journee'], nights: [] },
    });
    const rando = daySteps(model, 1).filter((s) => /randonn/i.test(s.title));
    expect(rando).toHaveLength(0);
  });

  it('ignore une activite complementaire inconnue plutot que de l afficher', () => {
    const model = outing({
      activities: { primary: 'rando-journee', extra: ['activite-inconnue'], nights: [] },
    });
    expect(model.steps.some((s) => /inconnue/i.test(s.title))).toBe(false);
  });

  it('reconnait la nuit de bivouac ajoutee a l aventure', () => {
    const model = outing({
      calendar: {
        startDate: '2026-07-11',
        durationDays: 2,
        durationIsSuggested: false,
        returnDate: '2026-07-12',
      },
      activities: { primary: 'rando-journee', extra: [], nights: ['bivouac'] },
    });
    expect(daySteps(model, 1).some((s) => /bivouac/i.test(s.title))).toBe(true);
    expect(daySteps(model, 2).some((s) => /bivouac/i.test(s.title))).toBe(false);
  });
});
