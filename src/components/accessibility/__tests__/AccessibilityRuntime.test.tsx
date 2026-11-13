// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import {
  ACCESSIBILITY_STORAGE_KEY,
  resetAccessibilityPreferences,
  saveAccessibilityPreferences,
} from '@/features/accessibility';
import { AccessibilityRuntime } from '../AccessibilityRuntime';

beforeEach(() => {
  localStorage.clear();
  resetAccessibilityPreferences();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  for (const attribute of [
    'data-high-contrast',
    'data-reduced-motion',
    'data-enhanced-focus',
    'data-text-scale',
  ]) {
    document.documentElement.removeAttribute(attribute);
  }
  document.documentElement.style.removeProperty('--lkdv-text-scale');
});

describe('AccessibilityRuntime — préférences appliquées à chaque page', () => {
  it('repose les attributs et l’échelle depuis le stockage', async () => {
    saveAccessibilityPreferences({
      contrastMode: 'high',
      motionMode: 'reduce',
      textScale: 1.35,
      enhancedFocusIndicator: true,
    });

    render(<AccessibilityRuntime />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
    });
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(document.documentElement.getAttribute('data-enhanced-focus')).toBe('true');
    expect(document.documentElement.getAttribute('data-text-scale')).toBe('xl');
    expect(document.documentElement.style.getPropertyValue('--lkdv-text-scale')).toBe('1.35');
    expect(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)).toContain('"contrastMode":"high"');
  });
});
