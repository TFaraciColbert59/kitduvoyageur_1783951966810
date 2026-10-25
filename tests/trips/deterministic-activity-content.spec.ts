import { describe, expect, it } from 'vitest';
import {
  buildDeterministicExpenses,
  buildDeterministicPois,
  buildDeterministicSteps,
  splitDays,
} from '@/features/trips/domain/deterministicActivityContent';
import type { TrailInput, TrailMetaInput } from '@/features/trips/domain/trailToActivity';
import {
  buildBudgetLines,
  sumBudgetLines,
  type PreparationLayers,
} from '@/features/trips/engine/autogenPreparation';

const BASE_TRAIL: TrailInput = {
  id: 42,
  name: 'Tour du Lac Blanc',
  ref: 'GR5',
  network: 'GR',
  distanceKm: 12.4,
  geom: { type: 'LineString', coordinates: [[2.0, 48.0], [2.1, 48.1]] },
};

const POLYLINE = [
  { lat: 48.0, lng: 2.0 },
  { lat: 48.03, lng: 2.03 },
  { lat: 48.06, lng: 2.06 },
  { lat: 48.09, lng: 2.09 },
];

describe('splitDays', () => {
  it('12 km / 4 h → 1 jour', () => {
    expect(splitDays(12, 4)).toBe(1);
  });

  it('45 km / 16 h → 3 jours (durée fournie prioritaire sur la distance)', () => {
    expect(splitDays(45, 16)).toBe(3);
  });

  it('bornes internes de 8 h : 7,9 h → 1, 8 h → 2, 16 h → 3 (durée explicite, distance nulle)', () => {
    expect(splitDays(null, 7.9)).toBe(1);
    expect(splitDays(null, 8)).toBe(2);
    expect(splitDays(null, 16)).toBe(3);
  });

  it('sans données → 1 jour (jamais 0 ni négatif)', () => {
    expect(splitDays(null, null)).toBe(1);
    expect(splitDays(0, 0)).toBe(1);
    expect(splitDays(-10, -3)).toBe(1);
  });

  it('durée absente → dérivée de la distance (45 km ÷ 4,5 km/h = 10 h → 2 jours)', () => {
    expect(splitDays(45, null)).toBe(2);
    expect(splitDays(12, null)).toBe(1);
  });

  it('borne haute à 14 jours', () => {
    expect(splitDays(10000, null)).toBe(14);
  });
});

describe('buildDeterministicSteps', () => {
  it('mono-jour : J1 = nom du sentier, départ 08:30, premier point réel', () => {
    const steps = buildDeterministicSteps(
      BASE_TRAIL,
      { durationHours: 4, elevationGain: 320 },
      POLYLINE
    );

    expect(steps).toHaveLength(1);
    const step = steps[0];
    expect(step.dayNumber).toBe(1);
    expect(step.orderIndex).toBe(0);
    expect(step.title).toBe('Tour du Lac Blanc');
    expect(step.description).toContain('Tour du Lac Blanc');
    expect(step.startTime).toBe('08:30');
    expect(step.latitude).toBe(48.0);
    expect(step.longitude).toBe(2.0);
    expect(step.distanceKm).toBe(12.4);
    expect(step.elevationGainM).toBe(320);
    expect(step.accommodationName).toBeNull();
    expect(step.transportMode).toBeNull();
    expect(step.source).toBe('deterministic');
    expect(step.metadata.source).toBe('deterministic');
  });

  it('multi-jours : répartition régulière, somme distance ≈ total, 08:30 puis 08:00', () => {
    const trail: TrailInput = { ...BASE_TRAIL, distanceKm: 45 };
    const steps = buildDeterministicSteps(
      trail,
      { durationHours: 16, elevationGain: 1200 },
      POLYLINE
    );

    expect(steps.map((step) => step.dayNumber)).toEqual([1, 2, 3]);
    expect(steps.map((step) => step.startTime)).toEqual(['08:30', '08:00', '08:00']);
    expect(steps[0].title).toBe('Tour du Lac Blanc');
    expect(steps[1].title).toContain('Tour du Lac Blanc');

    const totalKm = steps.reduce((sum, step) => sum + (step.distanceKm ?? 0), 0);
    expect(totalKm).toBeCloseTo(45, 2);
    expect(steps.map((step) => step.distanceKm)).toEqual([15, 15, 15]);

    const totalElevation = steps.reduce((sum, step) => sum + (step.elevationGainM ?? 0), 0);
    expect(totalElevation).toBe(1200);
    expect(steps.map((step) => step.elevationGainM)).toEqual([400, 400, 400]);

    expect(steps.every((step) => step.source === 'deterministic')).toBe(true);
    expect(steps.every((step) => step.metadata.source === 'deterministic')).toBe(true);
  });

  it('reliquat sur les premiers jours et somme exacte au centième', () => {
    const trail: TrailInput = { ...BASE_TRAIL, distanceKm: 10 };
    const steps = buildDeterministicSteps(trail, { durationHours: 16 }, POLYLINE);

    expect(steps.map((step) => step.distanceKm)).toEqual([3.34, 3.33, 3.33]);
    const totalKm = steps.reduce((sum, step) => sum + (step.distanceKm ?? 0), 0);
    expect(totalKm).toBeCloseTo(10, 2);
  });

  it('sans distance/durée/meta : une étape factuelle, valeurs inconnues à null', () => {
    const steps = buildDeterministicSteps(
      { id: 7, name: 'Sentier Brut', geom: { type: 'LineString', coordinates: [] } },
      null,
      POLYLINE
    );

    expect(steps).toHaveLength(1);
    expect(steps[0].distanceKm).toBeNull();
    expect(steps[0].elevationGainM).toBeNull();
    expect(steps[0].startTime).toBe('08:30');
    expect(steps[0].source).toBe('deterministic');
  });

  it('polyligne vide : coordonnées null (jamais inventées)', () => {
    const steps = buildDeterministicSteps(BASE_TRAIL, { durationHours: 4 }, []);

    expect(steps).toHaveLength(1);
    expect(steps[0].latitude).toBeNull();
    expect(steps[0].longitude).toBeNull();
  });
});

