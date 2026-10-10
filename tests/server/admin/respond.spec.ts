import { describe, expect, it } from 'vitest';

import { fail, ok, rpcErrorCode } from '@/server/admin/respond';

const CID = '00000000-0000-4000-8000-000000000000';

describe('respond envelope', () => {
  it('ok expose correlationId corps + header', async () => {
    const r = ok({ a: 1 }, { correlationId: CID });
    expect(r.headers.get('x-correlation-id')).toBe(CID);
    const j = await r.json();
    expect(j).toEqual({ ok: true, data: { a: 1 }, correlationId: CID });
  });

  it('fail expose error.code + correlationId', async () => {
    const r = fail('forbidden', 'refusé', 403, CID);
    expect(r.status).toBe(403);
    const j = await r.json();
    expect(j.ok).toBe(false);
    expect(j.error.code).toBe('forbidden');
    expect(j.correlationId).toBe(CID);
  });

  it('génère un correlationId quand absent', async () => {
    const r = ok({ a: 1 });
    const j = await r.json();
    expect(j.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('rpcErrorCode tolère les préfixes Postgres', () => {
    const known = { sod_violation: 403, approval_not_found: 404 };
    expect(rpcErrorCode('ERROR: sod_violation', known)).toEqual({ code: 'sod_violation', status: 403 });
    expect(rpcErrorCode('approval_not_found', known)).toEqual({ code: 'approval_not_found', status: 404 });
    expect(rpcErrorCode('something else', known)).toBeNull();
  });
});
