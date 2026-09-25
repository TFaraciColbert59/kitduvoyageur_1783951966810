import { safeAuditUrl } from './audit_runtime.mjs';

export const CONTRAST_STATES = Object.freeze({
  PASS: 'pass',
  CONTRAST_FAIL: 'contrast_fail',
  UNKNOWN: 'unknown',
  OCCLUDED: 'occluded',
  ERROR: 'error',
});

export const EXPECTED_MATRIX_CELL_COUNT = 60;
export const GLASS_INTENSITIES = Object.freeze([0.2, 0.5, 0.85]);
export const AUDIT_THEMES = Object.freeze(['light', 'dark']);
export const KEY_SCREEN_ROUTES = Object.freeze([
  { id: 'accueil', path: '/' },
  { id: 'hub', path: '/hub' },
  { id: 'explorer', path: '/explorer' },
  { id: 'carte-interactive', path: '/carte-interactive' },
  { id: 'materiel', path: '/materiel' },
  { id: 'kits', path: '/kits' },
  { id: 'compte', path: '/compte' },
  { id: 'compte-parametres', path: '/compte?tab=parametres' },
  { id: 'communaute', path: '/communaute' },
  { id: 'boutique', path: '/boutique' },
]);

const REQUIRED_EXPECTED_OUTCOME_PATHS = new Set([
  '/preparer-randonnee',
  '/admin',
  '/admin/produits',
  '/dev/glass',
  '/dev/style',
  '/route-inexistante-pour-tester-404',
]);

export function auditModeRequiresAuth(args = []) {
  const modes = Array.isArray(args) ? new Set(args) : new Set();
  if (modes.has('--anon-only') && !modes.has('--auth-only')) return false;
  return true;
}

export function captureStatusForRoute(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const authVerified = Reflect.get(source, 'authVerified') === true;
  const requiresAuth = Reflect.get(source, 'requiresAuth') === true;
  const errors = Reflect.get(source, 'errors');
  if (requiresAuth && !authVerified) {
    return 'PARTIAL / NOT VERIFIED';
  }
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors);
  if (!authVerified || hasErrors) {
    return 'PARTIAL / NOT VERIFIED';
  }
  return 'OK';
}

export function auditVerificationStatus(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const liveVerified = Reflect.get(source, 'liveVerified') === true;
  const coverageComplete = Reflect.get(source, 'coverageComplete');
  const errors = Reflect.get(source, 'errors');
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors);
  return !liveVerified || coverageComplete !== true || hasErrors
    ? 'PARTIAL / NOT VERIFIED'
    : 'VERIFIED';
}

function routeName(route) {
  if (typeof route === 'string') return route;
  return route?.name ?? route?.route ?? null;
}

export function buildAuditCoverage(expectedRoutes = [], observedRoutes = []) {
  const expected = Array.isArray(expectedRoutes) ? expectedRoutes : [];
  const observed = new Set(
    (Array.isArray(observedRoutes) ? observedRoutes : []).map(routeName).filter(Boolean)
  );
  const normalizedExpected = expected.map((route) => (
    typeof route === 'string'
      ? { name: route, path: route, auth: false }
      : { ...route }
  ));
  const missingRoutes = normalizedExpected.filter((route) => (
    !route.path || !observed.has(routeName(route))
  ));
  return {
    expectedRoutes: normalizedExpected,
    missingRoutes,
    coverageComplete: missingRoutes.length === 0,
  };
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function numericToken(value) {
  const text = String(value).trim();
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(text) ? text : null;
}

function parseAlpha(value) {
  if (value === undefined || value === null || value === '') return 1;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  }
  const text = numericToken(value);
  if (text === null) return null;
  if (text.endsWith('%')) {
    const percentage = Number.parseFloat(text.slice(0, -1));
    return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
      ? percentage / 100
      : null;
  }
  const alpha = Number.parseFloat(text);
  return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : null;
}

function parseChannel(value, scale) {
  const text = numericToken(value);
  if (text === null || text.endsWith('%')) return null;
  const number = Number.parseFloat(text);
  return Number.isFinite(number) && number >= 0 && number <= scale ? number : null;
}

export function parseCssColor(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const rgb = normalized.match(/^rgba?\(\s*([^,\s/]+)(?:[\s,]+)([^,\s/]+)(?:[\s,]+)([^,\s/]+)(?:\s*(?:,|\/)\s*([^\s)]+))?\s*\)$/);
  if (rgb) {
    const r = parseChannel(rgb[1], 255);
    const g = parseChannel(rgb[2], 255);
    const b = parseChannel(rgb[3], 255);
    const a = parseAlpha(rgb[4]);
    return r === null || g === null || b === null || a === null ? null : { r, g, b, a };
  }

  const srgb = normalized.match(/^color\(srgb\s+([^\s/]+)\s+([^\s/]+)\s+([^\s/]+)(?:\s*\/\s*([^\s)]+))?\s*\)$/);
  if (srgb) {
    const r = parseChannel(srgb[1], 1);
    const g = parseChannel(srgb[2], 1);
    const b = parseChannel(srgb[3], 1);
    const a = parseAlpha(srgb[4]);
    return r === null || g === null || b === null || a === null
      ? null
      : { r: r * 255, g: g * 255, b: b * 255, a };
  }

  return null;
}

