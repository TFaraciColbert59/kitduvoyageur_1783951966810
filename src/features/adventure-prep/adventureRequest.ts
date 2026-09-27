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
import type { AdventurePrepDraft, PlaceRef } from './types';

/** Corps accepte par POST /api/adventure/generate (cote serveur : zod). */
export interface AdventureGenerateRequest {
  text: string;
  coordinates?: { lat: number; lng: number } | Array<{ lat: number; lng: number }>;
  weatherDays?: number;
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

/** Nombre de jours a prevoir : borne a 7, la plage acceptee par la route. */
export function draftWeatherDays(draft: AdventurePrepDraft): number | undefined {
  const days = draft.calendar.durationDays;
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 1) return undefined;
  return Math.min(Math.round(days), 7);
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
  const weatherDays = draftWeatherDays(draft);
  if (weatherDays && weatherDays > 1) {
    parts.push(`sur ${weatherDays} jours`);
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

/** Charge utile complete, prete pour la route. */
export function buildAdventureGenerateRequest(
  draft: AdventurePrepDraft,
): AdventureGenerateRequest {
  const text = draftText(draft);
  const coordinates = draftCoordinates(draft);
  const weatherDays = draftWeatherDays(draft);
  return {
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