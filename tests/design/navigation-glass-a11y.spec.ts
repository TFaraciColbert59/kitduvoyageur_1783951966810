import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const glass = readFileSync('src/styles/liquid-glass.css', 'utf8');
const tabItem = readFileSync('src/components/mobile-nav/navigation/TabItem.tsx', 'utf8');
const surface = readFileSync('src/components/mobile-nav/navigation/NavigationSurface.tsx', 'utf8');
const wrapper = readFileSync('src/components/mobile-nav/MobileNavWrapper.tsx', 'utf8');

describe('navigation mobile : matériau et accessibilité', () => {
  it('affiche la barre de chargement dès la frontière de chargement différé', () => {
    expect(wrapper).toContain('loading: () => <NavigationSurface loading label="Chargement de la navigation" />');
  });

  it('ne redéfinit pas la hauteur canonique de la barre dans les tokens Glass', () => {
    expect(tokens.match(/--nav-height:\s*\d+px;/g)).toEqual(['--nav-height: 60px;']);
  });

  it('délègue la sélection active à la lentille optique (pas de style inline legacy)', () => {
    expect(tabItem).not.toContain("border: '1px solid var(--glass-rim)'");
    expect(tabItem).not.toContain("var(--glass-specular)");
    expect(tabItem).not.toContain("var(--g2-bg)");
    expect(tabItem).toContain('lkv-nav-active-lens');
  });

  it('donne un focus visible aux liens et supprime le glissement en mouvement réduit', () => {
    expect(tabItem).toContain('lkv-nav-tab');
    expect(surface).toContain('lkv-nav-surface');
    expect(glass).toContain('.lkv-nav-tab:focus-visible');
    expect(glass).toContain('.lkv-nav-surface[data-hidden="true"]');
  });
});
