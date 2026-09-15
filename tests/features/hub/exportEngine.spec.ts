import { describe, it, expect } from 'vitest';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';
import {
  buildExportProgram,
  buildExportSummaryCards,
  type ExportSummaryCard,
} from '@/features/hub/mobile/exportEngine';

function trip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 't1',
    slug: 'gr20',
    title: 'GR20',
    start_date: '2026-09-07',
    end_date: '2026-09-09',
    collaborators: [{ id: 'c1' }, { id: 'c2' }],
    steps: [
      { id: 's1', day_number: 1, order_index: 0, distance_km: 10, elevation_gain_m: 300, elevation_loss_m: 100 },
      { id: 's2', day_number: 2, order_index: 0, distance_km: 12, elevation_gain_m: 400, elevation_loss_m: 200 },
    ],
    items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }],
    expenses: [{ id: 'e1', amount: 50 }, { id: 'e2', amount: 30 }],
    documents: [{ id: 'd1' }],
    notes: [{ id: 'n1' }, { id: 'n2' }],
    safety_checkpoints: [{ id: 'cp1' }, { id: 'cp2' }, { id: 'cp3' }],
    pois: [{ id: 'p1' }, { id: 'p2' }],
    ...overrides,
  } as unknown as TripFull;
}

const STATS = {
  total_days: 3,
  total_distance_km: 22,
  total_elevation_gain_m: 700,
  total_elevation_loss_m: 300,
} as TripStats;

const BUDGET = { totalSpent: 80, currency: 'EUR' } as BudgetSummary;

function card(cards: ExportSummaryCard[], key: string): ExportSummaryCard | undefined {
  return cards.find((entry) => entry.key === key);
}

describe('export engine (mobile sortie)', () => {
  it('construit la synthèse avec les compteurs réels du voyage', () => {
    const cards = buildExportSummaryCards(trip(), STATS, BUDGET);
    expect(card(cards, 'itinerary')?.value).toMatch(/3 j/);
    expect(card(cards, 'itinerary')?.value).toMatch(/22 km/);
    expect(card(cards, 'gear')?.value).toMatch(/3/);
    expect(card(cards, 'groupe')?.value).toMatch(/3/);
    expect(card(cards, 'budget')?.value).toMatch(/80/);
    expect(card(cards, 'expenses')?.value).toMatch(/2/);
    expect(card(cards, 'documents')?.value).toMatch(/1/);
    expect(card(cards, 'safety')?.value).toMatch(/3/);
    expect(card(cards, 'journal')?.value).toMatch(/2/);
    expect(card(cards, 'pois')?.value).toMatch(/2/);
  });

  it('chaque carte pointe vers la section hub correspondante (registre)', () => {
    const cards = buildExportSummaryCards(trip(), STATS, BUDGET);
    expect(card(cards, 'itinerary')?.href).toBe('/hub/itineraire');
    expect(card(cards, 'gear')?.href).toBe('/hub/kit-voyage');
    expect(card(cards, 'groupe')?.href).toBe('/hub/groupe');
    expect(card(cards, 'budget')?.href).toBe('/hub/budget');
    expect(card(cards, 'safety')?.href).toBe('/hub/securite');
    expect(card(cards, 'journal')?.href).toBe('/hub/journal');
    expect(card(cards, 'documents')?.href).toBe('/hub/documents');
  });

  it('sans stats, retombe sur les dates puis les étapes du voyage', () => {
    const cards = buildExportSummaryCards(trip(), null, BUDGET);
    expect(card(cards, 'itinerary')?.value).toMatch(/3 j/);
    expect(card(cards, 'itinerary')?.value).toMatch(/22 km/);

    const withoutDates = buildExportSummaryCards(trip({ start_date: null, end_date: null }), null, BUDGET);
    expect(card(withoutDates, 'itinerary')?.value).toMatch(/2 j/);
  });

  it('programme jour par jour daté avec étapes et km', () => {
    const program = buildExportProgram(trip());
    expect(program).toHaveLength(3);
    expect(program[0].day).toBe(1);
    expect(program[0].stepsCount).toBe(1);
    expect(program[0].distanceKm).toBe(10);
    expect(program[0].dateLabel).toMatch(/7/);
    expect(program[2].stepsCount).toBe(0);
    expect(program[0].href).toBe('/hub/itineraire');
  });

  it('sans dates, le programme reste borné par les étapes', () => {
    const program = buildExportProgram(trip({ start_date: null, end_date: null }));
    expect(program).toHaveLength(2);
    expect(program[0].dateLabel).toBeNull();
  });
});
