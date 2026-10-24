import type { Locale } from '@/lib/i18n/locale';
import type { CompasData } from '../../server/getCompasData';
import { daysBetweenIso, weatherLabel } from '../../engine/format';
import { countText, type CompasT } from '../../components/compasTypes';
import type { V5Day, V5Point, V5WeatherDay } from '../types';

/**
 * Modèle de vue du Compas v5 : fonctions PURES, sur les données réelles du voyage. Rien n'est inventé :
 * une valeur absente reste `null`. Les textes passent par `t` (dictionnaires `compas.v5.*`).
 */

/** « Jour 2 · Corrençon-en-Vercors » → « Corrençon-en-Vercors » (le préfixe dépend de la langue). */
export function splitStepTitle(title: string): string {
  return title.replace(/^\s*[\p{L}]+\s*\d+\s*[·:–—-]\s*/u, '').trim();
}

function weatherOf(data: CompasData, date: string | null, locale: Locale): V5WeatherDay | null {
  if (!date) return null;
  const d = data.model.weather.days.find((w) => w.date === date);
  if (!d) return null;
  return {
    date: d.date,
    tMinC: d.tempMinC,
    tMaxC: d.tempMaxC,
    precipPct: d.precipPct,
    code: d.weathercode,
    label: weatherLabel(d.weathercode, locale).label,
  };
}

/** Les jours du voyage, un par jour de marche, avec leur météo réelle et la nuit retenue. */
export function selectDays(data: CompasData, locale: Locale): V5Day[] {
  const plans = data.model.route.dayPlans;
  let previous: string | null = data.originName ?? null;
  return plans.map((plan, index) => {
    const to = splitStepTitle(plan.title) || null;
    const day: V5Day = {
      index,
      day: plan.day,
      date: plan.date,
      title: to ?? plan.title,
      from: previous,
      to,
      distanceKm: plan.distanceKm,
      gainM: plan.gainM,
      lossM: plan.lossM,
      walkMin: plan.walkMin,
      lat: plan.lat,
      lon: plan.lon,
      stay: plan.stay,
      isLast: index === plans.length - 1,
      weather: weatherOf(data, plan.date, locale),
    };
    previous = to;
    return day;
  });
}

/** Jours avant le départ (négatif : déjà parti), ou null sans date de départ. */
export function selectCountdown(startIso: string | null, todayIso: string): number | null {
  if (!startIso || !/^\d{4}-\d{2}-\d{2}/.test(startIso)) return null;
  return daysBetweenIso(todayIso, startIso.slice(0, 10));
}

/** Le voyage en une ligne de chiffres (card, en-tête de tiroirs). */
export function selectHeadline(data: CompasData) {
  const { model } = data;
  return {
    days: model.route.days || model.dates.days || 0,
    distanceKm: model.route.distanceKm || null,
    gainM: model.route.elevationGainM || null,
    people: Math.max(1, model.crew.size),
    budgetPerPerson: model.budget.perPerson,
    budgetPlanned: model.budget.planned,
    currency: model.budget.currency,
    nightsToFind: model.route.nightsToFind,
  };
}

/**
 * Ce qu'il reste à régler : des FAITS vérifiables, chacun avec sa source et le geste qui le règle, jamais une note.
 * Trois familles : toi (sac, niveau), le terrain (tracé), les conditions (météo, alertes, nuits, réservations).
 */
export function selectPoints(data: CompasData, t: CompasT, locale: Locale): V5Point[] {
  const { model } = data;
  const points: V5Point[] = [];

  if (model.kit.vitalMissing.length) {
    points.push({
      id: 'vital',
      kind: 'toi',
      severity: 'block',
      text: countText(t, locale, model.kit.vitalMissing.length, 'compas.v5.points.vitalOne', 'compas.v5.points.vitalOther'),
      action: { space: 'sac', tab: 0 },
      source: t('compas.v5.points.sourceKit'),
    });
  }
  const toBuy = model.kit.toAcquire.filter((l) => !l.vital);
  if (toBuy.length) {
    points.push({
      id: 'to-acquire',
      kind: 'toi',
      severity: 'warn',
      text: countText(t, locale, toBuy.length, 'compas.v5.points.toAcquireOne', 'compas.v5.points.toAcquireOther'),
      action: { space: 'prevoir', tab: 1 },
      source: t('compas.v5.points.sourceKit'),
    });
  }
  if (model.kit.unknownWeightCount > 0) {
    points.push({
      id: 'unknown-weight',
      kind: 'toi',
      severity: 'info',
      text: countText(t, locale, model.kit.unknownWeightCount, 'compas.v5.points.weightOne', 'compas.v5.points.weightOther'),
      action: { space: 'sac', tab: 0 },
      source: t('compas.v5.points.sourceKit'),
    });
  }
  if (model.crew.unassignedShared.length) {
    points.push({
      id: 'carriers',
      kind: 'toi',
      severity: 'warn',
      text: countText(t, locale, model.crew.unassignedShared.length, 'compas.v5.points.carrierOne', 'compas.v5.points.carrierOther'),
      action: { space: 'sac', tab: 2 },
      source: t('compas.v5.points.sourceCrew'),
    });
  }
  if (model.route.nightsToFind > 0) {
    points.push({
      id: 'nights',
      kind: 'conditions',
      severity: 'warn',
      text: countText(t, locale, model.route.nightsToFind, 'compas.v5.points.nightOne', 'compas.v5.points.nightOther'),
      action: { space: 'prevoir', tab: 0 },
      source: t('compas.v5.points.sourceRoute'),
    });
  }
  if (model.bookings.pending > 0) {
    points.push({
      id: 'bookings',
      kind: 'conditions',
      severity: 'warn',
      text: countText(t, locale, model.bookings.pending, 'compas.v5.points.bookingOne', 'compas.v5.points.bookingOther'),
      action: { space: 'prevoir', tab: 0 },
      source: t('compas.v5.points.sourceBookings'),
    });
  }
  if (!model.dates.start) {
    points.push({
      id: 'dates',
      kind: 'conditions',
      severity: 'warn',
      text: t('compas.v5.points.dates'),
      action: { space: 'voyage', tab: 2 },
      source: t('compas.v5.points.sourceTrip'),
    });
  }
  if (model.budget.overTarget) {
    points.push({
      id: 'budget',
      kind: 'conditions',
      severity: 'warn',
      text: t('compas.v5.points.overBudget'),
      action: { space: 'budget', tab: 0 },
      source: t('compas.v5.points.sourceBudget'),
    });
  }
  const family: Record<'physique' | 'technique' | 'conjoncturel', V5Point['kind']> = {
    physique: 'toi',
    technique: 'terrain',
    conjoncturel: 'conditions',
  };
  for (const s of data.danger.signals) {
    if (s.severity === 'info') continue;
    points.push({
      id: `danger:${s.id}`,
      kind: family[s.axis],
      severity: s.severity,
      text: s.label,
      action: s.day != null ? { space: 'day', day: Math.max(0, s.day - 1) } : { space: 'verifs' },
      source: `${s.source} · ${s.asOf}`,
    });
  }
  return points;
}

/** État d'ensemble pour la card : un compte de points, jamais un score. */
export function readiness(points: V5Point[]): { state: 'ready' | 'almost' | 'blocked'; count: number } {
  const open = points.filter((p) => p.severity !== 'info');
  if (open.some((p) => p.severity === 'block')) return { state: 'blocked', count: open.length };
  return { state: open.length ? 'almost' : 'ready', count: open.length };
}
