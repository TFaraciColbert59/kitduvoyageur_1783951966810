'use client';

import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { usePathname, useRouter } from 'next/navigation';
import { DESTINATIONS, hasExtendedNav } from './destinationRegistry';
import { getNativeGlassDestination } from './nativeAccountRoutes';
import WebNavigationBar from './navigation/WebNavigationBar';
import NavigationPlateau from './navigation/NavigationPlateau';
import { useNavigationPlateau } from './navigation/useNavigationPlateau';
import { zIndex } from '@/lib/ui/zIndex';

/**
 * iPhone iOS 26+: one UIKit UITabBar, one shared Capacitor WebView.
 * Native for Community + Account families; WebNavigationBar elsewhere.
 * The five canonical destinations remain sourced from destinationRegistry.
 */
export const NATIVE_TABBAR_ENABLED = true;

type NativeTabSelection = { destination: string };
type NativeTabBarPlugin = {
  setVisible(options: { visible: boolean; selectedId?: string }): Promise<{ active: boolean }>;
  addListener(
    eventName: 'tabSelected',
    listener: (event: NativeTabSelection) => void,
  ): Promise<PluginListenerHandle>;
};
const nativeTabBar = registerPlugin<NativeTabBarPlugin>('LKDVAccountTabBar');

function NativeCommunityPlateau({ pathname }: { pathname: string | null }) {
  const controller = useNavigationPlateau(pathname);
  if (!hasExtendedNav(pathname) || controller.hiddenByEvent) return null;
  return (
    <nav
      aria-label="Navigation secondaire de la communauté"
      className="lkv-native-community-plateau md:hidden"
      style={{
        position: 'fixed', insetInline: 0, bottom: 0, zIndex: zIndex.nav,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <div style={{ width: 'min(100%, 480px)', pointerEvents: 'auto' }}>
        <NavigationPlateau controller={controller} />
      </div>
    </nav>
  );
}

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [nativeActive, setNativeActive] = useState(false);
  const iosNative = NATIVE_TABBAR_ENABLED && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const destination = iosNative ? getNativeGlassDestination(pathname) : null;
  const eligible = destination !== null;
  const hasPlateau = destination === 'community' && hasExtendedNav(pathname);

  // Listen once, including during first activation. Native taps hand off to
  // Next.js, so deep links, auth state and router history are never replaced.
  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    let handle: PluginListenerHandle | undefined;
    nativeTabBar.addListener('tabSelected', ({ destination: id }) => {
      const tab = DESTINATIONS.find((item) => item.id === id);
      if (tab) router.push(tab.href);
    }).then((listener) => {
      if (cancelled) void listener.remove();
      else handle = listener;
    }).catch(() => {});
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [iosNative, router]);

  // Sync every route, including Community <-> Account and child routes.
  // Deliberately do NOT hide during an eligible->eligible transition.
  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    if (!destination) {
      setNativeActive(false);
      document.documentElement.removeAttribute('data-native-glass-nav');
      document.documentElement.removeAttribute('data-native-glass-plateau');
      nativeTabBar.setVisible({ visible: false }).catch(() => {});
    } else {
      nativeTabBar.setVisible({ visible: true, selectedId: destination })
        .then(({ active }) => {
          if (cancelled) return;
          setNativeActive(active);
          if (active) {
            document.documentElement.setAttribute('data-native-glass-nav', destination);
            if (hasPlateau) document.documentElement.setAttribute('data-native-glass-plateau', '');
            else document.documentElement.removeAttribute('data-native-glass-plateau');
          } else {
            document.documentElement.removeAttribute('data-native-glass-nav');
            document.documentElement.removeAttribute('data-native-glass-plateau');
          }
        })
        .catch(() => {
          if (cancelled) return;
          setNativeActive(false);
          document.documentElement.removeAttribute('data-native-glass-nav');
          document.documentElement.removeAttribute('data-native-glass-plateau');
        });
    }
    return () => { cancelled = true; };
  }, [destination, hasPlateau, iosNative]);

  // Full-screen compositors/auth screens can unmount the entire navigation.
  useEffect(() => {
    if (!iosNative) return;
    return () => {
      document.documentElement.removeAttribute('data-native-glass-nav');
      document.documentElement.removeAttribute('data-native-glass-plateau');
      nativeTabBar.setVisible({ visible: false }).catch(() => {});
    };
  }, [iosNative]);

  // Fail-open: on any missing plugin, the original Web tab bar stays intact.
  if (eligible && nativeActive) {
    return hasPlateau ? <NativeCommunityPlateau pathname={pathname} /> : null;
  }
  return <WebNavigationBar />;
}
