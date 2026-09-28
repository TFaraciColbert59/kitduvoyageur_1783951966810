import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { staleDraftMessage } from '../engine/staleDraft';
import { StaleDraftBanner } from '../components/StaleDraftBanner';

describe('staleDraftMessage', () => {
  it('nomme la date reelle et le retard reel', () => {
    const phrase = staleDraftMessage({ startDate: '2026-09-21', daysAgo: 7 });
    expect(phrase).toContain('21 septembre 2026');
    expect(phrase).toContain('7 jours');
  });

  it('accorde le jour au singulier', () => {
    const phrase = staleDraftMessage({ startDate: '2026-09-27', daysAgo: 1 });
    expect(phrase).toContain('1 jour');
    expect(phrase).not.toContain('1 jours');
  });

  it('dit pourquoi le plan ne vaut plus rien', () => {
    const phrase = staleDraftMessage({ startDate: '2026-09-21', daysAgo: 7 });
    expect(phrase).toContain('meteo'.split('e').join(String.fromCharCode(233)));
  });
});

describe('StaleDraftBanner', () => {
  it('ne rend rien quand rien n est perime', () => {
    const html = renderToStaticMarkup(<StaleDraftBanner notice={null} onReset={() => {}} />);
    expect(html).toBe('');
  });

  it('nomme le retard quand le plan est perime', () => {
    const html = renderToStaticMarkup(
      <StaleDraftBanner notice={{ startDate: '2026-09-21', daysAgo: 7 }} onReset={() => {}} />,
    );
    expect(html).toContain('21 septembre 2026');
    expect(html).toContain('7 jours');
  });

  it('propose un vrai bouton,atteignable et explicite', () => {
    const html = renderToStaticMarkup(
      <StaleDraftBanner notice={{ startDate: '2026-09-21', daysAgo: 7 }} onReset={() => {}} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('role="status"');
  });

  it('ne pretend pas qu une action a eu lieu', () => {
    const html = renderToStaticMarkup(
      <StaleDraftBanner notice={{ startDate: '2026-09-21', daysAgo: 7 }} onReset={() => {}} />,
    );
    expect(html).not.toContain('supprime');
    expect(html).not.toContain('reinitialise');
  });
});