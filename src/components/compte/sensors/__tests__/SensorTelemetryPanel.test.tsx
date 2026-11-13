// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QualifiedTelemetryStream } from '@/features/sensors';
import { SensorTelemetryPanel } from '../SensorTelemetryPanel';

afterEach(cleanup);

describe('SensorTelemetryPanel', () => {
  it('affiche la valeur réelle, sa qualification et son âge', () => {
    const empty = new QualifiedTelemetryStream().getSnapshot(10_000);
    const snapshot = {
      ...empty,
      heartRateBpm: {
        value: 120,
        qualification: 'measured' as const,
        sourceDeviceId: 'polar-1',
        updatedAtMs: 9_000,
      },
      cyclingSpeedMs: {
        value: 6.5,
        qualification: 'stale' as const,
        sourceDeviceId: 'wahoo-1',
        updatedAtMs: 1_000,
      },
    };

    render(<SensorTelemetryPanel snapshot={snapshot} nowMs={10_000} />);

    expect(screen.getByText('120 bpm')).toBeTruthy();
    expect(screen.getByText('23,4 km/h')).toBeTruthy();
    expect(screen.getByText('Mesuré')).toBeTruthy();
    expect(screen.getByText('Périmé')).toBeTruthy();
    expect(screen.getByText('il y a 1 s')).toBeTruthy();
    expect(screen.getByText('il y a 9 s')).toBeTruthy();
  });

  it('laisse toutes les métriques indisponibles sans mesure', () => {
    const empty = new QualifiedTelemetryStream().getSnapshot(10_000);
    render(<SensorTelemetryPanel snapshot={empty} nowMs={10_000} />);

    expect(screen.getByText(/Aucune mesure reçue/)).toBeTruthy();
    expect(screen.getAllByText('Indisponible')).toHaveLength(7);
    expect(screen.getAllByText('—')).toHaveLength(7);
    expect(screen.getAllByText('jamais')).toHaveLength(7);
  });
});
