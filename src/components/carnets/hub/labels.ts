/**
 * Carnets de bord — hub `/carnets` : libellés et métriques de la carte.
 *
 * Fonctions pures (aucun composant) partagées par la carte de couverture, la
 * bande « En route maintenant » et les libellés d'accessibilité. Aucune donnée
 * inventée : un chiffre absent n'est pas affiché, plutôt qu'un « 0 » trompeur.
 */

import { formatCountFr, formatDecimal, formatInt } from '@/features/community/v2/shared/format';
import type { CarnetHubItem } from '@/features/carnet/hub/types';

/** « En route · J4 sur 9 » (pastille vivante) ; `null` hors phase en route. */
export function liveStatusLabel(item: CarnetHubItem): string | null {
  if (item.phase !== 'en_route') return null;
  if (item.dayCurrent != null && item.daysTotal != null) {
    return `En route · J${item.dayCurrent} sur ${item.daysTotal}`;
  }
  if (item.dayCurrent != null) return `En route · J${item.dayCurrent}`;
  return 'En route';
}

/** Métrique jours : « 4/9 » en route, « 9 » sinon ; `null` sans dates. */
export function daysMetricLabel(item: CarnetHubItem): string | null {
  if (item.dayCurrent != null && item.daysTotal != null) {
    return `${item.dayCurrent}/${item.daysTotal}`;
  }
  if (item.daysTotal != null) return formatInt(item.daysTotal);
  return null;
}

/** Métrique kilomètres, sans unité (l'unité est dans le libellé) ; `null` si aucune distance. */
export function kmMetricLabel(item: CarnetHubItem): string | null {
  if (!(item.distanceKm > 0)) return null;
  return formatDecimal(item.distanceKm, 1);
}

/** Métrique dénivelé positif, sans unité ; `null` si aucun dénivelé. */
export function dPlusMetricLabel(item: CarnetHubItem): string | null {
  if (!(item.elevationGainM > 0)) return null;
  return `+${formatInt(item.elevationGainM)}`;
}

/** Surtitre de couverture : le lieu, sinon rien d'inventé. */
export function coverKicker(item: CarnetHubItem): string {
  return item.destination || 'Carnet de bord';
}

/**
 * Lignes du tampon de pays (cachet pointillé) :
 * - avec code pays : massif / code / année (« ÉCRINS · FR · 2026 ») ;
 * - sans code pays : durée · kilomètres, sans code inventé (proposition n° 10).
 */
export function stampLines(item: CarnetHubItem): string[] {
  const year = item.startDate ? item.startDate.slice(0, 4) : null;
  if (item.countryIso) {
    return [coverKicker(item), item.countryIso, year].filter((line): line is string => Boolean(line));
  }
  const lines: string[] = [];
  if (item.daysTotal != null) lines.push(`${item.daysTotal} j`);
  if (item.distanceKm > 0) lines.push(`${formatInt(Math.round(item.distanceKm))} km`);
  if (lines.length === 0 && year) lines.push(year);
  return lines.length > 0 ? lines : ['Carnet'];
}

/** Libellé complet du lien de couverture (lecteur d'écran). */
export function cardAriaLabel(item: CarnetHubItem): string {
  const parts: string[] = [item.title];
  if (item.destination) parts.push(item.destination);
  if (item.phase === 'en_route' && item.dayCurrent != null) {
    parts.push(`en route, jour ${item.dayCurrent}`);
  }
  if (item.daysTotal != null) parts.push(formatCountFr(item.daysTotal, 'jour'));
  if (item.distanceKm > 0) parts.push(`${formatDecimal(item.distanceKm, 1)} kilomètres`);
  parts.push(`par ${item.author.name}`);
  if (item.verifiedGps) parts.push('trace GPS vérifiée');
  return parts.join(', ');
}

/** Libellé de la vignette de la bande « En route maintenant ». */
export function miniAriaLabel(item: CarnetHubItem): string {
  const parts: string[] = [item.title, `par ${item.author.name}`];
  const live = liveStatusLabel(item);
  if (live) parts.push(live);
  return parts.join(', ');
}

/** Initiale de repli du fond topographique (jamais affichée seule : le titre est dessus). */
export function coverInitial(item: CarnetHubItem): string {
  return (item.title.trim().charAt(0) || 'C').toUpperCase();
}