export function parseStrictNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function clippedRectangle(rect, viewport) {
  if (!rect || !finiteNumber(rect.x) || !finiteNumber(rect.y) || !finiteNumber(rect.width) || !finiteNumber(rect.height)) return null;
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(viewport?.width ?? Number.POSITIVE_INFINITY, rect.x + rect.width);
  const bottom = Math.min(viewport?.height ?? Number.POSITIVE_INFINITY, rect.y + rect.height);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

export function rectanglesIntersect(first, second, viewport) {
  const a = clippedRectangle(first, viewport);
  const b = clippedRectangle(second, viewport);
  return Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
}

export function hasFixedOverlayIntersection(textRects, overlays, viewport) {
  if (!Array.isArray(textRects) || !Array.isArray(overlays)) return false;
  return overlays.some((overlay) => {
    if (!overlay || overlay.containsTarget || !Array.isArray(overlay.rects)) return false;
    return textRects.some((textRect) => overlay.rects.some((overlayRect) => rectanglesIntersect(textRect, overlayRect, viewport)));
  });
}

export function ancestorOpacityProduct(ancestorOpacities) {
  if (!Array.isArray(ancestorOpacities)) return null;
  let product = 1;
  for (const value of ancestorOpacities) {
    const opacity = parseAlpha(value);
    if (opacity === null) return null;
    product *= opacity;
  }
  return product;
}

function normalizedColor(color) {
  if (!color || !finiteNumber(color.r) || !finiteNumber(color.g) || !finiteNumber(color.b)) {
    throw new Error('Couleur RGB invalide');
  }
  return {
    r: clamp(color.r, 0, 255),
    g: clamp(color.g, 0, 255),
    b: clamp(color.b, 0, 255),
  };
}

export function compositeTextColor({ color, ancestorOpacities, background }) {
  const parsed = parseCssColor(color);
  const opacityProduct = ancestorOpacityProduct(ancestorOpacities);
  if (!parsed || opacityProduct === null) throw new Error('Couleur ou opacité non analysable');
  const backdrop = normalizedColor(background);
  const alpha = parsed.a * opacityProduct;
  return {
    r: parsed.r * alpha + backdrop.r * (1 - alpha),
    g: parsed.g * alpha + backdrop.g * (1 - alpha),
    b: parsed.b * alpha + backdrop.b * (1 - alpha),
    a: alpha,
  };
}

export function srgbToLinear(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color) {
  const rgb = normalizedColor(color);
  return 0.2126 * srgbToLinear(rgb.r)
    + 0.7152 * srgbToLinear(rgb.g)
    + 0.0722 * srgbToLinear(rgb.b);
}

export function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function requiredContrastRatio(isLarge) {
  return isLarge ? 3 : 4.5;
}

export function meetsContrastThreshold(ratio, isLarge) {
  return finiteNumber(ratio) && ratio >= requiredContrastRatio(isLarge);
}

function unknownContrast(textColor = null) {
  return {
    status: CONTRAST_STATES.UNKNOWN,
    ratio: null,
    threshold: null,
    textColor,
    effectiveTextColor: null,
    worstBackground: null,
  };
}

export function classifyContrast({ color, ancestorOpacities, background, isLarge, occluded }) {
  if (occluded) {
    return {
      status: CONTRAST_STATES.OCCLUDED,
      ratio: null,
      threshold: null,
      textColor: color,
      effectiveTextColor: null,
      worstBackground: null,
    };
  }

  let effective;
  try {
    effective = compositeTextColor({ color, ancestorOpacities, background });
  } catch {
    return unknownContrast(color);
  }

  if (effective.a <= 0) return unknownContrast(color);

  const ratio = contrastRatio(effective, background);
  const threshold = requiredContrastRatio(isLarge);
  return {
    status: ratio < threshold ? CONTRAST_STATES.CONTRAST_FAIL : CONTRAST_STATES.PASS,
    ratio,
    threshold,
    textColor: color,
    effectiveTextColor: `rgb(${effective.r}, ${effective.g}, ${effective.b})`,
    worstBackground: normalizedColor(background),
  };
}

function pixelAt(data, info, x, y) {
  const channels = info.channels;
  const offset = (y * info.width + x) * channels;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
  };
}

function classifyWorstPixel(parsed, opacityProduct, background, isLarge, color) {
  const alpha = parsed.a * opacityProduct;
  if (alpha <= 0) return unknownContrast(color);
  const effective = {
    r: parsed.r * alpha + background.r * (1 - alpha),
    g: parsed.g * alpha + background.g * (1 - alpha),
    b: parsed.b * alpha + background.b * (1 - alpha),
  };
  const ratio = contrastRatio(effective, background);
  const threshold = requiredContrastRatio(isLarge);
  return {
    status: ratio < threshold ? CONTRAST_STATES.CONTRAST_FAIL : CONTRAST_STATES.PASS,
    ratio,
    threshold,
    textColor: color,
    effectiveTextColor: `rgb(${effective.r}, ${effective.g}, ${effective.b})`,
    worstBackground: background,
  };
}

