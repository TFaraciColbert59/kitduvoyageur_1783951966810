import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const glass = readFileSync('src/styles/liquid-glass.css', 'utf8');
const tabBar = readFileSync('src/components/mobile-nav/FloatingLiquidTabBar.tsx', 'utf8');
const tabBarCss = readFileSync('src/styles/floating-liquid-tabbar.css', 'utf8');
const wrapper = readFileSync('src/components/mobile-nav/MobileNavWrapper.tsx', 'utf8');

describe('navigation mobile : matériau et accessibilité', () => {
  it('affiche la même barre dès la frontière de chargement différé (aucun changement visuel)', () => {
    expect(wrapper).toContain('loading: () => <FloatingLiquidTabBar />');
  });

  it('ne redéfinit pas la hauteur canonique de la barre dans les tokens Glass', () => {
    expect(tokens.match(/--nav-height:\s*\d+px;/g)).toEqual(['--nav-height: 60px;']);
  });

  it('délègue la sélection active à la lentille optique (pas de style inline legacy)', () => {
    expect(tabBar).not.toContain("border: '1px solid var(--glass-rim)'");
    expect(tabBar).not.toContain('var(--g2-bg)');
    expect(tabBar).toContain('lkdv-floating-lens');
  });

  it('marque l’onglet actif et coupe le glissement en mouvement réduit', () => {
    expect(tabBar).toContain("aria-current={active ? 'page' : undefined}");
    expect(tabBarCss).toContain('prefers-reduced-motion');
    expect(glass.length).toBeGreaterThan(0);
  });
});
