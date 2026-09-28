import { describe, it, expect } from 'vitest';
import { buildTripCommit } from '../tripCommit';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft, CHAMONIX } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/** Brouillon enregistreable : le modele est deja calcule par le moteur. */
function committable(overrides: Partial<AdventurePrepDraft> = {}) {
  const draft = fullDraft(overrides);
  return { ...draft, itinerary: buildItinerary(draft) };
}

describe('buildTripCommit — preparation de la persistance', () => {
  it('renseigne le lieu de depart comme destination du voyage', () => {
    expect(buildTripCommit(committable()).trip.destination_name).toBe(CHAMONIX.name);
  });

  it('n invente aucune date de fin quand la duree est inconnue', () => {
    const commit = buildTripCommit(
      committable({
        calendar: {
          startDate: '2026-07-11',
          durationDays: null,
          durationIsSuggested: false,
          startDateIsSuggested: false,
          returnDate: null,
        },
      }),
    );
    expect(commit.trip.start_date).toBe('2026-07-11');
    expect(commit.trip.end_date).toBeNull();
  });

  it('calcule une date de fin reelle a partir de la duree connue', () => {
    expect(buildTripCommit(committable()).trip.end_date).toBe('2026-07-13');
  });

  it('produit un slug stable et conforme a la contrainte SQL', () => {
    const { slug } = buildTripCommit(committable()).trip;
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slug.length).toBeGreaterThanOrEqual(3);
    expect(slug.length).toBeLessThanOrEqual(120);
  });

  it('utilise le nom personnalise quand il existe', () => {
    expect(buildTripCommit(committable({ coverName: 'Traversee des Aiguilles' })).trip.title).toBe(
      'Traversee des Aiguilles',
    );
  });

  it('derive un titre des lieux quand aucun nom n est choisi', () => {
    const title = buildTripCommit(committable({ coverName: null })).trip.title;
    expect(title).toContain(CHAMONIX.name);
  });

  it('produit un titre valide meme sans nom ni lieu', () => {
    const title = buildTripCommit(
      committable({
        coverName: null,
        route: { origin: null, destination: null, shape: 'boucle' },
      }),
    ).trip.title;
    expect(title.length).toBeGreaterThanOrEqual(3);
  });

  it('projette chaque etape avec son jour et son rang', () => {
    const model = buildItinerary(fullDraft());
    if (!model) throw new Error('modele attendu');
    const commit = buildTripCommit(committable());
    expect(commit.steps).toHaveLength(model.steps.length);
    expect(commit.steps[0]?.day_number).toBe(model.steps[0]?.day);
    expect(commit.steps[0]?.order_index).toBe(0);
    expect(commit.steps[0]?.title).toBe(model.steps[0]?.title);
  });

  it('ne reporte une distance que si elle est reellement mesuree', () => {
    for (const step of buildTripCommit(committable()).steps) {
      if (step.distance_km !== null) expect(step.distance_km).toBeGreaterThanOrEqual(0);
    }
  });

  it('porte la distance reelle du jour sur la premiere etape de chaque journee', () => {
    const model = buildItinerary(fullDraft());
    if (!model) throw new Error('modele attendu');
    const commit = buildTripCommit(committable());
    for (const step of commit.steps) {
      if (step.order_index !== 0) continue;
      const totals = model.perDay[step.day_number - 1];
      expect(step.distance_km).toBe(totals ? totals.distanceKm : null);
      expect(step.elevation_gain_m).toBe(totals ? totals.elevGainM : null);
    }
  });

  it('n associe une distance journaliere qu a la premiere etape du jour', () => {
    const commit = buildTripCommit(committable());
    for (const step of commit.steps) {
      if (step.order_index > 0) expect(step.distance_km).toBeNull();
    }
  });

  it('ne persiste aucun prix invente', () => {
    for (const step of buildTripCommit(committable()).steps) {
      expect(Object.prototype.hasOwnProperty.call(step, 'price')).toBe(false);
    }
  });

  it('garde des coordonnees nulles en null plutot que 0', () => {
    for (const step of buildTripCommit(committable()).steps) {
      if (step.latitude === null) expect(step.longitude).toBeNull();
    }
  });

  it('reste immuable', () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    const snapshot = { ...draft, itinerary: model };
    const before = JSON.stringify(snapshot);
    buildTripCommit(snapshot);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('laisse la destination nulle quand aucun lieu n est connu', () => {
    const commit = buildTripCommit(
      committable({ route: { origin: null, destination: null, shape: 'boucle' } }),
    );
    expect(commit.trip.destination_name).toBeNull();
  });

  it('conserve le budget par personne quand il est connu et le laisse null sinon', () => {
    expect(buildTripCommit(committable()).trip.estimated_budget).toBe(90);
    const without = committable({
      preferences: {
        budgetPerPerson: null,
        budgetLevel: 'modere',
        pace: 'normal',
        transport: 'train',
        interests: [],
        accessibilityNeeds: [],
      },
    });
    expect(buildTripCommit(without).trip.estimated_budget).toBeNull();
  });

  it('renseigne le mode et l effectif dans les metadonnees', () => {
    const meta = buildTripCommit(committable()).trip.metadata.prep as Record<string, unknown>;
    expect(meta.adults).toBe(2);
    expect(meta.children).toBe(0);
  });

  it('marque le voyage comme planifie et prive par defaut', () => {
    const trip = buildTripCommit(committable()).trip;
    expect(trip.status).toBe('planned');
    expect(trip.visibility).toBe('private');
    expect(trip.budget_currency).toBe('EUR');
  });
});
