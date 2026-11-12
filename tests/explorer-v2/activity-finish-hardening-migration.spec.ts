import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = path.resolve(
  __dirname,
  '../../supabase/migrations/20261112120000_explorer_v2_activity_finish_hardening.sql'
);
const ROLLBACK = path.resolve(
  __dirname,
  '../../supabase/migrations_down/20261112120000_explorer_v2_activity_finish_hardening.down.sql'
);

const sql = readFileSync(MIGRATION, 'utf8');
const lower = sql.toLowerCase();
const rollback = readFileSync(ROLLBACK, 'utf8').toLowerCase();

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`create or replace function public.${name}`);
  const end = source.indexOf(`revoke all on function public.${name}`, start);
  return source.slice(start, end);
}

describe('migration additive · durcissement de la fin de séance', () => {
  it('ne réécrit ni ne supprime aucune donnée historique', () => {
    expect(lower).not.toMatch(/delete\s+from/);
    expect(lower).not.toMatch(/truncate/);
    expect(lower).not.toMatch(/drop\s+table/);
    expect(lower).not.toMatch(/drop\s+column/);
    expect(lower).not.toMatch(/update\s+public\.offline_sync_operations/);
    expect(lower).toContain('add column if not exists activity_session_id uuid');
    expect(lower).toContain('add column if not exists variant_id text');
  });

  it('préserve la clôture des séances historiques hors taxonomie', () => {
    expect(lower).toContain('drop constraint if exists activity_sessions_variant_pair_fkey');
    expect(lower).toContain('drop constraint if exists activity_sessions_sport_fkey');
    expect(lower).toContain('create or replace function public.guard_activity_session_sport_pair');
    expect(lower).toContain('before insert or update of sport, variant_id');
    expect(lower).toContain("raise exception 'sport inconnu' using errcode = '23503'");
    expect(lower).toContain("raise exception 'variante non démarrable' using errcode = '23503'");
    expect(lower).toContain('drop constraint if exists activity_sessions_variant_id_check');
    expect(lower).toContain("when s.variant_id ~ '^[a-z0-9][a-z0-9-]{0,63}$' then s.variant_id");
  });

  it('lie durablement le résumé à sa séance', () => {
    expect(lower).toContain('hike_sessions_activity_session_fkey');
    expect(lower).toContain('references public.activity_sessions (id)');
    expect(lower).toContain('create unique index if not exists hike_sessions_activity_session_idx');
    expect(lower).toContain('on public.hike_sessions (user_id, activity_session_id)');
    expect(lower).toContain('where activity_session_id is not null');
    expect(lower).toContain('h.activity_session_id = p_session');
  });

  it('retrouve les lignes historiques par result.sessionId avec un index dédié', () => {
    expect(lower).toContain(
      'create index if not exists offline_sync_activity_finish_legacy_session_idx'
    );
    expect(lower).toContain("on public.offline_sync_operations (user_id, ((result ->> 'sessionid')))");
    expect(lower).toContain('and activity_session_id is null');
    expect(lower).toContain("(result ->> 'sessionid') = p_session::text");
    expect(lower).toContain("order by ((result ->> 'summaryid') is not null) desc");
  });

  it('valide le résumé avant de le renvoyer', () => {
    expect(lower).toContain('create or replace function public.activity_finish_summary_owned');
    expect(lower).toContain('h.user_id = p_user');
    expect(lower).toContain("'reason', 'summary_not_owned'");
    expect(lower).toContain(
      'if not public.activity_finish_summary_owned(v_user, p_session, v_summary_text) then'
    );
  });

  it('interdit au client d’écrire directement une ligne activity.finish', () => {
    expect(lower).toContain('drop policy if exists "offline_sync_operations_insert_own"');
    expect(lower).toContain("with check (auth.uid() = user_id and kind <> 'activity.finish')");
    expect(lower).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*offline_sync_operations/);
  });

  it('autorise la RPC SECURITY DEFINER à écrire sous FORCE RLS', () => {
    // Sans cette policy, un propriétaire non BYPASSRLS est refusé par
    // `kind <> 'activity.finish'` : c'est l'incident RLS de la revue.
    expect(lower).toContain('create policy "offline_sync_operations_select_finish_rpc"');
    expect(lower).toContain('create policy "offline_sync_operations_insert_finish_rpc"');
    expect(lower).toContain('for select to public');
    expect(lower).toContain('for insert to public');
    expect(lower).toContain("kind = 'activity.finish'");
    expect(lower).toContain('current_user = (');
    expect(lower).toContain('pg_get_userbyid(p.proowner)');
    expect(lower).toContain(
      "'public.finish_activity_session_idempotent(uuid,text)'::regprocedure"
    );
  });

  it('borne la clé d’idempotence en SQL comme dans la route', () => {
    const idempotent = functionBody(lower, 'finish_activity_session_idempotent');
    expect(idempotent).toContain('length(p_idempotency_key) > 400');
  });

  it('garde le verrou de clé et de séance avant toute relecture', () => {
    const idempotent = functionBody(lower, 'finish_activity_session_idempotent');
    const keyLock = idempotent.indexOf("':finish:'");
    const sessionLock = idempotent.indexOf("':finish-session:'");
    const finish = idempotent.indexOf('v_summary := public.finish_activity_session(p_session)');

    expect(keyLock).toBeGreaterThan(-1);
    expect(sessionLock).toBeGreaterThan(keyLock);
    expect(finish).toBeGreaterThan(sessionLock);
  });

  it('a un down non destructif qui conserve le lien durable et la policy RPC', () => {
    const restoreFinish = rollback.indexOf('create or replace function public.finish_activity_session');
    const restoreIdempotent = rollback.indexOf(
      'create or replace function public.finish_activity_session_idempotent'
    );

    expect(restoreFinish).toBeGreaterThan(-1);
    expect(restoreIdempotent).toBeGreaterThan(restoreFinish);
    expect(rollback).not.toMatch(/drop\s+table/);
    expect(rollback).not.toMatch(/delete\s+from/);
    expect(rollback).not.toMatch(/drop\s+column/);
    expect(rollback).not.toContain(
      'drop index if exists public.hike_sessions_activity_session_idx'
    );
    expect(rollback).not.toContain(
      'drop constraint if exists hike_sessions_activity_session_fkey'
    );
    // Le down conserve les correctifs indépendants du lien durable.
    expect(rollback).not.toContain(
      'drop index if exists public.offline_sync_activity_finish_legacy_session_idx'
    );
    expect(rollback).toContain('summary_not_owned');
    expect(rollback).not.toContain(
      'drop policy if exists "offline_sync_operations_insert_own"'
    );
    // Les policies RPC sont conservées : les retirer réintroduirait l'incident RLS.
    expect(rollback).not.toContain(
      'drop policy if exists "offline_sync_operations_select_finish_rpc"'
    );
    expect(rollback).not.toContain(
      'drop policy if exists "offline_sync_operations_insert_finish_rpc"'
    );
    // Le retour arrière restaure le garde de compatibilité de la migration
    // précédente, tout en gardant les correctifs indépendants.
    expect(rollback).toContain('drop trigger if exists activity_sessions_sport_pair_guard');
    expect(rollback).toContain('activity_sessions_variant_pair_fkey');
    expect(rollback).toContain('activity_sessions_sport_fkey');
  });
});
