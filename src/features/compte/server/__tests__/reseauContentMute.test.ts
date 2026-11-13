import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { muteContentUser, unmuteContentUser } from '../reseau';

const VIEWER = '00000000-0000-4000-8000-000000000001';
const TARGET = '00000000-0000-4000-8000-000000000002';

interface DbError {
  message: string;
  code?: string;
}

class FakeContentMuteClient {
  readonly insertCalls: Array<{ table: string; row: Record<string, unknown> }> = [];
  readonly deleteCalls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  private insertError: DbError | null;
  private deleteError: DbError | null;

  constructor(options: { insertError?: DbError; deleteError?: DbError } = {}) {
    this.insertError = options.insertError ?? null;
    this.deleteError = options.deleteError ?? null;
  }

  from(table: string) {
    return {
      insert: async (row: Record<string, unknown>) => {
        this.insertCalls.push({ table, row });
        return { error: this.insertError };
      },
      delete: () => {
        const call = { table, filters: [] as Array<[string, unknown]> };
        this.deleteCalls.push(call);
        const result = { error: this.deleteError };
        const chain = {
          eq(column: string, value: unknown) {
            call.filters.push([column, value]);
            return chain;
          },
          then(
            onFulfilled: (value: { error: DbError | null }) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) {
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };
        return chain;
      },
    };
  }
}

function asClient(fake: FakeContentMuteClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

function bodyOf(name: string): string {
  const source = readFileSync(fileURLToPath(new URL('../reseau.ts', import.meta.url)), 'utf8');
  const start = source.indexOf(`export async function ${name}`);
  expect(start, `fonction ${name} introuvable`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('reseau — sourdine de contenu', () => {
  it('insère la paire lecteur/cible sans transmettre d’acteur', async () => {
    const db = new FakeContentMuteClient();

    await expect(muteContentUser(asClient(db), VIEWER, TARGET)).resolves.toEqual({
      contentMuted: true,
    });
    expect(db.insertCalls).toEqual([
      {
        table: 'user_content_mutes',
        row: { muter_id: VIEWER, muted_id: TARGET },
      },
    ]);
  });

  it('traite une sourdine déjà posée comme un succès idempotent', async () => {
    const db = new FakeContentMuteClient({
      insertError: { message: 'duplicate key', code: '23505' },
    });

    await expect(muteContentUser(asClient(db), VIEWER, TARGET)).resolves.toEqual({
      contentMuted: true,
    });
  });

  it('mappe une cible inconnue et une erreur inconnue sans fuite SQL', async () => {
    const missing = new FakeContentMuteClient({
      insertError: { message: 'foreign key violation', code: '23503' },
    });
    await expect(muteContentUser(asClient(missing), VIEWER, TARGET)).rejects.toThrow(
      'target_not_found'
    );

    const denied = new FakeContentMuteClient({
      insertError: { message: 'permission denied for table user_content_mutes', code: '42501' },
    });
    await expect(muteContentUser(asClient(denied), VIEWER, TARGET)).rejects.toThrow(
      'content_mute_failed'
    );
  });

  it('refuse sa propre personne sans écrire', async () => {
    const db = new FakeContentMuteClient();

    await expect(muteContentUser(asClient(db), VIEWER, VIEWER)).rejects.toThrow('self');
    expect(db.insertCalls).toHaveLength(0);
  });

  it('révoque par les deux colonnes de la clé et remonte un échec borné', async () => {
    const db = new FakeContentMuteClient();
    await expect(unmuteContentUser(asClient(db), VIEWER, TARGET)).resolves.toEqual({
      contentMuted: false,
    });
    expect(db.deleteCalls).toEqual([
      {
        table: 'user_content_mutes',
        filters: [
          ['muter_id', VIEWER],
          ['muted_id', TARGET],
        ],
      },
    ]);

    const failed = new FakeContentMuteClient({
      deleteError: { message: 'deadlock detected', code: '40P01' },
    });
    await expect(unmuteContentUser(asClient(failed), VIEWER, TARGET)).rejects.toThrow(
      'content_unmute_failed'
    );
  });

  it('ne dépend d’aucun client privilégié et garde la cible comme seul paramètre d’écriture', () => {
    const mute = bodyOf('muteContentUser');
    const unmute = bodyOf('unmuteContentUser');

    expect(mute).toContain("from('user_content_mutes')");
    expect(unmute).toContain("from('user_content_mutes')");
    expect(mute).toContain('muter_id: userId');
    expect(mute).toContain('muted_id: targetId');
    expect(mute).not.toContain('service_role');
    expect(mute).not.toContain('createServiceClient');
    expect(unmute).not.toContain('service_role');
    expect(unmute).not.toContain('createServiceClient');
    expect(muteContentUser.length).toBe(3);
    expect(unmuteContentUser.length).toBe(3);
  });
});
