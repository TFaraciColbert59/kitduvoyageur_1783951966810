import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreeSummaryScreen, type FreeSummaryScreenProps } from '../components/FreeSummaryScreen';
import { privacyRows } from '../engine/privacy';
import { activityById } from '@/features/adventure-prep/catalog';

vi.mock('../components/FreeTraceMap', () => ({
  FreeTraceMap: ({ pillLabel }: { pillLabel: string }) => <div>{pillLabel}</div>,
}));

const HANDOFF = {
  onTogglePrivacy: () => undefined,
  onPickActivity: () => undefined,
  onClose: () => undefined,
};

const RANDO = activityById('rando-journee')?.label ?? 'Randonnée';

const BASE: Omit<FreeSummaryScreenProps, keyof typeof HANDOFF> = {
  label: RANDO,
  isGuess: true,
  justification: 'Proposé par LKDV · allure 12:30 min/km',
  guessConfidence: 'proposee',
  unknownReason: null,
  duration: '2:04:10',
  distance: '9,8 km',
  elevation: '240 m',
  trace: [],
  privacy: privacyRows({ keepTrace: true, shareWithGroup: false, groupSize: 0 }),
};

function render(overrides: Partial<FreeSummaryScreenProps> = {}) {
  return renderToStaticMarkup(
    React.createElement(FreeSummaryScreen, { ...BASE, ...HANDOFF, ...overrides })
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

describe('62-libre-apres — activité terminée', () => {
  it('FREE-S01: annonce la fin de session et interroge sur la proposition', () => {
    const text = visible(render());
    expect(text).toContain('Activité terminée');
    expect(text).toContain('C’était une randonnée ?');
    expect(text).toContain('On l’a déduit de ton allure');
    expect(text).toContain('À toi de confirmer');
  });

  it('FREE-S02: la proposition est ÉTIQUETÉE comme telle, jamais présentée comme un fait', () => {
    const text = visible(render());
    expect(text).toContain('Proposé');
    expect(text).toContain('Proposé par LKDV');
    expect(text).toContain('12:30 min/km');
  });

  it('FREE-S03: une lecture incertaine est dite comme telle', () => {
    expect(visible(render({ guessConfidence: 'incertaine' }))).toContain('incertaine');
  });

  it('FREE-S04: un choix affirmatif n’est jamais mis en question', () => {
    const text = visible(render({ isGuess: false }));
    expect(text).not.toContain('C’était une randonnée ?');
    expect(text).toContain('Tu as choisi cette activité');
  });

  it('FREE-S05: sans proposition, l’écran DIT pourquoi au lieu de deviner', () => {
    const text = visible(
      render({
        label: null,
        isGuess: false,
        unknownReason: 'La session est trop courte pour distinguer une randonnée d’une course.',
      })
    );
    expect(text).toContain('Activité à confirmer');
    expect(text).toContain('La session est trop courte');
  });

  it('FREE-S06: conserve les trois mesures de la maquette, sans score', () => {
    const text = visible(render());
    expect(text).toContain('Durée');
    expect(text).toContain('2:04:10');
    expect(text).toContain('Distance');
    expect(text).toContain('9,8 km');
    expect(text).toContain('Dénivelé +');
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('FREE-S07: la carte porte la pastille « Ma trace »', () => {
    expect(render()).toContain('Ma trace');
  });

  it('FREE-S08: le partage est désactivé et la raison est nommée', () => {
    const text = visible(render());
    expect(text).toContain('Garder la trace');
    expect(text).toContain('Visible par toi seul');
    expect(text).toContain('Partager avec le groupe');
    expect(text).toContain('Désactivé');
    expect(text).toContain('individuelle');
  });

  it('FREE-S09: la ligne de partage désactivée est annoncée aux lecteurs d’écran', () => {
    expect(render()).toMatch(/data-privacy="partage"[^>]*aria-disabled="true"/);
  });

  it('FREE-S10: « Corriger » ouvre le choix d’activité, jamais un effacement silencieux', () => {
    const text = visible(render());
    expect(text).toContain('Corriger');
    expect(text).not.toContain('Supprimer');
  });

  it('FREE-S11: la fermeture vers le hub reste atteignable', () => {
    expect(render()).toContain('aria-label="Revenir au hub"');
  });

  it('FREE-S12: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render()).not.toContain('safe-area-inset');
  });
});
