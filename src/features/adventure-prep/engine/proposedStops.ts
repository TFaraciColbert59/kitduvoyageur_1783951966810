/**
 * Arrets proposes pour une journee de parcours.
 *
 * Regle unique : ce module propose une STRUCTURE, jamais une donnee. Aucun
 * nom de lieu trouve, aucune distance, aucune duree, aucun prix, aucune heure
 * ne sortent d'ici. Ce qui n'est pas verifiable reste `null` et l'ecran
 * affiche « a verifier ».
 *
 * Ce qui est propose l'est a partir de ce que la personne a reellement saisi :
 * son activite, son rythme, son groupe, ses interets, ses contraintes. Une
 * sortie a la journee ne peut donc pas se resumer a son point de depart.
 */

import { activityById } from '../catalog';
import type { AdventurePrepDraft, ItineraryStepKind, MealSlot } from '../types';
import type { StepDraft } from './itinerary';

export interface ProposedStop extends StepDraft {
  readonly kind: ItineraryStepKind;
}

interface InterestStop {
  readonly kind: ItineraryStepKind;
  readonly title: string;
  readonly reason: string;
  readonly mealSlot?: MealSlot;
}

/** Minuscules sans accent : « Nature » et « nature » designent la meme envie. */
function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Un interet declare devient une etape proposee. La gastronomie ne cree pas une
 * deuxieme pause repas : elle-change le titre du repas deja propose, pour qu'une
 * meme envie ne soit jamais comptee deux fois.
 */
const INTEREST_STOPS: Readonly<Record<string, InterestStop>> = {
  nature: {
    kind: 'arret',
    title: 'Pause nature',
    reason: 'Tu as coche « Nature » : un arret sur le trajet est propose',
  },
  paysage: {
    kind: 'arret',
    title: 'Point de vue sur le parcours',
    reason: 'Tu as coche « Paysage » : un point de vue est propose sur le trajet',
  },
  patrimoine: {
    kind: 'arret',
    title: 'Visite du patrimoine',
    reason: 'Tu as coche « Patrimoine » : une visite est proposee sur le trajet',
  },
  photographie: {
    kind: 'arret',
    title: 'Arret photo',
    reason: 'Tu as coche « Photographie » : un arret est propose sur le trajet',
  },
  eau: {
    kind: 'ravitaillement',
    title: 'Eau et ravitaillement',
    reason: 'Tu as coche « Eau » : un point d eau est propose sur le parcours',
  },
  gastronomie: {
    kind: 'ravitaillement',
    title: 'Repas au restaurant',
    reason: 'Tu as coche « Gastronomie » : le repas est propose au restaurant',
    mealSlot: 'dejeuner',
  },
};

const WATER: InterestStop = {
  kind: 'ravitaillement',
  title: 'Eau et ravitaillement',
  reason: 'Une reserve d eau est necessaire sur le parcours — point a verifier',
};

const VIEW: InterestStop = {
  kind: 'arret',
  title: 'Point d interet sur le parcours',
  reason: 'Un arret est propose sur le trajet — le lieu sera confirme sur la carte',
};

/** Le groupe ou le corps imposent des pauses, jamais seulement le rythme. */
function restReason(draft: AdventurePrepDraft): string {
  const reasons: string[] = [];
  if (draft.preferences.accessibilityNeeds.length > 0) {
    reasons.push('un besoin d accessibilite est declare');
  }
  if (draft.group.children > 0) {
    reasons.push('des enfants participent');
  }
  if (reasons.length === 0) {
    return draft.preferences.pace === 'tranquille'
      ? 'Pause longue proposee pour garder un rythme tranquille'
      : 'Pause proposee pour garder un rythme tranquille';
  }
  return `Pause proposee car ${reasons.join(' et ')}`;
}

function wantsRest(draft: AdventurePrepDraft): boolean {
  return (
    draft.preferences.pace !== 'rapide' ||
    draft.group.children > 0 ||
    draft.preferences.accessibilityNeeds.length > 0
  );
}

