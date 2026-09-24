import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import {
  analyzeDecodedPixels,
  assertRenderedAuditSettings,
  auditVerificationStatus,
  collectColorContrastAxeNodes,
  describeAdminNavigation,
  getAuditBaseUrl,
  mergeAxeContrastEvidence,
  parseStrictNumber,
} from './contrast_audit_core.mjs';
import {
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

const a11yDir = path.resolve('audit', 'a11y');
const contrastReportPath = path.resolve('audit', 'CONTRASTE.md');
const matrixReportPath = path.resolve('audit', 'contrast-measurements.json');
const errorReportPath = path.join(a11yDir, 'measure-contrast-error.json');
export const ROUTES = [
  ['accueil', '/'],
  ['hub', '/hub'],
  ['hub-nouveau', '/hub/nouveau'],
  ['hub-itineraire', '/hub/itineraire'],
  ['hub-budget', '/hub/budget'],
  ['hub-groupe', '/hub/groupe'],
  ['hub-securite', '/hub/securite'],
  ['hub-materiel', '/hub/materiel'],
  ['hub-documents', '/hub/documents'],
  ['explorer', '/explorer'],
  ['carte-interactive', '/carte-interactive'],
  ['randonnee-active', '/randonnee-active'],
  ['rapport-expedition', '/rapport-expedition'],
  ['materiel', '/materiel'],
  ['kits', '/kits'],
  ['kit-islande', '/kits/islande-trek'],
  ['kit-gr20', '/kits/gr20-corse'],
  ['kit-vanlife', '/kits/vanlife-europe'],
  ['ai-configurator', '/ai-configurator'],
  ['copilote', '/copilote'],
  ['boutique', '/boutique'],
  ['produit-detail', '/produit/sac-a-dos-de-randonnee-categorie-bigbuy'],
  ['occasion', '/occasion'],
  ['location', '/location'],
  ['panier', '/panier'],
  ['checkout', '/checkout'],
  ['abonnements', '/abonnements'],
  ['pays-fr', '/pays/fr'],
  ['pays-is', '/pays/is'],
  ['lieux', '/lieux'],
  ['preparer-randonnee', '/preparer-randonnee'],
  ['communaute', '/communaute'],
  ['communaute-publier', '/communaute/publier'],
  ['communaute-pro', '/communaute-pro'],
  ['feed', '/feed'],
  ['carnets', '/carnets'],
  ['clubs', '/clubs'],
  ['entraide', '/entraide'],
  ['evenements', '/evenements'],
  ['avis', '/avis'],
  ['outils', '/outils'],
  ['outil-poids-sac', '/outils/poids-sac'],
  ['outil-budget', '/outils/budget'],
  ['outil-convertisseur', '/outils/convertisseur'],
  ['outil-checklist', '/outils/checklist'],
  ['carbone', '/carbone'],
  ['compte', '/compte'],
  ['compte-modifier', '/compte/modifier'],
  ['profil-public', '/profil'],
  ['progression', '/progression'],
  ['fidelite', '/fidelite'],
  ['recompenses', '/recompenses'],
  ['messagerie', '/messagerie'],
  ['connexion', '/connexion'],
  ['inscription', '/inscription'],
  ['guides', '/guides'],
  ['blog', '/blog'],
  ['manifeste', '/manifeste'],
  ['faq', '/faq'],
  ['contact', '/contact'],
  ['admin', '/admin'],
  ['admin-produits', '/admin/produits'],
  ['dev-glass', '/dev/glass'],
  ['dev-style', '/dev/style'],
  ['mentions-legales', '/mentions-legales'],
  ['cgv', '/cgv'],
  ['cgu', '/cgu'],
  ['cookies', '/cookies'],
  ['hors-ligne', '/hors-ligne'],
  ['page-404', '/route-inexistante-pour-tester-404'],
].map(([id, routePath]) => ({ id, path: routePath }));

export function getAdventureCookie(baseUrl = 'http://localhost:3000', slug = 'y-long-group') {
  return {
    name: 'lkv_active_adventure',
    value: Buffer.from(JSON.stringify({
      nature: 'sortie',
      id: slug,
      slug,
      title: slug,
    })).toString('base64url'),
    domain: new URL(baseUrl).hostname,
    path: '/',
  };
}

export async function readRenderedAuditSettings(page) {
  const rendered = await page.evaluate(() => {
    const root = document.documentElement;
    const theme = root.classList.contains('dark') || root.dataset.theme === 'dark'
      ? 'dark'
      : root.dataset.theme === 'light'
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    return {
      theme,
      intensityText: window.getComputedStyle(root).getPropertyValue('--glass-intensity').trim(),
    };
  });
  return { theme: rendered.theme, intensity: parseStrictNumber(rendered.intensityText) };
}

export async function extractTextElements(page) {
  return page.evaluate(() => {
    const ignored = new Set(['canvas', 'noscript', 'path', 'script', 'style', 'svg', 'text']);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const clips = (rect) => {
      const left = Math.max(0, rect.x);
      const top = Math.max(0, rect.y);
      const right = Math.min(viewport.width, rect.x + rect.width);
      const bottom = Math.min(viewport.height, rect.y + rect.height);
      return right > left && bottom > top ? { left, top, right, bottom } : null;
    };
    const intersects = (first, second) => {
      const a = clips(first);
      const b = clips(second);
      return Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    };
    const rectsFor = (element) => Array.from(element.getClientRects()).map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }));
    const overlays = Array.from(document.querySelectorAll('*'))
      .filter((element) => ['fixed', 'sticky'].includes(window.getComputedStyle(element).position))
      .map((element) => ({ element, rects: rectsFor(element) }))
      .filter((overlay) => overlay.rects.length > 0);
    const groups = new Map();
    const elementAuditIds = new Map();
    const usedIds = new Set();
    let sequence = 0;
    document.querySelectorAll('[data-audit-id^="audit-text-"]').forEach((element) => element.removeAttribute('data-audit-id'));

    const nextAuditId = () => {
      let auditId;
      do {
        auditId = `audit-text-${sequence++}`;
      } while (usedIds.has(auditId));
      usedIds.add(auditId);
      return auditId;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const element = textNode.parentElement;
      if (!element || ignored.has(element.tagName.toLowerCase())) continue;
      if (element.closest('.sr-only')) continue;
      const text = textNode.textContent?.trim() || '';
      if (!text) continue;
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;

      const ancestorOpacities = [];
      let current = element;
      let hidden = false;
      while (current) {
        const opacityText = window.getComputedStyle(current).opacity;
        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(opacityText)) {
          ancestorOpacities.push('invalid');
          break;
        }
        const opacity = Number(opacityText);
        ancestorOpacities.push(opacity);
        if (opacity <= 0) hidden = true;
        current = current.parentElement;
      }
      if (hidden) continue;

      const range = document.createRange();
      range.selectNode(textNode);
      const rects = Array.from(range.getClientRects())
        .filter((rect) => (
          rect.width > 0
          && rect.height > 0
          && rect.right > 0
          && rect.left < viewport.width
          && rect.bottom > 0
          && rect.top < viewport.height
        ))
        .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
      range.detach();
      if (rects.length === 0) continue;

      let auditId = elementAuditIds.get(element);
      if (!auditId) {
        const existingId = element.getAttribute('data-audit-id');
        auditId = existingId && !usedIds.has(existingId) ? existingId : nextAuditId();
        elementAuditIds.set(element, auditId);
        usedIds.add(auditId);
        element.setAttribute('data-audit-id', auditId);
      }
      const existing = groups.get(element);
      if (existing) {
        existing.rects.push(...rects);
        existing.text += ` ${text}`;
      } else {
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        groups.set(element, {
          dataAuditId: auditId,
          id: auditId,
          selector: `[data-audit-id="${auditId}"]`,
          text: text.slice(0, 240),
          color: style.color,
          ancestorOpacities,
          isLarge,
          rects,
          element,
        });
      }
    }

    return Array.from(groups.values()).map((group) => ({
      dataAuditId: group.dataAuditId,
      id: group.id,
      selector: group.selector,
      text: group.text.slice(0, 240),
      color: group.color,
      ancestorOpacities: group.ancestorOpacities,
      isLarge: group.isLarge,
      occluded: overlays.some((overlay) => (
        !overlay.element.contains(group.element)
        && !group.element.contains(overlay.element)
        && overlay.rects.some((overlayRect) => group.rects.some((textRect) => intersects(textRect, overlayRect)))
      )),
      rects: group.rects,
    }));
  });
}

