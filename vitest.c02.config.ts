import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Configuration locale du lot C02, utilisée quand le `node_modules` partagé
 * est un lien hors workspace (le cache Vite par défaut n'est alors pas
 * inscriptible). Elle reprend strictement les alias et l'environnement du
 * `vitest.config.ts` racine, avec un cache dans le workspace.
 */
export default defineConfig({
  cacheDir: '.vitest-cache',
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    testTimeout: 30_000,
    env: {
      NVIDIA_API_KEY: '',
      OPENROUTER_API_KEY: '',
    },
    setupFiles: ['./tests/setup/no-network.ts', './tests/setup/jsdom-storage.ts'],
    include: [
      'src/features/heatmaps/**/*.test.ts',
      'src/components/heatmaps/**/*.test.ts',
      'src/components/heatmaps/**/*.test.tsx',
      'src/lib/heatmaps/**/*.test.ts',
      'src/app/api/heatmaps/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
