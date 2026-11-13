// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  ACCESSIBILITY_STORAGE_KEY,
  getSharedAnnouncer,
  resetAccessibilityPreferences,
} from '@/features/accessibility';
import { AccessibilityPreferencesPanel } from '../AccessibilityPreferencesPanel';

beforeEach(() => {
  localStorage.clear();
  resetAccessibilityPreferences();
});

afterEach(() => {
  cleanup();
  getSharedAnnouncer().destroy();
  localStorage.clear();
});

describe('AccessibilityPreferencesPanel — préférences persistables', () => {
  it('présente les groupes nommés et les commandes attendues', () => {
    render(<AccessibilityPreferencesPanel />);

    expect(
      screen.getByRole('heading', { name: 'Préférences d’accessibilité' }),
    ).toBeTruthy();
    const contrastGroup = screen.getByRole('group', { name: 'Contraste' });
    const motionGroup = screen.getByRole('group', { name: 'Animations' });
    expect(contrastGroup).toBeTruthy();
    expect(motionGroup).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Taille du texte' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Assistance et clavier' })).toBeTruthy();
    expect(within(contrastGroup).getByRole('radio', { name: /Suivre le système/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Échelle typographique' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Réinitialiser les préférences' }),
    ).toBeTruthy();
  });

  it('persiste le contraste, l’applique au document et l’annonce', async () => {
    const onChange = vi.fn();
    render(<AccessibilityPreferencesPanel onPreferencesChange={onChange} />);

    const high = screen.getByRole('radio', { name: /Contraste élevé/ }) as HTMLInputElement;
    fireEvent.click(high);

    await waitFor(() => expect(high.checked).toBe(true));
    expect(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 1,
      contrastMode: 'high',
    });
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ contrastMode: 'high' });

    expect(
      Array.from(document.querySelectorAll('[data-lkdv-live-region="polite"]')).some(
        (node) => node.textContent === 'Contraste : contraste élevé.',
      ),
    ).toBe(true);
  });

  it('persiste la réduction de mouvement', async () => {
    render(<AccessibilityPreferencesPanel />);
    const motionGroup = screen.getByRole('group', { name: 'Animations' });
    fireEvent.click(within(motionGroup).getByRole('radio', { name: /^Réduire les animations/ }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    });
    expect(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? '{}')).toMatchObject({
      motionMode: 'reduce',
    });
  });

  it('met à jour le texte, l’aperçu et les attributs de document', async () => {
    render(<AccessibilityPreferencesPanel />);
    const slider = screen.getByRole('slider', { name: 'Échelle typographique' });
    fireEvent.change(slider, { target: { value: '1.35' } });

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--lkdv-text-scale')).toBe('1.35');
    });
    expect(screen.getByTestId('accessibility-preview').style.fontSize).toBe('1.35rem');
    expect(document.documentElement.getAttribute('data-text-scale')).toBe('xl');
    expect(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? '{}')).toMatchObject({
      textScale: 1.35,
    });
  });

  it('applique les préréglages avec aria-pressed et une taille bornée', async () => {
    render(<AccessibilityPreferencesPanel />);
    const grand = screen.getByRole('button', { name: 'Taille Grand' });
    fireEvent.click(grand);

    await waitFor(() => expect(grand.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByTestId('accessibility-preview').style.fontSize).toBe('1.15rem');
    expect(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? '{}')).toMatchObject({
      textScale: 1.15,
    });
  });

  it('bascule les options d’assistance et écrit chaque choix', async () => {
    render(<AccessibilityPreferencesPanel />);
    const hints = screen.getByRole('switch', { name: /Indices et descriptions enrichies/ });
    expect(hints.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(hints);
    await waitFor(() => expect(hints.getAttribute('aria-checked')).toBe('false'));
    expect(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? '{}')).toMatchObject({
      screenReaderHints: false,
    });

    const keyboard = screen.getByRole('switch', { name: /Raccourcis clavier de la carte/ });
    fireEvent.click(keyboard);
    await waitFor(() => expect(keyboard.getAttribute('aria-checked')).toBe('false'));

    const focus = screen.getByRole('switch', { name: /Anneau de focus renforcé/ });
    fireEvent.click(focus);
    await waitFor(() => expect(focus.getAttribute('aria-checked')).toBe('true'));
    expect(document.documentElement.getAttribute('data-enhanced-focus')).toBe('true');
  });

  it('réinitialise le stockage, l’aperçu et le statut', async () => {
    render(<AccessibilityPreferencesPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Taille Maximum' }));
    await waitFor(() => expect(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les préférences' }));

    await waitFor(() => expect(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)).toBeNull());
    expect(screen.getByTestId('accessibility-preview').style.fontSize).toBe('1rem');
    expect(screen.getByTestId('accessibility-status').textContent).toContain(
      'Préférences d’accessibilité réinitialisées.',
    );
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('false');
  });
});
