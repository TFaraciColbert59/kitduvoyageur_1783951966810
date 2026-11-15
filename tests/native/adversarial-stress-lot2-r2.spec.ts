// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockBridge = vi.hoisted(() => ({
  platform: 'web',
  native: false,
  hasIsNativeMethod: true,
  hasGetPlatformMethod: true,
  setRoute: vi.fn(async () => ({ active: true })),
  presentActions: vi.fn(async () => ({ active: true, actionId: 'ok' })),
  share: vi.fn(async () => ({ active: true })),
  presentPrompt: vi.fn(async () => ({ active: true, value: 'test' })),
  presentDate: vi.fn(async () => ({ active: true, value: '2026-11-14' })),
  getCapabilities: vi.fn(async () => ({
    available: true,
    dates: true,
    choices: true,
    photos: true,
    files: true,
    biometrics: true,
  })),
  presentChoices: vi.fn(async () => ({ active: true, value: 'c1' })),
  presentPhotos: vi.fn(async () => ({
    active: true,
    photos: [{ name: 'test.jpg', type: 'image/jpeg', data: 'aGVsbG8=' }] as Array<{ name: string; type: string; data: string }> | undefined,
  })),
  importGPX: vi.fn(async () => ({ active: true, text: '<gpx version="1.1"></gpx>' })),
  exportGPX: vi.fn(async () => ({ active: true, saved: true })),
  authenticateBiometric: vi.fn(async (): Promise<{ active: boolean; success: boolean; error?: string; errorCode?: number }> => ({ active: true, success: true })),
  liveIsSupported: vi.fn(async () => ({ supported: true })),
  liveStart: vi.fn(async () => ({ supported: true, id: 'act-1' })),
  liveUpdate: vi.fn(async () => ({ supported: true })),
  liveEnd: vi.fn(async () => ({ supported: true, ended: true })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => (mockBridge.hasGetPlatformMethod ? mockBridge.platform : undefined),
    isNativePlatform: () => (mockBridge.hasIsNativeMethod ? mockBridge.native : undefined),
  },
  registerPlugin: (name: string) => {
    if (name === 'LkdvLiveActivity') {
      return {
        isSupported: mockBridge.liveIsSupported,
        start: mockBridge.liveStart,
        update: mockBridge.liveUpdate,
        end: mockBridge.liveEnd,
      };
    }
    return {
      setRoute: mockBridge.setRoute,
      presentActions: mockBridge.presentActions,
      share: mockBridge.share,
      presentPrompt: mockBridge.presentPrompt,
      presentDate: mockBridge.presentDate,
      getCapabilities: mockBridge.getCapabilities,
      presentChoices: mockBridge.presentChoices,
      presentPhotos: mockBridge.presentPhotos,
      importGPX: mockBridge.importGPX,
      exportGPX: mockBridge.exportGPX,
      authenticateBiometric: mockBridge.authenticateBiometric,
    };
  },
}));

import {
  supportsNativeUI,
  supportsNativeIOSUI,
  authenticateNativeBiometric,
  presentNativeActions,
  presentNativePrompt,
  presentNativeDate,
  hasNativeDatePicker,
  hasNativeChoices,
  presentNativeChoices,
  hasNativePhotos,
  pickNativePhotos,
  hasNativeGPXFiles,
  importNativeGPX,
  exportNativeGPX,
  shareNativeURL,
} from '@/lib/native/ui';

import {
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
} from '@/features/explorer-v2/native/liveActivity';

import { lkvConfirm, lkvPromptAsync, lkvAlert } from '@/components/ui/dialogs';

