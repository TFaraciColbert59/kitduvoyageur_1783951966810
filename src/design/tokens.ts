// src/design/tokens.ts — Miroir typé dérivé de tokens.css (Chantier U)
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
  default: 'var(--dur-med) var(--ease-glass)',
  fast: 'var(--dur-fast) var(--ease-glass)',
  base: 'var(--dur-med) var(--ease-glass)',
  slow: 'var(--dur-slow) var(--ease-glass)',
} as const;
