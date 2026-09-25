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

const HTTP_ERROR_RESOURCE_TYPES = new Set(['document', 'script', 'stylesheet', 'font', 'image']);

function originOf(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return null;
  }
}

function requestInfo(request) {
  const url = String(request?.url?.() || '');
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = '';
  }
  return {
    method: String(request?.method?.() || '').toUpperCase(),
    url,
    pathname,
    failureText: String(request?.failure?.()?.errorText || ''),
    resourceType: String(request?.resourceType?.() || ''),
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

function isAllowedSessionRequestFailure(info, reference) {
  if (info.method !== 'GET' && info.method !== 'HEAD') return false;
  if (info.failureText !== 'net::ERR_ABORTED') return false;
  if (info.pathname.includes('net::ERR_ABORTED')) return false;
  if (isSameOrigin(info.url, reference)) return true;
  if (info.pathname === '/_vercel/speed-insights/script.js' && isSameOrigin(info.url, reference)) return true;
  try {
    return new URL(info.url).hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function isAllowedSpeedInsightsConsoleError(text, message) {
  const locationUrl = message?.location?.()?.url;
  let pathIsExact = false;
  const textPathIsExact = /\/_vercel\/speed-insights\/script\.js(?:[?'"\s]|$)/i.test(text);
  if (locationUrl) {
    try {
      pathIsExact = new URL(String(locationUrl)).pathname === '/_vercel/speed-insights/script.js' || textPathIsExact;
    } catch {
      pathIsExact = textPathIsExact;
    }
  } else {
    pathIsExact = textPathIsExact;
  }
  if (!pathIsExact) return false;
  return /refused to execute script/i.test(text)
    && /because its MIME type/i.test(text)
    && /not executable/i.test(text)
    && /strict MIME type checking is enabled/i.test(text);
}

function isAllowedSessionSpeedInsightsResponse(info, reference) {
  return info.status === 404
    && (info.method === 'GET' || info.method === 'HEAD')
    && info.pathname === '/_vercel/speed-insights/script.js'
    && isSameOrigin(info.url, reference);
}

export function attachPageDiagnostics(page, options = {}) {
  const sessionMode = options.sessionMode === true;
  const configuredBaseUrl = typeof options.baseUrl === 'string' ? options.baseUrl : '';
  const pageUrl = () => (typeof page.url === 'function' ? page.url() : '');
  const auditBaseUrl = () => configuredBaseUrl || pageUrl();
  const errors = [];
  const onPageError = (error) => {
    errors.push({ type: 'pageerror', message: redactDiagnosticText(error?.message || error) });
  };
  const onRequestFailed = (request) => {
    const info = requestInfo(request);
    if (sessionMode && isAllowedSessionRequestFailure(info, auditBaseUrl())) return;
    const message = `${info.method || 'UNKNOWN'} ${safeUrl(info.url)} ${redactDiagnosticText(info.failureText || 'requestfailed')}`;
    errors.push({ type: 'requestfailed', message });
  };
  const onResponse = (response) => {
    const info = responseInfo(response);
    if (info.status < 400) return;
    if (sessionMode && isAllowedSessionSpeedInsightsResponse(info, auditBaseUrl())) return;
    if (isSameOrigin(info.url, auditBaseUrl()) && HTTP_ERROR_RESOURCE_TYPES.has(info.resourceType)) {
      errors.push({ type: 'http', message: `HTTP ${info.status} ${safeUrl(info.url)}` });
    }
  };
  const onConsole = (message) => {
    if (message?.type?.() !== 'error') return;
    const text = redactDiagnosticText(message.text());
    if (/^Failed to load resource\b/i.test(text)) return;
    if (isAllowedSpeedInsightsConsoleError(text, message)) return;
    errors.push({ type: 'console', message: text });
  };
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  page.on('console', onConsole);
  return {
    errors,
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
