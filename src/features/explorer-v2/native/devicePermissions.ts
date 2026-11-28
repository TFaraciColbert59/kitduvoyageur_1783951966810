'use client';

/**
 * Cross-Platform Device Geolocation & Sensor Permission Manager (LKDV Explorer v2).
 *
 * Ensures OS permission dialogs trigger reliably across ALL platforms:
 * - iOS Safari & iOS PWA (requires synchronous call inside user gesture + DeviceOrientationEvent.requestPermission)
 * - Android Chrome / Samsung Internet / Firefox Mobile
 * - macOS Safari & Desktop Chrome / Edge / Firefox
 * - Capacitor / Hybrid native WebViews (`window.Capacitor.Plugins.Geolocation`)
 *
 * Also handles:
 * - Non-HTTPS LAN mobile access detection (`window.isSecureContext === false`)
 * - Automatic 2-stage acquisition: High-Accuracy GPS -> Network/Wi-Fi fallback on indoors TIMEOUT/UNAVAILABLE
 * - Live permission recovery watcher (`navigator.permissions` + `visibilitychange`/`focus`)
 */

export type DevicePlatform =
  | 'capacitor'
  | 'ios-pwa'
  | 'ios-safari'
  | 'android'
  | 'macos-safari'
  | 'desktop-chromium'
  | 'desktop-firefox'
  | 'unknown';

export type LocationPermissionStatus = 'granted' | 'prompt' | 'denied';

export type LocationErrorReason =
  | 'denied'
  | 'insecure_context'
  | 'unsupported'
  | 'timeout'
  | 'unavailable';

export interface AcquiredDeviceLocation {
  ok: true;
  lat: number;
  lng: number;
  accuracyM: number | null;
  altitudeM: number | null;
  headingDeg: number | null;
  speedMs: number | null;
  timestampMs: number;
  usedFallbackAccuracy: boolean;
  platform: DevicePlatform;
}

export interface FailedDeviceLocation {
  ok: false;
  reason: LocationErrorReason;
  platform: DevicePlatform;
  titleFr: string;
  instructionsFr: string;
}

export type DeviceLocationResult = AcquiredDeviceLocation | FailedDeviceLocation;

interface CapacitorGeolocationPlugin {
  requestPermissions?: (opts?: { permissions?: string[] }) => Promise<{ location?: string; coarseLocation?: string }>;
  checkPermissions?: () => Promise<{ location?: string; coarseLocation?: string }>;
  getCurrentPosition?: (opts?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }) => Promise<{
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      altitude?: number | null;
      heading?: number | null;
      speed?: number | null;
    };
    timestamp?: number;
  }>;
}

function getCapacitorGeoPlugin(): CapacitorGeolocationPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { Geolocation?: CapacitorGeolocationPlugin };
      };
    }
  ).Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.Geolocation) {
    return cap.Plugins.Geolocation;
  }
  return null;
}

export function detectDevicePlatform(): DevicePlatform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unknown';
  if (getCapacitorGeoPlugin()) return 'capacitor';

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouch = navigator.maxTouchPoints ?? 0;

  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === 'MacIntel' && maxTouch > 1);
  if (isIOS) {
    const standalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches);
    return standalone ? 'ios-pwa' : 'ios-safari';
  }

  if (/Android/i.test(ua)) return 'android';
  if (/Firefox/i.test(ua)) return 'desktop-firefox';
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return 'macos-safari';
  if (/Chrome|Chromium|Edg/i.test(ua)) return 'desktop-chromium';
  return 'unknown';
}

