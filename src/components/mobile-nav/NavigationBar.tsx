'use client';

import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { usePathname, useRouter } from 'next/navigation';
import { DESTINATIONS, hasExtendedNav } from './destinationRegistry';
import { getNativeGlassDestination, shouldShowNativeGlass } from './nativeAccountRoutes';
import WebNavigationBar from './navigation/WebNavigationBar';
import NavigationPlateau from './navigation/NavigationPlateau';
import DayPlateau from './navigation/DayPlateau';
import { useNavigationPlateau } from './navigation/useNavigationPlateau';
import { hasDayFocusPlateau, useDayFocusStore } from './dayFocusStore';
import { zIndex } from '@/lib/ui/zIndex';

/**
 * Genuine iOS system UITabBar with one shared WKWebView/Capacitor bridge.
 * Compas remains 100% web navigation; auth/checkout/composer stay full-screen.
 * Other platforms always retain the existing React bar.
 */
export const NATIVE_TABBAR_ENABLED = true;

type NativeTabSelection = { destination: string };
type NativeTabBarPlugin = {
  setVisible(options: { visible: boolean; selectedId?: string | null }): Promise<{ active: boolean; height?: number }>;
  addListener(
    eventName: 'tabSelected',
    listener: (event: NativeTabSelection) => void,
  ): Promise<PluginListenerHandle>;
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
        {showDay ? <DayPlateau /> : <NavigationPlateau controller={controller} />}
      </div>
    </nav>
  );
}

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [nativeActive, setNativeActive] = useState(false);
  const [hiddenByEvent, setHiddenByEvent] = useState(false);
  const days = useDayFocusStore((state) => state.days);
  const focusable = useDayFocusStore((state) => state.focusable);

  const iosNative = NATIVE_TABBAR_ENABLED && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const eligible = iosNative && shouldShowNativeGlass(pathname);
  const selectedId = eligible ? getNativeGlassDestination(pathname) : null;
  const showDay = hasDayFocusPlateau(pathname, days, focusable);
  const hasPlateau = hasExtendedNav(pathname) || showDay;
  const nativeVisible = eligible && !hiddenByEvent;

  useEffect(() => { setHiddenByEvent(false); }, [pathname]);

  useEffect(() => {
    const onToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ hide?: boolean }>).detail;
      if (typeof detail?.hide === 'boolean') setHiddenByEvent(detail.hide);
    };
    window.addEventListener('lkdv-toggle-bottom-bar', onToggle);
    return () => window.removeEventListener('lkdv-toggle-bottom-bar', onToggle);
  }, []);

  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    let handle: PluginListenerHandle | undefined;
    nativeTabBar.addListener('tabSelected', ({ destination }) => {
      const tab = DESTINATIONS.find((item) => item.id === destination);
      if (tab) router.push(tab.href);
    }).then((listener) => {
      if (cancelled) void listener.remove();
      else handle = listener;
    }).catch(() => {});
    return () => { cancelled = true; void handle?.remove(); };
  }, [iosNative, router]);

  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    const clearNative = () => {
      setNativeActive(false);
      document.documentElement.removeAttribute('data-native-glass-nav');
      document.documentElement.removeAttribute('data-native-glass-plateau');
      document.documentElement.style.removeProperty('--lkv-native-bar-height');
    };

    if (!nativeVisible) {
      clearNative();
      nativeTabBar.setVisible({ visible: false }).catch(() => {});
    } else {
      nativeTabBar.setVisible({ visible: true, selectedId })
        .then(({ active, height }) => {
          if (cancelled) return;
          setNativeActive(active);
          if (active) {
            document.documentElement.setAttribute('data-native-glass-nav', selectedId || 'other');
            if (hasPlateau) document.documentElement.setAttribute('data-native-glass-plateau', '');
            else document.documentElement.removeAttribute('data-native-glass-plateau');
            if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
              document.documentElement.style.setProperty('--lkv-native-bar-height', height + 'px');
            }
          } else clearNative();
        })
        .catch(() => { if (!cancelled) clearNative(); });
    }
    return () => { cancelled = true; };
  }, [iosNative, nativeVisible, selectedId, hasPlateau]);

  useEffect(() => {
    if (!iosNative) return;
    return () => {
      document.documentElement.removeAttribute('data-native-glass-nav');
      document.documentElement.removeAttribute('data-native-glass-plateau');
      document.documentElement.style.removeProperty('--lkv-native-bar-height');
      nativeTabBar.setVisible({ visible: false }).catch(() => {});
    };
  }, [iosNative]);

  if (iosNative && hiddenByEvent) return null;
  if (nativeVisible && nativeActive) {
    return hasPlateau ? <NativeSecondaryPlateau pathname={pathname} showDay={showDay} /> : null;
  }
  return <WebNavigationBar />;
}
