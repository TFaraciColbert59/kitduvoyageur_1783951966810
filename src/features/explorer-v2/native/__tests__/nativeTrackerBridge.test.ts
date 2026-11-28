import { describe, expect, it } from 'vitest';
import { detectPlatformCapabilities } from '../nativeTrackerBridge';

describe('Lot 02 — Native Tracker Bridge & Web/PWA Degraded Capabilities Matrix', () => {
  it('flags Safari iOS web without BLE and with explicit degraded background GPS banner', () => {
    const caps = detectPlatformCapabilities(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    );
    expect(caps.runtime).toBe('safari_web');
    expect(caps.hasReliableBackgroundGps).toBe(false);
    expect(caps.hasWebBluetooth).toBe(false);
    expect(caps.altitudeConfidenceDefault).toBe('low');
    expect(caps.degradedBannerMessageFr).toContain('Safari Web');
  });

  it('flags desktop web for planning, import and analysis', () => {
    const caps = detectPlatformCapabilities(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    );
    expect(caps.runtime).toBe('desktop_web');
    expect(caps.hasNativeSqliteWal).toBe(false);
    expect(caps.degradedBannerMessageFr).toContain('Desktop');
  });
});
