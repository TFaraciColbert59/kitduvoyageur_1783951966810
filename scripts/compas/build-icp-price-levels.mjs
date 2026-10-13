// Compas — niveau de prix de l'alimentation par pays, ICP 2021 de la Banque mondiale (PLAN-100 4.6, repas).
//
// Lit deux réponses JSON de l'API publique de la Banque mondiale (source « ICP 2021 », n° 90) :
//   - « Produits alimentaires et boissons non alcoolisées » (série 1101000), indice de niveau de
//     prix (Monde = 100), année 2021 ;
//   - la liste des pays (codes ISO 3166-1 alpha-3 → alpha-2, pour écarter les agrégats).
// Les deux fichiers se téléchargent ainsi (réponses datées, à garder avec leur empreinte) :
//   https://api.worldbank.org/v2/sources/90/country/all/series/1101000/time/YR2021/classification/PX.WL?format=json&per_page=400
//   https://api.worldbank.org/v2/country?format=json&per_page=400
// Seule la série alimentaire est gardée : c'est celle des repas en autonomie, qui sont des courses.
// La série « Restaurants et hôtels » (1111000, même indice) donne les prix payés par les résidents,
// plus de 20 % sous le barème Compas dans 87 des 170 pays à la lecture du 12 octobre 2026 : elle ne
// sert pas, le barème Compas (ajusté au coût touristique) reste la base des repas au restaurant.
// Licence : CC BY 4.0 par défaut pour les jeux de la Banque mondiale
// (https://datacatalog.worldbank.org/public-licenses), attribution « The World Bank: Nom du jeu :
// Source », changements indiqués (ici : arrondi au dixième, pays sans valeur écartés).
//
// LES DONNÉES SONT NON FIABLES : seules les lignes d'un pays (pas d'un agrégat) avec un nombre entre
// 5 et 600 sont gardées ; une série, un classement ou une année inattendus font échouer le script
// (rien n'est écrit). Un pays sans valeur manque : le Compas retombe sur son barème, il n'invente rien.
//
// Usage : node scripts/compas/build-icp-price-levels.mjs alimentation.json pays.json AAAA-MM-JJ
//   (dernier argument : date de lecture de l'API)
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');

export const PAGE_URL = 'https://api.worldbank.org/v2/sources/90';
export const LICENCE_URL = 'https://datacatalog.worldbank.org/public-licenses';
export const CREDIT =
  'The World Bank: ICP 2021 (International Comparison Program), indice de niveau de prix (Monde = 100), série « Produits alimentaires et boissons non alcoolisées », année 2021 (CC BY 4.0) ; ramené à la France = 100 par le Compas, arrondi au dixième';

export const SERIES = Object.freeze({ food: '1101000' });
const CLASSIFICATION = 'PX.WL';
const YEAR = 'YR2021';
const MIN = 5;
const MAX = 600;

/** ISO3 → ISO2 des seuls pays (région « NA » = agrégat de la Banque mondiale, écarté). */
export function countryTable(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) throw new Error('liste des pays illisible');
  const out = {};
  for (const c of payload[1]) {
    if (!c || typeof c.id !== 'string' || typeof c.iso2Code !== 'string') continue;
    if (c.region?.id === 'NA') continue;
    if (!/^[A-Z]{3}$/.test(c.id) || !/^[A-Z]{2}$/.test(c.iso2Code)) continue;
    out[c.id] = c.iso2Code;
  }
  return out;
}

/** Les indices d'une série : { ISO2: nombre arrondi au dixième }, après contrôle de chaque ligne. */
export function parseSeries(payload, seriesId, iso3to2) {
  const data = payload?.source?.data;
  if (!Array.isArray(data)) throw new Error(`série ${seriesId} illisible`);
  const out = {};
  for (const row of data) {
    const v = Object.fromEntries((row?.variable ?? []).map((x) => [x.concept, x]));
    if (v.Series?.id !== seriesId) throw new Error(`série inattendue : ${v.Series?.id}`);
    if (v.Classification?.id !== CLASSIFICATION) throw new Error(`classement inattendu : ${v.Classification?.id}`);
    if (v.Time?.id !== YEAR) throw new Error(`année inattendue : ${v.Time?.id}`);
    const iso2 = iso3to2[v.Country?.id];
    if (!iso2) continue; // agrégat (Monde, régions…) ou économie hors liste
    const value = row.value;
    if (value == null) continue; // pas de valeur : le pays manque
    if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN || value > MAX)
      throw new Error(`valeur hors bornes pour ${v.Country.id} : ${value}`);
    out[iso2] = Math.round(value * 10) / 10;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const [foodFile, countriesFile, readOn] = process.argv.slice(2);
  if (!foodFile || !countriesFile || !/^\d{4}-\d{2}-\d{2}$/.test(readOn ?? ''))
    throw new Error('usage : node scripts/compas/build-icp-price-levels.mjs alimentation.json pays.json AAAA-MM-JJ');
  const raws = await Promise.all([foodFile, countriesFile].map((f) => readFile(f)));
  const [f, c] = raws.map((raw) => JSON.parse(raw.toString('utf8')));
  const food = parseSeries(f, SERIES.food, countryTable(c));
  if (Object.keys(food).length < 150) throw new Error('moins de 150 pays : lecture suspecte, rien n’est écrit');
  const lastUpdated = f.lastupdated;
  if (f.source?.id !== '90' || !/^\d{4}-\d{2}-\d{2}$/.test(lastUpdated ?? '')) throw new Error('source ou date de mise à jour de la série illisible');
  const data = {
    year: 2021,
    unit: 'indice de niveau de prix de l’alimentation, Monde = 100 (ICP 2021, Banque mondiale), arrondi au dixième',
    food,
  };
  const meta = {
    source: 'The World Bank: ICP 2021 (International Comparison Program), indice de niveau de prix (Monde = 100)',
    page: PAGE_URL,
    series: '1101000 : Produits alimentaires et boissons non alcoolisées',
    classification: 'PX.WL : Price level index (World = 100)',
    licence: 'CC BY 4.0',
    licenceUrl: LICENCE_URL,
    credit: CREDIT,
    year: 2021,
    lastUpdated,
    readOn,
    sha256: Object.fromEntries(['food', 'countries'].map((k, i) => [k, createHash('sha256').update(raws[i]).digest('hex')])),
    countries: Object.keys(food).length,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'icpPriceLevels.json'), `${JSON.stringify(data, null, 1)}\n`);
  await writeFile(path.join(OUT_DIR, 'icpPriceLevels.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.info(`${meta.countries} pays (alimentation)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
