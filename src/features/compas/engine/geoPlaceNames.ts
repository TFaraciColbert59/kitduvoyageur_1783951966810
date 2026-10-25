/**
 * Noms par langue du référentiel des lieux habités (PLAN-100 6.4) : `public.geo_place_names`,
 * tirée de GeoNames `alternateNamesV2` (CC BY 4.0, comme `geo_places`). Fonctions pures : lecture
 * d'une ligne du fichier, choix du nom préféré par lieu et par langue, nom à afficher.
 *
 * RÈGLES :
 * - AUCUNE TRADUCTION INVENTÉE : un nom vient d'une ligne du fichier, tel quel (espaces en trop
 *   retirés), jamais d'une translittération, d'une règle ou d'une IA. Pas de nom dans une langue :
 *   le nom GeoNames, comme avant.
 * - Langues : codes ISO 639 de 2 ou 3 lettres seulement. Les pseudo-langues GeoNames (`link`,
 *   `post`, `iata`, `icao`, `faac`, `abbr`, `wkdt`, `unlc`, `fr_1793`…) et les noms sans langue sont
 *   écartés. Par défaut : les langues de l'interface (`LOCALES`) ; `--lang ru,ja…` pour d'autres.
 * - Un nom familier (`isColloquial`) ou historique (`isHistoric`, ou une période `to` renseignée)
 *   n'est jamais retenu.
 * - Un nom par lieu et par langue : le nom préféré (`isPreferredName`) d'abord, puis un nom non
 *   abrégé (`isShortName`), puis le plus ancien (identifiant le plus petit : choix stable d'un mois
 *   à l'autre).
 * - Le nom choisi est comparé au nom GeoNames APRÈS le choix : s'il a la même clé, aucune ligne
 *   (le nom GeoNames suffit, et la base ne garde pas de doublon) ; un autre nom moins sûr ne le
 *   remplace pas.
 * - Clé de recherche `name_key` (`placeNameKey`) : la clé latine d'avant si le nom a une lettre
 *   latine, sinon l'écriture d'origine (cyrillique, arabe, chinois…), sans translittération.
 */
import { LOCALES } from '@/lib/i18n/locale';
import { placeNameKey } from './geoPlaceSearch';

export { localPlaceName } from './geoPlaceSearch';

/** Langues importées par défaut : celles de l'interface. */
export const DEFAULT_NAME_LANGS: ReadonlySet<string> = new Set(LOCALES);

const LANG_RE = /^[a-z]{2,3}$/;
const NAME_MAX = 200;

/** Une ligne de `public.geo_place_names` (sans `updated_at`). */
export interface PlaceNameRow {
  alternate_name_id: number;
  place_id: number;
  lang: string;
  name: string;
  name_key: string;
  is_preferred: boolean;
  is_short: boolean;
}

export type PlaceNameDropReason = 'malforme' | 'hors_langue' | 'familier' | 'historique' | 'sans_nom';

/** « fr,ru,ja » → langues retenues ; un code qui n'est pas ISO 639 (2 ou 3 lettres) est refusé. */
export function parseNameLangs(v: string): ReadonlySet<string> {
  const langs = v
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const l of langs) if (!LANG_RE.test(l)) throw new Error(`Langue invalide : ${l}`);
  if (!langs.length) throw new Error('Aucune langue.');
  return new Set(langs);
}

const isId = (s: string) => /^\d+$/.test(s) && Number(s) > 0 && Number(s) <= 2_147_483_647;

/**
 * Une ligne d'`alternateNamesV2.txt` (alternateNameId, geonameid, isolanguage, alternate name,
 * isPreferredName, isShortName, isColloquial, isHistoric, from, to) → un nom candidat, ou la
 * raison de l'écarter.
 */
export function parseAlternateNameLine(
  line: string,
  langs: ReadonlySet<string> = DEFAULT_NAME_LANGS
): { name: PlaceNameRow; drop?: undefined } | { name?: undefined; drop: PlaceNameDropReason } {
  const c = line.replace(/\r$/, '').split('\t');
  if (c.length < 8 || !isId(c[0]) || !isId(c[1])) return { drop: 'malforme' };
  const lang = c[2];
  if (!LANG_RE.test(lang) || !langs.has(lang)) return { drop: 'hors_langue' };
  if (c[6] === '1') return { drop: 'familier' };
  if (c[7] === '1' || (c[9] ?? '').trim() !== '') return { drop: 'historique' };
  const name = c[3].replace(/\s+/g, ' ').trim();
  if (!name || name.length > NAME_MAX || !/\p{L}/u.test(name)) return { drop: 'sans_nom' };
  const key = placeNameKey(name);
  if (!key) return { drop: 'sans_nom' };
  return {
    name: {
      alternate_name_id: Number(c[0]),
      place_id: Number(c[1]),
      lang,
      name,
      name_key: key.slice(0, NAME_MAX),
      is_preferred: c[4] === '1',
      is_short: c[5] === '1',
    },
  };
}

/** Le meilleur des deux candidats d'un même lieu et d'une même langue. */
function better(a: PlaceNameRow, b: PlaceNameRow): PlaceNameRow {
  if (a.is_preferred !== b.is_preferred) return a.is_preferred ? a : b;
  if (a.is_short !== b.is_short) return a.is_short ? b : a;
  return a.alternate_name_id <= b.alternate_name_id ? a : b;
}

export interface CollectedPlaceNames {
  rows: PlaceNameRow[];
  dropped: Partial<Record<PlaceNameDropReason, number>>;
  lines: number;
  /** Noms choisis dont la clé est celle du nom GeoNames : aucune ligne. */
  sameAsGeonames: number;
  /** Noms choisis d'un lieu absent du référentiel : aucune ligne. */
  outsideReferential: number;
}

/**
 * Lecture ligne à ligne du fichier (environ 18 millions de lignes) : seul le meilleur candidat par
 * lieu et par langue reste en mémoire. `result(geonamesName)` : `geonamesName(id)` rend le nom
 * GeoNames du lieu, `undefined` s'il n'est pas dans le référentiel ; sans cette fonction (essai sans
 * référentiel), tout est gardé.
 */
export function createPlaceNameCollector(langs: ReadonlySet<string> = DEFAULT_NAME_LANGS) {
  const best = new Map<string, PlaceNameRow>();
  const dropped: Partial<Record<PlaceNameDropReason, number>> = {};
  let lines = 0;
  return {
    add(line: string): void {
      lines += 1;
      const got = parseAlternateNameLine(line, langs);
      if (!got.name) {
        dropped[got.drop] = (dropped[got.drop] ?? 0) + 1;
        return;
      }
      const k = `${got.name.place_id}\t${got.name.lang}`;
      const prev = best.get(k);
      best.set(k, prev ? better(prev, got.name) : got.name);
    },
    result(geonamesName?: (placeId: number) => string | undefined): CollectedPlaceNames {
      let sameAsGeonames = 0;
      let outsideReferential = 0;
      const rows: PlaceNameRow[] = [];
      for (const r of best.values()) {
        if (geonamesName) {
          const base = geonamesName(r.place_id);
          if (base === undefined) {
            outsideReferential += 1;
            continue;
          }
          if (placeNameKey(base) === r.name_key) {
            sameAsGeonames += 1;
            continue;
          }
        }
        rows.push(r);
      }
      rows.sort((a, b) => a.place_id - b.place_id || (a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0));
      return { rows, dropped: { ...dropped }, lines, sameAsGeonames, outsideReferential };
    },
  };
}
