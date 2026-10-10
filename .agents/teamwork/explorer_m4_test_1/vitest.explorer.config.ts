import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['.agents/teamwork/explorer_m4_test_1/proposed_terra-reputation-e2e.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../src'),
      'server-only': path.resolve(__dirname, '../../../tests/mocks/server-only.ts'),
    },
  },
});
