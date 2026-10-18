/**
 * Recherche d'un lieu SAISI (destination, départ, domicile) dans le référentiel des lieux habités
 * `geo_places` (plan 3.1 et 1.3), avant la carte en ligne. Fonctions pures : la clé de recherche,
 * le choix d'un résultat SÛR parmi les lignes rendues par `geo_places_search`, la ligne en lieu du
 * Compas.
 *
 * Le référentiel ne connaît que des lieux habités (GeoNames `cities500`, et tous les lieux habités
 * de France, Suisse, Italie, Autriche), sous leur nom GeoNames (souvent anglais : « Vienna »,
 * « Florence ») : ni pays, ni région, ni massif, ni île, ni nom français. Un nom saisi peut donc
 * désigner tout autre chose qu'un lieu habité homonyme (« Bretagne » est aussi un village du
 * Territoire de Belfort, « Bali » une ville du Rajasthan, « Vienne » une ville de l'Isère). D'où
 * des règles prudentes ; dans le doute, rien (la carte répond comme avant) :
 * - jamais un nom de pays (« Panama » n'est pas Panamá, la capitale) ;
 * - nom EXACT (accents, casse et ponctuation mis à part), lieu qui domine ses homonymes (au moins
 *   10 fois plus peuplé que le suivant) ; puis, si le nom est d'un seul mot, une ville d'au moins
 *   100 000 habitants, et s'il est composé (« Villard-de-Lans »), un lieu d'au moins 200 habitants ;
 * - sinon, pour un nom composé seulement, un PRÉFIXE de mots (« Bourg en » → « Bourg-en-Bresse »)
 *   qui domine de même et compte au moins 10 000 habitants ;
 * - un nom exact trouvé mais refusé ne se rattrape pas par un préfixe.
 *
 * Noms français (alternateNamesV2, langue `fr`) : pas encore en base. Quand une colonne d'alias
 * existera (voir la migration `20261017140000_geo_places_search.sql`), la base rendra la ligne par
 * son alias, et la ligne portera ce nom dans `name_fr` : les mêmes règles s'y appliquent sans
 * changement ici que la comparaison au nom français en plus du nom GeoNames.
 */
import type { CompasPlace } from './places';
import { SETTLEMENT_KINDS, type GeoPlaceRow } from './geoPlaces';

/** Une ligne rendue par `geo_places_search` (les colonnes de `geo_places` utiles au Compas). */
export interface GeoPlaceSearchRow extends GeoPlaceRow {
  admin1?: string | null;
  /** Nom français (alternateNamesV2) : colonne future, absente aujourd'hui. */
  name_fr?: string | null;
}

/** Dominance exigée sur l'homonyme suivant. */
const DOMINANCE = 10;
/** Un nom d'un seul mot n'est lu dans le référentiel que pour une grande ville. */
const SINGLE_WORD_MIN_POP = 100_000;
/** Un nom composé exact : un lieu habité, pas un lieu-dit vide. */
const COMPOSITE_MIN_POP = 200;
/** Un préfixe : une ville. */
const PREFIX_MIN_POP = 10_000;

const SETTLEMENT_RANK: Record<string, number> = { city: 5, town: 4, village: 3, hamlet: 2 };

/** Clé de comparaison : sans accents, ligatures dépliées, minuscules, mots séparés d'une espace. */
export function placeSearchKey(v: string): string {
  return v
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let countryKeys: Set<string> | null = null;
/** Les noms de pays (français et anglais, par `Intl.DisplayNames`), sous leur clé. */
function countryNameKeys(): Set<string> {
  if (countryKeys) return countryKeys;
  const keys = new Set<string>();
  const A = 'A'.charCodeAt(0);
  for (const lang of ['fr', 'en']) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      continue;
    }
    for (let i = 0; i < 26; i++)
      for (let j = 0; j < 26; j++) {
        const cc = String.fromCharCode(A + i, A + j);
        if (cc === 'ZZ') continue;
        let name: string | undefined;
        try {
          name = names.of(cc);
        } catch {
          name = undefined;
        }
        if (!name || name === cc) continue;
        const key = placeSearchKey(name);
        if (key) keys.add(key);
      }
  }
  countryKeys = keys;
  return keys;
}

