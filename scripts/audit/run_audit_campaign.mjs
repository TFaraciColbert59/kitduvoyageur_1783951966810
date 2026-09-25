import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertRenderedAuditSettings,
  buildCampaignAuditReport,
  getAuditBaseUrl,
} from './contrast_audit_core.mjs';
import {
  aggregateRouteOutcomes,
  attachPageDiagnostics,
  invalidateAuditReportDirectory,
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
import {
  AUDIT_USER_AGENT,
  ROUTES,
  assertRouteNavigation,
  colorContrastRules,
  extractTextElements,
  getAdventureCookie,
  measurePageContrast,
  readRenderedAuditSettings,
  routeExpectationFor,
} from './measure_contrast_v2.mjs';

const screensDir = path.resolve('audit', 'screens');
const a11yDir = path.resolve('audit', 'a11y');
const errorReportPath = path.join(a11yDir, 'campaign-error.json');
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1440x900', width: 1440, height: 900 },
];

function countNodes(nodes) {
  return nodes.reduce((counts, node) => {
    if (Object.hasOwn(counts, node.status)) counts[node.status] += 1;
    else counts.unknown += 1;
    return counts;
  }, { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 });
}

function countNodesByTarget(rules) {
  return (rules || []).reduce((count, rule) => count + (rule.nodes?.length || 0), 0);
}

async function analyzeAxe(page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

async function initializeAuditPage(page, theme, intensity = 0.5) {
  await page.addInitScript(({ requestedTheme, requestedIntensity }) => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      version: '1',
    }));
    localStorage.setItem('lkdv_glass_intensity', String(requestedIntensity));
    localStorage.setItem('lkdv_theme', requestedTheme);
  }, { requestedTheme: theme, requestedIntensity: intensity });
}

async function assertPageSettings(page, theme, intensity = 0.5) {
  const rendered = await readRenderedAuditSettings(page);
  assertRenderedAuditSettings({
    requestedTheme: theme,
    requestedIntensity: intensity,
    actualTheme: rendered.theme,
    actualIntensity: rendered.intensity,
  });
  return rendered;
}

function buildContrastReport(findings, errors, report) {
  const { totals, weightedPassRate: passRate, verificationStatus } = report;
  const nodeCount = totals.pass + totals.contrast_fail + totals.unknown + totals.occluded;
  const lines = [
    '# Audit de contraste — campagne',
    '',
    `- Statut : ${verificationStatus}`,
    `- Nœuds : ${nodeCount}`,
    `- pass : ${totals.pass}`,
    `- contrast_fail : ${totals.contrast_fail}`,
    `- unknown : ${totals.unknown}`,
    `- occluded : ${totals.occluded}`,
    `- erreurs : ${errors.length}`,
    `- Taux pondéré : ${passRate.toFixed(1)}%`,
    '',
    '| Route | Nœuds | pass | contrast_fail | unknown | occluded | Taux |',
    '|:---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const finding of findings) {
    const counts = finding.counts || {};
    const pass = Number.isFinite(counts.pass) ? counts.pass : 0;
    const contrastFail = Number.isFinite(counts.contrast_fail) ? counts.contrast_fail : 0;
    const unknown = Number.isFinite(counts.unknown) ? counts.unknown : 0;
    const occluded = Number.isFinite(counts.occluded) ? counts.occluded : 0;
    const total = pass + contrastFail + unknown + occluded;
    const rate = total === 0 ? 0 : (pass / total) * 100;
    lines.push(`| ${finding.routeId} | ${total} | ${pass} | ${contrastFail} | ${unknown} | ${occluded} | ${rate.toFixed(1)}% |`);
  }
  if (errors.length > 0) {
    lines.push('', '## Erreurs', '');
    for (const error of errors) lines.push(`- ${error.route} (${error.stage}) : ${error.message}`);
  }
  return { markdown: `${lines.join('\n')}\n`, totals, passRate, verificationStatus };
}

