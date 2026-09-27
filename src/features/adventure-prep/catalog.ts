/**
 * Catalogue d'activites du preparateur.
 *
 * Donnees pures + recherche. Le catalogue reste extensible : ajouter une
 * entree ici suffit, aucune interface n'est fermee sur une liste figee.
 *
 * Regle produit : le bivouac peut etre une activite principale OU une nuit
 * ajoutee a une autre aventure ; une aventure combine plusieurs activites.
 */

import type {
  ActivityCategory,
  ActivityCategoryId,
  ActivityDef,
  ActivitySelection,
} from './types';

export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  { id: 'a_pied', label: 'À pied', icon: 'footprints' },
  { id: 'a_velo', label: 'À vélo', icon: 'bike' },
  { id: 'eau', label: 'Eau', icon: 'ship' },
  { id: 'neige_montagne', label: 'Neige et montagne', icon: 'mountain' },
  { id: 'voyage_sejour', label: 'Voyage et séjour', icon: 'globe' },
  { id: 'autres_sports', label: 'Autres sports', icon: 'flame' },
];

const DEFS: readonly ActivityDef[] = [
  /* ---------------- À pied ---------------- */
  {
    id: 'rando-journee',
    label: 'Randonnée à la journée',
    category: 'a_pied',
    icon: 'footprints',
    keywords: ['randonnée', 'jour', 'sortie', 'promenade', 'montagne'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 6,
  },
  {
    id: 'rando-refuge',
    label: 'Randonnée avec nuit de refuge',
    category: 'a_pied',
    icon: 'mountain',
    keywords: ['refuge', 'nuit', 'sommet', 'berger'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 24,
  },
  {
    id: 'trail',
    label: 'Trail',
    category: 'a_pied',
    icon: 'route',
    keywords: ['trail', 'course', 'chrono', 'technique'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 5,
  },
  {
    id: 'course',
    label: 'Course',
    category: 'a_pied',
    icon: 'heart',
    keywords: ['course', 'running', 'footing', 'boucle'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 2,
  },

  /* ---------------- À vélo ---------------- */
  {
    id: 'velo-route',
    label: 'Vélo route',
    category: 'a_velo',
    icon: 'bike',
    keywords: ['vélo', 'route', 'piste', 'cyclable'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 5,
  },
  {
    id: 'gravel',
    label: 'Gravel',
    category: 'a_velo',
    icon: 'route',
    keywords: ['gravel', 'piste', 'vtt', 'caillou'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 7,
  },
  {
    id: 'bikepacking',
    label: 'Bikepacking',
    category: 'a_velo',
    icon: 'backpack',
    keywords: ['bikepacking', 'velo', 'charge', 'itineraire'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 36,
  },

  /* ---------------- Eau ---------------- */
  {
    id: 'canoe-journee',
    label: 'Canoë à la journée',
    category: 'eau',
    icon: 'ship',
    keywords: ['canoë', 'kayak', 'paddle', 'rivière'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 6,
  },
  {
    id: 'regate',
    label: 'Régate en mer',
    category: 'eau',
    icon: 'wind',
    keywords: ['régate', 'mer', 'voile', 'navigation'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 8,
  },
  {
    id: 'plongee-autonome',
    label: 'Plongée autonome',
    category: 'eau',
    icon: 'droplets',
    keywords: ['plongée', 'autonome', 'eau', 'nautique'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 10,
  },

  /* ---------------- Neige et montagne ---------------- */
  {
    id: 'ski-randonnee',
    label: 'Ski de randonnée',
    category: 'neige_montagne',
    icon: 'mountain',
    keywords: ['ski', 'randonnée', 'neige', 'montagne'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 24,
  },
  {
    id: 'snowboard-sejour',
    label: 'Séjour snowboard',
    category: 'neige_montagne',
    icon: 'cloud-snow',
    keywords: ['snowboard', 'neige', 'séjour', 'station'],
    metrics: 'sejour',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 72,
  },
  {
    id: 'alpinisme',
    label: 'Alpinisme',
    category: 'neige_montagne',
    icon: 'cloud',
    keywords: ['alpinisme', 'sommet', 'mur', 'grimpe'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 30,
  },

  /* ---------------- Voyage et séjour ---------------- */
  {
    id: 'roadtrip',
    label: 'Road trip',
    category: 'voyage_sejour',
    icon: 'car',
    keywords: ['road trip', 'route', 'voyage', 'voiture'],
    metrics: 'voyage',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 96,
  },
  {
    id: 'city-break',
    label: 'Séjour en ville',
    category: 'voyage_sejour',
    icon: 'map',
    keywords: ['ville', 'séjour', 'week-end', 'visite'],
    metrics: 'sejour',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 48,
  },
  {
    id: 'avion-long',
    label: 'Voyage en avion',
    category: 'voyage_sejour',
    icon: 'plane',
    keywords: ['avion', 'vol', 'long', 'distance'],
    metrics: 'voyage',
    canBePrimary: true,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 120,
  },

  /* ---------------- Autres sports ---------------- */
  {
    id: 'escalade',
    label: 'Escalade',
    category: 'autres_sports',
    icon: 'flame',
    keywords: ['escalade', 'voie', 'bloc', 'grimpe'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 4,
  },
  {
    id: 'parapente',
    label: 'Parapente',
    category: 'autres_sports',
    icon: 'navigation',
    keywords: ['parapente', 'vol', 'air', 'décollage'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 5,
  },

  {
    id: 'ski-alpin',
    label: 'Ski en haute montagne',
    category: 'neige_montagne',
    icon: 'mountain',
    keywords: ['ski', 'randonnée', 'montagne', 'traversée', 'altitude'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 8,
  },
  {
    id: 'kayak',
    label: 'Kayak',
    category: 'eau',
    icon: 'droplets',
    keywords: ['kayak', 'paddle', 'rivière', 'lac', 'eau'],
    metrics: 'terrain',
    canBePrimary: true,
    canBeAddedNight: false,
    combinable: true,
    suggestedDurationHours: 5,
  },

  /* ---------------- Bivouac : une nuit ajoutee, jamais une activite seule --- */
  {
    id: 'bivouac',
    label: 'Nuit en bivouac',
    category: 'a_pied',
    icon: 'tent',
    keywords: ['bivouac', 'nuit', 'tente', 'camp', 'sac'],
    metrics: 'terrain',
    canBePrimary: false,
    canBeAddedNight: true,
    combinable: true,
    suggestedDurationHours: 14,
  },
];

export const ACTIVITIES: readonly ActivityDef[] = DEFS;

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function activityById(id: string | null): ActivityDef | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function activitiesByCategory(
  category: ActivityCategoryId,
): readonly ActivityDef[] {
  return ACTIVITIES.filter((a) => a.category === category);
}

/** Activites proposables comme activite principale. */
export function primaryCandidates(): readonly ActivityDef[] {
  return ACTIVITIES.filter((a) => a.canBePrimary);
}

/** Activites proposables comme nuit ajoutee. */
export function nightCandidates(): readonly ActivityDef[] {
  return ACTIVITIES.filter((a) => a.canBeAddedNight);
}

/**
 * Recherche insensible a la casse et aux accents sur le libelle et les
 * mots-cles. Une requete vide renvoie les activites de la categorie.
 */
export function searchActivities(
  query: string,
  category: ActivityCategoryId | 'all' = 'all',
): readonly ActivityDef[] {
  const pool =
    category === 'all' ? ACTIVITIES : activitiesByCategory(category);
  const needle = normalize(query);
  if (!needle) return pool;
  return pool.filter((activity) => {
    const haystack = [activity.label, activity.category, ...activity.keywords]
      .map(normalize)
      .join(' ');
    return haystack.includes(needle);
  });
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Contexte de metrique retenu quand plusieurs activites sont combinees. */
export function metricsContextFor(selection: ActivitySelection): 'terrain' | 'sejour' | 'voyage' {
  const ids = [selection.primary, ...selection.extra].filter((v): v is string => !!v);
  if (ids.length === 0) return 'terrain';
  const contexts = ids
    .map((id) => activityById(id)?.metrics)
    .filter((c): c is ActivityDef['metrics'] => !!c);
  // « voyage » est le plus englobant : il l'emporte sur un terrain Coastal.
  if (contexts.includes('voyage')) return 'voyage';
  if (contexts.includes('sejour')) return 'sejour';
  return 'terrain';
}

/** Toutes les activites retenues, principale puis complementaires puis nuits. */
export function selectedActivities(selection: ActivitySelection): readonly ActivityDef[] {
  const ids = [selection.primary, ...selection.extra, ...selection.nights].filter(
    (value): value is string => !!value,
  );
  return ids
    .filter((id, index) => ids.indexOf(id) === index)
    .map((id) => activityById(id))
    .filter((activity): activity is ActivityDef => !!activity);
}

