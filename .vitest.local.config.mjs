import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Configuration locale de vérification : même contrat que vitest.config.ts,
// mais compatible avec le chargeur `runner` et un cache dans le worktree.
export default defineConfig({
  root: process.cwd(),
  cacheDir: path.resolve(process.cwd(), '.vite-cache'),
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
      'tests/**/*.spec.ts',
      'tests/**/*.spec.tsx',
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'tests/visual/!(glass-contract).spec.ts',
      'tests/a11y/e2e/**',
      'tests/ui/**',
      'tests/e2e/**',
      'tests/e2e-kit-studio/**',
      'tests/kit-studio/**',
      'tests/e2e-compas-full/**',
      'tests/explorer-v2/**/*.e2e.spec.ts',
      'tests/design/compte-refonte-*.spec.ts',
      'tests/design/create-*.spec.tsx',
      'tests/design/community-feed-contract.spec.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      'server-only': path.resolve(process.cwd(), 'tests/mocks/server-only.ts'),
    },
  },
});
