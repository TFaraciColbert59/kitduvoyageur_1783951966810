import fs from 'fs';

console.log('=== U1 : Réconciliation des 6 sources de design ===');

// 1. liquid-glass.css
let lg = fs.readFileSync('src/styles/liquid-glass.css', 'utf8');
const rootStart = lg.indexOf(':root {');
const rootEnd = lg.indexOf('/* Dark mode auto */');
if (rootStart === -1 || rootEnd === -1) throw new Error('liquid-glass root not found');

const newLgRoot = `:root {
  /* ---- Tokens sémantiques (dérivés de tokens.css) ---- */
  --label: var(--ink-900);
  --label-secondary: var(--ink-500);
  --label-tertiary: var(--ink-300);
  --label-quaternary: color-mix(in oklab, var(--ink-500) 40%, transparent);
  --separator: color-mix(in oklab, var(--stone-800) 12%, transparent);
  --separator-opaque: var(--stone-200);
  --fill-primary: color-mix(in oklab, var(--stone-800) 15%, transparent);
  --fill-secondary: color-mix(in oklab, var(--stone-800) 10%, transparent);
  --fill-tertiary: color-mix(in oklab, var(--stone-800) 6%, transparent);
  --fill-quaternary: color-mix(in oklab, var(--stone-800) 4%, transparent);
  --bg-primary: var(--stone-50);
  --bg-secondary: var(--stone-100);
  --bg-tertiary: var(--stone-200);

  /* ---- Liquid Glass (iOS 26 Spec - True Crystal Glass with Soft White Veil) ---- */
  --glass-bg-light: rgba(255, 255, 255, 0.45);
  --glass-bg-medium: rgba(255, 255, 255, 0.55);
  --glass-bg-strong: rgba(255, 255, 255, 0.75);
  --glass-bg-dark: color-mix(in oklab, var(--ink-900) 15%, transparent);
  --glass-border: rgba(255, 255, 255, 0.65);
  --glass-highlight-top: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.95) 25%, rgba(255, 255, 255, 0.95) 75%, transparent 100%);
  --glass-highlight-radial: radial-gradient(120% 60% at 20% 0%, rgba(255, 255, 255, 0.40), transparent 60%);
  --glass-tint-sage: rgba(255, 255, 255, 0.08);
  --glass-blur-sm: 6px;
  --glass-blur-md: 10px;
  --glass-blur-lg: 14px;
  --glass-sat: 160%;

  /* Specular / sheen / depth — Liquid Glass (iOS 26) */
  --glass-edge-light: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.90) 0%,
    rgba(255, 255, 255, 0.60) 32%,
    rgba(255, 255, 255, 0.25) 65%,
    rgba(11, 31, 23, 0.04) 100%
  );
  --glass-sheen: radial-gradient(130% 85% at 24% 0%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.15) 100%);
  --glass-depth-inset: inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 2px 0 rgba(11, 31, 23, 0.03);

  /* ---- Elevation (5 niveaux Apple iOS, ink-based) ---- */
  --elevation-1: 0 1px 3px rgba(20, 25, 22, 0.04), 0 1px 2px rgba(20, 25, 22, 0.02);
  --elevation-2: 0 4px 12px rgba(20, 25, 22, 0.06), 0 1px 3px rgba(20, 25, 22, 0.03);
  --elevation-3: 0 8px 24px rgba(20, 25, 22, 0.08), 0 2px 6px rgba(20, 25, 22, 0.04);
  --elevation-4: 0 16px 36px rgba(20, 25, 22, 0.10), 0 4px 12px rgba(20, 25, 22, 0.05);
  --elevation-5: 0 24px 56px rgba(20, 25, 22, 0.14), 0 8px 20px rgba(20, 25, 22, 0.06);

  /* ---- Radius (alias vers tokens.css) ---- */
  --r-xs: var(--lkv-radius-xs);
  --r-sm: var(--lkv-radius-sm);
  --r-md: var(--lkv-radius-md);
  --r-lg: var(--lkv-radius-lg);
  --r-xl: var(--lkv-radius-card);
  --r-2xl: var(--lkv-radius-2xl);
  --r-full: var(--lkv-radius-full);

  /* ---- Grille de page ---- */
  --page-max-w: 1280px;
  --grid-gap: var(--space-5);

  /* ---- Motion complémentaires ---- */
  --ease-emphasis: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-linear: linear;

  /* ---- Z-index ---- */
  --z-base: 0;
  --z-sticky: 20;
  --z-drawer: 40;
  --z-sheet: 50;
  --z-command: 60;
  --z-toast: 70;
}
`;
lg = lg.slice(0, rootStart) + newLgRoot + lg.slice(rootEnd);

