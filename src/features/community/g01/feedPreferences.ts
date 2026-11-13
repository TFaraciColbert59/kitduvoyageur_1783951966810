/**
 * G01 — préférences de contenu du fil (S6.28).
 *
 * Ces préférences sont locales à l'appareil : elles ne changent jamais la
 * visibilité serveur et ne permettent pas de contourner la RLS. Elles filtrent
 * seulement ce que le lecteur voit déjà. Une préférence absente ou mal formée
 * garde un défaut prudent (activités visibles, vidéo non automatique).
 */

import {
  G01_FEED_PREFERENCES_SCHEMA,
  isUuid,
  normalizeSport,
  strictBoolean,
  type SportKey,
} from './contracts';
import {
  DEFAULT_VIDEO_PREFERENCES,
  normalizeVideoPreferences,
  type VideoPreferences,
} from './videoPlayback';

export interface FeedPreferences {
  schema: typeof G01_FEED_PREFERENCES_SCHEMA;
  muted_authors: string[];
  muted_sports: SportKey[];
  hidden_posts: string[];
  show_activity: boolean;
  video: VideoPreferences;
}

export const DEFAULT_FEED_PREFERENCES: FeedPreferences = Object.freeze({
  schema: G01_FEED_PREFERENCES_SCHEMA,
  muted_authors: [],
  muted_sports: [],
  hidden_posts: [],
  show_activity: true,
  video: { ...DEFAULT_VIDEO_PREFERENCES },
});

export type FeedPreferencesPatch = {
  muted_authors?: readonly string[];
  muted_sports?: readonly unknown[];
  hidden_posts?: readonly string[];
  show_activity?: boolean;
  video?: Partial<VideoPreferences>;
};

function uniqueStrings(values: unknown, predicate: (value: string) => boolean): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const clean = value.trim();
    if (!clean || !predicate(clean) || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= 200) break;
  }
  return result;
}

function uniqueSports(values: unknown): SportKey[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<SportKey>();
  const result: SportKey[] = [];
  for (const value of values) {
    const sport = normalizeSport(value);
    if (!sport || seen.has(sport)) continue;
    seen.add(sport);
    result.push(sport);
  }
  return result;
}

export function defaultFeedPreferences(): FeedPreferences {
  return {
    ...DEFAULT_FEED_PREFERENCES,
    muted_authors: [],
    muted_sports: [],
    hidden_posts: [],
    video: { ...DEFAULT_VIDEO_PREFERENCES },
  };
}

/**
 * Normalise un JSON local. Un schéma inconnu repart des défauts : on ne devine
 * jamais le sens d'un objet écrit par une version future ou altérée.
 */
export function normalizeFeedPreferences(raw: unknown): FeedPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultFeedPreferences();
  }
  const row = raw as Record<string, unknown>;
  if (row.schema !== G01_FEED_PREFERENCES_SCHEMA) {
    return defaultFeedPreferences();
  }
  return {
    schema: G01_FEED_PREFERENCES_SCHEMA,
    muted_authors: uniqueStrings(row.muted_authors, isUuid),
    muted_sports: uniqueSports(row.muted_sports),
    hidden_posts: uniqueStrings(row.hidden_posts, isUuid),
    show_activity: strictBoolean(row.show_activity) !== false,
    video: normalizeVideoPreferences(row.video),
  };
}

export function mergeFeedPreferences(
  current: unknown,
  patch: FeedPreferencesPatch | null | undefined
): FeedPreferences {
  const base = normalizeFeedPreferences(current);
  if (!patch || typeof patch !== 'object') return base;
  const next: FeedPreferences = {
    ...base,
    muted_authors: patch.muted_authors
      ? uniqueStrings(patch.muted_authors, isUuid)
      : base.muted_authors,
    muted_sports: patch.muted_sports ? uniqueSports(patch.muted_sports) : base.muted_sports,
    hidden_posts: patch.hidden_posts ? uniqueStrings(patch.hidden_posts, isUuid) : base.hidden_posts,
    show_activity:
      typeof patch.show_activity === 'boolean' ? patch.show_activity : base.show_activity,
    video: patch.video
      ? normalizeVideoPreferences({ ...base.video, ...patch.video })
      : base.video,
  };
  return next;
}

export interface FeedPreferenceItem {
  id: string;
  authorId?: string | null;
  sport?: unknown;
  /** Preuve que la carte est autorisée ; tout autre valeur la masque. */
  audienceAllowed?: boolean | null;
}

export interface FilteredFeed<T extends FeedPreferenceItem> {
  visible: T[];
  hidden: number;
}

/**
 * Applique les préférences APRÈS la politique de visibilité. Un élément dont
 * l'audience n'est pas explicitement autorisée est masqué (fail-closed).
 */
export function applyFeedPreferences<T extends FeedPreferenceItem>(
  items: readonly T[] | null | undefined,
  preferences: unknown
): FilteredFeed<T> {
  const prefs = normalizeFeedPreferences(preferences);
  const mutedAuthors = new Set(prefs.muted_authors);
  const mutedSports = new Set(prefs.muted_sports);
  const hiddenPosts = new Set(prefs.hidden_posts);
  const visible: T[] = [];

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item.id !== 'string' || !item.id) continue;
    if (item.audienceAllowed !== true) continue;
    if (!prefs.show_activity) continue;
    if (hiddenPosts.has(item.id)) continue;
    if (item.authorId && mutedAuthors.has(item.authorId)) continue;
    const sport = normalizeSport(item.sport);
    if (sport && mutedSports.has(sport)) continue;
    visible.push(item);
  }

  return { visible, hidden: Math.max(0, (items?.length ?? 0) - visible.length) };
}

export function feedPreferencesStorageKey(userId?: string | null): string {
  return `lkdv.feed.preferences.v1:${userId?.trim() || 'anonyme'}`;
}

/** Lecture résiliente d'un JSON local ; jamais d'exception. */
export function readFeedPreferences(raw: string | null | undefined): FeedPreferences {
  if (!raw) return defaultFeedPreferences();
  try {
    return normalizeFeedPreferences(JSON.parse(raw));
  } catch {
    return defaultFeedPreferences();
  }
}

export function serializeFeedPreferences(preferences: FeedPreferences): string {
  return JSON.stringify(normalizeFeedPreferences(preferences));
}
