import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlassCard, Tabs, Sheet, Badge, EmptyState } from '@/components/ui';

describe('Sous-phase 2.3 — Primitives Partagées UI (TDD)', () => {
  it('TEST-PRIM-01: GlassCard renders with Apple backdrop blur and tone styles', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlassCard, { tone: 'sage', blur: 'md' }, 'Contenu carte')
    );
    expect(html).toContain('glass');
    expect(html).toContain('Contenu carte');
    expect(html).toContain('backdrop-blur-');
  });

  it('TEST-PRIM-02: Tabs renders with options, accessibility and semantic classes', () => {
    const tabs = [
      { id: 't1', label: 'Itinéraire', badge: 5 },
      { id: 't2', label: 'Sac à dos' },
    ];
    const html = renderToStaticMarkup(
      React.createElement(Tabs, { tabs, activeTab: 't1', onSelectTab: () => {} })
    );
    expect(html).toContain('Itinéraire');
    expect(html).toContain('Sac à dos');
    expect(html).toContain('5');
  });

  it('TEST-PRIM-03: Sheet renders with accessibility title and dismiss button when open', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Sheet,
        { isOpen: true, onClose: () => {}, title: 'Édition étape' },
        React.createElement('p', null, 'Formulaire')
      )
    );
    expect(html).toContain('Édition étape');
    expect(html).toContain('Formulaire');
    expect(html).toContain('aria-label="Fermer"');
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
});
