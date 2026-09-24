import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertRenderedAuditSettings,
  getAuditBaseUrl,
} from './contrast_audit_core.mjs';
import {
  loadAuditStorageState,
  verifyCompteSession,
} from './create_test_session.mjs';
import {
  ROUTES,
  assertRouteNavigation,
  colorContrastRules,
  getAdventureCookie,
  measurePageContrast,
  readRenderedAuditSettings,
} from './measure_contrast_v2.mjs';

const screensDir = path.resolve('audit', 'screens');
const a11yDir = path.resolve('audit', 'a11y');
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
    document.documentElement.classList.toggle('dark', requestedTheme === 'dark');
    document.documentElement.dataset.theme = requestedTheme;
    document.documentElement.style.colorScheme = requestedTheme;
    document.documentElement.style.setProperty('--glass-intensity', String(requestedIntensity));
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

function buildContrastReport(findings, errors) {
  const totals = findings.reduce((result, finding) => {
    for (const status of ['pass', 'contrast_fail', 'unknown', 'occluded']) {
      result[status] += finding.counts[status];
    }
    return result;
  }, { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 });
  const nodeCount = totals.pass + totals.contrast_fail + totals.unknown + totals.occluded;
  const passRate = errors.length > 0 || nodeCount === 0 ? 0 : (totals.pass / nodeCount) * 100;
  const lines = [
    '# Audit de contraste — campagne',
    '',
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
    const total = finding.counts.pass + finding.counts.contrast_fail + finding.counts.unknown + finding.counts.occluded;
    const rate = total === 0 ? 0 : (finding.counts.pass / total) * 100;
    lines.push(`| ${finding.routeId} | ${total} | ${finding.counts.pass} | ${finding.counts.contrast_fail} | ${finding.counts.unknown} | ${finding.counts.occluded} | ${rate.toFixed(1)}% |`);
  }
  if (errors.length > 0) {
    lines.push('', '## Erreurs', '');
    for (const error of errors) lines.push(`- ${error.route} (${error.stage}) : ${error.message}`);
  }
  return { markdown: `${lines.join('\n')}\n`, totals, passRate };
}