describe('Adversarial Stress Test: Lot 2 R2 Remediation', () => {
  beforeEach(() => {
    mockBridge.platform = 'web';
    mockBridge.native = false;
    mockBridge.hasIsNativeMethod = true;
    mockBridge.hasGetPlatformMethod = true;
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { pathname: '/explorer' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('1. Live Activity Optional Chaining & Fault Tolerance', () => {
    it('handles completely undefined isNativePlatform method without throwing', async () => {
      mockBridge.hasIsNativeMethod = false;
      mockBridge.hasGetPlatformMethod = false;
      mockBridge.platform = 'web';

      await expect(isLiveActivitySupported()).resolves.toBe(false);
      await expect(
        startLiveActivity({
          sport: 'rando',
          startedAt: 1000,
          distanceM: 0,
          elevGainM: 0,
          movingS: 0,
          paused: false,
          offRoute: false,
        })
      ).resolves.toBe(false);
      await expect(
        updateLiveActivity({
          distanceM: 100,
          elevGainM: 10,
          movingS: 60,
          paused: false,
          offRoute: false,
        })
      ).resolves.toBeUndefined();
      await expect(
        endLiveActivity({
          distanceM: 100,
          elevGainM: 10,
          movingS: 60,
          paused: false,
          offRoute: false,
        })
      ).resolves.toBeUndefined();
    });

    it('handles isNativePlatform=true on iOS and triggers live activity plugin', async () => {
      mockBridge.hasIsNativeMethod = true;
      mockBridge.hasGetPlatformMethod = true;
      mockBridge.native = true;
      mockBridge.platform = 'ios';
      mockBridge.liveIsSupported.mockResolvedValueOnce({ supported: true });

      const supported = await isLiveActivitySupported();
      expect(supported).toBe(true);
      expect(mockBridge.liveIsSupported).toHaveBeenCalled();

      const started = await startLiveActivity({
        sport: 'velo',
        startedAt: 2000,
        distanceM: 50,
        elevGainM: 2,
        movingS: 10,
        paused: false,
        offRoute: false,
      });
      expect(started).toBe(true);
      expect(mockBridge.liveStart).toHaveBeenCalled();
    });

    it('handles isNativePlatform=true on Android and triggers live activity plugin', async () => {
      mockBridge.hasIsNativeMethod = true;
      mockBridge.hasGetPlatformMethod = true;
      mockBridge.native = true;
      mockBridge.platform = 'android';
      mockBridge.liveIsSupported.mockResolvedValueOnce({ supported: true });

      expect(await isLiveActivitySupported()).toBe(true);
    });

    it('swallows errors when plugin throws in update or end without crashing the caller', async () => {
      mockBridge.hasIsNativeMethod = true;
      mockBridge.hasGetPlatformMethod = true;
      mockBridge.native = true;
      mockBridge.platform = 'ios';
      mockBridge.liveUpdate.mockRejectedValueOnce(new Error('Hardware ActivityKit Failure'));
      mockBridge.liveEnd.mockRejectedValueOnce(new Error('IPC crash'));

      await expect(
        updateLiveActivity({
          distanceM: 100,
          elevGainM: 10,
          movingS: 60,
          paused: false,
          offRoute: false,
        })
      ).resolves.toBeUndefined();

      await expect(
        endLiveActivity({
          distanceM: 100,
          elevGainM: 10,
          movingS: 60,
          paused: false,
          offRoute: false,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('2. Native UI Bridge Cross-Platform Fallback & Biometrics', () => {
    it('correctly evaluates supportsNativeUI on web, android, ios, and edge platforms', () => {
      mockBridge.native = false;
      mockBridge.platform = 'web';
      expect(supportsNativeUI()).toBe(false);

      mockBridge.native = true;
      mockBridge.platform = 'web';
      expect(supportsNativeUI()).toBe(false);

      mockBridge.native = true;
      mockBridge.platform = 'electron';
      expect(supportsNativeUI()).toBe(false);

      mockBridge.native = true;
      mockBridge.platform = 'android';
      expect(supportsNativeUI()).toBe(true);

      mockBridge.native = true;
      mockBridge.platform = 'ios';
      expect(supportsNativeUI()).toBe(true);
    });

    it('authenticateNativeBiometric returns undefined on web without invoking plugin', async () => {
      mockBridge.native = false;
      mockBridge.platform = 'web';

      const res = await authenticateNativeBiometric('Vérifier identité');
      expect(res).toBeUndefined();
      expect(mockBridge.authenticateBiometric).not.toHaveBeenCalled();
    });

    it('authenticateNativeBiometric handles successful authentication on Android', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'android';
      mockBridge.authenticateBiometric.mockResolvedValueOnce({ active: true, success: true });

      const res = await authenticateNativeBiometric('Connexion sécurisée');
      expect(res).toEqual({ success: true, error: undefined });
      expect(mockBridge.authenticateBiometric).toHaveBeenCalledWith({ reason: 'Connexion sécurisée' });
    });

    it('authenticateNativeBiometric handles rejection / biometric failure on iOS', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'ios';
      mockBridge.authenticateBiometric.mockResolvedValueOnce({
        active: true,
        success: false,
        error: 'Biométrie non reconnue',
      });

      const res = await authenticateNativeBiometric('Confirmer paiement');
      expect(res).toEqual({ success: false, error: 'Biométrie non reconnue' });
    });

    it('authenticateNativeBiometric handles plugin inactivity or unexpected exception gracefully', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'android';
      mockBridge.authenticateBiometric.mockResolvedValueOnce({ active: false, success: false });

      expect(await authenticateNativeBiometric('Test')).toBeUndefined();

      mockBridge.authenticateBiometric.mockRejectedValueOnce(new Error('Capacitor Bridge Disconnect'));
      expect(await authenticateNativeBiometric('Test')).toBeUndefined();
    });
  });

  describe('3. Dialogs Integration Fallback', () => {
    it('routes lkvConfirm to native bridge on Android when supportsNativeUI is true', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'android';
      mockBridge.presentActions.mockResolvedValueOnce({ active: true, actionId: 'confirm' });

      const confirmed = await lkvConfirm({ message: 'Supprimer ce kit ?', title: 'Confirmation' });
      expect(confirmed).toBe(true);
      expect(mockBridge.presentActions).toHaveBeenCalled();
    });

    it('routes lkvPromptAsync to native bridge on Android', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'android';
      mockBridge.presentPrompt.mockResolvedValueOnce({ active: true, value: 'Nouveau nom' });

      const val = await lkvPromptAsync({ title: 'Renommer' });
      expect(val).toBe('Nouveau nom');
      expect(mockBridge.presentPrompt).toHaveBeenCalled();
    });

    it('routes lkvAlert to native actions on iOS/Android without throwing', () => {
      mockBridge.native = true;
      mockBridge.platform = 'ios';
      mockBridge.presentActions.mockResolvedValueOnce({ active: true, actionId: 'ok' });

      expect(() => lkvAlert('Attention !', { title: 'Alerte' })).not.toThrow();
      expect(mockBridge.presentActions).toHaveBeenCalled();
    });
  });

  describe('4. File and Photo Picker Robustness on Android', () => {
    it('handles pickNativePhotos cancellation and valid photos on Android', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'android';

      // Cancellation
      mockBridge.presentPhotos.mockResolvedValueOnce({ active: true, photos: undefined });
      expect(await pickNativePhotos(2)).toBeNull();

      // Valid base64 JPEG photo
      mockBridge.presentPhotos.mockResolvedValueOnce({
        active: true,
        photos: [{ name: 'camera.jpg', type: 'image/jpeg', data: 'aGVsbG8gd29ybGQ=' }],
      });
      const files = await pickNativePhotos(1);
      expect(files).toHaveLength(1);
      expect(files?.[0].name).toBe('camera.jpg');
      expect(files?.[0].type).toBe('image/jpeg');
    });

    it('handles importNativeGPX and exportNativeGPX on Android', async () => {
      mockBridge.native = true;
      mockBridge.platform = 'android';

      const validGPX = '<?xml version="1.0"?><gpx version="1.1"></gpx>';
      mockBridge.importGPX.mockResolvedValueOnce({ active: true, text: validGPX });
      const imported = await importNativeGPX();
      expect(imported).toBe(validGPX);

      mockBridge.exportGPX.mockResolvedValueOnce({ active: true, saved: true });
      const exported = await exportNativeGPX(validGPX, 'itineraire.gpx');
      expect(exported).toBe(true);
      expect(mockBridge.exportGPX).toHaveBeenCalledWith({ xml: validGPX, fileName: 'itineraire.gpx' });
    });
  });
});
