import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepsTimeline } from '@/features/trips/components/widgets/StepsTimeline';
import type { TripStep } from '@/features/trips/types/trip.types';

// Mock Next.js Link (même approche que tests/trips/trip-components.spec.ts)
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...rest
  }: React.ComponentProps<'a'> & { href: string }) =>
    React.createElement('a', { href, className, ...rest }, children),
}));

/**
 * Sidebar « Déroulé du jour » — jours réels uniquement.
 * Interdit : pseudo-défilement infini (copies, Array.from, saut modulo).
 */

function baseStep(overrides: Partial<TripStep> = {}): TripStep {
  return {
    id: 'step-1',
    trip_id: 'trip-1',
    day_number: 1,
    order_index: 0,
    title: 'Étape du jour',
    description: null,
    location_name: null,
    latitude: null,
    longitude: null,
    accommodation_name: null,
    transport_mode: 'foot',
    distance_km: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
    created_at: '2026-09-12T00:00:00.000Z',
    updated_at: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const countStartCards = (html: string) => countOccurrences(html, 'aria-label="Point de départ');
const countStepRows = (html: string) => countOccurrences(html, 'aria-label="Étape');

describe('StepsTimeline — déroulé du jour (jours réels uniquement)', () => {
  it('1 étape J1 → une seule carte « Point de départ » et une seule rangée', () => {
    const html = renderToStaticMarkup(
      React.createElement(StepsTimeline, {
        steps: [baseStep()],
        dayIndex: 1,
        phase: 'prepare',
      })
    );

    expect(countStartCards(html)).toBe(1);
    expect(countStepRows(html)).toBe(1);
    expect(html).toContain('J1 · 1');
  });

  it('3 étapes J1 → 3 rangées rendues au maximum (aucune duplication)', () => {
    const steps = [0, 1, 2].map((i) =>
      baseStep({ id: `step-${i}`, order_index: i, title: `Étape ${i + 1}` })
    );
    const html = renderToStaticMarkup(
      React.createElement(StepsTimeline, { steps, dayIndex: 1, phase: 'live' })
    );

    expect(countStepRows(html)).toBe(3);
    expect(countStartCards(html)).toBe(1);
    expect(html).toContain('J1 · 1');
    expect(html).toContain('J1 · 2');
    expect(html).toContain('J1 · 3');
  });

  it('jour sans étape → fallback rendu une seule fois', () => {
    const steps = [
      baseStep({ id: 'j1', day_number: 1, order_index: 0, title: 'Départ' }),
      baseStep({ id: 'j3', day_number: 3, order_index: 0, title: 'Arrivée' }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(StepsTimeline, { steps, dayIndex: 2, phase: 'live' })
    );

    expect(countStartCards(html)).toBe(1);
    expect(countOccurrences(html, 'Aucune étape pour le jour 2')).toBe(1);
    expect(countStepRows(html)).toBe(0);
  });

  it('source : ni copies, ni Array.from, ni saut modulo — scroll simple', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/trips/components/widgets/StepsTimeline.tsx'),
      'utf8'
    );

    expect(src).not.toContain('Array.from');
    expect(src).not.toContain('copies');
    expect(src).not.toContain('scrollTop');
    expect(src).not.toContain('onScroll');
    expect(src).toContain('overflow-y-auto');
  });
});
