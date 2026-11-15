// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { discoverRoutes, routeDiscoveryRequestSchema } from '../connectors/routeDiscovery';
import { buildActivityFacts } from '../activity/activityFacts';
import { buildDeterministicActivityReading } from '../activity/postActivityInsight';
import { OutingInsightBridge } from '../ui/OutingInsightBridge';
import { HistoryAssistantPanel } from '../ui/HistoryAssistantPanel';
import { ConnectorDiscoverySection } from '../ui/ConnectorDiscoverySection';
import type { ProgressionSession } from '@/features/compte/progression/engine';

const SAMPLE_SESSIONS: ProgressionSession[] = [
  {
    id: 's1',
    title: 'Belledonne',
    startedAt: '2026-06-10T08:00:00Z',
    endedAt: '2026-06-10T10:30:00Z',
    km: 14,
    dplus: 750,
    durationS: 9000,
    sport: 'trail',
    massif: 'Belledonne',
  },
  {
    id: 's2',
    title: 'Sortie plate',
    startedAt: '2026-06-12T08:00:00Z',
    endedAt: '2026-06-12T09:00:00Z',
    km: 10,
    dplus: 80,
    durationS: 3600,
    sport: 'course',
    massif: 'Vercors',
  },
];

describe('A08 (K1.14, S2.37, S2.38) UI & contrats enrichis', () => {
  afterEach(() => {
    cleanup();
  });

  it('K1.14: applique elevationLossM & signale explicitement surface/loop/season comme non prouvables', () => {
    const req = routeDiscoveryRequestSchema.parse({
      query: 'Blanc',
      constraints: {
        elevationLossM: { min: 400, max: 1000 },
        surface: ['sentier'],
        loop: true,
        season: ['été'],
      },
    });
    const result = discoverRoutes(req, [
      {
        route_id: 1,
        name: 'Tour du Lac Blanc',
        ref: 'GR5',
        region: 'Alpes',
        distance_km: 14,
        elevation_gain_m: 820,
        elevation_loss_m: 820,
        duration_hours: 4.5,
        difficulty: 'moderee',
        distance_from_m: 1500,
        start_lat: 45.97,
        start_lng: 6.89,
        community_sessions: 18,
      },
    ]);
    expect(result.count).toBe(1);
    expect(result.unknownConstraints.join(' ')).toContain('surface');
    expect(result.unknownConstraints.join(' ')).toContain('boucle');
    expect(result.unknownConstraints.join(' ')).toContain('saisonnalité');

    render(<ConnectorDiscoverySection />);
    expect(screen.getByTestId('connector-discovery-section')).toBeTruthy();
  });

  it('S2.37: intègre les métriques de télémétrie (FC, calories, GAP, splits, effort) dans Comprendre ma sortie', () => {
    const facts = buildActivityFacts(
      {
        id: 'outing-1',
        started_at: '2026-06-10T08:00:00Z',
        ended_at: '2026-06-10T09:30:00Z',
        distance_km: 12,
        duration_seconds: 5400,
        elevation_gain_m: 450,
        title: 'Trail matinal',
      },
      {
        hrAvgBpm: 156,
        caloriesKcal: 780,
        caloriesEstimated: true,
        splitsCount: 12,
        gapPaceSPerKm: 410,
        relativeEffortScore: 68,
      }
    );
    const reading = buildDeterministicActivityReading(facts);
    expect(reading.facts.join(' ')).toContain('156 bpm');
    expect(reading.facts.join(' ')).toContain('780 kcal');
    expect(reading.facts.join(' ')).toContain('12 splits');
    expect(reading.facts.join(' ')).toContain('Effort relatif calculé');

    render(
      <OutingInsightBridge
        session={{
          id: 'outing-1',
          started_at: '2026-06-10T08:00:00Z',
          ended_at: '2026-06-10T09:30:00Z',
          distance_km: 12,
          duration_seconds: 5400,
          elevation_gain_m: 450,
          title: 'Trail matinal',
        }}
        telemetry={{ hrAvgBpm: 156, caloriesKcal: 780, splitsCount: 12 }}
      />
    );
    expect(screen.getByTestId('outing-post-activity-insight')).toBeTruthy();
    expect(screen.getByText(/Bilan de « Trail matinal »/i)).toBeTruthy();
  });

  it('S2.38: bloque la lecture sans consentement, puis permet de basculer Claude/Gemini et d’interroger les agrégats', async () => {
    render(<HistoryAssistantPanel sessions={SAMPLE_SESSIONS} initialConsentGranted={false} />);

    expect(screen.getByText(/Accès à l’historique bloqué sans consentement/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId('history-assistant-consent-toggle'));

    expect(await screen.findByText(/Consentement personal_performance actif/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));
    const input = screen.getByLabelText('Question sur ton historique sportif');
    fireEvent.change(input, { target: { value: 'Quel est mon dénivelé cumulé ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Interroger' }));

    const answer = await screen.findByTestId('history-assistant-answer');
    expect(answer.textContent).toContain('830 m de D+');
  });
});
