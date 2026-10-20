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
    // Les gardes qui parcourent tout `src/` (aéroports, table des papiers, hôtes Overpass) dépassent 5 s quand la
    // machine est chargée (CI, autres processus) : 30 s, sans masquer un vrai blocage.
    testTimeout: 30_000,
    // Hermetique : les cles du .env.local du developpeur ne doivent JAMAIS
    // entrer dans le processus de test. Sans cela, la selection de provider
    // depend de la machine et la suite ne teste plus ce qu elle pretend tester.
    env: {
      NVIDIA_API_KEY: '',
      OPENROUTER_API_KEY: '',
    },
    // Plan 100, 2.12 : aucun serveur public appelé par un test unitaire
    // (fetch, http, https, net, tls, WebSocket ; la machine locale reste permise).
    setupFiles: ['./tests/setup/no-network.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    // tests/e2e/ : parcours Playwright (playwright.compas.config.ts), base et navigateur requis.
    // tests/visual/ heberge des specs Playwright qui exigent un navigateur.
    // Le contrat de verre fait exception : c est le seul garde-fou de contraste
    // du CTA, et il doit rester dans la suite Vitest pour tourner a chaque commit.
    // tests/e2e-compas-full/ : banc Playwright EN LIGNE du Compas (playwright.compas-full.config.ts).
    exclude: ['node_modules/**', 'tests/visual/!(glass-contract).spec.ts', 'tests/a11y/e2e/**', 'tests/ui/**', 'tests/e2e/**', 'tests/e2e-compas-full/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 'server-only' lève une exception hors RSC — stub neutre en test.
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
