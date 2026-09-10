#!/usr/bin/env node
/**
 * Vérification live Tripadvisor Content API — SANS jamais exposer la clé.
 *
 * Usage : node scripts/tripadvisor-live-check.mjs
 *
 * - Charge TRIPADVISOR_API_KEY / TRIPADVISOR_API_BASE_URL / TRIPADVISOR_REFERER
 *   depuis .env.local (jamais affichés).
 * - Teste Location Search et Location Details.
 * - Teste les deux graphies documentées du paramètre de langue : `language` et `lang`.
 * - N'imprime que des métadonnées structurelles (statut HTTP, nombre de résultats,
 *   NOMS de champs — jamais de valeurs, jamais la clé, jamais l'URL complète).
 *
 * Codes de sortie : 0 = OK, 2 = 403 sur tout (autorisation clé à corriger), 1 = erreur.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.join(process.cwd(), '.env.local');
const DEFAULT_BASE = 'https://api.content.tripadvisor.com/api/v1';
const SAMPLE_LOCATION_ID = '730099'; // ID public, utilisé uniquement si Search échoue.

function loadEnv(file) {
  const out = {};
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const key = env.TRIPADVISOR_API_KEY;
const base = (env.TRIPADVISOR_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
const referer = env.TRIPADVISOR_REFERER || env.NEXT_PUBLIC_SITE_URL || undefined;

if (!key || key.includes('your-')) {
  console.log('CONFIG: TRIPADVISOR_API_KEY absent ou placeholder. Vérification ignorée.');
  process.exit(0);
}
console.log(`CONFIG: clé présente (longueur ${key.length}), base=${base.replace(/^https?:\/\//, '')}`);
if (referer) console.log(`CONFIG: Referer/Origin configuré (${referer.replace(/\/+$/, '')})`);

async function get(endpoint, params) {
  const url = new URL(`${base}${endpoint}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set('key', key);
  const headers = { Accept: 'application/json' };
  if (referer) {
    headers.Referer = referer;
    headers.Origin = referer.replace(/\/+$/, '');
  }
  try {
    const res = await fetch(url.toString(), { headers });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    return { status: res.status, body };
  } catch (error) {
    return { status: 0, body: null, error: String(error && error.message) };
  }
}

function describe(status, body) {
  if (status === 0) return 'réseau indisponible';
  if (status >= 200 && status < 300) {
    if (body && Array.isArray(body.data)) return `${body.data.length} résultat(s)`;
    if (body) return `champs: ${Object.keys(body).slice(0, 24).join(', ')}`;
    return 'corps vide';
  }
  const message = body && (body.Message || body.message || body.error);
  return message ? String(message).slice(0, 140) : '';
}

let sawOk = false;
let sawForbiddenOnly = true;

console.log('\n=== Location Search ===');
for (const param of ['language', 'lang']) {
  const { status, body } = await get('/location/search', {
    searchQuery: 'Islande',
    category: 'attractions',
    [param]: 'fr',
  });
  console.log(`  ${param}=fr -> HTTP ${status} ${describe(status, body)}`);
  if (status >= 200 && status < 300) sawOk = true;
  if (status !== 403) sawForbiddenOnly = false;
  if (status === 429) console.log('  ⚠ quota atteint (429)');
}

console.log('\n=== Location Details ===');
let locationId = SAMPLE_LOCATION_ID;
const search = await get('/location/search', {
  searchQuery: 'Islande',
  category: 'attractions',
  language: 'fr',
});
if (search.status >= 200 && search.status < 300 && Array.isArray(search.body?.data) && search.body.data[0]) {
  locationId = String(search.body.data[0].location_id);
  console.log(`  (ID issu de Search: ***${locationId.slice(-3)})`);
} else {
  console.log('  (Search indisponible — test avec un ID public d’exemple)');
}
for (const param of ['language', 'lang']) {
  const { status, body } = await get(`/location/${encodeURIComponent(locationId)}/details`, {
    [param]: 'fr',
  });
  console.log(`  ${param}=fr -> HTTP ${status} ${describe(status, body)}`);
  if (status >= 200 && status < 300) sawOk = true;
  if (status !== 403) sawForbiddenOnly = false;
}

console.log('\n=== Résultat ===');
if (sawOk) {
  console.log('✅ Au moins un appel a réussi. Relever ci-dessus les champs de Details et la graphie acceptée.');
  process.exit(0);
}
if (sawForbiddenOnly) {
  console.log('❌ HTTP 403 sur tous les appels. Corriger l’autorisation de la clé (domaine/IP + Referer),');
  console.log('   puis relancer ce script. La cause exacte du 403 n’est pas déductible du message seul.');
  process.exit(2);
}
console.log('⚠ Aucun appel n’a réussi, sans 403 homogène. Vérifier réseau / base URL / quota.');
process.exit(1);
