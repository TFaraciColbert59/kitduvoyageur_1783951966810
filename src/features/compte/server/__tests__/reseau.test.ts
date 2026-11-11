import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  followUser,
  readReseauError,
  respondFollowRequest,
  unfollowUser,
} from '../reseau';

const TARGET = '00000000-0000-4000-8000-000000000002';
const REQUEST_ID = '00000000-0000-4000-8000-000000000004';

type RpcReply = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

/**
 * Faux client RPC : aucune requête réseau, aucune table simulée. Il vérifie
 * que le service n'écrit plus directement dans `user_profiles`, `user_follows`
 * ou `follow_requests` et que l'acteur n'est jamais un paramètre d'écriture.
 */
class FakeRpcClient {
  readonly calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  private readonly replies: RpcReply[] = [];

  reply(data: unknown): this {
    this.replies.push({ data, error: null });
    return this;
  }

  fail(message: string, code = 'P0001'): this {
    this.replies.push({ data: null, error: { message, code } });
    return this;
  }

  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<RpcReply> {
    this.calls.push({ fn, args });
    const reply = this.replies.shift();
    if (!reply) throw new Error(`unexpected_rpc:${fn}`);
    return reply;
  }
}

function asClient(fake: FakeRpcClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

function sourceOf(name: string): string {
  const source = readFileSync(fileURLToPath(new URL('../reseau.ts', import.meta.url)), 'utf8');
  const start = source.indexOf(`export async function ${name}`);
  expect(start, `fonction ${name} introuvable`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('reseau — suivre une cible (contrat RPC)', () => {
  it('suit une cible publique et ne transmet que la cible', async () => {
    const db = new FakeRpcClient().reply('following');

    await expect(followUser(asClient(db), TARGET)).resolves.toEqual({ status: 'following' });
    expect(db.calls).toEqual([{ fn: 'reseau_follow', args: { p_target_id: TARGET } }]);
  });

  it('demande à suivre une cible privée sans réécrire la décision côté client', async () => {
    const db = new FakeRpcClient().reply('requested');

    await expect(followUser(asClient(db), TARGET)).resolves.toEqual({ status: 'requested' });
    expect(db.calls).toEqual([{ fn: 'reseau_follow', args: { p_target_id: TARGET } }]);
  });

  it('mappe self, blocked, cible inconnue et demande close', async () => {
    for (const code of ['self', 'blocked', 'target_not_found', 'follow_request_closed']) {
      const db = new FakeRpcClient().fail(code);
      await expect(followUser(asClient(db), TARGET)).rejects.toThrow(code);
    }
  });

  it('ramène les erreurs SQL inconnues à follow_failed, sans fuite de détail', async () => {
    const db = new FakeRpcClient().fail('permission denied for table user_profiles', '42501');

    await expect(followUser(asClient(db), TARGET)).rejects.toThrow('follow_failed');
  });

  it('refuse un résultat RPC hors du vocabulaire borné', async () => {
    for (const data of [null, 42, 'accepted', { status: 'following' }]) {
      const db = new FakeRpcClient().reply(data);
      await expect(followUser(asClient(db), TARGET)).rejects.toThrow('follow_failed');
    }
  });

  it('n’accepte aucun identifiant d’acteur dans sa signature', () => {
    expect(followUser.length).toBe(2);
    const body = sourceOf('followUser');
    expect(body).toContain("rpc('reseau_follow'");
    expect(body).not.toContain('user_profiles');
    expect(body).not.toContain('service_role');
    expect(body).not.toContain('privileged');
  });
});

describe('reseau — révoquer un suivi (contrat RPC)', () => {
  it('révoque via la RPC et renvoie un résultat borné', async () => {
    const db = new FakeRpcClient().reply('unfollowed');

    await expect(unfollowUser(asClient(db), TARGET)).resolves.toBeUndefined();
    expect(db.calls).toEqual([{ fn: 'reseau_unfollow', args: { p_target_id: TARGET } }]);
  });

  it('refuse un résultat inattendu sans supposer la révocation faite', async () => {
    const db = new FakeRpcClient().reply('following');
    await expect(unfollowUser(asClient(db), TARGET)).rejects.toThrow('unfollow_failed');
  });

  it('mappe les erreurs de révocation', async () => {
    const db = new FakeRpcClient().fail('blocked');
    await expect(unfollowUser(asClient(db), TARGET)).rejects.toThrow('blocked');

    const unknown = new FakeRpcClient().fail('deadlock detected', '40P01');
    await expect(unfollowUser(asClient(unknown), TARGET)).rejects.toThrow('unfollow_failed');
  });

  it('n’accepte aucun identifiant d’acteur dans sa signature', () => {
    expect(unfollowUser.length).toBe(2);
    const body = sourceOf('unfollowUser');
    expect(body).toContain("rpc('reseau_unfollow'");
    expect(body).not.toContain('user_profiles');
    expect(body).not.toContain('service_role');
  });
});

describe('reseau — répondre à une demande (contrat RPC)', () => {
  it('accepte une demande et transmet uniquement demande + action', async () => {
    const db = new FakeRpcClient().reply('accepted');

    await expect(
      respondFollowRequest(asClient(db), REQUEST_ID, 'accept')
    ).resolves.toBeUndefined();
    expect(db.calls).toEqual([
      {
        fn: 'reseau_respond_follow_request',
        args: { p_request_id: REQUEST_ID, p_action: 'accept' },
      },
    ]);
  });

  it('refuse une demande et attend le statut correspondant', async () => {
    const db = new FakeRpcClient().reply('declined');

    await expect(
      respondFollowRequest(asClient(db), REQUEST_ID, 'decline')
    ).resolves.toBeUndefined();
    expect(db.calls).toEqual([
      {
        fn: 'reseau_respond_follow_request',
        args: { p_request_id: REQUEST_ID, p_action: 'decline' },
      },
    ]);
  });

  it('refuse un statut qui ne correspond pas à l’action demandée', async () => {
    const db = new FakeRpcClient().reply('declined');
    await expect(
      respondFollowRequest(asClient(db), REQUEST_ID, 'accept')
    ).rejects.toThrow('respond_failed');
  });

  it('refuse un résultat RPC malformé', async () => {
    for (const data of [null, 'pending', { status: 'accepted' }]) {
      const db = new FakeRpcClient().reply(data);
      await expect(
        respondFollowRequest(asClient(db), REQUEST_ID, 'accept')
      ).rejects.toThrow('respond_failed');
    }
  });

  it('mappe les refus métier sans exposer le message SQL', async () => {
    for (const code of ['request_not_found', 'request_not_pending', 'blocked', 'invalid_action']) {
      const db = new FakeRpcClient().fail(code);
      await expect(
        respondFollowRequest(asClient(db), REQUEST_ID, 'accept')
      ).rejects.toThrow(code);
    }

    const unknown = new FakeRpcClient().fail('relation does not exist', '42P01');
    await expect(
      respondFollowRequest(asClient(unknown), REQUEST_ID, 'decline')
    ).rejects.toThrow('respond_failed');
  });

  it('n’accepte ni acteur ni client privilégié dans sa signature', () => {
    expect(respondFollowRequest.length).toBe(3);
    const body = sourceOf('respondFollowRequest');
    expect(body).toContain("rpc('reseau_respond_follow_request'");
    expect(body).not.toContain('user_profiles');
    expect(body).not.toContain('createServiceClient');
    expect(body).not.toContain('service_role');
    expect(body).not.toContain('privileged');
  });
});

describe('reseau — lecture bornée des erreurs', () => {
  it('ne laisse passer que le vocabulaire connu', () => {
    expect(readReseauError(new Error('blocked'), 'follow_failed')).toBe('blocked');
    expect(readReseauError({ message: ' target_not_found ' }, 'follow_failed')).toBe(
      'target_not_found'
    );
    expect(readReseauError(new Error('permission denied'), 'follow_failed')).toBe(
      'follow_failed'
    );
    expect(readReseauError('blocked', 'follow_failed')).toBe('follow_failed');
    expect(readReseauError(null, 'follow_failed')).toBe('follow_failed');
  });
});
