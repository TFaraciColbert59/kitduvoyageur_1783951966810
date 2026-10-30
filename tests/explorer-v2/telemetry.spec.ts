import { describe, expect, it } from 'vitest';
import { blurCoordinate, sanitizeLogContext } from '@/features/explorer-v2/lib/telemetry';

describe('explorer-v2 · journalisation sans coordonnées précises', () => {
  it('arrondit les coordonnées au degré', () => {
    expect(blurCoordinate(45.92374)).toBe(46);
    expect(blurCoordinate(-6.86941)).toBe(-7);
    expect(blurCoordinate(Number.NaN)).toBe(0);
  });

  it('masque les clés sensibles et floute les positions', () => {
    const sanitized = sanitizeLogContext({
      lat: 45.92374,
      lng: 6.86941,
      email: 'someone@example.com',
      token: 'secret',
      sessionId: 'abc',
      nested: { position: { lat: 45.1, lng: 6.2 }, label: 'Chamonix' },
    }) as Record<string, unknown>;

    expect(sanitized.lat).toBe(46);
    expect(sanitized.lng).toBe(7);
    expect(sanitized.email).toBe('[masqué]');
    expect(sanitized.token).toBe('[masqué]');
    expect(sanitized.sessionId).toBe('[masqué]');
    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.position).toBe('[masqué]');
    expect(nested.label).toBe('Chamonix');
  });

  it('borne la profondeur et la taille des chaînes', () => {
    const deep = { a: { b: { c: { d: { e: 'trop profond' } } } } };
    const long = sanitizeLogContext('x'.repeat(500)) as string;
    expect(long.length).toBe(200);
    expect(JSON.stringify(sanitizeLogContext(deep))).toContain('tronqué');
  });
});
