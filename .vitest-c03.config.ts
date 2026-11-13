import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    testTimeout: 30_000,
    env: { NVIDIA_API_KEY: '', OPENROUTER_API_KEY: '' },
    setupFiles: [path.resolve(root, 'tests/setup/no-network.ts'), path.resolve(root, 'tests/setup/jsdom-storage.ts')],
    include: ['src/features/highlights/__tests__/**/*.test.ts', 'src/features/highlights/__tests__/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      'server-only': path.resolve(root, 'tests/mocks/server-only.ts'),
    },
  },
});
