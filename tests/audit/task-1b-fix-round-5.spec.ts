import { describe, expect, it } from 'vitest';
import { attachPageDiagnostics } from '../../scripts/audit/audit_runtime.mjs';
import { routeDiagnosticsOptions } from '../../scripts/audit/measure_contrast_v2.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';
const expected404Url = `${baseUrl}/dev/glass`;

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

function makeResponse(method: string) {
  const request = {
    method: () => method,
    url: () => expected404Url,
    failure: () => null,
    resourceType: () => 'document',
    headers: () => ({}),
  };
  return {
    status: () => 404,
    url: () => expected404Url,
    request: () => request,
  };
}

function diagnosticsFor(method: string) {
  const emitted = createPage();
  const diagnostics = attachPageDiagnostics(emitted.page, {
    baseUrl,
    expected404Path: '/dev/glass',
  });
  emitted.emit('response', makeResponse(method));
  return diagnostics;
}

describe('Task 1B fix round 5 — 404 attendu par méthode', () => {
  it('configure les diagnostics avec la route 404 attendue', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(
      emitted.page,
      routeDiagnosticsOptions(baseUrl, '/dev/glass'),
    );
    emitted.emit('response', makeResponse('GET'));

    expect(diagnostics.errors).toEqual([]);
    expect(() => diagnostics.assertClean()).not.toThrow();
    diagnostics.dispose();
  });

  it.each(['GET', 'HEAD'])('ignore le 404 attendu en %s', (method) => {
    const diagnostics = diagnosticsFor(method);

    expect(diagnostics.errors).toEqual([]);
    expect(diagnostics.warnings).toEqual([]);
    expect(() => diagnostics.assertClean()).not.toThrow();
    diagnostics.dispose();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuse le 404 attendu en %s', (method) => {
    const diagnostics = diagnosticsFor(method);

    expect(diagnostics.errors).toEqual([{
      type: 'http',
      message: `HTTP 404 ${expected404Url}`,
    }]);
    expect(diagnostics.warnings).toEqual([]);
    expect(() => diagnostics.assertClean()).toThrow(/runtime audit/i);
    diagnostics.dispose();
  });
});
