import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrepCrumb, PrepNav } from '../components/PrepCrumb';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, PrepStepId } from '../types';

const noop = () => undefined;

function crumb(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(
    React.createElement(PrepCrumb, { step, draft, onOpenStep: noop }),
  );
}

function nav(step: PrepStepId, draft: AdventurePrepDraft): string {
  return renderToStaticMarkup(React.createElement(PrepNav, { step, draft, onOpenStep: noop, onClose: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** La balise complete du bouton de retour, attributs dans l'ordre du DOM. */
function backButton(html: string): string | null {
  return html.match(/<button[^>]*aria-label="Revenir en arrière"[^>]*>/)?.[0] ?? null;
}

describe('Fil d’Ariane — rendu', () => {
  it('CR-01: les trois segments sont là, dans l’ordre', () => {
    const text = visible(crumb('destination', fullDraft()));
    expect(text).toContain('Destination');
    expect(text).toContain('Parcours');
    expect(text).toContain('Départ');
    expect(text.indexOf('Destination')).toBeLessThan(text.indexOf('Parcours'));
    expect(text.indexOf('Parcours')).toBeLessThan(text.indexOf('Départ'));
  });

  it('CR-02: l’étape courante est marquée pour les technologies d’assistance', () => {
    const html = crumb('itinerary', fullDraft());
    expect(html).toContain('aria-current="step"');
  });

  it('CR-03: une seule étape est courante', () => {
    for (const step of ['destination', 'itinerary', 'departure'] as const) {
      const html = crumb(step, fullDraft());
      const count = (html.match(/aria-current="step"/g) ?? []).length;
      expect(count).toBe(1);
    }
  });

  it('CR-04: le segment actif est un libellé, pas un bouton', () => {
    const html = crumb('destination', fullDraft());
    expect(html).toContain('data-current="true"');
    expect(html).not.toContain('aria-current="step"><button');
  });

  it('CR-05: une étape atteinte est un bouton de retour', () => {
    const draft = fullDraft({ completedSteps: ['destination', 'itinerary'] });
    const html = crumb('departure', draft);
    expect(html).toContain('<button');
    expect(html).toContain('Destination');
  });

  it('CR-06: une étape verrouillée est annoncée mais pas activable', () => {
    const draft = fullDraft({ route: { origin: null, destination: null, shape: 'boucle' } });
    const html = crumb('destination', draft);
    expect(html).toContain('data-locked="true"');
    expect(html).not.toContain('data-locked="true"><button');
  });

  it('CR-07: le séparateur est décoratif, pas du texte', () => {
    const html = crumb('destination', fullDraft());
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('Barre d’étape', () => {
  it('CR-08: le fil d’Ariane remplace le compteur', () => {
    const text = visible(nav('destination', fullDraft()));
    expect(text).toContain('Destination');
    expect(text).not.toContain('Étape 1 sur 3');
  });

  it('CR-09: retour et fermeture sont nommés pour le clavier', () => {
    const html = nav('itinerary', fullDraft());
    expect(html).toContain('aria-label="Revenir en arrière"');
    expect(html).toContain('aria-label="Fermer et revenir au hub"');
  });

  it('CR-10: impossible de revenir avant la première étape', () => {
    const tag = backButton(nav('destination', fullDraft()));
    expect(tag).not.toBeNull();
    expect(tag).toContain('disabled');
  });

  it('CR-11: on peut revenir depuis l’étape 2', () => {
    const tag = backButton(nav('itinerary', fullDraft()));
    expect(tag).not.toBeNull();
    expect(tag).not.toContain('disabled');
  });
});