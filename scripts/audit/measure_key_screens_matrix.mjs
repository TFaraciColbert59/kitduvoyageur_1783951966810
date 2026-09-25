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
  countContrastNodes,
  EXPECTED_MATRIX_CELL_COUNT,
  getAuditBaseUrl,
  hasValidContrastEvidence,
  matrixCellKey,
} from './contrast_audit_core.mjs';
import {
  AUDIT_USER_AGENT,
  assessCurrentRouteNavigation,
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
  ensurePrivateAuditDirectory,
  invalidateAuditReports,
  redactDiagnosticText,
  redactRuntimeValue,
  writeAuditErrorReport,
  writePrivateAuditFile,
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
const MATRIX_MEASUREMENT_SCOPE = {
  viewport: { width: 390, height: 844 },
  fullPage: false,
  scrollCoverage: 'first_viewport',
};

export function isRenderedContentReady(text) {
  const normalized = String(text || '').trim();
  return normalized.length > 80
    && !/Connexion requise|Chargement|Initialisation/i.test(normalized);
}

export async function waitForRenderedContent(page, timeout = 10000) {
  await page.waitForFunction(() => {
    const text = document.querySelector('main')?.innerText || '';
    const animations = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
    const animationsSettled = animations.every((animation) => {
      const timing = animation.effect?.getTiming?.();
      return animation.playState === 'finished' || timing?.iterations === Infinity;
    });
    return text.trim().length > 80
      && !/Connexion requise|Chargement|Initialisation/i.test(text)
      && animationsSettled;
  }, undefined, { timeout });
  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(600);
  }
}

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
         actualTheme: result?.actualTheme ?? null,
         actualIntensity: result?.actualIntensity ?? null,
         measurementState: result?.measurementState ?? 'unknown',
         scrollY: result?.scrollY ?? null,
         overlayOpen: result?.overlayOpen ?? null,
      };
    }),
  };
}

export function isMatrixAuditVerified(report) {
  const cells = Array.isArray(report?.cells) ? report.cells : [];
  const expectedCells = buildMatrixCells();
  const expectedByKey = new Map(expectedCells.map((cell) => [matrixCellKey(cell), cell]));
  const actualKeys = cells.map((cell) => matrixCellKey({
    ...cell,
    intensity: cell?.requestedIntensity ?? cell?.intensity,
  }));
  const actualKeySet = new Set(actualKeys);
  const totals = { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0, error: 0, nodes: 0 };
  const cellsValid = cells.every((cell) => {
    const key = matrixCellKey({
      ...cell,
      intensity: cell?.requestedIntensity ?? cell?.intensity,
    });
    const expected = expectedByKey.get(key);
    const nodes = Array.isArray(cell?.nodes) ? cell.nodes : [];
     if (!expected || cell?.path !== expected.path || !hasValidContrastEvidence(cell)) return false;
     if (cell?.finalPath !== expected.path
       || !Number.isInteger(cell?.httpStatus)
       || cell.httpStatus < 200
       || cell.httpStatus >= 300) return false;
     if (cell?.expected === true
        || cell?.actualTheme !== expected.theme
        || Number(cell?.actualIntensity) !== Number(expected.intensity)
        || cell?.measurementState !== 'default'
        || cell?.scrollY !== 0
        || cell?.overlayOpen !== false) return false;
     if (Number(cell?.nodeCount) !== nodes.length || nodes.length === 0) return false;
    const counts = countContrastNodes(nodes);
    const declaredCounts = cell?.counts || {};
    if (
      Number(declaredCounts.pass) !== counts.pass
      || Number(declaredCounts.contrast_fail) !== counts.contrast_fail
      || Number(declaredCounts.unknown) !== counts.unknown
      || Number(declaredCounts.occluded) !== counts.occluded
    ) return false;
    totals.pass += counts.pass;
    totals.contrast_fail += counts.contrast_fail;
    totals.unknown += counts.unknown;
    totals.occluded += counts.occluded;
    totals.nodes += nodes.length;
    if (cell?.error) totals.error += 1;
    return cell?.degraded !== true
      && !(Array.isArray(cell?.warnings) && cell.warnings.length > 0)
      && !cell?.error;
  });
  const totalsMatch = ['pass', 'contrast_fail', 'unknown', 'occluded', 'error', 'nodes']
    .every((key) => Number(report?.totals?.[key]) === totals[key]);
  return report?.verificationStatus === 'VERIFIED'
    && report?.coverageComplete === true
    && report?.expectedCellCount === EXPECTED_MATRIX_CELL_COUNT
    && report?.cellCount === report?.expectedCellCount
    && cells.length === report?.expectedCellCount
    && actualKeySet.size === actualKeys.length
    && actualKeys.every((key) => expectedByKey.has(key))
    && cellsValid
    && totalsMatch
    && totals.error === 0
    && totals.unknown === 0
    && totals.occluded === 0
    && totals.nodes > 0;
}

