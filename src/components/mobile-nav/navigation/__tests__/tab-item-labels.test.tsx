import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloatingLiquidTabBar } from '../../FloatingLiquidTabBar';
import { readFileSync } from 'node:fs';

vi.mock('next/navigation', () => ({
  usePathname: () => '/communaute',
  useRouter: () => ({ push: vi.fn() }),
}));

const css = readFileSync('src/styles/floating-liquid-tabbar.css', 'utf8');

/*
 * Libellés de la barre basse : JAMAIS tronqués.
 * La barre unique iOS 27 Liquid Glass rend les 5 libellés sans troncature
 * avec white-space: nowrap et min-width: 0.
 */

describe('FloatingLiquidTabBar — libelles de la barre basse', () => {
  it('ne tronque pas le libelle le plus long', () => {
    const html = renderToStaticMarkup(React.createElement(FloatingLiquidTabBar));
    expect(html).not.toContain('truncate');
    expect(html).toContain('Communauté');
  });

  it('garde le libelle sur une seule ligne (nowrap) dans la feuille de style', () => {
    expect(css).toMatch(/white-space:\s*nowrap/);
  });

  it('l onglet ne se verrouille pas a une largeur qui tronque le mot', () => {
    expect(css).toMatch(/min-width:\s*0/);
  });

  it('conserve le libelle complet dans le HTML rendu', () => {
    const html = renderToStaticMarkup(React.createElement(FloatingLiquidTabBar));
    expect(html).toContain('Communauté');
    expect(html).toContain('Explorer');
    expect(html).toContain('Messages');
    expect(html).toContain('Compte');
    expect(html).toContain('Hub');
  });

  it('garde un aria-label accessible independant du libelle visible', () => {
    const html = renderToStaticMarkup(React.createElement(FloatingLiquidTabBar));
    expect(html).toContain('aria-label=');
  });
});
