// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockWatchPlugin = vi.hoisted(() => ({
  isNative: false,
  platform: 'web' as 'web' | 'ios' | 'android',
  getTargetDiagnostic: vi.fn(),
  transferOfflinePack: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockWatchPlugin.isNative,
    getPlatform: () => mockWatchPlugin.platform,
  },
  registerPlugin: () => ({
    getTargetDiagnostic: mockWatchPlugin.getTargetDiagnostic,
    transferOfflinePack: mockWatchPlugin.transferOfflinePack,
    pullQueuedSessions: vi.fn(),
  }),
}));

import { inspectRuntimeWatchBridge, sendPackToWatchCompanion } from '../capacitorBridge';

describe('D03 Capacitor Watch Companion bridge — K6.09 / K6.11 / S6.01 / S6.02', () => {
  beforeEach(() => {
    mockWatchPlugin.isNative = false;
    mockWatchPlugin.platform = 'web';
    mockWatchPlugin.getTargetDiagnostic.mockReset();
    mockWatchPlugin.transferOfflinePack.mockReset();
  });

  it('retourne native_target_unavailable hors binaire natif sans simuler de transfert', async () => {
    const inspection = await inspectRuntimeWatchBridge('2026-11-14T18:00:00Z');
    expect(inspection.diagnostic.status).toBe('native_target_unavailable');
    expect(inspection.platform).toBe('web');

    const res = await sendPackToWatchCompanion({
      packId: 'pack-chamonix',
      regionId: 'fr-chamonix-mont-blanc',
      regionName: 'Chamonix',
      version: '2026.11.1',
      tileCount: 1200,
      sizeBytes: 42_000_000,
      checksumSha256: 'abc',
      platform: 'apple_watch',
      downloadedAtUtcMs: 1_700_000_000_000,
      lastSyncedAtUtcMs: null,
      status: 'pending',
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('native_target_unavailable');
  });

  it('autorise le transfert uniquement quand WatchKit / :wear et le pont runtime sont injectés', async () => {
    mockWatchPlugin.isNative = true;
    mockWatchPlugin.platform = 'ios';
    mockWatchPlugin.getTargetDiagnostic.mockResolvedValue({
      xcodeWatchKitTargetPresent: true,
      runtimeBridgeInjected: true,
    });
    mockWatchPlugin.transferOfflinePack.mockResolvedValue({ ok: true, transferredBytes: 42_000_000 });

    const res = await sendPackToWatchCompanion({
      packId: 'pack-chamonix',
      regionId: 'fr-chamonix-mont-blanc',
      regionName: 'Chamonix',
      version: '2026.11.1',
      tileCount: 1200,
      sizeBytes: 42_000_000,
      checksumSha256: 'abc',
      platform: 'apple_watch',
      downloadedAtUtcMs: 1_700_000_000_000,
      lastSyncedAtUtcMs: null,
      status: 'pending',
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('sent');
  });
});
