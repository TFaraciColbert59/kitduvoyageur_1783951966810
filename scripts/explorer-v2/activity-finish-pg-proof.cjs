#!/usr/bin/env node
'use strict';

/**
 * Preuve locale (PostgreSQL réel, socket Unix uniquement) du durcissement de la
 * fin de séance Explorer v2.
 *
 * Ce script ne contacte aucune base distante : il crée une base jetable sur un
 * cluster local, applique les deux migrations, exécute les assertions, applique
 * le down sur une base PEUPLÉE, vérifie que le lien et les données survivent,
 * rejoue le up, puis supprime la base.
 *
 * Le propriétaire des tables et des fonctions est volontairement transféré à un
 * rôle NOLOGIN NOSUPERUSER NOBYPASSRLS, hors `authenticated`/`service_role` :
 * c'est le cas où FORCE RLS s'applique au SECURITY DEFINER. Un harnais
 * superuser ne peut pas voir ce défaut.
 *
 * Usage :
 *   LKDV_PG_SOCKET=/tmp/lkdv-a01-pg LKDV_PG_PORT=55418 \
 *     node scripts/explorer-v2/activity-finish-pg-proof.cjs
 *
 * Le cluster doit avoir été initialisé avec un rôle superutilisateur et
 * `listen_addresses = ''` (aucun TCP). Le script crée les rôles Supabase
 * `anon`, `authenticated` et `service_role`, ainsi que `lkdv_fn_owner`, dans ce
 * cluster local jetable.
 */

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const SOCKET = process.env.LKDV_PG_SOCKET || '/tmp/lkdv-a01-pg';
const PORT = Number(process.env.LKDV_PG_PORT || 55418);
const USER = process.env.LKDV_PG_USER || process.env.USER || 'fr168256';
const TEST_DB = 'lkdv_activity_finish_verify';

const U1 = 'a1f10000-0000-4000-8000-000000000001';
const U2 = 'a1f10000-0000-4000-8000-000000000002';
const S1 = 'a1f20000-0000-4000-8000-000000000001';
const S2 = 'a1f20000-0000-4000-8000-000000000002';
const S3 = 'a1f20000-0000-4000-8000-000000000003';
const S4 = 'a1f20000-0000-4000-8000-000000000004';
const S5 = 'a1f20000-0000-4000-8000-000000000005';
const S6 = 'a1f20000-0000-4000-8000-000000000006';
const S7 = 'a1f20000-0000-4000-8000-000000000007';
const S8 = 'a1f20000-0000-4000-8000-000000000008';
const S9 = 'a1f20000-0000-4000-8000-000000000009';
const S10 = 'a1f20000-0000-4000-8000-000000000010';
const SUMMARY6 = 'a1f30000-0000-4000-8000-000000000006';

