// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultHealthConsentState } from '@/features/sensors';
import { HealthConsentPanel } from '../HealthConsentPanel';

afterEach(cleanup);

describe('HealthConsentPanel', () => {
  it('rend les huit scopes P01 et part de zéro accord', () => {
    render(
      <HealthConsentPanel state={createDefaultHealthConsentState(1_000)} onToggle={() => {}} />,
    );

    expect(screen.getByText('0 / 8')).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(8);
    expect(screen.getByText('Lecture des séances non autorisée')).toBeTruthy();
    expect(screen.getByText('Écriture des séances non autorisée')).toBeTruthy();
  });

  it('propage le toggle granulaire sans toucher aux autres scopes', () => {
    const onToggle = vi.fn();
    render(
      <HealthConsentPanel state={createDefaultHealthConsentState(1_000)} onToggle={onToggle} />,
    );

    const switchButton = screen.getByRole('switch', {
      name: 'Lire les séances : refusé',
    });
    fireEvent.click(switchButton);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('workouts_read', true);
  });

  it('reflète un consentement déjà accordé', () => {
    const state = createDefaultHealthConsentState(1_000);
    state.grants.workouts_read.granted = true;
    state.grants.workouts_read.source = 'user_prompt';

    render(<HealthConsentPanel state={state} onToggle={() => {}} />);

    expect(screen.getByText('1 / 8')).toBeTruthy();
    expect(screen.getByText('Lecture des séances autorisée')).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Lire les séances : autorisé' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('désactive les switches pendant une opération', () => {
    render(
      <HealthConsentPanel
        state={createDefaultHealthConsentState(1_000)}
        onToggle={() => {}}
        disabled
      />,
    );

    for (const item of screen.getAllByRole('switch')) {
      expect((item as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
