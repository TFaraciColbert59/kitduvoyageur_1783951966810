#!/usr/bin/env node
/**
 * Porte B8 — tests RLS reels contre une base PostgreSQL de test.
 *
 * Usage : LKDV_TEST_DATABASE_URL=postgresql://... node scripts/verify/rls-real-tests.mjs
 * Sortie : PASS/FAIL par scenario, exit 1 si un scenario echoue.
 * Ne s'execute jamais sans URL explicite (jamais de production implicite).
 */
import { Client } from 'pg';

const url = process.env.LKDV_TEST_DATABASE_URL;
if (!url) {
  console.log('SKIP: LKDV_TEST_DATABASE_URL absente — porte RLS non executee.');
  process.exit(0);
}

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const ADMIN = '00000000-0000-4000-8000-00000000000d';
const CREW_A = '00000000-0000-4000-8000-00000000a001';
const CREW_B = '00000000-0000-4000-8000-00000000b001';
const TRIP_A = '00000000-0000-4000-8000-00000000a002';
const TRIP_B = '00000000-0000-4000-8000-00000000b002';

const client = new Client({ connectionString: url });

async function asRole(role, userId, sql, params = []) {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await client.query(`SET ROLE ${role}`);
  const res = await client.query(sql, params);
  await client.query('RESET ROLE');
  return res;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  await client.connect();

  await client.query(`
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    VALUES
      ('${A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test.local', '$2a$10$fixturea', now(), now()),
      ('${B}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test.local', '$2a$10$fixtureb', now(), now()),
      ('${C}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-c@test.local', '$2a$10$fixturec', now(), now()),
      ('${ADMIN}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '$2a$10$fixtured', now(), now())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES
      ('${A}', 'user-a@test.local', 'User A', 'user'),
      ('${B}', 'user-b@test.local', 'User B', 'user'),
      ('${C}', 'user-c@test.local', 'User C', 'user'),
      ('${ADMIN}', 'admin@test.local', 'Admin', 'admin')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.crews (id, name, slug, visibility, created_by)
    VALUES
      ('${CREW_A}', 'Crew prive A', 'crew-prive-a-rls-test', 'private', '${A}'),
      ('${CREW_B}', 'Crew public B', 'crew-public-b-rls-test', 'public', '${B}')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.crew_members (crew_id, user_id, role, status)
    VALUES
      ('${CREW_A}', '${A}', 'owner', 'active'),
      ('${CREW_A}', '${C}', 'member', 'removed'),
      ('${CREW_B}', '${B}', 'owner', 'active')
    ON CONFLICT (crew_id, user_id) DO NOTHING;
    INSERT INTO public.trips (id, slug, title, visibility, user_id)
    VALUES
      ('${TRIP_A}', 'trip-prive-a-rls-test', 'Trip prive A', 'private', '${A}'),
      ('${TRIP_B}', 'trip-public-b-rls-test', 'Trip public B', 'public', '${B}')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query("UPDATE public.user_profiles SET role = 'admin' WHERE id = $1", [ADMIN]);
  await client.query("UPDATE public.user_profiles SET role = 'user' WHERE id = ANY($1::uuid[])", [[A, B, C]]);

  const anonProfiles = await asRole('anon', null, 'SELECT count(*)::int AS n FROM public.user_profiles');
  check('anon ne lit aucune ligne de user_profiles', anonProfiles.rows[0].n === 0, `n=${anonProfiles.rows[0].n}`);

  const anonView = await asRole('anon', null, 'SELECT count(*)::int AS n FROM public.public_profiles');
  check('anon lit la vue public_profiles', anonView.rows[0].n > 0, `n=${anonView.rows[0].n}`);

  const viewCols = await asRole(
    'anon',
    null,
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='public_profiles' AND column_name IN ('email','phone','role')"
  );
  check('la vue publique n expose ni email ni telephone ni role', viewCols.rows[0].n === 0, `n=${viewCols.rows[0].n}`);

  const aProfiles = await asRole('authenticated', A, 'SELECT count(*)::int AS n FROM public.user_profiles');
  check('A ne voit que sa propre ligne de profil', aProfiles.rows[0].n === 1, `n=${aProfiles.rows[0].n}`);

  const adminProfiles = await asRole('authenticated', ADMIN, 'SELECT count(*)::int AS n FROM public.user_profiles');
  check('admin voit les profils', adminProfiles.rows[0].n >= 4, `n=${adminProfiles.rows[0].n}`);

  const aCrews = await asRole(
    'authenticated',
    A,
    `SELECT count(*)::int AS n FROM public.crews WHERE id IN ('${CREW_A}','${CREW_B}')`
  );
  check('A voit son crew prive et le crew public', aCrews.rows[0].n === 2, `n=${aCrews.rows[0].n}`);

  const cCrewA = await asRole(
    'authenticated',
    C,
    `SELECT count(*)::int AS n FROM public.crews WHERE id = '${CREW_A}'`
  );
  check('C (retire) ne voit pas le crew prive', cCrewA.rows[0].n === 0, `n=${cCrewA.rows[0].n}`);

  const cCrewB = await asRole(
    'authenticated',
    C,
    `SELECT count(*)::int AS n FROM public.crews WHERE id = '${CREW_B}'`
  );
  check('C voit le crew public', cCrewB.rows[0].n === 1, `n=${cCrewB.rows[0].n}`);

  const anonCrews = await asRole(
    'anon',
    null,
    `SELECT count(*)::int AS n FROM public.crews WHERE id IN ('${CREW_A}','${CREW_B}')`
  );
  check('anon ne voit que le crew public', anonCrews.rows[0].n === 1, `n=${anonCrews.rows[0].n}`);

  const cMembersPublic = await asRole(
    'authenticated',
    C,
    `SELECT count(*)::int AS n FROM public.crew_members WHERE crew_id = '${CREW_B}'`
  );
  check('non-membre lit les membres du crew public (divergence H-011 assumee)', cMembersPublic.rows[0].n >= 1, `n=${cMembersPublic.rows[0].n}`);

  const cMembersPrivate = await asRole(
    'authenticated',
    C,
    `SELECT count(*)::int AS n FROM public.crew_members WHERE crew_id = '${CREW_A}'`
  );
  check('C ne lit pas les membres du crew prive', cMembersPrivate.rows[0].n === 0, `n=${cMembersPrivate.rows[0].n}`);

  const cTrips = await asRole(
    'authenticated',
    C,
    `SELECT count(*)::int AS n FROM public.trips WHERE id IN ('${TRIP_A}','${TRIP_B}')`
  );
  check('C ne voit que le trip public', cTrips.rows[0].n === 1, `n=${cTrips.rows[0].n}`);

  const anonTrips = await asRole(
    'anon',
    null,
    `SELECT count(*)::int AS n FROM public.trips WHERE id IN ('${TRIP_A}','${TRIP_B}')`
  );
  check('anon ne voit que le trip public', anonTrips.rows[0].n === 1, `n=${anonTrips.rows[0].n}`);

  const cache = await asRole('authenticated', A, 'SELECT count(*)::int AS n FROM public.ai_response_cache');
  check('le cache IA est illisible par authenticated', cache.rows[0].n === 0, `n=${cache.rows[0].n}`);

  await client.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nRESULTAT: ${results.length - failed.length}/${results.length} scenarios OK`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('ERREUR RUNNER:', err.message);
  process.exit(2);
});
