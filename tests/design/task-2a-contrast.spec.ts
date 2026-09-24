import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs } from '@/components/ui/Tabs';

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), 'utf8');
const layout = read('src/app/layout.tsx');
const tokens = read('src/styles/tokens.css');
const navigation = read('src/components/mobile-nav/navigation/NavigationPlateau.tsx');
const tabs = read('src/components/ui/Tabs.tsx');
const liquidGlass = read('src/styles/liquid-glass.css');
const tailwind = read('tailwind.config.js');

function getThemeScript(): string {
  const match = layout.match(/id="lkdv-theme-init"[\s\S]*?__html: `([\s\S]*?)`/);
  if (!match) {
    throw new Error('Theme bootstrap introuvable');
  }
  return match[1];
}

const themeScript = getThemeScript();

function runThemeBootstrap({
  theme,
  intensity,
  prefersLight,
}: {
  theme: string | null;
  intensity: string | null;
  prefersLight: boolean;
}) {
  const classes = new Set<string>();
  const attributes: Record<string, string> = {};
  const properties: Record<string, string> = {};
  const root = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
    style: {
      colorScheme: '',
      setProperty: (name: string, value: string) => {
        properties[name] = value;
      },
    },
  };
  const storage: Record<string, string> = {};
  if (theme !== null) storage.lkdv_theme = theme;
  if (intensity !== null) storage.lkdv_glass_intensity = intensity;
  const context = {
    document: { documentElement: root },
    localStorage: {
      getItem: (key: string) => storage[key] ?? null,
    },
    window: {
      matchMedia: (query: string) => ({
        matches: query === '(prefers-color-scheme: light)' ? prefersLight : !prefersLight,
      }),
    },
  };
  runInNewContext(themeScript, context);
  return { classes, attributes, properties, colorScheme: root.style.colorScheme };
}

function cssBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open, close + 1);
}

