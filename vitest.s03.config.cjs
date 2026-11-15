/**
 * Lot S03-UI — configuration Vitest ciblée.
 *
 * Le worktree partage `node_modules` via un lien symbolique hors workspace ;
 * Vite tente alors d'écrire son bundle de configuration dans
 * `node_modules/.vite-temp`, refusé par le bac à sable. Un fichier CJS évite
 * ce chemin temporaire et permet de ne lancer que les tests du lot.
 * La configuration reprend celle de `vitest.config.ts` (alias, setup, env).
 */
const path = require('path');

module.exports = {
  oxc: {
    jsx: { runtime: 'automatic' },
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
      'src/components/live-segments/**/*.test.ts',
      'src/components/live-segments/**/*.test.tsx',
      'src/lib/live-segments/**/*.test.ts',
      'src/app/api/live-segments/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
};
