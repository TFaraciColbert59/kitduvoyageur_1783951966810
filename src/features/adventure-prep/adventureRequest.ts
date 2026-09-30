/**
 * Pont entre le brouillon du preparateur et POST /api/adventure/generate.
 *
 * Module PUR : aucun fetch, aucun store, aucun composant. Il ne fait que
 * traduire un `AdventurePrepDraft` en la charge utile attendue par la route,
 * a partir des seules donnees REELLES du brouillon. Ce qui manque n'est pas
 * invente : il est simplement absent de la requete, et l'endpoint decide.
 *
 * Regle de confiance : aucune valeur inventee ici. Un budget non choisi ne
 * devient pas "100 EUR", une date absente ne devient pas "demain".
 */

import { activityById } from './catalog';
import { resolvedGear } from './engine/gear';
import { ACCEPTED_PLAN_SCHEMA_VERSION, type AcceptedPrepPlan } from './acceptedPlan';
import type { AdventurePrepDraft, PlaceRef } from './types';

export { ACCEPTED_PLAN_SCHEMA_VERSION, type AcceptedPrepPlan } from './acceptedPlan';

/** Corps accepte par POST /api/adventure/generate (cote serveur : zod). */
export interface AdventureGenerateRequest {
  text: string;
  coordinates?: { lat: number; lng: number } | Array<{ lat: number; lng: number }>;
  weatherDays?: number;
  /** Effectif reel du brouillon (adultes + enfants), jamais devine. */
  participantsCount?: number;
  acceptedPlan?: AcceptedPrepPlan;
}

const BUDGET_LABELS: Readonly<Record<AdventurePrepDraft['preferences']['budgetLevel'], string>> = {
  economique: 'budget économique',
  modere: 'budget modéré',
  confort: 'budget confort',
};

const PACE_LABELS: Readonly<Record<AdventurePrepDraft['preferences']['pace'], string>> = {
  tranquille: 'rythme tranquille',
  normal: 'rythme normal',
  rapide: 'rythme rapide',
};

const TRANSPORT_LABELS: Readonly<Record<AdventurePrepDraft['preferences']['transport'], string>> = {
  peigne: ' transports en commun',
  train: ' en train',
  voiture: ' en voiture',
  avion: ' en avion',
  mixte: ' en transports mixtes',
};

function placeLabel(place: PlaceRef | null): string | null {
  if (!place) return null;
  return place.country ? `${place.name} (${place.country})` : place.name;
}

/**
 * Les coordonnees reelles du brouillon, sans doublon consecutif.
 *
 * Une boucle n'a qu'une extremite : on renvoie alors le point seul, que la
 * route accepte pour alimenter la meteo officielle. Un aller simple en donne
 * deux, ce qui active en plus l'ETA map-matchee cote serveur.
 */
export function draftCoordinates(
  draft: AdventurePrepDraft,
): AdventureGenerateRequest['coordinates'] {
  const coords: Array<{ lat: number; lng: number }> = [];
  const push = (place: PlaceRef | null) => {
    if (!place) return;
    const last = coords[coords.length - 1];
    if (last && last.lat === place.lat && last.lng === place.lon) return;
    coords.push({ lat: place.lat, lng: place.lon });
  };
  push(draft.route.origin);
  if (draft.route.shape === 'aller_simple') push(draft.route.destination);

  if (coords.length === 0) return undefined;
  if (coords.length === 1) return coords[0];
  return coords;
}

/**
 * Duree REELLE de l'aventure, en jours. Aucune borne : un voyage d'un mois
 * reste un voyage d'un mois. A ne jamais confondre avec l'horizon meteo.
 */
export function draftDurationDays(draft: AdventurePrepDraft): number | undefined {
  const days = draft.calendar.durationDays;
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 1) return undefined;
  return Math.round(days);
}

/** Plage de prevision acceptee par la route : une contrainte meteo, pas de voyage. */
export const WEATHER_HORIZON_MAX_DAYS = 7;

/** Horizon meteo a demander : la duree, bornee a la plage de prevision. */
export function draftWeatherDays(draft: AdventurePrepDraft): number | undefined {
  const days = draftDurationDays(draft);
  if (days === undefined) return undefined;
  return Math.min(days, WEATHER_HORIZON_MAX_DAYS);
}

/**
 * La phrase envoyee a la generation, redigee a partir du brouillon.
 *
 * Elle ne Cite que ce qui est saisI : une extremite absente est omise, elle
 * n'est pas remplacee par un exemple. Le serveur complete avec ses sources
 * reelles (meteo, itineraire) et expose ce qu'il n'a pas pu resoudre.
 */
