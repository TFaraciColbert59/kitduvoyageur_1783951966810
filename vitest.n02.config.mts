import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
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
      'src/features/offline/__tests__/**/*.test.ts',
      'src/components/offline/__tests__/**/*.test.tsx',
      'src/app/api/offline/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': `${root}src`,
      'server-only': `${root}tests/mocks/server-only.ts`,
    },
  },
});
