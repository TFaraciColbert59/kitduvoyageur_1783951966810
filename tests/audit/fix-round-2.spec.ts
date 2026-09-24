import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import * as runtime from '../../scripts/audit/audit_runtime.mjs';
import { extractTextElements } from '../../scripts/audit/measure_contrast_v2.mjs';

const root = process.cwd();
const coreApi = core as typeof core & Record<string, any>;
const runtimeApi = runtime as typeof runtime & Record<string, any>;
const now = 1_800_000_000_000;
const validLocalSession = JSON.stringify({
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: now / 1000 + 3600,
});
const validState = {
  cookies: [{
    name: 'sb-project-auth-token',
    value: validLocalSession,
    domain: 'localhost',
    path: '/',
    expires: -1,
  }],
  origins: [{
    origin: 'http://localhost:3000',
    localStorage: [{ name: 'sb-project-auth-token', value: validLocalSession }],
  }],
};

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('fix round 2 — régressions', () => {
  it('expurge les clés de session JSON et les valeurs imbriquées', () => {
    expect(typeof runtimeApi.redactRuntimeValue).toBe('function');
    if (typeof runtimeApi.redactRuntimeValue !== 'function') return;

    const payload = {
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      authorization: 'Bearer auth-secret',
      cookie: 'session=cookie-secret',
      password: 'password-secret',
      nested: { token: 'token-secret', safe: 'visible' },
    };
    const redacted = runtimeApi.redactRuntimeValue(payload);
    const serialized = JSON.stringify(redacted);

    for (const secret of Object.values({
      access: 'access-secret',
      refresh: 'refresh-secret',
      auth: 'auth-secret',
      cookie: 'cookie-secret',
      password: 'password-secret',
      token: 'token-secret',
    })) expect(serialized).not.toContain(secret);
    expect(serialized).toContain('visible');

    const message = '{"access_token": "access secret", "authorization": "Bearer auth secret", "cookie": "sid=cookie secret", "password": "password secret"}';
    const safeMessage = runtimeApi.redactDiagnosticText(message);
    for (const secret of ['access secret', 'auth secret', 'cookie secret', 'password secret']) {
      expect(safeMessage).not.toContain(secret);
    }
  });

  it('ne résout pas les credentials pour global-audit --anon-only', () => {
    const script = source('scripts/audit/global-audit.mjs');
    expect(script).not.toContain('const YDEMO =');
    expect(script).toContain('getAuditCredentials()');
    expect(coreApi.auditModeRequiresAuth(['--anon-only'])).toBe(false);
    expect(coreApi.auditModeRequiresAuth(['--auth-only'])).toBe(true);
  });

  it('interdit les captures protégées sans authentification et marque la campagne partielle', () => {
    for (const file of ['scripts/capture_all_pages.mjs', 'scripts/capture_all_pages_mobile.mjs']) {
      const script = source(file);
      expect(script).toContain('PARTIAL / NOT VERIFIED');
      expect(script).toContain('process.exitCode');
      expect(script).toContain('captureStatusForRoute');
    }
    expect(coreApi.captureStatusForRoute({ authVerified: false, requiresAuth: true })).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.captureStatusForRoute({ authVerified: false, requiresAuth: false })).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.captureStatusForRoute({ authVerified: true, requiresAuth: true })).toBe('OK');
  });

  it('refuse un cookie opaque même avec une session localStorage valide', () => {
    const state = {
      ...validState,
      cookies: [{ ...validState.cookies[0], value: 'opaque' }],
    };
    expect(() => core.validateStorageState(state, now, 'http://localhost:3000')).toThrow(/opaque|cookie/i);
  });

  it('accepte uniquement une valeur de session Supabase structurée', () => {
    const session = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_at: now / 1000 + 3600,
    };
    const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
    expect(core.validateStorageState({
      ...validState,
      cookies: [{ ...validState.cookies[0], value: encoded }],
      origins: [{ ...validState.origins[0], localStorage: [] }],
    }, now, 'http://localhost:3000')).toBe(true);
    expect(() => core.validateStorageState({
      ...validState,
      cookies: [{ ...validState.cookies[0], value: 'opaque' }],
      origins: [{ ...validState.origins[0], localStorage: [] }],
    }, now, 'http://localhost:3000')).toThrow(/opaque|cookie/i);
  });

  it('sépare réellement deux spans imbriqués aux couleurs et rectangles distincts', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 200 } });
      await page.setContent(`
        <div>
          <span data-audit-id="legacy" style="display:inline-block;width:100px;color:rgb(255,0,0)">Rouge</span>
          <span data-audit-id="legacy" style="display:inline-block;width:140px;color:rgb(0,0,255)">Bleu</span>
        </div>
      `);
      const nodes = await extractTextElements(page);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].color).toContain('255, 0, 0');
      expect(nodes[1].color).toContain('0, 0, 255');
      expect(nodes[0].dataAuditId).not.toBe(nodes[1].dataAuditId);
      expect(nodes[0].rects[0].x).toBeLessThan(nodes[1].rects[0].x);
    } finally {
      await browser.close();
    }
  });

  it('expose un statut partial/not verified sans preuve live', () => {
    expect(typeof coreApi.auditVerificationStatus).toBe('function');
    if (typeof coreApi.auditVerificationStatus !== 'function') return;
    expect(coreApi.auditVerificationStatus({ liveVerified: false })).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.auditVerificationStatus({ liveVerified: true, errors: ['runtime'] })).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.auditVerificationStatus({ liveVerified: true, errors: [] })).toBe('VERIFIED');
  });

  it('étend le scan statique aux formats de scripts pertinents', () => {
    const staticTest = source('tests/audit/audit-scripts-static.spec.ts');
    for (const extension of ['.js', '.mjs', '.cjs', '.ts', '.mts', '.py', '.ps1']) {
      expect(staticTest).toContain(extension);
    }
  });

  it('ne laisse aucun secret dans un rapport JSON d’erreur', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'lkdv-audit-round2-'));
    const reportPath = path.join(directory, 'error.json');
    runtimeApi.writeAuditErrorReport(reportPath, new Error('authorization="Bearer message-secret"'), {
      authorization: 'Bearer object-secret',
      cookie: 'sid=cookie-secret',
      nested: { access_token: 'access-secret' },
    });
    const report = readFileSync(reportPath, 'utf8');
    for (const secret of ['message-secret', 'object-secret', 'cookie-secret', 'access-secret']) {
      expect(report).not.toContain(secret);
    }
    expect(JSON.parse(report)).toMatchObject({ status: 'ERROR' });
    rmSync(directory, { recursive: true, force: true });
  });
});
