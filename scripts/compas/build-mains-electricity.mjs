// Compas — prises, tension et fréquence du courant par pays (PLAN-100 4.2, lot AC).
//
// SOURCE : l'article « Mains electricity by country » de Wikipédia en anglais, tableau « Table of mains
// voltages, frequencies, and plugs ». Son texte dit que les lettres de prise (A à O) sont celles de l'ancien
// site « World Plugs » de la CEI (IEC, https://www.iec.ch/world-plugs) et que ce site est la source première
// de la tension et de la fréquence. Ce site de la CEI n'a PAS pu être lu le 12 octobre 2026 : protection
// anti-robot du CDN (HTTP 202 sans contenu, puis 403), aussi par un outil de lecture tiers. Le tableau de
// Wikipédia est donc la source lue, et c'est elle qui est citée.
// Licence : CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution : « Wikipedia
// contributors », adresse de la révision lue, adresse de l'historique (liste des auteurs), licence, changements
// indiqués (ici : lettres, tensions et fréquences extraites ; notes, normes nationales et renvois écartés).
// Partage dans les mêmes conditions : le fichier généré est un jeu dérivé et reste sous CC BY-SA 4.0.
//
// LA RÉVISION EST FIXÉE (reproductible) : la réponse JSON de l'API MediaWiki pour la révision 1379647853 se
// télécharge ainsi (réponse datée, à garder avec son empreinte) :
//   curl -sS -A "LKDV-Compas-build/1.0 (contact: <ton adresse>)" -o mains.json \
//     "https://en.wikipedia.org/w/api.php?action=query&prop=revisions&revids=1379647853&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&formatversion=2"
// (l'API limite les requêtes : réessayer après quelques secondes sur une réponse 429).
//
// LES DONNÉES SONT NON FIABLES (page modifiable par tous, de l'aveu même de l'article : « not necessarily
// totally accurate and up-to-date »). Le script échoue, sans rien écrire, sur : un nom de pays qu'il ne connaît
// pas (liste fermée `NAMES`), un code pays en double, une lettre de prise hors A–O, une tension hors 90–260 V
// pour le foyer, une fréquence autre que 50 ou 60 Hz, une ligne sans prise ni tension ni fréquence, moins de
// 200 lignes. Un pays que le tableau ne donne pas manque : le Compas dit « non renseigné », il n'invente rien.
//
// Usage : node scripts/compas/build-mains-electricity.mjs mains.json AAAA-MM-JJ
//   (dernier argument : date de lecture de l'API)
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');

export const TITLE = 'Mains electricity by country';
export const REVISION = 1379647853;
export const PAGE_URL = 'https://en.wikipedia.org/wiki/Mains_electricity_by_country';
export const REVISION_URL = `https://en.wikipedia.org/w/index.php?title=Mains_electricity_by_country&oldid=${REVISION}`;
export const HISTORY_URL = 'https://en.wikipedia.org/w/index.php?title=Mains_electricity_by_country&action=history';
export const LICENCE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
export const IEC_URL = 'https://www.iec.ch/world-plugs';
export const CREDIT =
  'Wikipedia contributors, « Mains electricity by country », révision 1379647853 du 11 octobre 2026 (CC BY-SA 4.0) ; lettres de prise de l’ancien site « World Plugs » de la CEI (IEC) ; lettres, tensions et fréquences extraites par le Compas, notes et normes nationales écartées';

