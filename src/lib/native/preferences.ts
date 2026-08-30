import { isNative } from "./platform";

/**
 * Stockage cle-valeur natif securise
 */
export async function setNativePreference(key: string, value: string): Promise<void> {
  if (isNative()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key, value });
      return;
    } catch {}
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
      const { Preferences } = await import("@capacitor/preferences");
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
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key });
      return;
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`lkdv_pref_${key}`);
    } catch {}
  }
}
