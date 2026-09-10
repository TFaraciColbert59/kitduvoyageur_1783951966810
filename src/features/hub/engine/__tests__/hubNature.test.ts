import { describe, expect, test } from 'vitest';
import {
  deriveDefaultNature,
  deriveHubNature,
  readNaturePref,
  resetHubPrefs,
  writeNaturePref,
  type FeatureFlags,
  type HubCtxInput,
} from '../hubNature';

const BASE_FLAGS: FeatureFlags = {
  hub_all_enabled: true,
  hub_possession_enabled: true,
  hub_sortie_enabled: true,
  hub_collectif_enabled: true,
  updatedAt: 0,
  source: 'fallback',
};

const EMPTY_CTX: HubCtxInput = {
  activeVoyage: null,
  activeGroup: null,
  userInventoryItems: 0,
  loadedAt: 0,
};

describe('deriveHubNature (H0.2)', () => {
  test('voyage daté actif + groupe inactif → sortie', () => {
    const nature = deriveHubNature(
      { ...EMPTY_CTX, activeVoyage: { id: 'v1', endsAt: '2026-09-20' } },
      BASE_FLAGS,
      { naturePref: null },
    );
    expect(nature).toBe('sortie');
  });

  test('aucun voyage + groupe ≥2 membres actifs → collectif', () => {
    const nature = deriveHubNature(
      { ...EMPTY_CTX, activeGroup: { id: 'g1', memberIds: ['a', 'b'] } },
      BASE_FLAGS,
      { naturePref: null },
    );
    expect(nature).toBe('collectif');
  });

  test('aucun signal → possession (état empty canonique)', () => {
    expect(deriveHubNature(EMPTY_CTX, BASE_FLAGS, { naturePref: null })).toBe('possession');
  });

  test('pref localStorage collectif → collectif (override prime)', () => {
    const nature = deriveHubNature(EMPTY_CTX, BASE_FLAGS, { naturePref: 'collectif' });
    expect(nature).toBe('collectif');
  });

  test('hub_all_enabled=false → possession (kill switch global)', () => {
    const nature = deriveHubNature(
      { ...EMPTY_CTX, activeVoyage: { id: 'v1', endsAt: '2026-09-20' } },
      { ...BASE_FLAGS, hub_all_enabled: false },
      { naturePref: 'sortie' },
    );
    expect(nature).toBe('possession');
  });

  test('hub_sortie_enabled=false avec voyage → fallback possession', () => {
    const nature = deriveHubNature(
      { ...EMPTY_CTX, activeVoyage: { id: 'v1', endsAt: '2026-09-20' } },
      { ...BASE_FLAGS, hub_sortie_enabled: false },
      { naturePref: null },
    );
    expect(nature).toBe('possession');
  });

  test('pref invalide → possession, jamais crash', () => {
    const nature = deriveHubNature(EMPTY_CTX, BASE_FLAGS, { naturePref: 'foo' as never });
    expect(nature).toBe('possession');
  });

  test('idempotence : deux appels même contexte = même nature', () => {
    const ctx = { ...EMPTY_CTX, activeVoyage: { id: 'v1', endsAt: '2026-09-20' } };
    expect(deriveHubNature(ctx, BASE_FLAGS, { naturePref: null })).toBe(
      deriveHubNature(ctx, BASE_FLAGS, { naturePref: null }),
    );
  });

  test('SSR-safe : import sans window/localStorage au top-level', () => {
    expect(typeof deriveHubNature).toBe('function');
    expect(typeof deriveDefaultNature).toBe('function');
    expect(readNaturePref()).toBeNull();
  });

  test('resetHubPrefs() rétablit possession', () => {
    resetHubPrefs();
    expect(readNaturePref()).toBeNull();
    expect(deriveHubNature(EMPTY_CTX, BASE_FLAGS, { naturePref: readNaturePref() })).toBe(
      'possession',
    );
  });

  test('writeNaturePref() hors navigateur : no-op silencieux, jamais crash', () => {
    writeNaturePref('sortie');
    expect(readNaturePref()).toBeNull();
  });
});
