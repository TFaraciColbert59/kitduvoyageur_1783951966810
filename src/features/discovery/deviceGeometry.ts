'use client';

/**
 * Détection légère de la géométrie d'écran pour adapter l'animation d'entrée
 * de la pilule de découverte :
 * - `iphone-island` : iPhone avec Dynamic Island (iOS + safe-area-top >= 47px)
 *   → la pilule naît depuis l'îlot matériel et s'ouvre en spring.
 * - `android-pill`  : Android ou iPhone sans Dynamic Island (encoche / poinçon)
 *   → pilule flottante fluide glissant sous la barre d'état.
 * - `desktop-pill`  : Tablette / Desktop (>= 768px)
 *   → pilule Liquid Glass centrée en haut d'écran.
 */
export type DiscoveryIslandGeometry = 'iphone-island' | 'android-pill' | 'desktop-pill';

export function detectIslandGeometry(): DiscoveryIslandGeometry {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'desktop-pill';
  }

  const width = window.innerWidth || 0;
  if (width >= 768) {
    return 'desktop-pill';
  }

  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone/i.test(ua);

  if (isIPhone) {
    // Mesure réelle de env(safe-area-inset-top) via une sonde temporaire
    const safeTop = measureSafeAreaTop();
    // Dynamic Island (iPhone 14 Pro, 15, 16, 17...) expose safe-area-inset-top >= 54–59px
    // (les iPhone à encoche classique sont à 44–47px).
    if (safeTop >= 50) {
      return 'iphone-island';
    }
    // En mode Safari mobile sur iPhone Dynamic Island (viewport-fit=cover),
    // screen.height >= 852 avec DPR 3 correspond aux modèles Dynamic Island.
    const sh = Math.max(window.screen?.height ?? 0, window.screen?.width ?? 0);
    if (sh >= 852 && (window.devicePixelRatio ?? 1) >= 3) {
      return 'iphone-island';
    }
  }

  return 'android-pill';
}

function measureSafeAreaTop(): number {
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;'; // lkdv-safe-area-ok
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return Number.isFinite(height) ? height : 0;
  } catch {
    return 0;
  }
}
