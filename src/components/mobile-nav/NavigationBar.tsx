'use client';

import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { usePathname, useRouter } from 'next/navigation';
import { DESTINATIONS } from './destinationRegistry';
import { shouldUseNativeAccountBar } from './nativeAccountRoutes';
import WebNavigationBar from './navigation/WebNavigationBar';

/**
 * iOS 26+ pilot: UIKit provides REAL system Liquid Glass for the main tab bar
 * on the entire Account section. Elsewhere (and on Android/Web/older iOS),
 * the existing React navigation stays untouched.
 *
 * The native shell hosts ONE Capacitor WebView and never duplicates the
 * authenticated Next.js app or swaps its view controller.
 */
export const NATIVE_TABBAR_ENABLED = true;

type NativeTabSelection = { destination: string };
type NativeTabBarPlugin = {
  setVisible(options: { visible: boolean }): Promise<{ active: boolean }>;
  addListener(
    eventName: 'tabSelected',
    listener: (event: NativeTabSelection) => void,
  ): Promise<PluginListenerHandle>;
};

const nativeTabBar = registerPlugin<NativeTabBarPlugin>('LKDVAccountTabBar');

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [nativeActive, setNativeActive] = useState(false);
  const iosNative = NATIVE_TABBAR_ENABLED && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const eligible = iosNative && shouldUseNativeAccountBar(pathname);

  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;

    if (!eligible) {
      setNativeActive(false);
      document.documentElement.removeAttribute('data-native-account-tabbar');
      nativeTabBar.setVisible({ visible: false }).catch(() => {});
      return;
    }

    nativeTabBar.setVisible({ visible: true })
      .then(({ active }) => {
        if (cancelled) return;
        setNativeActive(active);
        if (active) document.documentElement.setAttribute('data-native-account-tabbar', '');
      })
      .catch(() => {
        if (cancelled) return;
        setNativeActive(false);
        document.documentElement.removeAttribute('data-native-account-tabbar');
      });

    return () => {
      cancelled = true;
      document.documentElement.removeAttribute('data-native-account-tabbar');
      // Also runs if navigation enters a no-nav route and this component unmounts.
      nativeTabBar.setVisible({ visible: false }).catch(() => {});
    };
  }, [eligible, iosNative]);

  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    let handle: PluginListenerHandle | undefined;

    nativeTabBar.addListener('tabSelected', ({ destination }) => {
      const tab = DESTINATIONS.find((item) => item.id === destination);
      if (tab) router.push(tab.href);
    }).then((listener) => {
      if (cancelled) {
        void listener.remove();
      } else {
        handle = listener;
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [iosNative, router]);

  // No second clickable bar or placeholder above native UITabBar.
  if (eligible && nativeActive) return null;
  return <WebNavigationBar />;
}
