import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { STARTABLE_VARIANTS } from '@/features/explorer-v2/server/activityStart';

const MIGRATION = path.resolve(
  __dirname,
  '../../supabase/migrations/20261111120000_explorer_v2_activity_start.sql'
);
const ROLLBACK = path.resolve(
  __dirname,
  '../../supabase/migrations_down/20261111120000_explorer_v2_activity_start.down.sql'
);

const sql = readFileSync(MIGRATION, 'utf8');
const lower = sql.toLowerCase();
const rollback = readFileSync(ROLLBACK, 'utf8').toLowerCase();

describe('migration additive · démarrage persistant (S1.02, K6.15)', () => {
  it('ajoute deux colonnes nullables sans toucher aux colonnes historiques', () => {
    expect(lower).toContain('add column if not exists client_session_id uuid');
    expect(lower).toContain('add column if not exists variant_id text');
    expect(lower).not.toMatch(/drop\s+column/);
    expect(lower).not.toMatch(/alter\s+column/);
    expect(lower).not.toMatch(/drop\s+table/);
    expect(lower).not.toMatch(/delete\s+from/);
    expect(lower).not.toMatch(/truncate/);
  });

  it('garantit une seule séance par propriétaire et identifiant client', () => {
    expect(lower).toContain('create unique index if not exists activity_sessions_user_client_idx');
    expect(lower).toContain('(user_id, client_session_id)');
    expect(lower).toContain('where client_session_id is not null');
  });

  it('borne la variante en base', () => {
    expect(lower).toContain('activity_sessions_variant_id_check');
    expect(lower).toContain('variant_id is null or variant_id ~');
  });

  it('garde la liste SQL des variantes alignée sur la taxonomie serveur', () => {
    const pairs = [...sql.matchAll(/\('([a-z0-9-]+)',\s*'([a-z0-9-]+)'\)/g)].map(
      (match) => [match[1], match[2]] as const
    );
    const expected = new Map(
      [...STARTABLE_VARIANTS].map(([variantId, variant]) => [variantId, variant.sport] as const)
    );
    expect(pairs).toHaveLength(expected.size);
    expect(new Map(pairs.map(([sport, variantId]) => [variantId, sport] as const))).toEqual(
      expected
    );
  });

  it('détermine l’acteur avec auth.uid() et verrouille la clé propriétaire', () => {
    expect(lower).toContain('v_user uuid := auth.uid()');
    expect(lower).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(lower).toContain('where user_id = v_user');
    expect(lower).toContain('client_session_id = p_client_session_id');
  });

  it('est une fonction security definer au search_path verrouillé, réservée aux authentifiés', () => {
    expect(lower).toContain('security definer');
    expect(lower).toContain('set search_path = public, pg_temp');
    expect(lower).toContain(
      'revoke all on function public.start_activity_session(uuid, text, text, bigint) from public'
    );
    expect(lower).toContain(
      'grant execute on function public.start_activity_session(uuid, text, text, bigint) to authenticated'
    );
  });

  it('insère de façon atomique avant de relire une séance existante', () => {
    expect(lower).toContain('on conflict (user_id, client_session_id)');
    expect(lower).toContain('where client_session_id is not null');
    expect(lower).toContain('do nothing');
    expect(lower).toContain('if found then');
  });

  it('retourne la même séance au rejeu et un conflit si le contenu change', () => {
    expect(lower).toContain("'created', false");
    expect(lower).toContain("'created', true");
    expect(lower).toContain("'payload_mismatch'");
    expect(lower).toContain('v_session.sport is distinct from p_sport');
    expect(lower).toContain('v_session.variant_id is distinct from p_variant_id');
    expect(lower).toContain('v_session.route_id is distinct from p_route_id');
  });

  it('ne recrée ni ne remplace finish_activity_session', () => {
    expect(lower).not.toMatch(/create\s+or\s+replace\s+function\s+public\.finish_activity_session/);
    expect(lower).not.toMatch(/drop\s+function[^;]*finish_activity_session/);
  });

  it('a un rollback qui ne retire que les objets ajoutés', () => {
    expect(rollback).toContain(
      'drop function if exists public.start_activity_session(uuid, text, text, bigint)'
    );
    expect(rollback).toContain('drop index if exists public.activity_sessions_user_client_idx');
    expect(rollback).toContain('drop column if exists client_session_id');
    expect(rollback).toContain('drop column if exists variant_id');
    expect(rollback).not.toMatch(/drop\s+table/);
    expect(rollback).not.toMatch(/delete\s+from/);
    expect(rollback).not.toMatch(/finish_activity_session/);
  });
});
