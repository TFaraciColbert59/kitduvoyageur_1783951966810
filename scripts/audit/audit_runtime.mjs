import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REDACTED_VALUE = '[redacted]';
const SENSITIVE_ASSIGNMENT = /((?:["']?)(?:access[_-]?token|refresh[_-]?token|accessToken|refreshToken|authorization|set-cookie|cookie|password|token|secret|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|service[_-]?role[_-]?key)(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/gi;
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

export function redactDiagnosticText(value) {
  return String(value ?? '')
    .replace(SENSITIVE_ASSIGNMENT, (_match, prefix, sensitiveValue) => {
      const quote = sensitiveValue[0] === '"' || sensitiveValue[0] === "'" ? sensitiveValue[0] : '';
      return `${prefix}${quote}${REDACTED_VALUE}${quote}`;
    })
    .replace(/\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi, REDACTED_VALUE)
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
    const result = Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : redactDetails(entry, seen),
    ]));
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

export function attachPageDiagnostics(page, options = {}) {
  const allowedConsoleErrors = options.allowedConsoleErrors || [];
  const errors = [];
  const onPageError = (error) => {
    errors.push({ type: 'pageerror', message: redactDiagnosticText(error?.message || error) });
  };
  const onRequestFailed = (request) => {
    const failure = request?.failure?.()?.errorText || 'requestfailed';
    errors.push({
      type: 'requestfailed',
      message: `${request?.method?.() || 'GET'} ${safeUrl(request?.url?.())} ${redactDiagnosticText(failure)}`,
    });
  };
  const onConsole = (message) => {
    if (message?.type?.() !== 'error') return;
    const text = redactDiagnosticText(message.text());
    if (allowedConsoleErrors.some((pattern) => pattern.test(text))) return;
    errors.push({ type: 'console', message: text });
  };
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
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
      page.off('console', onConsole);
    },
  };
}
