import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "./platform";

/**
 * Masque le Splash Screen natif une fois l'application prete
 */
export async function hideNativeSplashScreen(): Promise<void> {
  if (!isNative()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {}
}
