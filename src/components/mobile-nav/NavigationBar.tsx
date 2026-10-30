'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { usePathname, useRouter } from 'next/navigation';
import { DESTINATIONS, hasExtendedNav } from './destinationRegistry';
import { getNativeGlassDestination, shouldShowNativeGlass } from './nativeAccountRoutes';
import { getNativePrefetchRoutes, nativeSyncKey } from './nativeNavigationPerformance';
import FloatingLiquidTabBar from './FloatingLiquidTabBar';
import NavigationPlateau from './navigation/NavigationPlateau';
import DayPlateau from './navigation/DayPlateau';
import { useNavigationPlateau } from './navigation/useNavigationPlateau';
import { hasDayFocusPlateau, useDayFocusStore } from './dayFocusStore';
import { zIndex } from '@/lib/ui/zIndex';

export const NATIVE_TABBAR_ENABLED = true;

type NativeTabSelection = { destination: string };
type NativeTabBarResult = { active: boolean; height?: number };
type NativeTabBarPlugin = {
  setVisible(options: {
    visible: boolean; selectedId?: string | null; revision: number;
  }): Promise<NativeTabBarResult>;
  addListener(eventName: 'tabSelected', listener: (event: NativeTabSelection) => void): Promise<PluginListenerHandle>;
};
const nativeTabBar = registerPlugin<NativeTabBarPlugin>('LKDVAccountTabBar');

