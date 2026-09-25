import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { attachPageDiagnostics } from '../../scripts/audit/audit_runtime.mjs';

type Listener = (...args: any[]) => void;
type RequestOptions = { method?: string; url?: string; failure?: string; resourceType?: string };
type ResponseOptions = { method?: string; url?: string; status?: number; resourceType?: string };

const baseUrl = 'http://localhost:3000';

function makeRequest({ method = 'GET', url = `${baseUrl}/resource`, failure = 'net::ERR_ABORTED', resourceType = 'fetch' }: RequestOptions = {}) {
  return {
    method: () => method,
    url: () => url,
    failure: () => ({ errorText: failure }),
    resourceType: () => resourceType,
  };
}

function makeResponse({ method = 'GET', url = `${baseUrl}/compte`, status = 404, resourceType = 'document' }: ResponseOptions = {}) {
  return {
    status: () => status,
    url: () => url,
    request: () => makeRequest({ method, url, failure: 'response', resourceType }),
  };
}

function makeConsole(text: string, url?: string) {
  return {
    type: () => 'error',
    text: () => text,
    location: () => (url ? { url } : { url: '' }),
  };
}

function createPage() {
  const listeners = new Map<string, Listener>();
  const page = {
    on(event: string, listener: Listener) {
      listeners.set(event, listener);
    },
    off(event: string) {
      listeners.delete(event);
    },
  };
  return {
    page,
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.(...args);
    },
  };
}

