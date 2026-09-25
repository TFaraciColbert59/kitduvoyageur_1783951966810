import { describe, expect, it } from 'vitest';
import { attachPageDiagnostics } from '../../scripts/audit/audit_runtime.mjs';

type Listener = (...args: any[]) => void;
type RequestOptions = { method?: string; url?: string; failure?: string; resourceType?: string };
type ResponseOptions = { method?: string; url?: string; status?: number; resourceType?: string };

const baseUrl = 'http://localhost:3000';
const speedInsightsPath = '/_vercel/speed-insights/script.js';
const speedInsightsMimeError = `Refused to execute script from '${baseUrl}${speedInsightsPath}' because its MIME type ('text/html') is not executable, and strict MIME type checking is enabled.`;

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

function makeConsole(text: string, url = '') {
  return {
    type: () => 'error',
    text: () => text,
    location: () => ({ url }),
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

describe('audit runtime — diagnostics sans corrélation mutable', () => {
  it('ignore le message générique de resource-load sans réponse associée', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    page.emit('console', makeConsole('Failed to load resource: 404 (Not Found)'));
    expect(diagnostics.errors).toHaveLength(0);
    diagnostics.dispose();
  });

  it('ignore uniquement le refus MIME SpeedInsights connu', () => {
    const exactPage = createPage();
    const exact = attachPageDiagnostics(exactPage.page, { baseUrl, sessionMode: true });
    exactPage.emit('console', makeConsole(speedInsightsMimeError, `${baseUrl}${speedInsightsPath}`));
    expect(exact.errors).toHaveLength(0);
    exact.dispose();

    const otherErrorPage = createPage();
    const otherError = attachPageDiagnostics(otherErrorPage.page, { baseUrl, sessionMode: true });
    otherErrorPage.emit('console', makeConsole('Unexpected SpeedInsights failure', `${baseUrl}${speedInsightsPath}`));
    expect(otherError.errors).toHaveLength(1);
    otherError.dispose();

    const lookalikePage = createPage();
    const lookalike = attachPageDiagnostics(lookalikePage.page, { baseUrl, sessionMode: true });
    lookalikePage.emit('console', makeConsole(speedInsightsMimeError, `${baseUrl}${speedInsightsPath}.evil`));
    expect(lookalike.errors).toHaveLength(1);
    lookalike.dispose();
  });

  it('applique les règles requestfailed par méthode, failure et path', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    const supabaseGet = makeRequest({ method: 'GET', url: 'https://project.supabase.co/rest/v1/resource' });
    const speedGet = makeRequest({ method: 'GET', url: `${baseUrl}${speedInsightsPath}` });
    page.emit('requestfailed', supabaseGet);
    page.emit('requestfailed', speedGet);
    expect(diagnostics.errors).toHaveLength(0);

    const invalid = [
      makeRequest({ method: 'POST', url: 'https://project.supabase.co/rest/v1/resource' }),
      makeRequest({ method: 'GET', url: 'https://supabase.co.attacker.example/rest/v1/resource' }),
      makeRequest({ method: 'GET', url: `${baseUrl}/net::ERR_ABORTED` }),
      makeRequest({ method: 'GET', url: `${baseUrl}${speedInsightsPath}`, failure: 'net::ERR_ABORTED extra' }),
    ];
    for (const request of invalid) page.emit('requestfailed', request);
    expect(diagnostics.errors).toHaveLength(4);
    diagnostics.dispose();
  });

  it('ne cache pas une erreur console après POST puis GET sur la même URL', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    const url = 'https://project.supabase.co/rest/v1/resource';
    page.emit('request', makeRequest({ method: 'POST', url }));
    page.emit('request', makeRequest({ method: 'GET', url }));
    page.emit('console', makeConsole('net::ERR_ABORTED', url));
    expect(diagnostics.errors).toHaveLength(1);
    diagnostics.dispose();
  });

  it('ne devine pas la méthode d’un requestfailed SpeedInsights', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    page.emit('requestfailed', makeRequest({ method: 'UNKNOWN', url: `${baseUrl}${speedInsightsPath}` }));
    expect(diagnostics.errors).toHaveLength(1);
    diagnostics.dispose();
  });

  it('conserve une erreur HTTP et une erreur console non corrélée', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl });
    const url = `${baseUrl}/missing.js`;
    page.emit('response', makeResponse({ url, resourceType: 'script', status: 404 }));
    page.emit('console', makeConsole('Uncaught TypeError', url));
    expect(diagnostics.errors).toHaveLength(2);
    expect(diagnostics.errors.map((entry) => entry.type)).toEqual(['http', 'console']);
    diagnostics.dispose();
  });

  it('reste strict sans opt-in et conserve les autres erreurs console', () => {
    const strictPage = createPage();
    const strict = attachPageDiagnostics(strictPage.page, { baseUrl });
    strictPage.emit('requestfailed', makeRequest());
    strictPage.emit('console', makeConsole('Uncaught TypeError'));
    expect(strict.errors).toHaveLength(2);
    strict.dispose();
  });
});
