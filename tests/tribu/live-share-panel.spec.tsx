/**
 * Phase 7 TRIBU — panneau de consentement au partage de position.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveSharePanelView } from '@/features/tribu/components/LiveSharePanel';

const noop = () => {};

function renderView(overrides: Partial<React.ComponentProps<typeof LiveSharePanelView>>) {
  return renderToStaticMarkup(
    React.createElement(LiveSharePanelView, {
      session: null,
      mySharing: false,
      positions: [],
      busy: false,
      error: null,
      isOrganizer: false,
      onStart: noop,
      onToggleSharing: noop,
      onCloseSession: noop,
      ...overrides,
    })
  );
}

describe('LiveSharePanelView', () => {
  it('aucune session : consentement visible, indicateur absent', () => {
    const html = renderView({});
    expect(html).toContain('Position live');
    expect(html).toContain('Désactivé par défaut');
    expect(html).toContain('live-start-open');
    expect(html).not.toContain('live-sharing-indicator');
    expect(html).not.toContain('live-close-session');
  });

  it('session ouverte : indicateur permanent, compte à rebours et arrêt à un tap', () => {
    const html = renderView({
      session: {
        id: 's1',
        startedBy: 'u1',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 5000).toISOString(),
      },
      mySharing: true,
      positions: [
        { userId: 'u1', name: 'A', avatarUrl: null, lat: 45, lng: 6, updatedAt: '' },
        { userId: 'u2', name: 'B', avatarUrl: null, lat: 45.1, lng: 6.1, updatedAt: '' },
      ],
    });
    expect(html).toContain('Sortie live en cours');
    expect(html).toContain('2 h restantes');
    expect(html).toContain('2 membres sur la carte');
    expect(html).toContain('live-sharing-indicator');
    expect(html).toContain('Arrêter mon partage');
    expect(html).not.toContain('live-close-session');
  });

  it('organisateur : clôture disponible', () => {
    const html = renderView({
      session: {
        id: 's1',
        startedBy: 'u1',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      isOrganizer: true,
    });
    expect(html).toContain('live-close-session');
    expect(html).toContain('Partager ma position');
  });

  it('erreur visible et jamais silencieuse', () => {
    const html = renderView({ error: 'Sortie live fermée ou expirée.' });
    expect(html).toContain('live-error');
    expect(html).toContain('Sortie live fermée ou expirée.');
  });
});