async function run() {
  invalidateAuditReports([
    path.join(screensDir, 'manifest.json'),
    path.join(a11yDir, 'summary.json'),
    path.join(a11yDir, 'campaign-contrast.json'),
    path.resolve('audit', 'CONTRASTE.md'),
    errorReportPath,
  ]);
  invalidateAuditReportDirectory(a11yDir, (name) => name.endsWith('.json'));
  fs.mkdirSync(screensDir, { recursive: true });
  fs.mkdirSync(a11yDir, { recursive: true });
  const BASE_URL = getAuditBaseUrl();
  const storageState = loadAuditStorageState(auditStorageStatePath(), BASE_URL);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const manifest = [];
  const a11ySummary = {};
  const contrastFindings = [];
  const errors = [];

  try {
    const authContext = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 390, height: 844 },
      userAgent: AUDIT_USER_AGENT,
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      locale: 'fr-FR',
      storageState,
    });
    const authPage = await authContext.newPage();
    await verifyCompteSession(authPage, BASE_URL, { sessionMode: true });
    await authContext.close();

    for (const route of ROUTES) {
      let context;
      let diagnostics;
      try {
        context = await browser.newContext({
          baseURL: BASE_URL,
          viewport: { width: 390, height: 844 },
          userAgent: AUDIT_USER_AGENT,
          colorScheme: 'dark',
          deviceScaleFactor: 1,
          locale: 'fr-FR',
          storageState,
        });
        await context.addCookies([getAdventureCookie(BASE_URL)]);
        const page = await context.newPage();
        const routeExpectation = routeExpectationFor(route.path);
        diagnostics = attachPageDiagnostics(page, {
          baseUrl: BASE_URL,
          expected404Path: routeExpectation?.kind === 'http' ? route.path : undefined,
        });
        await initializeAuditPage(page, 'dark');
        const navigation = await assertRouteNavigation(page, BASE_URL, route.path);
        diagnostics.assertClean();
        const navigationWarnings = diagnostics.warnings.map((entry) => ({ ...entry }));
        if (navigation.expected) {
          const redirectRecord = {
            route: route.path,
            id: route.id,
            timestamp: new Date().toISOString(),
            expected: true,
            status: navigation.reason === 'missing_admin_role' ? 'admin_redirected' : navigation.status,
            reason: navigation.reason,
            finalPath: navigation.finalPath,
            expectedFinalPath: navigation.expectedFinalPath,
            httpStatus: navigation.httpStatus,
            warnings: navigationWarnings,
            degraded: navigationWarnings.length > 0,
            violations: [],
            incomplete: [],
            colorContrast: { violations: [], incomplete: [] },
          };
          fs.writeFileSync(path.join(a11yDir, `${route.id}.json`), `${JSON.stringify(redactRuntimeValue(redirectRecord), null, 2)}\n`);
          a11ySummary[route.id] = {
            id: route.id,
            path: route.path,
            measured: false,
            expected: true,
            status: redirectRecord.status,
            reason: navigation.reason,
            finalPath: navigation.finalPath,
            expectedFinalPath: navigation.expectedFinalPath,
            warnings: navigationWarnings,
            degraded: navigationWarnings.length > 0,
            violations: 0,
            incomplete: 0,
            colorContrastViolations: 0,
            colorContrastIncomplete: 0,
          };
        } else {
          await page.waitForTimeout(600);
          const rendered = await assertPageSettings(page, 'dark');
          const axeResults = await analyzeAxe(page);
          diagnostics.assertClean();
          const warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
          const colorContrast = colorContrastRules(axeResults);
          const a11y = {
            route: route.path,
            id: route.id,
            timestamp: new Date().toISOString(),
            measured: true,
            expected: false,
            status: warnings.length > 0 ? 'degraded' : 'measured',
            theme: 'dark',
            requestedIntensity: 0.5,
            actualTheme: rendered.theme,
            actualIntensity: rendered.intensity,
            violations: axeResults.violations,
            incomplete: axeResults.incomplete,
            colorContrast: {
              violations: colorContrast.violations,
              incomplete: colorContrast.incomplete,
            },
            warnings,
            degraded: warnings.length > 0,
          };
          fs.writeFileSync(path.join(a11yDir, `${route.id}.json`), `${JSON.stringify(redactRuntimeValue(a11y), null, 2)}\n`);
          a11ySummary[route.id] = {
            id: route.id,
            path: route.path,
            measured: true,
            expected: false,
            status: a11y.status,
            theme: 'dark',
            requestedIntensity: 0.5,
            actualTheme: rendered.theme,
            actualIntensity: rendered.intensity,
            violations: axeResults.violations.length,
            incomplete: axeResults.incomplete.length,
            colorContrastViolations: countNodesByTarget(colorContrast.violations),
            colorContrastIncomplete: countNodesByTarget(colorContrast.incomplete),
            warnings,
            degraded: warnings.length > 0,
          };
        }
      } catch (error) {
        const message = redactDiagnosticText(error instanceof Error ? error.message : String(error));
        const warnings = diagnostics?.warnings?.map((entry) => ({ ...entry })) || [];
        errors.push({
          route: route.id,
          stage: 'axe',
          message,
        });
        a11ySummary[route.id] = {
          id: route.id,
          path: route.path,
          measured: false,
          expected: false,
          error: message,
          warnings,
          degraded: warnings.length > 0,
        };
      } finally {
        if (diagnostics) diagnostics.dispose();
        if (context) {
          await context.close().catch((closeError) => {
            console.warn(`Fermeture du contexte audit: ${redactDiagnosticText(closeError instanceof Error ? closeError.message : closeError)}`);
          });
        }
      }

      for (const viewport of VIEWPORTS) {
        for (const theme of ['light', 'dark']) {
          const context = await browser.newContext({
            baseURL: BASE_URL,
            viewport: { width: viewport.width, height: viewport.height },
            userAgent: AUDIT_USER_AGENT,
            colorScheme: theme,
            deviceScaleFactor: 1,
            locale: 'fr-FR',
            storageState,
          });
          await context.addCookies([getAdventureCookie(BASE_URL)]);
          const page = await context.newPage();
          const routeExpectation = routeExpectationFor(route.path);
          const diagnostics = attachPageDiagnostics(page, {
            baseUrl: BASE_URL,
            expected404Path: routeExpectation?.kind === 'http' ? route.path : undefined,
          });
          await initializeAuditPage(page, theme);

          try {
            const navigation = await assertRouteNavigation(page, BASE_URL, route.path);
            diagnostics.assertClean();
            if (navigation.expected) continue;
            await page.waitForTimeout(500);
            const rendered = await assertPageSettings(page, theme);
            const routeDir = path.join(screensDir, route.id);
            fs.mkdirSync(routeDir, { recursive: true });
            const states = [];

            const defaultName = `${viewport.name}-${theme}-default.png`;
            await page.screenshot({ path: path.join(routeDir, defaultName), fullPage: false, animations: 'disabled' });
            states.push(defaultName);

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(300);
            const scrollName = `${viewport.name}-${theme}-scroll-end.png`;
            await page.screenshot({ path: path.join(routeDir, scrollName), fullPage: false, animations: 'disabled' });
            states.push(scrollName);

            const modalTrigger = page.locator('button[aria-haspopup="dialog"], [data-search-trigger], button[aria-expanded="false"]').first();
            if (await modalTrigger.isVisible().catch(() => false)) {
              await modalTrigger.click({ timeout: 1000 });
              await page.waitForTimeout(300);
              const modalName = `${viewport.name}-${theme}-modal.png`;
              await page.screenshot({ path: path.join(routeDir, modalName), fullPage: false, animations: 'disabled' });
              states.push(modalName);
            }

            diagnostics.assertClean();
            const warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
            for (const file of states) {
              manifest.push({
                route: route.id,
                file,
                viewport: viewport.name,
                requestedTheme: theme,
                actualTheme: rendered.theme,
                requestedIntensity: 0.5,
                actualIntensity: rendered.intensity,
                warnings,
                degraded: warnings.length > 0,
              });
            }

            if (viewport.name === '390x844' && theme === 'dark') {
              const measurementNavigation = await assertRouteNavigation(page, BASE_URL, route.path);
              if (!measurementNavigation.expected) {
                await page.waitForTimeout(500);
                const measuredSettings = await assertPageSettings(page, 'dark');
                const textElements = await extractTextElements(page);
                const axeResults = await analyzeAxe(page);
                const measured = await measurePageContrast(page, axeResults, { textElements });
                if (measured.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
                diagnostics.assertClean();
                const measuredWarnings = diagnostics.warnings.map((entry) => ({ ...entry }));
                const colorContrast = colorContrastRules(axeResults);
                contrastFindings.push({
                  routeId: route.id,
                  path: route.path,
                  measured: true,
                  status: measuredWarnings.length > 0 ? 'degraded' : 'measured',
                  actualTheme: measuredSettings.theme,
                  actualIntensity: measuredSettings.intensity,
                  image: measured.image,
                  nodes: measured.nodes,
                  counts: countNodes(measured.nodes),
                  axe: {
                    violations: colorContrast.violations,
                    incomplete: colorContrast.incomplete,
                  },
                  warnings: measuredWarnings,
                  degraded: measuredWarnings.length > 0,
                });
              }
            }
          } catch (error) {
            errors.push({
              route: route.id,
              stage: `${viewport.name}-${theme}`,
              message: redactDiagnosticText(error instanceof Error ? error.message : String(error)),
            });
          } finally {
            diagnostics.dispose();
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const safeErrors = redactRuntimeValue(errors);
  const safeFindings = redactRuntimeValue(contrastFindings);
  const findingAggregate = aggregateRouteOutcomes(contrastFindings);
  const summaryAggregate = aggregateRouteOutcomes(Object.values(a11ySummary));
  const warnings = [...findingAggregate.warnings, ...summaryAggregate.warnings];
  const degradedRoutes = Object.values(a11ySummary).filter((entry) => entry.degraded).map((entry) => entry.id);
  const expectedRouteCount = Object.values(a11ySummary).filter((entry) => entry.expected).length;
  const completedRouteCount = new Set(contrastFindings.map((finding) => finding.routeId)).size;
  const campaignReport = {
    ...buildCampaignAuditReport({
      findings: safeFindings,
      errors: safeErrors,
      expectedRouteCount: ROUTES.length,
      completedRouteCount,
      liveVerified: errors.length === 0
        && completedRouteCount === ROUTES.length
        && warnings.length === 0
        && degradedRoutes.length === 0
        && expectedRouteCount === 0,
    }),
    warnings,
    degradedRoutes,
    expectedRouteCount,
  };
  const contrastReport = buildContrastReport(safeFindings, safeErrors, campaignReport);
  const safeManifest = redactRuntimeValue({
    verificationStatus: campaignReport.verificationStatus,
    totalCaptures: manifest.length,
    timestamp: new Date().toISOString(),
    captures: manifest,
  });
  const safeSummary = redactRuntimeValue(a11ySummary);
  const safeContrastReport = redactRuntimeValue(campaignReport);
  fs.writeFileSync(path.join(screensDir, 'manifest.json'), `${JSON.stringify(safeManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(a11yDir, 'summary.json'), `${JSON.stringify(safeSummary, null, 2)}\n`);
  fs.writeFileSync(path.join(a11yDir, 'campaign-contrast.json'), `${JSON.stringify(safeContrastReport, null, 2)}\n`);
  fs.writeFileSync(path.resolve('audit', 'CONTRASTE.md'), contrastReport.markdown);

  if (errors.length > 0) {
    const error = new Error(`Campagne terminée avec ${errors.length} erreur(s); aucun succès global n'est publié`);
    writeAuditErrorReport(errorReportPath, error, { errors });
    throw error;
  }
  console.info(`Campagne terminée: ${manifest.length} captures, ${contrastReport.totals.pass} pass, ${contrastReport.totals.contrast_fail} contrast_fail, ${contrastReport.totals.unknown} unknown, ${contrastReport.totals.occluded} occluded.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
    process.exit(1);
  });
}