export function analyzeDecodedPixels({ data, info, textElements }) {
  if (!(data instanceof Uint8Array) || !info || !Array.isArray(textElements)) {
    throw new Error('Pixels ou métadonnées invalides');
  }

  return textElements.map((element) => {
    const base = {
      id: element.id,
      ...(element.dataAuditId ? { dataAuditId: element.dataAuditId } : {}),
      selector: element.selector,
      text: element.text,
      rectCount: Array.isArray(element.rects) ? element.rects.length : 0,
    };

    if (element.occluded) {
      return {
        ...base,
        status: CONTRAST_STATES.OCCLUDED,
        ratio: null,
        threshold: null,
        textColor: element.color,
        effectiveTextColor: null,
        worstBackground: null,
      };
    }

    const parsed = parseCssColor(element.color);
    const opacityProduct = ancestorOpacityProduct(element.ancestorOpacities);
    if (!parsed || opacityProduct === null || !Array.isArray(element.rects)) {
      return { ...base, ...unknownContrast(element.color) };
    }

    let worst = null;
    for (const rect of element.rects) {
      if (!rect || !finiteNumber(rect.x) || !finiteNumber(rect.y) || !finiteNumber(rect.width) || !finiteNumber(rect.height)) {
        continue;
      }
      const left = Math.max(0, Math.floor(rect.x));
      const top = Math.max(0, Math.floor(rect.y));
      const right = Math.min(info.width, Math.ceil(rect.x + rect.width));
      const bottom = Math.min(info.height, Math.ceil(rect.y + rect.height));
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const background = pixelAt(data, info, x, y);
          const result = classifyWorstPixel(parsed, opacityProduct, background, element.isLarge, element.color);
          if (!worst || (result.ratio !== null && result.ratio < worst.ratio)) worst = result;
        }
      }
    }

    return { ...base, ...(worst || unknownContrast(element.color)) };
  });
}

export function collectColorContrastAxeNodes(axeResults) {
  const rulesOf = (collection) => (Array.isArray(collection) ? collection : [])
    .filter((rule) => rule && rule.id === 'color-contrast');

  return {
    violations: rulesOf(axeResults?.violations).flatMap((rule) => (rule.nodes || []).map((node) => ({
      ruleId: rule.id,
      impact: rule.impact,
      help: rule.help,
      helpUrl: rule.helpUrl,
      node,
    }))),
    incomplete: rulesOf(axeResults?.incomplete).flatMap((rule) => (rule.nodes || []).map((node) => ({
      ruleId: rule.id,
      impact: rule.impact,
      help: rule.help,
      helpUrl: rule.helpUrl,
      node,
    }))),
  };
}

function targetValues(node) {
  const targets = Array.isArray(node?.target) ? node.target : [];
  return targets.map((target) => Array.isArray(target) ? target.join(' ') : String(target));
}

