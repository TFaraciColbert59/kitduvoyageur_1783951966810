#!/usr/bin/env node
/**
 * Live-check Viator — SANS jamais exposer la clé.
 *
 * - 1 seule destination, 2 résultats max.
 * - N'affiche que des métadonnées non sensibles (id, titre, note, avis, prix,
 *   devise, annulation gratuite, hostname du lien). Jamais la clé, jamais les headers.
 * - N'appelle jamais Details/Reviews. Aucun retry, aucune boucle.
 * - Résout l'ID de destination via l'endpoint officiel GET /destinations si non
 *   fourni, puis un UNIQUE POST /products/search (count=2).
 *
 * Codes : 0 = OK, 2 = 401/403, 3 = 429, 1 = autre/erreur réseau.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.join(process.cwd(), '.env.local');
const DEFAULT_BASE = 'https://api.viator.com/partner';

function loadEnv(file) {
  const out = {};
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const key = (env.VIATOR_API_KEY || process.env.VIATOR_API_KEY || '').trim();
  if (!key || key.includes('your-')) {
    console.log('Test live Viator non exécuté : clé absente.');
    return 0;
  }
  const base = (env.VIATOR_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  console.log(
    `CONFIG: base=${base.replace(/^https?:\/\//, '')} — clé présente (longueur ${key.length}), valeur non affichée.`
  );
  const getHeaders = {
    Accept: 'application/json;version=2.0',
    'Accept-Language': env.VIATOR_LANGUAGE || 'fr',
    'exp-api-key': key,
  };
  const postHeaders = { ...getHeaders, 'Content-Type': 'application/json' };

  let destinationId = /^\d+$/.test((env.VIATOR_DESTINATION_ID || '').trim())
    ? env.VIATOR_DESTINATION_ID.trim()
    : null;

  if (!destinationId) {
    // Résolution unique de l'ID destination via l'endpoint OFFICIEL /destinations.
    const endpoint = '/destinations';
    try {
      const res = await fetch(`${base}${endpoint}`, { method: 'GET', headers: getHeaders });
      console.log(`DESTINATIONS GET ${endpoint} -> HTTP ${res.status}`);
      if (res.status !== 200) {
        try {
          const errBody = await res.json();
          console.log(`DESTINATIONS body: ${JSON.stringify(errBody).slice(0, 300)}`);
        } catch {
          /* ignore */
        }
      }
      if (res.status === 200) {
        const body = await res.json();
        const list = Array.isArray(body) ? body : body?.destinations || body?.data || [];
        const nameOf = (d) => String(d?.name || d?.destinationName || '');
        const idOf = (d) => String(d?.destinationId ?? d?.id ?? '').trim();
        // Affiche des candidats officiels (non secrets) pour IS/FR/JP + villes.
        const wanted = /reykjavik|iceland|islande|france|paris|japan|japon|tokyo/i;
        list
          .filter((d) => wanted.test(nameOf(d)))
          .slice(0, 12)
          .forEach((d) => console.log(`  CANDIDAT "${nameOf(d)}" -> id=${idOf(d)}`));

        const match = list.find((d) => /reykjavik|iceland|islande/i.test(nameOf(d)));
        if (match) {
          destinationId = idOf(match);
          console.log(`DESTINATION: "${nameOf(match)}" id=${destinationId}`);
        }
      }
    } catch (e) {
      console.log(`DESTINATIONS /destinations erreur réseau: ${e?.message || 'inconnue'}`);
    }
  } else {
    console.log(`DESTINATION (env): id=${destinationId}`);
  }

  if (!destinationId) {
    console.log('RÉSULTAT: ID de destination introuvable (non inventé). Live-check arrêté.');
    return 1;
  }

  const url = `${base}/products/search`;
  console.log(`REQUEST: POST ${url} (clé en header exp-api-key, jamais en URL)`);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: postHeaders,
      body: JSON.stringify({
        filtering: { destination: destinationId },
        pagination: { start: 1, count: 2 },
        currency: 'EUR',
      }),
    });
  } catch (e) {
    console.log(`RÉSULTAT: erreur réseau — ${e?.message || 'inconnue'}`);
    return 1;
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  const products = Array.isArray(body?.products) ? body.products : [];
  console.log(`RESPONSE: HTTP ${res.status} · ${products.length} produit(s) · totalCount=${body?.totalCount ?? '?'}`);

  products.forEach((p, i) => {
    const ta = p?.productUrl;
    let host = '(absent)';
    try {
      host = new URL(ta).hostname;
    } catch {
      /* ignore */
    }
    console.log(
      `  [${i + 1}] code=${p.productCode} title="${p.title}" ` +
        `rating=${p?.reviews?.combinedAverageRating ?? '-'} reviews=${p?.reviews?.totalReviews ?? '-'} ` +
        `from=${p?.pricing?.summary?.fromPrice ?? '-'} ${p?.pricing?.currency ?? ''} ` +
        `freeCancel=${(p?.flags || []).includes('FREE_CANCELLATION')} host=${host}`
    );
  });

  if (res.status === 401 || res.status === 403) return 2;
  if (res.status === 429) return 3;
  return res.status === 200 ? 0 : 1;
}

process.exitCode = await main();
