import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REDACTED_VALUE = '[redacted]';
const AUTHORIZATION_ASSIGNMENT = /((?:["']?authorization["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:bearer|basic)\s+[^"',;}\]\r\n]+|[^\s,;}\]]+)/gi;
const SENSITIVE_ASSIGNMENT = /((?:["']?)(?:access[_-]?token|refresh[_-]?token|accessToken|refreshToken|authorization|id[_-]?token|jwt|set-cookie|cookie|password|token|secret|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|service[_-]?role[_-]?key)(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/gi;
const BEARER_VALUE = /\b(?:bearer|basic)\s+[^"',;}\]\r\n]+/gi;
const JWT_VALUE = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const ABSOLUTE_URL_CANDIDATE = /(?:https?|wss?):\/\/[^\s"'<>]+/gi;
const URL_FALLBACK = /(?:https?|wss?):\/\/[^\s"'<>]+|\/\/[^\s"'<>]+/gi;
const PROTOCOL_RELATIVE_URL_CANDIDATE = /(^|[\s"'([{=,;])\/\/[^\s"'<>]+/g;
const RELATIVE_URL_CANDIDATE = /(^|[\s"'([{=,;:])\/(?!\/)[^\s"'<>]+/g;
const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'authorization',
  'jwt',
  'idtoken',
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
const AUDIT_CONTENT_KEYS = new Set([
  'text',
  'html',
  'displayname',
  'handle',
  'username',
  'fullname',
  'firstname',
  'lastname',
  'bio',
  'location',
  'avatar',
  'avatarurl',
  'target',
  'axetarget',
  'selector',
  'relatednodes',
  'failuresummary',
  'axefailuresummary',
]);

function isSensitiveKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SENSITIVE_KEYS.has(normalized)
    || /(?:token|secret|password|cookie|authorization|apikey|privatekey|servicerolekey|sessionkey)/.test(normalized);
}

function isAuditContentKey(key) {
  return AUDIT_CONTENT_KEYS.has(String(key).replace(/[^a-z0-9]/gi, '').toLowerCase());
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
     .replace(JWT_VALUE, REDACTED_VALUE)
     .replace(ABSOLUTE_URL_CANDIDATE, (url) => safeUrl(url))
     .replace(PROTOCOL_RELATIVE_URL_CANDIDATE, (match, prefix) => `${prefix}${safeUrl(match.slice(prefix.length))}`)
     .replace(RELATIVE_URL_CANDIDATE, (match, prefix) => `${prefix}${safeUrl(match.slice(prefix.length))}`)
     .replace(URL_FALLBACK, (url) => safeUrl(url))
     .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 500);
}

function redactDetails(value, seen = new WeakSet(), redactContent = false) {
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
    const result = value.map((entry) => redactDetails(entry, seen, redactContent));
    seen.delete(value);
    return result;
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isSensitiveKey(key)) continue;
      if (redactContent && isAuditContentKey(key)) {
        result[key] = REDACTED_VALUE;
        continue;
      }
      result[key] = redactDetails(entry, seen, redactContent);
    }
    seen.delete(value);
    return result;
  }
  return value;
}

export function redactRuntimeValue(value, options = {}) {
  return redactDetails(value, new WeakSet(), options?.redactContent !== false);
}

function sanitizedPathname(pathname) {
  let redactFollowing = false;
  return String(pathname || '/')
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (redactFollowing) {
        redactFollowing = false;
        return REDACTED_VALUE;
      }
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return REDACTED_VALUE;
      }
      if (
        /(?:token|secret|password|signature|sig|code|state|invite|reset|verify|callback|download|session|auth)/i.test(decoded)
        || /[A-Z0-9_-]{32,}/i.test(decoded)
        || /[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(decoded)
        || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(decoded)
      ) {
        redactFollowing = true;
        return REDACTED_VALUE;
      }
      return segment;
    })
    .join('/');
}

export function safeAuditUrl(value, baseUrl = '') {
  const raw = String(value ?? '').trim();
  const candidate = raw.startsWith('//') && !baseUrl ? `https:${raw}` : raw;
  try {
    const parsed = new URL(candidate, baseUrl || undefined);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) return '[invalid-url]';
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.origin}${sanitizedPathname(parsed.pathname)}`;
  } catch {
    if (/^\/(?!\/)/.test(raw)) {
      return sanitizedPathname(raw.split(/[?#]/, 1)[0]);
    }
    return '[invalid-url]';
  }
}

function safeUrl(value) {
  return safeAuditUrl(value);
}

function pathWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function defaultAuditStorageStatePath(env = process.env) {
  if (env.AUDIT_STORAGE_STATE) {
    const resolved = path.resolve(env.AUDIT_STORAGE_STATE);
    const privateTempRoot = path.join(os.tmpdir(), 'lkdv-audit');
    if (!pathWithin(privateTempRoot, resolved)) {
      throw new Error('Chemin storageState hors zone privée autorisée');
    }
    return resolved;
  }
  return path.join(os.tmpdir(), 'lkdv-audit', 'auth-storage-state.json');
}

export function enforcePrivateAuditPermissions(target, mode = 0o600) {
  if (process.platform !== 'win32') {
    fs.chmodSync(target, mode);
    return;
  }
  const account = process.env.USERDOMAIN && process.env.USERNAME
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : process.env.USERNAME;
  if (!account) throw new Error('Compte Windows audit introuvable');
  try {
    execFileSync('icacls.exe', [
      target,
      '/inheritance:r',
      '/remove:g',
      '*S-1-1-0',
      '*S-1-5-11',
      '*S-1-5-32-545',
      '*S-1-5-32-546',
      '*S-1-5-19',
      '*S-1-5-20',
      '/grant:r',
      `${account}:(F)`,
      '*S-1-5-18:(F)',
      '*S-1-5-32-544:(F)',
    ], { stdio: 'ignore' });
  } catch {
    throw new Error('Permissions audit privées indisponibles');
  }
}

export function assertNoSymlinkComponents(directory) {
  let current = path.resolve(directory);
  while (true) {
    if (fs.existsSync(current)) {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('Répertoire audit lié refusé');
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export function ensurePrivateAuditDirectory(directory) {
  assertNoSymlinkComponents(directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  assertNoSymlinkComponents(directory);
  try {
    enforcePrivateAuditPermissions(directory, 0o700);
  } catch {
    throw new Error('Permissions audit privées indisponibles');
  }
}

function assertRegularFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Fichier audit lié ou non régulier refusé');
  return true;
}

export function invalidateAuditReports(paths = []) {
  for (const reportPath of paths) {
    assertNoSymlinkComponents(path.dirname(reportPath));
    if (assertRegularFile(reportPath)) fs.unlinkSync(reportPath);
  }
}

export function invalidateAuditReportDirectory(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return;
  assertNoSymlinkComponents(directory);
  for (const name of fs.readdirSync(directory)) {
    const reportPath = path.join(directory, name);
    const stat = fs.lstatSync(reportPath);
    if (stat.isSymbolicLink()) throw new Error('Fichier audit lié refusé');
    if (stat.isFile() && predicate(name)) fs.unlinkSync(reportPath);
  }
}

export function writePrivateAuditFile(filePath, content) {
  const directory = path.dirname(filePath);
  ensurePrivateAuditDirectory(directory);
  assertNoSymlinkComponents(directory);
  if (assertRegularFile(filePath) === false && fs.existsSync(filePath)) {
    throw new Error('Fichier audit lié ou non régulier refusé');
  }
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  const backupPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.bak`);
  let published = false;
  let backedUp = false;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, content, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    enforcePrivateAuditPermissions(temporaryPath, 0o600);
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, backupPath);
      backedUp = true;
    }
    fs.renameSync(temporaryPath, filePath);
    published = true;
    enforcePrivateAuditPermissions(filePath, 0o600);
    if (backedUp) fs.unlinkSync(backupPath);
    return filePath;
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporaryPath); } catch {}
    if (published) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    let restored = !backedUp;
    if (backedUp && !fs.existsSync(filePath)) {
      try {
        fs.renameSync(backupPath, filePath);
        restored = true;
      } catch {}
    }
    if (restored) {
      try { fs.unlinkSync(backupPath); } catch {}
    }
    throw error;
  }
}

