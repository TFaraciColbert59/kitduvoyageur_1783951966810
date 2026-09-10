#!/usr/bin/env node
/**
 * Vérification live Terra — validation SÉMANTIQUE (pays / catégorie / URL).
 * SANS jamais exposer la clé.
 *
 * Usage : node scripts/tripadvisor-terra-live-check.mjs
 *
 * - 3 appels minimum documentés : /locations/search, size=2.
 * - N'affiche que des métadonnées non sensibles (id, nom, country_code,
 *   catégorie, hostname Tripadvisor). Jamais la réponse JSON complète.
 * - N'écrit rien dans l'allowlist, aucune boucle, aucun retry.
 * - N'appelle pas process.exit() (course libuv Windows) → process.exitCode.
 *
 * Codes : 0 = OK, 2 = 401/403, 3 = 429, 1 = réseau/autre.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.join(process.cwd(), '.env.local');
const DEFAULT_BASE = 'https://terra.tripadvisor.com/api';

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

const CASES = [
  { label: 'IS / Reykjavik / ATTRACTION', query: 'Reykjavik', cc: 'IS', category: 'ATTRACTION' },
  { label: 'FR / Paris / HOTEL', query: 'Paris', cc: 'FR', category: 'HOTEL' },
  { label: 'JP / Tokyo / RESTAURANT', query: 'Tokyo', cc: 'JP', category: 'RESTAURANT' },
];

function pickName(location) {
  const names = location?.names || [];
  const fr = names.find((n) => (n.language || '').toLowerCase().startsWith('fr'));
  const primary = names.find((n) => n.primary);
  return (fr || primary || names[0])?.value ?? '(sans nom)';
}

function safeHost(rawUrl) {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return '(url invalide)';
  }
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const key = env.TRIPADVISOR_TERRA_API_KEY;
  if (!key || key.includes('your-')) {
    console.log('Test live Terra non exécuté : clé absente.');
    return 0;
  }
  console.log(`CONFIG: clé Terra présente (longueur ${key.length}) — valeur non affichée.`);

  const base = (env.TRIPADVISOR_TERRA_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  let worst = 0;

  for (const testCase of CASES) {
    const url = new URL(`${base}/locations/search`);
    for (const [name, value] of Object.entries({
      query: testCase.query,
      country_code: testCase.cc,
      category: testCase.category,
      locale: 'fr-FR',
      page: '1',
      size: '2',
    })) {
      url.searchParams.set(name, value);
    }
    console.log(`\n=== ${testCase.label} ===`);
    console.log(`REQUEST: GET ${url.toString()}`); // pas de clé (header X-API-Key)

    let response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-API-Key': key },
      });
    } catch (error) {
      console.log(`RÉSULTAT: erreur réseau — ${error?.message || 'inconnue'}`);
      if (worst < 1) worst = 1;
      continue;
    }

    let body = null;
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    const data = Array.isArray(body?.data) ? body.data : [];
    console.log(`HTTP ${response.status} · ${data.length} résultat(s)`);

    data.forEach((entry, index) => {
      const location = entry?.location || {};
      const countryCodes = (location.addresses || [])
        .map((a) => a.country_code)
        .filter(Boolean)
        .join(',') || '(absent)';
      const cities = (location.addresses || [])
        .map((a) => a.city)
        .filter(Boolean)
        .join(',') || '(absent)';
      const topLevel = (location.categories || [])
        .map((c) => c.top_level_category)
        .filter(Boolean)
        .join(',') || '(absent)';
      const taUrl = location.urls?.tripadvisor?.main;
      console.log(
        `  [${index + 1}] id=${location.id} name="${pickName(location)}" ` +
          `country_code=${countryCodes} city=${cities} top_level=${topLevel} ta_host=${taUrl ? safeHost(taUrl) : '(absent)'}`
      );
    });

    if (response.status === 401 || response.status === 403) {
      const detail = body?.detail || body?.title || body?.message || '';
      console.log(`  ↳ accès refusé: ${String(detail).slice(0, 160)}`);
      if (worst < 2) worst = 2;
    } else if (response.status === 429) {
      if (worst < 3) worst = 3;
    } else if (response.status !== 200) {
      if (worst < 1) worst = 1;
    }
  }

  console.log('\n=== SYNTHÈSE ===');
  console.log(
    worst === 0
      ? 'Toutes les requêtes ont répondu 200. Vérifier que chaque résultat correspond bien au country_code/catégorie demandés.'
      : `Au moins une requête a échoué (pire statut: ${worst}).`
  );
  return worst;
}

process.exitCode = await main();
