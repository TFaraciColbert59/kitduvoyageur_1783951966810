import { Preferences } from "@capacitor/preferences";
import { isNative } from "./platform";

/**
 * Stockage cle-valeur natif securise
 */
export async function setNativePreference(key: string, value: string): Promise<void> {
  if (isNative()) {
    await Preferences.set({ key, value });
    return;
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`lkdv_pref_${key}`, value);
    } catch {}
  }
}

export async function getNativePreference(key: string, defaultValue: string | null = null): Promise<string | null> {
  if (isNative()) {
    try {
      const res = await Preferences.get({ key });
      return res.value ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem(`lkdv_pref_${key}`) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

export async function removeNativePreference(key: string): Promise<void> {
  if (isNative()) {
    await Preferences.remove({ key });
    return;
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`lkdv_pref_${key}`);
    } catch {}
  }
}
