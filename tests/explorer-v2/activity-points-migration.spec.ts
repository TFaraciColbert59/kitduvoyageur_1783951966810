import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const UP = path.join(
  ROOT,
  'supabase/migrations/20261113090000_explorer_v2_activity_points_sync.sql',
);
const DOWN = path.join(
  ROOT,
  'supabase/migrations_down/20261113090000_explorer_v2_activity_points_sync.down.sql',
);

const up = readFileSync(UP, 'utf8');
const down = readFileSync(DOWN, 'utf8');
const lower = up.toLowerCase();

describe('migration · progression de séance idempotente', () => {
  it('ajoute une séquence client et un index unique par séance', () => {
    expect(lower).toContain('add column if not exists client_seq integer');
    expect(lower).toContain(
      'create unique index if not exists activity_points_session_client_seq_idx',
    );
    expect(lower).toContain('on public.activity_points (session_id, client_seq)');
  });

  it('ignore les séquences déjà présentes sans réécrire de point', () => {
    expect(lower).toContain('on conflict (session_id, client_seq) do nothing');
    expect(lower).not.toMatch(/on conflict[^;]*do update/);
    expect(lower).not.toMatch(/delete from\s+public\.activity_points/);
    expect(lower).not.toMatch(/update\s+public\.activity_points/);
  });

  it('vérifie le propriétaire et l’état de la séance sous verrou', () => {
    expect(lower).toContain('v_session.user_id <> v_user');
    expect(lower).toContain("v_session.status = 'finished'");
    expect(lower).toContain('for update');
    expect(lower).toContain('p_points');
  });

  it('verrouille la fonction : security definer, search_path et droits authenticated', () => {
    expect(lower).toContain('security definer');
    expect(lower).toContain('set search_path = public, pg_temp');
    expect(lower).toContain(
      'revoke all on function public.sync_activity_session(uuid, jsonb, integer, integer, integer, boolean, timestamptz, timestamptz)',
    );
    expect(lower).toContain(
      'grant execute on function public.sync_activity_session(uuid, jsonb, integer, integer, integer, boolean, timestamptz, timestamptz)',
    );
    expect(lower).not.toMatch(/grant\s+[^;]*\bto\s+anon\b/);
  });

  it('reste hors de la plage de versions réservée et fournit un rollback conservant les points', () => {
    expect(path.basename(UP)).toMatch(/^20261113090000_/);
    expect(path.basename(UP)).not.toMatch(/^2026111212/);
    expect(down.toLowerCase()).toContain(
      'drop function if exists public.sync_activity_session',
    );
    expect(down.toLowerCase()).toContain(
      'drop index if exists public.activity_points_session_client_seq_idx',
    );
    expect(down.toLowerCase()).toContain('drop column if exists client_seq');
    expect(down.toLowerCase()).not.toMatch(/delete from\s+public\.activity_points/);
    expect(down.toLowerCase()).not.toMatch(/drop table/);
  });
});
