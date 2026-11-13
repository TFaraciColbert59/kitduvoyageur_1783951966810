// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createScreenReaderAnnouncer, getSharedAnnouncer } from '@/features/accessibility';
import {
  LiveRegion,
  ScreenReaderAnnouncerProvider,
  useAnnouncer,
  useLiveAnnouncement,
} from '../LiveRegion';

afterEach(() => {
  cleanup();
  getSharedAnnouncer().destroy();
  for (const region of Array.from(document.querySelectorAll('[data-lkdv-live-region]'))) {
    region.remove();
  }
});

function AnnounceProbe() {
  const { announce, clear } = useAnnouncer();
  return (
    <>
      <button type="button" onClick={() => announce('Itinéraire recalculé')}>
        Annoncer
      </button>
      <button type="button" onClick={clear}>
        Effacer
      </button>
    </>
  );
}

function HookProbe() {
  const state = useLiveAnnouncement();
  return (
    <>
      <button type="button" onClick={() => state.announce('Erreur de connexion', 'assertive')}>
        Signaler
      </button>
      <button type="button" onClick={state.clear}>
        Vider
      </button>
      <LiveRegion message={state.message} politeness={state.politeness} visible />
    </>
  );
}

describe('LiveRegion — régions ARIA et contexte d’annonce', () => {
  it('rend une région polie atomique et met à jour son texte', () => {
    const { rerender } = render(<LiveRegion message="Carte déplacée vers le nord" />);
    const region = screen.getByRole('status');

    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.textContent).toBe('Carte déplacée vers le nord');

    rerender(<LiveRegion message="Zoom avant" />);
    expect(region.textContent).toBe('Zoom avant');
  });

  it('utilise le rôle alert pour une annonce assertive et peut être visible', () => {
    render(<LiveRegion message="Danger immédiat" politeness="assertive" visible />);
    const region = screen.getByRole('alert');
    expect(region.getAttribute('aria-live')).toBe('assertive');
    expect(region.style.position).toBe('');
  });

  it('reste muette quand politeness vaut off', () => {
    render(<LiveRegion message="Ne pas lire" politeness="off" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('[data-lkdv-live-region="off"]')?.textContent).toBe(
      'Ne pas lire',
    );
  });

  it('partage une instance d’annonceur injectée', () => {
    const announcer = createScreenReaderAnnouncer({
      document,
      idPrefix: 'provider-test',
      now: () => 1,
    });

    render(
      <ScreenReaderAnnouncerProvider announcer={announcer}>
        <AnnounceProbe />
      </ScreenReaderAnnouncerProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Annoncer' }));
    expect(document.getElementById('provider-test-polite')?.textContent).toBe(
      'Itinéraire recalculé',
    );
    expect(announcer.getHistory().at(-1)?.message).toBe('Itinéraire recalculé');

    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    expect(document.getElementById('provider-test-polite')?.textContent).toBe('');
  });

  it('pilote une région assertive avec useLiveAnnouncement', () => {
    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }));

    const region = screen.getByRole('alert');
    expect(region.textContent).toBe('Erreur de connexion');
    expect(region.getAttribute('aria-live')).toBe('assertive');

    fireEvent.click(screen.getByRole('button', { name: 'Vider' }));
    expect(region.textContent).toBe('');
  });
});
