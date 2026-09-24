import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function redactDiagnosticText(value) {
  return String(value ?? '')
    .replace(/(access_token|refresh_token|password|token)(\s*[=:]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 500);
}

function redactDetails(value) {
  if (typeof value === 'string') return redactDiagnosticText(value);
  if (Array.isArray(value)) return value.map(redactDetails);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactDetails(entry)]));
  }
  return value;
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
  fs.writeFileSync(reportPath, `${JSON.stringify({
    status: 'ERROR',
    generatedAt: new Date().toISOString(),
    error: redactDiagnosticText(error instanceof Error ? error.message : error),
    ...redactDetails(details),
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