function dataAuditIdFromTargets(node) {
  for (const target of targetValues(node)) {
    const match = target.match(/\[data-audit-id(?:=|~=)\s*["']?([^"'\\\s\]]+)/);
    if (match) return match[1];
  }
  const html = typeof node?.html === 'string' ? node.html : '';
  const htmlMatch = html.match(/data-audit-id\s*=\s*["']([^"']+)["']/i);
  return htmlMatch ? htmlMatch[1] : null;
}

function nodeMatchesMeasurement(node, measurement) {
  const targets = targetValues(node);
  const auditId = dataAuditIdFromTargets(node);
  if (measurement.dataAuditId && auditId) return auditId === measurement.dataAuditId;
  const selector = measurement.selector || '';
  const id = measurement.id || '';
  return targets.some((target) => target === selector || target === id);
}

function mergeAxeEvidence(measurements, entries, forcedStatus, prefix) {
  const merged = measurements.map((measurement) => ({ ...measurement }));
  entries.forEach((entry, index) => {
    const matchIndex = merged.findIndex((measurement) => nodeMatchesMeasurement(entry.node, measurement));
    if (matchIndex >= 0) {
       const current = merged[matchIndex];
       const measuredFailure = (current.status === CONTRAST_STATES.CONTRAST_FAIL
         || forcedStatus === CONTRAST_STATES.CONTRAST_FAIL)
         && Number.isFinite(current.ratio)
         && [3, 4.5].includes(current.threshold)
         && current.ratio < current.threshold;
       const status = current.status === CONTRAST_STATES.OCCLUDED
         ? CONTRAST_STATES.OCCLUDED
         : measuredFailure
           ? CONTRAST_STATES.CONTRAST_FAIL
           : CONTRAST_STATES.UNKNOWN;
       merged[matchIndex] = {
         ...current,
         status,
         ratio: status === CONTRAST_STATES.CONTRAST_FAIL ? current.ratio : null,
         threshold: status === CONTRAST_STATES.CONTRAST_FAIL ? current.threshold : null,
         dataAuditId: dataAuditIdFromTargets(entry.node) || current.dataAuditId || null,
         axeTarget: targetValues(entry.node),
         axeFailureSummary: entry.node?.failureSummary || null,
       };
      return;
    }
     merged.push({
       id: `${prefix}-${index}`,
       selector: targetValues(entry.node).join(', '),
       text: entry.node?.html || '',
       status: CONTRAST_STATES.UNKNOWN,
       ratio: null,
       threshold: null,
       dataAuditId: dataAuditIdFromTargets(entry.node),
      axeTarget: targetValues(entry.node),
      axeFailureSummary: entry.node?.failureSummary || null,
    });
  });
  return merged;
}

export function mergeAxeContrastEvidence(measurements, axeResults) {
  const collected = collectColorContrastAxeNodes(axeResults);
  const withViolations = mergeAxeEvidence(
    Array.isArray(measurements) ? measurements : [],
    collected.violations,
    CONTRAST_STATES.CONTRAST_FAIL,
    'axe-violation',
  );
  return mergeAxeEvidence(
    withViolations,
    collected.incomplete,
    CONTRAST_STATES.UNKNOWN,
    'axe-incomplete',
  );
}

export function matrixCellKey(cell) {
  const source = cell && typeof cell === 'object' ? cell : {};
  return `${source.routeId ?? ''}|${source.path ?? ''}|${source.theme ?? ''}|${source.intensity ?? ''}`;
}

export function buildMatrixCells() {
  return KEY_SCREEN_ROUTES.flatMap((route) => AUDIT_THEMES.flatMap((theme) => (
    GLASS_INTENSITIES.map((intensity) => ({
      routeId: route.id,
      path: route.path,
      theme,
      intensity,
    }))
  )));
}

function emptyCounts() {
  return {
    pass: 0,
    contrast_fail: 0,
    unknown: 0,
    occluded: 0,
    error: 0,
  };
}

export function countContrastNodes(nodes = []) {
  const counts = {
    pass: 0,
    contrast_fail: 0,
    unknown: 0,
    occluded: 0,
  };
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const status = Object.hasOwn(counts, node?.status) ? node.status : CONTRAST_STATES.UNKNOWN;
    counts[status] += 1;
  }
  return counts;
}

function validContrastNode(node) {
  return node
    && typeof node === 'object'
    && typeof node.id === 'string'
    && node.id.trim().length > 0
    && typeof node.status === 'string'
    && ['pass', 'contrast_fail', 'unknown', 'occluded'].includes(node.status)
    && (typeof node.selector === 'string' || typeof node.dataAuditId === 'string')
    && Object.hasOwn(node, 'ratio')
    && (node.ratio === null || finiteNumber(node.ratio));
}

export function hasContrastEvidence(entry) {
  if (entry?.measured !== true || !Array.isArray(entry.nodes) || entry.nodes.length === 0) return false;
  const identities = new Set();
  return entry.nodes.every((node) => {
    if (!validContrastNode(node) || identities.has(node.id)) return false;
    identities.add(node.id);
    return true;
  });
}

function semanticallyValidContrastNode(node) {
  const validThreshold = node.threshold === 3 || node.threshold === 4.5;
  if (node.status === 'pass') return validThreshold && Number.isFinite(node.ratio) && node.ratio >= node.threshold && node.ratio <= 21;
  if (node.status === 'contrast_fail') return validThreshold && Number.isFinite(node.ratio) && node.ratio >= 1 && node.ratio < node.threshold;
  return node.ratio === null && node.threshold === null;
}

export function hasValidContrastEvidence(entry) {
  return hasContrastEvidence(entry) && entry.nodes.every(semanticallyValidContrastNode);
}

function findingIdentity(finding) {
  return finding?.routeId ?? null;
}

function normalizedContrastFinding(finding) {
  return {
    ...finding,
    counts: hasValidContrastEvidence(finding)
      ? countContrastNodes(finding.nodes)
      : { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 },
  };
}

function expectedOutcomeMatches(outcome, definition) {
  if (!outcome || !definition || outcome.expected !== true || outcome.measured !== false) return false;
  if (outcome.routeId !== definition.routeId || outcome.path !== definition.path) return false;
  if (definition.kind === 'redirect') {
    const expectedStatus = definition.reason === 'missing_admin_role'
      ? 'admin_redirected'
      : 'expected_redirect';
    return outcome.status === expectedStatus
      && outcome.reason === definition.reason
      && outcome.finalPath === definition.finalPath
      && outcome.expectedFinalPath === definition.finalPath
      && Number.isInteger(outcome.httpStatus)
      && outcome.httpStatus >= 200
      && outcome.httpStatus < 400;
  }
  if (definition.kind === 'http') {
    if (!Number.isInteger(definition.status) || definition.status < 100 || definition.status > 599) return false;
    return outcome.status === 'expected_404'
      && outcome.reason === definition.reason
      && outcome.finalPath === definition.path
      && outcome.expectedFinalPath === null
      && outcome.httpStatus === definition.status;
  }
  return false;
}

function exactStringSet(expected, observed) {
  if (!Array.isArray(expected) || !Array.isArray(observed)) return false;
  const expectedSet = new Set(expected);
  const observedSet = new Set(observed);
  return expectedSet.size === expected.length
    && observedSet.size === observed.length
    && expectedSet.size === observedSet.size
    && [...expectedSet].every((value) => observedSet.has(value));
}

export function aggregateContrastMatrix(cells, expectedCells = buildMatrixCells()) {
  if (!Array.isArray(cells) || !Array.isArray(expectedCells)) {
    throw new Error('Matrice de contraste invalide');
  }
  if (cells.length !== expectedCells.length) {
    throw new Error(`Matrice incomplète: ${cells.length}/${expectedCells.length} cellules`);
  }

  const expectedKeys = new Set(expectedCells.map(matrixCellKey));
  const actualKeys = new Set();
  const missing = [];
  for (const cell of cells) {
    const key = matrixCellKey(cell);
    if (!expectedKeys.has(key)) throw new Error(`Cellule inattendue: ${key}`);
    if (actualKeys.has(key)) throw new Error(`Cellule dupliquée: ${key}`);
    actualKeys.add(key);
  }
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) missing.push(key);
  }
  if (missing.length > 0) throw new Error(`Cellule manquante: ${missing.join(', ')}`);

  const totals = { ...emptyCounts(), nodes: 0 };
  const summaries = cells.map((cell) => {
    const counts = emptyCounts();
    const nodes = Array.isArray(cell.nodes) ? cell.nodes : [];
    for (const node of nodes) {
      const status = Object.hasOwn(counts, node.status) ? node.status : CONTRAST_STATES.UNKNOWN;
      counts[status] += 1;
    }
    if (cell.error) counts.error += 1;
    totals.pass += counts.pass;
    totals.contrast_fail += counts.contrast_fail;
    totals.unknown += counts.unknown;
    totals.occluded += counts.occluded;
    totals.error += counts.error;
    totals.nodes += nodes.length;
    return {
      key: matrixCellKey(cell),
      routeId: cell.routeId,
      path: cell.path,
      theme: cell.theme,
      requestedIntensity: cell.intensity,
      actualTheme: cell.actualTheme ?? null,
      actualIntensity: cell.actualIntensity ?? null,
      nodeCount: nodes.length,
      counts,
      passRate: nodes.length === 0 ? 0 : (counts.pass / nodes.length) * 100,
      error: cell.error || null,
      axe: cell.axe || { violations: [], incomplete: [] },
      nodes,
    };
  });

  return {
    cellCount: summaries.length,
    cells: summaries,
    totals,
    weightedPassRate: totals.error > 0 || totals.nodes === 0 ? 0 : (totals.pass / totals.nodes) * 100,
  };
}

