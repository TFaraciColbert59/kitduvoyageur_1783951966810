import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertRenderedAuditSettings,
  buildCampaignAuditReport,
  countContrastNodes,
  getAuditBaseUrl,
  hasValidContrastEvidence,
} from './contrast_audit_core.mjs';
import {
  aggregateRouteOutcomes,
  attachPageDiagnostics,
  ensurePrivateAuditDirectory,
  invalidateAuditReportDirectory,
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
import {
  AUDIT_USER_AGENT,
  ROUTES,
  assessCurrentRouteNavigation,
  assertRouteNavigation,
  colorContrastRules,
  extractTextElements,
  getAdventureCookie,
  measurePageContrast,
  readRenderedAuditSettings,
  routeExpectationFor,
} from './measure_contrast_v2.mjs';

const screensDir = path.resolve('audit', 'screens', 'campaign');
const manifestPath = path.join(screensDir, 'manifest.json');
const a11yDir = path.resolve('audit', 'a11y', 'campaign');
const errorReportPath = path.join(a11yDir, 'campaign-error.json');
const contrastMarkdownPath = path.resolve('audit', 'CONTRASTE-CAMPAGNE.md');
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1440x900', width: 1440, height: 900 },
];

function fileDigest(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Artifact capture invalide');
  return { size: stat.size, sha256: createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') };
}

function countNodes(nodes) {
  return countContrastNodes(nodes);
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

async function waitForCampaignDefaultState(page) {
  await page.waitForFunction(() => {
    const text = document.querySelector('main')?.innerText || '';
    return text.trim().length > 80 && !/Connexion requise|Chargement|Initialisation/i.test(text);
  }, undefined, { timeout: 10000 });
  return page.evaluate(() => ({
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
     const counts = hasValidContrastEvidence(finding)
      ? countContrastNodes(finding.nodes)
      : { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 };
    const pass = counts.pass;
    const contrastFail = counts.contrast_fail;
    const unknown = counts.unknown;
    const occluded = counts.occluded;
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

export function aggregateManifestDiagnostics(captures = []) {
  const entries = Array.isArray(captures) ? captures : [];
  const warnings = [];
  const warningKeys = new Set();
  const degradedRoutes = new Set();
  for (const capture of entries) {
    const captureWarnings = Array.isArray(capture?.warnings) ? capture.warnings : [];
    if ((capture?.degraded === true || captureWarnings.length > 0) && capture?.route) {
      degradedRoutes.add(capture.route);
    }
    for (const warning of captureWarnings) {
      const enriched = {
        ...warning,
        route: capture?.route ?? null,
        viewport: capture?.viewport ?? null,
        requestedTheme: capture?.requestedTheme ?? null,
      };
      const key = [
        enriched.route,
        enriched.viewport,
        enriched.requestedTheme,
        enriched.type || '',
        enriched.message || '',
      ].join('|');
      if (!warningKeys.has(key)) {
        warningKeys.add(key);
        warnings.push(enriched);
      }
    }
  }
  return { warnings, degradedRoutes: [...degradedRoutes] };
}

function manifestStateForFile(file) {
  if (typeof file !== 'string') return 'invalid';
  if (file.endsWith('-default.png')) return 'default';
  if (file.endsWith('-scroll-end.png')) return 'scroll-end';
  if (file.endsWith('-modal.png')) return 'modal';
  return 'invalid';
}

export function campaignExpectedCounts(summary = {}, expectedRouteCount = ROUTES.length) {
  const entries = summary && typeof summary === 'object' ? Object.values(summary) : [];
  return {
    expectedRouteCount,
    expectedOutcomeCount: entries.filter((entry) => entry?.expected === true).length,
  };
}

export function campaignIsLiveVerified(options = {}) {
  const errorCount = options.errorCount ?? 0;
  const completedRouteCount = options.completedRouteCount ?? 0;
  const expectedRouteCount = options.expectedRouteCount ?? ROUTES.length;
  const warnings = Array.isArray(options.warnings) ? options.warnings : [];
  const degradedRoutes = Array.isArray(options.degradedRoutes) ? options.degradedRoutes : [];
  const expectedOutcomeCount = Number.isInteger(options.expectedOutcomeCount)
    ? Math.max(0, options.expectedOutcomeCount)
    : 0;
  const expectedMeasuredRouteIds = Array.isArray(options.expectedMeasuredRouteIds)
    ? options.expectedMeasuredRouteIds
    : [];
  const observedMeasuredRouteIds = Array.isArray(options.observedMeasuredRouteIds)
    ? options.observedMeasuredRouteIds
    : [];
  const manifestRouteIds = Array.isArray(options.manifestRouteIds)
    ? options.manifestRouteIds
    : [];
  const uniqueManifestRouteIds = [...new Set(manifestRouteIds)];
  const manifestRouteSetComplete = options.manifestCoverageComplete === true
    && expectedMeasuredRouteIds.length > 0
    && new Set(expectedMeasuredRouteIds).size === expectedMeasuredRouteIds.length
    && uniqueManifestRouteIds.length > 0
    && expectedMeasuredRouteIds.every((routeId) => uniqueManifestRouteIds.includes(routeId))
    && uniqueManifestRouteIds.every((routeId) => expectedMeasuredRouteIds.includes(routeId));
  const expectedMeasuredRouteCount = expectedMeasuredRouteIds.length || Math.max(0, expectedRouteCount - expectedOutcomeCount);
  const observedRouteSetComplete = observedMeasuredRouteIds.length === expectedMeasuredRouteCount
    && new Set(observedMeasuredRouteIds).size === observedMeasuredRouteIds.length
    && expectedMeasuredRouteIds.every((routeId) => observedMeasuredRouteIds.includes(routeId))
    && observedMeasuredRouteIds.every((routeId) => expectedMeasuredRouteIds.includes(routeId));
  if (![errorCount, completedRouteCount, expectedRouteCount].every(Number.isInteger)) return false;
  return errorCount === 0
    && completedRouteCount === expectedMeasuredRouteCount
    && warnings.length === 0
    && degradedRoutes.length === 0
    && observedRouteSetComplete
    && manifestRouteSetComplete;
}

async function run() {
  invalidateAuditReports([
     manifestPath,
     path.join(a11yDir, 'summary.json'),
     path.join(a11yDir, 'campaign-contrast.json'),
     contrastMarkdownPath,
    errorReportPath,
  ]);
   invalidateAuditReportDirectory(a11yDir, (name) => name.endsWith('.json'));
   ensurePrivateAuditDirectory(screensDir);
   ensurePrivateAuditDirectory(a11yDir);
  const BASE_URL = getAuditBaseUrl();
  const storageState = loadAuditStorageState(auditStorageStatePath(), BASE_URL);
  const browser = await chromium.launch({
     headless: true,

  });
   const manifest = [];
   const a11ySummary = {};
   const runId = randomUUID();
  const contrastFindings = [];
  const errors = [];
  const warnings = [];

  try {
    const authContext = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 390, height: 844 },
      userAgent: AUDIT_USER_AGENT,
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      locale: 'fr-FR',
       storageState,
       serviceWorkers: 'block',
     });
    const authPage = await authContext.newPage();
    await verifyCompteSession(authPage, BASE_URL, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });
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
         serviceWorkers: 'block',
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
         await page.waitForTimeout(600);
         const settledNavigation = assessCurrentRouteNavigation(page, BASE_URL, route.path, navigation.httpStatus);
         if (settledNavigation.finalPath !== navigation.finalPath
           || settledNavigation.expected !== navigation.expected
           || settledNavigation.status !== navigation.status) {
           throw new Error('La route a changé après le chargement initial');
         }
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
          writePrivateAuditFile(path.join(a11yDir, `${route.id}.json`), `${JSON.stringify(redactRuntimeValue(redirectRecord), null, 2)}\n`);
          a11ySummary[route.id] = {
            id: route.id,
            path: route.path,
            measured: false,
            expected: true,
            status: redirectRecord.status,
            reason: navigation.reason,
             finalPath: navigation.finalPath,
             expectedFinalPath: navigation.expectedFinalPath,
             httpStatus: navigation.httpStatus,
             warnings: navigationWarnings,
            degraded: navigationWarnings.length > 0,
            violations: 0,
            incomplete: 0,
            colorContrastViolations: 0,
            colorContrastIncomplete: 0,
          };
         } else {
           const rendered = await assertPageSettings(page, 'dark');
           const axeResults = await analyzeAxe(page);
           const finalNavigation = assessCurrentRouteNavigation(page, BASE_URL, route.path, navigation.httpStatus);
           if (finalNavigation.finalPath !== navigation.finalPath
             || finalNavigation.expected !== navigation.expected
             || finalNavigation.status !== navigation.status) {
             throw new Error('La route a changé pendant la mesure');
           }
           diagnostics.assertClean();
           const routeWarnings = diagnostics.warnings.map((entry) => ({ ...entry }));
           const colorContrast = colorContrastRules(axeResults);
          const a11y = {
            route: route.path,
            id: route.id,
            timestamp: new Date().toISOString(),
            measured: true,
            expected: false,
             status: routeWarnings.length > 0 ? 'degraded' : 'measured',
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
             warnings: routeWarnings,
             degraded: routeWarnings.length > 0,
          };
          writePrivateAuditFile(path.join(a11yDir, `${route.id}.json`), `${JSON.stringify(redactRuntimeValue(a11y), null, 2)}\n`);
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
             warnings: routeWarnings,
             degraded: routeWarnings.length > 0,
          };
        }
      } catch (error) {
        const message = redactDiagnosticText(error instanceof Error ? error.message : String(error));
         const errorWarnings = diagnostics?.warnings?.map((entry) => ({ ...entry })) || [];
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
           warnings: errorWarnings,
           degraded: errorWarnings.length > 0,
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
           const captureContext = await browser.newContext({
            baseURL: BASE_URL,
            viewport: { width: viewport.width, height: viewport.height },
            userAgent: AUDIT_USER_AGENT,
            colorScheme: theme,
            deviceScaleFactor: 1,
            locale: 'fr-FR',
            storageState,
         serviceWorkers: 'block',
          });
           await captureContext.addCookies([getAdventureCookie(BASE_URL)]);
           const page = await captureContext.newPage();
          const routeExpectation = routeExpectationFor(route.path);
           const captureDiagnostics = attachPageDiagnostics(page, {
            baseUrl: BASE_URL,
            expected404Path: routeExpectation?.kind === 'http' ? route.path : undefined,
          });
          await initializeAuditPage(page, theme);

           try {
             const navigation = await assertRouteNavigation(page, BASE_URL, route.path);
             await page.waitForTimeout(500);
             const settledNavigation = assessCurrentRouteNavigation(page, BASE_URL, route.path, navigation.httpStatus);
             if (settledNavigation.finalPath !== navigation.finalPath
               || settledNavigation.expected !== navigation.expected
               || settledNavigation.status !== navigation.status) {
               throw new Error('La route a changé après le chargement initial');
             }
              captureDiagnostics.assertClean();
              if (navigation.expected) {
                warnings.push(...captureDiagnostics.warnings.map((entry) => ({

                 ...entry,
                 route: route.id,
                 stage: `${viewport.name}-${theme}-navigation`,
               })));
               continue;
             }
               const defaultState = await waitForCampaignDefaultState(page);
               if (defaultState.scrollY !== 0 || defaultState.overlayOpen) {
                 throw new Error('État de capture par défaut non canonical');
               }
               const rendered = await assertPageSettings(page, theme);
              const routeDir = path.join(screensDir, route.id);
            fs.mkdirSync(routeDir, { recursive: true });
            const states = [];

            const defaultName = `${viewport.name}-${theme}-default.png`;
             const defaultBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
             const defaultFile = path.join(routeDir, defaultName);
             writePrivateAuditFile(defaultFile, defaultBuffer);
             const defaultArtifact = fileDigest(defaultFile);
            states.push(defaultName);

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(300);
            const scrollName = `${viewport.name}-${theme}-scroll-end.png`;
             const scrollBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
             const scrollFile = path.join(routeDir, scrollName);
             writePrivateAuditFile(scrollFile, scrollBuffer);
             const scrollArtifact = fileDigest(scrollFile);
             const scrollY = await page.evaluate(() => window.scrollY);
             states.push(scrollName);

             let modalArtifact = null;
             let modalOpen = false;
             const modalTrigger = page.locator('button[aria-haspopup="dialog"]').first();
             if (await modalTrigger.isVisible().catch(() => false)) {
               const modalClicked = await modalTrigger.click({ timeout: 1000 }).then(() => true).catch(() => false);

               await page.waitForTimeout(300);
               modalOpen = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]')]
                 .some((element) => {
                   const rect = element.getBoundingClientRect();
                   const style = getComputedStyle(element);
                   return rect.width > 0 && rect.height > 0
                     && rect.bottom > 0 && rect.top < window.innerHeight
                     && rect.right > 0 && rect.left < window.innerWidth
                     && style.display !== 'none' && style.visibility !== 'hidden';
                 }));
                if (modalOpen) {
                  const modalName = `${viewport.name}-${theme}-modal.png`;
                  const modalBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
                  const modalFile = path.join(routeDir, modalName);
                  writePrivateAuditFile(modalFile, modalBuffer);
                   modalArtifact = fileDigest(modalFile);
                   states.push(modalName);
                 }
               }

              const finalCaptureNavigation = assessCurrentRouteNavigation(page, BASE_URL, route.path, navigation.httpStatus);
             if (finalCaptureNavigation.finalPath !== navigation.finalPath
               || finalCaptureNavigation.expected !== navigation.expected
               || finalCaptureNavigation.status !== navigation.status) {
               throw new Error('La route a changé pendant la capture');
             }
              captureDiagnostics.assertClean();
              const captureWarnings = captureDiagnostics.warnings.map((entry) => ({ ...entry }));
              for (const file of states) {
                 const artifact = file === defaultName ? defaultArtifact : file === scrollName ? scrollArtifact : modalArtifact;
                 manifest.push({
                  route: route.id,
                  routeId: route.id,
                  file,
                 viewport: viewport.name,
                 requestedTheme: theme,
                 actualTheme: rendered.theme,
                 requestedIntensity: 0.5,
                   actualIntensity: rendered.intensity,
                    measurementState: file.includes('modal') ? 'modal' : file.includes('scroll') ? 'scroll-end' : 'default',
                    scrollY: file.includes('scroll') ? scrollY : file.endsWith('-default.png') ? defaultState.scrollY : null,
                    overlayOpen: file.includes('modal') ? modalOpen : file.endsWith('-default.png') ? defaultState.overlayOpen : false,
                   runId,
                   size: artifact.size,
                   sha256: artifact.sha256,
                   warnings: captureWarnings,
                 degraded: captureWarnings.length > 0,
               });
             }

               if (viewport.name === '390x844' && theme === 'dark') {
                 if (!navigation.expected) {
                   const freshResponse = await page.goto(new URL(route.path, BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
                   if (!freshResponse || freshResponse.status() < 200 || freshResponse.status() >= 300) {
                     throw new Error('Réponse de mesure invalide');
                   }
                   const defaultState = await waitForCampaignDefaultState(page);
                   if (defaultState.scrollY !== 0 || defaultState.overlayOpen) {
                     throw new Error('État de mesure non canonical');
                   }
                  const measuredSettings = await assertPageSettings(page, 'dark');
                const textElements = await extractTextElements(page);
                const axeResults = await analyzeAxe(page);
                 const measured = await measurePageContrast(page, axeResults, { textElements });
                 if (measured.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
                 const finalNavigation = assessCurrentRouteNavigation(page, BASE_URL, route.path, navigation.httpStatus);
                 if (finalNavigation.finalPath !== navigation.finalPath
                   || finalNavigation.expected !== navigation.expected
                   || finalNavigation.status !== navigation.status) {
                   throw new Error('La route a changé pendant la mesure');
                 }
                 captureDiagnostics.assertClean();
                 const measuredWarnings = captureDiagnostics.warnings.map((entry) => ({ ...entry }));

                const colorContrast = colorContrastRules(axeResults);
                contrastFindings.push({
                  routeId: route.id,
                  path: route.path,
                  measured: true,
                  status: measuredWarnings.length > 0 ? 'degraded' : 'measured',
                   actualTheme: measuredSettings.theme,
                   actualIntensity: measuredSettings.intensity,
                   measurementState: 'default',
                   scrollY: defaultState.scrollY,
                   overlayOpen: defaultState.overlayOpen,
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
             captureDiagnostics.dispose();

              await captureContext.close().catch(() => {});
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
  const manifestDiagnostics = aggregateManifestDiagnostics(manifest);
   warnings.push(
     ...findingAggregate.warnings,
     ...summaryAggregate.warnings,
     ...manifestDiagnostics.warnings,
   );
  const degradedRoutes = [...new Set([
    ...Object.values(a11ySummary)
      .filter((entry) => entry.degraded)
      .map((entry) => entry.id),
    ...manifestDiagnostics.degradedRoutes,
  ])];
  const { expectedRouteCount, expectedOutcomeCount } = campaignExpectedCounts(a11ySummary, ROUTES.length);
  const expectedOutcomeDefinitions = ROUTES.flatMap((route) => {
    const expectation = routeExpectationFor(route.path);
    return expectation
      ? [{ routeId: route.id, path: route.path, ...expectation }]
      : [];
  });
  const expectedMeasuredRouteIds = ROUTES
    .filter((route) => !routeExpectationFor(route.path))
    .map((route) => route.id);
  const observedMeasuredRouteIds = [...new Set(contrastFindings.map((finding) => finding.routeId))];
   const stateEvidenceComplete = contrastFindings.every((finding) => (
     finding.measurementState === 'default'
     && finding.scrollY === 0
     && finding.overlayOpen === false
   ));
   const manifestRouteIds = [...new Set(manifest.map((capture) => capture.routeId))];
  const expectedManifestKeys = new Set(expectedMeasuredRouteIds.flatMap((routeId) => (
    VIEWPORTS.flatMap((viewport) => ['dark', 'light'].flatMap((theme) => [
      `${routeId}|${viewport.name}-${theme}-default.png|${viewport.name}|${theme}|default`,
      `${routeId}|${viewport.name}-${theme}-scroll-end.png|${viewport.name}|${theme}|scroll-end`,
    ]))
  )));
  const actualManifestKeys = manifest.map((capture) => (
    `${capture.routeId}|${capture.file}|${capture.viewport}|${capture.requestedTheme}|${manifestStateForFile(capture.file)}`
  ));
  const actualManifestKeySet = new Set(actualManifestKeys);
   const manifestFilesComplete = manifest.every((capture) => {
     const filePath = path.resolve(screensDir, capture.routeId, capture.file);
     const relative = path.relative(path.resolve(screensDir), filePath);
     if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.existsSync(filePath)) return false;
     const stat = fs.lstatSync(filePath);
       if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0
         || capture.runId !== runId
         || !['default', 'scroll-end', 'modal'].includes(capture.measurementState)
         || (capture.measurementState === 'default' && (capture.scrollY !== 0 || capture.overlayOpen !== false))
         || (capture.measurementState === 'scroll-end' && !Number.isFinite(capture.scrollY))
         || (capture.measurementState === 'modal' && capture.overlayOpen !== true)
         || stat.size !== capture.size) return false;
     return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') === capture.sha256;
   });
  const expectedRouteIdSet = new Set(expectedMeasuredRouteIds);

  const manifestCoverageComplete = expectedMeasuredRouteIds.length > 0
    && actualManifestKeys.length === actualManifestKeySet.size
    && [...expectedManifestKeys].every((key) => actualManifestKeySet.has(key))
    && manifest.every((capture) => (
      expectedRouteIdSet.has(capture.routeId)
      && manifestStateForFile(capture.file) !== 'invalid'
    ))
     && manifestRouteIds.every((routeId) => expectedRouteIdSet.has(routeId))
     && manifestFilesComplete;
  const completedRouteCount = observedMeasuredRouteIds.length;
  const expectedOutcomes = Object.values(a11ySummary)
    .filter((entry) => entry.expected === true)
    .map((entry) => ({ ...entry, routeId: entry.routeId ?? entry.id }));
  const campaignReport = {
    ...buildCampaignAuditReport({
      findings: safeFindings,
      errors: safeErrors,
       expectedRouteCount,
       expectedRouteIds: ROUTES.map((route) => route.id),
       expectedRoutePaths: ROUTES.map((route) => ({ routeId: route.id, path: route.path })),
       expectedOutcomes,
      expectedOutcomeDefinitions,
       manifestCoverageComplete,
       stateEvidenceComplete,
       completedRouteCount,
      liveVerified: campaignIsLiveVerified({
        errorCount: errors.length,
        completedRouteCount,
        expectedRouteCount,
        warnings,
        degradedRoutes,
        expectedOutcomeCount,
        expectedMeasuredRouteIds,
         observedMeasuredRouteIds,
         manifestRouteIds,
         manifestCoverageComplete,
       }),
    }),
    warnings,
    degradedRoutes,
    expectedRouteCount,
    expectedOutcomeCount,
    expectedMeasuredRouteCount: expectedMeasuredRouteIds.length,
    expectedMeasuredRouteIds,
    manifestCoverageComplete,
  };
  const contrastReport = buildContrastReport(campaignReport.findings, safeErrors, campaignReport);
    if (campaignReport.verificationStatus !== 'VERIFIED') {
      const error = new Error(`Campagne non vérifiée (${campaignReport.verificationStatus}); ${errors.length} erreur(s), ${warnings.length} warning(s)`);
      writeAuditErrorReport(errorReportPath, error, {
        errors,
        warnings,
        degradedRoutes,
        expectedRouteCount,
        completedRouteCount,
        expectedOutcomeCount,
      });
      throw error;
    }
   const safeManifest = redactRuntimeValue({
     runId,
     verificationStatus: campaignReport.verificationStatus,
     totalCaptures: manifest.length,
     timestamp: new Date().toISOString(),
     warnings: manifestDiagnostics.warnings,
     degradedRoutes: manifestDiagnostics.degradedRoutes,
     captures: manifest,
   });
   const safeSummary = redactRuntimeValue(a11ySummary);
   const safeContrastReport = redactRuntimeValue(campaignReport);
    writePrivateAuditFile(manifestPath, `${JSON.stringify(safeManifest, null, 2)}\n`);
    writePrivateAuditFile(path.join(a11yDir, 'summary.json'), `${JSON.stringify(safeSummary, null, 2)}\n`);
    writePrivateAuditFile(path.join(a11yDir, 'campaign-contrast.json'), `${JSON.stringify(safeContrastReport, null, 2)}\n`);
    writePrivateAuditFile(contrastMarkdownPath, contrastReport.markdown);

  console.info(`Campagne terminée: ${manifest.length} captures, ${contrastReport.totals.pass} pass, ${contrastReport.totals.contrast_fail} contrast_fail, ${contrastReport.totals.unknown} unknown, ${contrastReport.totals.occluded} occluded.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
    process.exit(1);
  });
}
