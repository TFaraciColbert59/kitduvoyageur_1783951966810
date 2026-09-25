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
  aggregateRouteOutcomes,
  attachPageDiagnostics,
  ensurePrivateAuditDirectory,
  invalidateAuditReports,
  redactDiagnosticText,
  redactRuntimeValue,
  safeAuditUrl,
  writeAuditErrorReport,
  writePrivateAuditFile,
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
export const AUDIT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export const ROUTE_EXPECTATIONS = Object.freeze({
  '/preparer-randonnee': Object.freeze({ kind: 'redirect', finalPath: '/hub', reason: 'expected_legacy_redirect' }),
  '/admin': Object.freeze({ kind: 'redirect', finalPath: '/', reason: 'missing_admin_role' }),
  '/admin/produits': Object.freeze({ kind: 'redirect', finalPath: '/', reason: 'missing_admin_role' }),
  '/dev/glass': Object.freeze({ kind: 'http', status: 404, reason: 'expected_404' }),
  '/dev/style': Object.freeze({ kind: 'http', status: 404, reason: 'expected_404' }),
  '/route-inexistante-pour-tester-404': Object.freeze({ kind: 'http', status: 404, reason: 'expected_404' }),
});
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
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const opacity = Number.parseFloat(style.opacity);
      return Number.isFinite(opacity) ? opacity > 0 : true;
    };
    const hasPaint = (element) => {
      const style = window.getComputedStyle(element);
      const background = style.backgroundColor;
      const backgroundAlpha = background.match(/^rgba\([^)]*?(?:,|\/)\s*([0-9.]+)\s*\)$/)?.[1]
        ?? background.match(/\/\s*([0-9.]+)\s*\)$/)?.[1]
        ?? null;
      return Boolean(
        (background && background !== 'transparent' && backgroundAlpha !== '0')
        || (style.backgroundImage && style.backgroundImage !== 'none')
        || (style.borderTopWidth !== '0px' && style.borderTopStyle !== 'none')
        || (style.boxShadow && style.boxShadow !== 'none')
      );
    };
    const isDecorativeEmoji = (value) => value === '\uFE0F'
      || value === '\u200D'
      || /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(value);
    const textSegments = (value) => {
      const segments = [];
      let start = null;
      let offset = 0;
      for (const character of value) {
        if (isDecorativeEmoji(character)) {
          if (start !== null) {
            segments.push([start, offset]);
            start = null;
          }
        } else if (start === null) {
          start = offset;
        }
        offset += character.length;
      }
      if (start !== null) segments.push([start, offset]);
      return segments
        .map(([segmentStart, segmentEnd]) => {
          const rawSegment = value.slice(segmentStart, segmentEnd);
          const leadingWhitespace = rawSegment.length - rawSegment.trimStart().length;
          const trailingWhitespace = rawSegment.length - rawSegment.trimEnd().length;
          return {
            start: segmentStart + leadingWhitespace,
            end: segmentEnd - trailingWhitespace,
            text: rawSegment.trim(),
          };
        })
        .filter((segment) => segment.text);
    };
    const overlayFor = (element) => {
      let current = element;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const zIndex = style.zIndex === 'auto' ? null : Number(style.zIndex);
        if (
          ['fixed', 'sticky'].includes(style.position)
          && (zIndex === null || zIndex > 0)
          && isVisible(current)
        ) {
          return { element: current, painted: hasPaint(current) || hasPaint(element) };
        }
        current = current.parentElement;
      }
      return null;
    };
    const isOccluded = (group) => group.rects.some((rect) => {
      const points = [
        [rect.x + rect.width / 2, rect.y + rect.height / 2],
        [rect.x + 1, rect.y + rect.height / 2],
        [rect.x + rect.width - 1, rect.y + rect.height / 2],
        [rect.x + rect.width / 2, rect.y + 1],
        [rect.x + rect.width / 2, rect.y + rect.height - 1],
      ].filter(([x, y]) => x >= 0 && y >= 0 && x < viewport.width && y < viewport.height);
      return points.some(([x, y]) => {
        const stack = document.elementsFromPoint(x, y);
        const targetIndex = stack.indexOf(group.element);
        return stack.some((element, index) => {
          const overlay = overlayFor(element);
          if (!overlay?.painted) return false;
          if (overlay.element.contains(group.element) || group.element.contains(overlay.element)) return false;
          return targetIndex < 0 || index < targetIndex;
        });
      });
    });
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
      if (element.closest('.sr-only') || element.closest('[aria-hidden="true"]')) continue;
       const rawText = textNode.textContent || '';
       const text = rawText.trim();
       if (!text) continue;
       const segments = textSegments(rawText);
       if (segments.length === 0) continue;
       const measuredText = segments.map((segment) => segment.text).join(' ');
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

       const rects = [];
       for (const segment of segments) {
         const range = document.createRange();
         range.setStart(textNode, segment.start);
         range.setEnd(textNode, segment.end);
         rects.push(...Array.from(range.getClientRects())
           .filter((rect) => (
             rect.width > 0
             && rect.height > 0
             && rect.right > 0
             && rect.left < viewport.width
             && rect.bottom > 0
             && rect.top < viewport.height
           ))
           .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })));
         range.detach();
       }
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
         existing.text += ` ${measuredText}`;
      } else {
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        groups.set(element, {
          dataAuditId: auditId,
          id: auditId,
          selector: `[data-audit-id="${auditId}"]`,
           text: measuredText.slice(0, 240),
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
      occluded: isOccluded(group),
      rects: group.rects,
    }));
  });
}