export function buildMatrixAuditReport(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const cells = Reflect.get(source, 'cells');
  const expectedCells = Reflect.get(source, 'expectedCells');
  const requestedCellCount = Reflect.get(source, 'expectedCellCount');
  const expectedCellCount = Number.isInteger(requestedCellCount)
    ? requestedCellCount
    : EXPECTED_MATRIX_CELL_COUNT;
  const liveVerified = Reflect.get(source, 'liveVerified') === true;
  const stateEvidenceComplete = Reflect.get(source, 'stateEvidenceComplete') !== false;
  const errors = Reflect.get(source, 'errors');
     const observedCells = Array.isArray(cells) ? cells : [];
     const expectedMatrixCells = Array.isArray(expectedCells) ? expectedCells : buildMatrixCells();
     const expectedMatrixByKey = new Map(expectedMatrixCells.map((cell) => [matrixCellKey(cell), cell]));
     const metadataComplete = observedCells.every((cell) => {
       const expected = expectedMatrixByKey.get(matrixCellKey(cell));
       return Boolean(expected)
         && cell?.path === expected.path
         && cell?.finalPath === expected.path
         && Number.isInteger(cell?.httpStatus)
         && cell.httpStatus >= 200
         && cell.httpStatus < 300
         && cell?.actualTheme === expected.theme
         && Number(cell?.actualIntensity) === Number(expected.intensity)
         && cell?.measurementState === 'default'
         && cell?.scrollY === 0
         && cell?.overlayOpen === false;
     });
     const aggregate = aggregateContrastMatrix(cells, expectedCells);
     const measuredCellCount = observedCells.filter((cell) => hasValidContrastEvidence(cell)).length;
   const warningCellCount = observedCells.filter((cell) => (
     cell?.degraded === true
     || (Array.isArray(cell.warnings) && cell.warnings.length > 0)
   )).length;
   const evidenceComplete = aggregate.totals.unknown === 0
     && aggregate.totals.occluded === 0;
     const coverageComplete = observedCells.length === expectedCellCount
       && measuredCellCount === expectedCellCount
       && metadataComplete
       && stateEvidenceComplete
       && warningCellCount === 0
     && evidenceComplete
     && observedCells.every((cell) => !cell.error);
   const liveEvidence = coverageComplete && aggregate.totals.error === 0;
   return {
     ...aggregate,
     expectedCellCount,
     measuredCellCount,
     warningCellCount,
       coverageComplete,
       metadataComplete,
       liveEvidence,
     verificationStatus: auditVerificationStatus({
       liveVerified: liveVerified && liveEvidence,
       coverageComplete,
       errors,
     }),
   };
}

