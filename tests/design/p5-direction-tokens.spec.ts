import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * P5 — DIRECTION VISUELLE (spec 2026-09-19 §6)
 *
 * Verrouille la palette clair/sombre, les échelles (espacements, rayons,
 * typographie), les états sombres complets et le câblage honnête du mode
 * sombre (prefers-color-scheme + classe .dark). Les valeurs exactes viennent
 * du dossier de lancement « Direction visuelle mobile ».
 */

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const tailwind = readFileSync('src/styles/tailwind.css', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');

describe('P5 — direction visuelle : palette', () => {
  it('palette claire exacte (fond, surface, textes, action, accent)', () => {
    expect(tokens).toContain('--lkv-surface: #F5F7F3;');
    expect(tokens).toContain('--lkv-surface-card: #FFFFFF;');
    expect(tokens).toContain('--lkv-text-primary: #172B24;');
    expect(tokens).toContain('--lkv-text-secondary: #56665D;');
    expect(tokens).toContain('--lkv-action: #226148;');
    expect(tokens).toContain('--lkv-primary-subtle: #D3EBD9;');
  });

  it('le vert forêt de marque (#17402C) reste disponible pour les titres', () => {
    expect(tokens).toContain('--lkv-primary: #17402C;');
  });

  it('palette sombre complète : fond, surface, texte et tous les états', () => {
    const dark = tokens.slice(tokens.indexOf('.dark {'));
    expect(dark).toContain('--lkv-surface: #101C17;');
    expect(dark).toContain('--lkv-surface-card: #1B2D24;');
    expect(dark).toContain('--lkv-text-primary: #F1F5F1;');
    // États complétés, pas seulement l'inversion du fond.
    expect(dark).toContain('--lkv-action:');
    expect(dark).toContain('--lkv-border:');
    expect(dark).toContain('--lkv-field-bg:');
    expect(dark).toContain('--lkv-field-border:');
    expect(dark).toContain('--lkv-hover-surface:');
    expect(dark).toContain('--lkv-focus-ring:');
    expect(dark).toContain('--lkv-disabled-bg:');
    expect(dark).toContain('--lkv-disabled-text:');
    expect(dark).toContain('--glass-text:');
    expect(dark).toContain('--glass-border:');
    expect(dark).toContain('--btn-tint:');
    expect(dark).toContain('--btn-content:');
    expect(dark).toContain('--card-tint:');
    expect(dark).toContain('--card-content:');
    expect(dark).toContain('color-scheme: dark;');
  });

  it('le verre clair utilise un contenu sombre (pas de texte blanc inversé)', () => {
    expect(tokens).toContain('--glass-text-secondary: rgba(23, 43, 36, 0.74);');
    expect(tokens).toContain('--card-content: var(--lkv-text-primary);');
    expect(tokens).toContain('--btn-on-solid: var(--lkv-on-action);');
  });
});

describe('P5 — échelles espacements, rayons et typographie', () => {
  it('échelle espacements 4/8/12/16/24/32 disponible + marge écran 16', () => {
    for (const [name, value] of [
      ['--space-1', '4px'],
      ['--space-2', '8px'],
      ['--space-3', '12px'],
      ['--space-4', '16px'],
      ['--space-6', '24px'],
      ['--space-8', '32px'],
    ] as const) {
      expect(tokens, `${name} doit valoir ${value}`).toContain(`${name}: ${value};`);
    }
    expect(tokens).toContain('--lkv-screen-margin: 16px;');
    expect(tailwind).toContain('.lkv-screen-x');
  });

  it('rayons Phase 3 : cartes 28, feuilles 36, contrôles 18, nav 32', () => {
    expect(tokens).toContain('--lkv-radius-md: 18px;');
    expect(tokens).toContain('--lkv-radius-lg: 24px;');
    expect(tokens).toContain('--lkv-radius-card: 28px;');
    expect(tokens).toContain('--lkv-radius-sheet: 36px;');
    expect(tokens).toContain('--lkv-radius-nav: 32px;');
    expect(tokens).toContain('--lkv-radius-concentric:');
  });

  it('typographie Phase 2 : échelle Dynamic Type iOS (body 17, large title 34)', () => {
    expect(tokens).toContain('--lkv-text-body: 1.0625rem;');
    expect(tokens).toContain('--lkv-text-body-sm: 0.9375rem;');
    expect(tokens).toContain('--lkv-text-title-sm: 1.375rem;');
    expect(tokens).toContain('--lkv-text-title-lg: 2.125rem;');
    expect(tokens).toContain('--lkv-font-numeric: tabular-nums;');
    expect(tailwind).toContain('.text-lkv-body');
    expect(tailwind).toContain('.text-lkv-title-lg');
  });

  it('SF Pro (système) pour toute l\'UI, Manrope conservée pour la marque', () => {
    expect(tokens).toContain("--font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display'");
    expect(tokens).toContain("--font-brand: 'Manrope'");
    expect(tokens).toContain("--font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto");
  });
});

describe('P5 — câblage du mode sombre et topographie', () => {
  it('layout.tsx initialise le thème depuis la préférence système ou le choix stocké', () => {
    expect(layout).toContain("colorScheme: 'light dark'");
    expect(layout).toContain("localStorage.getItem('lkdv_theme')");
    expect(layout).toContain("matchMedia('(prefers-color-scheme: light)')");
    expect(layout).toContain("classList.add('dark')");
    expect(layout).toContain("classList.remove('dark')");
    expect(layout).toContain("setAttribute('data-theme'");
  });

  it('tailwind.css mappe le clair sur les tokens et ne fige plus de couleurs .dark', () => {
    expect(tailwind).toContain('--background: var(--lkv-surface);');
    expect(tailwind).toContain('--foreground: var(--lkv-text-primary);');
    expect(tailwind).toContain('--primary: var(--lkv-action);');
    expect(tailwind).toContain('color-scheme: light;');
    expect(tailwind).toContain('color-scheme: dark;');
  });

  it('background LKDV Phase 3 : toile unique portrait/paysage + voile', () => {
    expect(tokens).toContain('--lkv-app-bg-image-portrait:');
    expect(tokens).toContain('--lkv-app-bg-image-landscape:');
    expect(tokens).toContain('--lkv-app-bg-scrim:');
    expect(tailwind).toContain('var(--lkv-app-bg-image-portrait)');
    expect(tailwind).toContain('@media (min-aspect-ratio: 1 / 1)');
    expect(tailwind).toContain('var(--lkv-app-bg-image-landscape)');
  });
});
