import { describe, expect, it, vi } from 'vitest';
import { joinEvent, leaveEvent, parseMutationError } from '../communityMutations';
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

describe('joinEvent / leaveEvent (contrat réel et harnais de recette)', () => {
  const client = (payload: unknown) => ({
    rpc: vi.fn().mockResolvedValue({ data: payload, error: null }),
  });

  it('lit le contrat objet {registered, waitlisted, current_participants}', async () => {
    const result = await joinEvent(
      'e1',
      client({ registered: false, waitlisted: true, current_participants: 20 }) as never,
    );
    expect(result).toEqual({
      ok: true,
      data: { registered: false, waitlisted: true, currentParticipants: 20 },
    });
  });

  it('décode aussi les charges héritées « in » / « waitlist » du harnais E2E', async () => {
    const joined = await joinEvent('e1', client('in') as never);
    expect(joined.ok && joined.data.registered).toBe(true);
    const waitlisted = await joinEvent('e2', client('waitlist') as never);
    expect(waitlisted.ok && waitlisted.data.waitlisted).toBe(true);
  });

  it('normalise une erreur applicative JSON sur une mutation', async () => {
    const failing = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: '{"code":"banned","message":"Tu ne peux pas rejoindre ce club."}' },
      }),
    };
    const result = await leaveEvent('e1', failing as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('banned');
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
