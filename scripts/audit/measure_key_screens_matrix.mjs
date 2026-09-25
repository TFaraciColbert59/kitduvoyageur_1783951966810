import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertRenderedAuditSettings,
  buildMatrixAuditReport,
  buildMatrixCells,
  collectColorContrastAxeNodes,
  EXPECTED_MATRIX_CELL_COUNT,
  getAuditBaseUrl,
  matrixCellKey,
} from './contrast_audit_core.mjs';
import {
  AUDIT_USER_AGENT,
  assertRouteNavigation,
  colorContrastRules,
  extractTextElements,
  getAdventureCookie,
  measurePageContrast,
  readRenderedAuditSettings,
  routeExpectationFor,
} from './measure_contrast_v2.mjs';
import {
  aggregateRouteOutcomes,
  attachPageDiagnostics,
  invalidateAuditReports,
  redactDiagnosticText,
  redactRuntimeValue,
  writeAuditErrorReport,
} from './audit_runtime.mjs';
import {
  auditStorageStatePath,
  loadAuditStorageState,
  verifyCompteSession,
} from './create_test_session.mjs';

const BACKGROUND_CAPTURE_CSS = '* { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }';
const a11yDir = path.resolve('audit', 'a11y');
const matrixJsonPath = path.join(a11yDir, 'contrast-key-screens-matrix.json');
const matrixMarkdownPath = path.resolve('audit', 'CONTRASTE-MATRICE.md');
const errorReportPath = path.join(a11yDir, 'contrast-key-screens-error.json');

function markdownCell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

export function assignMatrixNavigationMetadata(result, navigation) {
  result.finalPath = navigation.finalPath;
  result.httpStatus = navigation.httpStatus;
}

export function attachMatrixCellMetadata(report, results = []) {
  const source = report && typeof report === 'object' ? report : {};
  const resultByKey = new Map(
    (Array.isArray(results) ? results : []).map((result) => [matrixCellKey(result), result]),
  );
  return {
    ...source,
    cells: (Array.isArray(source.cells) ? source.cells : []).map((cell) => {
      const cellKey = matrixCellKey({
        ...cell,
        intensity: cell.requestedIntensity ?? cell.intensity,
      });
      const result = resultByKey.get(cellKey);
      const warnings = Array.isArray(result?.warnings)
        ? result.warnings.map((entry) => ({ ...entry }))
        : [];
      return {
        ...cell,
        measured: result?.measured === true,
        expected: result?.expected === true,
        status: result?.status ?? (result?.error ? 'error' : 'not_measured'),
        warnings,
        degraded: result?.degraded === true || warnings.length > 0 || Boolean(result?.error),
        finalPath: result?.finalPath ?? null,
        httpStatus: Number.isFinite(result?.httpStatus) ? result.httpStatus : null,
      };
    }),
  };
}

export function buildMarkdown(report) {
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
    '| Route | Thème demandé | Intensité demandée | Thème réel | Intensité réelle | Nœuds | Taux | Mesuré | Attendu | Statut | HTTP | Chemin final | Degraded | Warnings | Erreur |',
    '|:---|:---|---:|:---:|---:|---:|---:|:---:|:---:|:---|---:|:---|:---:|:---|:---|',
  ];
  for (const cell of report.cells) {
    const counts = cell.counts;
    const warnings = (cell.warnings || [])
      .map((entry) => `${entry.type || 'warning'}: ${entry.message || ''}`)
      .join(' | ') || '-';
    lines.push(`| ${markdownCell(cell.path)} | ${cell.theme} | ${cell.requestedIntensity} | ${cell.actualTheme ?? 'inconnu'} | ${cell.actualIntensity ?? 'inconnu'} | ${cell.nodeCount} | ${cell.passRate.toFixed(1)}% | ${cell.measured ? 'oui' : 'non'} | ${cell.expected ? 'oui' : 'non'} | ${markdownCell(cell.status || '-')} | ${cell.httpStatus ?? '-'} | ${markdownCell(cell.finalPath || '-')} | ${cell.degraded ? 'oui' : 'non'} | ${markdownCell(warnings)} | ${markdownCell(cell.error || '-')} |`);
  }
  return `${lines.join('\n')}\n`;
}


