// Données de départ du parcours E2E, posées dans la base ÉPHÉMÈRE (jamais ailleurs).
//  - le référentiel des lieux habités de la zone (extrait RÉEL de GeoNames,
//    cities500, CC BY 4.0 : tests/e2e/compas/fixtures/geonames-vercors.tsv) ;
//  - une personne de test (auth.users ; le déclencheur du dépôt crée son profil).
import { execFileSync } from 'node:child_process';
import path from 'node:path';

//  - la ligne « France » de countries_geo (ligne réelle de GeoNames countryInfo.txt,
//    colonnes lues comme scripts/geo/import_geonames.ts) : le voyage y renvoie par clé étrangère.
// Lancé depuis la racine du dépôt (Playwright) : pas d'`import.meta`, ce module est aussi chargé en CJS.
const FIXTURES = path.join(process.cwd(), 'tests', 'e2e', 'compas', 'fixtures');
const GEONAMES = path.join(FIXTURES, 'geonames-vercors.tsv');
const COUNTRY_INFO_FR = path.join(FIXTURES, 'geonames-countryinfo-fr.tsv');

/** Refuse toute base qui n'est pas locale : le test n'écrit jamais ailleurs. */
export function assertLocalDatabase(databaseUrl) {
  const host = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '[::1]', '::1', ''].includes(host)) {
    throw new Error(`[e2e] REFUS : la base ${host} n'est pas locale.`);
  }
}

function psql(databaseUrl, sql) {
  assertLocalDatabase(databaseUrl);
  return execFileSync('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' },
  });
}

export function seedReferential(databaseUrl) {
  psql(
    databaseUrl,
    `create temp table country_info (iso text, iso3 text, iso_numeric text, fips text, country text, capital text,
       area text, population text, continent text, tld text, currency_code text, currency_name text, phone text,
       postal_code_format text, postal_code_regex text, languages text, geoname_id text, neighbours text, equiv_fips text);
\\copy country_info from '${COUNTRY_INFO_FR}'
insert into public.countries_geo (iso_a2, name, name_ascii, capital, continent, population, area_km2, iso_a3, iso_numeric,
    fips_code, tld, phone_code, currency_code, currency_name, postal_code_format, postal_code_regex, languages, geoname_id, neighbours)
  select iso, country, country, nullif(capital, ''), nullif(continent, ''), nullif(population, '')::int, nullif(area, '')::float8,
    nullif(iso3, ''), nullif(iso_numeric, ''), nullif(fips, ''), nullif(tld, ''), nullif(phone, ''), nullif(currency_code, ''),
    nullif(currency_name, ''), nullif(postal_code_format, ''), nullif(postal_code_regex, ''),
    coalesce(string_to_array(nullif(languages, ''), ','), '{}'), nullif(geoname_id, '')::bigint,
    coalesce(string_to_array(nullif(neighbours, ''), ','), '{}')
  from country_info
  on conflict (iso_a2) do nothing;
create temp table geo_places_in (like public.geo_places including defaults);
\\copy geo_places_in (geoname_id, name, kind, country_code, admin1, lat, lon, ele_m, population, timezone) from '${GEONAMES}'
insert into public.geo_places select * from geo_places_in on conflict (geoname_id) do nothing;`
  );
}

export function createTestUser(databaseUrl, { id, email }) {
  psql(
    databaseUrl,
    `insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('${id}', 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     on conflict (id) do nothing;`
  );
}

/** Lignes d'une requête de lecture (colonnes séparées par « | »), pour que le test relise la base. */
export function queryRows(databaseUrl, sql) {
  assertLocalDatabase(databaseUrl);
  const out = execFileSync('psql', [databaseUrl, '-X', '-q', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' });
  return out.split('\n').filter((l) => l.length > 0);
}
