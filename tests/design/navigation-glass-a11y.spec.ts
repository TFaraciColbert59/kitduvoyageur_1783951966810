import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const floatingBar = readFileSync('src/components/mobile-nav/FloatingLiquidTabBar.tsx', 'utf8');
const floatingCss = readFileSync('src/styles/floating-liquid-tabbar.css', 'utf8');
const wrapper = readFileSync('src/components/mobile-nav/MobileNavWrapper.tsx', 'utf8');

describe('navigation mobile : matériau et accessibilité', () => {
  it('monte NavigationBar dynamiquement via MobileNavWrapper sans bloquer le rendu', () => {
    expect(wrapper).toContain("import('@/components/mobile-nav/NavigationBar')");
    expect(wrapper).toContain('ssr: false');
  });

  it('ne redéfinit pas la hauteur canonique de la barre dans les tokens Glass', () => {
    expect(tokens.match(/--nav-height:\s*\d+px;/g)).toEqual(['--nav-height: 60px;']);
  });

  it('délègue la sélection active à la lentille optique (pas de style inline legacy)', () => {
    expect(floatingBar).toContain('className="lkdv-floating-lens"');
    expect(floatingCss).toContain('.lkdv-floating-lens');
    expect(floatingCss).toContain('transition: transform');
  });

  it('donne un focus visible aux liens et applique le style iOS 27 Liquid Glass', () => {
    expect(floatingBar).toContain('className="lkdv-floating-tabbar"');
    expect(floatingCss).toContain('.lkdv-floating-tabbar-surface');
    expect(floatingCss).toContain('-webkit-backdrop-filter: blur(28px) saturate(180%)');
  });
});