async function run() {
  invalidateAuditReports([matrixJsonPath, matrixMarkdownPath, errorReportPath]);
  fs.mkdirSync(a11yDir, { recursive: true });
  const baseUrl = getAuditBaseUrl();
  const storageState = loadAuditStorageState(auditStorageStatePath(), baseUrl);
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
      userAgent: AUDIT_USER_AGENT,
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      locale: 'fr-FR',
      storageState,
    });
    const authPage = await authContext.newPage();
    await verifyCompteSession(authPage, baseUrl, { sessionMode: true });
    await authContext.close();

    for (const cell of cells) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        viewport: { width: 390, height: 844 },
        userAgent: AUDIT_USER_AGENT,
        colorScheme: cell.theme,
        deviceScaleFactor: 1,
        locale: 'fr-FR',
        storageState,
      });
      await context.addCookies([getAdventureCookie(baseUrl)]);
      const page = await context.newPage();
      const routeExpectation = routeExpectationFor(cell.path);
      const diagnostics = attachPageDiagnostics(page, {
        baseUrl,
        expected404Path: routeExpectation?.kind === 'http' ? cell.path : undefined,
      });
      await page.addInitScript(({ theme, intensity }) => {
        localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          version: '1',
        }));
        localStorage.setItem('lkdv_glass_intensity', String(intensity));
        localStorage.setItem('lkdv_theme', theme);
      }, { theme: cell.theme, intensity: cell.intensity });

      const result = {
        routeId: cell.routeId,
        path: cell.path,
        theme: cell.theme,
        intensity: cell.intensity,
        measured: false,
        expected: false,
        actualTheme: null,
        actualIntensity: null,
        nodes: [],
        axe: { violations: [], incomplete: [] },
      };

      try {
        const navigation = await assertRouteNavigation(page, baseUrl, cell.path);
        assignMatrixNavigationMetadata(result, navigation);
        diagnostics.assertClean();
        result.warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
        result.degraded = result.warnings.length > 0;
        if (navigation.expected) {
          result.expected = true;
          result.status = navigation.reason === 'missing_admin_role' ? 'admin_redirected' : navigation.status;
          result.reason = navigation.reason;
          result.expectedFinalPath = navigation.expectedFinalPath;
        } else {
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
          const textElements = await extractTextElements(page);
          const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const measured = await measurePageContrast(page, axeResults, {
            backgroundCss: BACKGROUND_CAPTURE_CSS,
            textElements,
          });
          if (measured.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
          diagnostics.assertClean();
          result.warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
          result.degraded = result.warnings.length > 0;
          result.measured = true;
          result.status = result.degraded ? 'degraded' : 'measured';
          result.nodes = measured.nodes;
          result.axe = colorContrastRules(axeResults);
          result.axeNodeCounts = {
            violations: collectColorContrastAxeNodes(axeResults).violations.length,
            incomplete: collectColorContrastAxeNodes(axeResults).incomplete.length,
          };
          result.image = measured.image;
        }
      } catch (error) {
        result.error = redactDiagnosticText(error instanceof Error ? error.message : String(error));
        result.warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
        result.degraded = result.warnings.length > 0;
      } finally {
        diagnostics.dispose();
        await context.close();
      }
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  if (results.length !== EXPECTED_MATRIX_CELL_COUNT) {
    const error = new Error(`Matrice incomplète: ${results.length}/${EXPECTED_MATRIX_CELL_COUNT} cellules`);
    writeAuditErrorReport(errorReportPath, error, { resultCount: results.length });
    throw error;
  }
  const aggregate = aggregateRouteOutcomes(results);
  const resultErrors = aggregate.errors.map((entry) => entry.error);
  const expectedCells = results.filter((result) => result.expected).length;
  const report = attachMatrixCellMetadata(buildMatrixAuditReport({
    cells: results,
    expectedCellCount: EXPECTED_MATRIX_CELL_COUNT,
    liveVerified: resultErrors.length === 0 && aggregate.warnings.length === 0 && expectedCells === 0,
    errors: resultErrors,
  }), results);
  const serialized = redactRuntimeValue({
    ...report,
    generatedAt: new Date().toISOString(),
    baseUrl,
    warnings: aggregate.warnings,
    expectedCells,
  });
  fs.writeFileSync(matrixJsonPath, `${JSON.stringify(serialized, null, 2)}\n`);
  fs.writeFileSync(matrixMarkdownPath, buildMarkdown(serialized));

  if (report.totals.error > 0 || report.totals.nodes === 0) {
    const error = new Error(`Matrice terminée avec ${report.totals.error} erreur(s) et ${report.totals.nodes} nœud(s)`);
    writeAuditErrorReport(errorReportPath, error, { report });
    throw error;
  }
  console.info(`Matrice terminée: ${report.cellCount}/${EXPECTED_MATRIX_CELL_COUNT} cellules, ${report.weightedPassRate.toFixed(1)}% pass.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
    process.exit(1);
  });
}
