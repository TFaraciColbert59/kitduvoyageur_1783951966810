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
    reason: 'Tu as coché « Nature »\u00A0: un arrêt sur le trajet est proposé',
  },
  paysage: {
    kind: 'arret',
    title: 'Point de vue sur le parcours',
    reason: 'Tu as coché « Paysage »\u00A0: un point de vue est proposé sur le trajet',
  },
  patrimoine: {
    kind: 'arret',
    title: 'Visite du patrimoine',
    reason: 'Tu as coché « Patrimoine »\u00A0: une visite est proposée sur le trajet',
  },
  photographie: {
    kind: 'arret',
    title: 'Arrêt photo',
    reason: 'Tu as coché « Photographie »\u00A0: un arrêt est proposé sur le trajet',
  },
  eau: {
    kind: 'ravitaillement',
    title: 'Eau et ravitaillement',
    reason: 'Tu as coché « Eau »\u00A0: un point d\'eau est proposé sur le parcours',
  },
  gastronomie: {
    kind: 'ravitaillement',
    title: 'Repas au restaurant',
    reason: 'Tu as coché « Gastronomie »\u00A0: le repas est proposé au restaurant',
    mealSlot: 'dejeuner',
  },
};

const WATER: InterestStop = {
  kind: 'ravitaillement',
  title: 'Eau et ravitaillement',
  reason: 'Une réserve d\'eau est nécessaire sur le parcours — point à vérifier',
};

/**
 * Les libelles generiques des jours suivants.
 *
 * Le defaut etait un libelle UNIQUE reutilise tel quel tous les jours >= 2 :
 * « Ravitaillement et eau » revenait cinq fois sur six jours. Un reservoir
 * indexe par journee supprime la repetition ; quand il est epuise,
 * l'etape generique est SUPPRIMEE plutot que repetee (voir `variante`).
 *
 * Aucun point d'eau n'est promis : toutes les raisons restent « à vérifier ».
 */
const WATER_LATER: readonly InterestStop[] = [
  {
    kind: 'ravitaillement',
    title: 'Ravitaillement et eau',
    reason:
      'L\'eau accompagne le ravitaillement du jour au lieu d\'être une étape séparée\u00A0: le point reste à vérifier',
  },
  {
    kind: 'ravitaillement',
    title: 'Réserve d\'eau pour la étape du jour',
    reason:
      'Le ravitaillement du jour est complet\u00A0: le point d\'eau reste à vérifier sur le terrain',
  },
  {
    kind: 'ravitaillement',
    title: 'Remplir les gourdes avant la suite',
    reason:
      'Les gourdes se remplissent en chemin\u00A0: aucune source n\'est garantie avant la prochaine étape',
  },
  {
    kind: 'ravitaillement',
    title: 'Approvisionnement en eau du jour',
    reason:
      'De l\'eau est prévue pour la journée\u00A0: le point exact reste à vérifier',
  },
];

const VIEW: readonly InterestStop[] = [
  {
    kind: 'arret',
    title: "Point d'intérêt sur le parcours",
    reason: 'Un arrêt est proposé sur le trajet — le lieu sera confirmé sur la carte',
  },
  {
    kind: 'arret',
    title: 'Halte sur le parcours',
    reason: 'Une halte est proposée en chemin — le lieu sera confirmé sur la carte',
  },
  {
    kind: 'arret',
    title: 'Découverte sur la route',
    reason: 'L\'itinéraire prévoit une découverte en chemin\u00A0: le lieu sera confirmé sur la carte',
  },
];

/** Le groupe ou le corps imposent des pauses, jamais seulement le rythme. */
function restReason(draft: AdventurePrepDraft): string {
  const reasons: string[] = [];
  if (draft.preferences.accessibilityNeeds.length > 0) {
    reasons.push('un besoin d\'accessibilité est déclaré');
  }
  if (draft.group.children > 0) {
    reasons.push('des enfants participent');
  }
  if (reasons.length === 0) {
    return draft.preferences.pace === 'tranquille'
      ? 'Pause longue proposée pour garder un rythme tranquille'
      : 'Pause proposée pour garder un rythme tranquille';
  }
  return `Pause proposée car ${reasons.join(' et ')}`;
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
      reason: `Tu as ajouté « ${activity.label} »\u00A0: cette activité complète la journée`,
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

/**
 * La variante generique du jour, ou `null` quand le reservoir est epuise.
 *
 * `index` est EXPLICITE et ZERO-BASE : c’est a l’appelant de dire quel jour ouvre
 * le reservoir. Les deux appels ne demarrent pas au meme jour — `WATER_LATER` sert
 * les jours >= 2, `VIEW` sert des le jour 1 — et c’est precisement de cet
 * ecart que naissait le decalage : le jour 2 sautait la premiere variante
 * d’eau. Un `day - 1` cache dans la fonction aurait rendu le bug invisible.
 *
 * Supprimer vaut mieux que repeter — une ligne identique deux jours de suite
 * n’apporte rien et laisse croire a une etape dediee qui n’existe pas. Le repas,
 * lui, garantit toujours un ravitaillement (TY-08).
 */
function variante(reservoir: readonly InterestStop[], index: number): InterestStop | null {
  if (!Number.isInteger(index) || index < 0) return null;
  return reservoir[index] ?? null;
}


export function proposedStops(
  draft: AdventurePrepDraft,
  day: number,
  days: number,
): ProposedStop[] {
  const activity = activityById(draft.activities.primary ?? '');
  const interest = interestStop(draft);
  const stops: ProposedStop[] = [];

  // 1. L'eau, avant l'effort, et une seule fois. L'interet « Eau » reprend la
  //    main sur le libelle du premier jour. Les jours suivants ne remettent
  //    JAMAIS la meme ligne : chaque journee tire son libelle dans le reservoir.
  if (day === 1) {
    stops.push(
      interest && interest.kind === 'ravitaillement' && interest.title === WATER.title
        ? { kind: interest.kind, title: interest.title, reason: interest.reason }
        : { kind: WATER.kind, title: WATER.title, reason: WATER.reason },
    );
  } else {
    // Le jour 2 OUVRE le reservoir : c’est le premier element, pas le
    // deuxieme. Le decalage se paie en libelles manques, pas en plantages.
    const eau = variante(WATER_LATER, day - 2);
    if (eau) stops.push({ kind: eau.kind, title: eau.title, reason: eau.reason });
  }

  // 2. L'arret porte l'interet declare, sinon une halte generique.
  if (interest && interest.kind === 'arret') {
    stops.push({ kind: interest.kind, title: interest.title, reason: interest.reason });
  } else if (!interest) {
    // Le jour 1 ouvre le reservoir : `VIEW` sert des le premier jour.
    const vue = variante(VIEW, day - 1);
    if (vue) stops.push({ kind: vue.kind, title: vue.title, reason: vue.reason });
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
          reason: 'Repas à prévoir sur le parcours — lieu et prix à vérifier',
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
      title: 'Dîner',
      reason: 'Dîner à prévoir le dernier soir — lieu et prix à vérifier',
      mealSlot: 'diner',
    });
  }

  // Une activité de nuit rend le bivouac pertinent, sans jamais inventer le spot.
  if (day < days && draft.activities.nights.includes('bivouac') && activity) {
    stops.push({
      kind: 'arret',
      title: 'Repérage du spot de bivouac',
      reason: 'Tu as choisi le bivouac\u00A0: l\'emplacement reste à trouver sur le terrain',
    });
  }

  return stops;
}