export function buildCampaignAuditReport(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const findings = Reflect.get(source, 'findings');
  const errors = Reflect.get(source, 'errors');
  const expectedRouteCount = Reflect.get(source, 'expectedRouteCount') ?? null;
  const expectedRouteIds = Reflect.get(source, 'expectedRouteIds');
  const expectedRoutePaths = Reflect.get(source, 'expectedRoutePaths');
  const expectedOutcomes = Reflect.get(source, 'expectedOutcomes');
  const expectedOutcomeDefinitions = Reflect.get(source, 'expectedOutcomeDefinitions');
  const manifestCoverageComplete = Reflect.get(source, 'manifestCoverageComplete') === true;
  const stateEvidenceComplete = Reflect.get(source, 'stateEvidenceComplete') !== false;
  const liveVerified = Reflect.get(source, 'liveVerified') === true;
  const requestedGeneratedAt = Reflect.get(source, 'generatedAt');
  const generatedAt = typeof requestedGeneratedAt === 'string'
    ? requestedGeneratedAt
    : new Date().toISOString();
  const safeFindings = Array.isArray(findings) ? findings : [];
  const safeErrors = Array.isArray(errors) ? errors : [];
  const safeExpectedOutcomes = Array.isArray(expectedOutcomes) ? expectedOutcomes : [];
  const safeExpectedDefinitions = Array.isArray(expectedOutcomeDefinitions)
    ? expectedOutcomeDefinitions
    : [];
  const safeExpectedRouteIds = Array.isArray(expectedRouteIds) ? expectedRouteIds : [];
  const safeExpectedRoutePaths = Array.isArray(expectedRoutePaths) ? expectedRoutePaths : [];
  const expectedRouteSet = new Set(safeExpectedRouteIds);
  const expectedRoutePathMap = new Map(
    safeExpectedRoutePaths.map((route) => [route?.routeId, route?.path]),
  );
  const expectedOutcomeMap = new Map(
    safeExpectedOutcomes.map((outcome) => [outcome?.routeId, outcome]),
  );
  const requiredOutcomeRouteIds = new Set(
    safeExpectedRoutePaths
      .filter((route) => REQUIRED_EXPECTED_OUTCOME_PATHS.has(route?.path))
      .map((route) => route.routeId),
  );
  const expectedRouteSetComplete = safeExpectedRouteIds.length > 0
    && expectedRouteSet.size === safeExpectedRouteIds.length
    && expectedRoutePathMap.size === safeExpectedRouteIds.length
    && safeExpectedRouteIds.every((routeId) => (
      typeof routeId === 'string'
      && routeId.length > 0
      && typeof expectedRoutePathMap.get(routeId) === 'string'
      && expectedRoutePathMap.get(routeId).length > 0
    ))
    && (expectedRouteCount === null || expectedRouteSet.size === expectedRouteCount);
  const requiredDefinitionsPresent = [...requiredOutcomeRouteIds].every((routeId) => (
    safeExpectedDefinitions.some((definition) => definition?.routeId === routeId)
    && expectedOutcomeMap.has(routeId)
  ));
  const expectedOutcomesComplete = requiredDefinitionsPresent
    && safeExpectedDefinitions.length === safeExpectedOutcomes.length
    && safeExpectedDefinitions.every((definition) => {
      const outcome = expectedOutcomeMap.get(definition?.routeId);
      return expectedRouteSet.has(definition?.routeId)
        && expectedRoutePathMap.get(definition?.routeId) === definition?.path
        && expectedOutcomeMatches(outcome, definition);
    })
    && expectedOutcomeMap.size === safeExpectedOutcomes.length;
  const contrastFindings = safeFindings.filter((finding) => finding?.expected !== true);
  const findingIdentities = contrastFindings.map(findingIdentity);
  const observedMeasuredRouteIds = new Set(findingIdentities);
  const observedRouteIds = new Set([
    ...observedMeasuredRouteIds,
    ...safeExpectedOutcomes.map((outcome) => outcome?.routeId),
  ]);
  const routeSetComplete = expectedRouteSetComplete
    && observedRouteIds.size === expectedRouteSet.size
    && [...expectedRouteSet].every((routeId) => observedRouteIds.has(routeId));
   const evidenceComplete = stateEvidenceComplete
     && contrastFindings.length > 0
     && findingIdentities.every(Boolean)
    && observedMeasuredRouteIds.size === contrastFindings.length
     && contrastFindings.every((finding) => hasValidContrastEvidence(finding));
  const contrastRouteSetComplete = contrastFindings.every((finding) => (
    expectedRoutePathMap.get(findingIdentity(finding)) === finding?.path
  ));
  const expectedMeasuredRouteCount = expectedRouteSetComplete
    ? [...expectedRouteSet].filter((routeId) => !expectedOutcomeMap.has(routeId)).length
    : null;
  const coverageComplete = routeSetComplete
    && expectedOutcomesComplete
    && evidenceComplete
    && contrastRouteSetComplete
    && manifestCoverageComplete
    && (expectedMeasuredRouteCount === null
      || observedMeasuredRouteIds.size === expectedMeasuredRouteCount);
  const normalizedFindings = safeFindings.map(normalizedContrastFinding);
  const totals = contrastFindings.reduce((result, finding) => {
    if (!hasValidContrastEvidence(finding)) return result;
    const counts = countContrastNodes(finding.nodes);
    for (const status of ['pass', 'contrast_fail', 'unknown', 'occluded']) {
      result[status] += counts[status];
    }
    return result;
  }, { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 });
  const nodeCount = totals.pass + totals.contrast_fail + totals.unknown + totals.occluded;
  const weightedPassRate = safeErrors.length > 0 || nodeCount === 0
    ? 0
    : (totals.pass / nodeCount) * 100;
  const liveEvidence = routeSetComplete
     && expectedOutcomesComplete
     && evidenceComplete
     && contrastRouteSetComplete
     && manifestCoverageComplete
     && nodeCount > 0
    && totals.unknown === 0
    && totals.occluded === 0;
  return {
    generatedAt,
    verificationStatus: auditVerificationStatus({
      liveVerified: liveVerified && coverageComplete && liveEvidence,
      coverageComplete,
      errors: safeErrors,
    }),
     expectedRouteCount,
     expectedRouteIds: safeExpectedRouteIds,
     expectedRoutePaths: safeExpectedRoutePaths,
     expectedOutcomeCount: safeExpectedOutcomes.length,
    expectedMeasuredRouteCount,
    expectedOutcomes: safeExpectedOutcomes,
    expectedOutcomeDefinitions: safeExpectedDefinitions,
    completedRouteCount: observedRouteIds.size,
    observedCompletedRouteCount: observedRouteIds.size,
    measuredRouteCount: observedMeasuredRouteIds.size,
    manifestCoverageComplete,
     routeSetComplete,
     contrastRouteSetComplete,
     expectedOutcomesComplete,
     coverageComplete,
    liveEvidence,
    totals,
    weightedPassRate,
    findings: normalizedFindings,
    errors: safeErrors,
  };
}

