// src/design/tokens.ts — Miroir typé dérivé de tokens.css (Chantiers U, X & Y)
// Source unique canonique des valeurs : src/styles/tokens.css (Zéro hexadécimal ici)

export const colors = {
  primary: 'var(--lkv-primary)',
  primaryHover: 'var(--lkv-primary-hover)',
  primarySoft: 'var(--lkv-primary-soft)',
  primarySubtle: 'var(--lkv-primary-subtle)',
  action: 'var(--lkv-action)',
  actionHover: 'var(--lkv-action-hover)',
  actionSoft: 'var(--lkv-action-soft)',
  onAction: 'var(--lkv-on-action)',
  surface: 'var(--lkv-surface)',
  surfacePaper: 'var(--lkv-surface-paper)',
  background: 'var(--lkv-surface)',
  card: 'var(--lkv-surface-card)',
  elevated: 'var(--lkv-surface-elevated)',
  mutedSurface: 'var(--lkv-surface-muted)',
  border: 'var(--lkv-border)',
  borderSubtle: 'var(--lkv-border-subtle)',
  borderStrong: 'var(--lkv-border-strong)',
  borderGlass: 'rgba(255, 255, 255, 0.60)',
  accent: 'var(--lkv-secondary)',
  accentHover: 'var(--lkv-secondary-hover)',
  accentSubtle: 'var(--sage-300)',
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
  textPrimary: 'var(--lkv-text-primary)',
  textSecondary: 'var(--lkv-text-secondary)',
  textMuted: 'var(--lkv-text-muted)',
  textSubtle: 'var(--lkv-text-subtle)',
  textInverted: 'var(--lkv-text-inverted)',
  muted: 'var(--lkv-text-muted)',
  textMain: 'var(--lkv-text-primary)',
  white: 'var(--lkv-text-inverted)',
  black: 'black',
} as const;