/** Nom du tableau (modèle {{flag|…}}) → code ISO 3166-1 alpha-2. Liste fermée : tout autre nom fait échouer. */
const NAMES = {
  Afghanistan: 'AF', Albania: 'AL', Algeria: 'DZ', 'American Samoa': 'AS', Andorra: 'AD', Angola: 'AO',
  Anguilla: 'AI', 'Antigua and Barbuda': 'AG', Argentina: 'AR', Armenia: 'AM', Aruba: 'AW', Australia: 'AU',
  Austria: 'AT', Azerbaijan: 'AZ', Bahamas: 'BS', Bahrain: 'BH', Bangladesh: 'BD', Barbados: 'BB', Belarus: 'BY',
  Belgium: 'BE', Belize: 'BZ', Benin: 'BJ', Bermuda: 'BM', Bhutan: 'BT', Bolivia: 'BO',
  // Une seule ligne pour Bonaire, Saint-Eustache et Saba : les trois forment les Pays-Bas caribéens (BQ).
  Bonaire: 'BQ', 'Bosnia and Herzegovina': 'BA', Botswana: 'BW', Brazil: 'BR', 'British Virgin Islands': 'VG',
  Brunei: 'BN', Bulgaria: 'BG', 'Burkina Faso': 'BF', Burundi: 'BI', Cambodia: 'KH', Cameroon: 'CM', Canada: 'CA',
  'Cape Verde': 'CV', 'Cayman Islands': 'KY', 'Central African Republic': 'CF', Chad: 'TD', Chile: 'CL',
  China: 'CN', Colombia: 'CO', Comoros: 'KM', 'Congo, Republic of the': 'CG',
  'Congo, Democratic Republic of the': 'CD', 'Cook Islands': 'CK', 'Costa Rica': 'CR', "Côte d'Ivoire": 'CI',
  Croatia: 'HR', Cuba: 'CU', Curaçao: 'CW', Cyprus: 'CY', 'Czech Republic': 'CZ', Denmark: 'DK', Djibouti: 'DJ',
  Dominica: 'DM', 'Dominican Republic': 'DO', Ecuador: 'EC', Egypt: 'EG', 'El Salvador': 'SV',
  'Equatorial Guinea': 'GQ', Eritrea: 'ER', Estonia: 'EE', Eswatini: 'SZ', Ethiopia: 'ET',
  'Falkland Islands': 'FK', 'Faroe Islands': 'FO', Fiji: 'FJ', Finland: 'FI', France: 'FR',
  'French Guiana': 'GF', 'French Polynesia': 'PF', Gabon: 'GA', Gambia: 'GM', Georgia: 'GE', Germany: 'DE',
  Ghana: 'GH', Gibraltar: 'GI', Greece: 'GR', Greenland: 'GL', Grenada: 'GD', Guadeloupe: 'GP', Guam: 'GU',
  Guatemala: 'GT', Guernsey: 'GG', Guinea: 'GN', 'Guinea-Bissau': 'GW', Guyana: 'GY', Haiti: 'HT',
  Honduras: 'HN', 'Hong Kong': 'HK', Hungary: 'HU', Iceland: 'IS', India: 'IN', Indonesia: 'ID', Iran: 'IR',
  Iraq: 'IQ', Ireland: 'IE', 'Isle of Man': 'IM', Israel: 'IL', Italy: 'IT', Jamaica: 'JM', Japan: 'JP',
  Jersey: 'JE', Jordan: 'JO', Kazakhstan: 'KZ', Kenya: 'KE', Kiribati: 'KI', Kosovo: 'XK', Kuwait: 'KW',
  Kyrgyzstan: 'KG', Laos: 'LA', Latvia: 'LV', Lebanon: 'LB', Lesotho: 'LS', Liberia: 'LR', Libya: 'LY',
  Liechtenstein: 'LI', Lithuania: 'LT', Luxembourg: 'LU', Macau: 'MO', Madagascar: 'MG', Malawi: 'MW',
  Malaysia: 'MY', Maldives: 'MV', Mali: 'ML', Malta: 'MT', Martinique: 'MQ', Mauritania: 'MR', Mauritius: 'MU',
  Mexico: 'MX', 'Federated States of Micronesia': 'FM', Moldova: 'MD', Monaco: 'MC', Mongolia: 'MN',
  Montenegro: 'ME', Montserrat: 'MS', Morocco: 'MA', Mozambique: 'MZ', Myanmar: 'MM', Namibia: 'NA', Nauru: 'NR',
  Nepal: 'NP', Netherlands: 'NL', 'New Caledonia': 'NC', 'New Zealand': 'NZ', Nicaragua: 'NI', Niger: 'NE',
  Nigeria: 'NG', Niue: 'NU', 'North Korea': 'KP', 'North Macedonia': 'MK', Norway: 'NO', Oman: 'OM',
  Pakistan: 'PK', Palau: 'PW', Palestine: 'PS', Panama: 'PA', 'Papua New Guinea': 'PG', Paraguay: 'PY',
  Peru: 'PE', Philippines: 'PH', 'Pitcairn Islands': 'PN', Poland: 'PL', Portugal: 'PT', 'Puerto Rico': 'PR',
  Qatar: 'QA', Réunion: 'RE', Romania: 'RO', Russia: 'RU', Rwanda: 'RW',
  'Saint Helena, Ascension and Tristan da Cunha': 'SH', 'Saint Martin': 'MF', 'Sint Maarten': 'SX',
  'St. Kitts and Nevis': 'KN', 'St. Lucia': 'LC', 'Saint Pierre and Miquelon': 'PM',
  'St. Vincent and the Grenadines': 'VC', Samoa: 'WS', 'San Marino': 'SM', 'São Tomé and Príncipe': 'ST',
  'Saudi Arabia': 'SA', Senegal: 'SN', Serbia: 'RS', Seychelles: 'SC', 'Sierra Leone': 'SL', Singapore: 'SG',
  Slovakia: 'SK', Slovenia: 'SI', 'Solomon Islands': 'SB', Somalia: 'SO', 'South Africa': 'ZA',
  'South Korea': 'KR', Spain: 'ES', 'Sri Lanka': 'LK', Sudan: 'SD', Suriname: 'SR', Sweden: 'SE',
  Switzerland: 'CH', Syria: 'SY', Taiwan: 'TW', Tajikistan: 'TJ', Tanzania: 'TZ', Thailand: 'TH',
  'Timor-Leste': 'TL', Togo: 'TG', Tonga: 'TO', 'Trinidad and Tobago': 'TT', Tunisia: 'TN', Turkey: 'TR',
  Turkmenistan: 'TM', Tuvalu: 'TV', Uganda: 'UG', Ukraine: 'UA', 'United Arab Emirates': 'AE',
  'United Kingdom': 'GB', 'United States': 'US', 'US Virgin Islands': 'VI', Uruguay: 'UY', Uzbekistan: 'UZ',
  Vanuatu: 'VU', Venezuela: 'VE', Vietnam: 'VN', Yemen: 'YE', Zambia: 'ZM', Zimbabwe: 'ZW',
};

