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
        background: { DEFAULT: 'var(--background)' },
        foreground: { DEFAULT: 'var(--foreground)' },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: { DEFAULT: 'var(--border)' },
        input: { DEFAULT: 'var(--input)' },
        ring: { DEFAULT: 'var(--ring)' },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
        },
        'dark-bg': { DEFAULT: 'var(--dark-bg)' },
        'dark-surface': { DEFAULT: 'var(--dark-surface)' },
        // Premium palette
        forest: {
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
        ember: {
          600: '#B83A10',
          500: '#E4501C',
          400: '#F06A38',
          300: '#F88A62',
          200: '#FBBB9E',
          100: '#FDE8DC',
        },
        sand: {
          900: '#3D3828',
          500: '#B5AA88',
          300: '#D4CFBF',
          200: '#E0DDD0',
          100: '#EDEAE0',
          50: '#F5F3EE',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
        '2xl': '36px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['DM Sans', 'var(--font-sans)', 'sans-serif'],
        display: ['Manrope', 'var(--font-display)', 'sans-serif'],
        mono: ['IBM Plex Mono', 'var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'topo-pattern': "url('/assets/images/topo-pattern.svg')",
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(14,21,18,0.06)',
        'sm': '0 2px 8px rgba(14,21,18,0.08), 0 1px 2px rgba(14,21,18,0.04)',
        'md': '0 4px 16px rgba(14,21,18,0.10), 0 2px 4px rgba(14,21,18,0.06)',
        'lg': '0 8px 32px rgba(14,21,18,0.14), 0 4px 8px rgba(14,21,18,0.08)',
        'xl': '0 16px 48px rgba(14,21,18,0.18), 0 8px 16px rgba(14,21,18,0.10)',
        '2xl': '0 32px 80px rgba(14,21,18,0.24), 0 16px 32px rgba(14,21,18,0.12)',
        'ember': '0 8px 24px rgba(228,80,28,0.35)',
        'ember-lg': '0 16px 48px rgba(228,80,28,0.4)',
      },
      transitionTimingFunction: {
        'spring-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring-snappy': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      animation: {
        'slide-up': 'slideUp 400ms cubic-bezier(0.16,1,0.3,1) both',
        'slide-down': 'slideDown 300ms cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 300ms ease both',
        'scale-in': 'scaleIn 300ms cubic-bezier(0.34,1.56,0.64,1) both',
        'spring-in': 'springIn 500ms cubic-bezier(0.34,1.56,0.64,1) both',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};