// Compas — devise de chaque pays (PLAN-100 4.2, « budget aussi dans la devise du pays »).
//
// Lit la « liste n° 1 » de la norme ISO 4217 (pays → code de devise), publiée par SIX,
// agence de maintenance de la norme :
//   https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
// et écrit dans `src/features/compas/data/` :
//   - `countryCurrencies.json` : { "CH": "CHF", … } (ISO 3166-1 alpha-2 → ISO 4217) ;
//   - `countryCurrencies.meta.json` : source, date de publication de la liste, date de lecture,
//     nombre de pays, empreinte SHA-256 du fichier lu.
//
// LES DONNÉES SONT NON FIABLES : le XML n'est jamais exécuté ; chaque entrée est lue par
// motif strict. Un nom de pays que ni `Intl` ni la table des alias ne reconnaît fait échouer
// le script (rien n'est écrit), comme un pays à plusieurs devises hors de la liste fermée
// `CHOICE` : le choix y est fait à la main, dit, et jamais deviné. Les fonds (`IsFund`),
// les métaux et les unités de compte (codes en X hors XAF, XOF, XCD, XPF) ne sont pas des
// devises de pays.
//
// Usage : node scripts/compas/build-country-currencies.mjs /chemin/vers/list-one.xml
// Aucune dépendance.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');

export const SOURCE_URL =
  'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml';

/** Codes en X qui sont bien la monnaie d'un territoire (francs CFA et CFP, dollar des Caraïbes orientales, florin caribéen). */
const X_CURRENCIES = new Set(['XAF', 'XOF', 'XCD', 'XPF', 'XCG']);

/**
 * Pays que la liste donne avec deux devises non-fonds : la monnaie que le voyageur manie,
 * choisie ici (jamais devinée) — le dollar américain circule seul au Panama et au Salvador
 * (le balboa n'existe qu'en pièces, le colón salvadorien n'est plus émis), la roupie
 * indienne n'est qu'une seconde monnaie légale au Bhoutan, le rand au Lesotho et en Namibie,
 * le dollar au Haïti, et le bolivar numérique (VED) n'est pas une monnaie de poche.
 */
export const CHOICE = Object.freeze({
  BT: 'BTN',
  SV: 'USD',
  HT: 'HTG',
  LS: 'LSL',
  NA: 'NAD',
  PA: 'USD',
  VE: 'VES',
});

/** Entrées de la liste qui ne sont pas des pays (organisations, codes d'essai, métaux). */
const NOT_COUNTRY = /^(ZZ\d|ARAB MONETARY FUND|INTERNATIONAL MONETARY FUND|SISTEMA UNITARIO|MEMBER COUNTRIES|EUROPEAN UNION)/;

/** Noms de la liste que `Intl` (anglais) n'écrit pas pareil → code ISO 3166-1. */
const ALIASES = Object.freeze({
  'FALKLAND ISLANDS (THE) [MALVINAS]': 'FK',
  'HEARD ISLAND AND MCDONALD ISLANDS': 'HM',
  'KOREA (THE DEMOCRATIC PEOPLE’S REPUBLIC OF)': 'KP',
  'KOREA (THE REPUBLIC OF)': 'KR',
  'LAO PEOPLE’S DEMOCRATIC REPUBLIC (THE)': 'LA',
  'TÜRKİYE': 'TR',
  'BOLIVIA (PLURINATIONAL STATE OF)': 'BO',
  'BRUNEI DARUSSALAM': 'BN',
  'CABO VERDE': 'CV',
  'CONGO (THE DEMOCRATIC REPUBLIC OF THE)': 'CD',
  'CONGO (THE)': 'CG',
  'CÔTE D’IVOIRE': 'CI',
  'EL SALVADOR': 'SV',
  'ESWATINI': 'SZ',
  'HOLY SEE (THE)': 'VA',
  'IRAN (ISLAMIC REPUBLIC OF)': 'IR',
  'MICRONESIA (FEDERATED STATES OF)': 'FM',
  'MOLDOVA (THE REPUBLIC OF)': 'MD',
  'NORTH MACEDONIA': 'MK',
  'PALESTINE, STATE OF': 'PS',
  'RUSSIAN FEDERATION (THE)': 'RU',
  'SAINT HELENA, ASCENSION AND TRISTAN DA CUNHA': 'SH',
  'SAINT MARTIN (FRENCH PART)': 'MF',
  'SINT MAARTEN (DUTCH PART)': 'SX',
  'SYRIAN ARAB REPUBLIC (THE)': 'SY',
  'TAIWAN (PROVINCE OF CHINA)': 'TW',
  'TANZANIA, UNITED REPUBLIC OF': 'TZ',
  'UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND (THE)': 'GB',
  'UNITED STATES OF AMERICA (THE)': 'US',
  'VENEZUELA (BOLIVARIAN REPUBLIC OF)': 'VE',
  'VIET NAM': 'VN',
  'VIRGIN ISLANDS (BRITISH)': 'VG',
  'VIRGIN ISLANDS (U.S.)': 'VI',
  'BONAIRE, SINT EUSTATIUS AND SABA': 'BQ',
  'CZECHIA': 'CZ',
  'MACAO': 'MO',
  'RÉUNION': 'RE',
  'SAINT BARTHÉLEMY': 'BL',
  'ÅLAND ISLANDS': 'AX',
  'CURAÇAO': 'CW',
  'UNITED STATES MINOR OUTLYING ISLANDS (THE)': 'UM',
  'HONG KONG': 'HK',
  'MYANMAR': 'MM',
  'PITCAIRN': 'PN',
  'SAINT VINCENT AND THE GRENADINES': 'VC',
  'SYRIAN ARAB REPUBLIC': 'SY',
});

