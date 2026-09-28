import { formatCivilDate, parseCivilDate } from '@/lib/dates/tripDates';
import type { AdventurePrepDraft } from '../types';

/**
 * Detection d un brouillon perime.
 *
 * Le brouillon persiste dans localStorage. Revenir le lendemain, la semaine
 * suivante ou le mois suivant resservait un plan dont toutes les dates sont
 * passees, sans le dire. Le symptome mesure : 16 etapes enregistrees le
 * 21 septembre, relues le 28. Et comme la meteo se demande sur une fenetre
 * de dates, un plan perime ne peut pas non plus etre enrichi.
 *
 * Ce module ne decide rien et ne corrige rien : il constate, il nomme. La
 * decision (reinitialiser, garder, replanifier) appartient a la personne.
 * C est la meme separation que le reste du moteur.
 *
 * Les dates passent par `@/lib/dates/tripDates` (D8) : ce sont des dates
 * civiles, jamais des instants. Comparer des dates de voyage avec un
 * fuseau local ferait passer une date pour une autre a une heure de la journee
 * pres — exactement le piege que D8 a fait interdire.
 */

const MS_PER_DAY = 86_400_000;

export interface StaleDraftNotice {
  /** Date de depart enregistree dans le brouillon, telle qu ecrite. */
  readonly startDate: string;
  /** Nombre de jours entierement ecoules depuis cette date. */
  readonly daysAgo: number;
}

/** Minuit UTC de la date, ou `null` si la date est illisible ou inexistante. */
function toUtcDay(iso: string): number | null {
  const civil = parseCivilDate(iso);
  if (civil === null) return null;

  const stamp = Date.UTC(civil.year, civil.month - 1, civil.day);
  // Aller-retour : 2026-02-31 ressort en mars, la date n existe pas.
  const back = new Date(stamp);
  if (back.getUTCFullYear() !== civil.year) return null;
  if (back.getUTCMonth() !== civil.month - 1) return null;
  if (back.getUTCDate() !== civil.day) return null;
  return stamp;
}

/**
 * Renvoie la constatation, ou `null` quand rien n est perime.
 *
 * Une date de depart ABSENTE n est pas un brouillon perime : c est une date
 * « a choisir », et l ecran dit deja « a choisir ». Confondre les deux ferait
 * crier a l obsolete sur un brouillon neuf.
 *
 * Une date illisible ne leve pas non plus : elle vient du stockage, pas de
 * l utilisateur, et une alerte bricolee serait pire que pas d alerte.
 */
export function staleDraftNotice(
  draft: AdventurePrepDraft,
  todayIso: string,
): StaleDraftNotice | null {
  const start = draft.calendar.startDate;
  if (start === null) return null;

  const startDay = toUtcDay(start);
  const todayDay = toUtcDay(todayIso);
  if (startDay === null || todayDay === null) return null;

  const daysAgo = Math.round((todayDay - startDay) / MS_PER_DAY);
  if (daysAgo <= 0) return null;

  return Object.freeze({ startDate: start, daysAgo });
}
const ACC = String.fromCharCode(233); // e accentue, construit pour survive au transport

/**
 * La phrase dite a la personne, en français, avec la date et le retard reels.
 *
 * Aucun chiffre decoratif : le delai compte vient de la comparaison de dates,
 * la date affichee vient du brouillon. Si l un des deux manque, la phrase
 * disparait avec l avertissement — elle ne se remplit jamais de relleno.
 */
export function staleDraftMessage(notice: StaleDraftNotice): string {
  const date = formatCivilDate(notice.startDate, 'fr-FR', 'long');
  const delai = notice.daysAgo === 1 ? '1 jour' : `${notice.daysAgo} jours`;
  return (
    `Ce plan était prévu pour le ${date}, il y a ${delai}. ` +
    `Ses dates ne décrivent plus rien de vrai : la m${ACC}t${ACC}o, les ` +
    `étapes et le budget ne sont plus calculables.`
  );
}

/**
 * La date civile du jour, celle de la personne, lue dans son fuseau.
 *
 * `toISOString()` serait plus court et faux : a 00h30 en France, il renvoie
 * deja la veille. Une alerte de perimption declenchee sur la mauvaise journee
 * accuse un plan qui n est pas encore vecu. Les dates de voyage sont civiles
 * (D8) : le jour de la personne est donc la seule reference honnete.
 */
export function todayCivilIso(now: Date): string | null {
  if (Number.isNaN(now.getTime())) return null;
  const annee = now.getFullYear();
  const mois = String(now.getMonth() + 1).padStart(2, '0');
  const jour = String(now.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}