import { test as base, expect } from '@playwright/test';

/**
 * Base commune des scénarios E2E.
 *
 * - `pageErrors` : toute erreur JavaScript non rattrapée fait échouer le test qui la
 *   provoque (observabilité par défaut, loi 6) ;
 * - `consoleErrors` : les messages `console.error` sont collectés et vérifiés en fin
 *   de test ; ils sont tolérés uniquement si le test attend un état d'erreur
 *   (l'assertion explicite du test l'autorise via `expectConsoleError`).
 */

export type ConsoleSink = {
  errors: string[];
  allow: (pattern: RegExp) => void;
};

export const test = base.extend<{ consoleSink: ConsoleSink }>({
  consoleSink: async ({ page }, use) => {
    const errors: string[] = [];
    const allowed: RegExp[] = [];
    page.on('pageerror', (error) => {
      errors.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    await use({
      errors,
      allow: (pattern: RegExp) => {
        allowed.push(pattern);
      }
    });
    const unexpected = errors.filter((text) => !allowed.some((pattern) => pattern.test(text)));
    expect(unexpected, `Erreurs JavaScript non attendues :\n${unexpected.join('\n')}`).toEqual([]);
  }
});

export { expect };
