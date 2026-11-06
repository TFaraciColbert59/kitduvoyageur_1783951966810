import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useHubStore } from '../stores/useHubStore';

describe('Hub Store Demo Purge (Task L0-4, AUDIT_AS_IS §2.3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('TEST-STORE-PURGE-01: initial store state contains ZERO demo strings or values', () => {
    const state = useHubStore.getState();

    // 1. BaseCamp checks
    expect(state.baseCamp.trekId).toBeNull();
    expect(state.baseCamp.trekName).toBe('');
    expect(state.baseCamp.destination).toBe('');
    expect(state.baseCamp.departureDate).toBeNull();
    expect(state.baseCamp.countdown).toBeNull();
    expect(state.baseCamp.prepScore).toBeNull();
    expect(state.baseCamp.prepBreakdown).toBeNull();
    expect(state.baseCamp.activeAlerts).toEqual([]);

    // 2. ActiveTrekId check
    expect(state.activeTrekId).toBeNull();

    // 3. Action checks
    expect(state.action.nextWater).toBeNull();
    expect(state.action.hydrationLevelPercent).toBeNull();
    expect(state.action.batteryLevel).toBeNull();
  });

  it('TEST-STORE-PURGE-02: static file invariant — zero occurrences of forbidden demo strings', () => {
    const storePath = path.resolve(process.cwd(), 'src/features/hub/stores/useHubStore.ts');
    const content = readFileSync(storePath, 'utf8');

    const forbiddenPatterns = [
      'trek-demo-1',
      'Col de la Seigne',
      'Source de Miage',
      'Tour du Mont-Blanc — Étape 1',
      'Les Houches → Refuge Miage',
    ];

    for (const pattern of forbiddenPatterns) {
      expect(content).not.toContain(pattern);
    }
  });

  it('TEST-STORE-PURGE-03: legacy storage key lkdv_hub_state_v1 is purged on load', () => {
    localStorage.setItem(
      'lkdv_hub_state_v1',
      JSON.stringify({
        activeTrekId: 'trek-demo-1',
        baseCamp: { trekId: 'trek-demo-1', prepScore: 78 },
      })
    );

    const state = useHubStore.getState();
    expect(localStorage.getItem('lkdv_hub_state_v1')).toBeNull();
    expect(state.activeTrekId).not.toBe('trek-demo-1');
  });

  it('TEST-STORE-PURGE-04: store operations work cleanly from empty state', () => {
    const store = useHubStore.getState();

    store.setTrekActive(true, 'real-trek-456');
    expect(useHubStore.getState().isTrekActive).toBe(true);
    expect(useHubStore.getState().activeTrekId).toBe('real-trek-456');

    store.updateBaseCamp({
      activeAlerts: [
        {
          id: 'alert-real-1',
          source: 'gear',
          severity: 'warning',
          title: 'Vérifier crampons',
          message: 'Itinéraire glaciaire détecté',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(useHubStore.getState().baseCamp.activeAlerts).toHaveLength(1);
    store.dismissAlert('alert-real-1');
    expect(useHubStore.getState().baseCamp.activeAlerts[0].isDismissed).toBe(true);
  });
});
