import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppShell from '@/components/shell/AppShell';

describe('Sous-phase 2.5 — AppShell Unique (TDD)', () => {
  it('TEST-SHELL-01: renders a single app-shell container with safe area styles', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        { safeTop: true, hasBottomNav: true },
        React.createElement('div', { id: 'test-content' }, 'Contenu page')
      )
    );
    expect(html).toContain('app-shell');
    expect(html).toContain('Contenu page');
    expect(html).toContain('--bottom-nav-height');
  });

  it('TEST-SHELL-02: renders optional sticky header slot above content', () => {
    const header = React.createElement('header', { id: 'sticky-hdr' }, 'Titre Header');
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        { header, safeTop: true },
        React.createElement('p', null, 'Texte')
      )
    );
    expect(html).toContain('Titre Header');
    expect(html).toContain('Texte');
  });

  it('TEST-SHELL-03: renders bottomExtra slot when provided for secondary tabs or filters', () => {
    const bottomExtra = React.createElement('div', { id: 'extra-filters' }, 'Filtres rapides');
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        { bottomExtra },
        React.createElement('p', null, 'Corps')
      )
    );
    expect(html).toContain('Filtres rapides');
    expect(html).toContain('Corps');
  });
});