describe('Task 2A — contraste systémique, thème et primitives', () => {
  it('applique le thème light stocké sans changer la couleur du texte par intensité', () => {
    const result = runThemeBootstrap({ theme: 'light', intensity: '0.2', prefersLight: false });
    expect(result.classes).not.toContain('dark');
    expect(result.attributes['data-theme']).toBe('light');
    expect(result.colorScheme).toBe('light');
    expect(result.properties['--glass-intensity']).toBe('0.2');
  });

  it('applique le thème dark stocké', () => {
    const result = runThemeBootstrap({ theme: 'dark', intensity: '0.85', prefersLight: true });
    expect(result.classes).toContain('dark');
    expect(result.attributes['data-theme']).toBe('dark');
    expect(result.colorScheme).toBe('dark');
  });

  it('utilise la préférence système quand aucun thème n’est stocké', () => {
    const result = runThemeBootstrap({ theme: null, intensity: null, prefersLight: true });
    expect(result.classes).not.toContain('dark');
    expect(result.attributes['data-theme']).toBe('light');
    expect(result.colorScheme).toBe('light');
  });

  it('déclare le viewport et l’hydratation sans bootstrap d’intensité dupliqué', () => {
    expect(layout).toContain("colorScheme: 'light dark'");
    expect(layout).toMatch(/<html[\s\S]*?suppressHydrationWarning[\s\S]*?>/);
    expect(layout).not.toContain('id="glass-intensity-bootstrap"');
    expect((layout.match(/lkdv_glass_intensity/g) ?? []).length).toBe(1);
  });

  it('renforce G1 et G2 aux trois intensités sans modifier les encres', () => {
    expect(tokens).toContain(
      '--g1-bg: rgb(var(--glass-tint-rgb) / calc(0.92 + 0.06 * var(--glass-intensity, 0.5)));'
    );
    expect(tokens).toContain(
      '--g2-bg: rgb(245 248 246 / calc(0.90 + 0.08 * var(--glass-intensity, 0.5)));'
    );
    expect(tokens).toContain(
      '--g1-bg: rgba(14, 18, 16, calc(0.92 + 0.06 * var(--glass-intensity, 0.5)));'
    );
    expect(tokens).toContain(
      '--g2-bg: rgba(22, 26, 24, calc(0.90 + 0.08 * var(--glass-intensity, 0.5)));'
    );
    const textTokens =
      tokens.match(/--(?:glass-label(?:-secondary|-tertiary|-quaternary)?|g3-text):[^;]+;/g) ?? [];
    expect(textTokens.length).toBeGreaterThan(0);
    expect(textTokens.every((value) => !value.includes('glass-intensity'))).toBe(true);
  });

  it('sépare la couleur de bordure du rim', () => {
    expect(tokens).toContain('--glass-border-color: rgba(23, 43, 36, 0.12);');
    expect(tokens).toContain('--glass-border-color: rgba(255, 255, 255, 0.20);');
  });

  it('NavigationPlateau utilise G3 et une bordure de couleur sans flou imbriqué', () => {
    expect(navigation).toContain(
      "color: isSelected ? 'var(--g3-text)' : 'var(--glass-label-secondary)'"
    );
    expect(navigation).toContain("background: 'var(--g3-bg)'");
    expect(navigation).toContain("border: '1px solid var(--glass-border-color)'");
    expect(navigation).not.toContain('var(--lkv-primary)');
    const selected = navigation.slice(navigation.indexOf('{isSelected &&'));
    expect(selected).not.toContain('backdropFilter');
    expect(selected).not.toContain('WebkitBackdropFilter');
  });

  it('Tabs rend les tokens G1/G2/G3 sans flou interne', () => {
    const options = [
      { id: 'one', label: 'Un' },
      { id: 'two', label: 'Deux' },
    ];
    const scrollable = renderToStaticMarkup(
      React.createElement(Tabs, {
        options,
        value: 'one',
        onChange: () => {},
        variant: 'scrollable',
      })
    );
    const segmented = renderToStaticMarkup(
      React.createElement(Tabs, { options, value: 'one', onChange: () => {} })
    );
    expect(scrollable).toContain('bg-[var(--g2-bg)]');
    expect(scrollable).toContain('text-[var(--g3-text)]');
    expect(scrollable).not.toContain('backdrop-blur-md');
    expect(segmented).toContain('bg-[var(--g1-bg)]');
    expect(segmented).toContain('border-[color:var(--glass-border-color)]');
    expect(tabs).not.toContain('bg-[color:var(--g1-bg)]');
    expect(tabs).not.toContain('bg-[color:var(--g2-bg)]');
    expect(tabs).not.toContain('bg-[color:var(--g3-bg)]');
    expect(tabs).not.toContain('border-[color:var(--glass-rim)]');
    expect(tabs).not.toContain('glass-specular');
  });

  it('utilise G3 pour les pills et les actions primary en light et dark', () => {
    const pill = cssBlock(liquidGlass, '.glass-pill {');
    const darkPill = cssBlock(liquidGlass, '.dark .glass-pill {');
    expect(pill).toContain('background: var(--g3-bg)');
    expect(pill).toContain('color: var(--g3-text)');
    expect(pill).toContain('border: 1px solid var(--glass-border-color)');
    expect(darkPill).toContain('background: var(--g3-bg)');
    expect(darkPill).toContain('color: var(--g3-text)');
    expect(liquidGlass).toMatch(
      /\.glass-btn-primary,[^{]*\.primary[^{]*\{[^}]*background:\s*var\(--g3-bg\);[^}]*color:\s*var\(--g3-text\);/
    );
  });

  it('résout info depuis le token canonique sans hex light parallèle', () => {
    expect(tailwind).toContain("DEFAULT: 'var(--lkv-info)'");
    expect(tailwind).not.toMatch(/\binfo:\s*['\"]#4B6B7C['\"]/);
  });
});