export function buildMarkdown(report) {
  const scope = report.measurementScope || MATRIX_MEASUREMENT_SCOPE;
  const viewport = scope.viewport || { width: 390, height: 844 };
  const coverageLabel = scope.scrollCoverage === 'first_viewport' ? 'premier viewport' : scope.scrollCoverage;
  const lines = [
    '# Matrice de contraste — écrans clés',
    '',
    `- Cellules : ${report.cellCount}/${EXPECTED_MATRIX_CELL_COUNT}`,
    `- Portée : ${coverageLabel} ${viewport.width}×${viewport.height} (document non scrollé)`,
    `- Agrégat pondéré (premier viewport) : ${report.weightedPassRate.toFixed(1)}% pass`,
    `- Nœuds : ${report.totals.nodes}`,
    `- pass : ${report.totals.pass}`,
    `- contrast_fail : ${report.totals.contrast_fail}`,
    `- unknown : ${report.totals.unknown}`,
    `- occluded : ${report.totals.occluded}`,
    `- erreurs : ${report.totals.error}`,
    `- Couverture des cellules : ${report.coverageComplete ? 'complète' : 'incomplète'}`,
    `- Statut de vérification : ${report.verificationStatus || 'PARTIAL / NOT VERIFIED'}`,
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
   ensurePrivateAuditDirectory(a11yDir);
  const baseUrl = getAuditBaseUrl();
  const storageState = loadAuditStorageState(auditStorageStatePath(), baseUrl);
  const cells = buildMatrixCells();
  const browser = await chromium.launch({
     headless: true,

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
       serviceWorkers: 'block',
     });
    const authPage = await authContext.newPage();
    await verifyCompteSession(authPage, baseUrl, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });
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
       serviceWorkers: 'block',
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
         measurementState: 'unknown',
         scrollY: 0,
         overlayOpen: false,
         nodes: [],
        axe: { violations: [], incomplete: [] },
      };

      try {
         const navigation = await assertRouteNavigation(page, baseUrl, cell.path);
         assignMatrixNavigationMetadata(result, navigation);
         if (navigation.expected) {
           await page.waitForTimeout(600);
         } else {
           await waitForRenderedContent(page);
         }
         const settledNavigation = assessCurrentRouteNavigation(page, baseUrl, cell.path, navigation.httpStatus);
           if (settledNavigation.finalPath !== navigation.finalPath
             || settledNavigation.expected !== navigation.expected
             || settledNavigation.status !== navigation.status) {
             throw new Error('La route a changé après le chargement initial');
           }
           const captureState = await page.evaluate(() => ({
             scrollY: window.scrollY,
             overlayOpen: [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')]
               .some((element) => {
                 const rect = element.getBoundingClientRect();
                 const style = getComputedStyle(element);
                 return rect.width > 0 && rect.height > 0
                   && rect.bottom > 0 && rect.top < window.innerHeight
                   && rect.right > 0 && rect.left < window.innerWidth
                   && style.display !== 'none' && style.visibility !== 'hidden';
               }),
           }));
           if (captureState.scrollY !== 0 || captureState.overlayOpen) {
             throw new Error('État de matrice non canonical');
           }
           result.scrollY = captureState.scrollY;
           result.overlayOpen = captureState.overlayOpen;
           result.measurementState = 'default';
           diagnostics.assertClean();
         result.warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
         result.degraded = result.warnings.length > 0;
         if (navigation.expected) {
          result.expected = true;
          result.status = navigation.reason === 'missing_admin_role' ? 'admin_redirected' : navigation.status;
          result.reason = navigation.reason;
          result.expectedFinalPath = navigation.expectedFinalPath;
         } else {
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
            .include('[data-audit-id]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const measured = await measurePageContrast(page, axeResults, {
            backgroundCss: BACKGROUND_CAPTURE_CSS,
            textElements,
           });
           if (measured.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
           const finalNavigation = assessCurrentRouteNavigation(page, baseUrl, cell.path, navigation.httpStatus);
           if (finalNavigation.finalPath !== navigation.finalPath
             || finalNavigation.expected !== navigation.expected
             || finalNavigation.status !== navigation.status) {
             throw new Error('La route a changé pendant la mesure');
           }
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
         await context.close().catch(() => {});
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
      expectedCells: buildMatrixCells(),
      expectedCellCount: EXPECTED_MATRIX_CELL_COUNT,
     liveVerified: resultErrors.length === 0 && aggregate.warnings.length === 0 && expectedCells === 0,
     errors: resultErrors,
   }), results);
   report.measurementScope = MATRIX_MEASUREMENT_SCOPE;
    const matrixVerified = isMatrixAuditVerified(report);
    const finalReport = matrixVerified
      ? report
      : { ...report, verificationStatus: 'PARTIAL / NOT VERIFIED' };
    const serialized = redactRuntimeValue({
      ...finalReport,
      generatedAt: new Date().toISOString(),
      baseUrl,
      warnings: aggregate.warnings,
      expectedCells,
    }, { redactContent: true });
    if (!matrixVerified) {
       const error = new Error(`Matrice non vérifiée (${finalReport.verificationStatus}): ${report.cellCount}/${EXPECTED_MATRIX_CELL_COUNT} cellules, ${report.totals.nodes} nœud(s)`);
     writeAuditErrorReport(errorReportPath, error, {
       report: {
         cellCount: report.cellCount,
         expectedCellCount: report.expectedCellCount,
         verificationStatus: report.verificationStatus,
         weightedPassRate: report.weightedPassRate,
         totals: report.totals,
         measurementScope: report.measurementScope,
       },
       warnings: aggregate.warnings,
     });
      throw error;
    }
    writePrivateAuditFile(matrixJsonPath, `${JSON.stringify(serialized, null, 2)}\n`);
    writePrivateAuditFile(matrixMarkdownPath, buildMarkdown(serialized));

  console.info(`Matrice terminée: ${report.cellCount}/${EXPECTED_MATRIX_CELL_COUNT} cellules, ${report.weightedPassRate.toFixed(1)}% pass.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
    process.exit(1);
  });
}