export async function measurePageContrast(page, axeResults, options = {}) {
  const textElements = options.textElements || await extractTextElements(page);
  await page.screenshot({ fullPage: false, animations: 'disabled' });
  await page.addStyleTag({
    content: options.backgroundCss || '* { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }',
  });
  await page.waitForTimeout(100);
  const backgroundBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
  const { data, info } = await sharp(backgroundBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = analyzeDecodedPixels({ data, info, textElements });
  return {
    nodes: mergeAxeContrastEvidence(pixels, axeResults),
    image: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  };
}

export function colorContrastRules(axeResults) {
  return {
    violations: (axeResults.violations || []).filter((rule) => rule.id === 'color-contrast'),
    incomplete: (axeResults.incomplete || []).filter((rule) => rule.id === 'color-contrast'),
  };
}

function normalizedPath(pathname) {
  return pathname === '/' ? pathname : pathname.replace(/\/+$/, '') || '/';
}

export async function assertRouteNavigation(page, baseUrl, routePath) {
  const response = await page.goto(new URL(routePath, baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  const status = response?.status() ?? null;
  if (!response || status < 200 || status >= 300) {
    throw new Error(`HTTP ${status ?? 'inconnu'} pour ${routePath}`);
  }
  const finalUrl = new URL(page.url());
  if (finalUrl.origin !== new URL(baseUrl).origin) {
    throw new Error(`Redirection hors origine pour ${routePath}: ${finalUrl.origin}`);
  }
  if (routePath === '/admin' || routePath === '/admin/produits') {
    await page.waitForTimeout(600);
    return describeAdminNavigation({ requestedPath: routePath, finalUrl: page.url(), status });
  }
  const expected = new URL(routePath, baseUrl);
  if (normalizedPath(finalUrl.pathname) !== normalizedPath(expected.pathname)) {
    throw new Error(`URL finale inattendue pour ${routePath}: ${finalUrl.pathname}`);
  }
  return null;
}

function markdownCell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

function buildContrastMarkdown(summary, totals) {
  const lines = [
    '# Audit de contraste mesuré',
    '',
    `- Cellules terminées : ${summary.length}/${ROUTES.length}`,
    `- Nœuds agrégés : ${totals.pass + totals.contrast_fail + totals.unknown + totals.occluded}`,
    `- pass : ${totals.pass}`,
    `- contrast_fail : ${totals.contrast_fail}`,
    `- unknown : ${totals.unknown}`,
    `- occluded : ${totals.occluded}`,
    `- erreurs : ${totals.errors}`,
    '',
    '| Route | État | Nœuds | pass | contrast_fail | unknown | occluded | Taux |',
    '|:---|:---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const item of summary) {
    const counts = item.counts || {};
    const total = (counts.pass || 0) + (counts.contrast_fail || 0) + (counts.unknown || 0) + (counts.occluded || 0);
    const rate = total === 0 ? 0 : ((counts.pass || 0) / total) * 100;
    lines.push(`| ${markdownCell(item.id)} | ${item.status || (item.error ? 'error' : 'mesuré')} | ${total} | ${counts.pass || 0} | ${counts.contrast_fail || 0} | ${counts.unknown || 0} | ${counts.occluded || 0} | ${rate.toFixed(1)}% |`);
  }
  return `${lines.join('\n')}\n`;
}

function countNodes(nodes) {
  return nodes.reduce((counts, node) => {
    if (Object.hasOwn(counts, node.status)) counts[node.status] += 1;
    else counts.unknown += 1;
    return counts;
  }, { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 });
}

async function run() {
  invalidateAuditReports([
    contrastReportPath,
    matrixReportPath,
    errorReportPath,
    path.join(a11yDir, 'measure-contrast-v2.json'),
    path.join(a11yDir, 'summary.json'),
  ]);
  fs.mkdirSync(a11yDir, { recursive: true });
  const baseUrl = getAuditBaseUrl();
  const storageState = loadAuditStorageState(auditStorageStatePath(), baseUrl);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const summary = {};
  const errors = [];

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

    for (const route of ROUTES) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
        deviceScaleFactor: 1,
        locale: 'fr-FR',
        storageState,
      });
      await context.addCookies([getAdventureCookie(baseUrl)]);
      const page = await context.newPage();
      const diagnostics = attachPageDiagnostics(page);
      await page.addInitScript(() => {
        localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          version: '1',
        }));
        localStorage.setItem('lkdv_glass_intensity', '0.5');
        localStorage.setItem('lkdv_theme', 'dark');
      });

      try {
         const adminNavigation = await assertRouteNavigation(page, baseUrl, route.path);
         diagnostics.assertClean();
         if (adminNavigation?.redirected && adminNavigation.reason !== 'missing_admin_role') {
          throw new Error(`Redirection /admin inattendue: ${adminNavigation.reason}`);
        }
        if (adminNavigation?.redirected) {
          summary[route.id] = {
            id: route.id,
            path: route.path,
            status: 'admin_redirected',
            adminNavigation,
            nodes: [],
            counts: { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 },
            axe: { violations: [], incomplete: [] },
          };
          continue;
        }
        await page.waitForTimeout(600);
        const rendered = await readRenderedAuditSettings(page);
        assertRenderedAuditSettings({
          requestedTheme: 'dark',
          requestedIntensity: 0.5,
          actualTheme: rendered.theme,
          actualIntensity: rendered.intensity,
        });
        const textElements = await extractTextElements(page);
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const contrast = await measurePageContrast(page, axeResults, { textElements });
        if (contrast.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
        diagnostics.assertClean();
        const axe = colorContrastRules(axeResults);
        summary[route.id] = {
          id: route.id,
          path: route.path,
          theme: 'dark',
          requestedIntensity: 0.5,
          actualTheme: rendered.theme,
          actualIntensity: rendered.intensity,
          image: contrast.image,
          nodes: contrast.nodes,
          axe,
          axeNodeCounts: {
            violations: collectColorContrastAxeNodes(axeResults).violations.length,
            incomplete: collectColorContrastAxeNodes(axeResults).incomplete.length,
          },
          adminNavigation,
        };
        summary[route.id].counts = countNodes(contrast.nodes);
      } catch (error) {
        const message = redactDiagnosticText(error instanceof Error ? error.message : String(error));
        errors.push({ route: route.id, message });
        summary[route.id] = { id: route.id, path: route.path, error: message };
      } finally {
        diagnostics.dispose();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const measured = Object.values(summary).filter((item) => !item.error && item.status !== 'admin_redirected');
  const totals = measured.reduce((result, item) => {
    for (const status of ['pass', 'contrast_fail', 'unknown', 'occluded']) {
      result[status] += item.counts[status];
    }
    return result;
  }, { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0, errors: errors.length });
  const verificationStatus = auditVerificationStatus({
    liveVerified: errors.length === 0 && measured.length === ROUTES.length,
    errors: errors.map((entry) => entry.message),
  });
  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    verificationStatus,
    expectedRoutes: ROUTES.length,
    measuredRoutes: measured.length,
    totals,
    errors,
    routes: summary,
  };
  const safeReport = redactRuntimeValue(report);
  fs.writeFileSync(path.join(a11yDir, 'measure-contrast-v2.json'), `${JSON.stringify(safeReport, null, 2)}\n`);
  fs.writeFileSync(path.join(a11yDir, 'summary.json'), `${JSON.stringify(redactRuntimeValue(summary), null, 2)}\n`);
  fs.writeFileSync(matrixReportPath, `${JSON.stringify(safeReport, null, 2)}\n`);
  fs.writeFileSync(contrastReportPath, buildContrastMarkdown(Object.values(redactRuntimeValue(summary)), totals));

  if (errors.length > 0) {
    const error = new Error(`${errors.length} route(s) en erreur; aucun taux de succès global n'est publié`);
    writeAuditErrorReport(errorReportPath, error, { errors });
    throw error;
  }
  console.info(`Mesure terminée: ${measured.length}/${ROUTES.length} routes, ${totals.pass} pass, ${totals.contrast_fail} contrast_fail, ${totals.unknown} unknown, ${totals.occluded} occluded.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
    process.exit(1);
  });
}
