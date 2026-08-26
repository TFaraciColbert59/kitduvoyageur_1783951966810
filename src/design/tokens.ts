// src/design/tokens.ts
export const colors = {
  // Primary brand color – dark forest green used in headings, buttons, accents
  primary: '#132219',
  // Light background for cards, forms, input fields
  surface: '#FAF8F5',
  // General page background
  background: '#F5F3ED',
  // Border / subtle separator colour
  border: '#E8E4D8',
  // Accent colour – used for success, highlights, secondary actions
  accent: '#82C39B',
  // Error colour (red)
  error: '#E53E3E',
  // Warning / info colour (amber)
  warning: '#DD6B20',
  // Muted text / placeholders
  muted: '#A0AEC0',
  // White and black shortcuts
  white: '#ffffff',
  black: '#000000',
} as const;

export const typography = {
  // Font families – keep the existing choices from the project
  fontFamily: {
    heading: 'DM Sans, system-ui, sans-serif',
    body: 'Manrope, system-ui, sans-serif',
    mono: 'IBM Plex Mono, monospace',
  },
  // Scale – values are in rem (tailwind default base 1rem = 16px)
  size: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem', // 48px
    '6xl': '3.75rem', // 60px
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
} as const;

export const spacing = {
  0: '0rem',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
} as const;

export const radius = {
  sm: '0.25rem', // 4px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  full: '9999px',
} as const;

export const forest = {
  950: '#06120C', 900: '#17402C', 800: '#17402C',
  700: '#205238', 600: '#365233',
} as const;

export const sage = {
  500: '#5B7F55', 300: '#A6C1A0', 200: '#DDE9D6', 100: '#EAF1E5',
} as const;

export const stone = {
  50: '#F4F1EA', 100: '#E9E4D9', 200: '#DDD6C6',
} as const;

export const ink = {
  900: '#17402C', 700: '#365233', 500: '#5A7064',
  400: '#8B978F', 300: '#AEB7B1',
} as const;

export const paper = '#FBFAF6';

export const shadows = {
  xs: '0 1px 2px rgba(23,64,44,0.05), 0 1px 3px rgba(23,64,44,0.04)',
  sm: '0 2px 6px rgba(23,64,44,0.06), 0 4px 12px rgba(23,64,44,0.05)',
  md: '0 6px 16px rgba(23,64,44,0.08), 0 12px 32px rgba(23,64,44,0.06)',
  lg: '0 12px 24px rgba(11,31,23,0.10), 0 24px 56px rgba(11,31,23,0.10)',
} as const;

export const transition = {
  default: 'all 0.2s ease-in-out',
  fast: 'all 0.1s ease-in-out',
  slow: 'all 0.3s ease-in-out',
} as const;

// Export a combined theme object for convenience
export const theme = {
  colors, forest, sage, stone, ink, paper,
  typography,
  spacing,
  radius,
  shadows,
  transition,
};
