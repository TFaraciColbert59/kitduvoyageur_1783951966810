import { describe, it, expect } from 'vitest';
import {
  CORRELATION_ID_HEADER,
  correlationResponseHeaders,
  isCorrelationId,
  readCorrelationId,
  resolveCorrelationId,
  sanitizeCorrelationId,
} from '@/lib/observability/correlation';

const VALID = 'a1000000-0000-4000-8000-0000000000aa';
const OTHER = 'b2000000-0000-4000-8000-0000000000bb';
const INVALID = 'pas-un-uuid';
const EMAIL = 'alice@example.com';

function headerReader(value: string | null) {
  return { headers: { get: (name: string) => (name === CORRELATION_ID_HEADER ? value : null) } };
}

describe('Phase 10 — corrélation (TEST-P10-CORR)', () => {
  it('TEST-P10-CORR-01: reconnaît un UUID valide, refuse le reste sans le copier', () => {
    expect(isCorrelationId(VALID)).toBe(true);
    expect(isCorrelationId(VALID.toUpperCase())).toBe(true);
    expect(isCorrelationId(INVALID)).toBe(false);
    expect(isCorrelationId('')).toBe(false);
    expect(isCorrelationId(null)).toBe(false);
    expect(isCorrelationId(42)).toBe(false);
    expect(sanitizeCorrelationId(VALID)).toBe(VALID);
    expect(sanitizeCorrelationId(INVALID)).toBeNull();
  });

  it('TEST-P10-CORR-02: priorité corps > en-tête (continuité de chaîne)', () => {
    const resolution = resolveCorrelationId({ body: VALID, header: OTHER });

    expect(resolution).toEqual({
      correlationId: VALID,
      source: 'body',
      bodyRejected: false,
      headerRejected: false,
    });
  });

  it('TEST-P10-CORR-03: en-tête valide utilisé en absence de corps', () => {
    const resolution = resolveCorrelationId({ header: VALID });

    expect(resolution.correlationId).toBe(VALID);
    expect(resolution.source).toBe('header');
    expect(resolution.bodyRejected).toBe(false);
    expect(resolution.headerRejected).toBe(false);
  });

  it('TEST-P10-CORR-04: entrée invalide ⇒ UUID généré, valeur refusée jamais recopiée', () => {
    let generated = 0;
    const resolution = resolveCorrelationId({
      header: EMAIL,
      body: INVALID,
      generate: () => {
        generated += 1;
        return VALID;
      },
    });

    expect(resolution.correlationId).toBe(VALID);
    expect(resolution.source).toBe('generated');
    expect(resolution.bodyRejected).toBe(true);
    expect(resolution.headerRejected).toBe(true);
    expect(JSON.stringify(resolution)).not.toContain(EMAIL);
    expect(JSON.stringify(resolution)).not.toContain(INVALID);
    expect(generated).toBe(1);
  });

  it('TEST-P10-CORR-05: corps invalide + en-tête valide ⇒ en-tête retenu, corps signalé refusé', () => {
    const resolution = resolveCorrelationId({ body: INVALID, header: VALID });

    expect(resolution.correlationId).toBe(VALID);
    expect(resolution.source).toBe('header');
    expect(resolution.bodyRejected).toBe(true);
    expect(resolution.headerRejected).toBe(false);
  });

  it('TEST-P10-CORR-06: génération par défaut toujours un UUID valide', () => {
    const resolution = resolveCorrelationId({});

    expect(isCorrelationId(resolution.correlationId)).toBe(true);
    expect(resolution.source).toBe('generated');
  });

  it('TEST-P10-CORR-07: lecture en-tête robuste (Headers réels, absence, exception)', () => {
    const headers = new Headers({ [CORRELATION_ID_HEADER]: VALID });
    expect(readCorrelationId({ headers: { get: (name) => headers.get(name) } })).toBe(VALID);
    expect(readCorrelationId(headerReader(null))).toBeNull();
    expect(readCorrelationId(headerReader(INVALID))).toBeNull();
    expect(readCorrelationId(null)).toBeNull();
    expect(
      readCorrelationId({
        headers: {
          get: () => {
            throw new Error('header inaccessible');
          },
        },
      })
    ).toBeNull();
  });

  it('TEST-P10-CORR-08: en-tête de réponse porte le nom canonique', () => {
    expect(correlationResponseHeaders(VALID)).toEqual({ 'x-correlation-id': VALID });
  });
});
