/**
 * @fileoverview Gestion des préférences d'accessibilité persistables (Lot O02).
 * Respecte prefers-reduced-motion, prefers-contrast, forced-colors et
 * fournit une échelle typographique dynamique bornée et sûre SSR.
 */

import type {
  AccessibilityPreferences,
  ContrastPreferenceMode,
  MotionPreferenceMode,
  ResolvedAccessibilityPreferences,
  SystemAccessibilityEnvironment,
  TextScalePreset,
} from './types';

export const ACCESSIBILITY_STORAGE_KEY = 'lkdv.accessibility.preferences.v1';

export const MIN_TEXT_SCALE = 0.85;
export const MAX_TEXT_SCALE = 2.0;
export const DEFAULT_TEXT_SCALE = 1.0;

export const TEXT_SCALE_PRESETS: Record<TextScalePreset, number> = {
  xs: 0.85,
  sm: 0.92,
  md: 1.0,
  lg: 1.15,
  xl: 1.35,
  xxl: 1.65,
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  version: 1,
  contrastMode: 'system',
  motionMode: 'system',
  textScale: DEFAULT_TEXT_SCALE,
  screenReaderHints: true,
  keyboardNavigation: true,
  enhancedFocusIndicator: false,
};

const VALID_CONTRAST_MODES = new Set<ContrastPreferenceMode>(['system', 'high', 'standard']);
const VALID_MOTION_MODES = new Set<MotionPreferenceMode>(['system', 'reduce', 'no-preference']);

export function clampTextScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_TEXT_SCALE;
  const clamped = Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, scale));
  return Math.round(clamped * 100) / 100;
}

export function getTextScaleFromPreset(preset: TextScalePreset): number {
  return TEXT_SCALE_PRESETS[preset] ?? DEFAULT_TEXT_SCALE;
}

export function getNearestTextScalePreset(scale: number): TextScalePreset {
  const clamped = clampTextScale(scale);
  let nearest: TextScalePreset = 'md';
  let minDiff = Infinity;
  for (const [preset, value] of Object.entries(TEXT_SCALE_PRESETS) as Array<[TextScalePreset, number]>) {
    const diff = Math.abs(clamped - value);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = preset;
    }
  }
  return nearest;
}

export function sanitizeAccessibilityPreferences(
  raw: Partial<AccessibilityPreferences> | null | undefined,
): AccessibilityPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }

  return {
    version: 1,
    contrastMode: VALID_CONTRAST_MODES.has(raw.contrastMode as ContrastPreferenceMode)
      ? (raw.contrastMode as ContrastPreferenceMode)
      : DEFAULT_ACCESSIBILITY_PREFERENCES.contrastMode,
    motionMode: VALID_MOTION_MODES.has(raw.motionMode as MotionPreferenceMode)
      ? (raw.motionMode as MotionPreferenceMode)
      : DEFAULT_ACCESSIBILITY_PREFERENCES.motionMode,
    textScale:
      typeof raw.textScale === 'number'
        ? clampTextScale(raw.textScale)
        : DEFAULT_ACCESSIBILITY_PREFERENCES.textScale,
    screenReaderHints:
      typeof raw.screenReaderHints === 'boolean'
        ? raw.screenReaderHints
        : DEFAULT_ACCESSIBILITY_PREFERENCES.screenReaderHints,
    keyboardNavigation:
      typeof raw.keyboardNavigation === 'boolean'
        ? raw.keyboardNavigation
        : DEFAULT_ACCESSIBILITY_PREFERENCES.keyboardNavigation,
    enhancedFocusIndicator:
      typeof raw.enhancedFocusIndicator === 'boolean'
        ? raw.enhancedFocusIndicator
        : DEFAULT_ACCESSIBILITY_PREFERENCES.enhancedFocusIndicator,
  };
}

function safeMatchMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function readSystemAccessibilityEnvironment(): SystemAccessibilityEnvironment {
  return {
    prefersReducedMotion: safeMatchMedia('(prefers-reduced-motion: reduce)'),
    prefersHighContrast:
      safeMatchMedia('(prefers-contrast: more)') || safeMatchMedia('(prefers-contrast: high)'),
    forcedColors: safeMatchMedia('(forced-colors: active)'),
  };
}

export function resolveAccessibilityPreferences(
  prefs: AccessibilityPreferences,
  systemEnv: SystemAccessibilityEnvironment = readSystemAccessibilityEnvironment(),
): ResolvedAccessibilityPreferences {
  const highContrast =
    prefs.contrastMode === 'high'
      ? true
      : prefs.contrastMode === 'standard'
        ? false
        : systemEnv.prefersHighContrast || systemEnv.forcedColors;

  const reducedMotion =
    prefs.motionMode === 'reduce'
      ? true
      : prefs.motionMode === 'no-preference'
        ? false
        : systemEnv.prefersReducedMotion;

  const textScale = clampTextScale(prefs.textScale);

  return {
    highContrast,
    reducedMotion,
    forcedColors: systemEnv.forcedColors,
    textScale,
    textScalePreset: getNearestTextScalePreset(textScale),
    screenReaderHints: prefs.screenReaderHints,
    keyboardNavigation: prefs.keyboardNavigation,
    enhancedFocusIndicator: prefs.enhancedFocusIndicator || highContrast,
    sources: {
      contrast: prefs.contrastMode === 'system' ? 'system' : 'user',
      motion: prefs.motionMode === 'system' ? 'system' : 'user',
    },
  };
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof globalThis === 'undefined') return null;
  try {
    const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function loadAccessibilityPreferences(
  storage: StorageLike | null = getDefaultStorage(),
): AccessibilityPreferences {
  if (!storage) {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
  try {
    const raw = storage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return sanitizeAccessibilityPreferences(parsed);
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
}

type PreferenceListener = (prefs: AccessibilityPreferences) => void;
const listeners = new Set<PreferenceListener>();

export function saveAccessibilityPreferences(
  partial: Partial<AccessibilityPreferences>,
  storage: StorageLike | null = getDefaultStorage(),
): AccessibilityPreferences {
  const current = loadAccessibilityPreferences(storage);
  const next = sanitizeAccessibilityPreferences({ ...current, ...partial, version: 1 });
  if (storage) {
    try {
      storage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota / private browsing errors gracefully
    }
  }
  for (const listener of listeners) {
    listener(next);
  }
  return next;
}

export function resetAccessibilityPreferences(
  storage: StorageLike | null = getDefaultStorage(),
): AccessibilityPreferences {
  const next = { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  if (storage) {
    try {
      storage.removeItem(ACCESSIBILITY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  for (const listener of listeners) {
    listener(next);
  }
  return next;
}

export function subscribeAccessibilityPreferences(listener: PreferenceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Applique les préférences résolues sur le document (attributs data-* et variables CSS).
 * Idempotent et sans effet en environnement SSR/Node.
 */
export function applyAccessibilityToDocument(
  resolved: ResolvedAccessibilityPreferences,
  doc: Document | null = typeof document !== 'undefined' ? document : null,
): void {
  if (!doc || !doc.documentElement) return;
  const root = doc.documentElement;
  root.setAttribute('data-high-contrast', resolved.highContrast ? 'true' : 'false');
  root.setAttribute('data-reduced-motion', resolved.reducedMotion ? 'true' : 'false');
  root.setAttribute('data-enhanced-focus', resolved.enhancedFocusIndicator ? 'true' : 'false');
  root.setAttribute('data-text-scale', resolved.textScalePreset);
  root.style.setProperty('--lkdv-text-scale', String(resolved.textScale));
}
