import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'prefer-const': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'warn',
      'no-empty': 'warn',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
    },
  },
  {
    name: 'lkdv/shell-safe-area',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      /**
       * Avertir quand env(safe-area-inset-top) est utilisé directement dans du code TSX/TS.
       * Seuls AppShell.tsx et MobilePageShell.tsx sont autorisés (ils sont les sources canoniques).
       * Pour les overlays légitimes (cartes, drawers), annoter la ligne avec // lkdv-safe-area-ok
       */
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/env\\(safe-area-inset-top/]",
          message:
            '[LKDV Shell] Éviter env(safe-area-inset-top) directement. ' +
            'Utiliser AppShell (safeTop=true) ou la CSS var --safe-top. ' +
            'Si inévitable (overlay de carte), ajouter // lkdv-safe-area-ok sur la ligne.',
        },
        {
          selector: "Literal[value=/env\\(safe-area-inset-bottom/]",
          message:
            '[LKDV Shell] Éviter env(safe-area-inset-bottom) directement. ' +
            'Utiliser AppShell ou la CSS var --bottom-nav-height. ' +
            'Si inévitable, ajouter // lkdv-safe-area-ok sur la ligne.',
        },
      ],
      /**
       * Avertir sur les imports de MobilePageShell (préférer AppShell pour les nouvelles pages).
       */
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@/components/mobile-nav/MobilePageShell',
              message:
                '[LKDV Shell] Pour les nouvelles pages, utiliser AppShell (@/components/shell). ' +
                'MobilePageShell reste supporté pour les pages existantes.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'lkdv/shell-safe-area-canonical',
    files: [
      'src/components/shell/AppShell.tsx',
      'src/components/mobile-nav/MobilePageShell.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];

export default config;