export function isGeolocationContextSecure(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext === true) return true;
  const host = window.location?.hostname ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function locationRecoveryHintForPlatform(
  platform: DevicePlatform,
  reason: LocationErrorReason,
): { titleFr: string; instructionsFr: string } {
  if (reason === 'insecure_context') {
    return {
      titleFr: 'Connexion HTTPS requise sur mobile',
      instructionsFr:
        'Sur téléphone, le navigateur bloque le GPS en HTTP local. Ouvrez Explorer en HTTPS ou sur localhost.',
    };
  }
  if (reason === 'unsupported') {
    return {
      titleFr: 'Localisation indisponible',
      instructionsFr:
        'Cet appareil ou navigateur ne fournit pas de capteur de localisation. Choisissez un lieu de départ manuellement.',
    };
  }
  if (reason === 'timeout' || reason === 'unavailable') {
    return {
      titleFr: 'Signal GPS introuvable',
      instructionsFr:
        'Vérifiez que la localisation de votre appareil est activée, puis réessayez près d’une fenêtre ou en extérieur.',
    };
  }

  switch (platform) {
    case 'ios-safari':
    case 'ios-pwa':
      return {
        titleFr: 'Localisation bloquée sur iOS',
        instructionsFr:
          'iPhone / iPad : Réglages → Confidentialité → Service de localisation → Safari → Lorsque l’app est active.',
      };
    case 'android':
      return {
        titleFr: 'Localisation bloquée sur Android',
        instructionsFr:
          'Android : touchez l’icône cadenas/paramètres dans la barre d’adresse → Autorisations → Position → Autoriser.',
      };
    case 'macos-safari':
      return {
        titleFr: 'Localisation bloquée dans Safari',
        instructionsFr:
          'Safari : Réglages pour ce site web → Localisation → Autoriser (et Réglages Système → Confidentialité).',
      };
    case 'desktop-firefox':
      return {
        titleFr: 'Localisation bloquée dans Firefox',
        instructionsFr:
          'Firefox : cliquez sur l’icône d’autorisations à gauche de l’URL → Effacer le blocage Position → Réessayer.',
      };
    case 'capacitor':
      return {
        titleFr: 'Localisation désactivée',
        instructionsFr:
          'Ouvrez les réglages de l’application sur votre appareil et autorisez l’accès à la position.',
      };
    default:
      return {
        titleFr: 'Localisation bloquée par le navigateur',
        instructionsFr:
          'Cliquez sur l’icône cadenas/réglages à gauche de l’adresse du site → Position → Autoriser, puis réessayez.',
      };
  }
}

/**
 * Triggers iOS 13+ Safari compass & motion permission prompts.
 * MUST be invoked synchronously inside a direct click/tap handler!
 */
export function requestOrientationAndMotionSensors(): void {
  if (typeof window === 'undefined') return;
  try {
    const doe = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof doe?.requestPermission === 'function') {
      void doe.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore unsupported browser */
  }
  try {
    const dme = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof dme?.requestPermission === 'function') {
      void dme.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore unsupported browser */
  }
}

/**
 * Probes current geolocation permission state without triggering a prompt.
 */
export async function probeGeolocationPermission(): Promise<LocationPermissionStatus | 'unknown'> {
  if (typeof navigator === 'undefined') return 'unknown';

  const capGeo = getCapacitorGeoPlugin();
  if (capGeo?.checkPermissions) {
    try {
      const res = await capGeo.checkPermissions();
      const raw = res.location ?? res.coarseLocation;
      if (raw === 'granted') return 'granted';
      if (raw === 'denied') return 'denied';
      if (raw === 'prompt' || raw === 'prompt-with-rationale') return 'prompt';
    } catch {
      /* fall through to web API */
    }
  }

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        return status.state;
      }
    } catch {
      /* Safari < 16 or restricted WebView */
    }
  }
  return 'unknown';
}

/**
 * Subscribes to live OS/browser permission changes (including returning from Settings).
 */
export function subscribeGeolocationPermissionChange(
  onChange: (state: LocationPermissionStatus) => void,
): () => void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return () => {};
  }

  let disposed = false;
  let permStatus: PermissionStatus | null = null;
  let lastEmittedState: LocationPermissionStatus | null = null;

  const emitIfChanged = (state: LocationPermissionStatus) => {
    if (disposed || state === 'unknown' || state === lastEmittedState) return;
    lastEmittedState = state;
    onChange(state);
  };

  const checkNow = () => {
    void probeGeolocationPermission().then((state) => {
      emitIfChanged(state);
    });
  };

  if (navigator.permissions?.query) {
    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (disposed) return;
        permStatus = status;
        if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
          emitIfChanged(status.state);
        }
        status.onchange = () => {
          if (!disposed && (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt')) {
            emitIfChanged(status.state);
          }
        };
      })
      .catch(() => {});
  }

  const onVisibleOrFocus = () => {
    if (document.visibilityState === 'visible') checkNow();
  };
  window.addEventListener('focus', onVisibleOrFocus);
  document.addEventListener('visibilitychange', onVisibleOrFocus);

  return () => {
    disposed = true;
    if (permStatus) permStatus.onchange = null;
    window.removeEventListener('focus', onVisibleOrFocus);
    document.removeEventListener('visibilitychange', onVisibleOrFocus);
  };
}

