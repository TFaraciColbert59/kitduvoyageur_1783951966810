import { describe, expect, it, vi } from 'vitest';
import {
  PROMOTION_ERROR_CODES,
  PromotionError,
  evaluateModelPromotion,
  getActivePromotion,
  promoteModelVersion,
} from '@/features/promotions/server/promotionService';

const SECRET = 'sb_rst_super_secret_value';

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

function client(result: RpcResult) {
  return {
    rpc: vi.fn(async () => result),
    from: vi.fn(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => result),
      };
      return chain;
    }),
  } as never;
}

const okRow = (status: string) => ({
  data: [{ status, model_version: 'v1.0.0', score: '0.912300', promoted: status === 'promoted' }],
  error: null,
});

describe('evaluateModelPromotion', () => {
  it('renvoie le statut pending sans promouvoir', async () => {
    const db = client(okRow('pending'));
    const outcome = await evaluateModelPromotion(db, {
      modelVersion: 'v1.0.0',
      score: 0.9,
      evidence: { n: 10 },
    });
    expect(outcome).toEqual({
      status: 'pending',
      modelVersion: 'v1.0.0',
      score: 0.9123,
      promoted: false,
    });
  });

  it('transmet p_promote a la RPC', async () => {
    const db = client(okRow('promoted'));
    const rpc = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    await evaluateModelPromotion(db, {
      modelVersion: 'v1.0.0',
      score: 1,
      evidence: {},
      promote: true,
    });
    expect(rpc).toHaveBeenCalledWith('evaluate_model_promotion', {
      p_model_version: 'v1.0.0',
      p_score: 1,
      p_evidence: {},
      p_promote: true,
    });
  });

  it('rejette une entree invalide SANS toucher la base', async () => {
    const db = client(okRow('pending'));
    const rpc = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    await expect(
      evaluateModelPromotion(db, { modelVersion: 'v 1', score: 0.5, evidence: {} })
    ).rejects.toMatchObject({ code: PROMOTION_ERROR_CODES.validation });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('mapDatabaseError (via les appels publics)', () => {
  const cases: Array<[string, string]> = [
    ['42501', PROMOTION_ERROR_CODES.forbidden],
    ['22023', PROMOTION_ERROR_CODES.validation],
    ['23514', PROMOTION_ERROR_CODES.validation],
    ['23502', PROMOTION_ERROR_CODES.validation],
    ['55000', PROMOTION_ERROR_CODES.conflict],
    ['23505', PROMOTION_ERROR_CODES.conflict],
    ['PGRST116', PROMOTION_ERROR_CODES.unavailable],
    ['42883', PROMOTION_ERROR_CODES.unavailable],
    ['42P01', PROMOTION_ERROR_CODES.unavailable],
    ['XX000', PROMOTION_ERROR_CODES.unknown],
  ];

  for (const [sqlState, expected] of cases) {
    it(`mappe ${sqlState} -> ${expected}`, async () => {
      const db = client({
        data: null,
        error: { code: sqlState, message: `DETAIL: ${SECRET} at /srv/pg/secret.sql line 42` },
      });
      await expect(
        evaluateModelPromotion(db, { modelVersion: 'v1.0.0', score: 0.5, evidence: {} })
      ).rejects.toMatchObject({ code: expected });
    });
  }

  it('ne propage JAMAIS le message Postgres (pas de fuite de secret)', async () => {
    const db = client({
      data: null,
      error: { code: '42501', message: `role "svc" denied: key=${SECRET}` },
    });
    const error = await evaluateModelPromotion(db, {
      modelVersion: 'v1.0.0',
      score: 0.5,
      evidence: {},
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PromotionError);
    expect((error as Error).message).not.toContain(SECRET);
    expect(JSON.stringify(error)).not.toContain(SECRET);
  });

  it('marque retryable uniquement les erreurs transitoires', async () => {
    const transient = client({ data: null, error: { code: 'PGRST116' } });
    await expect(
      promoteModelVersion(transient, { modelVersion: 'v1' })
    ).rejects.toMatchObject({ retryable: true });

    const permanent = client({ data: null, error: { code: '42501' } });
    await expect(promoteModelVersion(permanent, { modelVersion: 'v1' })).rejects.toMatchObject({
      retryable: false,
    });
  });
});

describe('toOutcome (reponse inexploitable)', () => {
  it('ligne vide -> unavailable retryable', async () => {
    const db = client({ data: [], error: null });
    await expect(
      evaluateModelPromotion(db, { modelVersion: 'v1.0.0', score: 0.5, evidence: {} })
    ).rejects.toMatchObject({ code: PROMOTION_ERROR_CODES.unavailable, retryable: true });
  });

  it('colonnes nulles -> unavailable retryable', async () => {
    const db = client({ data: [{ status: null, model_version: null, score: null }], error: null });
    await expect(
      promoteModelVersion(db, { modelVersion: 'v1.0.0' })
    ).rejects.toMatchObject({ code: PROMOTION_ERROR_CODES.unavailable });
  });

  it('accepte une valeur numerique (pas seulement une string)', async () => {
    const db = client({
      data: [{ status: 'promoted', model_version: 'v2', score: 0.75, promoted: true }],
      error: null,
    });
    await expect(promoteModelVersion(db, { modelVersion: 'v2' })).resolves.toEqual({
      status: 'promoted',
      modelVersion: 'v2',
      score: 0.75,
      promoted: true,
    });
  });
});

describe('promoteModelVersion', () => {
  it('appelle promote_model_version avec le seul modelVersion', async () => {
    const db = client(okRow('promoted'));
    const rpc = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    await promoteModelVersion(db, { modelVersion: 'v1.0.0' });
    expect(rpc).toHaveBeenCalledWith('promote_model_version', { p_model_version: 'v1.0.0' });
  });

  it('remonte en conflict (409) si la promotion n est pas pending', async () => {
    const db = client({ data: null, error: { code: '55000', message: 'not_pending' } });
    await expect(promoteModelVersion(db, { modelVersion: 'v1.0.0' })).rejects.toMatchObject({
      code: PROMOTION_ERROR_CODES.conflict,
    });
  });

  it('rejette une version invalide SANS toucher la base', async () => {
    const db = client(okRow('promoted'));
    const rpc = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    await expect(promoteModelVersion(db, { modelVersion: '' })).rejects.toMatchObject({
      code: PROMOTION_ERROR_CODES.validation,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('getActivePromotion', () => {
  it('renvoie null si aucune promotion active', async () => {
    const db = client({ data: null, error: null });
    await expect(getActivePromotion(db)).resolves.toBeNull();
  });

  it('renvoie la promotion active', async () => {
    const db = client({
      data: { status: 'promoted', model_version: 'v9', score: 0.99 },
      error: null,
    });
    await expect(getActivePromotion(db)).resolves.toEqual({
      status: 'promoted',
      modelVersion: 'v9',
      score: 0.99,
      promoted: true,
    });
  });

  it('applique le mapping d erreur', async () => {
    const db = client({ data: null, error: { code: '42501', message: SECRET } });
    await expect(getActivePromotion(db)).rejects.toMatchObject({
      code: PROMOTION_ERROR_CODES.forbidden,
    });
  });
});
