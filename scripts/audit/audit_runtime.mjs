import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REDACTED_VALUE = '[redacted]';
const AUTHORIZATION_ASSIGNMENT = /((?:["']?authorization["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:bearer|basic)\s+[^"',;}\]\r\n]+|[^\s,;}\]]+)/gi;
const SENSITIVE_ASSIGNMENT = /((?:["']?)(?:access[_-]?token|refresh[_-]?token|accessToken|refreshToken|authorization|set-cookie|cookie|password|token|secret|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|service[_-]?role[_-]?key)(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/gi;
const BEARER_VALUE = /\b(?:bearer|basic)\s+[^"',;}\]\r\n]+/gi;
const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'setcookie',
  'password',
  'token',
  'secret',
  'apikey',
  'clientsecret',
  'privatekey',
  'servicerolekey',
  'session',
]);

function isSensitiveKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SENSITIVE_KEYS.has(normalized) || /(?:token|secret|password|cookie|authorization|apikey|privatekey)/.test(normalized);
}

function redactAssignment(prefix, sensitiveValue) {
  const quote = sensitiveValue[0] === '"' || sensitiveValue[0] === "'" ? sensitiveValue[0] : '';
  const keyIsQuoted = quote && prefix.trimStart().startsWith(quote);
  return keyIsQuoted ? `${quote}${REDACTED_VALUE}${quote}` : REDACTED_VALUE;
}

export function redactDiagnosticText(value) {
  return String(value ?? '')
    .replace(AUTHORIZATION_ASSIGNMENT, (_match, prefix, sensitiveValue) => redactAssignment(prefix, sensitiveValue))
    .replace(SENSITIVE_ASSIGNMENT, (_match, prefix, sensitiveValue) => redactAssignment(prefix, sensitiveValue))
    .replace(BEARER_VALUE, REDACTED_VALUE)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 500);
}

function redactDetails(value, seen = new WeakSet()) {
  if (typeof value === 'string') return redactDiagnosticText(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactDiagnosticText(value.message),
      stack: redactDiagnosticText(value.stack),
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const result = value.map((entry) => redactDetails(entry, seen));
    seen.delete(value);
    return result;
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isSensitiveKey(key)) continue;
      result[key] = redactDetails(entry, seen);
    }
    seen.delete(value);
    return result;
  }
  return value;
}

export function redactRuntimeValue(value) {
  return redactDetails(value);
}

function safeUrl(value) {
  try {
    const parsed = new URL(String(value));
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

export function defaultAuditStorageStatePath(env = process.env) {
  if (env.AUDIT_STORAGE_STATE) return path.resolve(env.AUDIT_STORAGE_STATE);
  return path.join(os.tmpdir(), 'lkdv-audit', 'auth-storage-state.json');
}

export function ensurePrivateAuditDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

export function invalidateAuditReports(paths = []) {
  for (const reportPath of paths) {
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  }
}

export function invalidateAuditReportDirectory(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory)) {
    const reportPath = path.join(directory, name);
    if (fs.statSync(reportPath).isFile() && predicate(name)) fs.unlinkSync(reportPath);
  }
}

export function writeAuditErrorReport(reportPath, error, details = {}) {
  ensurePrivateAuditDirectory(path.dirname(reportPath));
  const redactedDetails = redactRuntimeValue(details);
  const detailFields = redactedDetails && typeof redactedDetails === 'object' && !Array.isArray(redactedDetails)
    ? redactedDetails
    : { details: redactedDetails };
  fs.writeFileSync(reportPath, `${JSON.stringify({
    ...detailFields,
    status: 'ERROR',
    generatedAt: new Date().toISOString(),
    error: redactDiagnosticText(error instanceof Error ? error.message : error),
  }, null, 2)}\n`);
}

const SPEED_INSIGHTS_PATH = '/_vercel/speed-insights/script.js';

function originOf(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return null;
  }
}

function requestHeaders(request) {
  try {
    const headers = typeof request?.headers === 'function'
      ? request.headers()
      : request?.headers;
    return headers && typeof headers === 'object' ? headers : {};
  } catch {
    return {};
  }
}

