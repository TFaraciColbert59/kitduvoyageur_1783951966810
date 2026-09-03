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
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'tests/visual/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 'server-only' lève une exception hors RSC — stub neutre en test.
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
