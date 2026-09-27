import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    // Hermetique : les cles du .env.local du developpeur ne doivent JAMAIS
    // entrer dans le processus de test. Sans cela, la selection de provider
    // depend de la machine et la suite ne teste plus ce qu elle pretend tester.
    env: {
      NVIDIA_API_KEY: '',
      OPENROUTER_API_KEY: '',
    },
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    exclude: ['node_modules/**', 'tests/visual/**', 'tests/a11y/e2e/**', 'tests/ui/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 'server-only' lève une exception hors RSC — stub neutre en test.
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
