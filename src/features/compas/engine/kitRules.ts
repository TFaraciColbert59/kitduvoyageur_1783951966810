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
  monthNameFr,
  readClimate,
  type ClimateWindow,
} from '@/features/trips/engine/climate';

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
   * D'où vient l'altitude. `trace` (défaut) : profil du tracé, c'est le point le plus haut mesuré.
   * `lieux` : relief sous les lieux du voyage seulement, un PLANCHER : un trek qui part d'un village
   * à 800 m peut passer un col à 5 400 m. Haute, elle prouve que le parcours monte ; basse, elle ne
   * prouve rien et les activités qui montent gardent leur formulation prudente.
   */
  altitudeFrom?: 'trace' | 'lieux';
  /** Point le plus bas du tracé (m), si le profil du tracé est lu : sert aux moustiques. */
  minAltitudeM?: number | null;
  /** Normales des mois du voyage non couverts par la prévision ; null : aucune lisible. */
  climate: ClimateWindow | null;
  /** Activité du voyage. */
  activity?: string | null;
}

/** Source citée pour un conseil tiré des normales. */
export const CLIMATE_SOURCE = 'NASA POWER · normales mensuelles';

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

/** « 8,5° S » : latitude lisible, une décimale au plus. */
const latLabel = (lat: number) =>
  `${(Math.round(Math.abs(lat) * 10) / 10).toString().replace('.', ',')}° ${lat < 0 ? 'S' : 'N'}`;

