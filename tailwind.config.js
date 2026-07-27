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
          hover: 'var(--primary-hover)',
          subtle: 'var(--primary-subtle)',
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
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
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
        // Forest green — primary brand palette
        forest: {
          950: '#0D1410',
          900: '#131A16',
          800: '#1A1F1C',
          700: '#243028',
          600: '#2D5A3D',
          500: '#3D7A52',
          400: '#4A7C5B',
          300: '#6B9B7A',
          200: '#9BBBA8',
          100: '#C8D9CE',
          50: '#EBF2EC',
        },
        // Sand — warm neutral surface
        sand: {
          900: '#3D3828',
          800: '#5C5540',
          700: '#7A7258',
          600: '#9A9070',
          500: '#B5AA88',
          400: '#C8C3A0',
          300: '#D4CFBF',
          200: '#E0DDD0',
          100: '#EDEAE0',
          50: '#F5F3EE',
        },
        // Sky blue — secondary accent (maps, water)
        sky: {
          600: '#2A5A6E',
          500: '#3E6B7A',
          400: '#5A8A9A',
          300: '#7AAAB8',
          200: '#A8C8D4',
          100: '#D4E8EE',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
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
        xs:  '0 1px 2px rgba(26,31,28,0.05)',
        sm:  '0 2px 8px rgba(26,31,28,0.06), 0 1px 2px rgba(26,31,28,0.04)',
        md:  '0 4px 16px rgba(26,31,28,0.08), 0 2px 4px rgba(26,31,28,0.05)',
        lg:  '0 8px 32px rgba(26,31,28,0.12), 0 4px 8px rgba(26,31,28,0.06)',
        xl:  '0 16px 48px rgba(26,31,28,0.14), 0 8px 16px rgba(26,31,28,0.08)',
        '2xl': '0 32px 80px rgba(26,31,28,0.18), 0 16px 32px rgba(26,31,28,0.10)',
        'green': '0 8px 24px rgba(45,90,61,0.28)',
        'green-lg': '0 16px 48px rgba(45,90,61,0.35)',
      },
      transitionTimingFunction: {
        'spring-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring-snappy': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      animation: {
        'slide-up':   'slideUp 500ms cubic-bezier(0.16,1,0.3,1) both',
        'slide-down': 'slideDown 300ms cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':    'fadeIn 400ms ease both',
        'scale-in':   'scaleIn 300ms cubic-bezier(0.34,1.56,0.64,1) both',
        'spring-in':  'springIn 600ms cubic-bezier(0.34,1.56,0.64,1) both',
        'float':      'float 3s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};