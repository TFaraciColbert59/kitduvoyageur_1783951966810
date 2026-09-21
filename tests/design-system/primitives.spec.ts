import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card, Tabs, Sheet, Badge, EmptyState, Switch } from '@/components/ui';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Sous-phase 2.3 — Primitives Partagées UI (TDD)', () => {
  it('TEST-PRIM-01: Card renders canonical surface with tone styles', () => {
    const html = renderToStaticMarkup(
      React.createElement(Card, { tone: 'sage' }, 'Contenu carte')
    );
    expect(html).toContain('data-variant="standard"');
    expect(html).toContain('Contenu carte');
    expect(html).toContain('data-tone="sage"');
  });

  it('TEST-PRIM-02: Tabs (API canonique Lot 3) rend options, état actif et compteur', () => {
    const options = [
      { id: 't1', label: 'Itinéraire', count: 5 },
      { id: 't2', label: 'Sac à dos' },
    ];
    const html = renderToStaticMarkup(
      React.createElement(Tabs, { options, value: 't1', onChange: () => {} })
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Itinéraire');
    expect(html).toContain('Sac à dos');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('5');
  });

  it('TEST-PRIM-03: Sheet (Radix) monte sans crash et expose l’a11y de fermeture', () => {
    expect(() =>
      renderToStaticMarkup(
        React.createElement(Sheet, {
          open: true,
          onOpenChange: () => {},
          title: 'Édition étape',
          children: React.createElement('p', null, 'Formulaire'),
        })
      )
    ).not.toThrow();
    const src = read('src/components/ui/Sheet.tsx');
    expect(src).toContain('Dialog.Title');
    expect(src).toContain('aria-label="Fermer"');
  });

  it('TEST-PRIM-04: Badge renders with unified chip styling', () => {
    const html = renderToStaticMarkup(
      React.createElement(Badge, { tone: 'sage' }, 'Certifié LKDV')
    );
    expect(html).toContain('Certifié LKDV');
  });

  it('TEST-PRIM-05: EmptyState renders with title, description, and accessible CTA', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: 'Aucun voyage prévu',
        description: 'Commencez par planifier votre première expédition.',
        actionLabel: 'Créer un voyage',
        actionHref: '/voyages/nouveau',
      })
    );
    expect(html).toContain('Aucun voyage prévu');
    expect(html).toContain('Commencez par planifier votre première expédition.');
    expect(html).toContain('Créer un voyage');
    expect(html).toContain('/voyages/nouveau');
  });

  it('TEST-PRIM-06: Switch expose role/aria-checked, label associé et tokens de motion', () => {
    const withLabel = renderToStaticMarkup(
      React.createElement(Switch, {
        checked: true,
        onCheckedChange: () => {},
        label: 'Notifications de sortie',
      })
    );
    expect(withLabel).toContain('role="switch"');
    expect(withLabel).toContain('aria-checked="true"');
    expect(withLabel).toContain('aria-labelledby=');
    expect(withLabel).toContain('Notifications de sortie');
    expect(withLabel).toContain('type="button"');

    const withoutLabel = renderToStaticMarkup(
      React.createElement(Switch, {
        checked: false,
        onCheckedChange: () => {},
        'aria-label': 'Partage de la position',
      })
    );
    expect(withoutLabel).toContain('aria-checked="false"');
    expect(withoutLabel).toContain('aria-label="Partage de la position"');
    expect(withoutLabel).toContain('--lkv-touch-min');
    expect(withoutLabel).toContain('--motion-control-duration');
  });
});
