// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  ACCESSIBILITY_STORAGE_KEY,
  applyAccessibilityToDocument,
  clampTextScale,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  getNearestTextScalePreset,
  getTextScaleFromPreset,
  loadAccessibilityPreferences,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  resetAccessibilityPreferences,
  resolveAccessibilityPreferences,
  sanitizeAccessibilityPreferences,
  saveAccessibilityPreferences,
  subscribeAccessibilityPreferences,
  type StorageLike,
} from '../index';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('O02 accessibility preferences', () => {
  it('clamps text scale within [0.85, 2.0] and maps presets', () => {
    expect(clampTextScale(0.2)).toBe(MIN_TEXT_SCALE);
    expect(clampTextScale(4.5)).toBe(MAX_TEXT_SCALE);
    expect(clampTextScale(Number.NaN)).toBe(1.0);
    expect(clampTextScale(1.234)).toBe(1.23);

    expect(getTextScaleFromPreset('lg')).toBe(1.15);
    expect(getNearestTextScalePreset(1.34)).toBe('xl');
    expect(getNearestTextScalePreset(0.86)).toBe('xs');
  });

  it('sanitizes invalid persisted payloads safely', () => {
    const sanitized = sanitizeAccessibilityPreferences({
      contrastMode: 'invalid' as never,
      motionMode: 'weird' as never,
      textScale: 99,
      screenReaderHints: 'yes' as never,
    });
    expect(sanitized).toEqual({
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      textScale: MAX_TEXT_SCALE,
    });
  });

  it('respects system prefers-reduced-motion and prefers-contrast when mode is system', () => {
    const resolved = resolveAccessibilityPreferences(DEFAULT_ACCESSIBILITY_PREFERENCES, {
      prefersReducedMotion: true,
      prefersHighContrast: true,
      forcedColors: false,
    });
    expect(resolved.reducedMotion).toBe(true);
    expect(resolved.highContrast).toBe(true);
    expect(resolved.enhancedFocusIndicator).toBe(true);
    expect(resolved.sources).toEqual({ contrast: 'system', motion: 'system' });
  });

  it('allows explicit user overrides over system preferences', () => {
    const prefs = sanitizeAccessibilityPreferences({
      contrastMode: 'standard',
      motionMode: 'no-preference',
      textScale: 1.35,
    });
    const resolved = resolveAccessibilityPreferences(prefs, {
      prefersReducedMotion: true,
      prefersHighContrast: true,
      forcedColors: false,
    });
    expect(resolved.highContrast).toBe(false);
    expect(resolved.reducedMotion).toBe(false);
    expect(resolved.textScale).toBe(1.35);
    expect(resolved.textScalePreset).toBe('xl');
    expect(resolved.sources).toEqual({ contrast: 'user', motion: 'user' });
  });

  it('persists, reloads, notifies subscribers, and resets preferences', () => {
    const storage = createMemoryStorage();
    const listener = vi.fn();
    const unsub = subscribeAccessibilityPreferences(listener);

    const saved = saveAccessibilityPreferences({ contrastMode: 'high', textScale: 1.5 }, storage);
    expect(saved.contrastMode).toBe('high');
    expect(saved.textScale).toBe(1.5);
    expect(listener).toHaveBeenCalledTimes(1);

    const loaded = loadAccessibilityPreferences(storage);
    expect(loaded).toEqual(saved);
    expect(storage.getItem(ACCESSIBILITY_STORAGE_KEY)).toContain('"contrastMode":"high"');

    const reset = resetAccessibilityPreferences(storage);
    expect(reset).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES);
    expect(loadAccessibilityPreferences(storage)).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES);
    unsub();
  });

  it('applies resolved accessibility attributes and CSS variables to document', () => {
    const resolved = resolveAccessibilityPreferences(
      sanitizeAccessibilityPreferences({ contrastMode: 'high', motionMode: 'reduce', textScale: 1.15 }),
      { prefersReducedMotion: false, prefersHighContrast: false, forcedColors: false },
    );
    applyAccessibilityToDocument(resolved, document);
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(document.documentElement.getAttribute('data-text-scale')).toBe('lg');
    expect(document.documentElement.style.getPropertyValue('--lkdv-text-scale')).toBe('1.15');
  });
});
