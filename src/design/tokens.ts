// src/design/tokens.ts — Miroir typé dérivé de src/styles/tokens.css
// AUTO-GÉNÉRÉ — NE PAS ÉCRIRE DE VALEURS EN DUR ICI (Source unique = tokens.css)

export const colors = {
  // Primary brand color – Forest Green canon LKDV
  primary: 'var(--lkv-primary)',
  primaryHover: 'var(--lkv-primary-hover)',
  primarySoft: 'var(--lkv-primary-soft)',
  primarySubtle: 'var(--lkv-primary-subtle)',

  // Surfaces et fonds
  surface: 'var(--lkv-surface)',
  surfacePaper: 'var(--lkv-surface-paper)',
  background: 'var(--lkv-surface)',
  card: 'var(--lkv-surface-card)',
  elevated: 'var(--lkv-surface-elevated)',
  mutedSurface: 'var(--lkv-surface-muted)',
  border: 'var(--lkv-border)',
  borderSubtle: 'var(--lkv-border-subtle)',
  borderStrong: 'var(--lkv-border-strong)',

  // Accent / Sage
  accent: 'var(--lkv-secondary)',
  accentHover: 'var(--lkv-secondary-hover)',
  accentSubtle: 'var(--lkv-secondary-subtle)',

  // Sémantiques canoniques
  error: 'var(--lkv-danger)',
  errorBg: 'var(--lkv-danger-bg)',
  danger: 'var(--lkv-danger)',
  dangerBg: 'var(--lkv-danger-bg)',
  warning: 'var(--lkv-warning)',
  warningBg: 'var(--lkv-warning-bg)',
  info: 'var(--lkv-info)',
  infoBg: 'var(--lkv-info-bg)',
  success: 'var(--lkv-success)',
  successBg: 'var(--lkv-success-bg)',

  // Typographie & Neutres
  textPrimary: 'var(--lkv-text-primary)',
  textSecondary: 'var(--lkv-text-secondary)',
  textMuted: 'var(--lkv-text-muted)',
  textSubtle: 'var(--lkv-text-subtle)',
  textInverted: 'var(--lkv-text-inverted)',
  muted: 'var(--lkv-text-muted)',
  textMain: 'var(--lkv-text-primary)',
  white: '#ffffff',
  black: '#000000',
} as const;

export const typography = {
  fontFamily: {
    heading: 'var(--font-display), Manrope, sans-serif',
    body: 'var(--font-sans), DM Sans, sans-serif',
    serif: 'var(--font-serif), Instrument Serif, serif',
    mono: 'var(--font-mono), IBM Plex Mono, monospace',
  },
  size: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    base: '1rem',    // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem',// 36px
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
  card: 'var(--lkv-radius-card)',
  '2xl': 'var(--lkv-radius-2xl)',
  full: 'var(--lkv-radius-full)',
} as const;

export const forest = {
  950: 'var(--lkv-forest-950)',
  900: 'var(--lkv-forest-900)',
  800: 'var(--lkv-forest-800)',
  700: 'var(--lkv-forest-700)',
  600: 'var(--lkv-forest-600)',
  500: 'var(--lkv-forest-500)',
  400: 'var(--lkv-forest-400)',
  300: 'var(--lkv-forest-300)',
  200: 'var(--lkv-forest-200)',
  100: 'var(--lkv-forest-100)',
  50:  'var(--lkv-forest-50)',
} as const;

export const sage = {
  900: 'var(--sage-900)',
  800: 'var(--sage-800)',
  700: 'var(--sage-700)',
  600: 'var(--sage-600)',
  500: 'var(--sage-500)',
  400: 'var(--sage-400)',
  300: 'var(--sage-300)',
  200: 'var(--sage-200)',
  100: 'var(--sage-100)',
  50:  'var(--sage-50)',
} as const;

export const stone = {
  950: 'var(--stone-950)',
  900: 'var(--stone-900)',
  800: 'var(--stone-800)',
  700: 'var(--stone-700)',
  600: 'var(--stone-600)',
  500: 'var(--stone-500)',
  400: 'var(--stone-400)',
  300: 'var(--stone-300)',
  200: 'var(--stone-200)',
  100: 'var(--stone-100)',
  50:  'var(--stone-50)',
} as const;

export const ink = {
  900: 'var(--ink-900)',
  700: 'var(--ink-700)',
  500: 'var(--ink-500)',
  300: 'var(--ink-300)',
} as const;

export const paper = 'var(--lkv-surface)';

export const shadows = {
  xs: 'var(--elevation-1)',
  sm: 'var(--elevation-1)',
  md: 'var(--elevation-2)',
  lg: 'var(--elevation-3)',
  xl: 'var(--elevation-4)',
  '2xl': 'var(--elevation-5)',
} as const;

export const transition = {
  default: 'transform var(--dur-xfast) var(--ease-smooth), background-color var(--dur-fast) ease, opacity var(--dur-fast) ease, box-shadow var(--dur-fast) ease',
  fast: 'all var(--dur-xfast) var(--ease-smooth)',
  slow: 'all var(--dur-med) var(--ease-smooth)',
} as const;

export const theme = {
  colors,
  forest,
  sage,
  stone,
  ink,
  paper,
  typography,
  spacing,
  radius,
  shadows,
  transition,
};

export default theme;
