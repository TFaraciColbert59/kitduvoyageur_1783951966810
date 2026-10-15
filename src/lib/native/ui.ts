'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeAction = {
  id: string;
  title: string;
  destructive?: boolean;
};
export type NativePromptRequest = { title: string; defaultValue?: string; placeholder?: string; confirmLabel?: string };
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