// Replace remaining hex colors in liquid-glass.css
lg = lg.replace(/#E4501C/g, 'var(--lkv-warning)');
lg = lg.replace(/#F4F1EB/g, 'var(--stone-50)');
lg = lg.replace(/#14140F/g, 'var(--ink-900)');
lg = lg.replace(/#1E1E17/g, 'var(--ink-700)');
lg = lg.replace(/#2B2A24/g, 'var(--ink-700)');
lg = lg.replace(/#17402C/g, 'var(--lkv-primary)');
lg = lg.replace(/#365233/g, 'var(--lkv-primary-soft)');
lg = lg.replace(/#5A7064/g, 'var(--lkv-text-muted)');
lg = lg.replace(/#FAF8F5/g, 'var(--stone-50)');
lg = lg.replace(/#F1EDE6/g, 'var(--stone-100)');
lg = lg.replace(/#E4DED3/g, 'var(--stone-200)');
lg = lg.replace(/#ffffff/gi, 'var(--lkv-text-inverted)');
lg = lg.replace(/#000000/g, 'black');
lg = lg.replace(/#000\b/g, 'black');
lg = lg.replace(/#E11D48/g, 'var(--lkv-danger)');
lg = lg.replace(/#BE123C/g, 'var(--lkv-danger)');
lg = lg.replace(/#235039/g, 'var(--lkv-primary-hover)');
lg = lg.replace(/#255C40/g, 'var(--lkv-primary-hover)');
lg = lg.replace(/#2F7050/g, 'var(--lkv-forest-500)');
lg = lg.replace(/#23503B/g, 'var(--lkv-primary-hover)');
fs.writeFileSync('src/styles/liquid-glass.css', lg, 'utf8');
console.log('liquid-glass.css réconcilié.');

// 2. tailwind.css
let tw = fs.readFileSync('src/styles/tailwind.css', 'utf8');
// Clean up root variables and eliminate duplicates
const twRootStart = tw.indexOf(':root {');
const twRootEnd = tw.indexOf('/* Mobile Navigation Heights & Clearance */');
if (twRootStart !== -1 && twRootEnd !== -1) {
  const newTwRoot = `:root {
  --background: var(--sand-100);
  --foreground: var(--lkv-forest-800);
  --primary: var(--lkv-primary);
  --primary-foreground: var(--lkv-text-inverted);
  --primary-hover: var(--lkv-primary-soft);
  --primary-subtle: var(--lkv-primary-subtle);
  --secondary: var(--lkv-forest-700);
  --secondary-foreground: var(--sand-100);
  --accent: var(--lkv-secondary);
  --accent-foreground: var(--lkv-text-inverted);
  --muted: var(--sand-200);
  --muted-foreground: var(--lkv-text-muted);
  --card: var(--lkv-surface-card);
  --card-foreground: var(--lkv-forest-800);
  --surface: var(--sand-100);
  --surface-elevated: var(--lkv-surface-card);
  --border: var(--sand-200);
  --border-subtle: var(--sand-100);
  --input: var(--sand-200);
  --ring: var(--lkv-primary);
  --radius: var(--lkv-radius-sm);
  --info-foreground: var(--lkv-text-inverted);
  --dark-bg: var(--lkv-forest-800);
  --dark-surface: var(--lkv-forest-700);

  /* Mon Matériel — liquid glass : palette verte LKDV (Forest / Stone) */
  --mm-forest: var(--lkv-primary);
  --mm-forest-soft: var(--lkv-primary-soft);
  --mm-ink: var(--sage-300);
  --mm-paper: var(--lkv-surface);

  /* PWA safe-area insets */
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
  --safe-left: env(safe-area-inset-left);
  --safe-right: env(safe-area-inset-right);

`;
  tw = tw.slice(0, twRootStart) + newTwRoot + tw.slice(twRootEnd);
}

// Remove duplicated blocks in tailwind.css:
// 1) between "--radius-xs: 4px;" and "/* Sand / warm neutrals */"
const radBlockStart = tw.indexOf('--radius-xs: 4px;');
const sandBlockStart = tw.indexOf('/* Sand / warm neutrals */');
if (radBlockStart !== -1 && sandBlockStart !== -1) {
  tw = tw.slice(0, radBlockStart) + tw.slice(sandBlockStart);
}

// 2) Remove sand, sky, and semantic duplicate blocks up to [data-theme="dark"]
const sandHeader = tw.indexOf('/* Sand / warm neutrals */');
const darkThemeStart = tw.indexOf('[data-theme="dark"]');
if (sandHeader !== -1 && darkThemeStart !== -1) {
  tw = tw.slice(0, sandHeader) + tw.slice(darkThemeStart);
}

// 3) Remove the legacy override block in tailwind.css (Mon Matériel Cockpit Vertical)
const legComment = tw.indexOf('DESIGN SYSTEM LKDV — Mon Matériel Cockpit Vertical');
if (legComment !== -1) {
  const blockStart = tw.lastIndexOf('/*', legComment);
  const blockEnd = tw.indexOf('.font-serif-lkv', legComment);
  if (blockStart !== -1 && blockEnd !== -1) {
    tw = tw.slice(0, blockStart) + tw.slice(blockEnd);
  }
}

// 4) Remove duplicate dark status definitions in tailwind.css
tw = tw.replace(/\s*--success:\s*var\(--lkv-forest-400\);/g, '');
tw = tw.replace(/\s*--danger:\s*var\(--lkv-danger\);/g, '');

// Replace all remaining hex in tailwind.css with tokens
tw = tw.replace(/#FBFAF6/gi, 'var(--lkv-surface)');
tw = tw.replace(/#1A1F1C/gi, 'var(--lkv-forest-800)');
tw = tw.replace(/#F5F3EE/gi, 'var(--sand-50)');
tw = tw.replace(/#4A7C5B/gi, 'var(--lkv-forest-400)');
tw = tw.replace(/#5A8A6A/gi, 'var(--lkv-forest-400)');
tw = tw.replace(/#2D3830/gi, 'var(--lkv-forest-700)');
tw = tw.replace(/#EDEAE0/gi, 'var(--sand-100)');
tw = tw.replace(/#6B9B7A/gi, 'var(--lkv-forest-300)');
tw = tw.replace(/#243028/gi, 'var(--lkv-forest-700)');
tw = tw.replace(/#1E2521/gi, 'var(--lkv-forest-800)');
tw = tw.replace(/#9BBBA8/gi, 'var(--lkv-forest-200)');
tw = tw.replace(/#B8932A/gi, 'var(--lkv-warning)');
tw = tw.replace(/#C53030/gi, 'var(--lkv-danger)');

fs.writeFileSync('src/styles/tailwind.css', tw, 'utf8');
console.log('tailwind.css réconcilié.');

// 3. country.css
let country = fs.readFileSync('src/app/pays/styles/country.css', 'utf8');
country = country.replace(/#17402C/gi, 'var(--lkv-primary)');
country = country.replace(/#5A7064/gi, 'var(--lkv-text-muted)');
country = country.replace(/#365233/gi, 'var(--lkv-primary-soft)');
country = country.replace(/#8C8779/gi, 'var(--lkv-text-subtle)');
country = country.replace(/#5B7F55/gi, 'var(--lkv-secondary)');
country = country.replace(/#C89A3B/gi, 'var(--lkv-warning)');
country = country.replace(/#EAE7DD/gi, 'var(--stone-200)');
country = country.replace(/#A6C1A0/gi, 'var(--sage-300)');
country = country.replace(/#8C6418/gi, 'var(--lkv-warning-dark)');
country = country.replace(/#8A241B/gi, 'var(--lkv-danger-dark)');
country = country.replace(/#FBFAF6/gi, 'var(--lkv-surface)');
country = country.replace(/#E3C88A/gi, 'var(--lkv-warning-subtle)');
country = country.replace(/#FFF\b/gi, 'var(--lkv-text-inverted)');
country = country.replace(/#FFFFFF\b/gi, 'var(--lkv-text-inverted)');
fs.writeFileSync('src/app/pays/styles/country.css', country, 'utf8');
console.log('country.css réconcilié.');

// 4. earth.css
let earth = fs.readFileSync('src/app/pays/styles/earth.css', 'utf8');
earth = earth.replace(/#17402C/gi, 'var(--lkv-primary)');
earth = earth.replace(/#A6C1A0/gi, 'var(--sage-300)');
earth = earth.replace(/#365233/gi, 'var(--lkv-primary-soft)');
earth = earth.replace(/#5A7064/gi, 'var(--lkv-text-muted)');
earth = earth.replace(/#FBFAF6/gi, 'var(--lkv-surface)');
earth = earth.replace(/#FFF\b/gi, 'var(--lkv-text-inverted)');
earth = earth.replace(/#FFFFFF\b/gi, 'var(--lkv-text-inverted)');
earth = earth.replace(/#FFF\b/g, 'var(--lkv-text-inverted)');
earth = earth.replace(/#FFFFFF\b/g, 'var(--lkv-text-inverted)');
fs.writeFileSync('src/app/pays/styles/earth.css', earth, 'utf8');
console.log('earth.css réconcilié.');

// 5. tokens.ts (miroir typé dérivé)
const newTokensTs = `// src/design/tokens.ts — Miroir typé dérivé de tokens.css (Chantier U)
// Source unique canonique des valeurs : src/styles/tokens.css

export const colors = {
  primary: 'var(--lkv-primary)',
  primaryHover: 'var(--lkv-primary-hover)',
  primarySoft: 'var(--lkv-primary-soft)',
  surface: 'var(--stone-50)',
  surfacePaper: 'var(--lkv-surface)',
  background: 'var(--lkv-surface)',
  border: 'var(--stone-200)',
  borderGlass: 'rgba(255, 255, 255, 0.60)',
  accent: 'var(--lkv-secondary)',
  accentSubtle: 'var(--sage-300)',
  error: 'var(--lkv-danger)',
  errorBg: 'var(--lkv-danger-bg)',
  warning: 'var(--lkv-warning)',
  warningBg: 'var(--lkv-warning-bg)',
  info: 'var(--lkv-info)',
  infoBg: 'var(--lkv-info-bg)',
  success: 'var(--lkv-success)',
  successBg: 'var(--sage-50)',
  muted: 'var(--lkv-text-muted)',
  textMain: 'var(--ink-900)',
  textSecondary: 'var(--ink-500)',
  white: 'var(--lkv-text-inverted)',
  black: 'black',
} as const;

export const typography = {
  fontFamily: {
    heading: 'var(--font-display), Manrope, system-ui, sans-serif',
    body: 'var(--font-sans), DM Sans, system-ui, sans-serif',
    serif: 'var(--font-serif), Instrument Serif, serif',
    mono: 'var(--font-mono), IBM Plex Mono, monospace',
  },
  size: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export const spacing = {
  0: '0rem',
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  8: 'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
} as const;

export const radius = {
  xs: 'var(--lkv-radius-xs)',
  sm: 'var(--lkv-radius-sm)',
  md: 'var(--lkv-radius-md)',
  lg: 'var(--lkv-radius-lg)',
  xl: 'var(--lkv-radius-xl)',
  '2xl': 'var(--lkv-radius-2xl)',
  card: 'var(--lkv-radius-card)',
  full: 'var(--lkv-radius-full)',
} as const;

export const forest = {
  950: 'var(--lkv-forest-950)',
  900: 'var(--lkv-forest-900)',
  800: 'var(--lkv-forest-800)',
  700: 'var(--lkv-forest-700)',
  600: 'var(--lkv-forest-600)',
  500: 'var(--lkv-forest-500)',
} as const;

export const sage = {
  500: 'var(--sage-500)',
  400: 'var(--sage-400)',
  300: 'var(--sage-300)',
  200: 'var(--sage-200)',
  100: 'var(--sage-100)',
  50:  'var(--sage-50)',
} as const;

export const stone = {
  50: 'var(--stone-50)',
  100: 'var(--stone-100)',
  200: 'var(--stone-200)',
  300: 'var(--stone-300)',
  400: 'var(--stone-400)',
  500: 'var(--stone-500)',
  600: 'var(--stone-600)',
  700: 'var(--stone-700)',
  800: 'var(--stone-800)',
} as const;

export const ink = {
  900: 'var(--ink-900)',
  700: 'var(--ink-700)',
  500: 'var(--ink-500)',
  300: 'var(--ink-300)',
} as const;

export const paper = {
  DEFAULT: 'var(--lkv-surface)',
  cream: 'var(--lkv-surface-paper)',
} as const;

export const shadows = {
  glass: 'var(--elevation-1)',
  card: 'var(--elevation-2)',
  modal: 'var(--elevation-4)',
} as const;

export const transition = {
  fast: 'var(--dur-fast) var(--ease-glass)',
  base: 'var(--dur-med) var(--ease-glass)',
  slow: 'var(--dur-slow) var(--ease-glass)',
} as const;
`;
fs.writeFileSync('src/design/tokens.ts', newTokensTs, 'utf8');
console.log('tokens.ts réconcilié.');

