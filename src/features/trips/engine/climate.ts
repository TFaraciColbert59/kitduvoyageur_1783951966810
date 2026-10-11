/**
 * Climat d'un voyage lu dans les normales mensuelles NASA POWER (fonctions pures).
 *
 * Remplace les listes de pays du kit (Islande, Népal, Maroc…) : un conseil de
 * froid, de pluie ou de chaleur cite la donnée qui le déclenche, le mois et la
 * valeur, pas un nom de pays.
 *
 * Ce que les données sont, et ne sont pas :
 * - `T2M` est la température MOYENNE du mois ; c'est elle qui dit le climat
 *   « typique » (couche chaude, soleil).
 * - `T2M_MIN` et `T2M_MAX` sont les EXTRÊMES relevés sur la période (Paris :
 *   -12 °C un janvier, 40 °C un juillet). Ils ne disent ni la nuit ni
 *   l'après-midi ordinaires : ils ne servent que de second garde-fou (gel déjà
 *   relevé), jamais de déclencheur seul.
 * - La maille est de l'ordre de 50 km : la montagne est plus froide que la
 *   moyenne de sa maille. Ces règles s'ajoutent à l'altitude mesurée, elles ne
 *   la remplacent pas.
 *
 * Aucune normale absente n'est comblée : sans normales ou sans date, il n'y a
 * pas de climat (`null`) et la règle se tait ou passe en formulation prudente.
 */

/** Douze valeurs par mesure, de janvier à décembre. */
export interface ClimateNormals {
  /** Température moyenne du mois (°C). */
  tMean: number[];
  /** Température la plus basse relevée dans le mois (°C). */
  tMin: number[];
  /** Température la plus haute relevée dans le mois (°C). */
  tMax: number[];
  /** Précipitations moyennes (mm par jour). */
  precip: number[];
}

export interface MonthNormals {
  /** 1-12 */
  month: number;
  tMeanC: number;
  tMinC: number;
  tMaxC: number;
  precipMmDay: number;
}

/** Les normales des mois que couvre le voyage. */
export interface ClimateWindow {
  months: MonthNormals[];
}

/** Seuils des règles, écrits une fois. */
export const CLIMATE_THRESHOLDS = {
  /** Moyenne du mois sous laquelle une couche chaude se justifie. */
  layerMeanC: 12,
  /** Gel : moyenne sous ce seuil ET un minimum déjà relevé sous `frostRecordC`. */
  frostMeanC: 10,
  frostRecordC: 0,
  /** Sol gelé ou verglacé : moyenne du mois à 2 °C ou moins. */
  iceMeanC: 2,
  /** Grand froid : moyenne à 2 °C ou moins ET minimum relevé à -10 °C ou moins. */
  deepColdMeanC: 2,
  deepColdRecordC: -10,
  /** Pluie : 3 mm par jour en moyenne (environ 90 mm par mois). */
  rainMmDay: 3,
  /** Pluies abondantes (mousson, saison des pluies) : 6 mm par jour (environ 180 mm par mois). */
  heavyRainMmDay: 6,
  /** Soleil : moyenne de 18 °C (après-midi autour de 25 °C). */
  warmMeanC: 18,
  /** Chaleur : moyenne de 24 °C. */
  hotMeanC: 24,
  /** Climat aride : moins de 0,5 mm par jour (même seuil que la période). */
  aridMmDay: 0.5,
  /** Moustiques porteurs de maladies : plus au-dessus de 2 500 m (repère courant)… */
  mosquitoMaxAltitudeM: 2500,
  /** …ni dans un mois dont la moyenne est sous 15 °C. */
  mosquitoMinMeanC: 15,
  /** Eau des névés, torrents et sources non contrôlée au-dessus de 2 400 m. */
  filterAltitudeM: 2400,
  /** Couche chaude à partir de 2 000 m (6,5 °C de moins par 1 000 m), gants et bonnet à partir de 3 000 m. */
  altitudeColdM: 2000,
  altitudeGlovesM: 3000,
} as const;

const T = CLIMATE_THRESHOLDS;

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Activités qui vivent de l'eau des ruisseaux et des sources : un filtre se
 * justifie là même sans altitude ni tropiques (plan 4.8, ressource en eau).
 */
export const NATURAL_WATER_ACTIVITIES: ReadonlySet<string> = new Set([
  'trekking',
  'bivouac',
  'bushcraft',
  'mountaineering',
]);

/**
 * Activités où l'altitude du parcours change le matériel et les conseils : sans
 * altitude mesurée, les règles passent en formulation prudente pour elles
 * (une randonnée ou une ville peuvent être n'importe où).
 */
