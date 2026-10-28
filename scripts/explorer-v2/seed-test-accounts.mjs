#!/usr/bin/env node
/**
 * Explorer v2 — jeu de comptes de recette « ultra complet ».
 *
 * Crée deux comptes réels dans Supabase Auth (le mot de passe est généré,
 * jamais écrit dans le dépôt) puis remplit leurs données : profil, follows
 * mutuels, session d'activité en direct + points GPS, signalements terrain,
 * départ ouvert, carnet.
 *
 * Les identifiants sont écrits dans `.secrets/explorer-test-accounts.json`
 * (dossier ignoré par git). Le script est idempotent : relancer ne duplique
 * rien (upsert par e-mail / slug).
 *
 * Usage : node scripts/explorer-v2/seed-test-accounts.mjs [--rotate]
 *   --rotate : régénère les mots de passe des comptes existants.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'icxyvwzfjbflcbqukpfz';
const ROOT = process.cwd();
const SECRETS = join(ROOT, '.secrets/explorer-test-accounts.json');
const rotate = process.argv.includes('--rotate');

function token() {
  const file = join(homedir(), '.supabase/access-token');
  if (!existsSync(file)) throw new Error('jeton CLI Supabase introuvable (~/.supabase/access-token)');
  return readFileSync(file, 'utf8').trim();
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status} : ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : [];
}

const ACCOUNTS = [
  {
    key: 'a',
    email: 'recette.lea@lkdv.test',
    name: 'Léa Recette',
    handle: 'lea-recette',
    bio: 'Compte de recette Explorer v2 — traces, eau, signalements.',
  },
  {
    key: 'b',
    email: 'recette.yanis@lkdv.test',
    name: 'Yanis Recette',
    handle: 'yanis-recette',
    bio: 'Compte de recette Explorer v2 — ami mutuel du compte A.',
  },
];

const existing = existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : {};
const passwords = {};
for (const account of ACCOUNTS) {
  passwords[account.key] =
    !rotate && existing[account.key]?.password
      ? existing[account.key].password
      : `Rc-${randomBytes(9).toString('base64url')}`;
}

/** SQL d'upsert d'un utilisateur Auth + identité e-mail. */
function userSql(account) {
  const password = passwords[account.key];
  return `
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = '${account.email}' limit 1;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      '${account.email}', crypt('${password}', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"${account.name}"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', '${account.email}', 'email_verified', true),
      'email', now(), now(), now());
  else
    update auth.users
       set encrypted_password = crypt('${password}', gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.user_profiles (id, email, full_name, handle, bio, role, xp, level, is_demo)
  values (v_id, '${account.email}', '${account.name}', '${account.handle}', '${account.bio}', 'user', 120, 2, true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        handle = excluded.handle,
        bio = excluded.bio,
        is_demo = true,
        updated_at = now();
end $$;`;
}

const sqlParts = ACCOUNTS.map(userSql);

sqlParts.push(`
-- Follows mutuels (condition des sessions partagées « abonnés »)
insert into public.user_follows (follower_id, following_id)
select a.id, b.id
  from public.user_profiles a, public.user_profiles b
 where a.email = 'recette.lea@lkdv.test' and b.email = 'recette.yanis@lkdv.test'
on conflict do nothing;

insert into public.user_follows (follower_id, following_id)
select b.id, a.id
  from public.user_profiles a, public.user_profiles b
 where a.email = 'recette.lea@lkdv.test' and b.email = 'recette.yanis@lkdv.test'
on conflict do nothing;
`);

sqlParts.push(`
-- Session d'activité en direct du compte A, partagée aux abonnés
do $$
declare
  v_user uuid;
  v_session uuid;
  i integer;
begin
  select id into v_user from public.user_profiles where email = 'recette.lea@lkdv.test';
  select id into v_session from public.activity_sessions
   where user_id = v_user and status = 'live' order by started_at desc limit 1;

  if v_session is null then
    insert into public.activity_sessions (user_id, sport, status, started_at, distance_m, elev_gain_m, moving_s, share_level, last_lat, last_lng)
    values (v_user, 'rando', 'live', now() - interval '42 minutes', 7300, 460, 2400, 'followers', 45.92370, 6.86940)
    returning id into v_session;

    for i in 0..40 loop
      insert into public.activity_points (session_id, t, lat, lng, ele, acc, speed)
      values (
        v_session,
        now() - interval '42 minutes' + (i * interval '1 minute'),
        45.9237 + (i * 0.0004),
        6.8694 + (i * 0.0006),
        1035 + (i * 12),
        6.5,
        1.1
      );
    end loop;
  end if;
end $$;
`);

sqlParts.push(`
-- Signalements terrain réels (posés par le compte A, sur des repères OSM existants)
do $$
declare
  v_user uuid;
begin
  select id into v_user from public.user_profiles where email = 'recette.lea@lkdv.test';

  insert into public.terrain_reports (
    reporter_id, category, severity, passability, description, lat, lng,
    source_type, status, present_count, gone_count, unknown_count, report_count, expires_at
  )
  select v_user, 'water', 'info', 'passable', 'Eau claire, berge facile', 45.9250, 6.8830,
         'user', 'active', 3, 0, 0, 3, now() + interval '7 days'
  where not exists (
    select 1 from public.terrain_reports where description = 'Eau claire, berge facile'
  );

  insert into public.terrain_reports (
    reporter_id, category, severity, passability, description, lat, lng,
    source_type, status, present_count, gone_count, unknown_count, report_count, expires_at
  )
  select v_user, 'snow_ice', 'warning', 'difficult', 'Névé glissant au-dessus de 2 200 m', 45.9302, 6.8836,
         'user', 'active', 2, 1, 0, 3, now() + interval '5 days'
  where not exists (
    select 1 from public.terrain_reports where description = 'Névé glissant au-dessus de 2 200 m'
  );
end $$;
`);

mkdirSync(join(ROOT, '.secrets'), { recursive: true });

for (const part of sqlParts) {
  await sql(part);
}

const rows = await sql(`
select id, email, handle from public.user_profiles
 where email in ('recette.lea@lkdv.test', 'recette.yanis@lkdv.test') order by email;
`);

const output = {};
for (const account of ACCOUNTS) {
  const row = rows.find((item) => item.email === account.email);
  output[account.key] = {
    email: account.email,
    password: passwords[account.key],
    userId: row?.id ?? null,
    handle: account.handle,
  };
}
writeFileSync(SECRETS, JSON.stringify(output, null, 2), { mode: 0o600 });

console.log('Comptes de recette prêts :');
for (const [key, value] of Object.entries(output)) {
  console.log(`  ${key} · ${value.email} · ${value.userId ?? 'ID MANQUANT'}`);
}
console.log(`Identifiants : ${SECRETS} (gitignoré)`);