export function writeAuditErrorReport(reportPath, error, details = {}) {
  const reportDirectory = path.dirname(reportPath);
  if (!fs.existsSync(reportDirectory)) ensurePrivateAuditDirectory(reportDirectory);
  const redactedDetails = redactRuntimeValue(details);
  const detailFields = redactedDetails && typeof redactedDetails === 'object' && !Array.isArray(redactedDetails)
    ? redactedDetails
    : { details: redactedDetails };
  const content = `${JSON.stringify({
    ...detailFields,
    status: 'ERROR',
    generatedAt: new Date().toISOString(),
    error: redactDiagnosticText(error instanceof Error ? error.message : error),
  }, null, 2)}\n`;
  try {
    writePrivateAuditFile(reportPath, content);
    return true;
  } catch {
    return false;
  }
}

const SPEED_INSIGHTS_PATH = '/_vercel/speed-insights/script.js';

function originOf(value) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null;
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

function configuredSupabaseHost() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    return new URL(raw.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isExternalSupabase(url) {
  try {
    const parsed = new URL(String(url));
    const hostname = parsed.hostname.toLowerCase();
    const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
    const loopback = normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1' || normalizedHostname === '::1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) return false;
     const configuredHost = configuredSupabaseHost();
     if (configuredHost && hostname === configuredHost) return true;
     return hostname.endsWith('.supabase.co') && hostname !== 'supabase.co';
  } catch {
    return false;
  }
}

