import { describe, expect, it } from 'vitest';
import { attachPageDiagnostics } from '../../scripts/audit/audit_runtime.mjs';

type Listener = (...args: any[]) => void;
type ResponseOptions = { method?: string; url?: string; status?: number; resourceType?: string };

const baseUrl = 'http://localhost:3000';
const speedInsightsUrl = `${baseUrl}/_vercel/speed-insights/script.js`;

function makeRequest({ method = 'GET', url = speedInsightsUrl, resourceType = 'script' }: { method?: string; url?: string; resourceType?: string } = {}) {
  return {
    method: () => method,
    url: () => url,
    failure: () => null,
    resourceType: () => resourceType,
  };
}

function makeResponse({ method = 'GET', url = speedInsightsUrl, status = 404, resourceType = 'script' }: ResponseOptions = {}) {
  return {
    status: () => status,
    url: () => url,
    request: () => makeRequest({ method, url, resourceType }),
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

describe('audit runtime — SpeedInsights response opt-in', () => {
  it('ignore en session le 404 exact SpeedInsights GET', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    page.emit('response', makeResponse());
    expect(diagnostics.errors).toHaveLength(0);
    diagnostics.dispose();
  });

  it('rejette le 404 exact en mode strict', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl });
    page.emit('response', makeResponse());
    expect(diagnostics.errors).toHaveLength(1);
    diagnostics.dispose();
  });

  it('rejette le 404 exact avec une méthode non GET/HEAD', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    page.emit('response', makeResponse({ method: 'POST' }));
    expect(diagnostics.errors).toHaveLength(1);
    diagnostics.dispose();
  });

  it('rejette les autres paths et statuts en session', () => {
    const page = createPage();
    const diagnostics = attachPageDiagnostics(page.page, { baseUrl, sessionMode: true });
    page.emit('response', makeResponse({ url: `${baseUrl}/_vercel/speed-insights/other.js` }));
    page.emit('response', makeResponse({ status: 500 }));
    expect(diagnostics.errors).toHaveLength(2);
    diagnostics.dispose();
  });
});