describe('audit runtime — session opt-in', () => {
  it('reste strict par défaut et autorise le GET aborted same-origin en session', () => {
    const strictPage = createPage();
    const strict = attachPageDiagnostics(strictPage.page, { baseUrl });
    strictPage.emit('request', makeRequest());
    strictPage.emit('requestfailed', makeRequest());
    expect(strict.errors).toHaveLength(1);
    strict.dispose();

    const sessionPage = createPage();
    const session = attachPageDiagnostics(sessionPage.page, { baseUrl, sessionMode: true });
    sessionPage.emit('request', makeRequest());
    sessionPage.emit('requestfailed', makeRequest());
    expect(session.errors).toHaveLength(0);
    session.dispose();
  });

  it('ne contourne pas aborted pour POST, un pathname piégé ou un failureText non exact', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    const cases = [
      makeRequest({ method: 'POST' }),
      makeRequest({ url: `${baseUrl}/net::ERR_ABORTED` }),
      makeRequest({ failure: 'net::ERR_ABORTED extra' }),
    ];
    for (const request of cases) {
      page.emit('request', request);
      page.emit('requestfailed', request);
    }
    expect(diagnostics.errors).toHaveLength(3);
    diagnostics.dispose();
  });

  it('autorise uniquement le path SpeedInsights exact', () => {
    const exactPage = createPage();
    const exact = attachPageDiagnostics(exactPage.page, { baseUrl, sessionMode: true });
    exactPage.emit('console', makeConsole('Failed to load resource', `${baseUrl}/_vercel/speed-insights/script.js`));
    expect(exact.errors).toHaveLength(0);
    exact.dispose();

    const lookalikePage = createPage();
    const lookalike = attachPageDiagnostics(lookalikePage.page, { baseUrl, sessionMode: true });
    lookalikePage.emit('console', makeConsole('Unexpected SpeedInsights failure', `${baseUrl}/_vercel/speed-insights/script.js.evil`));
    expect(lookalike.errors).toHaveLength(0);
    expect(lookalike.warnings).toHaveLength(1);
    lookalike.dispose();
  });

  it('autorise Supabase uniquement pour un hostname exact et GET/HEAD', () => {
    const exactPage = createPage();
    const exact = attachPageDiagnostics(exactPage.page, { baseUrl, sessionMode: true });
    const exactRequest = makeRequest({ url: 'https://project.supabase.co/rest/v1/resource', method: 'GET' });
    exactPage.emit('request', exactRequest);
    exactPage.emit('console', makeConsole('net::ERR_ABORTED', 'https://project.supabase.co/rest/v1/resource'));
    expect(exact.errors).toHaveLength(0);
    expect(exact.warnings).toHaveLength(1);
    exact.dispose();

    const lookalikePage = createPage();
    const lookalike = attachPageDiagnostics(lookalikePage.page, { baseUrl, sessionMode: true });
    const lookalikeRequest = makeRequest({ url: 'https://supabase.co.attacker.example/rest/v1/resource', method: 'GET' });
    lookalikePage.emit('request', lookalikeRequest);
    lookalikePage.emit('console', makeConsole('net::ERR_ABORTED', 'https://supabase.co.attacker.example/rest/v1/resource'));
    expect(lookalike.errors).toHaveLength(0);
    expect(lookalike.warnings).toHaveLength(1);
    lookalike.dispose();

    const pathTrapPage = createPage();
    const pathTrap = attachPageDiagnostics(pathTrapPage.page, { baseUrl, sessionMode: true });
    const pathTrapRequest = makeRequest({ url: 'https://project.supabase.co/rest/v1/net::ERR_ABORTED', method: 'GET' });
    pathTrapPage.emit('request', pathTrapRequest);
    pathTrapPage.emit('console', makeConsole('net::ERR_ABORTED', 'https://project.supabase.co/rest/v1/net::ERR_ABORTED'));
    expect(pathTrap.errors).toHaveLength(0);
    expect(pathTrap.warnings).toHaveLength(1);
    pathTrap.dispose();

    const postPage = createPage();
    const post = attachPageDiagnostics(postPage.page, { baseUrl, sessionMode: true });
    const postRequest = makeRequest({ url: 'https://project.supabase.co/rest/v1/resource', method: 'POST' });
    postPage.emit('request', postRequest);
    postPage.emit('console', makeConsole('net::ERR_ABORTED', 'https://project.supabase.co/rest/v1/resource'));
    expect(post.errors).toHaveLength(0);
    expect(post.warnings).toHaveLength(1);
    post.dispose();
  });

  it('ajoute les erreurs HTTP same-origin resources et ignore les réponses externes', () => {
    const localPage = createPage();
    const local = attachPageDiagnostics(localPage.page, { baseUrl });
    for (const resourceType of ['document', 'script', 'stylesheet', 'font', 'image']) {
      localPage.emit('response', makeResponse({ resourceType, status: 404 }));
    }
    expect(local.errors).toHaveLength(5);
    local.dispose();

    const externalPage = createPage();
    const external = attachPageDiagnostics(externalPage.page, { baseUrl });
    externalPage.emit('response', makeResponse({ url: 'https://cdn.example.test/asset.js', status: 404, resourceType: 'script' }));
    expect(external.errors).toHaveLength(0);
    external.dispose();
  });

  it('couvre les responses HTTP sans dupliquer le Failed to load resource console', () => {
    const localPage = createPage();
    const local = attachPageDiagnostics(localPage.page, { baseUrl, sessionMode: true });
    const localResponse = makeResponse({ url: `${baseUrl}/missing.js`, status: 404, resourceType: 'script' });
    localPage.emit('response', localResponse);
    localPage.emit('console', makeConsole('Failed to load resource: 404', `${baseUrl}/missing.js`));
    expect(local.errors).toHaveLength(1);
    local.dispose();

    const externalPage = createPage();
    const external = attachPageDiagnostics(externalPage.page, { baseUrl, sessionMode: true });
    const externalResponse = makeResponse({ url: 'https://project.supabase.co/rest/v1/resource', status: 403, resourceType: 'fetch' });
    externalPage.emit('response', externalResponse);
    externalPage.emit('console', makeConsole('Failed to load resource: 403', 'https://project.supabase.co/rest/v1/resource'));
    expect(external.errors).toHaveLength(0);
    external.dispose();
  });

  it('ne permet jamais à pageerror de devenir ignorable', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    page.emit('pageerror', new Error('page failure'));
    expect(diagnostics.errors).toHaveLength(1);
    expect(() => diagnostics.assertClean()).toThrow(/runtime audit/i);
    diagnostics.dispose();
  });

  it('redacte le message du catch runner', () => {
    const source = readFileSync(path.join(process.cwd(), 'scripts/audit/create_test_session.mjs'), 'utf8');
    expect(source).toContain('redactDiagnosticText(error.message)');
  });
});