function isSupabaseAuthRequest(info) {
  const configuredHost = configuredSupabaseHost();
  const configuredOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    try {
      return new URL(raw.trim()).origin;
    } catch {
      return null;
    }
  })();
  if (!configuredHost || !configuredOrigin || !isExternalSupabase(info.url)) return false;
  try {
    const parsed = new URL(info.url);
    return parsed.origin === configuredOrigin
      && info.method === 'GET'
      && parsed.pathname === '/auth/v1/user'
      && parsed.search === ''
      && parsed.hash === '';
  } catch {
    return false;
  }
}

function isKnownExternalReadHost(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase() === 'server.arcgisonline.com';
  } catch {
    return false;
  }
}

function isExactSpeedInsights(info) {
  return info.pathname === SPEED_INSIGHTS_PATH && isReadMethod(info.method);
}

function isExactNextPrefetchRequest(info, reference) {
  if (info.method !== 'GET'
    || info.resourceType !== 'fetch'
    || headerValue(info.headers, 'rsc').trim() !== '1'
    || headerValue(info.headers, 'next-router-state-tree').trim().length === 0
    || headerValue(info.headers, 'next-url').trim().length === 0
    || !/(?:[?&])_rsc=[^&#]+/.test(info.url)
    || !isSameOrigin(headerValue(info.headers, 'referer'), reference)) return false;
  try {
    const target = new URL(info.url);
    if (target.pathname === '/api' || target.pathname.startsWith('/api/')
      || target.pathname === '/auth' || target.pathname.startsWith('/auth/')) return false;
    const nextUrl = new URL(headerValue(info.headers, 'next-url'), reference);
    return nextUrl.origin === target.origin && nextUrl.pathname === target.pathname;
  } catch {
    return false;
  }
}

function isAllowedAbortedRequest(info, reference) {
  if (!isReadMethod(info.method)) return false;
   if (info.failureText !== 'net::ERR_ABORTED') return false;
   if (info.url.includes('net::ERR_ABORTED')) return false;
   if (!isSameOrigin(info.url, reference)) return false;

  if (isExactSpeedInsights(info)) return true;
  return isExactNextPrefetchRequest(info, reference);
}

function isRetainedAbortedRequest(info, reference) {
  if (!isReadMethod(info.method)
    || info.failureText !== 'net::ERR_ABORTED'
    || info.url.includes('net::ERR_ABORTED')) return false;
  try {
    if (isSameOrigin(info.url, reference)) {
      const pathname = new URL(info.url).pathname;
      if (pathname === '/api' || pathname.startsWith('/api/')
        || pathname === '/auth' || pathname.startsWith('/auth/')) return false;
    }
  } catch {
    return false;
  }
  return isSameOrigin(info.url, reference)
    || isExternalSupabase(info.url)
    || isKnownExternalReadHost(info.url);
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

function hasRouteEvidence(entry) {
  if (entry?.measured !== true || !Array.isArray(entry.nodes) || entry.nodes.length === 0) return false;
  const identities = new Set();
  return entry.nodes.every((node) => {
    if (
      !node
      || typeof node !== 'object'
      || typeof node.id !== 'string'
      || node.id.trim().length === 0
      || !['pass', 'contrast_fail', 'unknown', 'occluded'].includes(node.status)
      || (typeof node.selector !== 'string' && typeof node.dataAuditId !== 'string')
      || !Object.hasOwn(node, 'ratio')
      || !Object.hasOwn(node, 'threshold')
      || (node.ratio !== null && !Number.isFinite(node.ratio))
      || (['pass', 'contrast_fail'].includes(node.status) && ![3, 4.5].includes(node.threshold))
      || (node.status === 'pass' && (!Number.isFinite(node.ratio) || node.ratio < node.threshold || node.ratio > 21))
      || (node.status === 'contrast_fail' && (!Number.isFinite(node.ratio) || node.ratio < 1 || node.ratio >= node.threshold))
      || ((node.status === 'unknown' || node.status === 'occluded') && (node.ratio !== null || node.threshold !== null))
      || identities.has(node.id)
    ) return false;
    identities.add(node.id);
    return true;
  });
}

export function aggregateRouteOutcomes(outcomes = []) {
  const entries = Array.isArray(outcomes) ? outcomes : [];
  return {
    measured: entries.filter(hasRouteEvidence),
    errors: entries
      .filter((entry) => entry?.error)
      .map((entry) => ({ id: entry.id, error: entry.error })),
    warnings: entries.flatMap((entry) => Array.isArray(entry?.warnings) ? entry.warnings : []),
    degraded: entries.some((entry) => entry?.degraded === true || isDiagnosticDegraded(entry)),
  };
}

export function attachPageDiagnostics(page, options = {}) {
  const configuredBaseUrl = typeof options.baseUrl === 'string' ? options.baseUrl : '';
  const sessionMode = options.sessionMode === true;
  const expectedAuthEmail = typeof options.expectedAuthEmail === 'string'
    ? options.expectedAuthEmail.trim().toLowerCase()
    : '';
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
  const isExpected404 = (url, status, resourceType = '', requestInfo = null) => {
    if (status !== 404 || !expected404Pathname) return false;
    try {
      const parsed = new URL(String(url));
      const resourceAllowed = resourceType === 'document'
        || (resourceType === 'fetch' && requestInfo && isExactNextPrefetchRequest(requestInfo, auditBaseUrl()));
      return parsed.pathname === expected404Pathname
        && resourceAllowed
        && isSameOrigin(parsed.toString(), auditBaseUrl());
    } catch {
      return false;
    }
  };
  const errors = [];
  const warnings = [];
  const verifiedExpected404Urls = new Set();
  let authResponseVerified = false;
  let authVerificationPromise = Promise.resolve();
  const onPageError = (error) => {
    errors.push({ type: 'pageerror', message: redactDiagnosticText(error?.message || error) });
  };
  const onRequestFailed = (request) => {
    const info = requestInfo(request);
    if (isAllowedAbortedRequest(info, auditBaseUrl())) return;
    if (sessionMode && isSupabaseAuthRequest(info)) {
      errors.push({ type: 'requestfailed', message: `AUTH_REQUEST_FAILED ${safeUrl(info.url)}` });
      return;
    }
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
     if (sessionMode && isSupabaseAuthRequest(info)) {
       if (info.status >= 200 && info.status < 300) {
         const verifyResponse = async () => {
           if (!expectedAuthEmail) {
             authResponseVerified = true;
             return;
           }
           let body;
           try {
             body = await response.json();
           } catch {
             errors.push({ type: 'auth', message: 'Réponse Auth serveur illisible' });
             return;
           }
           if (String(body?.email || '').trim().toLowerCase() !== expectedAuthEmail) {
             errors.push({ type: 'auth', message: 'Identité Auth serveur inattendue' });
             return;
           }
           authResponseVerified = true;
         };
         authVerificationPromise = authVerificationPromise.then(verifyResponse, verifyResponse);
         return;
       }
       errors.push({ type: 'http', message: `AUTH_HTTP_${info.status} ${safeUrl(info.url)}` });
       return;
     }
    if (info.status < 400) return;
     if (isReadMethod(info.method) && isExpected404(info.url, info.status, info.resourceType, info)) {
       if (info.resourceType === 'document' || !info.resourceType) verifiedExpected404Urls.add(String(info.url));
       return;
     }
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
     if (locationUrl
       && verifiedExpected404Urls.has(String(locationUrl))
       && isExpected404(locationUrl, 404, 'document')
       && /failed to load resource\b.*404/i.test(text)) return;
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
       get authVerified() {
         return authResponseVerified;
       },
       waitForAuthVerification() {
         return authVerificationPromise;
       },
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
