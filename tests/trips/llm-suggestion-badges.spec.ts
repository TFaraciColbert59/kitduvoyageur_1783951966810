import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MomentRow } from '@/features/trips/components/MomentRow';
import { ItineraryDayTimeline } from '@/features/hub/components/mobile/itinerary/ItineraryDayTimeline';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';

/**
 * IMPORTANT 4 — provenance : toute rangée écrite par le job LLM
 * (`source`/`metadata.source === 'llm_suggestion'`) porte une pastille
 * discrète « Suggestion IA », une seule par rangée.
 */

function baseStep(overrides: Partial<PlannerStep> = {}): PlannerStep {
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
    start_time: '08:00:00',
    distance_km: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
    ...overrides,
  };
}

describe('MomentRow — badge Suggestion IA', () => {
  it('affiche la pastille quand la ligne vient du job LLM', () => {
    const html = renderToStaticMarkup(
      React.createElement(MomentRow, {
        title: 'Matin — Réveil au village',
        slot: 'matin',
        startTime: '08:30',
        source: 'llm_suggestion',
      })
    );

    expect(html).toContain('Suggestion IA');
    expect(html).toContain('data-llm-badge');
  });

  it('aucune pastille pour une ligne déterministe', () => {
    const html = renderToStaticMarkup(
      React.createElement(MomentRow, {
        title: 'Matin — Réveil au village',
        slot: 'matin',
        metadata: { source: 'deterministic' },
      })
    );

    expect(html).not.toContain('Suggestion IA');
  });
});

describe('ItineraryDayTimeline — badge sur la rangée d’étape', () => {
  it('affiche la pastille pour une étape LLM (mobile)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryDayTimeline, {
        steps: [
          baseStep({ source: 'llm_suggestion', metadata: { source: 'llm_suggestion' } }),
        ],
        onOpen: () => {},
      })
    );

    expect(html).toContain('Suggestion IA');
  });

  it('aucune pastille pour une étape sans provenance LLM', () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryDayTimeline, {
        steps: [baseStep()],
        onOpen: () => {},
      })
    );

    expect(html).not.toContain('Suggestion IA');
  });
});

describe('surfaces desktop + kit — lecture de la provenance', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('les rangées desktop et kit rendent le badge LLM', () => {
    for (const file of [
      'src/features/trips/planner/StepCard.tsx',
      'src/features/trips/components/TripItineraryTab.tsx',
      'src/features/trips/components/TripKitView.tsx',
      'src/features/hub/components/mobile/itinerary/ItineraryMobileExperience.tsx',
    ]) {
      const source = read(file);
      expect(source, file).toContain('LlmSuggestionBadge');
      expect(source, file).toContain('isLlmSuggestion');
    }
  });
});