const failures = [];
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}${detail === undefined ? '' : ` — ${detail}`}`);
  } else {
    failures.push(label);
    console.log(`FAIL  ${label}${detail === undefined ? '' : ` — ${detail}`}`);
  }
}

function client(database) {
  return new Client({ host: SOCKET, port: PORT, user: USER, database });
}

async function one(db, sql, params) {
  const result = await db.query(sql, params);
  return result.rows[0];
}

const BOOTSTRAP = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema auth;

create table auth.users (
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.hiking_routes (
  id bigint primary key,
  name text
);

create table public.explorer_sport_map (
  sport text primary key,
  label text not null
);

insert into public.explorer_sport_map (sport, label) values
  ('course', 'Course'),
  ('rando', 'Randonnée'),
  ('velo', 'Vélo'),
  ('kayak', 'Kayak'),
  ('trail', 'Trail'),
  ('ski', 'Ski de rando'),
  ('escalade', 'Escalade'),
  ('famille', 'Balade en famille'),
  ('bivouac', 'Bivouac');

create table public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  route_id bigint references public.hiking_routes(id) on delete set null,
  status text not null default 'live' check (status in ('live','paused','finished','abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  distance_m integer not null default 0,
  elev_gain_m integer not null default 0,
  moving_s integer not null default 0,
  share_level text not null default 'none' check (share_level in ('none','followers','group')),
  last_lat numeric(8,5),
  last_lng numeric(8,5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_points (
  id bigserial primary key,
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  t timestamptz not null default now(),
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  ele numeric(7,1),
  acc numeric(6,1),
  speed numeric(6,2)
);

create table public.hike_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id bigint references public.hiking_routes(id),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_km numeric not null,
  duration_seconds integer not null,
  elevation_gain_m numeric,
  positions_geojson jsonb,
  processing_status text not null default 'pending',
  visibility text not null default 'private',
  title text,
  created_at timestamptz default now()
);

create table public.offline_sync_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  store text not null,
  kind text not null,
  status text not null check (status in ('applied','rejected')),
  result jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create index idx_offline_sync_operations_applied_at
  on public.offline_sync_operations (user_id, applied_at desc);

alter table public.activity_sessions enable row level security;
create policy activity_sessions_owner_read on public.activity_sessions
  for select to authenticated using (user_id = auth.uid());
create policy activity_sessions_owner_write on public.activity_sessions
  for insert to authenticated with check (user_id = auth.uid());
create policy activity_sessions_owner_update on public.activity_sessions
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update on public.activity_sessions to authenticated;

alter table public.activity_points enable row level security;
create policy activity_points_owner_read on public.activity_points
  for select to authenticated using (
    exists (
      select 1 from public.activity_sessions s
       where s.id = activity_points.session_id and s.user_id = auth.uid()
    )
  );
create policy activity_points_owner_write on public.activity_points
  for insert to authenticated with check (
    exists (
      select 1 from public.activity_sessions s
       where s.id = activity_points.session_id and s.user_id = auth.uid()
    )
  );
grant select, insert on public.activity_points to authenticated;
grant usage, select on sequence public.activity_points_id_seq to authenticated;

alter table public.hike_sessions enable row level security;
create policy own_sessions on public.hike_sessions
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update on public.hike_sessions to authenticated;

alter table public.offline_sync_operations enable row level security;
alter table public.offline_sync_operations force row level security;
create policy "offline_sync_operations_select_own" on public.offline_sync_operations
  for select to authenticated using (auth.uid() = user_id);
create policy "offline_sync_operations_insert_own" on public.offline_sync_operations
  for insert to authenticated with check (auth.uid() = user_id);
create policy "offline_sync_operations_all_service" on public.offline_sync_operations
  for all to service_role using (true) with check (true);
revoke all on public.offline_sync_operations from public;
grant select, insert on public.offline_sync_operations to authenticated;
grant all on public.offline_sync_operations to service_role;

alter table public.explorer_sport_map enable row level security;
create policy explorer_sport_map_read on public.explorer_sport_map
  for select to anon, authenticated using (true);
grant select on public.explorer_sport_map to anon, authenticated;
`;