describe('buildDeterministicPois', () => {
  const RAW_POIS = [
    { id: 1, name: 'Refuge du Lac', category: 'refuge', lat: 48.01, lng: 2.01 },
    { id: 2, name: '  refuge   du   lac ', category: 'abri', lat: 48.02, lng: 2.02 },
    { id: 3, name: 'Refuge du Lac', category: null, lat: 48.03, lng: 2.03 },
    { id: 4, name: 'Col du Midi', category: 'sommet', lat: 48.04, lng: 2.04 },
  ];

  it('déduplique par nom normalisé (casse/espaces) en gardant le premier POI réel', () => {
    const drafts = buildDeterministicPois(RAW_POIS);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      name: 'Refuge du Lac',
      latitude: 48.01,
      longitude: 2.01,
      source: 'deterministic',
    });
    expect(drafts[0].metadata.category).toBe('refuge');
    expect(drafts[1].name).toBe('Col du Midi');
  });

  it('plafonne à 20 POI', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `POI ${i + 1}`,
      category: 'divers',
      lat: 48 + i * 0.001,
      lng: 2 + i * 0.001,
    }));

    const drafts = buildDeterministicPois(many);

    expect(drafts).toHaveLength(20);
    expect(drafts[drafts.length - 1].name).toBe('POI 20');
    expect(drafts.every((draft) => draft.source === 'deterministic')).toBe(true);
  });

  it('ignore noms vides et coordonnées invalides, catégorie absente → null', () => {
    const drafts = buildDeterministicPois([
      { id: 1, name: '   ', category: 'x', lat: 48, lng: 2 },
      { id: 2, name: 'Sans catégorie', category: null, lat: 48.1, lng: 2.1 },
      { id: 3, name: 'Coordonnées invalides', category: 'x', lat: Number.NaN, lng: 2.2 },
    ]);

    expect(drafts.map((draft) => draft.name)).toEqual(['Sans catégorie']);
    expect(drafts[0].metadata.category).toBeNull();
    expect(drafts[0].metadata.source).toBe('deterministic');
  });
});

