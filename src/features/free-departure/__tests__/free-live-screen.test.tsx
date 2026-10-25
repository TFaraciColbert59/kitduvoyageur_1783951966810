import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreeLiveScreen, type FreeLiveScreenProps } from '../components/FreeLiveScreen';

vi.mock('../components/FreeTraceMap', () => ({
  FreeTraceMap: ({ pillLabel }: { pillLabel: string }) => <div>{pillLabel}</div>,
}));

const HANDOFF = {
  onPause: () => undefined,
  onResume: () => undefined,
  onFinish: () => undefined,
};

const LIVE: Omit<FreeLiveScreenProps, keyof typeof HANDOFF> = {
  activityLabel: 'Randonnée',
  activityIcon: 'footprints',
  clock: '1:12:48',
  distance: '6,3 km',
  pace: '11:34',
  elevation: '180 m',
  paused: false,
  trackingNote: null,
  trace: [],
};

function render(overrides: Partial<FreeLiveScreenProps> = {}) {
  return renderToStaticMarkup(
    React.createElement(FreeLiveScreen, { ...LIVE, ...HANDOFF, ...overrides })
  );
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('61-libre-pendant — suivi libre en cours', () => {
  it('FREE-L01: l’activite retenue est en tete d’ecran', () => {
    expect(visible(render())).toContain('Randonnée');
  });

  it('FREE-L02: la duree ecoulee est l’element dominant', () => {
    const text = visible(render());
    expect(text).toContain('Durée écoulée');
    expect(text).toContain('1:12:48');
  });

  it('FREE-L03: affiche exactement les trois mesures utiles de la maquette', () => {
    const text = visible(render());
    expect(text).toContain('Distance');
    expect(text).toContain('6,3 km');
    expect(text).toContain('Allure min/km');
    expect(text).toContain('11:34');
    expect(text).toContain('Dénivelé +');
    expect(text).toContain('180 m');
  });

  it('FREE-L04: n’affiche AUCUNE mesure hors sujet (A9)', () => {
    const text = visible(render());
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100|calorie|kcal|brûlé/i);
  });

  it('FREE-L05: la carte porte la pastille « Ma trace »', () => {
    expect(render()).toContain('Ma trace');
  });

  it('FREE-L06: deux actions suffisent : terminer, suspendre', () => {
    const text = visible(render());
    expect(text).toContain('Terminer');
    expect(text).toContain('Pause');
  });

  it('FREE-L07: en pause, l’action principale redevient « Reprendre »', () => {
    const text = visible(render({ paused: true }));
    expect(text).toContain('Reprendre');
    expect(text).not.toContain('Pause\u00a0');
  });

  it('FREE-L08: une pause en cours est annoncee, pas seulement dans le bouton', () => {
    const html = render({ paused: true });
    expect(html).toContain('aria-live="polite"');
    expect(visible(html)).toContain('En pause');
  });

  it('FREE-L09: une perte de GPS est dite a l’ecran, jamais silencieuse', () => {
    const text = visible(
      render({ trackingNote: 'Le GPS ne répond plus : le chrono continue, la trace est interrompue.' })
    );
    expect(text).toContain('Le GPS ne répond plus');
    expect(text).toContain('trace est interrompue');
  });

  it('FREE-L10: une mesure absente s’affiche « — », jamais un zéro forgé', () => {
    const text = visible(render({ pace: '—', elevation: '—' }));
    expect(text).toContain('Allure min/km');
    expect(text).toContain('Dénivelé +');
    expect(text.match(/—/g) ?? []).toHaveLength(2);
  });

  it('FREE-L11: sans activite choisie, l’ecran dit « Suivi libre »', () => {
    expect(visible(render({ activityLabel: 'Suivi libre' }))).toContain('Suivi libre');
  });

  it('FREE-L12: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render()).not.toContain('safe-area-inset');
  });
});
