// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import {
  getSharedAnnouncer,
  resetAccessibilityPreferences,
} from '@/features/accessibility';
import { AccessibilitySettingsScreen } from '../AccessibilitySettingsScreen';

beforeEach(() => {
  localStorage.clear();
  resetAccessibilityPreferences();
});

afterEach(() => {
  cleanup();
  getSharedAnnouncer().destroy();
  localStorage.clear();
});

describe('AccessibilitySettingsScreen — écran composite', () => {
  it('assemble le titre, les préférences, l’audit et les repères clavier', () => {
    render(
      <AccessibilitySettingsScreen
        contrastPairs={[
          {
            id: 'screen',
            label: 'Texte principal',
            foreground: '#000000',
            background: '#ffffff',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Accessibilité' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Préférences d’accessibilité' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Contraste des couleurs' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Repères de navigation' })).toBeTruthy();
    expect(screen.getByText('Tab / Maj+Tab')).toBeTruthy();
    expect(screen.getByText('Échap')).toBeTruthy();
  });

  it('ne produit aucune violation WCAG A/AA détectable par axe-core', async () => {
    const { container } = render(
      <AccessibilitySettingsScreen
        contrastPairs={[
          {
            id: 'axe',
            label: 'Texte principal',
            foreground: '#000000',
            background: '#ffffff',
          },
        ]}
      />,
    );

    const result = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
      },
    });

    expect(
      result.violations.map(
        (violation) =>
          `${violation.id} : ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
      ),
    ).toEqual([]);
  });

  it('peut masquer l’audit et l’aide clavier', () => {
    render(
      <AccessibilitySettingsScreen
        showContrastAudit={false}
        showKeyboardHelp={false}
        contrastPairs={[]}
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Repères de navigation' })).toBeNull();
  });
});
