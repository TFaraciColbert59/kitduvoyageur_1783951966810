"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  isNative,
  hideNativeSplashScreen,
  setStatusBarStyle,
  setStatusBarColor,
  setupNativeAppListeners,
} from "@/lib/native";
import { purgeExpiredCache } from "@/lib/storage/cacheDB";

export default function NativeAppBootstrap() {
  const router = useRouter();

  useEffect(() => {
    // 1. Purge expired cache entries in background
    purgeExpiredCache().catch(() => {});

    // 2. Native Capacitor setup
    if (isNative()) {
      // Configure Status Bar
      setStatusBarStyle("dark").catch(() => {});
      setStatusBarColor("#17402C").catch(() => {});

      // Setup Android hardware back button & app lifecycle
      const unsubPromise = setupNativeAppListeners({
        onBackButton: () => {
          if (window.history.length > 1) {
            router.back();
          }
        },
      });

      // Hide native splash screen once DOM & React are hydrated
      const timer = setTimeout(() => {
        hideNativeSplashScreen().catch(() => {});
      }, 200);

      return () => {
        clearTimeout(timer);
        unsubPromise.then((unsub) => unsub());
      };
    }
  }, [router]);

  return null;
}
