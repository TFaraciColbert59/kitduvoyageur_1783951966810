// src/design/tokens.ts — Design System LKDV (Source de vérité issue de /materiel)

export const colors = {
  // Primary brand color – Forest Green canon LKDV
  primary: '#17402C',
  primaryHover: '#205238',
  primarySoft: '#365233',
  // Surfaces et fonds
  surface: '#FAF8F5',
  surfacePaper: '#FBFAF6',
  background: '#FBFAF6',
  border: '#E8E4D8',
  borderGlass: 'rgba(255, 255, 255, 0.60)',
  // Accent / Sage
  accent: '#5B7F55',
  accentSubtle: '#A6C1A0',
  // Sémantiques canoniques
  error: '#A8443A',
  errorBg: '#F5DDD9',
  warning: '#C89A3B',
  warningBg: '#FBF1DC',
  info: '#4B6B7C',
  infoBg: '#DDE7EE',
  success: '#5B7F55',
  successBg: '#F2F6F1',
  // Typographie & Neutres
  muted: '#5A7064',
  textMain: '#14140F',
  textSecondary: '#5A574E',
  white: '#ffffff',
  black: '#000000',
} as const;

export const typography = {
  fontFamily: {
    heading: 'var(--font-display), Manrope, system-ui, sans-serif',
    body: 'var(--font-sans), DM Sans, system-ui, sans-serif',
    serif: 'var(--font-serif), Instrument Serif, serif',
    mono: 'var(--font-mono), IBM Plex Mono, monospace',
  },
  size: {
    xs: '0.75rem',  // 12px
    sm: '0.875rem', // 14px
    base: '1rem',   // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem',  // 20px
    '2xl': '1.5rem',// 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
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
  1: '0.25rem', // 4px
  2: '0.5rem',  // 8px
  3: '0.75rem', // 12px
  4: '1rem',    // 16px
  5: '1.25rem', // 20px
  6: '1.5rem',  // 24px
  8: '2rem',    // 32px
  10: '2.5rem', // 40px
  12: '3rem',   // 48px
  16: '4rem',   // 64px
} as const;

export const radius = {
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '1.75rem',// 28px
  full: '9999px',
} as const;

export const forest = {
  950: '#0B1F17',
  900: '#17402C',
  800: '#205238',
  700: '#2A6648',
  600: '#365233',
  500: '#5B7F55',
} as const;

export const sage = {
  500: '#5B7F55',
  400: '#82A47C',
  300: '#A6C1A0',
  200: '#C8DAC3',
  100: '#E1EBDE',
  50:  '#F2F6F1',
} as const;

export const stone = {
  50:  '#FAF8F5',
  100: '#F1EDE6',
  200: '#E4DED3',
  300: '#D2CABC',
} as const;

export const ink = {
  900: '#14140F',
  700: '#2B2A24',
  500: '#5A574E',
  300: '#8C8779',
} as const;

export const paper = '#FBFAF6';

export const shadows = {
  xs: '0 1px 2px rgba(23,64,44,0.05), 0 1px 3px rgba(23,64,44,0.04)',
  sm: '0 2px 6px rgba(23,64,44,0.06), 0 4px 12px rgba(23,64,44,0.05)',
  md: '0 8px 32px rgba(0,0,0,0.06), inset 0 1.5px 1px rgba(255,255,255,0.7)',
  lg: '0 12px 32px rgba(0,0,0,0.08), inset 0 1.5px 1px rgba(255,255,255,0.8)',
} as const;

export const transition = {
  default: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease, opacity 200ms ease, box-shadow 200ms ease',
  fast: 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)',
  slow: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const theme = {
  colors, forest, sage, stone, ink, paper,
  typography,
  spacing,
  radius,
  shadows,
  transition,
};

export default theme;
