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

export type KitNeed = 'pluie' | 'chaud' | 'froid' | 'extremites' | 'soleil' | 'frontale' | 'eau';

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
  chaud: /polaire|doudoune|isolant|fleece|down|primaloft|puffy|pull|laine|m[ée]rinos/i,
  froid: /polaire|doudoune|isolant|fleece|down|primaloft|puffy|pull|laine|m[ée]rinos/i,
  extremites: /gant|bonnet|mitaine|tour de cou|buff/i,
  soleil: /casquette|chapeau|cr[èe]me|solaire|lunette|spf/i,
  frontale: /frontale|lampe|headlamp|lanterne/i,
  eau: /gourde|bouteille|poche [àa] eau|hydrat|camelbak|flask|bidon/i,
};

const dateFr = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}` : iso;
};

export function adviseKit(input: {
  lines: Array<Pick<CompasKitLine, 'name'>>;
  forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
  dayPlans: CompasDayPlan[];
  waterPointsCount: number | null;
}): KitAdvice[] {
  const T = KIT_THRESHOLDS;
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
  }

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
    add(
      'eau',
      'Contenants d’eau',
      `Jour ${longest.day} : environ ${String(liters).replace('.', ',')} L par personne (repère ${String(perHour).replace('.', ',')} L par heure de marche) ; ${points}.`,
      'repère courant · parcours'
    );
  }

  return out;
}
