'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeAction = {
  id: string;
  title: string;
  destructive?: boolean;
};
export type NativePromptRequest = { title: string; defaultValue?: string; placeholder?: string; confirmLabel?: string };
type NativePhotoPayload = { name: string; type: string; data: string };
export type NativeChoice = { id: string; title: string };
export type NativeChoicesRequest = {
  title: string;
  options: NativeChoice[];
  selectedId?: string;
};
export type NativeActionRequest = {
  title: string;
  message?: string;
  actions: NativeAction[];
};

type NativeUIResult = { active: boolean; actionId?: string };
type NativeUIPlugin = {
  setRoute(options: { path: string; revision: number }): Promise<{ active: boolean }>;
  presentActions(options: NativeActionRequest): Promise<NativeUIResult>;
  share(options: { url: string }): Promise<{ active: boolean }>;
  presentPrompt(options: NativePromptRequest): Promise<{ active: boolean; value?: string }>;
  presentDate(options: { title: string; value?: string }): Promise<{ active: boolean; value?: string }>;
  getCapabilities(): Promise<{ available: boolean; dates?: boolean; choices?: boolean; photos?: boolean; files?: boolean }>;
  importGPX(): Promise<{ active: boolean; text?: string }>;
  exportGPX(options: { xml: string; fileName: string }): Promise<{ active: boolean; saved?: boolean }>;
  presentPhotos(options: { maxCount: number }): Promise<{ active: boolean; photos?: NativePhotoPayload[] }>;
  presentChoices(options: NativeChoicesRequest): Promise<{ active: boolean; value?: string }>; 
};

const ui = registerPlugin<NativeUIPlugin>('LKDVNativeUI');

export function supportsNativeIOSUI(path?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isNativePlatform()) return false;
  const currentPath = path ?? window.location.pathname;
  return currentPath !== '/compas' && !currentPath.startsWith('/compas/');
}

/** Only the Next.js router owns navigation. Native remembers the path to close
 * stale sheets and to exclude Compas; it never changes the URL itself. */
export async function syncNativeUIRoute(path: string, revision: number): Promise<boolean> {
  if (!supportsNativeIOSUI(path)) {
    // Still transmit Compas so the native host immediately dismisses open UI.
    if (!supportsNativeIOSUI('/') || !path.startsWith('/compas')) return false;
  }
  try {
    const result = await ui.setRoute({ path, revision });
    return result.active === true && path !== '/compas' && !path.startsWith('/compas/');
  } catch {
    return false; // Existing App Store builds may not have this plugin.
  }
}

/** Returns undefined only if the native feature is unsupported, allowing a web
 * fallback. null means a native sheet was shown and dismissed without action. */
export async function presentNativeActions(request: NativeActionRequest): Promise<string | null | undefined> {
  if (!supportsNativeIOSUI() || !request.title.trim() ||
      request.actions.length < 1 || request.actions.length > 8) return undefined;
  if (request.actions.some(({ id, title }) => !/^[A-Za-z0-9_.-]{1,64}$/.test(id) || !title.trim()))
    return undefined;

  try {
    const result = await ui.presentActions(request);
    if (!result.active) return undefined;
    return result.actionId ?? null;
  } catch {
    return undefined;
  }
}

/** undefined = unsupported; null = cancelled; any string (including '') = confirmed. */
export async function presentNativePrompt(options: NativePromptRequest): Promise<string | null | undefined> {
  if (!supportsNativeIOSUI() || !options.title.trim() || options.title.length > 120) return undefined;
  try {
    const result = await ui.presentPrompt(options);
    if (!result.active) return undefined;
    return typeof result.value === 'string' ? result.value : null;
  } catch {
    return undefined;
  }
}

/** A handshake, not a User-Agent guess: older iOS shells keep HTML inputs. */
export async function hasNativeDatePicker(): Promise<boolean> {
  if (!supportsNativeIOSUI()) return false;
  try {
    const caps = await ui.getCapabilities();
    return caps.available === true && caps.dates === true;
  } catch { return false; }
}

/** undefined = unsupported, null = dismissed, YYYY-MM-DD = committed. */
export async function presentNativeDate(title: string, value = ''): Promise<string | null | undefined> {
  if (!supportsNativeIOSUI() || !title.trim() || title.length > 120 ||
      (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) return undefined;
  try {
    const result = await ui.presentDate({ title, value });
    if (!result.active) return undefined;
    return typeof result.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.value)
      ? result.value : null;
  } catch { return undefined; }
}

