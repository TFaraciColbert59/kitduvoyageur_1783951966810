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
    // Plan 100, 2.12 : aucun serveur public appelé par un test unitaire
    // (fetch, http, https, net, tls, WebSocket ; la machine locale reste permise).
    setupFiles: ['./tests/setup/no-network.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    // tests/visual/ heberge des specs Playwright qui exigent un navigateur.
    // Le contrat de verre fait exception : c est le seul garde-fou de contraste
    // du CTA, et il doit rester dans la suite Vitest pour tourner a chaque commit.
    exclude: ['node_modules/**', 'tests/visual/!(glass-contract).spec.ts', 'tests/a11y/e2e/**', 'tests/ui/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 'server-only' lève une exception hors RSC — stub neutre en test.
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
