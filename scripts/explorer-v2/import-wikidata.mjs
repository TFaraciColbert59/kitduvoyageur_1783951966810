#!/usr/bin/env node
/**
 * Faits pratiques par pays depuis Wikidata (P1-03, 05_DONNEES §2).
 *
 * Récupère par SPARQL (gratuit, CC0) :
 *   - P2852 : numéro d'urgence ;
 *   - P2853 : type de prise électrique ;
 *   - P1622 : sens de circulation.
 * Écrit dans `public.country_practical`, une ligne par pays, avec la source et
 * la licence. Aucune valeur inventée : un pays sans donnée n'a pas de ligne.
 *
 * Usage : node scripts/explorer-v2/import-wikidata.mjs [--dry]
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'icxyvwzfjbflcbqukpfz';
const dry = process.argv.includes('--dry');
const token = readFileSync(join(homedir(), '.supabase/access-token'), 'utf8').trim();

const ENDPOINT = 'https://query.wikidata.org/sparql';
const QUERY = `
SELECT ?iso ?emergency ?emergencyLabel ?plugLabel ?sideLabel WHERE {
  ?country wdt:P297 ?iso .
  OPTIONAL {
    ?country wdt:P2852 ?emergency .
    OPTIONAL { ?emergency rdfs:label ?emergencyLabel . FILTER(LANG(?emergencyLabel) = "en") }
  }
  OPTIONAL { ?country wdt:P2853 ?plug . ?plug rdfs:label ?plugLabel . FILTER(LANG(?plugLabel) = "en") }
  OPTIONAL { ?country wdt:P1622 ?side . ?side rdfs:label ?sideLabel . FILTER(LANG(?sideLabel) = "en") }
}`;

async function sparql() {
  const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(QUERY)}`, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'LKDV-Explorer/2.0 (https://lekitduvoyageur.fr; contact@lekitduvoyageur.fr)',
    },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const json = await res.json();
  return json.results.bindings;
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status} : ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : [];
}

const rows = await sparql();
console.log(`lignes Wikidata : ${rows.length}`);

const byIso = new Map();
for (const row of rows) {
  const iso = row.iso?.value?.toUpperCase();
  if (!iso || !/^[A-Z]{2}$/.test(iso)) continue;
  const entry = byIso.get(iso) ?? { emergency: new Set(), plugs: new Set(), side: null };
  const emergencyRaw = row.emergencyLabel?.value ?? row.emergency?.value;
  if (emergencyRaw) {
    // P2852 vaut parfois un item Wikidata : on garde alors son libellé.
    const label = emergencyRaw.trim();
    const digits = label.match(/\b(\d{2,4})\b/);
    entry.emergency.add(digits ? digits[1] : label);
  }
  if (row.plugLabel?.value) entry.plugs.add(row.plugLabel.value.trim());
  if (row.sideLabel?.value) {
    const side = row.sideLabel.value.toLowerCase();
    entry.side = side.includes('left') ? 'left' : side.includes('right') ? 'right' : entry.side;
  }
  byIso.set(iso, entry);
}

console.log(`pays avec au moins un fait : ${byIso.size}`);

/**
 * Les libellés de prises Wikidata sont verbeux : on les ramène aux types IEC
 * courants. Un libellé inconnu est ignoré plutôt que mal étiqueté.
 */
const PLUG_MAP = [
  [/\bEuroplug\b/i, 'Type C'],
  [/\bSchuko\b/i, 'Type F'],
  [/\bBS 1363\b/i, 'Type G'],
  [/\bNEMA 5-15\b/i, 'Type B'],
  [/\bNEMA 1-15\b/i, 'Type A'],
  [/\bAS\/NZS 3112\b/i, 'Type I'],
  [/\bType ([A-N])\b/, null],
];

function normalizePlug(label) {
  for (const [pattern, mapped] of PLUG_MAP) {
    const match = label.match(pattern);
    if (!match) continue;
    return mapped ?? `Type ${match[1]}`;
  }
  return null;
}

const values = [];
for (const [iso, entry] of byIso) {
  if (entry.emergency.size === 0 && entry.plugs.size === 0 && !entry.side) continue;
  const emergency = JSON.stringify({ general: [...entry.emergency][0] ?? null });
  const normalizedPlugs = [...new Set([...entry.plugs].map(normalizePlug).filter(Boolean))];
  const plugs = normalizedPlugs.length
    ? `array[${normalizedPlugs.map((p) => `'${p.replace(/'/g, "''")}'`).join(',')}]`
    : 'null';
  const side = entry.side ? `'${entry.side}'` : 'null';
  values.push(`('${iso}', '${emergency}'::jsonb, ${plugs}, ${side})`);
}

console.log(`lignes à écrire : ${values.length}`);
if (dry) {
  console.log(values.slice(0, 5).join('\n'));
  process.exit(0);
}

// Écriture par lots de 60 pour rester sous la limite de requête.
for (let index = 0; index < values.length; index += 60) {
  const chunk = values.slice(index, index + 60);
  await sql(`
    insert into public.country_practical (iso_a2, emergency_numbers, plug_types, driving_side, source, license, updated_at)
    values ${chunk.map((v) => `${v.slice(0, -1)}, 'wikidata', 'CC0', now())`).join(',')}
    on conflict (iso_a2) do update
      set emergency_numbers = excluded.emergency_numbers,
          plug_types = excluded.plug_types,
          driving_side = coalesce(excluded.driving_side, public.country_practical.driving_side),
          updated_at = now();
  `);
  console.log(`  ${Math.min(values.length, index + 60)}/${values.length}`);
}

const check = await sql(`select count(*)::int as n from public.country_practical;`);
console.log(`\npays pratiques en base : ${check[0].n}`);
const sample = await sql(
  `select iso_a2, emergency_numbers, plug_types, driving_side from public.country_practical where iso_a2 in ('FR','JP','US') order by iso_a2;`,
);
console.log(JSON.stringify(sample));
