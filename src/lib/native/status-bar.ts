import { StatusBar, Style } from "@capacitor/status-bar";
import { isNative } from "./platform";

/**
 * Configuration de la Status Bar native
 */
export async function setStatusBarStyle(style: "dark" | "light" = "dark"): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({
      style: style === "dark" ? Style.Dark : Style.Light,
    });
  } catch {}
}

export async function setStatusBarColor(colorHex: string = "#17402C"): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setBackgroundColor({ color: colorHex });
  } catch {}
}

export async function setStatusBarOverlay(overlay: boolean = true): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay });
  } catch {}
}
