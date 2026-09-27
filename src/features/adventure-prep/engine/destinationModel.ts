/**
 * Etape 1 — modele pur.
 *
 * Toute la mise en forme de l'ecran « On part ou ? » vit ici : le composant
 * ne fait que le rendu. Ce module ne depend d'aucun store, d'aucun composant
 * React et d'aucune requete reseau — il est donc testable seul.
 *
 * Regle de confiance : aucune valeur n'est deduite. Un champ non renseigne
 * s'affiche « a verifier » et apparait dans `missingFields`, il n'est jamais
 * remplace par une valeur plausible.
 */

import { A_VERIFIER } from './trust';
import { daysLabel } from './labels';
import type {
  AdventurePrepDraft,
  GroupBlock,
  PlaceRef,
  RouteShape,
} from '../types';

/* ------------------------------------------------------------------ */
/* Champs manquants                                                    */
/* ------------------------------------------------------------------ */

/**
 * Champs necessaires pour lancer la generation, dans l'ordre ou l'utilisateur
 * les rencontre. `startDate` n'est PAS bloquant : une aventure sans date reste
 * realisable, la date se confirme plus tard dans le calendrier.
 */
export type MissingFieldKey =
  | 'activity'
  | 'origin'
  | 'destination'
  | 'startDate'
  | 'duration';

export interface MissingField {
  key: MissingFieldKey;
  /** Libelle affiche dans la ligne « Il manque : … ». */
  label: string;
}

const MISSING_LABELS: Readonly<Record<MissingFieldKey, string>> = {
  activity: 'activité',
  origin: 'lieu de départ',
  destination: 'lieu d’arrivée',
  startDate: 'date',
  duration: 'temps disponible',
};

/** Champs sans lesquels aucune generation n'a de sens. */
const BLOCKING_KEYS: ReadonlySet<MissingFieldKey> = new Set<MissingFieldKey>([
  'activity',
  'origin',
  'destination',
  'duration',
]);

/**
 * Champs manquants, dans l'ordre de l'ecran. Une boucle n'a pas besoin d'une
 * arrivee distincte : le retour se derive du depart, jamais d'un lieu invente.
 */
export function missingFields(draft: AdventurePrepDraft): readonly MissingField[] {
  const found: MissingFieldKey[] = [];

  if (!draft.activities.primary) found.push('activity');
  if (!draft.route.origin) found.push('origin');
  if (draft.route.shape === 'aller_simple' && !draft.route.destination) found.push('destination');
  if (draft.calendar.startDate === null) found.push('startDate');
  if (!draft.calendar.durationDays || draft.calendar.durationDays <= 0) found.push('duration');

  return found.map((key) => ({ key, label: MISSING_LABELS[key] }));
}

/** Vrai quand plus aucun champ bloquant n'est manquant. */
export function canCreateItinerary(draft: AdventurePrepDraft): boolean {
  return missingFields(draft).every((field) => !BLOCKING_KEYS.has(field.key));
}

/**
 * Phrase unique « Il manque : date, temps disponible », ou `null` quand tout est
 * saisi. Les valeurs sont listees dans l'ordre de l'ecran, jamais un compte
 * global — l'utilisateur veut savoir QUE corriger, pas combien.
 */
export function missingSummary(draft: AdventurePrepDraft): string | null {
  const labels = missingFields(draft).map((field) => field.label);
  if (labels.length === 0) return null;
  return `Il manque : ${labels.join(', ')}`;
}

/* ------------------------------------------------------------------ */
/* Forme du parcours                                                   */
/* ------------------------------------------------------------------ */

export interface RouteShapeOption {
  shape: RouteShape;
  label: string;
  icon: string;
}

export const ROUTE_SHAPE_OPTIONS: readonly RouteShapeOption[] = [
  { shape: 'boucle', label: 'Boucle', icon: 'refresh-cw' },
  { shape: 'aller_simple', label: 'Aller simple', icon: 'arrow-right' },
];

/** Aiguillage de forme : un aller simple a un sens, une boucle non. */
export function canSwapEnds(draft: AdventurePrepDraft): boolean {
  return draft.route.shape === 'aller_simple' && draft.route.origin !== null && draft.route.destination !== null;
}