/**
 * Activites complementaires, reparties une par journee a partir du premier
 * jour. Les nuits ajoutees ont deja leur propre bloc ; une activite inconnue
 * ou repetee est ignoree plutot que d'etre affichee.
 *
 * On ne propose qu'une STRUCTURE : le titre est le libelle du catalogue, donc
 * un choix que la personne a elle-meme fait. Aucun lieu, aucune heure, aucune
 * duree ne sont inventes.
 */
function complementaryStops(draft: AdventurePrepDraft, day: number): ProposedStop[] {
  const nights = new Set(draft.activities.nights);
  const ids = draft.activities.extra.filter(
    (id) => id !== draft.activities.primary && !nights.has(id),
  );
  const unique = ids.filter((id, index) => ids.indexOf(id) === index);
  const index = day - 1;
  if (index < 0 || index >= unique.length) return [];
  const activity = activityById(unique[index]);
  if (!activity) return [];
  return [
    {
      kind: 'arret',
      title: activity.label,
      reason: `Tu as ajoute « ${activity.label} » : cette activite complete la journee`,
    },
  ];
}

/** Premier interet reconnu, une seule fois : les doublons ne creent pas deux etapes. */
function interestStop(draft: AdventurePrepDraft): InterestStop | null {
  for (const interest of draft.preferences.interests) {
    const stop = INTEREST_STOPS[norm(interest)];
    if (stop) return stop;
  }
  return null;
}

export function proposedStops(
  draft: AdventurePrepDraft,
  day: number,
  days: number,
): ProposedStop[] {
  const activity = activityById(draft.activities.primary ?? '');
  const interest = interestStop(draft);
  const stops: ProposedStop[] = [];

  // 1. L'eau, avant l'effort. L'interet « Eau » reprend la main sur le libelle.
  stops.push(
    interest && interest.kind === 'ravitaillement' && interest.title === WATER.title
      ? { kind: interest.kind, title: interest.title, reason: interest.reason }
      : { kind: WATER.kind, title: WATER.title, reason: WATER.reason },
  );

  // 2. L'arret porte l'interet declare, sinon une halte generique.
  if (interest && interest.kind === 'arret') {
    stops.push({ kind: interest.kind, title: interest.title, reason: interest.reason });
  } else if (!interest) {
    stops.push({ kind: VIEW.kind, title: VIEW.title, reason: VIEW.reason });
  }

  // 3. La pause suit le groupe et le corps, pas seulement le rythme choisi.
  if (wantsRest(draft)) {
    stops.push({
      kind: 'repos',
      title: draft.group.children > 0 ? 'Pause pour le groupe' : 'Pause',
      reason: restReason(draft),
    });
  }

  // 4. L'activite complementaire choisie, apres la pause, avant le repas :
  // une aventure peut en contenir plusieurs, une par journee.
  stops.push(...complementaryStops(draft, day));

  // 5. Le repas de midi existe chaque jour, et l'interet gastronomie le titre.
  const meal: InterestStop =
    interest && interest.mealSlot
      ? interest
      : {
          kind: 'ravitaillement',
          title: 'Repas de midi',
          reason: 'Repas a prevoir sur le parcours — lieu et prix a verifier',
        };
  stops.push({
    kind: meal.kind,
    title: meal.title,
    reason: meal.reason,
    mealSlot: meal.mealSlot ?? 'dejeuner',
  });

  // 6. Le soir ne se propose que si l'aventure se termine ici.
  if (day === days && days > 1) {
    stops.push({
      kind: 'ravitaillement',
      title: 'Diner',
      reason: 'Diner a prevoir le dernier soir — lieu et prix a verifier',
      mealSlot: 'diner',
    });
  }

  // Une activité de nuit rend le bivouac pertinent, sans jamais inventer le spot.
  if (day < days && draft.activities.nights.includes('bivouac') && activity) {
    stops.push({
      kind: 'arret',
      title: 'Reperage du spot de bivouac',
      reason: 'Tu as choisi le bivouac : l emplacement reste a trouver sur le terrain',
    });
  }

  return stops;
}