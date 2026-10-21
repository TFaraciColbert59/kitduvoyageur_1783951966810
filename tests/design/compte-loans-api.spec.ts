/**
 * Task 8 — route `POST /api/compte/loans`.
 *
 * Contrat verrouillé :
 * - 401 sans session, aucune lecture ;
 * - `request` = offre du prêteur sur un objet qu'il possède ;
 * - `accept` = confirmation par l'emprunteur, idempotente ;
 * - `decline` = retrait par le prêteur, jamais par l'emprunteur ;
 * - `return` / `rate` / `dispute` sur les colonnes existantes ;
 * - chaque écriture est bornée aux prêts de l'utilisateur (`lender_id` OU
 *   `borrower_id`) en plus de la RLS `materiel_loans` ; jamais de clé service.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/compte/loans/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const LOAN_ID = '44444444-4444-4444-8444-444444444444';
const TODAY = new Date().toISOString().slice(0, 10);

type Row = Record<string, unknown>;
type Result = { data: Row | null; error: unknown };

interface HarnessCalls {
  tables: string[];
  inserts: Array<{ table: string; row: Row }>;
  updates: Array<{ table: string; patch: Row }>;
  deletes: string[];
  ors: string[];
}

function chain(result: Result, table: string, calls: HarnessCalls, writes: {
  insert?: Result;
  update?: Result;
  remove?: Result;
}) {
  const builder: Record<string, unknown> & { _result?: Result } = {};
  const set = (value: Result) => {
    builder._result = value;
    return builder;
  };
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.or = vi.fn((expression: string) => {
    calls.ors.push(expression);
    return builder;
  });
  builder.insert = vi.fn((row: Row) => {
    calls.inserts.push({ table, row });
    return set(writes.insert ?? { data: null, error: null });
  });
  builder.update = vi.fn((patch: Row) => {
    calls.updates.push({ table, patch });
    return set(writes.update ?? { data: null, error: null });
  });
  builder.delete = vi.fn(() => {
    calls.deletes.push(table);
    return set(writes.remove ?? { data: null, error: null });
  });
  builder.maybeSingle = vi.fn(async () => builder._result ?? result);
  builder.single = vi.fn(async () => builder._result ?? result);
  builder.then = (resolveThen: (value: Result) => unknown) =>
    Promise.resolve(builder._result ?? result).then(resolveThen);
  return builder;
}

function harness(options: {
  user?: { id: string } | null;
  ownership?: Result;
  loan?: Result;
  insert?: Result;
  update?: Result;
  remove?: Result;
} = {}) {
  const calls: HarnessCalls = { tables: [], inserts: [], updates: [], deletes: [], ors: [] };
  const user = options.user === undefined ? { id: USER_ID } : options.user;

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from: vi.fn((table: string) => {
      calls.tables.push(table);
      const base: Result =
        table === 'product_ownership'
          ? (options.ownership ?? { data: { id: ITEM_ID }, error: null })
          : (options.loan ?? { data: null, error: null });
      return chain(base, table, calls, {
        insert: options.insert,
        update: options.update,
        remove: options.remove,
      });
    }),
  };

  return { client, calls };
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/compte/loans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function use(harnessed: ReturnType<typeof harness>) {
  vi.mocked(createClient).mockResolvedValue(harnessed.client as never);
  return harnessed;
}

function lenderLoan(overrides: Row = {}): Result {
  return {
    data: {
      id: LOAN_ID,
      product_ownership_id: ITEM_ID,
      lender_id: USER_ID,
      borrower_id: OTHER_ID,
      status: 'en_cours',
      loaned_at: '2026-10-01',
      due_date: '2026-10-20',
      returned_at: null,
      lender_rating: null,
      borrower_rating: null,
      ...overrides,
    },
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/compte/loans — session et validation', () => {
  it('refuse sans session (401) sans toucher la base', async () => {
    const h = use(harness({ user: null }));

    const response = await POST(post({ action: 'request', itemId: ITEM_ID, counterpart: 'Léa' }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
    expect(h.calls.tables).toEqual([]);
  });

  it('refuse une action inconnue (400)', async () => {
    use(harness());

    const response = await POST(post({ action: 'reprendre', loanId: LOAN_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_action' });
  });

  it('refuse un corps illisible ou un champ en trop (400)', async () => {
    use(harness());

    expect((await POST(post('pas-du-json'))).status).toBe(400);
    expect((await POST(post({ action: 'return', loanId: LOAN_ID, lender_id: OTHER_ID }))).status).toBe(400);
    expect((await POST(post({ action: 'request', itemId: 'pas-un-uuid', counterpart: 'Léa' }))).status).toBe(400);
  });
});

describe('POST /api/compte/loans — request (offre du prêteur)', () => {
  it('refuse un objet qui n’appartient pas au prêteur (403)', async () => {
    const h = use(harness({ ownership: { data: null, error: null } }));

    const response = await POST(
      post({ action: 'request', itemId: ITEM_ID, borrowerId: OTHER_ID, counterpart: 'Léa' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(h.calls.inserts).toEqual([]);
  });

  it('crée un prêt en_cours au nom du prêteur (201)', async () => {
    const h = use(
      harness({
        insert: { data: { id: LOAN_ID, status: 'en_cours', lender_id: USER_ID }, error: null },
      })
    );

    const response = await POST(
      post({
        action: 'request',
        itemId: ITEM_ID,
        borrowerId: OTHER_ID,
        counterpart: 'Léa',
        dueDate: '2026-11-01',
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      loan: { id: LOAN_ID, status: 'en_cours', lender_id: USER_ID },
    });
    expect(h.calls.inserts).toEqual([
      {
        table: 'materiel_loans',
        row: {
          product_ownership_id: ITEM_ID,
          lender_id: USER_ID,
          borrower_id: OTHER_ID,
          borrower_contact: 'Léa',
          status: 'en_cours',
          loaned_at: TODAY,
          due_date: '2026-11-01',
        },
      },
    ]);
  });

  it('refuse de se prêter à soi-même (400)', async () => {
    use(harness());

    const response = await POST(
      post({ action: 'request', itemId: ITEM_ID, borrowerId: USER_ID, counterpart: 'Moi' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_counterpart' });
  });
});

describe('POST /api/compte/loans — accept / decline', () => {
  it('accept : 404 si le prêt n’est pas le sien', async () => {
    use(harness({ loan: { data: null, error: null } }));

    const response = await POST(post({ action: 'accept', loanId: LOAN_ID }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('accept : réservé à l’emprunteur, idempotent (200 deux fois, aucune écriture)', async () => {
    const h = use(harness({ user: { id: OTHER_ID }, loan: lenderLoan() }));

    const first = await POST(post({ action: 'accept', loanId: LOAN_ID }));
    const second = await POST(post({ action: 'accept', loanId: LOAN_ID }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).loan.id).toBe(LOAN_ID);
    expect((await second.json()).loan.id).toBe(LOAN_ID);
    expect(h.calls.updates).toEqual([]);
    expect(h.calls.ors).toEqual([
      `lender_id.eq.${OTHER_ID},borrower_id.eq.${OTHER_ID}`,
      `lender_id.eq.${OTHER_ID},borrower_id.eq.${OTHER_ID}`,
    ]);
  });

  it('accept : le prêteur ne confirme pas à la place de l’emprunteur (403)', async () => {
    const h = use(harness({ user: { id: USER_ID }, loan: lenderLoan() }));

    const response = await POST(post({ action: 'accept', loanId: LOAN_ID }));

    expect(response.status).toBe(403);
    expect(h.calls.updates).toEqual([]);
  });

  it('accept : 409 sur un prêt déjà rendu', async () => {
    use(
      harness({
        user: { id: OTHER_ID },
        loan: lenderLoan({ status: 'rendu', returned_at: '2026-10-10' }),
      })
    );

    const response = await POST(post({ action: 'accept', loanId: LOAN_ID }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'invalid_state' });
  });

  it('decline : l’emprunteur ne peut pas retirer le prêt (403)', async () => {
    const h = use(harness({ user: { id: OTHER_ID }, loan: lenderLoan() }));

    const response = await POST(post({ action: 'decline', loanId: LOAN_ID }));

    expect(response.status).toBe(403);
    expect(h.calls.deletes).toEqual([]);
  });

  it('decline : le prêteur retire la demande non exécutée (200)', async () => {
    const h = use(harness({ user: { id: USER_ID }, loan: lenderLoan() }));

    const response = await POST(post({ action: 'decline', loanId: LOAN_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ declined: true, loanId: LOAN_ID });
    expect(h.calls.deletes).toEqual(['materiel_loans']);
    expect(h.calls.ors).toContain(`lender_id.eq.${USER_ID},borrower_id.eq.${USER_ID}`);
  });

  it('decline : 409 une fois le prêt rendu', async () => {
    use(
      harness({
        user: { id: USER_ID },
        loan: lenderLoan({ status: 'rendu', returned_at: '2026-10-10' }),
      })
    );

    const response = await POST(post({ action: 'decline', loanId: LOAN_ID }));

    expect(response.status).toBe(409);
  });
});

describe('POST /api/compte/loans — return / rate / dispute', () => {
  it('return : marque rendu à la date du jour, borné à l’utilisateur (200)', async () => {
    const h = use(
      harness({
        loan: lenderLoan(),
        update: { data: { id: LOAN_ID, status: 'rendu', returned_at: TODAY }, error: null },
      })
    );

    const response = await POST(post({ action: 'return', loanId: LOAN_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      loan: { id: LOAN_ID, status: 'rendu', returned_at: TODAY },
    });
    expect(h.calls.updates).toEqual([
      { table: 'materiel_loans', patch: { status: 'rendu', returned_at: TODAY } },
    ]);
    expect(h.calls.ors).toContain(`lender_id.eq.${USER_ID},borrower_id.eq.${USER_ID}`);
  });

  it('return : 409 sur un litige', async () => {
    use(harness({ loan: lenderLoan({ status: 'litige' }) }));

    const response = await POST(post({ action: 'return', loanId: LOAN_ID }));

    expect(response.status).toBe(409);
  });

  it('rate : refuse avant le retour (409)', async () => {
    use(harness({ loan: lenderLoan() }));

    const response = await POST(post({ action: 'rate', loanId: LOAN_ID, rating: 4 }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_returned' });
  });

  it('rate : le prêteur note le champ borrower_rating du prêt rendu (200)', async () => {
    const h = use(
      harness({
        user: { id: USER_ID },
        loan: lenderLoan({ status: 'rendu', returned_at: '2026-10-10' }),
        update: { data: { id: LOAN_ID, borrower_rating: 4 }, error: null },
      })
    );

    const response = await POST(post({ action: 'rate', loanId: LOAN_ID, rating: 4 }));

    expect(response.status).toBe(200);
    expect(h.calls.updates).toEqual([{ table: 'materiel_loans', patch: { borrower_rating: 4 } }]);
  });

  it('rate : l’emprunteur note le champ lender_rating, jamais deux fois (409)', async () => {
    const h = use(
      harness({
        user: { id: OTHER_ID },
        loan: lenderLoan({
          status: 'rendu',
          returned_at: '2026-10-10',
          lender_rating: null,
          borrower_rating: 4,
        }),
        update: { data: { id: LOAN_ID, lender_rating: 5 }, error: null },
      })
    );

    const response = await POST(post({ action: 'rate', loanId: LOAN_ID, rating: 5 }));

    expect(response.status).toBe(200);
    expect(h.calls.updates).toEqual([{ table: 'materiel_loans', patch: { lender_rating: 5 } }]);

    const again = use(
      harness({
        user: { id: OTHER_ID },
        loan: lenderLoan({
          status: 'rendu',
          returned_at: '2026-10-10',
          lender_rating: 5,
          borrower_rating: 4,
        }),
      })
    );
    const second = await POST(post({ action: 'rate', loanId: LOAN_ID, rating: 5 }));
    expect(second.status).toBe(409);
    expect(again.calls.updates).toEqual([]);
  });

  it('dispute : passe en litige, idempotent (200)', async () => {
    const h = use(
      harness({
        loan: lenderLoan(),
        update: { data: { id: LOAN_ID, status: 'litige' }, error: null },
      })
    );

    const response = await POST(post({ action: 'dispute', loanId: LOAN_ID }));
    expect(response.status).toBe(200);
    expect(h.calls.updates).toEqual([{ table: 'materiel_loans', patch: { status: 'litige' } }]);

    const already = use(harness({ loan: lenderLoan({ status: 'litige' }) }));
    const second = await POST(post({ action: 'dispute', loanId: LOAN_ID }));
    expect(second.status).toBe(200);
    expect(already.calls.updates).toEqual([]);
  });
});

describe('garde-fou de sécurité de la route', () => {
  it('s’appuie sur la RLS materiel_loans et ne contient aucune clé service', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/compte/loans/route.ts'), 'utf8');

    expect(source).toContain("from('materiel_loans')");
    expect(source).toContain('.or(');
    expect(source).toMatch(/lender_id\.eq\.\$\{\w+\}/);
    expect(source).toMatch(/borrower_id\.eq\.\$\{\w+\}/);
    expect(source).toContain("createClient");
    expect(source).not.toMatch(/SERVICE_ROLE|service_role|serviceRole/i);
    expect(source).not.toContain('SUPABASE_SERVICE');
  });
});