async function main() {
  const admin = client('postgres');
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = client(TEST_DB);
  await db.connect();

  try {
    await db.query(BOOTSTRAP);

    const up1 = fs.readFileSync(
      path.join(ROOT, 'supabase/migrations/20261111120000_explorer_v2_activity_start.sql'),
      'utf8'
    );
    const up2 = fs.readFileSync(
      path.join(ROOT, 'supabase/migrations/20261112120000_explorer_v2_activity_finish_hardening.sql'),
      'utf8'
    );
    const down = fs.readFileSync(
      path.join(
        ROOT,
        'supabase/migrations_down/20261112120000_explorer_v2_activity_finish_hardening.down.sql'
      ),
      'utf8'
    );

    await db.query(up1);
    await db.query(up2);
    check('les deux migrations s’appliquent sans erreur', true);

    // Le propriétaire réel des tables et des fonctions n'est ni superuser ni
    // BYPASSRLS dans ce scénario : FORCE RLS s'applique donc à la RPC
    // SECURITY DEFINER. C'est le cas que le harnais superuser ne voyait pas.
    await db.query(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = 'lkdv_fn_owner') then
          create role lkdv_fn_owner nologin nosuperuser nobypassrls;
        end if;
      end $$;
      grant usage on schema auth, public to lkdv_fn_owner;
      grant execute on function auth.uid() to lkdv_fn_owner;
      alter table public.activity_sessions owner to lkdv_fn_owner;
      alter table public.activity_points owner to lkdv_fn_owner;
      alter table public.hike_sessions owner to lkdv_fn_owner;
      alter table public.offline_sync_operations owner to lkdv_fn_owner;
      alter function public.finish_activity_session(uuid) owner to lkdv_fn_owner;
      alter function public.finish_activity_session_idempotent(uuid,text) owner to lkdv_fn_owner;
      alter function public.activity_finish_summary_owned(uuid,uuid,text) owner to lkdv_fn_owner;
    `);

    let owner = await one(
      db,
      `select rolsuper, rolbypassrls,
              pg_has_role('lkdv_fn_owner', 'authenticated', 'member') as auth_member,
              pg_has_role('lkdv_fn_owner', 'service_role', 'member') as service_member
         from pg_roles where rolname = 'lkdv_fn_owner'`
    );
    check(
      'le propriétaire de la RPC est non superuser, non BYPASSRLS, hors rôles API',
      owner.rolsuper === false &&
        owner.rolbypassrls === false &&
        owner.auth_member === false &&
        owner.service_member === false,
      JSON.stringify(owner)
    );

    owner = await one(
      db,
      `select count(*)::int as n from pg_policies
        where schemaname = 'public' and tablename = 'offline_sync_operations'
          and policyname in (
            'offline_sync_operations_select_finish_rpc',
            'offline_sync_operations_insert_finish_rpc'
          )`
    );
    check('les policies de lecture et d’écriture de la RPC existent', owner.n === 2, owner.n);

    await db.query('begin');
    await db.query(
      `insert into auth.users (id, email) values ($1, 'finish_a@test.local'), ($2, 'finish_b@test.local')`,
      [U1, U2]
    );
    await db.query(
      `insert into public.activity_sessions (id, user_id, sport, variant_id, status, started_at) values
         ($1, $3, 'rando', 'rando-journee', 'live', now() - interval '1 hour'),
         ($2, $3, 'rando', 'rando-journee', 'live', now() - interval '1 hour'),
         ($4, $3, 'rando', 'rando-journee', 'finished', now() - interval '2 hours'),
         ($5, $3, 'rando', 'rando-journee', 'live', now() - interval '1 hour'),
         ($6, $3, 'rando', 'rando-journee', 'finished', now() - interval '4 hours'),
         ($7, $3, 'rando', 'rando-journee', 'live', now() - interval '1 hour')`,
      [S1, S2, U1, S3, S5, S6, S7]
    );
    await db.query(
      `insert into public.hike_sessions
         (id, user_id, started_at, ended_at, distance_km, duration_seconds, processing_status, visibility)
       values ($1, $2, now() - interval '4 hours', now() - interval '3 hours', 1.2, 3600, 'pending', 'private')`,
      [SUMMARY6, U1]
    );
    await db.query(
      `insert into public.offline_sync_operations
         (user_id, idempotency_key, store, kind, status, result, activity_session_id)
       values
         ($1, 'historical-finish-key', 'explorer', 'activity.finish', 'applied',
          jsonb_build_object('summaryId', null, 'sessionId', $2::text), null),
         ($1, 'historical-summary-key', 'explorer', 'activity.finish', 'applied',
          jsonb_build_object('summaryId', $3::text, 'sessionId', $4::text), null)`,
      [U1, S3, SUMMARY6, S6]
    );

    // Ligne hors taxonomie, fabriquée comme un historique antérieur aux FK.
    await db.query('set local session_replication_role = replica');
    await db.query(
      `insert into public.activity_sessions (id, user_id, sport, variant_id, status, started_at)
       values ($1, $2, 'marche', 'rando-legacy', 'live', now() - interval '3 hours')`,
      [S4, U1]
    );
    await db.query('set local session_replication_role = origin');

    await db.query('set local role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U1]);

    let row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'finish-key-one') as r`,
      [S1]
    );
    check('la première fin applique la séance', row.r.status === 'applied', row.r.status);

    row = await one(
      db,
      `select activity_session_id from public.offline_sync_operations
        where user_id = $1 and idempotency_key = 'finish-key-one'`,
      [U1]
    );
    check('la ligne acquittée est liée à la séance', row.activity_session_id === S1);

    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'finish-key-one') as r`,
      [S2]
    );
    check('la même clé pour une autre séance est un conflit', row.r.status === 'conflict', row.r.status);

    row = await one(db, `select status from public.activity_sessions where id = $1`, [S2]);
    check('la séance de la clé réutilisée reste intacte', row.status === 'live', row.status);

    const firstSummary = await one(
      db,
      `select result ->> 'summaryId' as summary_id from public.offline_sync_operations
        where user_id = $1 and idempotency_key = 'finish-key-one'`,
      [U1]
    );
    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'finish-key-two') as r`,
      [S1]
    );
    check(
      'une seconde clé relit le résumé de la première',
      row.r.status === 'duplicate' && row.r.summaryId === firstSummary.summary_id,
      JSON.stringify(row.r)
    );

    row = await one(
      db,
      `select count(*)::int as n from public.offline_sync_operations
        where user_id = $1 and activity_session_id = $2
          and kind = 'activity.finish' and status = 'applied'`,
      [U1, S1]
    );
    check('un seul applied pour la séance', row.n === 1, row.n);

    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'finish-key-three') as r`,
      [S3]
    );
    check('une séance déjà finie sans résumé répond already_finished', row.r.status === 'already_finished', row.r.status);

    row = await one(
      db,
      `select count(*)::int as n from public.offline_sync_operations
        where user_id = $1 and activity_session_id = $2`,
      [U1, S3]
    );
    check('aucun applied sans résumé n’est écrit', row.n === 0, row.n);

    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'historical-finish-key') as r`,
      [S3]
    );
    check('une ligne historique sans résumé ne devient pas duplicate', row.r.status === 'already_finished', row.r.status);

    row = await one(
      db,
      `select count(*)::int as n from public.offline_sync_operations
        where user_id = $1 and kind = 'activity.finish' and status = 'applied'
          and activity_session_id is not null and (result ->> 'summaryId') is null`,
      [U1]
    );
    check('aucun nouveau applied sans summaryId', row.n === 0, row.n);

    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'finish-key-legacy') as r`,
      [S4]
    );
    check('une séance historique hors taxonomie reste fermable', row.r.status === 'applied', row.r.status);

    row = await one(
      db,
      `select h.variant_id from public.hike_sessions h
        where h.user_id = $1 and h.started_at = (
          select started_at from public.activity_sessions where id = $2
        )`,
      [U1, S4]
    );
    check('la variante historique est recopiée dans le résumé', row.variant_id === 'rando-legacy', row.variant_id);

    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'historical-summary-key-2') as r`,
      [S6]
    );
    check(
      'une autre clé retrouve la ligne historique par result.sessionId',
      row.r.status === 'duplicate' && row.r.summaryId === SUMMARY6,
      JSON.stringify(row.r)
    );

    const direct = await one(
      db,
      `select public.finish_activity_session($1) as summary_id`,
      [S5]
    );
    check('la fin directe sans clé crée un résumé', typeof direct.summary_id === 'string', direct.summary_id);

    row = await one(
      db,
      `select h.activity_session_id, h.id as summary_id from public.hike_sessions h
        where h.user_id = $1 and h.activity_session_id = $2`,
      [U1, S5]
    );
    check(
      'le résumé est durablement lié à la séance',
      row.activity_session_id === S5 && row.summary_id === direct.summary_id
    );

    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'finish-key-five') as r`,
      [S5]
    );
    check(
      'un rejeu idempotent retrouve la fin directe',
      row.r.status === 'already_finished' && row.r.summaryId === direct.summary_id,
      JSON.stringify(row.r)
    );

    let rlsCode = null;
    await db.query('savepoint forged_insert');
    try {
      await db.query(
        `insert into public.offline_sync_operations
           (user_id, idempotency_key, store, kind, status, result, activity_session_id)
         values ($1, 'forged-finish-key', 'explorer', 'activity.finish', 'applied',
                 jsonb_build_object('summaryId', $2::text, 'sessionId', $3::text), $3::uuid)`,
        [U1, SUMMARY6, S7]
      );
    } catch (error) {
      rlsCode = error.code;
      await db.query('rollback to savepoint forged_insert');
    }
    await db.query('release savepoint forged_insert');
    check('un client ne peut pas écrire directement un applied activity.finish', rlsCode === '42501', rlsCode);

    row = await one(
      db,
      `select count(*)::int as n from public.offline_sync_operations
        where user_id = $1 and idempotency_key = 'forged-finish-key'`,
      [U1]
    );
    check('la ligne forgée n’existe pas', row.n === 0, row.n);

    await db.query('reset role');

    row = await one(
      db,
      `select public.activity_finish_summary_owned($1, $2, $3) as owned`,
      [U1, S6, SUMMARY6]
    );
    check('le résumé historique appartient bien à son utilisateur', row.owned === true);

    row = await one(
      db,
      `select public.activity_finish_summary_owned($1, $2, $3) as owned`,
      [U2, S6, SUMMARY6]
    );
    check('le résumé d’un autre utilisateur est refusé', row.owned === false);

    // ── Rollback sur base peuplée ─────────────────────────────────────────
    // Les données sont validées : le down doit être testé avec des liens et
    // un registre réels, pas sur une base vide.
    await db.query('commit');

    const before = await one(
      db,
      `select
         (select count(*)::int from public.hike_sessions) as summaries,
         (select count(*)::int from public.hike_sessions where activity_session_id is not null) as linked,
         (select count(*)::int from public.offline_sync_operations) as registry`
    );
    check(
      'la base est peuplée avant le down',
      before.summaries > 0 && before.linked > 0 && before.registry > 0,
      JSON.stringify(before)
    );

    row = await one(
      db,
      `select activity_session_id from public.hike_sessions where activity_session_id = $1`,
      [S5]
    );
    check(
      'le lien de la fin directe existe avant le down',
      row !== undefined && row.activity_session_id === S5
    );

    await db.query(down);
    check('le down s’applique sur une base peuplée', true);

    row = await one(
      db,
      `select count(*)::int as n from information_schema.columns
        where table_schema = 'public' and table_name = 'hike_sessions'
          and column_name = 'activity_session_id'`
    );
    check('le down CONSERVE la colonne de lien durable', row.n === 1, row.n);

    row = await one(db, `select to_regclass('public.hike_sessions_activity_session_idx') as idx`);
    check('le down conserve l’index unique de lien durable', row.idx !== null, row.idx);

    row = await one(
      db,
      `select count(*)::int as n from pg_constraint
        where conname = 'hike_sessions_activity_session_fkey'`
    );
    check('le down conserve la FK de lien durable', row.n === 1, row.n);

    const after = await one(
      db,
      `select
         (select count(*)::int from public.hike_sessions) as summaries,
         (select count(*)::int from public.hike_sessions where activity_session_id is not null) as linked,
         (select count(*)::int from public.offline_sync_operations) as registry`
    );
    check(
      'le down ne perd ni résumé, ni lien, ni ligne de registre',
      after.summaries === before.summaries &&
        after.linked === before.linked &&
        after.registry === before.registry,
      JSON.stringify({ before, after })
    );

    row = await one(
      db,
      `select activity_session_id from public.hike_sessions where activity_session_id = $1`,
      [S5]
    );
    check(
      'le lien séance ↔ résumé survit au down',
      row !== undefined && row.activity_session_id === S5
    );

    row = await one(
      db,
      `select count(*)::int as n from pg_policies
        where schemaname = 'public' and tablename = 'offline_sync_operations'
          and policyname in (
            'offline_sync_operations_select_finish_rpc',
            'offline_sync_operations_insert_finish_rpc'
          )`
    );
    check(
      'le down conserve les policies RPC (pas de retour de l’incident)',
      row.n === 2,
      row.n
    );

    row = await one(
      db,
      `select pg_get_functiondef('public.finish_activity_session(uuid)'::regprocedure) as def`
    );
    check(
      'le down restaure une fin sans nouveau lien',
      !row.def.includes('h.activity_session_id'),
      'activity_session_id absent du corps'
    );

    row = await one(
      db,
      `select pg_get_functiondef('public.finish_activity_session_idempotent(uuid,text)'::regprocedure) as def`
    );
    check(
      'le down conserve la lecture de secours JSON',
      row.def.includes("result ->> 'sessionId'") &&
        row.def.includes('summary_not_owned') &&
        row.def.includes("':finish-session:'")
    );

    row = await one(
      db,
      `select with_check from pg_policies
        where schemaname = 'public' and tablename = 'offline_sync_operations'
          and policyname = 'offline_sync_operations_insert_own'`
    );
    check(
      'le down conserve l’interdiction d’écrire activity.finish',
      row.with_check.includes("kind <> 'activity.finish'"),
      row.with_check
    );

    row = await one(
      db,
      `select to_regclass('public.offline_sync_activity_finish_legacy_session_idx') as idx`
    );
    check('le down conserve l’index de secours historique', row.idx !== null, row.idx);

    // Le service doit rester disponible après le down, sous le même
    // propriétaire non BYPASSRLS.
    await db.query('begin');
    await db.query(
      `insert into public.activity_sessions (id, user_id, sport, variant_id, status, started_at)
       values ($1, $2, 'rando', 'rando-journee', 'live', now() - interval '1 hour')`,
      [S8, U1]
    );
    await db.query('set local role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U1]);
    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'down-service-key') as r`,
      [S8]
    );
    check(
      'après down, la RPC fonctionne encore sous propriétaire non BYPASSRLS',
      row.r.status === 'applied',
      JSON.stringify(row.r)
    );
    const downSummary = row.r.summaryId;
    row = await one(
      db,
      `select activity_session_id from public.hike_sessions where id = $1`,
      [downSummary]
    );
    check(
      'après down, la nouvelle fin ne crée pas de lien (comportement antérieur)',
      row.activity_session_id === null,
      String(row.activity_session_id)
    );
    await db.query('rollback');

    // ── Re-up après down ─────────────────────────────────────────────────
    await db.query(up2);
    check('le re-up après down s’applique sans erreur', true);

    row = await one(
      db,
      `select activity_session_id from public.hike_sessions where activity_session_id = $1`,
      [S5]
    );
    check(
      'le re-up retrouve le lien conservé',
      row !== undefined && row.activity_session_id === S5
    );

    const afterUp = await one(
      db,
      `select
         (select count(*)::int from public.hike_sessions) as summaries,
         (select count(*)::int from public.hike_sessions where activity_session_id is not null) as linked,
         (select count(*)::int from public.offline_sync_operations) as registry`
    );
    check(
      'le re-up ne duplique ni ne perd les données',
      afterUp.summaries === before.summaries &&
        afterUp.linked === before.linked &&
        afterUp.registry === before.registry,
      JSON.stringify({ before, afterUp })
    );

    row = await one(
      db,
      `select count(*)::int as n from pg_policies
        where schemaname = 'public' and tablename = 'offline_sync_operations'
          and policyname in (
            'offline_sync_operations_select_finish_rpc',
            'offline_sync_operations_insert_finish_rpc'
          )`
    );
    check('le re-up réinstalle les policies RPC', row.n === 2, row.n);

    await db.query('begin');
    await db.query(
      `insert into public.activity_sessions (id, user_id, sport, variant_id, status, started_at)
       values ($1, $2, 'rando', 'rando-journee', 'live', now() - interval '1 hour')`,
      [S9, U1]
    );
    await db.query('set local role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U1]);
    row = await one(
      db,
      `select public.finish_activity_session_idempotent($1, 'reup-service-key') as r`,
      [S9]
    );
    check(
      'après re-up, la RPC relie à nouveau la séance',
      row.r.status === 'applied',
      JSON.stringify(row.r)
    );
    const reupSummary = row.r.summaryId;
    row = await one(
      db,
      `select activity_session_id from public.hike_sessions where id = $1`,
      [reupSummary]
    );
    check(
      'après re-up, le nouveau résumé est lié à la séance',
      row.activity_session_id === S9,
      String(row.activity_session_id)
    );
    await db.query('rollback');

    // ── Contrôle négatif : sans les policies, la RPC échoue bien ──────────
    // Garantit que le harnais détecte la régression d'origine et ne passe pas
    // par accident grâce à un rôle privilégié.
    await db.query('begin');
    await db.query('drop policy if exists "offline_sync_operations_select_finish_rpc" on public.offline_sync_operations');
    await db.query('drop policy if exists "offline_sync_operations_insert_finish_rpc" on public.offline_sync_operations');
    await db.query(
      `insert into public.activity_sessions (id, user_id, sport, variant_id, status, started_at)
       values ($1, $2, 'rando', 'rando-journee', 'live', now() - interval '1 hour')`,
      [S10, U1]
    );
    await db.query('set local role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U1]);
    let negativeCode = null;
    try {
      await db.query(
        `select public.finish_activity_session_idempotent($1, 'negative-control-key') as r`,
        [S10]
      );
    } catch (error) {
      negativeCode = error.code;
    }
    await db.query('rollback');
    check(
      'contrôle négatif : sans les policies, la RPC est refusée (42501)',
      negativeCode === '42501',
      negativeCode
    );
  } finally {
    await db.end();
    const cleanup = client('postgres');
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${TEST_DB}`);
    await cleanup.end();
  }

  console.log(`\n${passed} assertions réussies, ${failures.length} échec(s).`);
  if (failures.length > 0) {
    console.error(`Échecs : ${failures.join(' | ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