/** « 2 600 » : milliers séparés par une espace simple, comme le reste du Compas. */
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const dateFr = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}` : iso;
};

export function adviseKit(input: {
  lines: Array<Pick<CompasKitLine, 'name'>>;
  forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
  dayPlans: CompasDayPlan[];
  waterPointsCount: number | null;
  context?: KitContext;
}): KitAdvice[] {
  const T = KIT_THRESHOLDS;
  const ctx = input.context;
  const climate = readClimate(ctx?.climate);
  const tropical = isTropicalLatitude(ctx?.lat);
  const altitude = ctx?.maxAltitudeM ?? null;
  // Altitude des seuls lieux : un plancher, jamais la preuve que le parcours reste bas.
  const floorOnly = ctx?.altitudeFrom === 'lieux';
  const altitudeUnproven =
    (altitude == null || floorOnly) && ALTITUDE_PRONE_ACTIVITIES.has(ctx?.activity ?? '');
  const altitudeLabel = (m: number) =>
    floorOnly
      ? `Lieux du voyage jusqu’à ${thousands(m)} m (le parcours peut monter plus haut)`
      : `Parcours jusqu’à ${thousands(m)} m`;
  const altitudeSource = floorOnly ? 'altitude des lieux · relief' : 'altitude mesurée';
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
      'Veste imperméable',
      `Jour ${wet.day} (${dateFr(wet.date)}) : pluie ${f.precipPct != null ? `à ${Math.round(f.precipPct)} %` : 'annoncée'}${f.precipMm != null ? `, ${Math.round(f.precipMm)} mm` : ''}.`,
      'MET Norway'
    );
  } else if (climate?.rainy) {
    const w = climate.wettest;
    add(
      'pluie',
      'Veste imperméable',
      `En ${monthNameFr(w.month)} : ${mmPerDay(w.precipMmDay)} en moyenne${climate.heavyRain ? ', pluies abondantes (mousson ou saison des pluies)' : ''}.`,
      CLIMATE_SOURCE
    );
  }
  if (climate?.heavyRain)
    add(
      'etanche',
      'Housse ou sac étanche',
      `En ${monthNameFr(climate.wettest.month)} : ${mmPerDay(climate.wettest.precipMmDay)}, pluies abondantes (mousson ou saison des pluies) : protège le sac, l’électronique et les papiers.`,
      CLIMATE_SOURCE
    );

  /* Froid : le jour le plus froid */
  const cold = days
    .filter((d) => d.forecast.tMin != null && d.forecast.tMin <= T.coldC)
    .sort((a, b) => (a.forecast.tMin ?? 99) - (b.forecast.tMin ?? 99))[0];
  if (cold) {
    const t = Math.round(cold.forecast.tMin as number);
    add(
      'froid',
      'Couche chaude (polaire, doudoune)',
      `Jour ${cold.day} (${dateFr(cold.date)}) : minimum ${t} °C.`,
      'MET Norway'
    );
    if ((cold.forecast.tMin as number) <= T.freezeC)
      add(
        'extremites',
        'Gants et bonnet',
        `Jour ${cold.day} (${dateFr(cold.date)}) : gel possible (${t} °C).`,
        'MET Norway'
      );
  }
  if (!has('froid') && climate?.cool) {
    const c = climate.coldest;
    add(
      'froid',
      'Couche chaude (polaire, doudoune)',
      `En ${monthNameFr(c.month)} : température moyenne de ${celsius(c.tMeanC)} autour du lieu (minimum déjà relevé : ${celsius(c.tMinC)}). Moyenne sur une zone d’environ 50 km : plus froid en altitude.`,
      CLIMATE_SOURCE
    );
  }
  if (!has('extremites') && climate?.frost) {
    const c = climate.coldest;
    add(
      'extremites',
      'Gants et bonnet',
      `En ${monthNameFr(c.month)} : gel déjà relevé (${celsius(c.tMinC)}), température moyenne de ${celsius(c.tMeanC)}.`,
      CLIMATE_SOURCE
    );
  }

  // Froid d'altitude : la moyenne du mois est celle d'une maille de ~50 km, la montagne y est plus froide.
  // Altitude mesurée, sinon formulation prudente pour les activités qui montent (jamais le silence).
  if (!has('froid')) {
    if (altitude != null && altitude >= C.altitudeColdM)
      add(
        'froid',
        'Couche chaude (polaire, doudoune)',
        `${altitudeLabel(altitude)} : environ 6,5 °C de moins que dans la vallée par 1 000 m d’altitude.`,
        `${altitudeSource} · gradient standard`
      );
    else if (altitudeUnproven)
      add(
        'froid',
        'Couche chaude (polaire, doudoune)',
        'Altitude du parcours non mesurée : en montagne, environ 6,5 °C de moins par 1 000 m d’altitude ; prévois une couche chaude par précaution.',
        'altitude non mesurée · gradient standard'
      );
  }
  if (!has('extremites') && altitude != null && altitude >= C.altitudeGlovesM)
    add(
      'extremites',
      'Gants et bonnet',
      `${altitudeLabel(altitude)} : gel possible même en été.`,
      altitudeSource
    );

  /* Chaleur et soleil : le jour le plus chaud */
  const hot = days
    .filter((d) => d.forecast.tMax != null && d.forecast.tMax >= T.sunC)
    .sort((a, b) => (b.forecast.tMax ?? 0) - (a.forecast.tMax ?? 0))[0];
  if (hot)
    add(
      'soleil',
      'Protection solaire (chapeau, crème, lunettes)',
      `Jour ${hot.day} (${dateFr(hot.date)}) : jusqu'à ${Math.round(hot.forecast.tMax as number)} °C.`,
      'MET Norway'
    );
  else if (tropical)
    add(
      'soleil',
      'Protection solaire (chapeau, crème, lunettes)',
      `Zone tropicale (latitude ${latLabel(ctx?.lat as number)}) : le soleil est fort toute l’année.`,
      'latitude du lieu'
    );
  else if (climate?.warm)
    add(
      'soleil',
      'Protection solaire (chapeau, crème, lunettes)',
      `En ${monthNameFr(climate.hottest.month)} : température moyenne de ${celsius(climate.hottest.tMeanC)}${climate.hot ? ', mois chaud' : ''}.`,
      CLIMATE_SOURCE
    );

  /* Moustiques : sous les tropiques, pas dans un mois frais, et pas si TOUT le parcours est au-dessus de 2 500 m
     (altitude ou climat inconnus : dit par précaution). Le point le plus bas du tracé décide quand il est lu ;
     sinon le point le plus haut mesuré. Des lieux hauts seuls ne prouvent pas que le parcours n'en descend pas. */
  const allAbove =
    ctx?.minAltitudeM != null
      ? ctx.minAltitudeM >= C.mosquitoMaxAltitudeM
      : altitude != null && !floorOnly && altitude >= C.mosquitoMaxAltitudeM;
  if (tropical && !allAbove && !(climate && climate.hottest.tMeanC < C.mosquitoMinMeanC))
    add(
      'moustiques',
      'Répulsif et protection contre les moustiques',
      `Zone tropicale (latitude ${latLabel(ctx?.lat as number)}) : moustiques actifs toute l’année, porteurs de dengue ou de paludisme selon la zone. Répulsif, vêtements couvrants au crépuscule, moustiquaire si tu dors dehors ; avant de partir, demande conseil à un médecin.`,
      'latitude du lieu'
    );

  /* Filtre à eau : selon la ressource (tropiques, altitude, activité qui vit des sources), pas seulement l'altitude */
  const waterWhy: string[] = [];
  const waterSources: string[] = [];
  if (tropical) {
    waterWhy.push(
      'Zone tropicale : l’eau du robinet et celle des ruisseaux n’est pas toujours potable. Un filtre retient bactéries et parasites, pas la plupart des virus : ajoute des pastilles (ou fais bouillir).'
    );
    waterSources.push('latitude du lieu');
  }
  if (altitude != null && altitude > C.filterAltitudeM) {
    waterWhy.push(`${altitudeLabel(altitude)} : l’eau des névés, des torrents et des sources n’est pas contrôlée.`);
    waterSources.push(altitudeSource);
  }
  if (NATURAL_WATER_ACTIVITIES.has(ctx?.activity ?? '')) {
    waterWhy.push('Cette activité vit de l’eau des ruisseaux et des sources : filtre ou pastilles.');
    waterSources.push('activité du voyage');
  }
  if (waterWhy.length) {
    const n = input.waterPointsCount;
    if (n != null && n > 0)
      waterWhy.push(
        n === 1
          ? '1 point d’eau connu du tracé (fontaine ou source) : son contrôle n’est pas garanti.'
          : `${n} points d’eau connus du tracé (fontaines, sources) ne sont pas tous contrôlés.`
      );
    add('filtre', 'Filtre à eau ou pastilles de purification', waterWhy.join(' '), waterSources.join(' · '));
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
      'Lampe frontale',
      `Jour ${p.day} : la marche prévue dépasse la durée du jour.`,
      light.from === 'prevision' ? 'DIN 33466 · MET Norway' : 'DIN 33466 · calcul astronomique'
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
        ? 'points d’eau non renseignés sur le tracé'
        : input.waterPointsCount === 0
          ? 'aucun point d’eau connu sur le tracé : tout emporter'
          : `${input.waterPointsCount} point${input.waterPointsCount > 1 ? 's' : ''} d’eau connu${input.waterPointsCount > 1 ? 's' : ''}`;
    // Mois chaud d'après les normales et pas déjà chaud d'après la prévision : le
    // repère par heure ne change pas (même chiffre que l'onglet Eau), on le dit.
    const warmMonth = climate?.hot && perHour === T.waterLPerHour ? climate.hottest : null;
    add(
      'eau',
      'Contenants d’eau',
      `Jour ${longest.day} : environ ${String(liters).replace('.', ',')} L par personne (repère ${String(perHour).replace('.', ',')} L par heure de marche) ; ${points}${warmMonth ? `. ${monthNameFr(warmMonth.month)} est un mois chaud (${celsius(warmMonth.tMeanC)} de moyenne) : prévois plus que ce repère` : ''}.`,
      warmMonth ? `repère courant · parcours · ${CLIMATE_SOURCE}` : 'repère courant · parcours'
    );
  }

  return out;
}