describe('buildDeterministicExpenses', () => {
  const META_4H: TrailMetaInput = { durationHours: 4 };
  const TOTAL_LAYERS: PreparationLayers = {
    budget: { value: { totalPerPersonEur: 100, dailyAverageEur: 50, currency: 'EUR' } },
  };
  const DAILY_LAYERS: PreparationLayers = {
    budget: { value: { dailyAverageEur: 50, currency: 'EUR' } },
  };

  it('répartit le total réel en 6 catégories, chacune > 0, somme exacte', () => {
    const expected = buildBudgetLines(TOTAL_LAYERS, 2, 1, []);
    expect(expected).toHaveLength(6);

    const lines = buildDeterministicExpenses(BASE_TRAIL, META_4H, 2, TOTAL_LAYERS);

    expect(lines.map((line) => line.category)).toEqual([
      'hébergement',
      'nourriture',
      'transport',
      'activités',
      'matériel',
      'divers',
    ]);
    expect(lines.map((line) => line.title)).toEqual([
      'Budget prévisionnel — Hébergement',
      'Budget prévisionnel — Nourriture',
      'Budget prévisionnel — Transport',
      'Budget prévisionnel — Activités',
      'Budget prévisionnel — Matériel',
      'Budget prévisionnel — Divers',
    ]);
    expect(lines.every((line) => line.amountEur > 0)).toBe(true);
    expect(sumBudgetLines(expected)).toBe(200); // 100 €/personne × 2 voyageurs
    expect(Math.round(lines.reduce((sum, line) => sum + line.amountEur * 100, 0))).toBe(20000);
    expect(lines.every((line) => line.metadata.source === 'deterministic')).toBe(true);
    expect(
      lines.every((line) => line.metadata.formula === 'autogenPreparation.buildBudgetLines@v1')
    ).toBe(true);
    expect(lines.every((line) => line.metadata.partySize === 2)).toBe(true);
  });

  it('multi-jours : même total réel réparti (règle daily_average, somme exacte)', () => {
    const expected = buildBudgetLines(DAILY_LAYERS, 1, 3, []);
    expect(sumBudgetLines(expected)).toBe(150); // 50 €/jour × 3 jours × 1 voyageur

    const lines = buildDeterministicExpenses(
      { ...BASE_TRAIL, distanceKm: 45 },
      { durationHours: 16 },
      1,
      DAILY_LAYERS
    );

    expect(lines).toHaveLength(6);
    expect(Math.round(lines.reduce((sum, line) => sum + line.amountEur * 100, 0))).toBe(15000);
    expect(lines[2].category).toBe('transport');
  });

  it('reliquat au centime sur les premières lignes, jamais de montant nul', () => {
    const expected = buildBudgetLines(TOTAL_LAYERS, 1, 3, []);
    expect(sumBudgetLines(expected)).toBe(100);

    const lines = buildDeterministicExpenses(
      { ...BASE_TRAIL, distanceKm: 45 },
      { durationHours: 16 },
      1,
      TOTAL_LAYERS
    );

    expect(lines.map((line) => line.amountEur)).toEqual([
      16.67, 16.67, 16.67, 16.67, 16.66, 16.66,
    ]);
    expect(Math.round(lines.reduce((sum, line) => sum + line.amountEur * 100, 0))).toBe(10000);
    expect(lines.every((line) => Number.isFinite(line.amountEur) && line.amountEur > 0)).toBe(true);
  });

  it('sans métriques de sentier : le budget réel reste réparti en 6 catégories', () => {
    const expected = buildBudgetLines(TOTAL_LAYERS, 1, 1, []);

    const lines = buildDeterministicExpenses(
      { id: 7, name: 'Sentier Brut', geom: { type: 'LineString', coordinates: [] } },
      null,
      1,
      TOTAL_LAYERS
    );

    expect(lines).toHaveLength(6);
    expect(lines.map((line) => line.category)).toEqual(expected.map((line) => line.category));
    expect(Math.round(lines.reduce((sum, line) => sum + line.amountEur * 100, 0))).toBe(10000);
  });

  it('couche budget absente/sans montant : aucune ligne inventée', () => {
    // Le budget réel ne dépend pas de la durée sentier : il reste réparti.
    expect(
      buildDeterministicExpenses(BASE_TRAIL, { durationHours: 0 }, 1, TOTAL_LAYERS)
    ).toHaveLength(6);
    expect(buildDeterministicExpenses(BASE_TRAIL, META_4H, 1, null)).toEqual([]);
    expect(buildDeterministicExpenses(BASE_TRAIL, META_4H, 1, {})).toEqual([]);
    expect(
      buildDeterministicExpenses(BASE_TRAIL, META_4H, 1, { budget: { value: {} } })
    ).toEqual([]);
  });

  it('déterminisme bit à bit sur appels répétés', () => {
    const input: TrailInput = { ...BASE_TRAIL, distanceKm: 45 };
    const first = buildDeterministicExpenses(input, { durationHours: 16 }, 2, TOTAL_LAYERS);
    const second = buildDeterministicExpenses(input, { durationHours: 16 }, 2, TOTAL_LAYERS);

    expect(second).toEqual(first);
    expect(first.every((line) => line.amountEur > 0)).toBe(true);
  });
});
