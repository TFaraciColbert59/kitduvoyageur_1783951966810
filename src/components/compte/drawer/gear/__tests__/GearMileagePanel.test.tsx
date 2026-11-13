// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GearMileagePanel } from '../GearMileagePanel';
import type { GearMileagePayload } from '@/features/gear/server/mileage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function payload(overrides: Partial<GearMileagePayload> = {}): GearMileagePayload {
  return {
    gear: { id: 'g1', name: 'Chaussures de rando', category: 'Chaussures', condition: 'bon' },
    mileage: {
      totalKm: 0,
      sessionCount: 0,
      zeroDistanceSessions: 0,
      missingDistanceSessions: 2,
      ignoredSessions: 0,
      sportUnknownSessions: 0,
      usages: [],
    },
    settings: { thresholdKm: null, thresholdVersion: 1, notifiedVersion: null, dismissedVersion: null },
    alert: { due: false, shouldNotify: false, remainingKm: null, progressPercent: null },
    components: [],
    persistenceReady: true,
    ...overrides,
  };
}

function stub(data: GearMileagePayload) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => data })) as unknown as typeof fetch
  );
}

describe('GearMileagePanel — absence et seuil', () => {
  it('annonce « non mesuré » sans transformer une distance absente en zéro', async () => {
    stub(payload());
    render(<GearMileagePanel gearItemId="g1" gearName="Chaussures de rando" />);

    expect(await screen.findByText('Non mesuré')).toBeTruthy();
    expect(screen.getByText(/2 sorties liées sans distance mesurée/)).toBeTruthy();
    expect(screen.queryByText(/^0 km/)).toBeNull();
  });

  it('affiche le seuil atteint et une seule action d’acquittement', async () => {
    stub(
      payload({
        gear: { id: 'g1', name: 'Vélo gravel', category: 'Vélo', condition: 'bon' },
        mileage: {
          totalKm: 520,
          sessionCount: 6,
          zeroDistanceSessions: 0,
          missingDistanceSessions: 0,
          ignoredSessions: 1,
          sportUnknownSessions: 0,
          usages: [],
        },
        settings: { thresholdKm: 500, thresholdVersion: 1, notifiedVersion: null, dismissedVersion: null },
        alert: { due: true, shouldNotify: true, remainingKm: 0, progressPercent: 100 },
        components: [
          {
            id: 'c1',
            gearItemId: 'g1',
            name: 'Chaîne 11v',
            kind: 'chaine',
            installedAtKm: 100,
            replacedAtKm: null,
            thresholdKm: 500,
            mileage: { km: 420, due: false, remainingKm: 80, progressPercent: 84 },
          },
        ],
      })
    );
    render(<GearMileagePanel gearItemId="g1" gearName="Vélo gravel" />);

    expect(await screen.findByText(/Seuil 500 km atteint/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Marquer comme vue/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ne plus afficher/ })).toBeTruthy();
    expect(screen.getByText('Chaîne 11v')).toBeTruthy();
  });

  it('explique l’absence de migration au lieu d’afficher un total', async () => {
    stub(payload({ persistenceReady: false }));
    render(<GearMileagePanel gearItemId="g1" gearName="Chaussures de rando" />);

    expect(await screen.findByText(/n’est pas encore activé sur cette version/)).toBeTruthy();
    expect(screen.queryByText('Non mesuré')).toBeNull();
  });
});
