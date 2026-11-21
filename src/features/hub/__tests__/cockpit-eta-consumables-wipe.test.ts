import { describe, expect, it } from 'vitest';
import { estimateStepEta, formatEtaDelta } from '@/features/hub/cockpit/etaEngine';
import { estimateConsumablesAutonomy } from '@/features/hub/cockpit/consumablesTracker';
import { wipeAllCockpitLocalData } from '@/features/hub/cockpit/localDataProtection';
import { enqueueOfflineOp, listOfflineOps } from '@/features/hub/cockpit/offlineQueue';
import { loadCarnetDraft, saveCarnetDraft } from '@/features/hub/cockpit/CarnetDraftStore';

describe('etaEngine, consumablesTracker and localDataProtection', () => {
  it('computes dynamic ETA and planned delta with Naismith climb adjustment', () => {
    const est = estimateStepEta({
      nowIso: '2026-11-21T08:00:00Z',
      remainingKm: 7,
      remainingGainM: 600,
      observedSpeedKmh: 3.5,
      plannedArrivalIso: '2026-11-21T10:30:00Z',
    });
    expect(est?.remainingMinutes).toBe(180); // 2h plat + 1h D+
    expect(est?.deltaMinutes).toBe(30);
    expect(formatEtaDelta(est?.deltaMinutes ?? null)).toBe('+30 min de retard');
    expect(formatEtaDelta(-15)).toBe('15 min d’avance');
    expect(formatEtaDelta(2)).toBe('Dans les temps');
  });

  it('estimates water, meals and powerbank autonomy accurately', () => {
    const normal = estimateConsumablesAutonomy({ partySize: 2, remainingDays: 3, hotWeather: false, powerBankMah: 10000 });
    expect(normal).toEqual({ waterLitersNeeded: 12, mealsNeeded: 18, batteryHoursEstimate: 21 });

    const hot = estimateConsumablesAutonomy({ partySize: 2, remainingDays: 2, hotWeather: true });
    expect(hot).toEqual({ waterLitersNeeded: 12, mealsNeeded: 12, batteryHoursEstimate: null });
  });

  it('wipes all local offline queue operations and carnet drafts atomically on logout', async () => {
    await enqueueOfflineOp({
      operationId: 'op-wipe-1',
      tripId: 'trip-wipe',
      kind: 'kit_toggle',
      payload: { tripId: 'trip-wipe', itemId: 'item-1', packed: true },
    });
    saveCarnetDraft({
      tripId: 'trip-wipe',
      day: 1,
      caption: 'Draft privé',
      place: 'Refuge',
      capturedAt: '2026-11-21T10:00:00Z',
      timeZone: 'Europe/Paris',
    });

    await wipeAllCockpitLocalData(['trip-wipe']);
    expect(await listOfflineOps('trip-wipe')).toHaveLength(0);
    expect(loadCarnetDraft('trip-wipe')).toBeNull();
  });
});
