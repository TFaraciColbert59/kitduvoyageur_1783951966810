import { activityById } from '../catalog';
import type { AdventurePrepDraft, CalendarBlock } from '../types';

/**
 * Duree proposee d'apres l'activite principale.
 *
 * Regle produit : la suggestion est une PROPOSITION, jamais une preference
 * connue. Elle remplit une duree absente, se recalcule quand seule une
 * proposition la portait, et ne touche jamais une duree saisie a la main
 * (`durationIsSuggested === false` avec une valeur presente = choix de la
 * personne). Sans elle, `isStepSatisfied` reste faux et l'ecran etape 1
 * affiche « Completer la destination » indefiniment.
 */

const MAX_DAYS = 60;

/** Nombre de jours pour une duree en heures. `null` si la duree est absente. */
export function daysFromSuggestedHours(hours: number | null | undefined): number | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return null;
  return Math.min(MAX_DAYS, Math.max(1, Math.ceil(hours / 24)));
}

/**
 * Decale une date ISO de N jours. Exportee parce que la duree proposee par
 * l IA (P0.18) doit recalculer la date de retour EXACTEMENT comme le fait la
 * duree proposee par l activite : deux regles, une seule fonction.
 */
export function isoPlusDays(iso: string, days: number): string | null {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Renvoie un NOUVEAU brouillon. La date de retour est recalculee quand elle
 * derivait de la duree, pour ne jamais laisser un retour incoherent.
 */
export function suggestDuration(draft: AdventurePrepDraft): AdventurePrepDraft {
  const { calendar } = draft;
  const alreadyChosen = calendar.durationDays !== null && !calendar.durationIsSuggested;
  if (alreadyChosen) return draft;

  const activity = activityById(draft.activities.primary);
  const days = daysFromSuggestedHours(activity?.suggestedDurationHours ?? null);
  if (days === null) return draft;

  const next: CalendarBlock = {
    ...calendar,
    durationDays: days,
    durationIsSuggested: true,
    returnDate:
      calendar.returnDate !== null && calendar.startDate !== null
        ? isoPlusDays(calendar.startDate, days - 1)
        : null,
  };

  return { ...draft, calendar: next };
}

/* ------------------------------------------------------------------ */
/* Date de depart proposee — P0.15                                     */
/* ------------------------------------------------------------------ */

/** Forme seule acceptee : quatre chiffres, tiret, deux chiffres, tiret, deux. */
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Le jour local courant au format `YYYY-MM-DD`.
 *
 * Exportee parce que le serveur en fait autorite sur une date de depart : le
 * prompt annonce CE jour au modele et le garde-fou refuse sur CE meme jour.
 * Deux horloges differentes produiraient une date que le modele proposerait
 * et que le garde-fou renverrait silencieusement en null.
 */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * La date que l'IA propose est-elle recevable ?
 *
 * Trois refus, et ils sont distincts pour qu'un test dise lequel a joue :
 * une forme qui n'est pas `YYYY-MM-DD`, une date qui n'existe pas dans le
 * calendrier (`2026-02-30`), et une date DEJA PASSEE. Le jour meme reste
 * recevable : partir aujourd'hui est un choix legitime.
 *
 * `today` est injectable pour que la regle se teste sans dependre de
 * l'horloge — et pour que le serveur puisse y passer SON jour, qui est le
 * seul qui fait autorite sur une date de depart.
 */
export function acceptedSuggestedStartDate(
  value: string | null | undefined,
  today: string = todayIso()
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!ISO_DATE_SHAPE.test(trimmed)) return null;

  // `new Date('2026-02-30')` ne renvoie pas `Invalid Date` : JavaScript
  // deborde sur le 2 mars. On compare donc la date reconstruite a la saisie,
  // sinon le 30 fevrier passerait pour une date reelle.
  const parsed = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== trimmed) return null;

  // Comparaison lexicographique : sur `YYYY-MM-DD` elle est l'ordre du
  // calendrier, sans fuseau ni conversion a l'interieur.
  return trimmed < today ? null : trimmed;
}

/**
 * Renvoie un NOUVEAU brouillon dont la date de depart est celle proposee.
 *
 * Meme regle que `suggestDuration` : une date saisie a la main est
 * intouchable (`startDateIsSuggested === false` avec une valeur presente), et
 * seule une ancienne proposition peut etre recalee. Une proposition refusee
 * ne touche a rien — le meme objet part, donc ni re-rendu ni autosave pour une
 * date qui n'a pas ete retenue.
 */
export function suggestStartDate(
  draft: AdventurePrepDraft,
  value: string | null | undefined,
  today: string = todayIso()
): AdventurePrepDraft {
  const { calendar } = draft;
  const alreadyChosen = calendar.startDate !== null && !calendar.startDateIsSuggested;
  if (alreadyChosen) return draft;

  const accepted = acceptedSuggestedStartDate(value, today);
  if (accepted === null) return draft;

  const next: CalendarBlock = {
    ...calendar,
    startDate: accepted,
    startDateIsSuggested: true,
    returnDate:
      calendar.durationDays !== null && calendar.durationDays > 0
        ? isoPlusDays(accepted, calendar.durationDays - 1)
        : calendar.returnDate,
  };

  return { ...draft, calendar: next };
}