/* ------------------------------------------------------------------ */
/* Lieu                                                                */
/* ------------------------------------------------------------------ */

export interface PlaceParts {
  /** Nom court, mis en avant. */
  primary: string;
  /** Precision geographique, en retrait. `null` quand on n'a rien de plus. */
  secondary: string | null;
}

/**
 * « Trélon · Place Jean Jaurès » : la premiere virgule du libelle geocode
 * donne la commune, le reste donne le detail. Rien n'estcomplete quand le
 * geocodeur n'a rien fourni de plus.
 */
export function placeParts(place: PlaceRef | null): PlaceParts | null {
  if (!place) return null;
  const name = place.name.trim();
  if (name === '') return { primary: A_VERIFIER, secondary: null };

  const comma = name.indexOf(',');
  if (comma > 0 && comma < name.length - 1) {
    return {
      primary: name.slice(0, comma).trim(),
      secondary: name.slice(comma + 1).trim() || null,
    };
  }
  if (place.country && place.country !== name) {
    return { primary: name, secondary: place.country };
  }
  return { primary: name, secondary: null };
}

/* ------------------------------------------------------------------ */
/* Date et duree                                                       */
/* ------------------------------------------------------------------ */

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * « Sam. 17 oct. ». `T12:00:00` ancre le jour calendaire : le format ne peut
 * pas basculer d'un jour selon le fuseau de la machine.
 */
export function shortDateLabel(iso: string | null): string {
  if (!iso) return A_VERIFIER;
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return A_VERIFIER;
  const label = SHORT_DATE_FORMAT.format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ------------------------------------------------------------------ */
/* Participants                                                        */
/* ------------------------------------------------------------------ */

/**
 * « 4 adultes », « 2 personnes · 1 enfant », « Seul·e ». L'effectif total
 * reste derivé des deux compteurs — jamais stocke separement, donc jamais
 * incoherent avec eux.
 */
export function groupValueLabel(group: GroupBlock): string {
  if (group.mode === 'solo') return 'Seul·e';
  const total = group.adults + group.children;
  const adults = `${group.adults} ${group.adults > 1 ? 'adultes' : 'adulte'}`;
  if (group.children === 0) return adults;
  const children = `${group.children} ${group.children > 1 ? 'enfants' : 'enfant'}`;
  return `${total} ${total > 1 ? 'personnes' : 'personne'} · ${adults} · ${children}`;
}

export interface ParticipantAvatar {
  key: string;
  initials: string;
  /** Index de teinte stable, derive du prenom : meme personne, meme couleur. */
  tone: number;
}

/** Nombre maximal d'initiales affichees avant le badge « +N ». */
export const MAX_AVATARS = 4;

const AVATAR_TONES = 6;

/**
 * Initiales des participants CONNUS uniquement, puis un badge « +N » pour
 * ceux dont on ignore encore le nom. On n'invente jamais un prenom pour
 * completer la rangee.
 */
export function participantAvatars(group: GroupBlock): readonly ParticipantAvatar[] {
  const total = group.mode === 'solo' ? 1 : group.adults + group.children;
  const known = group.knownMembers
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, MAX_AVATARS);

  const avatars: ParticipantAvatar[] = known.map((name, index) => ({
    key: `known-${index}-${name}`,
    initials: initialsOf(name),
    tone: toneOf(name),
  }));

  const missing = total - known.length;
  if (missing > 0) {
    avatars.push({ key: 'more', initials: `+${missing}`, tone: AVATAR_TONES });
  }
  return avatars;
}

/** Premiere lettre de chaque mot, accent comprise : « Marie Claire » -> MC. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s-]+/).filter((word) => word.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const word = words[0];
    return word.slice(0, 1).toLocaleUpperCase('fr-FR');
  }
  return (words[0].slice(0, 1) + words[words.length - 1].slice(0, 1)).toLocaleUpperCase('fr-FR');
}

/** Teinte stable : meme prenom, meme couleur d'un ecran a l'autre. */
function toneOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 100000;
  }
  return hash % AVATAR_TONES;
}

export { daysLabel };