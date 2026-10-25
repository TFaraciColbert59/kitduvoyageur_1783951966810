import { isNative } from "./platform";

/**
 * Gestion des evenements globaux de l application mobile (Back button Android, cycle de vie)
 */
export async function setupNativeAppListeners(options?: {
  onBackButton?: () => void;
  onAppActive?: () => void;
  onAppInactive?: () => void;
}): Promise<() => void> {
  if (!isNative()) return () => {};

  try {
    const { App } = await import("@capacitor/app");
    const backHandle = options?.onBackButton
      ? await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack && options.onBackButton) {
            options.onBackButton();
          } else if (typeof window !== "undefined" && window.history.length > 1) {
            window.history.back();
          }
        })
      : null;

    const stateHandle = await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        options?.onAppActive?.();
      } else {
        options?.onAppInactive?.();
      }
    });

    return () => {
      backHandle?.remove();
      stateHandle.remove();
    };
  } catch {
    return () => {};
  }
}
