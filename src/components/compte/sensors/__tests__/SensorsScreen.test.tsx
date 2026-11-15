// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BleSensorManager,
  HealthSyncService,
  WebUnavailableHealthBridge,
  createDefaultHealthConsentState,
  type BleTransportAdapter,
} from '@/features/sensors';
import { SensorsScreen } from '../SensorsScreen';

vi.mock('next/navigation', () => ({
  usePathname: () => '/compte/sensors',
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

afterEach(cleanup);

function createAvailableTransport(): BleTransportAdapter {
  return {
    isAvailable: async () => true,
    scanDevices: async () => [
      {
        deviceId: 'polar-h10-123456789',
        name: 'Polar H10',
        services: ['heart_rate'],
        rssi: -45,
      },
    ],
    connect: async () => ({ ok: true }),
    disconnect: async () => {},
    readBatteryLevel: async () => new Uint8Array([87]),
  };
}

const EMPTY_CONSENT = createDefaultHealthConsentState(1_000);

describe('SensorsScreen', () => {
  it('liste un capteur réel, le connecte et laisse la télémétrie indisponible', async () => {
    const manager = new BleSensorManager({ transport: createAvailableTransport() });
    const healthService = new HealthSyncService({
      adapter: new WebUnavailableHealthBridge('web'),
      initialConsent: EMPTY_CONSENT,
    });

    render(
      <SensorsScreen
        manager={manager}
        healthService={healthService}
        initialConsent={EMPTY_CONSENT}
        consentTransport={null}
        now={() => 10_000}
      />,
    );

    expect(screen.getByText('Aucun capteur appairé')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Polar H10')).toBeTruthy();
    expect(screen.getByText('-45 dBm')).toBeTruthy();
    const deviceCard = screen.getByText('Polar H10').closest('article');
    expect(deviceCard).toBeTruthy();
    expect(within(deviceCard as HTMLElement).getByText('Cardio')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Connecter' }));
    expect(await screen.findByRole('button', { name: 'Déconnecter' })).toBeTruthy();
    expect(screen.getByText('87 %')).toBeTruthy();
    expect(screen.getByText('Batterie normale')).toBeTruthy();

    // Aucune trame GATT n'a été reçue : les 7 métriques restent indisponibles.
    expect(screen.getAllByText('Indisponible')).toHaveLength(7);
    expect(screen.queryByText('Mesuré')).toBeNull();
  });

  it('annonce l’absence de Bluetooth sans inventer de capteur', async () => {
    const manager = new BleSensorManager();
    const healthService = new HealthSyncService({
      adapter: new WebUnavailableHealthBridge('web'),
      initialConsent: EMPTY_CONSENT,
    });

    render(
      <SensorsScreen
        manager={manager}
        healthService={healthService}
        initialConsent={EMPTY_CONSENT}
        consentTransport={null}
        now={() => 10_000}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText(/Bluetooth LE/)).toBeTruthy();
    expect(screen.getByText('Aucun capteur appairé')).toBeTruthy();
    expect(screen.queryByText('Polar H10')).toBeNull();
  });

  it('affiche le pont Santé indisponible et permet un consentement granulaire', async () => {
    const manager = new BleSensorManager();
    const healthService = new HealthSyncService({
      adapter: new WebUnavailableHealthBridge('web'),
      initialConsent: EMPTY_CONSENT,
    });

    render(
      <SensorsScreen
        manager={manager}
        healthService={healthService}
        initialConsent={EMPTY_CONSENT}
        consentTransport={null}
        now={() => 10_000}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Santé' }));
    expect(await screen.findByText('Pont Santé P01')).toBeTruthy();
    expect(await screen.findByText('Pont natif indisponible')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Lire mes séances' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('switch', { name: 'Lire les séances : refusé' }));
    expect(screen.getByText('1 / 8')).toBeTruthy();
    expect(screen.getByText('Lecture des séances autorisée')).toBeTruthy();
  });
});
