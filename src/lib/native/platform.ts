import { Capacitor } from "@capacitor/core";

/**
 * Détection de plateforme Capacitor vs Web
 */
export function isNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return typeof window !== "undefined" && Capacitor.getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return typeof window !== "undefined" && Capacitor.getPlatform() === "android";
}

export function isWeb(): boolean {
  return typeof window === "undefined" || !Capacitor.isNativePlatform();
}

export function getPlatformName(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const p = Capacitor.getPlatform();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}
