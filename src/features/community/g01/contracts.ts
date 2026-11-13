/**
 * G01 — contrats partagés « publication sportive et profils ».
 *
 * Ce module est volontairement pur : aucun React, aucun réseau, aucune
 * dépendance à Supabase. Les surfaces verrouillées par P01
 * (`useCommunityFeed`, fiche profil, `CommunityStoriesBar`, `ReportBlockModal`,
 * `reseau.ts`, `relationshipPolicy.ts`, `communityFeedMappers.ts`) ne sont pas
 * modifiées : G01 expose ses propres contrats sous `src/features/community/g01`.
 *
 * Trois schémas versionnés sont écrits dans des colonnes existantes :
 * - `community_posts.creation_meta` pour le partage d'une sortie (K5.20/S5.01) ;
 * - `user_profiles` (via l'adaptateur d'écriture futur) pour le profil sportif
 *   (S6.12) — le contrat refuse par défaut toute audience non reconnue ;
 * - `localStorage` pour les préférences de fil et de lecture vidéo (S6.28).
 *
 * Règle constante : une valeur absente, inconnue ou mal formée ne devient
 * jamais publique. Les fonctions `normalize*` renvoient une valeur sûre et les
 * politiques d'accès refusent (fail-closed) au moindre doute.
 */

export const G01_CONTRACT_VERSION = 1 as const;
export const G01_ACTIVITY_SHARE_SCHEMA = 'lkdv.activity.share.v1' as const;
export const G01_SPORT_PROFILE_SCHEMA = 'lkdv.sport-profile.v1' as const;
export const G01_FEED_PREFERENCES_SCHEMA = 'lkdv.feed.preferences.v1' as const;

export const SPORT_KEYS = ['rando', 'trail', 'ski', 'velo', 'escalade', 'autre'] as const;
export type SportKey = (typeof SPORT_KEYS)[number];

export type ShareAudience = 'public' | 'abonnies' | 'club';
export type ShareStatus = 'shared' | 'revoked';
export type ActivityVisibility = 'private' | 'followers' | 'shared' | 'public';

const SPORT_ALIASES: Record<string, SportKey> = {
  rando: 'rando',
  randonnee: 'rando',
  hiking: 'rando',
  hike: 'rando',
  marche: 'rando',
  walking: 'rando',
  trail: 'trail',
  running: 'trail',
  course: 'trail',
  'course-a-pied': 'trail',
  'trail-running': 'trail',
  ski: 'ski',
  'ski-rando': 'ski',
  skirando: 'ski',
  'ski-de-rando': 'ski',
  'ski-alpinisme': 'ski',
  snowboard: 'ski',
  velo: 'velo',
  bike: 'velo',
  cycling: 'velo',
  cyclisme: 'velo',
  vtt: 'velo',
  gravel: 'velo',
  bikepacking: 'velo',
  escalade: 'escalade',
  climbing: 'escalade',
  grimpe: 'escalade',
  alpinisme: 'escalade',
  mountaineering: 'escalade',
  autre: 'autre',
  other: 'autre',
  divers: 'autre',
};

const SPORT_LABELS: Record<SportKey, string> = {
  rando: 'Randonnée',
  trail: 'Trail',
  ski: 'Ski',
  velo: 'Vélo',
  escalade: 'Escalade',
  autre: 'Activité',
};

const AUDIENCE_LABELS: Record<ShareAudience, string> = {
  public: 'Public',
  abonnies: 'Abonnés',
  club: 'Club',
};

const VISIBILITY_LABELS: Record<ActivityVisibility, string> = {
  private: 'Privée',
  followers: 'Abonnés',
  shared: 'Partagée',
  public: 'Publique',
};

/** Minuscule sans accents, pour comparer des libellés libres. */
export function fold(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    : '';
}

export function normalizeSport(value: unknown): SportKey | null {
  const key = fold(value).replace(/\s+/g, '-');
  if (!key) return null;
  return SPORT_ALIASES[key] ?? null;
}

export function sportLabel(value: unknown): string {
  const sport = normalizeSport(value);
  return sport ? SPORT_LABELS[sport] : 'Activité';
}

export function normalizeShareAudience(value: unknown): ShareAudience | null {
  const key = fold(value);
  if (key === 'public') return 'public';
  if (key === 'abonnies' || key === 'abonnes' || key === 'followers' || key === 'friends') {
    return 'abonnies';
  }
  if (key === 'club') return 'club';
  return null;
}

export function audienceLabel(value: unknown): string {
  const audience = normalizeShareAudience(value);
  return audience ? AUDIENCE_LABELS[audience] : 'Visibilité inconnue';
}

export function isKnownActivityVisibility(value: unknown): boolean {
  const key = fold(value);
  return (
    key === 'private' ||
    key === 'prive' ||
    key === 'followers' ||
    key === 'abonnies' ||
    key === 'friends' ||
    key === 'collective_anonymized' ||
    key === 'shared' ||
    key === 'public'
  );
}

export function normalizeActivityVisibility(value: unknown): ActivityVisibility {
  const key = fold(value);
  if (key === 'public') return 'public';
  if (key === 'collective_anonymized' || key === 'shared') return 'shared';
  if (key === 'followers' || key === 'abonnies' || key === 'friends') return 'followers';
  return 'private';
}

export function visibilityLabel(value: unknown): string {
  return VISIBILITY_LABELS[normalizeActivityVisibility(value)];
}

export function normalizeShareStatus(value: unknown): ShareStatus | null {
  const key = fold(value);
  if (key === 'shared') return 'shared';
  if (key === 'revoked') return 'revoked';
  return null;
}

/**
 * Booléen strict : `"true"`, `1` ou `{}` ne valent pas `true`. Une préférence
 * absente ou mal typée garde donc son défaut sûr (souvent `false`).
 */
export function strictBoolean(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

/** Nombre fini, éventuellement encodé en chaîne par PostgREST (`numeric`). */
export function finiteNumber(
  value: unknown,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number | null {
  if (typeof value === 'boolean' || value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  if (options.integer && !Number.isInteger(parsed)) return null;
  return parsed;
}

export function positiveInteger(value: unknown): number | null {
  return finiteNumber(value, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Chaîne nettoyée, vide -> `null`. `max` tronque seulement un texte libre. */
export function nonEmptyString(value: unknown, max?: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean) return null;
  return typeof max === 'number' ? clean.slice(0, max) : clean;
}

export function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
}