function headerValue(headers, name) {
  const normalized = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === normalized);
  return entry ? String(entry[1] || '') : '';
}

function requestInfo(request) {
  const url = String(request?.url?.() || '');
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = '';
  }
  let failure;
  try {
    failure = request?.failure?.();
  } catch {
    failure = null;
  }
  const failureText = typeof failure === 'string' ? failure : String(failure?.errorText || '');
  return {
    method: String(request?.method?.() || '').toUpperCase(),
    url,
    pathname,
    failureText,
    resourceType: String(request?.resourceType?.() || ''),
    headers: requestHeaders(request),
  };
}

function responseInfo(response) {
  const request = requestInfo(response?.request?.());
  return {
    ...request,
    url: String(response?.url?.() || request.url),
    status: Number(response?.status?.() || 0),
  };
}

function isSameOrigin(url, reference) {
  const urlOrigin = originOf(url);
  const referenceOrigin = originOf(reference);
  return Boolean(urlOrigin && referenceOrigin && urlOrigin === referenceOrigin);
}

function isReadMethod(method) {
  return method === 'GET' || method === 'HEAD';
}

function isExternalSupabase(url) {
  try {
    const hostname = new URL(String(url)).hostname.toLowerCase();
    return hostname.endsWith('.supabase.co') && hostname !== 'supabase.co';
  } catch {
    return false;
  }
}

function isExactSpeedInsights(info) {
  return info.pathname === SPEED_INSIGHTS_PATH && isReadMethod(info.method);
}

function isExactNextPrefetchRequest(info, reference) {
  return info.method === 'GET'
    && info.resourceType === 'fetch'
    && headerValue(info.headers, 'rsc').trim() === '1'
    && headerValue(info.headers, 'next-router-state-tree').trim().length > 0
    && headerValue(info.headers, 'next-url').trim().length > 0
    && /(?:[?&])_rsc=/.test(info.url)
    && isSameOrigin(headerValue(info.headers, 'referer'), reference);
}

function isAllowedAbortedRequest(info, reference) {
  if (!isReadMethod(info.method)) return false;
  if (info.failureText !== 'net::ERR_ABORTED') return false;
  if (info.url.includes('net::ERR_ABORTED')) return false;
  if (isExternalSupabase(info.url)) return true;
  if (!isSameOrigin(info.url, reference)) return false;
  if (isExactSpeedInsights(info)) return true;
  return isExactNextPrefetchRequest(info, reference);
}

function isRetainedAbortedRequest(info, reference) {
  return isReadMethod(info.method)
    && info.failureText === 'net::ERR_ABORTED'
    && !info.url.includes('net::ERR_ABORTED')
    && isSameOrigin(info.url, reference);
}

function isAllowedSpeedInsightsResponse(info, reference) {
  return info.status === 404
    && isExactSpeedInsights(info)
    && isSameOrigin(info.url, reference);
}

function isAllowedSpeedInsightsConsoleError(text, message, reference) {
  const locationUrl = message?.location?.()?.url;
  if (!locationUrl || !isSameOrigin(String(locationUrl), reference)) return false;
  let pathIsExact = false;
  try {
    pathIsExact = new URL(String(locationUrl)).pathname === SPEED_INSIGHTS_PATH;
  } catch {
    pathIsExact = false;
  }
  if (!pathIsExact) return false;
  return /refused to execute script/i.test(text)
    && /because its MIME type/i.test(text)
    && /not executable/i.test(text)
    && /strict MIME type checking is enabled/i.test(text);
}

function isAllowedSpeedInsightsResourceConsole(text, message, reference) {
  const locationUrl = message?.location?.()?.url;
  if (!locationUrl || !isSameOrigin(String(locationUrl), reference)) return false;
  let pathIsExact = false;
  try {
    pathIsExact = new URL(String(locationUrl)).pathname === SPEED_INSIGHTS_PATH;
  } catch {
    pathIsExact = false;
  }
  return pathIsExact
    && /^failed to load resource\b/i.test(text)
    && (/\b404\b/.test(text) || /net::ERR_ABORTED/i.test(text));
}

