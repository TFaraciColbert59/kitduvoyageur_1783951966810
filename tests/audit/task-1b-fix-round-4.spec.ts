import { describe, expect, it } from 'vitest';
import {
  aggregateRouteOutcomes,
  attachPageDiagnostics,
  isDiagnosticDegraded,
} from '../../scripts/audit/audit_runtime.mjs';
import { campaignIsLiveVerified } from '../../scripts/audit/run_audit_campaign.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';

function makeRequest({
  url,
  method = 'GET',
  headers = {},
  resourceType = 'fetch',
}: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
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

function makeResponse({
  url,
  status,
  resourceType = 'fetch',
}: {
  url: string;
  status: number;
  resourceType?: string;
}) {
  return {
    status: () => status,
    url: () => url,
    request: () => ({
      method: () => 'GET',
      url: () => url,
      failure: () => null,
      resourceType: () => resourceType,
      headers: () => ({}),
    }),
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

describe('Task 1B fix round 4 — aborted non bloquants', () => {
  it('conserve les aborted GET/HEAD génériques en warnings sans interrompre la route', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('requestfailed', makeRequest({ url: `${baseUrl}/resource` }));
    emitted.emit('requestfailed', makeRequest({ url: `${baseUrl}/image`, method: 'HEAD' }));

    expect(diagnostics.errors).toHaveLength(0);
    expect(diagnostics.warnings).toHaveLength(2);
    expect(diagnostics.warnings.every((entry: { type: string }) => entry.type === 'requestfailed')).toBe(true);
    expect(() => diagnostics.assertClean()).not.toThrow();

    const aggregate = aggregateRouteOutcomes([{
      id: 'hub',
      warnings: diagnostics.warnings,
      degraded: diagnostics.isDegraded(),
    }]);
    expect(aggregate.warnings).toEqual(diagnostics.warnings);
    expect(aggregate.degraded).toBe(true);
    expect(campaignIsLiveVerified({
      errorCount: 0,
      completedRouteCount: 70,
      expectedRouteCount: 70,
      warnings: aggregate.warnings,
      degradedRoutes: ['hub'],
      expectedOutcomeCount: 0,
    })).toBe(false);
    diagnostics.dispose();
  });

  it('garde toute réponse HTTP locale ≥400 fatale', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('response', makeResponse({
      url: `${baseUrl}/api/private`,
      status: 500,
      resourceType: 'fetch',
    }));

    expect(diagnostics.errors).toEqual([{
      type: 'http',
      message: 'HTTP 500 http://localhost:3000/api/private',
    }]);
    expect(diagnostics.warnings).toHaveLength(0);
    expect(() => diagnostics.assertClean()).toThrow(/runtime audit/i);
    diagnostics.dispose();
  });

  it('garde les mutations aborted et pageerror fatals', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('requestfailed', makeRequest({ url: `${baseUrl}/compte`, method: 'POST' }));
    emitted.emit('pageerror', new Error('page failure'));

    expect(diagnostics.errors.map((entry: { type: string }) => entry.type)).toEqual([
      'requestfailed',
      'pageerror',
    ]);
    expect(diagnostics.warnings).toHaveLength(0);
    expect(() => diagnostics.assertClean()).toThrow(/runtime audit/i);
    diagnostics.dispose();
  });

  it('laisse la signature PrefetchRoutes exacte silencieuse et non dégradée', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: {
        rsc: '1',
        'next-router-state-tree': 'state',
        'next-url': '/hub',
        referer: `${baseUrl}/hub`,
      },
    }));

    expect(diagnostics.errors).toHaveLength(0);
    expect(diagnostics.warnings).toHaveLength(0);
    expect(isDiagnosticDegraded(diagnostics)).toBe(false);
    diagnostics.dispose();
  });
});
