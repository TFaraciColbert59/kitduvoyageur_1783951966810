import { describe, expect, it, vi } from 'vitest';
import { parseMutationError } from '../communityMutations';
import { normalizeRpcError, callRpc } from '../communityFeedRpc';

describe('parseMutationError', () => {
  it('décode une erreur applicative JSON (code, message, field)', () => {
    const failure = parseMutationError({
      message: '{"code":"slug_taken","message":"Ce slug est déjà pris.","field":"slug"}',
      code: 'P0001',
    });
    expect(failure).toEqual({
      ok: false,
      code: 'slug_taken',
      message: 'Ce slug est déjà pris.',
      field: 'slug',
    });
  });

  it('garde le message brut d’un trigger (non JSON) et un code de repli', () => {
    const failure = parseMutationError({
      message: 'La fin de la sortie ne peut pas précéder son début.',
      code: '23514',
    });
    expect(failure.ok).toBe(false);
    expect(failure.message).toBe('La fin de la sortie ne peut pas précéder son début.');
    expect(failure.code).toBe('23514');
    expect(failure.field).toBeNull();
  });

  it('donne un message de repli lisible sur une erreur vide ou inconnue', () => {
    expect(parseMutationError(null).message).toBe('Action impossible pour le moment. Réessaie.');
    expect(parseMutationError({ message: '   ' }).message).toBe(
      'Action impossible pour le moment. Réessaie.',
    );
    expect(parseMutationError(new Error('réseau indisponible')).message).toBe('réseau indisponible');
  });
});

describe('normalizeRpcError / callRpc', () => {
  it('normalise null et les erreurs PostgREST', () => {
    expect(normalizeRpcError(null)).toBeNull();
    expect(normalizeRpcError({ message: 'permission denied', code: '42501' })).toEqual({
      code: '42501',
      message: 'permission denied',
    });
    expect(normalizeRpcError({})?.message).toBe('Le serveur est indisponible.');
  });

  it('convertit une exception réseau en résultat d’erreur, jamais en données', async () => {
    const client = {
      rpc: () => {
        throw new Error('offline');
      },
    };
    const result = await callRpc('community_carnets_feed', {}, client);
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('offline');
  });

  it('renvoie les données telles quelles quand la RPC réussit', async () => {
    const rows = [{ id: 'c1' }];
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) };
    const result = await callRpc<Array<{ id: string }>>('community_carnets_feed', { p_limit: 1 }, client);
    expect(result).toEqual({ data: rows, error: null });
    expect(client.rpc).toHaveBeenCalledWith('community_carnets_feed', { p_limit: 1 });
  });
});
