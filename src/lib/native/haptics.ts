import { isNative } from "./platform";

export type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

/**
 * Retour haptique natif iOS/Android avec fallback Web Vibration API — SSR Safe
 */
export async function triggerNativeHaptic(style: HapticStyle = "light"): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if (isNative()) {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      switch (style) {
        case "light":
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case "medium":
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case "heavy":
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case "selection":
          await Haptics.selectionChanged();
          break;
        case "success":
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case "warning":
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case "error":
          await Haptics.notification({ type: NotificationType.Error });
          break;
      }
      return;
    }

    // Fallback Web Vibration API
    if ("vibrate" in navigator) {
      switch (style) {
        case "light":
        case "selection":
          navigator.vibrate(10);
          break;
        case "medium":
          navigator.vibrate(25);
          break;
        case "heavy":
          navigator.vibrate(45);
          break;
        case "success":
          navigator.vibrate([15, 50, 20]);
          break;
        case "warning":
        case "error":
          navigator.vibrate([30, 60, 30]);
          break;
      }
    }
  } catch {
    // Silencieux si non supporte
  }
}