/** Retire les modèles `{{…}}` (imbriqués compris) et les renvois `<ref>`, sauf `{{flag|…}}` que l'appelant a lu avant. */
export function stripMarkup(cell) {
  let s = cell.replace(/<ref\b[^>]*\/>/g, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, '');
  for (;;) {
    const start = s.indexOf('{{');
    if (start < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < s.length - 1; i += 1) {
      if (s.startsWith('{{', i)) {
        depth += 1;
        i += 1;
      } else if (s.startsWith('}}', i)) {
        depth -= 1;
        i += 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0) throw new Error('modèle {{…}} non fermé');
    s = s.slice(0, start) + s.slice(end);
  }
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/<[^>]+>/g, '');
}

/**
 * Les cellules d'une ligne du tableau (`| …` en début de ligne), renvois et modèles compris : un `|` en début
 * de ligne dans un modèle `{{…}}` ou un renvoi `<ref>…</ref>` (paramètres d'une citation) n'ouvre pas de cellule.
 */
export function cellsOf(row) {
  const out = [];
  let cur = null;
  let depth = 0;
  let inRef = false;
  let atLineStart = true;
  for (let i = 0; i < row.length; i += 1) {
    const c = row[i];
    if (atLineStart && c === '|' && depth === 0 && !inRef) {
      if (cur !== null) out.push(cur);
      cur = '';
      atLineStart = false;
      continue;
    }
    let take = 1;
    if (row.startsWith('{{', i)) {
      depth += 1;
      take = 2;
    } else if (row.startsWith('}}', i)) {
      depth = Math.max(0, depth - 1);
      take = 2;
    } else if (row.startsWith('<ref', i) && !/^<ref\b[^>]*\/>/.test(row.slice(i, i + 400))) inRef = true;
    else if (row.startsWith('</ref>', i)) inRef = false;
    if (cur !== null) cur += row.slice(i, i + take);
    atLineStart = take === 1 && c === '\n';
    i += take - 1;
  }
  if (cur !== null) out.push(cur);
  return out;
}

