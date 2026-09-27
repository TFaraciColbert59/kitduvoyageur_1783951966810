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

function isoPlusDays(iso: string, days: number): string | null {
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