/** Le nom saisi est-il celui d'un pays (« Panama », « Singapour », « Luxembourg ») ? */
export function isCountryName(query: string): boolean {
  const key = placeSearchKey(query);
  return key.length > 0 && countryNameKeys().has(key);
}

function usable(r: GeoPlaceSearchRow): boolean {
  return (
    SETTLEMENT_KINDS.has(r.kind as never) &&
    typeof r.name === 'string' &&
    r.name.trim().length > 0 &&
    Number.isFinite(r.lat) &&
    Number.isFinite(r.lon) &&
    Number.isInteger(r.geoname_id)
  );
}

const pop = (r: GeoPlaceSearchRow) => (r.population != null && r.population > 0 ? r.population : 0);

/** Les clés sous lesquelles une ligne se compare (nom GeoNames, et nom français quand il existera). */
function rowKeys(r: GeoPlaceSearchRow): string[] {
  const keys = [placeSearchKey(r.name)];
  if (r.name_fr) keys.push(placeSearchKey(r.name_fr));
  return keys.filter(Boolean);
}

/** Le premier (le plus peuplé) s'il domine le suivant, sinon null. */
function dominant(rows: GeoPlaceSearchRow[]): GeoPlaceSearchRow | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => pop(b) - pop(a) || a.geoname_id - b.geoname_id);
  const [top, next] = sorted;
  if (!next) return top;
  return pop(top) >= DOMINANCE * Math.max(pop(next), 1) ? top : null;
}

/**
 * Le lieu du référentiel que désigne sûrement ce nom saisi, parmi les lignes rendues par la base ;
 * null s'il n'y en a pas, ou si le choix ne serait pas sûr (voir l'en-tête du module).
 */
export function pickReferentialPlace(
  rows: readonly GeoPlaceSearchRow[],
  query: string
): GeoPlaceSearchRow | null {
  const key = placeSearchKey(query);
  if (key.length < 3 || isCountryName(query)) return null;
  const composite = key.includes(' ');
  const ok = rows.filter(usable);
  const exact = ok.filter((r) => rowKeys(r).includes(key));
  if (exact.length) {
    const top = dominant(exact);
    if (!top) return null;
    return pop(top) >= (composite ? COMPOSITE_MIN_POP : SINGLE_WORD_MIN_POP) ? top : null;
  }
  if (!composite) return null;
  const prefixed = ok.filter((r) => rowKeys(r).some((k) => k.startsWith(`${key} `)));
  const top = dominant(prefixed);
  return top && pop(top) >= PREFIX_MIN_POP ? top : null;
}

const regionNames = new Map<string, Intl.DisplayNames | null>();
/** Le nom d'un pays dans cette langue, par `Intl` (CLDR : jamais traduit par nous) ; inconnu → null. */
function countryNameIn(cc: string, lang: string): string | null {
  if (!regionNames.has(lang)) {
    try {
      regionNames.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
    } catch {
      regionNames.set(lang, null);
    }
  }
  try {
    const name = regionNames.get(lang)?.of(cc);
    return name && name !== cc ? name : null;
  } catch {
    return null;
  }
}

/**
 * Une ligne du référentiel en lieu du Compas, de la forme d'un lieu habité de la carte : nature,
 * rang, pays (nom français par `Intl`). Aucune emprise (GeoNames donne un point) ni étiquette OSM
 * (la nature vient de la population GeoNames, pas d'une balise `place=*`). `lang` : la langue de
 * l'interface (PLAN-100 6.4), celle du nom du pays ; le français par défaut, comme avant. Le nom du
 * lieu reste le nom GeoNames : le référentiel n'a pas encore de nom par langue.
 */
export function referentialPlaceToCompas(row: GeoPlaceSearchRow, lang = 'fr'): CompasPlace {
  const cc =
    typeof row.country_code === 'string' && /^[A-Z]{2}$/.test(row.country_code)
      ? row.country_code
      : null;
  return {
    name: row.name.trim(),
    lat: row.lat,
    lon: row.lon,
    countryCode: cc,
    country: cc ? countryNameIn(cc, lang) : null,
    kind: row.kind,
    settlement: true,
    settlementRank: SETTLEMENT_RANK[row.kind] ?? 2,
    extent: null,
  };
}
