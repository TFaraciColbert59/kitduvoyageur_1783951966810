import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--lkv-primary)',
        action: { DEFAULT: 'var(--lkv-action)', soft: 'var(--lkv-action-soft)' },
        secondary: 'var(--lkv-secondary)',
        surface: { DEFAULT: 'var(--lkv-surface)', card: 'var(--lkv-surface-card)', muted: 'var(--lkv-surface-muted)' },
        ink: { DEFAULT: 'var(--lkv-text-primary)', secondary: 'var(--lkv-text-secondary)' },
        line: { DEFAULT: 'var(--lkv-border)', subtle: 'var(--lkv-border-subtle)' },
        warn: { DEFAULT: 'var(--lkv-warning)', bg: 'var(--lkv-warning-bg)', dark: 'var(--lkv-warning-dark)' },
        danger: { DEFAULT: 'var(--lkv-danger)', bg: 'var(--lkv-danger-bg)', dark: 'var(--lkv-danger-dark)' },
        info: { DEFAULT: 'var(--lkv-info)', bg: 'var(--lkv-info-bg)' },
        success: { DEFAULT: 'var(--lkv-success)', bg: 'var(--lkv-success-bg)' }
      },
      borderRadius: { sm: '14px', md: '18px', lg: '24px', control: '18px' },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'SF Pro Text', 'system-ui', 'sans-serif'],
        brand: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        glass: 'inset 0 1px 0 rgba(255,255,255,.9), 0 8px 24px rgba(11,31,23,.06)',
        rail: '0 12px 32px rgba(11,31,23,.10)'
      }
    }
  },
  plugins: []
};
export default config;
