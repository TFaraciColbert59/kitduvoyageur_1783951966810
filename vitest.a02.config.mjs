/**
 * Harnais Vitest du lot A02.
 *
 * Le `node_modules` du worktree est un lien vers un autre worktree : Vite ne
 * peut pas écrire son dossier temporaire de configuration à travers ce lien
 * (EPERM). Ce fichier est chargé avec `--configLoader runner` et place le cache
 * Vite dans le worktree, sous `.cache/vite`.
 *
 * Utilisation :
 *   npx vitest run --config vitest.a02.config.mjs --configLoader runner
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  cacheDir: path.join(root, '.cache/vite'),
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    testTimeout: 30_000,
    env: {
      NVIDIA_API_KEY: '',
      OPENROUTER_API_KEY: '',
    },
    setupFiles: ['./tests/setup/no-network.ts', './tests/setup/jsdom-storage.ts'],
    include: [
      'src/components/compte/lifecycle/__tests__/**/*.test.ts',
      'src/components/compte/lifecycle/__tests__/**/*.test.tsx',
      'src/features/compte/server/lifecycle/__tests__/**/*.test.ts',
      'src/features/activity/lifecycle/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      'server-only': path.join(root, 'tests/mocks/server-only.ts'),
    },
  },
});