export const ALTITUDE_PRONE_ACTIVITIES: ReadonlySet<string> = new Set([
  'mountaineering',
  'ski',
  'trekking',
  'climbing',
]);

/** Entre les tropiques (|latitude| < 23,5°) : soleil haut, pas d'hiver, saisons sèche et humide. */
export const isTropicalLatitude = (lat: number | null | undefined): boolean =>
  lat != null && Math.abs(lat) < 23.5;

export const monthNameFr = (m: number): string => MONTHS_FR[(((m - 1) % 12) + 12) % 12];

/** Mois (1-12) d'une date AAAA-MM-JJ, ou null si elle n'est pas lisible. */
function monthOfIso(iso: string): number | null {
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(iso);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

const usable = (series: unknown): series is number[] =>
  Array.isArray(series) && series.length === 12 && series.every((v) => typeof v === 'number' && Number.isFinite(v));

/**
 * Normales des mois des dates données (une fois chacun, dans l'ordre du
 * voyage). Null sans date lisible ou sans douze valeurs par mesure.
 */
export function climateWindow(
  normals: ClimateNormals | null | undefined,
  dates: readonly string[]
): ClimateWindow | null {
  if (!normals || !usable(normals.tMean) || !usable(normals.tMin) || !usable(normals.tMax) || !usable(normals.precip))
    return null;
  const seen = new Set<number>();
  const months: MonthNormals[] = [];
  for (const iso of dates) {
    const month = monthOfIso(iso);
    if (month == null || seen.has(month)) continue;
    seen.add(month);
    months.push({
      month,
      tMeanC: normals.tMean[month - 1],
      tMinC: normals.tMin[month - 1],
      tMaxC: normals.tMax[month - 1],
      precipMmDay: normals.precip[month - 1],
    });
  }
  return months.length ? { months } : null;
}

export interface ClimateReading {
  /** Le mois le plus froid (moyenne) du voyage. */
  coldest: MonthNormals;
  /** Le mois le plus arrosé du voyage. */
  wettest: MonthNormals;
  /** Le mois le plus chaud (moyenne) du voyage. */
  hottest: MonthNormals;
  /** Un mois sec ET chaud (désert), s'il y en a un. */
  desertHot: MonthNormals | null;
  /** Couche chaude justifiée. */
  cool: boolean;
  /** Gel déjà relevé dans un mois frais : gants et bonnet. */
  frost: boolean;
  /** Sol gelé ou verglacé possible. */
  icy: boolean;
  /** Grand froid. */
  deepCold: boolean;
  /** Pluie. */
  rainy: boolean;
  /** Pluies abondantes (mousson, saison des pluies). */
  heavyRain: boolean;
  /** Mois doux à chaud : protection solaire. */
  warm: boolean;
  /** Mois chaud. */
  hot: boolean;
}

const extreme = (months: MonthNormals[], better: (a: MonthNormals, b: MonthNormals) => boolean): MonthNormals =>
  months.reduce((best, m) => (better(m, best) ? m : best));

/** Lit la fenêtre : le pire mois pour chaque besoin et les drapeaux qui en découlent. */
export function readClimate(window: ClimateWindow | null | undefined): ClimateReading | null {
  const months = window?.months;
  if (!months?.length) return null;
  const coldest = extreme(months, (a, b) => a.tMeanC < b.tMeanC);
  const wettest = extreme(months, (a, b) => a.precipMmDay > b.precipMmDay);
  const hottest = extreme(months, (a, b) => a.tMeanC > b.tMeanC);
  return {
    coldest,
    wettest,
    hottest,
    desertHot: months.find((m) => m.precipMmDay < T.aridMmDay && m.tMeanC >= T.hotMeanC) ?? null,
    cool: coldest.tMeanC <= T.layerMeanC,
    frost: coldest.tMeanC <= T.frostMeanC && coldest.tMinC <= T.frostRecordC,
    icy: coldest.tMeanC <= T.iceMeanC,
    deepCold: coldest.tMeanC <= T.deepColdMeanC && coldest.tMinC <= T.deepColdRecordC,
    rainy: wettest.precipMmDay >= T.rainMmDay,
    heavyRain: wettest.precipMmDay >= T.heavyRainMmDay,
    warm: hottest.tMeanC >= T.warmMeanC,
    hot: hottest.tMeanC >= T.hotMeanC,
  };
}

/** Un nombre lisible : arrondi, sans « -0 ». */
export const celsius = (n: number): string => `${Math.round(n) + 0} °C`;

/** Millimètres par jour, une décimale, virgule française. */
export const mmPerDay = (n: number): string => `${(Math.round(n * 10) / 10).toString().replace('.', ',')} mm par jour`;