function displayAuditUrl(value) {
  return safeAuditUrl(value);
}

function originAllowlisted(parsed, env, flag) {
  if (env?.[flag] !== '1') return false;
  const configured = typeof env?.AUDIT_ALLOWED_BASE_URLS === 'string'
    ? env.AUDIT_ALLOWED_BASE_URLS.split(',').map((value) => value.trim()).filter(Boolean)
    : [];
  return configured.some((value) => {
    try {
      const allowed = new URL(value);
      return ['http:', 'https:'].includes(allowed.protocol)
        && allowed.origin === parsed.origin;
    } catch {
      return false;
    }
  });
}

export function getAuditBaseUrl(env = process.env) {
  const raw = typeof env?.PW_BASE_URL === 'string' && env.PW_BASE_URL.trim()
    ? env.PW_BASE_URL.trim()
    : 'http://localhost:3000';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PW_BASE_URL invalide: ${displayAuditUrl(raw)}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`PW_BASE_URL doit être HTTP(S): ${displayAuditUrl(raw)}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`PW_BASE_URL ne doit pas contenir d’identifiants: ${displayAuditUrl(raw)}`);
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`PW_BASE_URL ne doit pas contenir de chemin: ${displayAuditUrl(raw)}`);
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const isLoopback = loopbackHosts.has(parsed.hostname.toLowerCase());
  if (parsed.protocol === 'http:' && !isLoopback) {
    throw new Error(`PW_BASE_URL distant doit utiliser HTTPS: ${displayAuditUrl(raw)}`);
  }
  const isDefaultLocal = parsed.origin === 'http://localhost:3000'
    || parsed.origin === 'http://127.0.0.1:3000';
  const localAlternateAllowed = isLoopback
    && originAllowlisted(parsed, env, 'AUDIT_ALLOW_LOCAL_BASE_URL');
  const remoteAllowed = !isLoopback
    && originAllowlisted(parsed, env, 'AUDIT_ALLOW_REMOTE_BASE_URL');
  if (!isDefaultLocal && !localAlternateAllowed && !remoteAllowed) {
    throw new Error(`PW_BASE_URL non autorisé: ${displayAuditUrl(raw)}`);
  }
  return parsed.origin;
}

export function getAuditCredentials(env = process.env) {
  const email = typeof env?.AUDIT_EMAIL === 'string' ? env.AUDIT_EMAIL.trim() : '';
  const password = typeof env?.AUDIT_PASSWORD === 'string' ? env.AUDIT_PASSWORD : '';
  if (!email) throw new Error('AUDIT_EMAIL est requis');
  if (!password) throw new Error('AUDIT_PASSWORD est requis');
  return { email, password };
}

function storageValidationOptions(nowOrOptions, expectedBaseUrl) {
  let now = Date.now();
  let baseUrl = expectedBaseUrl;
  if (finiteNumber(nowOrOptions)) now = nowOrOptions;
  if (nowOrOptions && typeof nowOrOptions === 'object') {
    now = finiteNumber(nowOrOptions.now) ? nowOrOptions.now : Date.now();
    baseUrl = nowOrOptions.baseUrl ?? baseUrl;
  }
  return { now, baseUrl };
}

function sessionExpiry(value) {
  if (!value || typeof value !== 'object') return null;
  const expiresAt = value.expires_at ?? value.expiresAt;
  const numeric = typeof expiresAt === 'string' ? Number(expiresAt) : expiresAt;
  return finiteNumber(numeric) ? numeric * 1000 : null;
}

function isAuthName(name) {
  return typeof name === 'string' && /(?:^|[-.])auth-token(?:\.|$)/i.test(name);
}

function parseSupabaseSessionValue(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} vide`);
  }
  let serialized = value.trim();
  if (/^base64-/i.test(serialized)) {
    const encoded = serialized.slice('base64-'.length);
    if (!encoded) throw new Error(`${label} vide`);
    try {
      serialized = Buffer.from(encoded, 'base64url').toString('utf8');
    } catch {
      throw new Error(`${label} malformé`);
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    const isOpaqueCookie = label.includes('cookie') && !/^[\[{]/.test(serialized);
    throw new Error(`${label} ${isOpaqueCookie ? 'opaque' : 'malformé'}`);
  }
  if (!parsed || typeof parsed !== 'object'
    || typeof parsed.access_token !== 'string' || parsed.access_token === ''
    || typeof parsed.refresh_token !== 'string' || parsed.refresh_token === '') {
    throw new Error(`${label} malformé`);
  }
  return parsed;
}

function cookieBelongsToHost(cookie, expectedHost) {
  if (!cookie || typeof cookie !== 'object' || typeof cookie.domain !== 'string') return false;
  const normalizedDomain = cookie.domain.toLowerCase().replace(/^\./, '');
  return normalizedDomain === expectedHost.toLowerCase();
}

export function sanitizeStorageState(storageState, baseUrl) {
  if (!storageState || !Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins)) {
    throw new Error('storageState invalide');
  }
  const base = new URL(baseUrl);
  return {
    cookies: storageState.cookies
      .filter((cookie) => !Object.hasOwn(cookie || {}, 'url') && cookieBelongsToHost(cookie, base.hostname))
      .map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      })),
    origins: storageState.origins
      .filter((origin) => origin?.origin === base.origin)
      .map((origin) => ({
        origin: base.origin,
        localStorage: (origin.localStorage || []).map((item) => ({
          name: item.name,
          value: item.value,
        })),
      })),
  };
}

