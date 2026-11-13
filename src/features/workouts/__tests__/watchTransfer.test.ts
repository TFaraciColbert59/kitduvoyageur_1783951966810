import { describe, expect, it } from 'vitest';
import { buildRunningPlan } from '../domain/plans';
import {
  defaultDeviceConnectors,
  planWatchTransfer,
  watchTransferLabel,
} from '../domain/watchTransfer';
import type { DeviceConnector } from '../domain/types';

const session = buildRunningPlan('5k', 'debutant').weeks[0].sessions[0];

function connector(overrides: Partial<DeviceConnector> = {}): DeviceConnector {
  return {
    id: 'watch-1',
    label: 'Montre test',
    provider: 'garmin',
    status: 'connected',
    capabilities: ['structured_workout'],
    ...overrides,
  };
}

describe('envoi vers appareil', () => {
  it('reste indisponible sans connecteur, sans simuler un envoi', () => {
    expect(defaultDeviceConnectors()).toEqual([]);
    const transfer = planWatchTransfer(session);

    expect(transfer.status).toBe('unavailable');
    expect(transfer.reason).toBe('connector_absent');
    expect(transfer.connectorId).toBeNull();
    expect(transfer.payload).toBeNull();
    expect(transfer.localExecution).toBe('available');
    expect(transfer.detail).toMatch(/aucun envoi/i);
    expect(watchTransferLabel(transfer)).toBe('Envoi indisponible');
  });

  it('distingue un connecteur déconnecté', () => {
    const transfer = planWatchTransfer(session, [
      connector({ status: 'disconnected' }),
    ]);
    expect(transfer.status).toBe('unavailable');
    expect(transfer.reason).toBe('connector_disconnected');
  });

  it('refuse un appareil sans capacité séance structurée', () => {
    const transfer = planWatchTransfer(session, [
      connector({ capabilities: [] }),
    ]);
    expect(transfer.status).toBe('unsupported');
    expect(transfer.reason).toBe('capability_absent');
    expect(transfer.localExecution).toBe('available');
  });

  it('prépare un payload JSON neutre pour un appareil compatible', () => {
    const transfer = planWatchTransfer(session, [connector()]);

    expect(transfer.status).toBe('ready');
    expect(transfer.reason).toBe('ready');
    expect(transfer.connectorId).toBe('watch-1');
    expect(transfer.payload?.encoding).toBe('lkdv_json');
    expect(transfer.payload?.version).toBe(1);
    expect(transfer.payload?.steps).toHaveLength(session.steps.length);
    expect(transfer.payload?.steps[0].durationS).toBe(session.steps[0].durationS);
  });

  it('refuse une séance invalide', () => {
    const transfer = planWatchTransfer(
      { ...session, totalDurationS: 1 },
      [connector()]
    );
    expect(transfer.status).toBe('invalid');
    expect(transfer.reason).toBe('invalid_session');
    expect(transfer.payload).toBeNull();
  });
});
