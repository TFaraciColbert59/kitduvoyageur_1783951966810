import { isNative } from "./platform";

/**
 * Configuration de la Status Bar native
 */
export async function setStatusBarStyle(style: "dark" | "light" = "dark"): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({
      style: style === "dark" ? Style.Dark : Style.Light,
    });
  } catch {}
}

export async function setStatusBarColor(colorHex: string = "#17402C"): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    await StatusBar.setBackgroundColor({ color: colorHex });
  } catch {}
}

export async function setStatusBarOverlay(overlay: boolean = true): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay });
  } catch {}
}

/**
 * Y7.5 — Applique le thème de barre d'état natif LKDV (vert forêt #17402C, style dark, overlay)
 */
export async function applyLKDVStatusBarTheme(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#17402C" });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {}
}

