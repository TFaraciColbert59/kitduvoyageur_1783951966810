// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SosButton } from '@/features/explorer-v2/chrome/SosButton';

/**
 * SOS : comportement de maintien et de compte à rebours.
 * Testé au niveau composant (timers contrôlés) : l'e2e ne vérifie que la
 * présence du bouton, la tenue d'un geste de 1,5 s n'étant pas déterministe
 * sous charge dans un navigateur piloté.
 */

describe('Explorer v2 · bouton SOS', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('ne s’arme pas avant 1,5 s de maintien', () => {
    render(<SosButton onSend={vi.fn()} onResult={vi.fn()} simulate />);
    const button = screen.getByRole('button', { name: /SOS/i });
    fireEvent.pointerDown(button);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('button', { name: /annuler/i })).toBeNull();
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('button', { name: /annuler/i })).toBeNull();
  });

  it('s’arme après 1,5 s et annule au toucher suivant', () => {
    const onResult = vi.fn();
    render(<SosButton onSend={vi.fn()} onResult={onResult} simulate />);
    const button = screen.getByRole('button', { name: /SOS/i });
    fireEvent.pointerDown(button);
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    const countdown = screen.getByRole('button', { name: /annuler/i });
    expect(countdown.textContent).toBe('5');

    // Le relâchement du maintien ne doit pas annuler l'alerte…
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: /annuler/i })).toBeTruthy();

    // …mais un toucher volontaire, oui.
    act(() => {
      vi.advanceTimersByTime(300);
      fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    });
    expect(onResult).toHaveBeenCalledWith('cancelled');
  });

  it('envoie après le compte à rebours de 5 s', async () => {
    const onSend = vi.fn().mockResolvedValue('sent');
    const onResult = vi.fn();
    render(
      <SosButton
        onSend={onSend}
        onResult={onResult}
        position={{ lat: 45.92, lng: 6.87 }}
        sessionId="11111111-1111-1111-1111-111111111111"
      />,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: /SOS/i }));
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    act(() => {
      vi.advanceTimersByTime(5200);
    });
    expect(onSend).toHaveBeenCalledWith({
      lat: 45.92,
      lng: 6.87,
      sessionId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('le clavier arme aussi l’alerte', () => {
    render(<SosButton onSend={vi.fn()} onResult={vi.fn()} simulate />);
    fireEvent.keyDown(screen.getByRole('button', { name: /SOS/i }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: /annuler/i })).toBeTruthy();
  });

  it('aboutit à un appel simulé en recette (aucun composeur ouvert)', async () => {
    // Le composant reste simulé : il ne touche pas à `window.location`.
    // Le numéro composé est décidé par l'appelant (ExplorerV2) selon
    // `NODE_ENV` / `NEXT_PUBLIC_EXPLORER_SCENES` — vérifié ici par un espion
    // sur l'API de navigation.
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, href: '', assign },
    });

    render(<SosButton onSend={vi.fn()} onResult={vi.fn()} simulate />);
    const button = screen.getByRole('button', { name: /SOS/i });
    fireEvent.pointerDown(button);
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    act(() => {
      vi.advanceTimersByTime(5200);
    });

    expect(window.location.href).toBe('');
    expect(assign).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
