/**
 * Catalogue d'activites du preparateur.
 *
 * Donnees pures + recherche. Le catalogue reste extensible : ajouter une
 * entree ici suffit, aucune interface n'est fermee sur une liste figee.
 *
 * Regle produit : le bivouac peut etre une activite principale OU une nuit
 * ajoutee a une autre aventure ; une aventure combine plusieurs activites.
 *
 * Regle de donnees : `suggestedDurationHours` est une valeur de TRAVAIL —
 * elle donne un point de depart a la generation et separe l etape de
 * generation, ou l utilisateur confirme ou corrige. Elle n est jamais publiee
 * a l ecran. Ce que l ecran montre vient de `activityTemplateLabel()`, qui ne
 * contient aucun nombre.
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

/** Mots outils de la phrase : ils ne distinguent aucune activite d une autre. */
const STOP_WORDS = new Set([
  'a', 'ai', 'aime', 'avec', 'au', 'aux', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle',
  'en', 'et', 'il', 'ils', 'je', 'la', 'le', 'les', 'leur', 'leurs', 'lui', 'ma', 'mais',
  'me', 'mes', 'moi', 'mon', 'ne', 'nos', 'notre', 'nous', 'on', 'ou', 'par', 'pas', 'pour',
  'quand', 'que', 'qui', 'sa', 'ses', 'sur', 'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un',
  'une', 'vos', 'votre', 'vous', 'y',
]);

function briefTokens(brief: string): readonly string[] {
  return normalize(brief)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Classe le catalogue reel selon la pertinence d'un brief libre.
 *
 * Le mot entier ne suffit pas : une phrase ne contient jamais le libelle d'une
 * activite. On note donc chaque activite au nombre de mots du brief qu'elle
 * porte reellement, et on ne garde que celles qui en portent au moins un.
 *
 * C'est une recherche, pas une proposition : rien n'est invente ici. Un brief
 * qui ne parle d'aucune activite connue ne rend QUE cet echec — la liste
 * reste vide plutot que de retomber sur un choix par defaut presente comme
 * une correspondance. Le cas « pas de brief » rend tout le catalogue, qui est
 * l'absence de tri, pas un resultat.
 */
export function rankActivitiesByBrief(brief: string): readonly ActivityDef[] {
  const tokens = briefTokens(brief);
  if (tokens.length === 0) return ACTIVITIES;
  const scored = ACTIVITIES.map((activity) => {
    const label = normalize(activity.label);
    const rest = normalize([activity.category, ...activity.keywords].join(' '));
    // Le libelle est le NOM de l activite : il prime sur la famille et les
    // mots-cles. Dire « velo » doit donc placer le velo devant une randonnee
    // qui partage seulement le mot « montagne ».
    const score = tokens.reduce((total, word) => {
      if (label.includes(word)) return total + 3;
      if (rest.includes(word)) return total + 1;
      return total;
    }, 0);
    return { activity, score };
  }).filter((entry) => entry.score > 0);
  return scored
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.activity);
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


/* ------------------------------------------------------------------ */
/* Gabarit de depart — la forme du sejour, jamais sa mesure            */
/* ------------------------------------------------------------------ */

/**
 * Choisir un TYPE d aventure est legitime : l utilisateur dit ce qu il veut
 * faire. Publier une DUREE ne l est pas. « 6 h environ » n a ete mesure par
 * personne, sur aucune sortie : c est une invention presentee comme une
 * information, et le mot « environ » ne la rendait pas plus vraie, seulement
 * plus ronde.
 *
 * Le catalogue ne propose donc plus qu une FORME de sejour. Elle est deduite
 * du type d aventure — une nuit de refuge implique une nuit, pas 24 h — et
 * s affiche sans aucun chiffre, comme un point de depart a preciser.
 */
export type ActivityTemplate = 'journee' | 'nuit' | 'sejour' | 'trajet' | 'libre';

const TEMPLATE_LABELS: Readonly<Record<ActivityTemplate, string>> = {
  journee: 'Gabarit : journée',
  nuit: 'Gabarit : avec une nuit',
  sejour: 'Gabarit : séjour',
  trajet: 'Gabarit : long trajet',
  libre: 'Gabarit : à préciser',
};

/**
 * Une entree par identifiant, pas un champ dans `ActivityDef` : `types.ts`
 * appartient a un autre agent, et surtout le gabarit est une consequence du
 * type — le meme module doit rester lisible d'un coup d'oeil.
 */
const TEMPLATE_BY_ID: Readonly<Record<string, ActivityTemplate>> = {
  'rando-journee': 'journee',
  'rando-refuge': 'nuit',
  trail: 'journee',
  course: 'journee',
  'velo-route': 'journee',
  gravel: 'journee',
  bikepacking: 'sejour',
  'canoe-journee': 'journee',
  regate: 'journee',
  'plongee-autonome': 'journee',
  'ski-randonnee': 'nuit',
  'snowboard-sejour': 'sejour',
  alpinisme: 'sejour',
  roadtrip: 'trajet',
  'city-break': 'sejour',
  'avion-long': 'trajet',
  escalade: 'journee',
  parapente: 'journee',
  'ski-alpin': 'journee',
  kayak: 'journee',
  bivouac: 'nuit',
};

/** Gabarit d une aventure, ou `libre` quand on ne sait pas encore. */
export function activityTemplate(id: string | null): ActivityTemplate {
  if (!id) return 'libre';
  return TEMPLATE_BY_ID[id] ?? 'libre';
}

/** Libelle affichable du gabarit. Jamais de chiffre, jamais de duree. */
export function activityTemplateLabel(id: string | null): string {
  return TEMPLATE_LABELS[activityTemplate(id)];
}
