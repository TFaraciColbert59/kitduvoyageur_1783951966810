import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_START_SPORTS,
  STARTABLE_VARIANTS,
} from '@/features/explorer-v2/server/activityStart';

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
  it('ajoute des colonnes nullables sans toucher aux colonnes historiques', () => {
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

  it('garde une source SQL unique pour les variantes démarrables', () => {
    expect(lower).toContain('create table if not exists public.explorer_sport_variants');
    expect(lower).toContain('primary key (sport, variant_id)');
    expect(lower).toMatch(/variant_id text not null\s+check \(variant_id ~/);
    expect(lower).toContain(
      'grant select on public.explorer_sport_variants to anon, authenticated'
    );
    expect(lower).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*explorer_sport_variants/);
    expect(lower).toContain('alter table public.explorer_sport_variants enable row level security');
  });

  it('retire explicitement les droits hérités avant d’ouvrir la lecture', () => {
    const revoke = lower.indexOf(
      'revoke all on public.explorer_sport_variants from anon, authenticated'
    );
    const grant = lower.indexOf(
      'grant select on public.explorer_sport_variants to anon, authenticated'
    );

    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
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
    expect([...new Set(pairs.map(([sport]) => sport))].sort()).toEqual(
      [...ACTIVITY_START_SPORTS].sort()
    );
  });

  it('impose la paire (sport, variante) et le sport à toutes les écritures autorisées', () => {
    expect(lower).toContain('activity_sessions_variant_pair_fkey');
    expect(lower).toContain('foreign key (sport, variant_id)');
    expect(lower).toContain('references public.explorer_sport_variants (sport, variant_id)');
    expect(lower).toContain('activity_sessions_sport_fkey');
    expect(lower).toContain('foreign key (sport)');
    expect(lower).toContain('references public.explorer_sport_map (sport)');
    expect(lower).toContain('from public.explorer_sport_variants v');
    // Les FK sont posées NOT VALID : les lignes historiques ne sont ni
    // supprimées ni réécrites, mais les nouvelles écritures sont contrôlées.
    expect(lower).toContain('not valid');
    expect(lower).toContain('raise warning');
    expect(lower).toContain(
      "execute 'alter table public.activity_sessions validate constraint activity_sessions_variant_pair_fkey'"
    );
    expect(lower).toContain('create index if not exists activity_sessions_sport_variant_idx');
    expect(lower).toContain('on public.activity_sessions (sport, variant_id)');
    // L'ancien CHECK de format est réconcilié : la paire référencée le rend
    // redondant et le down le retire aussi.
    expect(lower).toContain('drop constraint if exists activity_sessions_variant_id_check');
    // La variante reste nullable : les anciens clients qui ne la renseignent
    // pas passent grâce à MATCH SIMPLE, sans retrait de droit.
    expect(lower).toContain('add column if not exists variant_id text;');
    expect(lower).not.toMatch(/add column if not exists variant_id text not null/);
  });

  it('protège l’identité des nouvelles séances sans bloquer les anciennes', () => {
    expect(lower).toContain('old.client_session_id is not null');
    expect(lower).toContain('new.client_session_id is distinct from old.client_session_id');
    expect(lower).toContain('new.user_id is distinct from old.user_id');
    expect(lower).toContain('new.sport is distinct from old.sport');
    expect(lower).toContain('new.variant_id is distinct from old.variant_id');
    expect(lower).toContain('new.route_id is distinct from old.route_id');
    expect(lower).toContain('before update on public.activity_sessions');
  });

  it('accepte les route_id bigint et reste lisible par l’ancienne route jusqu’à 2^31-1', () => {
    expect(lower).toContain('p_route_id bigint');
    expect(lower).toContain('c_legacy_route_max constant bigint := 2147483647');
    expect(lower).toContain('v_route_id := case');
    expect(lower).toContain('v_session.route_id > c_legacy_route_max');
    expect(lower).toContain('to_jsonb(v_session.route_id::text)');
    expect(lower).toContain("'routeid', v_route_id");
    expect(lower).toContain('from public.hiking_routes r where r.id = p_route_id');
    expect(lower).toContain('p_route_id <= 0');
  });

  it('documente l’ordre route puis migration et l’état local de la branche', () => {
    expect(lower).toContain('route, puis appliquer cette migration');
    expect(lower).not.toContain('appliquer cette migration avant de déployer la route');
    expect(lower).toContain('migration locale sur une branche non intégrée');
    expect(lower).toContain('application distante n\'est supposée');
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

  it('ne retire aucun droit table-level et ne supprime aucune policy existante', () => {
    expect(lower).not.toMatch(
      /revoke\s+(all|insert|update|select)[^;]*on\s+(table\s+)?public\.activity_sessions/
    );
    expect(lower).not.toMatch(
      /revoke\s+(all|insert|update|select)[^;]*on\s+(table\s+)?public\.hike_sessions/
    );
    expect(lower).not.toMatch(/drop\s+policy[^;]*activity_sessions/);
    expect(lower).not.toMatch(/drop\s+policy[^;]*hike_sessions/);
    expect(lower).not.toContain('grant insert on public.activity_sessions');
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

  it('propage la variante vers l’historique sans changer la signature de finish', () => {
    expect(lower).toContain(
      'create or replace function public.finish_activity_session(p_session uuid)'
    );
    expect(lower).toContain('add column if not exists variant_id text;');
    expect(lower).toContain('user_id, route_id, variant_id, started_at');
    expect(lower).toContain('s.route_id,\n    s.variant_id');
    expect(lower).toContain('returns uuid');
    expect(lower).not.toMatch(/drop\s+function[^;]*finish_activity_session/);
  });

  it('refuse un acteur nul et sérialise la clôture concurrente de finish', () => {
    const finish = lower.slice(
      lower.indexOf('create or replace function public.finish_activity_session(p_session uuid)'),
      lower.indexOf('revoke all on function public.finish_activity_session(uuid)')
    );

    expect(finish).toContain('set search_path = public, pg_temp');
    expect(finish).toContain('v_user uuid := auth.uid()');
    expect(finish).toContain('if v_user is null or s.user_id <> v_user');
    expect(finish).toContain('and status <> \'finished\'');
    expect(finish).toContain('returning * into s');
    expect(finish).toContain('if not found then\n    return null;');
  });

  it('prend le verrou de clé d’idempotence avant d’appeler finish', () => {
    const lock = lower.indexOf("':finish:'");
    const call = lower.indexOf('v_summary := public.finish_activity_session(p_session)');

    expect(lower).toContain('finish_activity_session_idempotent');
    expect(lower).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(lock).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(lock);
    // Un conflit d'insertion relit la ligne gagnante au lieu de renvoyer un
    // résumé qui n'est pas celui du registre.
    expect(lower).toContain('if not found then\n    select * into v_existing');
  });

  it('a un rollback ordonné qui restaure finish avant de retirer la colonne', () => {
    const restoreFinish = rollback.indexOf(
      'create or replace function public.finish_activity_session'
    );
    const dropHikeVariant = rollback.indexOf('drop column if exists variant_id');
    const dropStart = rollback.indexOf(
      'drop function if exists public.start_activity_session(uuid, text, text, bigint)'
    );
    const dropReference = rollback.indexOf(
      'drop table if exists public.explorer_sport_variants'
    );

    expect(restoreFinish).toBeGreaterThan(-1);
    expect(dropHikeVariant).toBeGreaterThan(restoreFinish);
    expect(dropStart).toBeGreaterThan(-1);
    expect(dropReference).toBeGreaterThan(dropStart);
    expect(rollback).toContain('drop index if exists public.activity_sessions_user_client_idx');
    expect(rollback).toContain('drop column if exists client_session_id');
    expect(rollback).toContain('drop column if exists variant_id');
    expect(rollback).toContain('activity_sessions_sport_fkey');
    expect(rollback).toContain('activity_sessions_sport_variant_idx');
    expect(rollback).not.toMatch(/delete\s+from/);
    expect(rollback).not.toMatch(/truncate/);
    expect(rollback).not.toMatch(/drop\s+table[^;]*public\.(activity_sessions|hike_sessions)/);
    expect(rollback).not.toMatch(/drop\s+function[^;]*finish_activity_session/);
  });

  it('conserve le durcissement auth et la clôture concurrente dans le down', () => {
    expect(rollback).toContain('if v_user is null or s.user_id <> v_user');
    expect(rollback).toContain('and status <> \'finished\'');
    expect(rollback).toContain('set search_path = public, pg_temp');
  });
});
