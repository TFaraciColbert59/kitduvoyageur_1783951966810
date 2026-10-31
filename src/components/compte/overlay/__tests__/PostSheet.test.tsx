// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostSheet } from '../PostSheet';

// jsdom n'a pas PointerEvent : une MouseEvent porte clientY, ce qui suffit au geste.
if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  } as unknown as typeof MouseEvent;
}

afterEach(() => cleanup());

/** `ms` : durée du geste (horloge simulée) — un geste très rapide est un « flick » qui ferme. */
function drag(distance: number, ms: number) {
  const grab = screen.getByRole('button', { name: 'Fermer la publication' });
  fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(grab, { clientY: 100 + distance, pointerId: 1 });
  vi.advanceTimersByTime(ms);
  fireEvent.pointerUp(grab, { clientY: 100 + distance, pointerId: 1 });
}

describe('PostSheet — fermeture par la poignée', () => {
  it('un tap sur la poignée ferme', () => {
    const onClose = vi.fn();
    render(<PostSheet title="Post" onClose={onClose}><p>contenu</p></PostSheet>);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la publication' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('un glissement court revient en place sans fermer', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<PostSheet title="Post" onClose={onClose}><p>contenu</p></PostSheet>);
    act(() => drag(30, 600));
    act(() => { vi.advanceTimersByTime(400); });
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('un coup sec (flick) ferme même sous le seuil, comme les autres feuilles', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<PostSheet title="Post" onClose={onClose}><p>contenu</p></PostSheet>);
    act(() => drag(30, 40));
    act(() => { vi.advanceTimersByTime(400); });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('un glissement au-delà du seuil partagé (80 px) ferme après la sortie animée', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<PostSheet title="Post" onClose={onClose}><p>contenu</p></PostSheet>);
    act(() => drag(120, 600));
    act(() => { vi.advanceTimersByTime(400); });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('rend le contenu dans le conteneur de jetons de verre du fil', () => {
    render(<PostSheet title="Post" onClose={() => {}}><p>contenu</p></PostSheet>);
    expect(screen.getByText('contenu').closest('.lkdv-account-glass')).toBeTruthy();
  });
});
