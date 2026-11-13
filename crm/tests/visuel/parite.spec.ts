import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { signIn } from '../support/flows';
import { sel } from '../support/selectors';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveRoute, screensFile, type Screen } from '../a11y/support';

/**
 * Couche 6 — parité visuelle.
 *
 * On ne compare pas les pixels à la maquette HTML : on capture chaque écran dans les
 * deux tailles de la maquette, on vérifie les dimensions et l'absence de débordement,
 * et on tient un registre écrit des différences voulues (`differences.json`), chacune
 * justifiée. Une différence sans justification = écart (07_VERIFICATION § 3).
 */

// Playwright exécute les tests depuis `crm/` (racine de la configuration).
const CRM_ROOT = process.cwd();
const VISUEL_DIR = path.resolve(CRM_ROOT, 'tests/visuel');
const PREUVES = path.resolve(CRM_ROOT, 'bundle/etat/preuves/visuel');
const MAQUETTE = path.resolve(CRM_ROOT, 'bundle/etat/preuves/reference/maquette');

type Differences = {
  globales: { id: string; difference: string; justification: string }[];
  ecrans: Record<string, { id: string; difference: string; justification: string }[]>;
};

const differences = JSON.parse(readFileSync(path.resolve(VISUEL_DIR, 'differences.json'), 'utf8')) as Differences;
const registre = screensFile();

/** Dimensions d'un PNG lues dans l'en-tête IHDR (aucune dépendance). */
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} n'est pas un PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Capture un écran dans une taille et vérifie dimension exacte + pas de débordement. */
async function capture(page: import('@playwright/test').Page, screen: Screen, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(resolveRoute(screen.route));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();

  mkdirSync(PREUVES, { recursive: true });
  const file = path.join(PREUVES, `${screen.slug}-${width}x${height}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });

  expect(pngSize(file), `${screen.slug} ${width}x${height}`).toEqual({ width, height });

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${screen.slug} déborde de ${scrollWidth - width} px`).toBeLessThanOrEqual(width);
}

test.describe('Registre des différences justifiées', () => {
  test('chaque différence a une justification écrite et chaque écran de la maquette est couvert', () => {
    const problems: string[] = [];
    const all = [...differences.globales, ...Object.values(differences.ecrans).flat()];
    expect(all.length).toBeGreaterThan(0);
    for (const entry of all) {
      if (!entry.id) problems.push('une différence sans identifiant');
      if (!entry.justification || entry.justification.trim().length < 40) {
        problems.push(`${entry.id} : justification trop courte ou absente`);
      }
      if (!entry.difference || entry.difference.trim().length < 15) problems.push(`${entry.id} : différence non décrite`);
    }
    for (const screen of registre.screens.filter((item) => item.maquette)) {
      if (!differences.ecrans[screen.slug]) problems.push(`${screen.slug} : aucune entrée de différences`);
    }
    expect(problems).toEqual([]);
  });

  test('les captures de référence ont exactement les tailles de la maquette', () => {
    const attendus: Record<string, { width: number; height: number }> = {
      '1440': { width: 1440, height: 1040 },
      '390': { width: 390, height: 844 }
    };
    const problems: string[] = [];
    let checked = 0;
    for (const screen of registre.screens.filter((item) => item.maquette)) {
      const file = path.resolve(MAQUETTE, screen.maquette!);
      if (!existsSync(file)) {
        problems.push(`${screen.maquette} absent pour ${screen.slug}`);
        continue;
      }
      const suffix = screen.maquette!.match(/-(\d{3,4})\.png$/)?.[1] ?? '';
      const expected = attendus[suffix];
      if (!expected) {
        problems.push(`${screen.maquette} : taille de référence inconnue`);
        continue;
      }
      const size = pngSize(file);
      checked += 1;
      if (size.width !== expected.width || size.height !== expected.height) {
        problems.push(`${screen.maquette} : ${size.width}×${size.height} au lieu de ${expected.width}×${expected.height}`);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8);
    expect(problems).toEqual([]);
  });

  test('le registre couvre les routes du CONTRACT et les deux tailles demandées', () => {
    const routes = new Set(registre.screens.map((screen) => screen.route));
    for (const route of ['/', '/equipe', '/journal', '/catalogue', '/connexion', '/double-authentification', '/acces-refuse']) {
      expect(routes.has(route), `route ${route} absente du registre`).toBe(true);
    }
    expect(registre.viewports.map((viewport) => `${viewport.width}x${viewport.height}`)).toEqual(['1440x1040', '390x844']);
  });
});

test.describe('Captures — écrans publics (aucun identifiant requis)', () => {
  for (const viewport of registre.viewports) {
    for (const screen of registre.screens.filter((item) => !item.auth)) {
      test(`${screen.slug} — ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await capture(page, screen, viewport.width, viewport.height);
      });
    }
  }
});

test.describe('Captures — écrans d’équipe', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  for (const viewport of registre.viewports) {
    for (const screen of registre.screens.filter((item) => item.auth)) {
      test(`${screen.slug} — ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await capture(page, screen, viewport.width, viewport.height);
        await expect(page.locator(sel.shell.root)).toBeVisible();
      });
    }
  }

  test('écrit le rapport de différences de la parité', async ({ page }) => {
    await page.goto('/connexion');
    mkdirSync(PREUVES, { recursive: true });
    const lines = [
      '# Parité visuelle — différences justifiées',
      '',
      `Généré le ${new Date().toISOString()} par crm/tests/visuel/parite.spec.ts.`,
      '',
      '## Différences globales',
      '',
      '| ID | Différence constatée | Justification |',
      '| --- | --- | --- |',
      ...differences.globales.map((entry) => `| ${entry.id} | ${entry.difference} | ${entry.justification} |`),
      '',
      '## Différences par écran',
      ''
    ];
    for (const [screen, entries] of Object.entries(differences.ecrans)) {
      lines.push(`### ${screen}`, '', '| ID | Différence constatée | Justification |', '| --- | --- | --- |');
      for (const entry of entries) lines.push(`| ${entry.id} | ${entry.difference} | ${entry.justification} |`);
      lines.push('');
    }
    writeFileSync(path.join(PREUVES, 'RAPPORT-DIFFERENCES.md'), lines.join('\n'), 'utf8');
    expect(existsSync(path.join(PREUVES, 'RAPPORT-DIFFERENCES.md'))).toBe(true);
  });
});
