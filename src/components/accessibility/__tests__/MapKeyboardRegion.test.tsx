// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getSharedAnnouncer } from '@/features/accessibility';
import { MapKeyboardRegion } from '../MapKeyboardRegion';

afterEach(() => {
  cleanup();
  getSharedAnnouncer().destroy();
});

function renderMap(handlers: Parameters<typeof MapKeyboardRegion>[0] = { label: 'Carte' }) {
  render(
    <MapKeyboardRegion {...handlers}>
      <span>Fond de carte</span>
    </MapKeyboardRegion>,
  );
  return screen.getByRole('region', { name: handlers.label });
}

describe('MapKeyboardRegion — carte au clavier sans piège Tab', () => {
  it('expose un nom, un mode d’emploi et les raccourcis', () => {
    const region = renderMap({ label: 'Carte de l’itinéraire' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-roledescription')).toBe('carte interactive');
    expect(region.getAttribute('aria-keyshortcuts')).toContain('ArrowUp');
    expect(screen.getByText(/Flèches : déplacer la carte/)).toBeTruthy();
    const describedBy = region.getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toContain(
      'Flèches : déplacer la carte',
    );
  });

  it('traduit les flèches en déplacements et annonce la direction', () => {
    const onPan = vi.fn();
    const onAnnounce = vi.fn();
    const region = renderMap({ label: 'Carte', onPan, onAnnounce });

    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(onPan).toHaveBeenCalledWith('right', 1);
    expect(onAnnounce).toHaveBeenCalledWith('Carte déplacée vers le est');

    fireEvent.keyDown(region, { key: 'ArrowUp', shiftKey: true });
    expect(onPan).toHaveBeenCalledWith('up', 2.5);
  });

  it('gère zoom, recentrage, sélection et Échap', () => {
    const onZoom = vi.fn();
    const onResetView = vi.fn();
    const onActivateSelection = vi.fn();
    const onEscape = vi.fn();
    const onAnnounce = vi.fn();
    const region = renderMap({
      label: 'Carte',
      onZoom,
      onResetView,
      onActivateSelection,
      onEscape,
      onAnnounce,
    });

    fireEvent.keyDown(region, { key: '+' });
    expect(onZoom).toHaveBeenCalledWith(1);
    fireEvent.keyDown(region, { key: '-' });
    expect(onZoom).toHaveBeenCalledWith(-1);
    fireEvent.keyDown(region, { key: 'Home' });
    expect(onResetView).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(region, { key: 'Enter' });
    expect(onActivateSelection).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(region, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onAnnounce).toHaveBeenCalledWith('Sélection carte effacée');
  });

  it('ne consomme jamais Tab et laisse le focus sortir', () => {
    const onPan = vi.fn();
    const onEscape = vi.fn();
    const region = renderMap({ label: 'Carte', onPan, onEscape });

    const notPrevented = fireEvent.keyDown(region, { key: 'Tab' });
    expect(notPrevented).toBe(true);
    expect(onPan).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('annonce par défaut dans la live-region partagée', () => {
    const region = renderMap({ label: 'Carte' });
    fireEvent.keyDown(region, { key: 'ArrowLeft' });

    expect(
      Array.from(document.querySelectorAll('[data-lkdv-live-region="polite"]')).some(
        (node) => node.textContent === 'Carte déplacée vers le ouest',
      ),
    ).toBe(true);
  });
});
