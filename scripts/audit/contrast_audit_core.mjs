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

function nodeMatchesMeasurement(node, measurement) {
  const targets = targetValues(node);
  const selector = measurement.selector || '';
  const id = measurement.id || '';
  return targets.some((target) => (
    target === selector
    || target === id
    || (selector && target.includes(selector))
    || (id && target.includes(id))
  ));
}

function mergeAxeEvidence(measurements, entries, forcedStatus, prefix) {
  const merged = measurements.map((measurement) => ({ ...measurement }));
  entries.forEach((entry, index) => {
    const matchIndex = merged.findIndex((measurement) => nodeMatchesMeasurement(entry.node, measurement));
    if (matchIndex >= 0) {
      const current = merged[matchIndex];
      merged[matchIndex] = {
        ...current,
        status: current.status === CONTRAST_STATES.OCCLUDED ? CONTRAST_STATES.OCCLUDED : forcedStatus,
        axeTarget: targetValues(entry.node),
        axeFailureSummary: entry.node?.failureSummary || null,
      };
      return;
    }
    merged.push({
      id: `${prefix}-${index}`,
      selector: targetValues(entry.node).join(', '),
      text: entry.node?.html || '',
      status: forcedStatus,
      ratio: null,
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
  return `${cell.routeId}|${cell.theme}|${cell.intensity}`;
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
    weightedPassRate: totals.nodes === 0 ? 0 : (totals.pass / totals.nodes) * 100,
  };
}

export function getAuditBaseUrl(env = process.env) {
  const raw = typeof env?.PW_BASE_URL === 'string' && env.PW_BASE_URL.trim()
    ? env.PW_BASE_URL.trim()
    : 'http://localhost:3000';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PW_BASE_URL invalide: ${raw}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`PW_BASE_URL doit être HTTP(S): ${raw}`);
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

function parsedLocalStorageEntries(storageState) {
  const entries = [];
  for (const origin of storageState.origins) {
    for (const item of origin.localStorage || []) {
      let value = item.value;
      try {
        value = JSON.parse(item.value);
      } catch {
        value = null;
      }
      entries.push({ name: item.name, value });
    }
  }
  return entries;
}

function sessionExpiry(value) {
  if (!value || typeof value !== 'object') return null;
  const expiresAt = value.expires_at ?? value.expiresAt;
  const numeric = typeof expiresAt === 'string' ? Number(expiresAt) : expiresAt;
  return finiteNumber(numeric) ? numeric * 1000 : null;
}

export function validateStorageState(storageState, now = Date.now()) {
  if (!storageState || !Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins)) {
    throw new Error('storageState invalide');
  }

  const authCookies = storageState.cookies.filter((cookie) => (
    cookie && typeof cookie.name === 'string' && /(?:^|[-.])auth-token(?:\.|$)/i.test(cookie.name)
  ));
  const localEntries = parsedLocalStorageEntries(storageState);
  const authEntries = localEntries.filter((entry) => (
    /(?:^|[-.])auth-token(?:\.|$)/i.test(entry.name)
    || (entry.value && typeof entry.value === 'object' && (entry.value.access_token || entry.value.refresh_token))
  ));

  if (authCookies.length === 0 && authEntries.length === 0) {
    throw new Error('storageState non authentifié');
  }

  const expiries = [];
  for (const cookie of authCookies) {
    if (finiteNumber(cookie.expires) && cookie.expires > 0) expiries.push(cookie.expires * 1000);
  }
  for (const entry of authEntries) {
    const expiry = sessionExpiry(entry.value);
    if (expiry !== null) expiries.push(expiry);
  }
  if (expiries.length > 0 && expiries.every((expiry) => expiry <= now)) {
    throw new Error('storageState expiré');
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
  if (final.origin !== base.origin) throw new Error('URL finale hors origine pour /compte');
  if (normalizedPath(final.pathname) !== '/compte') {
    throw new Error(`URL finale inattendue pour /compte: ${final.pathname}`);
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

export function describeAdminNavigation({ finalUrl, status }) {
  const final = new URL(finalUrl);
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    throw new Error(`Réponse HTTP invalide pour /admin: ${status}`);
  }
  const finalPath = normalizedPath(final.pathname);
  if (finalPath === '/admin') return { redirected: false, reason: null, finalPath };
  if (finalPath === '/') {
    return { redirected: true, reason: 'missing_admin_role', finalPath };
  }
  if (finalPath === '/connexion') throw new Error('Session expirée lors de /admin');
  return { redirected: true, reason: 'unexpected_admin_redirect', finalPath };
}
