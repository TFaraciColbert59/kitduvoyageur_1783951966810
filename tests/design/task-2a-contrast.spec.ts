import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../tailwind.config.js';
import { Tabs } from '@/components/ui/Tabs';

type RGB = [number, number, number];
type ThemePreference = 'light' | 'dark' | 'no-preference';

type ThemeResult = {
  classes: Set<string>;
  attributes: Record<string, string>;
  properties: Record<string, string>;
  colorScheme: string;
};

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
  preference,
  storageThrows = false,
}: {
  theme: string | null;
  intensity: string | null;
  preference: ThemePreference;
  storageThrows?: boolean;
}): ThemeResult {
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
      getItem: (key: string) => {
        if (storageThrows) throw new Error('storage unavailable');
        return storage[key] ?? null;
      },
    },
    window: {
      matchMedia: (query: string) => ({
        matches:
          preference === 'dark'
            ? query === '(prefers-color-scheme: dark)'
            : preference === 'light'
              ? query === '(prefers-color-scheme: light)'
              : false,
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

function getTokenValue(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(match, `${name} absent du bloc`).not.toBeNull();
  return match?.[1].trim() ?? '';
}

function hexToRgb(value: string): RGB {
  const normalized = value.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  expect(Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)).toBe(false);
  return [red, green, blue];
}

function tokenRgb(block: string, name: string): RGB {
  const value = getTokenValue(block, name);
  expect(value, `${name} doit être hexadécimal`).toMatch(/^#[0-9a-f]{6}$/i);
  return hexToRgb(value);
}

function alphaAt(block: string, name: string, intensity: number): number {
  const value = getTokenValue(block, name);
  const match = value.match(/calc\(([\d.]+) \+ ([\d.]+) \* var\(--glass-intensity, 0\.5\)\)/);
  expect(match, `${name} doit piloter l'opacité`).not.toBeNull();
  return Number(match?.[1] ?? 0) + Number(match?.[2] ?? 0) * intensity;
}

function composite(color: RGB, alpha: number, backdrop: RGB): RGB {
  return color.map((channel, index) => channel * alpha + backdrop[index] * (1 - alpha)) as RGB;
}

function rgbaToken(block: string, name: string, backdrop: RGB): RGB {
  const value = getTokenValue(block, name);
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  expect(match, `${name} doit être rgba`).not.toBeNull();
  return composite(
    [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0), Number(match?.[3] ?? 0)],
    Number(match?.[4] ?? 0),
    backdrop
  );
}

function luminance(color: RGB): number {
  const channels = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: RGB, second: RGB): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function canonicalLightBlock(): string {
  const marker = tokens.indexOf('--glass-intensity: 0.5;');
  const start = tokens.lastIndexOf(':root {', marker);
  const end = tokens.indexOf('\n}', marker);
  return tokens.slice(start, end);
}

function canonicalDarkBlock(): string {
  const start = tokens.indexOf("html.dark, .dark, [data-theme='dark'] {");
  const end = tokens.indexOf('\n}', start);
  return tokens.slice(start, end);
}

function firstRootBlock(): string {
  const start = tokens.indexOf(':root {');
  const end = tokens.indexOf('\n}', start);
  return tokens.slice(start, end);
}

async function compileUtilities(content: string): Promise<string> {
  const result = await postcss([
    tailwindcss({
      ...tailwindConfig,
      content: [{ raw: content, extension: 'html' }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

describe('Task 2A fix rounds 1–2 — contraste systémique, thème et primitives', () => {
  it('applique le thème light stocké et le repli système light malgré un stockage bloqué', () => {
    const result = runThemeBootstrap({
      theme: null,
      intensity: null,
      preference: 'light',
      storageThrows: true,
    });
    expect(result.classes).not.toContain('dark');
    expect(result.attributes['data-theme']).toBe('light');
    expect(result.colorScheme).toBe('light');
  });

  it('applique le thème dark malgré un stockage bloqué', () => {
    const result = runThemeBootstrap({
      theme: null,
      intensity: null,
      preference: 'dark',
      storageThrows: true,
    });
    expect(result.classes).toContain('dark');
    expect(result.attributes['data-theme']).toBe('dark');
    expect(result.colorScheme).toBe('dark');
  });

  it('choisit light pour no-preference', () => {
    const result = runThemeBootstrap({ theme: null, intensity: null, preference: 'no-preference' });
    expect(result.classes).not.toContain('dark');
    expect(result.attributes['data-theme']).toBe('light');
    expect(result.colorScheme).toBe('light');
  });

  it('conserve le thème stocké et l’intensité sans bootstrap dupliqué', () => {
    const result = runThemeBootstrap({ theme: 'light', intensity: '0.2', preference: 'dark' });
    expect(result.classes).not.toContain('dark');
    expect(result.attributes['data-theme']).toBe('light');
    expect(result.colorScheme).toBe('light');
    expect(result.properties['--glass-intensity']).toBe('0.2');
    expect(layout).toContain("colorScheme: 'light dark'");
    expect(layout).toMatch(/<html[\s\S]*?suppressHydrationWarning[\s\S]*?>/);
    expect(layout).not.toContain('id="glass-intensity-bootstrap"');
    expect((layout.match(/lkdv_glass_intensity/g) ?? []).length).toBe(1);
  });

  it('calcule les ratios G1/G2/G3 pour les deux thèmes et trois intensités', () => {
    const lightBlock = canonicalLightBlock();
    const darkBlock = canonicalDarkBlock();
    const lightLabels = [
      '--glass-label',
      '--glass-label-secondary',
      '--glass-label-tertiary',
      '--glass-label-quaternary',
    ].map((name) => tokenRgb(lightBlock, name));
    const darkLabels = [
      '--glass-label',
      '--glass-label-secondary',
      '--glass-label-tertiary',
      '--glass-label-quaternary',
    ].map((name) => tokenRgb(darkBlock, name));
    const lightBackdrop: RGB = [0, 0, 0];
    const darkBackdrop: RGB = [255, 255, 255];
    const lightG1: RGB = [255, 255, 255];
    const lightG2: RGB = [245, 248, 246];
    const darkG1: RGB = [14, 18, 16];
    const darkG2: RGB = [22, 26, 24];

    for (const intensity of [0.2, 0.5, 0.85]) {
      const lightG1Surface = composite(lightG1, alphaAt(lightBlock, '--g1-bg', intensity), lightBackdrop);
      const lightG2Surface = composite(lightG2, alphaAt(lightBlock, '--g2-bg', intensity), lightBackdrop);
      const darkG1Surface = composite(darkG1, alphaAt(darkBlock, '--g1-bg', intensity), darkBackdrop);
      const darkG2Surface = composite(darkG2, alphaAt(darkBlock, '--g2-bg', intensity), darkBackdrop);
      const lightG3Surface = rgbaToken(lightBlock, '--g3-bg', lightBackdrop);
      const darkG3Surface = rgbaToken(darkBlock, '--g3-bg', darkBackdrop);

      for (const label of lightLabels) {
        expect(contrast(label, lightG1Surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(label, lightG2Surface)).toBeGreaterThanOrEqual(4.5);
      }
      for (const label of darkLabels) {
        expect(contrast(label, darkG1Surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(label, darkG2Surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(tokenRgb(lightBlock, '--g3-text'), lightG3Surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokenRgb(darkBlock, '--g3-text'), darkG3Surface)).toBeGreaterThanOrEqual(4.5);
    }

    const labelDeclarations = tokens.match(
      /--(?:glass-label(?:-secondary|-tertiary|-quaternary)?|g3-text):[^;]+;/g
    ) ?? [];
    expect(labelDeclarations.length).toBeGreaterThan(0);
    expect(labelDeclarations.every((value) => !value.includes('glass-intensity'))).toBe(true);
  });

  it('calcule le ratio warning et exige un focus opaque sur les surfaces light/dark', () => {
    const lightBlock = canonicalLightBlock();
    const darkBlock = canonicalDarkBlock();
    const lightG1 = composite([255, 255, 255], alphaAt(lightBlock, '--g1-bg', 0.2), [0, 0, 0]);
    const lightG2 = composite([245, 248, 246], alphaAt(lightBlock, '--g2-bg', 0.2), [0, 0, 0]);
    const darkG1 = composite([14, 18, 16], alphaAt(darkBlock, '--g1-bg', 0.2), [255, 255, 255]);
    const darkG2 = composite([22, 26, 24], alphaAt(darkBlock, '--g2-bg', 0.2), [255, 255, 255]);
    const warningDark = tokenRgb(firstRootBlock(), '--lkv-warning-dark');
    const lightFocus = tokenRgb(lightBlock, '--glass-focus-outline');
    const darkFocus = tokenRgb(darkBlock, '--glass-focus-outline');
    expect(contrast(warningDark, lightG2)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightFocus, lightG1)).toBeGreaterThanOrEqual(3);
    expect(contrast(lightFocus, lightG2)).toBeGreaterThanOrEqual(3);
    expect(contrast(lightFocus, composite([255, 255, 255], 1, [0, 0, 0]))).toBeGreaterThanOrEqual(3);
    expect(contrast(darkFocus, darkG1)).toBeGreaterThanOrEqual(3);
    expect(contrast(darkFocus, darkG2)).toBeGreaterThanOrEqual(3);
    expect(contrast(darkFocus, composite([14, 18, 16], 1, [255, 255, 255]))).toBeGreaterThanOrEqual(3);
    expect(liquidGlass).toContain('color: var(--lkv-warning-dark)');
    expect(tabs).toContain('focus-visible:ring-[color:var(--glass-focus-outline)]');
  });

  it('rend les backdrop-blur opaques et thème-adaptés sous média', async () => {
    const mediaStart = tokens.indexOf(
      '@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {'
    );
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    const mediaEnd = tokens.indexOf('\n.glass {', mediaStart);
    expect(mediaEnd).toBeGreaterThan(mediaStart);
    const media = tokens.slice(mediaStart, mediaEnd);

    for (const size of ['sm', 'md', 'lg', 'xl', '2xl']) {
      expect(media).toContain(`[class~='backdrop-blur-${size}']`);
    }
    expect(media).toContain("[class*='backdrop-blur-']");
    expect(media).toContain('background: var(--glass-solid) !important;');
    expect(media).toContain('background: var(--g1-reduced-bg) !important;');
    expect(media).toContain('background: var(--g2-reduced-bg) !important;');
    expect(media).toMatch(
      /\[class\*=['"]backdrop-blur-['"][\s\S]*backdrop-filter:\s*none\s*!important;/
    );
    expect(media.indexOf('background: var(--glass-solid)')).toBeLessThan(
      media.indexOf('background: var(--g1-reduced-bg)')
    );
    expect(media.indexOf('background: var(--glass-solid)')).toBeLessThan(
      media.indexOf('background: var(--g2-reduced-bg)')
    );
    expect((tokens.match(/--card-tint-solid:\s*#[0-9a-f]{6};/gi) ?? [])).toEqual([
      '--card-tint-solid: #FFFFFF;',
      '--card-tint-solid: #1B2D24;',
    ]);
    expect((tokens.match(/--glass-solid:\s*var\(--card-tint-solid\);/g) ?? [])).toHaveLength(2);

    const generated = await compileUtilities(
      '<button class="bg-white/40 backdrop-blur-md"></button>'
    );
    expect(generated).toContain('.backdrop-blur-md');
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

  it('Tabs utilise les bons tokens, le focus opaque et une cible 44x44', () => {
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
    expect(scrollable.match(/min-h-\[var\(--lkv-touch-min\)\]/g) ?? []).toHaveLength(2);
    expect(scrollable.match(/min-w-\[var\(--lkv-touch-min\)\]/g) ?? []).toHaveLength(2);
    expect(segmented).toContain('bg-[var(--g1-bg)]');
    expect(segmented).toContain('border-[color:var(--glass-border-color)]');
    expect(segmented.match(/min-h-\[var\(--lkv-touch-min\)\]/g) ?? []).toHaveLength(2);
    expect(segmented.match(/min-w-\[var\(--lkv-touch-min\)\]/g) ?? []).toHaveLength(2);
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
    expect(liquidGlass).not.toContain('Contenu blanc garanti');
    expect(liquidGlass).not.toContain('Exemption : les badges');
    expect(liquidGlass).not.toContain('Filled actions keep their semantic contrast');
  });

  it('compile les utilitaires info avec alpha depuis le canal RGB sémantique', async () => {
    const generated = await compileUtilities(
      '<div class="bg-info/5 bg-info/10 bg-info/50 border-info/20 border-info/50 text-info"></div>'
    );
    expect(generated).toContain('rgb(var(--lkv-info-rgb) / 0.05)');
    expect(generated).toContain('rgb(var(--lkv-info-rgb) / 0.1)');
    expect(generated).toContain('rgb(var(--lkv-info-rgb) / 0.5)');
    expect(generated).toContain('rgb(var(--lkv-info-rgb) / 0.2)');
    expect(generated).toContain('rgb(var(--lkv-info-rgb) / var(--tw-text-opacity))');
    expect(tailwind).toContain("DEFAULT: 'rgb(var(--lkv-info-rgb) / <alpha-value>)'");
    expect(tokens).toContain('--lkv-info-rgb: 75, 107, 124;');
    expect(tokens).toContain('--lkv-info-rgb: 159, 196, 212;');
    expect(tailwind).not.toMatch(/\binfo:\s*['"]#4B6B7C['"]/);
  });
});
