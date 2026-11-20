// Enregistre UNE réponse réelle d'un service tiers comme capture du test E2E.
//
//   node tests/e2e/compas/support/capture.mjs <url> <nom> [paramètres,à,comparer]
//
// Exemple (les deux premiers paramètres identifient la requête) :
//   node tests/e2e/compas/support/capture.mjs \
//     "https://photon.komoot.io/api/?q=Vercors&limit=8&lang=fr" photon-vercors q,limit
//
// Le fichier écrit dans fixtures/captures/<nom>.json garde l'adresse interrogée, la
// date et la réponse TELLE QUE REÇUE : rien n'est retouché à la main. Le serveur de
// doublures la rejoue pour toute requête dont l'hôte, le chemin et ces paramètres
// sont les mêmes. Les clés d'API ne doivent jamais figurer dans l'adresse.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [url, name, matchList = ''] = process.argv.slice(2);
if (!url || !name) {
  console.error('usage : capture.mjs <url> <nom> [params,à,comparer]');
  process.exit(2);
}
const u = new URL(url);
if (/key|token|secret/i.test(u.search)) {
  console.error('REFUS : l’adresse contient un paramètre qui ressemble à une clé.');
  process.exit(2);
}
const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'kitduvoyageur-e2e-capture/1.0 (fixtures de test)' } });
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  console.error(`Réponse non JSON (${res.status}) : ${text.slice(0, 200)}`);
  process.exit(1);
}
const query = {};
for (const k of matchList.split(',').filter(Boolean)) query[k] = u.searchParams.get(k);
const out = {
  source: `${u.origin}${u.pathname}${u.search}`,
  capturedAt: new Date().toISOString(),
  host: u.host,
  path: u.pathname,
  query,
  status: res.status,
  contentType: res.headers.get('content-type') ?? 'application/json',
  body,
};
const dir = path.join(process.cwd(), 'tests', 'e2e', 'compas', 'fixtures', 'captures');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(out, null, 2) + '\n');
console.info(`capture ${name}: HTTP ${res.status}, ${text.length} octets`);