/** Les lettres de prise d'une cellule, dans l'ordre, sans doublon ; une autre écriture fait échouer. */
export function plugLetters(cell, who) {
  const text = stripMarkup(cell)
    .replace(/\bNEMA\s*[\d-]+[A-Z]?/g, ' ')
    .replace(/\[\d+\]/g, ' ');
  const letters = [];
  for (const m of text.matchAll(/(?<![A-Za-z0-9-])([A-Z])(?![A-Za-z0-9-])/g)) {
    if (!/^[A-O]$/.test(m[1])) throw new Error(`${who} : lettre de prise inattendue « ${m[1]} »`);
    if (!letters.includes(m[1])) letters.push(m[1]);
  }
  const rest = text.replace(/(?<![A-Za-z0-9-])[A-O](?![A-Za-z0-9-])/g, '').replace(/[\s,;/()]+/g, '');
  if (rest) throw new Error(`${who} : texte inattendu dans la cellule des prises « ${rest} »`);
  return letters;
}

/**
 * Les lettres que les NOTES de l'article disent historiques, très rares, réservées à des usages particuliers
 * (climatiseurs, chaudières) ou sans prise sur place (« require an adaptor ») : « Type D mostly historical »,
 * « Type M historically used », « Type E and F sockets are legal but rare », « Type C appliances may be sold,
 * but may require an adaptor ». Seules les lettres que la ligne liste elle-même sont gardées. Le Compas ne les
 * affiche pas et ne les compte pas comme « en commun » (voir `engine/plugs.ts`), mais le fichier les garde.
 */
export const RARE_PHRASE =
  /\b(?:very rare|extremely rare|but rare|mostly historical|historically|no longer|very old installations|used mainly for|(?:may )?require an adaptor)\b/i;

export function rareLetters(notesCell, listed) {
  const text = stripMarkup(notesCell).replace(/\[\d+\]/g, ' ');
  const out = [];
  for (const sentence of text.split(/[.;\n]+/)) {
    if (!RARE_PHRASE.test(sentence)) continue;
    // « Type D », « Type E and F », « Type C) » : les lettres qui suivent le mot « Type ».
    for (const m of sentence.matchAll(/\bTypes?\s+([A-O](?:\s*(?:,|and|\/)\s*[A-O]\b)*)/g))
      for (const letter of m[1].match(/[A-O]/g) ?? []) if (listed.includes(letter) && !out.includes(letter)) out.push(letter);
  }
  return out;
}

/**
 * Les tensions du foyer : le premier nombre de chaque « A/B V » (tension phase-neutre, celle de la prise).
 * Les valeurs au-dessus de 260 V (277/480, 347/600 : réseaux commerciaux) ne sont pas celles d'une prise de
 * foyer. Aucune tension lue entre 90 et 260 V : la ligne n'a pas de tension.
 */
