import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  aggregateContrastMatrix,
  assertRenderedAuditSettings,
  buildMatrixCells,
  collectColorContrastAxeNodes,
  EXPECTED_MATRIX_CELL_COUNT,
  getAuditBaseUrl,
} from './contrast_audit_core.mjs';
import {
  colorContrastRules,
  getAdventureCookie,
  measurePageContrast,
  readRenderedAuditSettings,
} from './measure_contrast_v2.mjs';
import {
  loadAuditStorageState,
  verifyCompteSession,
} from './create_test_session.mjs';

const BACKGROUND_CAPTURE_CSS = '* { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }';
const a11yDir = path.resolve('audit', 'a11y');
const matrixJsonPath = path.join(a11yDir, 'contrast-key-screens-matrix.json');
const matrixMarkdownPath = path.resolve('audit', 'CONTRASTE-MATRICE.md');

function markdownCell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

function buildMarkdown(report) {
  const lines = [
    '# Matrice de contraste — écrans clés',
    '',
    `- Cellules : ${report.cellCount}/${EXPECTED_MATRIX_CELL_COUNT}`,
    `- Agrégat pondéré : ${report.weightedPassRate.toFixed(1)}% pass`,
    `- Nœuds : ${report.totals.nodes}`,
    `- pass : ${report.totals.pass}`,
    `- contrast_fail : ${report.totals.contrast_fail}`,
    `- unknown : ${report.totals.unknown}`,
    `- occluded : ${report.totals.occluded}`,
    `- erreurs : ${report.totals.error}`,
    '',
    '| Route | Thème demandé | Intensité demandée | Thème réel | Intensité réelle | Nœuds | Taux | États | Erreur |',
    '|:---|:---|---:|:---:|---:|---:|---:|:---|:---|',
  ];
  for (const cell of report.cells) {
    const counts = cell.counts;
    lines.push(`| ${markdownCell(cell.path)} | ${cell.theme} | ${cell.requestedIntensity} | ${cell.actualTheme ?? 'inconnu'} | ${cell.actualIntensity ?? 'inconnu'} | ${cell.nodeCount} | ${cell.passRate.toFixed(1)}% | ${counts.pass}/${counts.contrast_fail}/${counts.unknown}/${counts.occluded} | ${markdownCell(cell.error || '-')} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function navigateCell(page, baseUrl, routePath) {
  const response = await page.goto(new URL(routePath, baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  const status = response?.status() ?? null;
  if (!response || status < 200 || status >= 300) {
    throw new Error(`HTTP ${status ?? 'inconnu'} pour ${routePath}`);
  }
  const expected = new URL(routePath, baseUrl);
  const final = new URL(page.url());
  if (final.origin !== expected.origin
    || final.pathname.replace(/\/+$/, '') !== expected.pathname.replace(/\/+$/, '')
    || (expected.search && final.search !== expected.search)) {
    throw new Error(`URL finale inattendue pour ${routePath}: ${final.pathname}${final.search}`);
  }
}

async function run() {
  fs.mkdirSync(a11yDir, { recursive: true });
  const baseUrl = getAuditBaseUrl();
  const storageState = loadAuditStorageState();
  const cells = buildMatrixCells();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const results = [];

  try {
    const authContext = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      locale: 'fr-FR',
      storageState,
    });
    const authPage = await authContext.newPage();
    await verifyCompteSession(authPage, baseUrl);
    await authContext.close();

    for (const cell of cells) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        viewport: { width: 390, height: 844 },
        colorScheme: cell.theme,
        deviceScaleFactor: 1,
        locale: 'fr-FR',
        storageState,
      });
      await context.addCookies([getAdventureCookie(baseUrl)]);
      const page = await context.newPage();
      await page.addInitScript(({ theme, intensity }) => {
        localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          version: '1',
        }));
        localStorage.setItem('lkdv_glass_intensity', String(intensity));
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        document.documentElement.style.setProperty('--glass-intensity', String(intensity));
      }, { theme: cell.theme, intensity: cell.intensity });

      const result = {
        routeId: cell.routeId,
        path: cell.path,
        theme: cell.theme,
        intensity: cell.intensity,
        actualTheme: null,
        actualIntensity: null,
        nodes: [],
        axe: { violations: [], incomplete: [] },
      };

      try {
        await navigateCell(page, baseUrl, cell.path);
        await page.waitForTimeout(600);
        const rendered = await readRenderedAuditSettings(page);
        result.actualTheme = rendered.theme;
        result.actualIntensity = rendered.intensity;
        assertRenderedAuditSettings({
          requestedTheme: cell.theme,
          requestedIntensity: cell.intensity,
          actualTheme: rendered.theme,
          actualIntensity: rendered.intensity,
        });
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const measured = await measurePageContrast(page, axeResults, {
          backgroundCss: BACKGROUND_CAPTURE_CSS,
        });
        if (measured.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
        result.nodes = measured.nodes;
        result.axe = colorContrastRules(axeResults);
        result.axeNodeCounts = {
          violations: collectColorContrastAxeNodes(axeResults).violations.length,
          incomplete: collectColorContrastAxeNodes(axeResults).incomplete.length,
        };
        result.image = measured.image;
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      } finally {
        await context.close();
      }
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  if (results.length !== EXPECTED_MATRIX_CELL_COUNT) {
    throw new Error(`Matrice incomplète: ${results.length}/${EXPECTED_MATRIX_CELL_COUNT} cellules`);
  }
  const report = aggregateContrastMatrix(results);
  if (report.totals.error > 0) report.weightedPassRate = 0;
  const serialized = {
    ...report,
    generatedAt: new Date().toISOString(),
    baseUrl,
    expectedCellCount: EXPECTED_MATRIX_CELL_COUNT,
  };
  fs.writeFileSync(matrixJsonPath, `${JSON.stringify(serialized, null, 2)}\n`);
  fs.writeFileSync(matrixMarkdownPath, buildMarkdown(serialized));

  if (report.totals.error > 0 || report.totals.nodes === 0) {
    throw new Error(`Matrice terminée avec ${report.totals.error} erreur(s) et ${report.totals.nodes} nœud(s)`);
  }
  console.info(`Matrice terminée: ${report.cellCount}/${EXPECTED_MATRIX_CELL_COUNT} cellules, ${report.weightedPassRate.toFixed(1)}% pass.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