/**
 * Universal cross-platform location & sensor request.
 *
 * CRITICAL: Calls `navigator.geolocation.getCurrentPosition` SYNCHRONOUSLY before any `await`
 * so iOS Safari, iOS PWA, macOS Safari, and Android Chrome reliably display the native OS
 * permission dialog when invoked from a tap/click event.
 *
 * Automatically falls back from High-Accuracy GPS to Network/Wi-Fi accuracy on indoors timeout.
 */
export function requestDeviceLocationAndSensors(options?: {
  highAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
  includeSensors?: boolean;
}): Promise<DeviceLocationResult> {
  const platform = detectDevicePlatform();
  const highAccuracy = options?.highAccuracy ?? true;
  const timeoutMs = options?.timeoutMs ?? 9000;
  const maximumAgeMs = options?.maximumAgeMs ?? 20_000;

  if (options?.includeSensors !== false) {
    requestOrientationAndMotionSensors();
  }

  // 1. Native Capacitor wrapper (iOS/Android hybrid app)
  const capGeo = getCapacitorGeoPlugin();
  if (capGeo?.requestPermissions && capGeo.getCurrentPosition) {
    return capGeo
      .requestPermissions({ permissions: ['location', 'coarseLocation'] })
      .then(async (perm) => {
        const status = perm.location ?? perm.coarseLocation;
        if (status === 'denied') {
          const hint = locationRecoveryHintForPlatform('capacitor', 'denied');
          return { ok: false, reason: 'denied', platform: 'capacitor', ...hint } as FailedDeviceLocation;
        }
        const pos = await capGeo.getCurrentPosition!({
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs,
        });
        return {
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
          altitudeM: typeof pos.coords.altitude === 'number' ? pos.coords.altitude : null,
          headingDeg: typeof pos.coords.heading === 'number' ? pos.coords.heading : null,
          speedMs: typeof pos.coords.speed === 'number' ? pos.coords.speed : null,
          timestampMs: pos.timestamp ?? Date.now(),
          usedFallbackAccuracy: false,
          platform: 'capacitor',
        } as AcquiredDeviceLocation;
      })
      .catch(() => {
        const hint = locationRecoveryHintForPlatform('capacitor', 'unavailable');
        return { ok: false, reason: 'unavailable', platform: 'capacitor', ...hint } as FailedDeviceLocation;
      });
  }

  // 2. Secure context check (mobile HTTP LAN trap!)
  if (!isGeolocationContextSecure()) {
    const hint = locationRecoveryHintForPlatform(platform, 'insecure_context');
    return Promise.resolve({
      ok: false,
      reason: 'insecure_context',
      platform,
      ...hint,
    });
  }

  // 3. Browser Geolocation API availability check
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const hint = locationRecoveryHintForPlatform(platform, 'unsupported');
    return Promise.resolve({
      ok: false,
      reason: 'unsupported',
      platform,
      ...hint,
    });
  }

  // 4. Synchronous browser geolocation call (preserves user gesture token on iOS/macOS Safari!)
  return new Promise<DeviceLocationResult>((resolve) => {
    const toSuccess = (pos: GeolocationPosition, usedFallbackAccuracy: boolean): AcquiredDeviceLocation => ({
      ok: true,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      altitudeM:
        typeof pos.coords.altitude === 'number' && Number.isFinite(pos.coords.altitude)
          ? pos.coords.altitude
          : null,
      headingDeg:
        typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading)
          ? pos.coords.heading
          : null,
      speedMs:
        typeof pos.coords.speed === 'number' && Number.isFinite(pos.coords.speed)
          ? pos.coords.speed
          : null,
      timestampMs: pos.timestamp || Date.now(),
      usedFallbackAccuracy,
      platform,
    });

    const handleFinalError = (err: GeolocationPositionError) => {
      const reason: LocationErrorReason =
        err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
      const hint = locationRecoveryHintForPlatform(platform, reason);
      resolve({
        ok: false,
        reason,
        platform,
        ...hint,
      });
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toSuccess(pos, !highAccuracy)),
      (err) => {
        // Permission explicitly denied -> do NOT retry
        if (err.code === 1) {
          handleFinalError(err);
          return;
        }
        // Indoors GPS satellite lock timeout/unavailable -> fast Wi-Fi/cell fallback!
        if (highAccuracy) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => resolve(toSuccess(fallbackPos, true)),
            handleFinalError,
            {
              enableHighAccuracy: false,
              timeout: 4_500,
              maximumAge: 300_000,
            },
          );
        } else {
          handleFinalError(err);
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? Math.min(timeoutMs, 3_500) : timeoutMs,
        maximumAge: maximumAgeMs,
      },
    );
  });
}
