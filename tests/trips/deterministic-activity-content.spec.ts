import { describe, expect, it } from 'vitest';
import {
  buildDeterministicExpenses,
  buildDeterministicPois,
  buildDeterministicSteps,
  splitDays,
} from '@/features/trips/domain/deterministicActivityContent';
import type { TrailInput, TrailMetaInput } from '@/features/trips/domain/trailToActivity';

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

  it('durée > 0 : hébergement + nourriture, montants null (à estimer, jamais inventés)', () => {
    const lines = buildDeterministicExpenses(BASE_TRAIL, META_4H);

    expect(lines.map((line) => line.category)).toEqual(['hébergement', 'nourriture']);
    expect(lines.map((line) => line.title)).toEqual([
      'Hébergement — Tour du Lac Blanc',
      'Nourriture — Tour du Lac Blanc',
    ]);
    expect(lines.every((line) => line.amountEur === null)).toBe(true);
    expect(lines.every((line) => line.metadata.source === 'deterministic')).toBe(true);
  });

  it('multi-jours : ajoute la ligne transport', () => {
    const lines = buildDeterministicExpenses(
      { ...BASE_TRAIL, distanceKm: 45 },
      { durationHours: 16 }
    );

    expect(lines.map((line) => line.category)).toEqual(['hébergement', 'nourriture', 'transport']);
    expect(lines[2].title).toBe('Transport — Tour du Lac Blanc');
    expect(lines.every((line) => line.amountEur === null)).toBe(true);
  });

  it('durée absente : pas d’hébergement/nourriture, transport seulement si multi-jours', () => {
    const multiDay = buildDeterministicExpenses({ ...BASE_TRAIL, distanceKm: 45 }, null);
    expect(multiDay.map((line) => line.category)).toEqual(['transport']);

    const singleDay = buildDeterministicExpenses(BASE_TRAIL, null);
    expect(singleDay).toEqual([]);
  });

  it('durée 0 : aucune ligne hébergement/nourriture (rien d’inventé)', () => {
    expect(buildDeterministicExpenses(BASE_TRAIL, { durationHours: 0 })).toEqual([]);
  });

  it('partySize est tracé sans jamais inventer de montant', () => {
    const lines = buildDeterministicExpenses(BASE_TRAIL, META_4H, 4);

    expect(lines.every((line) => line.amountEur === null)).toBe(true);
    expect(lines.every((line) => line.metadata.partySize === 4)).toBe(true);
  });
});
