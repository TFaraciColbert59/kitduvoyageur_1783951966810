// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PrivacyContext } from '@/features/live-segments';
import { useLiveSegmentSession } from '../useLiveSegmentSession';
import { latAt, makeSegment } from './fixtures';

const privacy: PrivacyContext = {
  viewerId: 'viewer-1',
  optedInLiveSegments: true,
  blockedUserIds: new Set(),
  allowedPeerIds: new Set(),
};

function makePosition(northM: number, tSec: number): GeolocationPosition {
  return {
    coords: {
      latitude: latAt(northM),
      longitude: 2,
      accuracy: 5,
      altitude: 300,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 5,
      toJSON: () => ({}),
    },
    timestamp: 1_700_000_000_000 + tSec * 1000,
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function makeFakeGeolocation() {
  let success: PositionCallback | null = null;
  let failure: PositionErrorCallback | null = null;
  const watchPosition = vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback) => {
    success = onSuccess;
    failure = onError ?? null;
    return 42;
  });
  const clearWatch = vi.fn();
  return {
    geolocation: { watchPosition, clearWatch, getCurrentPosition: vi.fn() } as unknown as Geolocation,
    watchPosition,
    clearWatch,
    emit: (position: GeolocationPosition) => success?.(position),
    fail: (error: GeolocationPositionError) => failure?.(error),
  };
}

describe('S03-UI — session temps réel', () => {
  it('pousse les points GPS dans le moteur et expose le snapshot', () => {
    const fake = makeFakeGeolocation();
    let nowMs = 0;
    const { result } = renderHook(() =>
      useLiveSegmentSession({
        segments: [makeSegment()],
        privacy,
        geolocation: fake.geolocation,
        now: () => nowMs,
      }),
    );

    act(() => result.current.start('seg-test'));
    expect(fake.watchPosition).toHaveBeenCalledTimes(1);

    act(() => fake.emit(makePosition(10, 0)));
    expect(result.current.snapshot.state).toBe('active');
    expect(result.current.alerts.some((alert) => alert.type === 'start')).toBe(true);

    nowMs = 120_000;
    act(() => fake.emit(makePosition(600, 120)));
    expect(result.current.snapshot.state).toBe('active');
    expect(result.current.snapshot.distanceCoveredM).toBeGreaterThan(500);
    expect(result.current.snapshot.deltaMs).not.toBeNull();
  });

  it('met en pause, reprend et arrête proprement', () => {
    const fake = makeFakeGeolocation();
    let nowMs = 0;
    const { result } = renderHook(() =>
      useLiveSegmentSession({
        segments: [makeSegment()],
        privacy,
        geolocation: fake.geolocation,
        now: () => nowMs,
      }),
    );

    act(() => result.current.start('seg-test'));
    act(() => fake.emit(makePosition(10, 0)));

    act(() => result.current.pause());
    expect(result.current.isPaused).toBe(true);
    nowMs = 20_000;
    act(() => result.current.resume());
    expect(result.current.isPaused).toBe(false);

    act(() => result.current.stop());
    expect(result.current.snapshot.state).toBe('idle');
    expect(result.current.snapshot.isVisible).toBe(false);
    expect(fake.clearWatch).toHaveBeenCalledWith(42);
  });

  it('remonte un refus de géolocalisation', () => {
    const fake = makeFakeGeolocation();
    const { result } = renderHook(() =>
      useLiveSegmentSession({
        segments: [makeSegment()],
        privacy,
        geolocation: fake.geolocation,
        now: () => 0,
      }),
    );

    act(() => result.current.start('seg-test'));
    act(() =>
      fake.fail({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError),
    );

    expect(result.current.permissionError).toContain('refusé');
  });

  it('signale l’absence de géolocalisation sans lever', () => {
    const { result } = renderHook(() =>
      useLiveSegmentSession({
        segments: [makeSegment()],
        privacy,
        geolocation: null,
        now: () => 0,
      }),
    );
    act(() => result.current.start('seg-test'));
    expect(result.current.permissionError).toContain('pas disponible');
    expect(result.current.isTracking).toBe(false);
  });
});
