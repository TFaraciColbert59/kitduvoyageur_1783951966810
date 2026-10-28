import { isNative } from "./platform";

export type HapticStyle =
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "selection"
  | "success"
  | "warning"
  | "error";

/**
 * Retour haptique natif iOS/Android avec fallback Web Vibration API — SSR Safe
 */
export async function triggerNativeHaptic(style: HapticStyle = "light"): Promise<void> {
  if (typeof window === "undefined") return;

  // Y7.3 — Respect strict de prefers-reduced-motion
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

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
        case "rigid":
          // `Rigid` existe dans iOS 13+ mais pas dans les types du paquet installé.
          await Haptics.impact({ style: (ImpactStyle as unknown as Record<string, string>).Rigid as never });
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
