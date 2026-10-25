/**
 * Detection de plateforme Capacitor vs Web — SSR Safe
 */
export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require("@capacitor/core");
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require("@capacitor/core");
    return Capacitor?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require("@capacitor/core");
    return Capacitor?.getPlatform?.() === "android";
  } catch {
    return false;
  }
}

export function isWeb(): boolean {
  return !isNative();
}

export function getPlatformName(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require("@capacitor/core");
    const p = Capacitor?.getPlatform?.();
    if (p === "ios") return "ios";
    if (p === "android") return "android";
    return "web";
  } catch {
    return "web";
  }
}