export function validateStorageState(storageState, nowOrOptions = Date.now(), expectedBaseUrl) {
  if (!storageState || !Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins)) {
    throw new Error('storageState invalide');
  }
  const { now, baseUrl } = storageValidationOptions(nowOrOptions, expectedBaseUrl);
  const expectedOrigin = baseUrl ? new URL(baseUrl).origin : null;
  const authCookies = storageState.cookies.filter((cookie) => cookie && isAuthName(cookie.name));
  const authLocalEntries = [];
  const expiries = [];
  let parsedCookieCount = 0;

  if (expectedOrigin && storageState.origins.length === 0) {
    throw new Error('storageState origine absente');
  }

  for (const origin of storageState.origins) {
    if (!origin || typeof origin.origin !== 'string') throw new Error('storageState origine invalide');
    let normalizedOrigin;
    try {
      normalizedOrigin = new URL(origin.origin).origin;
    } catch {
      throw new Error('storageState origine invalide');
    }
    if (expectedOrigin && (origin.origin !== expectedOrigin || normalizedOrigin !== expectedOrigin)) {
      throw new Error('storageState origine incorrecte');
    }
    if (!Array.isArray(origin.localStorage)) throw new Error('storageState localStorage invalide');
    for (const item of origin.localStorage) {
      if (!item || typeof item.name !== 'string' || typeof item.value !== 'string') {
        throw new Error('storageState valeur locale invalide');
      }
      if (!isAuthName(item.name)) continue;
      const value = parseSupabaseSessionValue(item.value, 'storageState localStorage');
      const expiry = sessionExpiry(value);
      if (expiry === null) throw new Error('storageState expiration absente');
      expiries.push(expiry);
      authLocalEntries.push({ name: item.name, value });
    }
  }

  if (expectedOrigin) {
    const expectedHost = new URL(baseUrl).hostname;
    for (const cookie of storageState.cookies) {
      if (Object.hasOwn(cookie || {}, 'url')) throw new Error('storageState cookie URL invalide');
      if (!cookieBelongsToHost(cookie, expectedHost)) {
        throw new Error('storageState origine cookie incorrecte');
      }
    }
  } else {
    for (const cookie of storageState.cookies) {
      if (Object.hasOwn(cookie || {}, 'url')) throw new Error('storageState cookie URL invalide');
    }
  }

  for (const cookie of authCookies) {
    const value = parseSupabaseSessionValue(cookie.value, 'cookie auth');
    parsedCookieCount += 1;
    const cookieExpiry = sessionExpiry(value);
    if (cookieExpiry !== null) expiries.push(cookieExpiry);
    else if (finiteNumber(cookie.expires) && cookie.expires > 0) expiries.push(cookie.expires * 1000);
  }

  if (authCookies.length === 0 && authLocalEntries.length === 0) {
    throw new Error('storageState non authentifié');
  }
  if (expiries.length === 0) {
    throw new Error('storageState expiration absente');
  }
  if (expiries.some((expiry) => expiry <= now)) {
    throw new Error('storageState expiré');
  }
  if (authLocalEntries.length === 0 && parsedCookieCount === 0) {
    throw new Error('storageState non authentifié');
  }

  return true;
}

function normalizedPath(pathname) {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

export function assertAuthenticatedCompte({ baseUrl, finalUrl, status, sentinelVisible }) {
  const base = new URL(baseUrl);
  const final = new URL(finalUrl);
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    throw new Error(`Réponse HTTP invalide pour /compte: ${status}`);
  }
  if (base.username || base.password || final.username || final.password) {
    throw new Error('Identifiants dans URL /compte');
  }
   if (final.origin !== base.origin) throw new Error('URL finale hors origine pour /compte');
   if (final.search || final.hash) throw new Error('Paramètres inattendus dans URL /compte');
   if (normalizedPath(final.pathname) !== '/compte') {
    throw new Error('URL finale inattendue pour /compte');
  }
  if (!sentinelVisible) throw new Error('Sentinelle authentifiée /compte absente');
  return { finalPath: '/compte', status };
}

export function assertRenderedAuditSettings({ requestedTheme, requestedIntensity, actualTheme, actualIntensity }) {
  if (actualTheme !== requestedTheme) {
    throw new Error(`Thème réel ${actualTheme ?? 'inconnu'} au lieu de ${requestedTheme}`);
  }
  if (!finiteNumber(actualIntensity) || Math.abs(actualIntensity - requestedIntensity) > 1e-6) {
    throw new Error(`Intensité réelle ${actualIntensity ?? 'inconnue'} au lieu de ${requestedIntensity}`);
  }
}

export function describeAdminNavigation({ requestedPath = '/admin', finalUrl, status }) {
  const final = new URL(finalUrl);
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    throw new Error(`Réponse HTTP invalide pour ${requestedPath}: ${status}`);
  }
  const finalPath = normalizedPath(final.pathname);
  const requested = normalizedPath(requestedPath);
  if (finalPath === requested) return { redirected: false, reason: null, finalPath };
  if (finalPath === '/') {
    return { redirected: true, reason: 'missing_admin_role', finalPath };
  }
  if (finalPath === '/connexion') throw new Error('Session expirée lors de /admin');
  return { redirected: true, reason: 'unexpected_admin_redirect', finalPath };
}
