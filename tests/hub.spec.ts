import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculatePrepScore,
  calculateTrekCountdown,
  generateSosMessage,
} from '../src/features/hub/services/prepScoreCalculator';
import { useHubStore } from '../src/features/hub/stores/useHubStore';

describe('Hub Feature — Domain Services & Calculators', () => {
  it('TEST-HUB-01: calculates optimal prepScore when all pillars are complete', () => {
    const { score, breakdown } = calculatePrepScore({
      gearTotal: 10,
      gearPacked: 10,
      vitalMissingCount: 0,
      hasWeather48h: true,
      weatherWarning: false,
      hasIceContact: true,
      hasMedicalProfile: true,
      isRouteCachedOffline: true,
    });

    expect(score).toBe(100);
    expect(breakdown.gearScore).toBe(35);
    expect(breakdown.weatherScore).toBe(25);
    expect(breakdown.safetyScore).toBe(25);
    expect(breakdown.routeOfflineScore).toBe(15);
  });

  it('TEST-HUB-01b: penalizes score when vital gear is missing and weather warning is active', () => {
    const { score, breakdown } = calculatePrepScore({
      gearTotal: 10,
      gearPacked: 5,
      vitalMissingCount: 1,
      hasWeather48h: true,
      weatherWarning: true,
      hasIceContact: true,
      hasMedicalProfile: false,
      isRouteCachedOffline: false,
    });

    // gear: round(0.5*35) = 18 - 10 = 8
    // weather: 25 - 15 = 10
    // safety: 15 (ice only)
    // offline: 0
    expect(breakdown.gearScore).toBe(8);
    expect(breakdown.weatherScore).toBe(10);
    expect(breakdown.safetyScore).toBe(15);
    expect(breakdown.routeOfflineScore).toBe(0);
    expect(score).toBe(33);
  });

  it('TEST-HUB-02: generates a deterministic versioned SOS message without sensitive data leaks', () => {
    const sos = generateSosMessage({
      lat: 45.83261,
      lon: 6.75892,
      alt: 2150,
      batteryPercent: 42,
      userId: 'user-abcdef123456',
    });

    expect(sos).toMatch(/^LKDV1\|SOS\|GPS:45\.83261,6\.75892\|ALT:2150m\|BAT:42%\|TIME:.*\|ID:user-abc$/);
    expect(sos).not.toContain('bloodType');
    expect(sos).not.toContain('allergies');
  });

  it('TEST-HUB-03: calculates trek countdown correctly', () => {
    const futureDate = new Date(Date.now() + 86400000 * 2 + 3600000 * 5).toISOString();
    const countdown = calculateTrekCountdown(futureDate);

    expect(countdown).not.toBeNull();
    expect(countdown?.isOverdue).toBe(false);
    expect(countdown?.daysRemaining).toBe(2);
    expect(countdown?.hoursRemaining).toBe(5);
  });
});

describe('Hub Feature — Zustand Store & Transitions', () => {
  beforeEach(() => {
    useHubStore.setState({
      isTrekActive: false,
      action: {
        startTime: null,
        elapsedSeconds: 0,
        isPaused: false,
        currentPosition: null,
        headingDegrees: null,
        altitudeMeters: null,
        elevationGainMeters: 0,
        distanceTraveledKm: 0,
        nextWater: null,
        hydrationLevelPercent: 80,
        batteryLevel: 0.9,
        isUltraSaveActive: false,
        sosState: 'idle',
        sosArmingProgress: 0,
      },
    });
  });

  it('TEST-HUB-04: flips isTrekActive from BaseCamp to Action mode', () => {
    const store = useHubStore.getState();
    expect(store.isTrekActive).toBe(false);

    store.setTrekActive(true, 'trek-tmb-1');
    expect(useHubStore.getState().isTrekActive).toBe(true);
    expect(useHubStore.getState().activeTrekId).toBe('trek-tmb-1');
    expect(useHubStore.getState().action.startTime).not.toBeNull();

    store.setTrekActive(false);
    expect(useHubStore.getState().isTrekActive).toBe(false);
  });

  it('TEST-HUB-05: toggles Ultra-Save mode', () => {
    const store = useHubStore.getState();
    expect(store.action.isUltraSaveActive).toBe(false);

    store.toggleUltraSave(true);
    expect(useHubStore.getState().action.isUltraSaveActive).toBe(true);

    store.toggleUltraSave(false);
    expect(useHubStore.getState().action.isUltraSaveActive).toBe(false);
  });

  it('TEST-HUB-06: dismisses alerts properly', () => {
    const store = useHubStore.getState();
    const alertId = store.baseCamp.activeAlerts[0]?.id;
    if (alertId) {
      store.dismissAlert(alertId);
      const dismissed = useHubStore.getState().baseCamp.activeAlerts.find((a) => a.id === alertId);
      expect(dismissed?.isDismissed).toBe(true);
    }
  });
});