export async function readCanonicalMeasurementState(page) {
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

export function routeExpectationFor(routePath) {
  const pathname = new URL(String(routePath), 'http://audit.invalid').pathname;
  return ROUTE_EXPECTATIONS[normalizedPath(pathname)] || null;
}

export function routeDiagnosticsOptions(baseUrl, routePath) {
  const routeExpectation = routeExpectationFor(routePath);
  return {
    baseUrl,
    expected404Path: routeExpectation?.kind === 'http' ? routePath : undefined,
  };
}

export function assessRouteNavigation({ routePath, baseUrl, finalUrl, status }) {
  const safeRoute = safeAuditUrl(routePath, baseUrl);
  let base;
  let requested;
  let final;
  try {
    base = new URL(baseUrl);
    requested = new URL(routePath, base);
    final = new URL(finalUrl);
  } catch {
    throw new Error(`URL de navigation invalide: ${safeRoute}`);
  }
  const safeFinal = safeAuditUrl(final.toString(), base.toString());
  if (base.username || base.password || requested.username || requested.password || final.username || final.password) {
    throw new Error(`Identifiants dans l’URL de navigation: ${safeRoute}: ${safeFinal}`);
  }
  if (final.origin !== base.origin) {
    throw new Error(`Redirection hors origine pour ${safeRoute}: ${safeFinal}`);
  }
  if (!Number.isInteger(status) || status <= 0) {
    throw new Error(`HTTP ${status ?? 'inconnu'} pour ${safeRoute}`);
  }
  const finalPath = normalizedPath(final.pathname);
  const requestedPath = normalizedPath(requested.pathname);
  const queryMatches = final.search === requested.search;
  if (final.hash) {
    throw new Error(`URL finale inattendue pour ${safeRoute}: fragment non attendu`);
  }
  const expectation = routeExpectationFor(routePath);
   if (expectation?.kind === 'redirect' && expectation.reason === 'missing_admin_role') {
     if (requested.search || requested.hash) {
       throw new Error(`Redirection ${safeRoute} inattendue: paramètres demandés`);
     }
     if (final.search || final.hash) {
      throw new Error(`Redirection ${safeRoute} inattendue: paramètres non attendus`);
    }
     if (!Number.isInteger(status) || status < 200 || status >= 300) {
       throw new Error(`HTTP ${status} pour ${safeRoute}`);
     }
     const navigation = describeAdminNavigation({ requestedPath, finalUrl: final.toString(), status });
    if (navigation.redirected && navigation.reason !== expectation.reason) {
      throw new Error(`Redirection ${safeRoute} inattendue: ${navigation.reason}`);
    }
     if (!navigation.redirected || finalPath !== expectation.finalPath) {
       throw new Error(`Redirection ${safeRoute} inattendue: rôle administrateur non refusé`);
     }
     if (navigation.redirected) {
       return {
        ...navigation,
        expected: true,
        status: 'expected_redirect',
        expectedFinalPath: expectation.finalPath,
        expectedStatus: null,
        httpStatus: status,
      };
    }
   } else if (expectation?.kind === 'redirect') {
     if (requested.search || requested.hash) {
       throw new Error(`Redirection ${safeRoute} inattendue: paramètres demandés`);
     }
     if (final.search || final.hash) {
      throw new Error(`Redirection inattendue pour ${safeRoute}: paramètres non attendus`);
    }
    if (finalPath !== expectation.finalPath) {
      throw new Error(`Redirection inattendue pour ${safeRoute}: ${finalPath}, attendu ${expectation.finalPath}`);
    }
    if (status < 200 || status >= 400) {
      throw new Error(`HTTP ${status} pour ${safeRoute}`);
    }
    return {
      expected: true,
      redirected: true,
      reason: expectation.reason,
      status: 'expected_redirect',
      finalPath,
      expectedFinalPath: expectation.finalPath,
      expectedStatus: null,
      httpStatus: status,
    };
  } else if (expectation?.kind === 'http') {
    if (status !== expectation.status) {
      throw new Error(`HTTP ${status} pour ${safeRoute}, attendu ${expectation.status}`);
    }
    if (finalPath !== requestedPath || !queryMatches) {
      throw new Error(`URL finale inattendue pour ${safeRoute}: ${safeFinal}`);
    }
    return {
      expected: true,
      redirected: false,
      reason: expectation.reason,
      status: 'expected_404',
      finalPath,
      expectedFinalPath: null,
       expectedStatus: expectation.status,
      httpStatus: status,
    };
  }
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status} pour ${safeRoute}`);
  }
  if (finalPath !== requestedPath || !queryMatches) {
    throw new Error(`URL finale inattendue pour ${safeRoute}: ${safeFinal}`);
  }
  return {
    expected: false,
    redirected: false,
    reason: null,
    status: 'ok',
     finalPath: `${finalPath}${final.search}`,
     expectedFinalPath: null,
     expectedStatus: null,
     httpStatus: status,
  };
}

export function assessCurrentRouteNavigation(page, baseUrl, routePath, status) {
  return assessRouteNavigation({
    routePath,
    baseUrl,
    finalUrl: page.url(),
    status,
  });
}

export async function assertRouteNavigation(page, baseUrl, routePath) {
  const safeRoute = safeAuditUrl(routePath, baseUrl);
  try {
    const response = await page.goto(new URL(routePath, baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    if ((routeExpectationFor(routePath)?.reason === 'missing_admin_role' || routePath === '/admin' || routePath === '/admin/produits')
      && typeof page.waitForTimeout === 'function') {
      await page.waitForTimeout(600);
    }
    return assessRouteNavigation({
      routePath,
      baseUrl,
      finalUrl: page.url(),
      status: response?.status() ?? null,
    });
  } catch (error) {
    const detail = redactDiagnosticText(error instanceof Error ? error.message : String(error));
    throw new Error(`Navigation audit impossible pour ${safeRoute}: ${detail}`);
  }
}

function markdownCell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

function buildContrastMarkdown(summary, totals, verificationStatus = 'PARTIAL / NOT VERIFIED') {
  const lines = [
    '# Audit de contraste mesuré',
    '',
    `- Cellules terminées : ${summary.length}/${ROUTES.length}`,
    `- Statut de vérification : ${verificationStatus}`,
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
    const counts = countNodes(Array.isArray(item.nodes) ? item.nodes : []);
    const total = counts.pass + counts.contrast_fail + counts.unknown + counts.occluded;
    const rate = total === 0 ? 0 : (counts.pass / total) * 100;
    lines.push(`| ${markdownCell(item.id)} | ${item.status || (item.error ? 'error' : 'mesuré')} | ${total} | ${counts.pass} | ${counts.contrast_fail} | ${counts.unknown} | ${counts.occluded} | ${rate.toFixed(1)}% |`);
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

function expectedNavigationEvidenceComplete(entry, expectation) {
  if (!entry || entry.expected !== true || entry.measured === true) return false;
  if (expectation.kind === 'redirect') {
    const expectedStatus = expectation.reason === 'missing_admin_role'
      ? 'admin_redirected'
      : 'expected_redirect';
    return entry.status === expectedStatus
      && entry.reason === expectation.reason
      && entry.finalPath === expectation.finalPath
      && entry.expectedFinalPath === expectation.finalPath
      && Number.isInteger(entry.httpStatus)
      && entry.httpStatus >= 200
      && entry.httpStatus < 400;
  }
  if (expectation.kind === 'http') {
    return entry.status === 'expected_404'
      && entry.reason === expectation.reason
      && entry.finalPath === entry.path
      && entry.expectedFinalPath === null
      && entry.httpStatus === expectation.status;
  }
  return false;
}

export function summarizeFullContrastEvidence(summary = {}, expectedRoutes = ROUTES) {
  const entries = Object.values(summary && typeof summary === 'object' ? summary : {});
  const expectedRoutesWithExpectations = expectedRoutes.map((route) => ({
    route,
    expectation: routeExpectationFor(route.path),
  }));
  const expectedMeasuredRouteIds = expectedRoutesWithExpectations
    .filter(({ expectation }) => !expectation)
    .map(({ route }) => route.id);
  const expectedMeasuredRouteCount = expectedMeasuredRouteIds.length;
  const aggregate = aggregateRouteOutcomes(entries);
  const totals = aggregate.measured.reduce((result, item) => {
    const counts = countNodes(item.nodes);
    for (const status of ['pass', 'contrast_fail', 'unknown', 'occluded']) {
      result[status] += counts[status];
    }
    return result;
  }, { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0, nodes: 0 });
  totals.nodes = totals.pass + totals.contrast_fail + totals.unknown + totals.occluded;
  const expectedById = new Map(expectedRoutes.map((route) => [route.id, route]));
  const observedIds = entries.map((entry) => entry?.id);
  const observedIdSet = new Set(observedIds);
  const observedMeasuredIds = new Set(entries
    .filter((entry) => entry?.measured === true)
    .map((entry) => entry?.id));
  const routeIdentityComplete = entries.length === expectedRoutes.length
    && observedIdSet.size === entries.length
    && entries.every((entry) => expectedById.get(entry?.id)?.path === entry?.path);
  const measuredRouteSetComplete = observedMeasuredIds.size === expectedMeasuredRouteCount
    && expectedMeasuredRouteIds.every((routeId) => observedMeasuredIds.has(routeId));
  const evidenceShapeComplete = routeIdentityComplete
    && entries.every((entry) => {
      const expectedRoute = expectedById.get(entry?.id);
      if (!expectedRoute) return false;
      const expectation = routeExpectationFor(expectedRoute.path);
      if (expectation) return expectedNavigationEvidenceComplete(entry, expectation);
      return entry.expected !== true
        && entry.measured === true
        && Array.isArray(entry.nodes)
        && entry.nodes.length > 0;
    });
  const coverageComplete = evidenceShapeComplete
    && measuredRouteSetComplete
    && aggregate.measured.length === expectedMeasuredRouteCount
    && totals.nodes > 0;
  return {
    ...aggregate,
    expectedRouteCount: expectedRoutes.length,
    expectedMeasuredRouteCount,
    expectedMeasuredRouteIds,
    observedMeasuredRouteIds: [...observedMeasuredIds],
    completedRouteCount: entries.length,
    routeIdentityComplete,
    measuredRouteSetComplete,
    evidenceShapeComplete,
    coverageComplete,
    totals: {
      ...totals,
      errors: aggregate.errors.length,
      warnings: aggregate.warnings.length,
    },
  };
}

async function run() {
  invalidateAuditReports([
    contrastReportPath,
    matrixReportPath,
    errorReportPath,
    path.join(a11yDir, 'measure-contrast-v2.json'),
    path.join(a11yDir, 'summary.json'),
  ]);
   ensurePrivateAuditDirectory(a11yDir);
  const baseUrl = getAuditBaseUrl();
  const storageState = loadAuditStorageState(auditStorageStatePath(), baseUrl);
  const browser = await chromium.launch({
    headless: true,
  });
  const summary = {};

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

    for (const route of ROUTES) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        viewport: { width: 390, height: 844 },
        userAgent: AUDIT_USER_AGENT,
        colorScheme: 'dark',
        deviceScaleFactor: 1,
        locale: 'fr-FR',
        storageState,
       serviceWorkers: 'block',
      });
      await context.addCookies([getAdventureCookie(baseUrl)]);
      const page = await context.newPage();
      const routeExpectation = routeExpectationFor(route.path);
      const diagnostics = attachPageDiagnostics(page, {
        baseUrl,
        expected404Path: routeExpectation?.kind === 'http' ? route.path : undefined,
      });
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
         const navigation = await assertRouteNavigation(page, baseUrl, route.path);
         await page.waitForTimeout(600);
         const settledNavigation = assessCurrentRouteNavigation(page, baseUrl, route.path, navigation.httpStatus);
         if (settledNavigation.finalPath !== navigation.finalPath
           || settledNavigation.expected !== navigation.expected
           || settledNavigation.status !== navigation.status) {
           throw new Error('La route a changé après le chargement initial');
         }
          const canonicalState = await readCanonicalMeasurementState(page);
          if (canonicalState.scrollY !== 0 || canonicalState.overlayOpen) {
            throw new Error('État de contraste non canonical');
          }
          diagnostics.assertClean();
          const warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
         if (navigation.expected) {
          summary[route.id] = {
            id: route.id,
            path: route.path,
            measured: false,
            expected: true,
            status: navigation.reason === 'missing_admin_role' ? 'admin_redirected' : navigation.status,
            reason: navigation.reason,
            finalPath: navigation.finalPath,
            expectedFinalPath: navigation.expectedFinalPath,
            httpStatus: navigation.httpStatus,
            warnings,
            degraded: warnings.length > 0,
            nodes: [],
            counts: { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 },
            axe: { violations: [], incomplete: [] },
          };
          continue;
         }
         const rendered = await readRenderedAuditSettings(page);
        assertRenderedAuditSettings({
          requestedTheme: 'dark',
          requestedIntensity: 0.5,
          actualTheme: rendered.theme,
          actualIntensity: rendered.intensity,
        });
        const textElements = await extractTextElements(page);
        const axeResults = await new AxeBuilder({ page })
          .include('[data-audit-id]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
         const contrast = await measurePageContrast(page, axeResults, { textElements });
         if (contrast.nodes.length === 0) throw new Error('Aucun nœud texte mesuré');
         const finalNavigation = assessCurrentRouteNavigation(page, baseUrl, route.path, navigation.httpStatus);
         if (finalNavigation.finalPath !== navigation.finalPath
           || finalNavigation.expected !== navigation.expected
           || finalNavigation.status !== navigation.status) {
           throw new Error('La route a changé pendant la mesure');
         }
         diagnostics.assertClean();
        const measuredWarnings = diagnostics.warnings.map((entry) => ({ ...entry }));
        const axe = colorContrastRules(axeResults);
        summary[route.id] = {
          id: route.id,
          path: route.path,
          measured: true,
          expected: false,
          status: measuredWarnings.length > 0 ? 'degraded' : 'measured',
          theme: 'dark',
          requestedIntensity: 0.5,
           actualTheme: rendered.theme,
           actualIntensity: rendered.intensity,
           measurementState: 'default',
           scrollY: canonicalState.scrollY,
           overlayOpen: canonicalState.overlayOpen,
           image: contrast.image,
          nodes: contrast.nodes,
          axe,
          axeNodeCounts: {
            violations: collectColorContrastAxeNodes(axeResults).violations.length,
            incomplete: collectColorContrastAxeNodes(axeResults).incomplete.length,
          },
          warnings: measuredWarnings,
          degraded: measuredWarnings.length > 0,
        };
        summary[route.id].counts = countNodes(contrast.nodes);
      } catch (error) {
        const message = redactDiagnosticText(error instanceof Error ? error.message : String(error));
        const warnings = diagnostics.warnings.map((entry) => ({ ...entry }));
        summary[route.id] = {
          id: route.id,
          path: route.path,
          measured: false,
          error: message,
          warnings,
          degraded: warnings.length > 0,
        };
      } finally {
        diagnostics.dispose();
         await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  const aggregate = summarizeFullContrastEvidence(summary, ROUTES);
  const measured = aggregate.measured;
  const errors = aggregate.errors;
  const warnings = aggregate.warnings;
  const totals = aggregate.totals;
  const completedRouteCount = aggregate.completedRouteCount;
  const coverageComplete = aggregate.coverageComplete;
  const verificationStatus = auditVerificationStatus({
     liveVerified: errors.length === 0
       && warnings.length === 0
       && coverageComplete
       && totals.unknown === 0
       && totals.occluded === 0,
    coverageComplete,
    errors: errors.map((entry) => entry.error),
  });

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    verificationStatus,
    expectedRoutes: ROUTES.length,
    expectedMeasuredRouteCount: aggregate.expectedMeasuredRouteCount,
    completedRouteCount,
    coverageComplete,
    measuredRoutes: measured.length,
    totals,
    errors,
    warnings,
    routes: summary,
  };
  if (errors.length > 0 || verificationStatus !== 'VERIFIED') {
    const error = new Error(`Audit de contraste non vérifié (${verificationStatus}); ${errors.length} erreur(s), ${warnings.length} warning(s)`);
    writeAuditErrorReport(errorReportPath, error, {
      verificationStatus,
      coverageComplete,
      completedRouteCount,
      totals,
      errors,
      warnings,
    });
    throw error;
  }
  const safeReport = redactRuntimeValue(report);
  writePrivateAuditFile(path.join(a11yDir, 'measure-contrast-v2.json'), `${JSON.stringify(safeReport, null, 2)}\n`);
  writePrivateAuditFile(path.join(a11yDir, 'summary.json'), `${JSON.stringify(redactRuntimeValue(summary), null, 2)}\n`);
  writePrivateAuditFile(matrixReportPath, `${JSON.stringify(safeReport, null, 2)}\n`);
  writePrivateAuditFile(contrastReportPath, buildContrastMarkdown(Object.values(redactRuntimeValue(summary)), totals, verificationStatus));


  console.info(`Mesure terminée: ${measured.length}/${ROUTES.length} routes, ${totals.pass} pass, ${totals.contrast_fail} contrast_fail, ${totals.unknown} unknown, ${totals.occluded} occluded.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(redactDiagnosticText(error instanceof Error ? error.message : error));
    process.exit(1);
  });
}
