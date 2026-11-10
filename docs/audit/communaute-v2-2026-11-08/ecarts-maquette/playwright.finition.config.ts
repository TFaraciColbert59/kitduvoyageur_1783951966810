import { defineConfig } from '@playwright/test';

/**
 * Config des captures de finition (`finition.spec.ts`) : le build fixtures est
 * déjà servi (voir l'en-tête de la spec) ; aucun serveur n'est lancé ici.
 */
process.env.PW_BASE_URL = process.env.FINITION_BASE ?? 'http://127.0.0.1:4029';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'fixture-anon-key';

export default defineConfig({
  testDir: '../../../..',
  testMatch: ['docs/audit/communaute-v2-2026-11-08/ecarts-maquette/finition.spec.ts', 'docs/audit/communaute-v2-2026-11-08/ecarts-maquette/audit-transverses.spec.ts'],
  fullyParallel: false,
  workers: 2,
  timeout: 120_000,
  reporter: [['list']],
  use: { locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' },
});