export function isDiagnosticDegraded(diagnostics) {
  return Boolean(diagnostics && Array.isArray(diagnostics.warnings) && diagnostics.warnings.length > 0);
}

export function aggregateRouteOutcomes(outcomes = []) {
  const entries = Array.isArray(outcomes) ? outcomes : [];
  return {
    measured: entries.filter((entry) => entry?.measured === true),
    errors: entries
      .filter((entry) => entry?.error)
      .map((entry) => ({ id: entry.id, error: entry.error })),
    warnings: entries.flatMap((entry) => Array.isArray(entry?.warnings) ? entry.warnings : []),
    degraded: entries.some((entry) => entry?.degraded === true || isDiagnosticDegraded(entry)),
  };
}

export function attachPageDiagnostics(page, options = {}) {
  const configuredBaseUrl = typeof options.baseUrl === 'string' ? options.baseUrl : '';
  const pageUrl = () => (typeof page.url === 'function' ? page.url() : '');
  const auditBaseUrl = () => configuredBaseUrl || pageUrl();
  let expected404Pathname = '';
  if (typeof options.expected404Path === 'string' && options.expected404Path) {
    try {
      expected404Pathname = new URL(options.expected404Path, auditBaseUrl()).pathname;
    } catch {
      expected404Pathname = '';
    }
  }
  const isExpected404 = (url, status, resourceType = '') => {
    if (status !== 404 || !expected404Pathname) return false;
    try {
      const parsed = new URL(String(url));
      return parsed.pathname === expected404Pathname
        && (!resourceType || resourceType === 'document')
        && isSameOrigin(parsed.toString(), auditBaseUrl());
    } catch {
      return false;
    }
  };
  const errors = [];
  const warnings = [];
  const onPageError = (error) => {
    errors.push({ type: 'pageerror', message: redactDiagnosticText(error?.message || error) });
  };
  const onRequestFailed = (request) => {
    const info = requestInfo(request);
    if (isAllowedAbortedRequest(info, auditBaseUrl())) return;
    const message = `${info.method || 'UNKNOWN'} ${safeUrl(info.url)} ${redactDiagnosticText(info.failureText || 'requestfailed')}`;
    const entry = { type: 'requestfailed', message };
    if (isRetainedAbortedRequest(info, auditBaseUrl())) {
      warnings.push(entry);
      return;
    }
    errors.push(entry);
  };
  const onResponse = (response) => {
    const info = responseInfo(response);
    if (info.status < 400) return;
    if (isExpected404(info.url, info.status, info.resourceType)) return;
    if (isAllowedSpeedInsightsResponse(info, auditBaseUrl())) return;
    const message = `HTTP ${info.status} ${safeUrl(info.url)}`;
    if (isSameOrigin(info.url, auditBaseUrl())) {
      errors.push({ type: 'http', message });
      return;
    }
    warnings.push({ type: 'http', message });
  };
  const onConsole = (message) => {
    if (message?.type?.() !== 'error') return;
    const text = redactDiagnosticText(message.text());
    const locationUrl = message?.location?.()?.url;
    if (isExpected404(locationUrl, 404) && /failed to load resource\b.*404/i.test(text)) return;
    if (isAllowedSpeedInsightsResourceConsole(text, message, auditBaseUrl())) return;
    if (isAllowedSpeedInsightsConsoleError(text, message, auditBaseUrl())) return;
    warnings.push({ type: 'console', message: text });
  };
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  page.on('console', onConsole);
  return {
    errors,
    warnings,
    get degraded() {
      return isDiagnosticDegraded({ warnings });
    },
    isDegraded() {
      return isDiagnosticDegraded({ warnings });
    },
    assertClean() {
      if (errors.length === 0) return;
      throw new Error(`Erreurs runtime audit (${errors.length}): ${errors.map((entry) => entry.message).join(' | ')}`);
    },
    dispose() {
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
      page.off('console', onConsole);
    },
  };
}
