import { describe, expect, it } from 'vitest';
import { attachPageDiagnostics } from '../../scripts/audit/audit_runtime.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';

function makeRequest({
  url,
  headers = {},
  method = 'GET',
  resourceType = 'fetch',
}: {
  url: string;
  headers?: Record<string, string>;
  method?: string;
  resourceType?: string;
}) {
  return {
    method: () => method,
    url: () => url,
    failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    resourceType: () => resourceType,
    headers: () => headers,
  };
}

function createPage() {
  const listeners = new Map<string, Listener>();
  return {
    page: {
      on(event: string, listener: Listener) {
        listeners.set(event, listener);
      },
      off(event: string) {
        listeners.delete(event);
      },
    },
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.(...args);
    },
  };
}

describe('Task 1B fix round 3 — PrefetchRoutes strict', () => {
  it('accepte la signature Next complète et refuse RSC seul ou _rsc seul', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl, sessionMode: true });

    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: {
        rsc: '1',
        'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22hub%22%5D%7D%5D',
        'next-url': '/hub',
        referer: `${baseUrl}/hub`,
      },
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/rsc-only`,
      headers: { rsc: '1' },
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/query-only?_rsc=cache-key`,
    }));

    expect(diagnostics.errors).toHaveLength(2);
    expect(diagnostics.errors.map((entry: { type: string }) => entry.type)).toEqual([
      'requestfailed',
      'requestfailed',
    ]);
    expect(diagnostics.errors[0].message).toContain('/rsc-only');
    expect(diagnostics.errors[1].message).toContain('/query-only');
    diagnostics.dispose();
  });
});