const normalise = (s) =>
  s
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '’')
    .replace(/&/g, 'AND')
    .toUpperCase()
    .replace(/\bST\.? /g, 'SAINT ')
    .trim();

/**
 * Codes que `Intl` nomme mais qui ne sont pas (ou plus) des pays ISO 3166-1 : réservés, périmés (FX, DD, ZR…),
 * macro-régions. Ils partageraient le nom d'un vrai pays et le supplanteraient (FX, « France »).
 */
const NOT_COUNTRIES = new Set(
  'AC AN BU CP CQ CS DD DG DY EA EU EZ FX HV IC NH QO RH SU TA TP UK UN VD XA XB XK YD YU ZR ZZ'.split(' ')
);

/** Table nom anglais (`Intl`, en majuscules, sans article) → code, pour tous les codes à deux lettres. */
function intlNames() {
  const dn = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
  const out = new Map();
  for (let a = 65; a <= 90; a += 1)
    for (let b = 65; b <= 90; b += 1) {
      const code = String.fromCharCode(a, b);
      if (NOT_COUNTRIES.has(code)) continue;
      let name = null;
      try {
        name = dn.of(code);
      } catch {
        name = null;
      }
      if (name && name !== code) out.set(normalise(name).replace(/^THE /, ''), code);
    }
  return out;
}

const ALIAS_BY_LABEL = new Map(Object.entries(ALIASES).map(([name, code]) => [normalise(name), code]));

/** « (THE) » en fin de nom : l'article de la liste, pas une partie du nom. */
const stripThe = (s) => s.replace(/ \(THE\)$/, '');

/**
 * Pays → devise, d'après le texte XML de la liste n° 1. Lève une erreur sur tout ce qui n'est
 * pas reconnu : un pays sans code, un nom inconnu, un pays à plusieurs devises hors de `CHOICE`.
 */
export function parseListOne(xml) {
  const published = /<ISO_4217 Pblshd="(\d{4}-\d{2}-\d{2})"/.exec(xml)?.[1];
  if (!published) throw new Error('date de publication introuvable (Pblshd)');
  const names = intlNames();
  const byCountry = new Map();
  const entries = [...xml.matchAll(/<CcyNtry>([\s\S]*?)<\/CcyNtry>/g)];
  if (entries.length < 250) throw new Error(`liste tronquée : ${entries.length} entrées`);
  for (const [, body] of entries) {
    const name = /<CtryNm>([^<]*)<\/CtryNm>/.exec(body)?.[1];
    if (!name) throw new Error('entrée sans nom de pays');
    const label = normalise(name);
    if (NOT_COUNTRY.test(label)) continue;
    const ccy = /<Ccy>([A-Z]{3})<\/Ccy>/.exec(body)?.[1];
    // Pas de devise universelle (Antarctique) : pas de ligne.
    if (!ccy) continue;
    if (/<CcyNm [^>]*IsFund="true"/.test(body)) continue;
    if (ccy.startsWith('X') && !X_CURRENCIES.has(ccy)) continue;
    const code = ALIAS_BY_LABEL.get(label) ?? names.get(stripThe(label)) ?? names.get(label);
    if (!code) throw new Error(`pays inconnu de la liste : ${name}`);
    byCountry.set(code, [...(byCountry.get(code) ?? []), ccy]);
  }
  const out = {};
  for (const code of [...byCountry.keys()].sort()) {
    const list = [...new Set(byCountry.get(code))];
    if (list.length === 1) out[code] = list[0];
    else if (CHOICE[code] && list.includes(CHOICE[code])) out[code] = CHOICE[code];
    else throw new Error(`plusieurs devises pour ${code} (${list.join(', ')}) sans choix dans CHOICE`);
  }
  if (Object.keys(out).length < 235) throw new Error(`trop peu de pays : ${Object.keys(out).length}`);
  return { published, currencies: out };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage : node scripts/compas/build-country-currencies.mjs list-one.xml');
  const raw = await readFile(file);
  const { published, currencies } = parseListOne(raw.toString('utf8'));
  const meta = {
    source: 'ISO 4217, liste n° 1 (pays → devise), SIX, agence de maintenance de la norme',
    url: SOURCE_URL,
    published,
    fetched: new Date().toISOString().slice(0, 10),
    countries: Object.keys(currencies).length,
    sha256: createHash('sha256').update(raw).digest('hex'),
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'countryCurrencies.json'), `${JSON.stringify(currencies, null, 1)}\n`);
  await writeFile(path.join(OUT_DIR, 'countryCurrencies.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.info(`${meta.countries} pays, liste du ${published}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