export const typography = {
  fontFamily: {
    heading: 'var(--font-display), system-ui, sans-serif',
    body: 'var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    brand: "var(--font-brand), 'Manrope', sans-serif",
    serif: 'var(--font-serif), Instrument Serif, serif',
    mono: 'var(--font-mono), IBM Plex Mono, monospace',
  },
  /* Phase 2 — échelle Dynamic Type iOS (SF Pro). */
  dynamicType: {
    caption2: 'var(--lkv-text-caption-2)',
    caption: 'var(--lkv-text-caption)',
    footnote: 'var(--lkv-text-footnote)',
    subheadline: 'var(--lkv-text-subheadline)',
    callout: 'var(--lkv-text-callout)',
    body: 'var(--lkv-text-body)',
    headline: 'var(--lkv-text-headline)',
    title3: 'var(--lkv-text-title-sm)',
    title1: 'var(--lkv-text-title-lg)',
    largeTitle: 'var(--lkv-text-title-xl)',
  },
  lineHeight: {
    body: 'var(--lkv-line-body)',
    title: 'var(--lkv-line-title)',
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
    regular: 'var(--lkv-weight-regular)',
    medium: 'var(--lkv-weight-medium)',
    semibold: 'var(--lkv-weight-semibold)',
    bold: 'var(--lkv-weight-bold)',
    extrabold: '800',
  },
  leading: {
    tight: 'var(--leading-tight)',
    snug: 'var(--leading-snug)',
    normal: 'var(--leading-normal)',
    relaxed: 'var(--leading-relaxed)',
  },
  tracking: {
    tight: 'var(--tracking-tight)',
    normal: 'var(--tracking-normal)',
    wide: 'var(--tracking-wide)',
    caps: 'var(--tracking-caps)',
    title: 'var(--lkv-tracking-title)',
    body: 'var(--lkv-tracking-body)',
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

export const controlSizes = {
  xs: 'var(--control-height-xs)',
  sm: 'var(--control-height-sm)',
  md: 'var(--control-height-md)',
  lg: 'var(--control-height-lg)',
  xl: 'var(--control-height-xl)',
} as const;

export const iconSizes = {
  xs: 'var(--icon-xs)',
  sm: 'var(--icon-sm)',
  md: 'var(--icon-md)',
  lg: 'var(--icon-lg)',
  xl: 'var(--icon-xl)',
  '2xl': 'var(--icon-2xl)',
} as const;

export const opacity = {
  0: 'var(--opacity-0)',
  5: 'var(--opacity-5)',
  10: 'var(--opacity-10)',
  20: 'var(--opacity-20)',
  30: 'var(--opacity-30)',
  40: 'var(--opacity-40)',
  50: 'var(--opacity-50)',
  60: 'var(--opacity-60)',
  70: 'var(--opacity-70)',
  80: 'var(--opacity-80)',
  90: 'var(--opacity-90)',
  95: 'var(--opacity-95)',
  100: 'var(--opacity-100)',
  disabled: 'var(--opacity-disabled)',
  muted: 'var(--opacity-muted)',
  subtle: 'var(--opacity-subtle)',
  scrim: 'var(--opacity-scrim)',
} as const;

export const zIndex = {
  base: 'var(--z-base)',
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  fab: 'var(--z-fab)',
  drawer: 'var(--z-drawer)',
  sheet: 'var(--z-sheet)',
  modal: 'var(--z-modal)',
  command: 'var(--z-command)',
  popover: 'var(--z-popover)',
  toast: 'var(--z-toast)',
  tooltip: 'var(--z-tooltip)',
  emergency: 'var(--z-emergency)',
} as const;

export const safeArea = {
  top: 'var(--safe-top)',
  right: 'var(--safe-right)',
  bottom: 'var(--safe-bottom)',
  left: 'var(--safe-left)',
} as const;

/* Miroir des breakpoints Tailwind. En CSS, les media queries ne peuvent pas
 * consommer var() : les valeurs brutes sont conservées ici pour le JS
 * (matchMedia) et documentées dans tokens.css (--bp-*). */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const blur = {
  none: 'var(--blur-none)',
  sm: 'var(--blur-sm)',
  md: 'var(--blur-md)',
  lg: 'var(--blur-lg)',
  xl: 'var(--blur-xl)',
  '2xl': 'var(--blur-2xl)',
} as const;

export const borders = {
  hairline: 'var(--border-width-hairline)',
  thin: 'var(--border-width-thin)',
  medium: 'var(--border-width-medium)',
  thick: 'var(--border-width-thick)',
} as const;

export const motion = {
  duration: {
    instant: 'var(--dur-instant)',
    xfast: 'var(--dur-xfast)',
    fast: 'var(--dur-fast)',
    med: 'var(--dur-med)',
    slow: 'var(--dur-slow)',
    xslow: 'var(--dur-xslow)',
    press: 'var(--motion-press-duration)',
    control: 'var(--motion-control-duration)',
    sheet: 'var(--motion-sheet-duration)',
    page: 'var(--motion-page-duration)',
  },
  easing: {
    glass: 'var(--ease-glass)',
    spring: 'var(--ease-spring)',
    smooth: 'var(--ease-smooth)',
    out: 'var(--ease-out)',
    emphasis: 'var(--ease-emphasis)',
    standard: 'var(--motion-ease-standard)',
    decelerate: 'var(--motion-ease-decelerate)',
    accelerate: 'var(--motion-ease-accelerate)',
  },
  pressScale: 'var(--motion-press-scale)',
} as const;

export const materials = {
  bar: {
    background: 'var(--material-bar-bg)',
    border: 'var(--material-bar-border)',
    blur: 'var(--material-bar-blur)',
    saturate: 'var(--material-bar-saturate)',
  },
  sheet: {
    background: 'var(--material-sheet-bg)',
  },
  edgeEffect: {
    height: 'var(--edge-effect-height)',
  },
} as const;

export const radius = {
  xs: 'var(--lkv-radius-xs)',
  sm: 'var(--lkv-radius-sm)',
  md: 'var(--lkv-radius-md)',
  lg: 'var(--lkv-radius-lg)',
  xl: 'var(--lkv-radius-xl)',
  '2xl': 'var(--lkv-radius-2xl)',
  card: 'var(--lkv-radius-card)',
  sheet: 'var(--lkv-radius-sheet)',
  control: 'var(--lkv-radius-control)',
  concentric: 'var(--lkv-radius-concentric)',
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
  50: 'var(--stone-50)',
  100: 'var(--stone-100)',
  200: 'var(--stone-200)',
  300: 'var(--stone-300)',
  400: 'var(--stone-400)',
  500: 'var(--stone-500)',
  600: 'var(--stone-600)',
  700: 'var(--stone-700)',
  800: 'var(--stone-800)',
  900: 'var(--stone-900)',
  950: 'var(--stone-950)',
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
  xs: 'var(--elevation-1)',
  sm: 'var(--elevation-1)',
  md: 'var(--elevation-2)',
  lg: 'var(--elevation-3)',
  xl: 'var(--elevation-4)',
  '2xl': 'var(--elevation-5)',
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
  controlSizes,
  iconSizes,
  opacity,
  zIndex,
  safeArea,
  breakpoints,
  blur,
  borders,
  motion,
  materials,
};

export default theme;
