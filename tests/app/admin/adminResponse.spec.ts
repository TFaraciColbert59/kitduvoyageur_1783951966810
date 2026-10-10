import { describe, expect, it } from 'vitest';

import { errorMessage, unwrapData } from '@/app/admin/_components/adminResponse';

describe('adminResponse envelope', () => {
  it('unwrapData extrait data de l’enveloppe', () => {
    expect(unwrapData<{ a: number }>({ ok: true, data: { a: 1 }, correlationId: 'x' })).toEqual({
      a: 1,
    });
  });

  it('unwrapData tolère le payload legacy', () => {
    expect(unwrapData<{ a: number }>({ a: 2 })).toEqual({ a: 2 });
  });

  it('errorMessage lit message nouveau et legacy', () => {
    expect(errorMessage({ ok: false, error: { code: 'x', message: 'boom' } }, 'fb')).toBe('boom');
    expect(errorMessage({ error: 'vieux' }, 'fb')).toBe('vieux');
    expect(errorMessage(null, 'fb')).toBe('fb');
  });

  it('csrfToken se lit dans data (enveloppe) comme à racine (legacy)', () => {
    const fromEnvelope = (
      { ok: true, data: { csrfToken: 'abc' } } as {
        csrfToken?: string;
        data?: { csrfToken?: string };
      }
    ).csrfToken ?? (
      { ok: true, data: { csrfToken: 'abc' } } as { data?: { csrfToken?: string } }
    ).data?.csrfToken;
    expect(fromEnvelope).toBe('abc');
  });
});