/** Query actual iOS capabilities: browsers and old app binaries keep the <select>. */
export async function hasNativeChoices(): Promise<boolean> {
  if (!supportsNativeIOSUI()) return false;
  try {
    const caps = await ui.getCapabilities();
    return caps.available === true && caps.choices === true;
  } catch { return false; }
}

/** undefined = unsupported, null = cancelled, string = confirmed selected option ID. */
export async function presentNativeChoices(request: NativeChoicesRequest): Promise<string | null | undefined> {
  if (!supportsNativeIOSUI() || request.title.length > 120 || !request.title.trim()
      || request.options.length < 1 || request.options.length > 100
      || request.options.some(x => x.id.length > 128 || !x.title.trim() || x.title.length > 200)
      || new Set(request.options.map(x => x.id)).size !== request.options.length) return undefined;
  try {
    const result = await ui.presentChoices(request);
    if (!result.active) return undefined;
    if (typeof result.value !== 'string') return null;
    return request.options.some(x => x.id === result.value) ? result.value : undefined;
  } catch { return undefined; }
}

/** Only upgraded iPhone shells render PhotosPicker. Never show duplicate pickers. */
export async function hasNativePhotos(): Promise<boolean> {
  if (!supportsNativeIOSUI()) return false;
  try {
    const caps = await ui.getCapabilities();
    return caps.available === true && caps.photos === true;
  } catch { return false; }
}

/**
 * Return File[] to the SAME private staging and Supabase upload pipeline as the web input.
 * undefined = unavailable/error; null = user cancelled; array = selected images.
 * A tight size/type boundary avoids bloating Capacitor's JS bridge.
 */
export async function pickNativePhotos(maxCount: number): Promise<File[] | null | undefined> {
  if (!supportsNativeIOSUI() || !Number.isInteger(maxCount) || maxCount < 1 || maxCount > 6)
    return undefined;
  try {
    const result = await ui.presentPhotos({ maxCount });
    if (!result.active) return undefined;
    if (result.photos === undefined) return null;
    if (!Array.isArray(result.photos) || result.photos.length > maxCount) return undefined;
    let total = 0;
    const out: File[] = [];
    for (const item of result.photos) {
      if (!item || typeof item.name !== 'string' || item.name.length > 128 ||
          typeof item.type !== 'string' || !/^image\/(jpeg|png|webp|heic|heif|gif)$/.test(item.type) ||
          typeof item.data !== 'string' || item.data.length > 11_000_000 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(item.data)) return undefined;
      const raw = atob(item.data);
      total += raw.length;
      if (!raw.length || raw.length > 8_000_000 || total > 20_000_000) return undefined;
      const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
      out.push(new File([bytes], item.name, { type: item.type }));
    }
    return out;
  } catch { return undefined; }
}


/** Files must be supported by the installed native shell, not only by the iPhone OS. */
export async function hasNativeGPXFiles(): Promise<boolean> {
  if (!supportsNativeIOSUI()) return false;
  try {
    const capabilities = await ui.getCapabilities();
    return capabilities.available === true && capabilities.files === true;
  } catch { return false; }
}

const GPX_BYTES_LIMIT = 2_000_000;

/** Keep arbitrary/oversized documents away from the Capacitor message bus. */
function isSafeGPXText(xml: string): boolean {
  return xml.length > 0 && xml.length <= GPX_BYTES_LIMIT
    && /^\s*(?:<\?xml[^>]*\?>\s*)?<gpx(?:\s|>)/i.test(xml)
    && !/<!DOCTYPE|<!ENTITY/i.test(xml);
}

/** undefined=old shell/error -> HTML fallback; null=cancelled; string=GPX data. */
export async function importNativeGPX(): Promise<string | null | undefined> {
  if (!supportsNativeIOSUI()) return undefined;
  try {
    const response = await ui.importGPX();
    if (response.active !== true) return undefined;
    if (response.text === undefined) return null;
    if (typeof response.text !== 'string' || !isSafeGPXText(response.text)) return undefined;
    return response.text;
  } catch { return undefined; }
}

/** undefined=unsupported -> browser download; false=cancelled; true=Saved to Files. */
export async function exportNativeGPX(xml: string, fileName: string): Promise<boolean | undefined> {
  if (!supportsNativeIOSUI() || !isSafeGPXText(xml)
      || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,58}\.gpx$/.test(fileName)) return undefined;
  try {
    const response = await ui.exportGPX({ xml, fileName });
    if (response.active !== true) return undefined;
    return response.saved === true;
  } catch { return undefined; }
}

export async function shareNativeURL(url: string): Promise<boolean> {
  if (!supportsNativeIOSUI()) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const result = await ui.share({ url: parsed.toString() });
    return result.active === true;
  } catch {
    return false;
  }
}
