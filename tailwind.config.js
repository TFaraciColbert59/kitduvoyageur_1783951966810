/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: { DEFAULT: '#F5F3EE' },
        foreground: { DEFAULT: '#0E1512' },
        primary: {
          DEFAULT: '#1C2620',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F5F3EE',
          foreground: '#1C2620',
        },
        accent: {
          DEFAULT: '#2D5A3D',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#EDEAE0',
          foreground: '#4A6355',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0E1512',
        },
        border: { DEFAULT: '#E0DDD0' },
        input: { DEFAULT: '#E0DDD0' },
        ring: { DEFAULT: '#1C2620' },
        // Forest palette
        forest: {
          950: '#0A0F0D',
          900: '#0E1512',
          800: '#161E1A',
          700: '#1C2620',
          600: '#243028',
          500: '#33463C',
          400: '#4A6355',
          300: '#6B8A7A',
          200: '#9AAD9E',
          100: '#C8D4C8',
          50: '#EBF0EB',
        },
        // Sage palette
        sage: {
          900: '#2A3B30',
          700: '#3D5A47',
          500: '#5C7A65',
          300: '#8FAF97',
          100: '#C4D9C9',
          50: '#E8F2EA',
        },
        // Sand / Sable palette
        sand: {
          900: '#3D3828',
          700: '#6B6448',
          500: '#B5AA88',
          300: '#D4CFBF',
          200: '#E0DDD0',
          100: '#EDEAE0',
          50: '#F5F3EE',
        },
        // Legacy aliases
        'dark-bg': { DEFAULT: '#0E1512' },
        'dark-surface': { DEFAULT: '#161E1A' },
        ember: {
          600: '#B83A10',
          500: '#E4501C',
          400: '#F06A38',
          300: '#F88A62',
          200: '#FBBB9E',
          100: '#FDE8DC',
        },
      },
      borderRadius: {
        DEFAULT: '2px',
        xs: '2px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '6px',
        '2xl': '8px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['"General Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"General Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
        fraunces: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(14,21,18,0.06)',
        'sm': '0 2px 8px rgba(14,21,18,0.08)',
        'md': '0 4px 16px rgba(14,21,18,0.10)',
        'lg': '0 8px 32px rgba(14,21,18,0.12)',
        'xl': '0 16px 48px rgba(14,21,18,0.16)',
        'card': '0 2px 12px rgba(14,21,18,0.08)',
        'card-hover': '0 8px 32px rgba(14,21,18,0.14)',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease both',
        'slide-up': 'slideUp 400ms cubic-bezier(0.16,1,0.3,1) both',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};