function NativeSecondaryPlateau({ pathname, showDay }: { pathname: string | null; showDay: boolean }) {
  const controller = useNavigationPlateau(pathname);
  if (controller.hiddenByEvent || (!showDay && !hasExtendedNav(pathname))) return null;
  return (
    <nav
      aria-label="Navigation secondaire"
      className="lkv-native-community-plateau md:hidden"
      style={{
        position: 'fixed', insetInline: 0,
        bottom: 'var(--lkv-native-bar-height, 83px)', zIndex: zIndex.nav,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <div style={{ width: 'min(100%, 480px)', pointerEvents: 'auto' }}>
        {showDay ? <DayPlateau instant /> : <NavigationPlateau controller={controller} instant />}
      </div>
    </nav>
  );
}

type NativePhase = 'checking' | 'active' | 'fallback';

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const iosNative = NATIVE_TABBAR_ENABLED && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const eligible = iosNative && shouldShowNativeGlass(pathname);
  const selectedId = eligible ? getNativeGlassDestination(pathname) : null;
  const [phase, setPhase] = useState<NativePhase>('checking');
  const [hiddenByEvent, setHiddenByEvent] = useState(false);
  const days = useDayFocusStore((state) => state.days);
  const focusable = useDayFocusStore((state) => state.focusable);
  const showDay = hasDayFocusPlateau(pathname, days, focusable);
  const hasPlateau = hasExtendedNav(pathname) || showDay;
  const nativeVisible = eligible && !hiddenByEvent;
  const revisionRef = useRef(0);
  const lastSyncRef = useRef('');
  const currentRouteRef = useRef(pathname);
  const pendingNavigationRef = useRef<{ href: string; start: number } | null>(null);
  currentRouteRef.current = pathname;

  useEffect(() => { setHiddenByEvent(false); }, [pathname]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ hide?: boolean }>).detail;
      if (typeof detail?.hide === 'boolean') setHiddenByEvent(detail.hide);
    };
    window.addEventListener('lkdv-toggle-bottom-bar', handler);
    return () => window.removeEventListener('lkdv-toggle-bottom-bar', handler);
  }, []);

  // Tap feedback and selection are handled synchronously by UIKit.
  // This bridge only changes the Next.js route; never destroy the WebView.
  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    let handle: PluginListenerHandle | undefined;
    nativeTabBar.addListener('tabSelected', ({ destination }) => {
      const tab = DESTINATIONS.find((item) => item.id === destination);
      if (!tab) return;
      // Repeated tap on the already displayed root: stop the native pending
      // indicator immediately rather than waiting for an absent route update.
      if (currentRouteRef.current === tab.href) {
        // Acknowledge without invalidating the in-flight initial sync.
        nativeTabBar.setVisible({ visible: true, selectedId: tab.id, revision: revisionRef.current })
          .catch(() => {});
        return;
      }
      // Measure route commit separately from the instantaneous UIKit tap.
      pendingNavigationRef.current = { href: tab.href, start: performance.now() };
      // A resident Next.js page can reuse its warmed RSC payload.
      router.push(tab.href);
    }).then((listener) => {
      if (cancelled) void listener.remove();
      else handle = listener;
    }).catch(() => {});

    return () => { cancelled = true; void handle?.remove(); };
  }, [iosNative, router]);

  // A test device can listen for lkdv:native-route-commit and measure real
  // Next.js routing latency without sending personal navigation data remotely.
  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (!pending || pathname !== pending.href) return;
    pendingNavigationRef.current = null;
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('lkdv:native-route-commit', {
        detail: { durationMs: Math.round(performance.now() - pending.start), destination: pathname },
      }));
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // Reserve the overlay/inset locally and immediately while the selected
  // route changes. The UIKit bridge itself never waits for this CSS work.
  useEffect(() => {
    const root = document.documentElement;
    if (iosNative && nativeVisible && phase === 'active') {
      root.setAttribute('data-native-glass-nav', selectedId || 'other');
      if (hasPlateau) root.setAttribute('data-native-glass-plateau', '');
      else root.removeAttribute('data-native-glass-plateau');
    } else if (!nativeVisible || phase === 'fallback') {
      root.removeAttribute('data-native-glass-nav');
      root.removeAttribute('data-native-glass-plateau');
      root.style.removeProperty('--lkv-native-bar-height');
    }
  }, [iosNative, nativeVisible, selectedId, hasPlateau, phase]);

  // Only the currently requested sync may update JS state; each request is
  // versioned on BOTH sides of the Capacitor bridge to reject stale results.
  useEffect(() => {
    if (!iosNative) return;
    const syncKey = nativeSyncKey({ visible: nativeVisible, selectedId }, pathname);
    if (lastSyncRef.current === syncKey) return;
    lastSyncRef.current = syncKey;
    const revision = ++revisionRef.current;
    let cancelled = false;
    const timer = nativeVisible ? window.setTimeout(() => {
      if (!cancelled && revision === revisionRef.current && phase === 'checking') {
        setPhase('fallback');
      }
    }, 750) : undefined;

    nativeTabBar.setVisible({ visible: nativeVisible, selectedId, revision })
      .then(({ active, height }) => {
        if (cancelled || revision !== revisionRef.current) return;
        if (timer !== undefined) window.clearTimeout(timer);
        if (active && nativeVisible) {
          if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
            document.documentElement.style.setProperty('--lkv-native-bar-height', height + 'px');
          }
          setPhase('active');
        } else if (!nativeVisible) {
          // On Compas the legacy web navigation renders, never native glass.
          setPhase('checking');
        } else {
          setPhase('fallback');
        }
      })
      .catch(() => {
        if (cancelled || revision !== revisionRef.current) return;
        if (timer !== undefined) window.clearTimeout(timer);
        setPhase('fallback');
      });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [iosNative, nativeVisible, selectedId, pathname]);

  // True route prefetch, but only on Wi-Fi. Most iPhones do not expose the
  // Network Information API: use Capacitor Network, not navigator.connection.
  // No automatic cellular prefetch; conserve bandwidth for outdoor users.
  useEffect(() => {
    if (!iosNative || !eligible) return;
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const start = async () => {
      try {
        const { getNetworkState } = await import('@/lib/native/network');
        const net = await getNetworkState();
        if (cancelled || !net.connected || net.connectionType !== 'wifi') return;
        const requests = getNativePrefetchRoutes(currentRouteRef.current || '');
        let i = 0;
        const warmNext = () => {
          if (cancelled || document.visibilityState === 'hidden' || i >= requests.length) return;
          const href = requests[i++];
          if (href) router.prefetch(href);
          pending = setTimeout(warmNext, 180);
        };
        pending = setTimeout(warmNext, 300);
      } catch {
        // No network API => no speculative traffic.
      }
    };
    void start();
    return () => { cancelled = true; if (pending !== undefined) clearTimeout(pending); };
  }, [iosNative, eligible, router]);

  useEffect(() => {
    if (!iosNative) return;
    return () => {
      document.documentElement.removeAttribute('data-native-glass-nav');
      document.documentElement.removeAttribute('data-native-glass-plateau');
      document.documentElement.style.removeProperty('--lkv-native-bar-height');
      const revision = ++revisionRef.current;
      nativeTabBar.setVisible({ visible: false, revision }).catch(() => {});
    };
  }, [iosNative]);

  if (iosNative && hiddenByEvent) return null;
  // Avoid flashing the web bar for 1-2 frames at startup.
  // If the plugin is absent/unresponsive, restore it in <= 750ms.
  if (nativeVisible && phase !== 'fallback') {
    return phase === 'active' && hasPlateau
      ? <NativeSecondaryPlateau pathname={pathname} showDay={showDay} />
      : null;
  }
  return <FloatingLiquidTabBar />;
}
