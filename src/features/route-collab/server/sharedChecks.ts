import 'server-only';
import { assessDanger, type DangerAssessment } from '@/features/compas/engine/danger';
import type { AlertsStatus } from '@/features/compas/engine/officialAlerts';
import { getCompasWeather, type CompasWeather } from '@/features/compas/server/weather';
import { getOfficialAlerts } from '@/features/compas/server/officialAlerts';
import type { Locale } from '@/lib/i18n/locale';
import { dayPlansForChecks, weatherDaysOf, type ChecksDay } from '../sharedChecksModel';

/**
 * Météo et vérifications de l'itinéraire avec les MÊMES sources que les tiroirs Météo et Vérifs du Compas v5
 * (10.7), pour que l'itinéraire et le Compas ne disent jamais deux choses différentes d'un même voyage :
 *  - météo : `getCompasWeather` (MET Norway CC BY 4.0, NASA POWER), prévision par jour au point d'arrivée ;
 *  - alertes officielles : `getOfficialAlerts` (Meteoalarm et services nationaux), lues au premier point daté ;
 *  - danger : `assessDanger` (trois axes physique / technique / conjoncturel, chaque signal daté et sourcé,
 *    un axe sans donnée est « non évalué » et non « sans danger »).
 *
 * Fonction serveur sans état et sans accès base : l'appelant (la route de l'onglet Analyser, autre agent) lui
 * passe les jours déjà lus sous RLS. Elle ne renvoie jamais d'erreur : une source muette donne `weather: null`
 * et un statut d'alertes explicite.
 */
export interface SharedChecks {
  readonly weather: CompasWeather | null;
  readonly danger: DangerAssessment;
  readonly alertsStatus: AlertsStatus;
  readonly alertsReadAt: string | null;
  readonly alertsService: string | null;
}

export async function getSharedChecks(input: {
  days: readonly ChecksDay[];
  /** Fuseau de repli (celui du voyage). */
  timeZone: string;
  locale?: Locale;
  now?: Date;
}): Promise<SharedChecks> {
  const plans = dayPlansForChecks(input.days);
  const weatherDays = weatherDaysOf(plans);
  const dated = plans.filter((p) => p.date != null);
  const first = weatherDays[0] ?? null;
  const [weather, alerts] = await Promise.all([
    getCompasWeather({ origin: first ? { lat: first.lat, lon: first.lon } : null, tripDays: weatherDays, timeZone: input.timeZone, now: input.now }).catch(() => null),
    getOfficialAlerts({
      point: first ? { lat: first.lat, lon: first.lon } : null,
      from: dated[0]?.date ?? null,
      to: dated.at(-1)?.date ?? null,
      timeZone: input.timeZone,
    }).catch(() => null),
  ]);
  const danger = assessDanger({
    dayPlans: plans,
    forecasts: (weather?.tripDays ?? []).map((d) => ({ day: d.day, date: d.date, forecast: d.forecast })),
    alerts: alerts?.alerts ?? [],
    alertsStatus: alerts?.status ?? 'indisponibles',
    locale: input.locale ?? 'fr',
  });
  return {
    weather,
    danger,
    alertsStatus: alerts?.status ?? 'indisponibles',
    alertsReadAt: alerts?.readAt ?? null,
    alertsService: alerts?.service ?? null,
  };
}
