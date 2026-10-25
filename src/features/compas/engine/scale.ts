/**
 * Compas — échelle d'un voyage : Sortie → Journée → Raid → Expédition → Monde.
 *
 * Convention de l'application (pas une norme) et uniquement fondée sur la durée
 * choisie ; sans durée, aucune échelle n'est affirmée.
 */

import type { Locale } from '@/lib/i18n/locale';
import type { TranslationKey } from '@/lib/i18n/translate';
import { engineT } from './engineI18n';

export type TripScaleId = 'sortie' | 'journee' | 'raid' | 'expedition' | 'monde';

export interface TripScale {
  id: TripScaleId;
  label: string;
  /** Pourquoi : la règle, lisible. */
  rule: string;
}

const H = 24;

/**
 * Bornes de la maquette v8 (zones de la règle de durée), bornes hautes
 * exclues. La règle et l'en-tête « Où » lisent cette seule table.
 */
export function classifyScale(hours: number | null, locale: Locale = 'fr'): TripScale | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  const id: TripScaleId =
    hours < 3 ? 'sortie' : hours < 12 ? 'journee' : hours < 2 * H ? 'raid' : hours < 10 * H ? 'expedition' : 'monde';
  const t = engineT(locale);
  return { id, label: t(SCALE_TEXT[id][0]), rule: t(SCALE_TEXT[id][1]) };
}

const SCALE_TEXT: Record<TripScaleId, [TranslationKey, TranslationKey]> = {
  sortie: ['compas.engine.scale.sortie', 'compas.engine.scale.sortieRule'],
  journee: ['compas.engine.scale.journee', 'compas.engine.scale.journeeRule'],
  raid: ['compas.engine.scale.raid', 'compas.engine.scale.raidRule'],
  expedition: ['compas.engine.scale.expedition', 'compas.engine.scale.expeditionRule'],
  monde: ['compas.engine.scale.monde', 'compas.engine.scale.mondeRule'],
};

/**
 * Durée qui fixe l'échelle affichée. Une seule journée au calendrier (24 h)
 * n'est pas un raid : on prend le temps d'effort du tracé quand il est connu
 * (10 km de course ≈ 1 h → Sortie), sinon une journée d'activité (Journée).
 */
export function scaleHours(hours: number | null, routeMinutes: number | null | undefined): number | null {
  if (hours !== 24) return hours;
  if (routeMinutes != null && routeMinutes > 0 && routeMinutes < 24 * 60) return routeMinutes / 60;
  return 8;
}
