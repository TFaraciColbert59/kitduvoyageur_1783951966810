import { isNative } from "./platform";

/**
 * Masque le Splash Screen natif une fois l application prete
 */
export async function hideNativeSplashScreen(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {}
}