export function householdVolts(cell, who) {
  const text = stripMarkup(cell).replace(/\[\d+\]/g, ' ');
  const out = [];
  for (const m of text.matchAll(/(\d{2,3})(?:\s*\/\s*(\d{2,3}))?\s*V(?![A-Za-z])/g)) {
    const v = Number(m[1]);
    if (v > 260) continue;
    if (v < 90) throw new Error(`${who} : tension du foyer trop basse (${v} V)`);
    if (!out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

export function frequencies(cell, who) {
  const text = stripMarkup(cell).replace(/\[\d+\]/g, ' ');
  const out = [];
  for (const m of text.matchAll(/(\d{2,3})\s*Hz(?![A-Za-z])/g)) {
    const f = Number(m[1]);
    if (f !== 50 && f !== 60) throw new Error(`${who} : fréquence inattendue (${f} Hz)`);
    if (!out.includes(f)) out.push(f);
  }
  return out.sort((a, b) => a - b);
}

/** Le tableau de la révision : { ISO2: { plugs, volts, hz } }, après contrôle de chaque ligne. */
export function parseTable(wikitext) {
  const start = wikitext.indexOf('{| class="wikitable sortable');
  if (start < 0) throw new Error('tableau introuvable');
  const end = wikitext.indexOf('\n|}', start);
  if (end < 0) throw new Error('tableau non fermé');
  const rows = wikitext.slice(start, end).split(/\n\|-\s*\n/).slice(2);
  const out = {};
  for (const row of rows) {
    const cells = cellsOf(row);
    if (cells.length !== 6) throw new Error(`ligne à ${cells.length} cellules : ${row.slice(0, 80)}`);
    const flag = /\{\{flag\|([^|}]+)/.exec(cells[0]);
    if (!flag) throw new Error(`nom de pays illisible : ${cells[0].slice(0, 80)}`);
    const name = flag[1].trim();
    const iso = NAMES[name];
    if (!iso) throw new Error(`pays inconnu du script : « ${name} » (à ajouter à la liste fermée après vérification)`);
    if (out[iso]) throw new Error(`code ${iso} en double (« ${name} »)`);
    const plugs = plugLetters(cells[1], name);
    const volts = householdVolts(cells[3], name);
    const hz = frequencies(cells[4], name);
    if (!plugs.length || !volts.length || !hz.length)
      throw new Error(`${name} : prise, tension ou fréquence manquante (${plugs}, ${volts}, ${hz})`);
    const rare = rareLetters(cells[5], plugs);
    out[iso] = rare.length ? { plugs, rare, volts, hz } : { plugs, volts, hz };
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Une ligne par pays, pour qu'une mise à jour se lise dans un diff. */
export function format(data) {
  const lines = Object.entries(data).map(([iso, v]) => ` ${JSON.stringify(iso)}: ${JSON.stringify(v)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

async function main() {
  const [file, readOn] = process.argv.slice(2);
  if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(readOn ?? ''))
    throw new Error('usage : node scripts/compas/build-mains-electricity.mjs mains.json AAAA-MM-JJ');
  const raw = await readFile(file);
  const page = JSON.parse(raw.toString('utf8'))?.query?.pages?.[0];
  const rev = page?.revisions?.[0];
  if (page?.title !== TITLE || rev?.revid !== REVISION)
    throw new Error(`révision inattendue : ${page?.title} ${rev?.revid} (attendu : ${TITLE} ${REVISION})`);
  const timestamp = rev.timestamp;
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) throw new Error('date de la révision illisible');
  const content = rev.slots?.main?.content;
  if (typeof content !== 'string') throw new Error('contenu de la révision illisible');
  const data = parseTable(content);
  const countries = Object.keys(data).length;
  if (countries < 200) throw new Error(`${countries} pays seulement : lecture suspecte, rien n’est écrit`);
  const meta = {
    source: 'Wikipedia contributors, « Mains electricity by country » (tableau des prises, tensions et fréquences)',
    page: PAGE_URL,
    revision: REVISION,
    revisionUrl: REVISION_URL,
    revisionDate: timestamp.slice(0, 10),
    historyUrl: HISTORY_URL,
    licence: 'CC BY-SA 4.0',
    licenceUrl: LICENCE_URL,
    primarySource: 'IEC World Plugs (ancien site de la CEI), cité par l’article',
    primarySourceUrl: IEC_URL,
    primarySourceNote:
      'Selon l’article (section « Primary source »), la CEI a retiré ce site en septembre 2026 (« retired ... to keep IEC tools focused on our core mission », page consultée par l’article le 15 septembre 2026). Non lisible non plus le 12 octobre 2026 depuis le poste de construction (HTTP 202 sans contenu, puis 403) ; l’article de Wikipédia, lui, est cité.',
    credit: CREDIT,
    changes:
      'lettres de prise (A à O), tensions du foyer (premier nombre de chaque « A/B V », jusqu’à 260 V) et fréquences extraites ; lettres que les notes disent historiques, très rares, à usage particulier ou sans prise sur place gardées à part (`rare`) ; autres notes, normes nationales et renvois écartés',
    readOn,
    sha256: createHash('sha256').update(raw).digest('hex'),
    countries,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'mainsElectricity.json'), format(data));
  await writeFile(path.join(OUT_DIR, 'mainsElectricity.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.info(`${countries} pays (prises, tension, fréquence)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