async function run() {
  fs.mkdirSync(screensDir, { recursive: true });
  fs.mkdirSync(a11yDir, { recursive: true });
  const BASE_URL = getAuditBaseUrl();
  const storageState = loadAuditStorageState();
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
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      locale: 'fr-FR',
      storageState,
    });
    const authPage = await authContext.newPage();
    await verifyCompteSession(authPage, BASE_URL);
    await authContext.close();

    for (const route of ROUTES) {
      let context;
      try {
        context = await browser.newContext({
          baseURL: BASE_URL,
          viewport: { width: 390, height: 844 },
          colorScheme: 'dark',
          deviceScaleFactor: 1,
          locale: 'fr-FR',
          storageState,
        });
        await context.addCookies([getAdventureCookie(BASE_URL)]);
        const page = await context.newPage();
        await initializeAuditPage(page, 'dark');
        const adminNavigation = await assertRouteNavigation(page, BASE_URL, route.path);
        if (adminNavigation?.redirected && adminNavigation.reason !== 'missing_admin_role') {
          throw new Error(`Redirection /admin inattendue: ${adminNavigation.reason}`);
        }
        if (adminNavigation?.redirected) {
          const redirectRecord = {
            route: route.path,
            id: route.id,
            timestamp: new Date().toISOString(),
            adminNavigation,
            violations: [],
            incomplete: [],
            colorContrast: { violations: [], incomplete: [] },
          };
          fs.writeFileSync(path.join(a11yDir, `${route.id}.json`), `${JSON.stringify(redirectRecord, null, 2)}\n`);
          a11ySummary[route.id] = {
            id: route.id,
            path: route.path,
            status: 'admin_redirected',
            adminNavigation,
            violations: 0,
            incomplete: 0,
            colorContrastViolations: 0,
            colorContrastIncomplete: 0,
          };
          continue;
        }
        await page.waitForTimeout(600);
        const rendered = await assertPageSettings(page, 'dark');
        const axeResults = await analyzeAxe(page);
        const colorContrast = colorContrastRules(axeResults);
        const a11y = {
          route: route.path,
          id: route.id,
          timestamp: new Date().toISOString(),
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
          adminNavigation,
        };
        fs.writeFileSync(path.join(a11yDir, `${route.id}.json`), `${JSON.stringify(a11y, null, 2)}\n`);
        a11ySummary[route.id] = {
          id: route.id,
          path: route.path,
          theme: 'dark',
          requestedIntensity: 0.5,
          actualTheme: rendered.theme,
          actualIntensity: rendered.intensity,
          violations: axeResults.violations.length,
          incomplete: axeResults.incomplete.length,
          colorContrastViolations: countNodesByTarget(colorContrast.violations),
          colorContrastIncomplete: countNodesByTarget(colorContrast.incomplete),
          adminNavigation,
        };
      } catch (error) {
        errors.push({
          route: route.id,
          stage: 'axe',
          message: error instanceof Error ? error.message : String(error),
        });
        a11ySummary[route.id] = { id: route.id, path: route.path, error: error instanceof Error ? error.message : String(error) };
      } finally {
        if (context) {
          await context.close().catch((closeError) => {
            console.warn(`Fermeture du contexte audit: ${closeError.message}`);
          });
        }
      }

      for (const viewport of VIEWPORTS) {
        for (const theme of ['light', 'dark']) {
          const context = await browser.newContext({
            baseURL: BASE_URL,
            viewport: { width: viewport.width, height: viewport.height },
            colorScheme: theme,
            deviceScaleFactor: 1,
            locale: 'fr-FR',
            storageState,
          });
          await context.addCookies([getAdventureCookie(BASE_URL)]);
          const page = await context.newPage();
          await initializeAuditPage(page, theme);

          try {
            await assertRouteNavigation(page, BASE_URL, route.path);
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

            for (const file of states) {
              manifest.push({
                route: route.id,
                file,
                viewport: viewport.name,
                requestedTheme: theme,
                actualTheme: rendered.theme,
                requestedIntensity: 0.5,
                actualIntensity: rendered.intensity,
              });
            }

            if (viewport.name === '390x844' && theme === 'dark') {
              await assertRouteNavigation(page, BASE_URL, route.path);
              await page.waitForTimeout(500);
              const measuredSettings = await assertPageSettings(page, 'dark');
              const axeResults = await analyzeAxe(page);
              const measured = await measurePageContrast(page, axeResults);
              if (measured.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
              const colorContrast = colorContrastRules(axeResults);
              contrastFindings.push({
                routeId: route.id,
                path: route.path,
                actualTheme: measuredSettings.theme,
                actualIntensity: measuredSettings.intensity,
                image: measured.image,
                nodes: measured.nodes,
                counts: countNodes(measured.nodes),
                axe: {
                  violations: colorContrast.violations,
                  incomplete: colorContrast.incomplete,
                },
              });
            }
          } catch (error) {
            errors.push({
              route: route.id,
              stage: `${viewport.name}-${theme}`,
              message: error instanceof Error ? error.message : String(error),
            });
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const contrastReport = buildContrastReport(contrastFindings, errors);
  fs.writeFileSync(path.join(screensDir, 'manifest.json'), `${JSON.stringify({
    totalCaptures: manifest.length,
    timestamp: new Date().toISOString(),
    captures: manifest,
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(a11yDir, 'summary.json'), `${JSON.stringify(a11ySummary, null, 2)}\n`);
  fs.writeFileSync(path.join(a11yDir, 'campaign-contrast.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: contrastReport.totals,
    weightedPassRate: contrastReport.passRate,
    findings: contrastFindings,
    errors,
  }, null, 2)}\n`);
  fs.writeFileSync(path.resolve('audit', 'CONTRASTE.md'), contrastReport.markdown);

  if (errors.length > 0) {
    throw new Error(`Campagne terminée avec ${errors.length} erreur(s); aucun succès global n'est publié`);
  }
  console.info(`Campagne terminée: ${manifest.length} captures, ${contrastReport.totals.pass} pass, ${contrastReport.totals.contrast_fail} contrast_fail, ${contrastReport.totals.unknown} unknown, ${contrastReport.totals.occluded} occluded.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
