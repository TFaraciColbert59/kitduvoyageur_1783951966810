/**
 * Compas — conseils de kit selon la météo et le parcours (fonction pure).
 *
 * Règle LKDV : un conseil cite la donnée qui le déclenche (jour, valeur,
 * source). Il ne crée jamais un objet à la place de l'utilisateur et ne chiffre
 * rien qu'il ne puisse expliquer. « Couvert » = un objet du kit porte un nom
 * qui correspond ; c'est un repérage, pas une certitude.
 */

import type { CompasDayPlan, CompasKitLine } from './compasModel';
import { tripDayLight } from './sun';
import type { DayForecast } from './weather';
import {
  ALTITUDE_PRONE_ACTIVITIES,
  CLIMATE_THRESHOLDS as C,
  NATURAL_WATER_ACTIVITIES,
  celsius,
  isTropicalLatitude,
  mmPerDay,
  readClimate,
  type ClimateWindow,
} from '@/features/trips/engine/climate';
import { formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { engineT } from './engineI18n';
import { monthName } from './period';

export type KitNeed =
  | 'pluie'
  | 'etanche'
  | 'chaud'
  | 'froid'
  | 'extremites'
  | 'soleil'
  | 'moustiques'
  | 'filtre'
  | 'frontale'
  | 'eau';

/**
 * Ce que les règles savent du lieu en plus de la météo des jours : normales
 * climatiques des mois du voyage SANS prévision (NASA POWER, plan 4.8). Aucun
 * nom de pays : le mois, la valeur et la source.
 */
export interface KitContext {
  /** Latitude du lieu, si connue. */
  lat: number | null;
  /** Altitude maximale du parcours (m), si connue (voir `altitudeFrom`). */
  maxAltitudeM: number | null;
  /**
   * D'où vient l'altitude. `trace` (défaut) : profil d'un tracé RÉEL (route du catalogue, tracé préparé), c'est
   * le point le plus haut mesuré ; jamais le profil de lignes droites entre les étapes.
   * `lieux` : relief sous les lieux du voyage seulement, un PLANCHER : un trek qui part d'un village
   * à 800 m peut passer un col à 5 400 m. Haute, elle prouve que le parcours monte ; basse, elle ne
   * prouve rien et les activités qui montent gardent leur formulation prudente.
   */
  altitudeFrom?: 'trace' | 'lieux';
  /** Point le plus bas du tracé (m), si le profil du tracé est lu : sert aux moustiques. */
  minAltitudeM?: number | null;
  /**
   * Étape la plus basse des lieux du voyage (m), lue sur le relief : le parcours y passe, donc il descend au
   * moins jusque-là. Ce n'est PAS le point bas du tracé (il peut descendre plus bas) et, haute, elle ne prouve
   * pas que le parcours reste haut : elle ne sert qu'à dire qu'il atteint des basses terres (moustiques).
   */
  lowestPlaceM?: number | null;
  /** Normales des mois du voyage non couverts par la prévision ; null : aucune lisible. */
  climate: ClimateWindow | null;
  /** Activité du voyage. */
  activity?: string | null;
}

/** Source citée pour un conseil tiré des normales. */
export const CLIMATE_SOURCE = engineT('fr')('compas.engine.kit.climateSource');

export interface KitAdvice {
  id: string;
  need: KitNeed;
  /** Ce qu'il faut avoir. */
  label: string;
  /** Pourquoi, avec la donnée et sa source. */
  reason: string;
  source: string;
  /** Un objet du kit correspond déjà. */
  covered: boolean;
  /** Nom de l'objet qui couvre le besoin, s'il existe. */
  coveredBy: string | null;
}

export const KIT_THRESHOLDS = {
  rainPct: 60,
  rainMm: 5,
  coldC: 3,
  freezeC: 0,
  sunC: 25,
  /** Repère courant : 0,5 L par heure de marche, 0,75 L par temps chaud. */
  waterLPerHour: 0.5,
  waterLPerHourHot: 0.75,
} as const;


const MATCH: Record<KitNeed, RegExp> = {
  pluie: /veste|imperm|gore|poncho|coupe-?pluie|k-?way|shell|cape/i,
  etanche: /[ée]tanche|dry ?-?bag|housse|pack ?liner|rain ?cover|sursac/i,
  chaud: /polaire|doudoune|isolant|fleece|down|primaloft|puffy|pull|laine|m[ée]rinos/i,
  froid: /polaire|doudoune|isolant|fleece|down|primaloft|puffy|pull|laine|m[ée]rinos/i,
  extremites: /gant|bonnet|mitaine|tour de cou|buff/i,
  soleil: /casquette|chapeau|cr[èe]me|solaire|lunette|spf/i,
  moustiques: /r[ée]pulsif|moustiqu|insect|icaridine|\bdeet\b|perm[ée]thrine/i,
  filtre: /filtre|paille filtrante|pastille|purifi|katadyn|sawyer|micropur|steripen/i,
  frontale: /frontale|lampe|headlamp|lanterne/i,
  eau: /gourde|bouteille|poche [àa] eau|hydrat|camelbak|flask|bidon/i,
};

/** Décimale à la virgule (« 8,5 » : français, espagnol, allemand, italien) ; en anglais, le point. */
const decimal = (n: number, locale: Locale) => (locale === 'en' ? String(n) : String(n).replace('.', ','));

/** « 8,5° S » : latitude lisible, une décimale au plus. */
const latLabel = (lat: number, locale: Locale) =>
  `${decimal(Math.round(Math.abs(lat) * 10) / 10, locale)}° ${lat < 0 ? 'S' : 'N'}`;

/** « 2 600 » : milliers séparés par une espace simple, comme le reste du Compas (« 2,600 » en anglais). */
const thousands = (n: number, locale: Locale) =>
  locale === 'fr'
    ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    : formatNumber(Math.round(n), { maximumFractionDigits: 0 }, locale);

/** « 12/10 » (jour/mois) ; en anglais américain, mois/jour ; en allemand, « 12.10. ». */
const shortDate = (iso: string, locale: Locale) => {
  const [y, m, d] = iso.split('-');
  if (!(y && m && d)) return iso;
  if (locale === 'en') return `${m}/${d}`;
  return locale === 'de' ? `${d}.${m}.` : `${d}/${m}`;
};

export function adviseKit(
  input: {
    lines: Array<Pick<CompasKitLine, 'name'>>;
    forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
    dayPlans: CompasDayPlan[];
    waterPointsCount: number | null;
    context?: KitContext;
  },
  locale: Locale = 'fr'
): KitAdvice[] {
  const T = KIT_THRESHOLDS;
  const t = engineT(locale);
  const month = (m: number) => monthName(m, locale);
  const mm = (n: number) =>
    locale === 'fr' ? mmPerDay(n) : t('compas.engine.kit.mmPerDay', { mm: decimal(Math.round(n * 10) / 10, locale) });
  const dateFr = (iso: string) => shortDate(iso, locale);
  const climateSource = t('compas.engine.kit.climateSource');
  const ctx = input.context;
  const climate = readClimate(ctx?.climate);
  const tropical = isTropicalLatitude(ctx?.lat);
  const altitude = ctx?.maxAltitudeM ?? null;
  // Altitude des seuls lieux : un plancher, jamais la preuve que le parcours reste bas.
  const floorOnly = ctx?.altitudeFrom === 'lieux';
  const altitudeUnproven =
    (altitude == null || floorOnly) && ALTITUDE_PRONE_ACTIVITIES.has(ctx?.activity ?? '');
  const altitudeLabel = (m: number) =>
    t(floorOnly ? 'compas.engine.kit.altitudePlaces' : 'compas.engine.kit.altitudeRoute', {
      m: thousands(m, locale),
    });
  const altitudeSource = t(floorOnly ? 'compas.engine.kit.sourcePlaces' : 'compas.engine.kit.sourceMeasured');
  const has = (need: KitNeed) => out.some((a) => a.need === need);
  const out: KitAdvice[] = [];
  const find = (need: KitNeed) => input.lines.find((l) => MATCH[need].test(l.name)) ?? null;
  const add = (need: KitNeed, label: string, reason: string, source: string) => {
    const hit = find(need);
    out.push({
      id: need,
      need,
      label,
      reason,
      source,
      covered: hit != null,
      coveredBy: hit?.name ?? null,
    });
  };

  const days = input.forecasts.filter((f) => f.forecast != null) as Array<{
    day: number;
    date: string;
    forecast: DayForecast;
  }>;

  /* Pluie : le jour le plus arrosé */
  const wet = days
    .filter(
      (d) => (d.forecast.precipPct ?? 0) >= T.rainPct || (d.forecast.precipMm ?? 0) >= T.rainMm
    )
    .sort((a, b) => (b.forecast.precipMm ?? 0) - (a.forecast.precipMm ?? 0))[0];
  if (wet) {
    const f = wet.forecast;
    add(
      'pluie',
      t('compas.engine.kit.rainJacket'),
      t(f.precipMm != null ? 'compas.engine.kit.rainDayAmount' : 'compas.engine.kit.rainDay', {
        day: wet.day,
        date: dateFr(wet.date),
        chance:
          f.precipPct != null
            ? t('compas.engine.kit.rainChance', { pct: Math.round(f.precipPct) })
            : t('compas.engine.kit.rainAnnounced'),
        mm: f.precipMm != null ? Math.round(f.precipMm) : '',
      }),
      'MET Norway'
    );
  } else if (climate?.rainy) {
    const w = climate.wettest;
    add(
      'pluie',
      t('compas.engine.kit.rainJacket'),
      t('compas.engine.kit.rainMonth', {
        month: month(w.month),
        mm: mm(w.precipMmDay),
        heavy: climate.heavyRain ? t('compas.engine.kit.heavyRainSuffix') : '',
      }),
      climateSource
    );
  }
  if (climate?.heavyRain)
    add(
      'etanche',
      t('compas.engine.kit.drySack'),
      t('compas.engine.kit.heavyRainMonth', {
        month: month(climate.wettest.month),
        mm: mm(climate.wettest.precipMmDay),
      }),
      climateSource
    );

  /* Froid : le jour le plus froid */
  const cold = days
    .filter((d) => d.forecast.tMin != null && d.forecast.tMin <= T.coldC)
    .sort((a, b) => (a.forecast.tMin ?? 99) - (b.forecast.tMin ?? 99))[0];
  if (cold) {
    const low = Math.round(cold.forecast.tMin as number);
    add(
      'froid',
      t('compas.engine.kit.warmLayer'),
      t('compas.engine.kit.coldDay', { day: cold.day, date: dateFr(cold.date), t: low }),
      'MET Norway'
    );
    if ((cold.forecast.tMin as number) <= T.freezeC)
      add(
        'extremites',
        t('compas.engine.kit.glovesHat'),
        t('compas.engine.kit.frostDay', { day: cold.day, date: dateFr(cold.date), t: low }),
        'MET Norway'
      );
  }
  if (!has('froid') && climate?.cool) {
    const c = climate.coldest;
    add(
      'froid',
      t('compas.engine.kit.warmLayer'),
      t('compas.engine.kit.coolMonth', { month: month(c.month), mean: celsius(c.tMeanC), min: celsius(c.tMinC) }),
      climateSource
    );
  }
  if (!has('extremites') && climate?.frost) {
    const c = climate.coldest;
    add(
      'extremites',
      t('compas.engine.kit.glovesHat'),
      t('compas.engine.kit.frostMonth', { month: month(c.month), min: celsius(c.tMinC), mean: celsius(c.tMeanC) }),
      climateSource
    );
  }

  // Froid d'altitude : la moyenne du mois est celle d'une maille de ~50 km, la montagne y est plus froide.
  // Altitude mesurée, sinon formulation prudente pour les activités qui montent (jamais le silence).
  if (!has('froid')) {
    if (altitude != null && altitude >= C.altitudeColdM)
      add(
        'froid',
        t('compas.engine.kit.warmLayer'),
        t('compas.engine.kit.altitudeCold', { where: altitudeLabel(altitude) }),
        t('compas.engine.kit.sourceGradient', { source: altitudeSource })
      );
    else if (altitudeUnproven)
      add(
        'froid',
        t('compas.engine.kit.warmLayer'),
        t('compas.engine.kit.altitudeColdUnmeasured'),
        t('compas.engine.kit.sourceUnmeasuredGradient')
      );
  }
  if (!has('extremites') && altitude != null && altitude >= C.altitudeGlovesM)
    add(
      'extremites',
      t('compas.engine.kit.glovesHat'),
      t('compas.engine.kit.altitudeFrost', { where: altitudeLabel(altitude) }),
      altitudeSource
    );

  /* Chaleur et soleil : le jour le plus chaud */
  const hot = days
    .filter((d) => d.forecast.tMax != null && d.forecast.tMax >= T.sunC)
    .sort((a, b) => (b.forecast.tMax ?? 0) - (a.forecast.tMax ?? 0))[0];
  if (hot)
    add(
      'soleil',
      t('compas.engine.kit.sunProtection'),
      t('compas.engine.kit.hotDay', {
        day: hot.day,
        date: dateFr(hot.date),
        t: Math.round(hot.forecast.tMax as number),
      }),
      'MET Norway'
    );
  else if (tropical)
    add(
      'soleil',
      t('compas.engine.kit.sunProtection'),
      t('compas.engine.kit.tropicalSun', { lat: latLabel(ctx?.lat as number, locale) }),
      t('compas.engine.kit.sourceLatitude')
    );
  else if (climate?.warm)
    add(
      'soleil',
      t('compas.engine.kit.sunProtection'),
      t('compas.engine.kit.warmMonth', {
        month: month(climate.hottest.month),
        mean: celsius(climate.hottest.tMeanC),
        hot: climate.hot ? t('compas.engine.kit.hotSuffix') : '',
      }),
      climateSource
    );

  /* Moustiques : sous les tropiques, pas dans un mois frais, et pas si TOUT le parcours est au-dessus de 2 500 m
     (altitude ou climat inconnus : dit par précaution). Le point le plus bas du tracé décide quand il est lu ;
     sinon le point le plus haut mesuré. Des lieux hauts seuls ne prouvent pas que le parcours n'en descend pas.
     Les normales ne sont lues qu'en UN point (la première étape) : un mois frais n'y parle que pour ce point.
     Si le tracé mesuré, ou une étape, descend sous 2 500 m, le parcours traverse des basses terres que ce point
     ne dit pas (Cusco, 9 °C en novembre, puis la forêt de Puerto Maldonado) : le contrôle du mois frais est alors
     ignoré. */
  const reachesLowland = [ctx?.minAltitudeM, ctx?.lowestPlaceM].some(
    (m) => m != null && m < C.mosquitoMaxAltitudeM
  );
  const allAbove =
    !reachesLowland &&
    (ctx?.minAltitudeM != null
      ? ctx.minAltitudeM >= C.mosquitoMaxAltitudeM
      : altitude != null && !floorOnly && altitude >= C.mosquitoMaxAltitudeM);
  const coolMonth = climate != null && climate.hottest.tMeanC < C.mosquitoMinMeanC;
  if (tropical && !allAbove && !(coolMonth && !reachesLowland))
    add(
      'moustiques',
      t('compas.engine.kit.mosquitoes'),
      t('compas.engine.kit.mosquitoZone', { lat: latLabel(ctx?.lat as number, locale) }),
      t('compas.engine.kit.sourceLatitude')
    );

  /* Filtre à eau : selon la ressource (tropiques, altitude, activité qui vit des sources), pas seulement l'altitude */
  const waterWhy: string[] = [];
  const waterSources: string[] = [];
  if (tropical) {
    waterWhy.push(t('compas.engine.kit.waterTropics'));
    waterSources.push(t('compas.engine.kit.sourceLatitude'));
  }
  if (altitude != null && altitude > C.filterAltitudeM) {
    waterWhy.push(t('compas.engine.kit.waterAltitude', { where: altitudeLabel(altitude) }));
    waterSources.push(altitudeSource);
  }
  if (NATURAL_WATER_ACTIVITIES.has(ctx?.activity ?? '')) {
    waterWhy.push(t('compas.engine.kit.waterActivity'));
    waterSources.push(t('compas.engine.kit.sourceActivity'));
  }
  if (waterWhy.length) {
    const n = input.waterPointsCount;
    if (n != null && n > 0)
      waterWhy.push(
        n === 1
          ? t('compas.engine.kit.waterPointOne')
          : t('compas.engine.kit.waterPointsOther', { count: n })
      );
    add('filtre', t('compas.engine.kit.waterFilter'), waterWhy.join(' '), waterSources.join(' · '));
  }

  /* Lumière : marche plus longue que le jour (prévision, sinon calcul astronomique) */
  for (const p of input.dayPlans) {
    if (p.walkMin == null) continue;
    const f = days.find((d) => d.day === p.day)?.forecast;
    const date = p.date ?? input.forecasts.find((d) => d.day === p.day)?.date ?? null;
    // Lever et coucher arrivent en « HH:MM » (heure locale du lieu).
    const light = tripDayLight(f, { lat: p.lat, lon: p.lon, date });
    if (light == null || p.walkMin <= light.minutes) continue;
    add(
      'frontale',
      t('compas.engine.kit.headlamp'),
      t('compas.engine.kit.headlampDay', { day: p.day }),
      light.from === 'prevision' ? 'DIN 33466 · MET Norway' : t('compas.engine.kit.sourceAstronomy')
    );
    break;
  }

  /* Eau : repère par heure de marche, jamais une quantité « exacte » */
  const longest = input.dayPlans
    .filter((p) => p.walkMin != null)
    .sort((a, b) => (b.walkMin as number) - (a.walkMin as number))[0];
  if (longest) {
    const hotDay = days.find((d) => d.day === longest.day)?.forecast.tMax ?? null;
    const perHour = hotDay != null && hotDay >= T.sunC ? T.waterLPerHourHot : T.waterLPerHour;
    const liters = Math.round(((longest.walkMin as number) / 60) * perHour * 10) / 10;
    const points =
      input.waterPointsCount == null
        ? t('compas.engine.kit.pointsUnknown')
        : input.waterPointsCount === 0
          ? t('compas.engine.kit.pointsNone')
          : t(input.waterPointsCount > 1 ? 'compas.engine.kit.pointsOther' : 'compas.engine.kit.pointsOne', {
              count: input.waterPointsCount,
            });
    // Mois chaud d'après les normales et pas déjà chaud d'après la prévision : le
    // repère par heure ne change pas (même chiffre que l'onglet Eau), on le dit.
    const warmMonth = climate?.hot && perHour === T.waterLPerHour ? climate.hottest : null;
    add(
      'eau',
      t('compas.engine.kit.waterContainers'),
      t('compas.engine.kit.waterDay', {
        day: longest.day,
        liters: decimal(liters, locale),
        perHour: decimal(perHour, locale),
        points,
        warm: warmMonth
          ? t('compas.engine.kit.warmMonthWater', { month: month(warmMonth.month), mean: celsius(warmMonth.tMeanC) })
          : '',
      }),
      warmMonth
        ? t('compas.engine.kit.sourceWaterClimate', { climate: climateSource })
        : t('compas.engine.kit.sourceWater')
    );
  }

  return out;
}