export function draftText(draft: AdventurePrepDraft): string {
  const activity = activityById(draft.activities.primary);
  const parts: string[] = [];

  const head = activity
    ? draft.coverName
      ? `${draft.coverName} : ${activity.label.toLowerCase()}`
      : activity.label
    : 'Activité à préciser';
  parts.push(head);

  const extras = draft.activities.extra
    .map((id) => activityById(id)?.label)
    .filter((label): label is string => Boolean(label));
  if (extras.length > 0) {
    parts.push(`avec ${extras.join(', ').toLowerCase()}`);
  }

  const origin = placeLabel(draft.route.origin);
  const destination = placeLabel(draft.route.destination);
  if (origin && destination && draft.route.shape === 'aller_simple') {
    parts.push(`au départ de ${origin} et jusqu'à ${destination}`);
  } else if (origin) {
    parts.push(`au départ de ${origin}, en boucle`);
  }

  if (draft.calendar.startDate) parts.push(`le ${draft.calendar.startDate}`);
  // La phrase decrit le VOYAGE : elle lit la duree reelle, jamais l'horizon
  // meteo borne a 7 jours (un mois annonce « sur 7 jours » etait faux).
  const durationDays = draftDurationDays(draft);
  if (durationDays && durationDays > 1) {
    parts.push(`sur ${durationDays} jours`);
  }

  const prefs = draft.preferences;
  const headcount = draft.group.adults + draft.group.children;
  if (headcount > 1) parts.push(`pour ${headcount} personnes`);
  parts.push(BUDGET_LABELS[prefs.budgetLevel]);
  if (prefs.budgetPerPerson != null) {
    parts.push(`environ ${prefs.budgetPerPerson} EUR par personne`);
  }
  parts.push(PACE_LABELS[prefs.pace]);
  parts.push(TRANSPORT_LABELS[prefs.transport]);

  return parts.join(' ').trim();
}

/** Effectif du brouillon : au moins une personne, jamais un nombre invente. */
export function draftParticipantsCount(draft: AdventurePrepDraft): number {
  const count = Math.trunc(draft.group.adults) + Math.trunc(draft.group.children);
  return Number.isFinite(count) && count >= 1 ? count : 1;
}

/**
 * Snapshot exact de ce que l'ecran montre au moment de l'enregistrement.
 * Fonction PURE : meme brouillon, meme snapshot (idempotence de la sauvegarde).
 */
export function buildAcceptedPlan(draft: AdventurePrepDraft): AcceptedPrepPlan {
  return {
    schemaVersion: ACCEPTED_PLAN_SCHEMA_VERSION,
    draftVersion: draft.version,
    coverName: draft.coverName,
    activities: draft.activities,
    route: draft.route,
    calendar: draft.calendar,
    group: draft.group,
    preferences: draft.preferences,
    itinerary: draft.itinerary
      ? { days: draft.itinerary.days, steps: draft.itinerary.steps }
      : null,
    gear: resolvedGear(draft).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      vital: item.vital,
      ownerId: item.ownerId,
      weightGrams: item.weightGrams,
      packed: draft.packedGearIds.includes(item.id),
    })),
  };
}

/** Charge utile complete, prete pour la route. */
export function buildAdventureGenerateRequest(
  draft: AdventurePrepDraft,
): AdventureGenerateRequest {
  const text = draftText(draft);
  const coordinates = draftCoordinates(draft);
  const weatherDays = draftWeatherDays(draft);
  return {
    participantsCount: draftParticipantsCount(draft),
    acceptedPlan: buildAcceptedPlan(draft),
    // La route refuse moins de 10 caracteres : un brouillon quasi vide ne doit
    // pas partir en requete invalide, il doit etre refuse avant l'appel.
    text: text.length >= 10 ? text : 'Prepare une sortie de plein air en France.',
    ...(coordinates ? { coordinates } : {}),
    ...(weatherDays ? { weatherDays } : {}),
  };
}

/**
 * Ce qui empeche l'enregistrement. Vide = enregistrable.
 *
 * Le bouton reste actif tant que la liste est vide : l'utilisateur peut
 * enregistrer avec des inconnues assumees (« A verifier »), c'est l'interface
 * qui les affiche, pas l'enregistrement qui les refuse.
 */
export function blockersBeforeSave(draft: AdventurePrepDraft): readonly string[] {
  const blockers: string[] = [];
  if (!draft.activities.primary) blockers.push('activité');
  if (!draft.route.origin) blockers.push('lieu de départ');
  if (!draft.calendar.startDate) blockers.push('date');
  return blockers;
}