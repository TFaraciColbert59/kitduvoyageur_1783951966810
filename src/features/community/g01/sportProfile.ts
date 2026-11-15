/**
 * G01 — profil sportif et visibilité (S6.12).
 *
 * Le profil sportif est un choix explicite de l'auteur : par défaut il est
 * privé, aucun sport n'est coché, et un objet mal formé ne rend jamais un
 * profil public. L'audience du profil sportif ne peut pas élargir la
 * visibilité du compte (`user_profiles.profile_visibility`) : elle la
 * restreint seulement.
 */

import {
  G01_SPORT_PROFILE_SCHEMA,
  SPORT_KEYS,
  finiteNumber,
  fold,
  formatDuration,
  formatNumber,
  isUuid,
  normalizeSport,
  positiveInteger,
  sportLabel,
  strictBoolean,
  type SportKey,
} from './contracts';
import type { ViewerFacts } from './visibilityPolicy';
import { normalizeActivityVisibility } from './contracts';
import { formatSportRecordValue, type SportRecordChip, type SportStatKey } from './sportStats';

export type SportProfileAudience = 'private' | 'abonnies' | 'public';

export interface SportProfilePreferences {
  schema: typeof G01_SPORT_PROFILE_SCHEMA;
  audience: SportProfileAudience;
  sports: Record<SportKey, boolean>;
  show_totals: boolean;
  show_records: boolean;
  updated_at: string | null;
}

export type SportProfilePreferencesPatch = {
  audience?: SportProfileAudience | string;
  sports?: Partial<Record<SportKey, boolean>>;
  show_totals?: boolean;
  show_records?: boolean;
};

function emptySports(): Record<SportKey, boolean> {
  return SPORT_KEYS.reduce(
    (acc, sport) => {
      acc[sport] = false;
      return acc;
    },
    {} as Record<SportKey, boolean>
  );
}

export function defaultSportProfilePreferences(): SportProfilePreferences {
  return {
    schema: G01_SPORT_PROFILE_SCHEMA,
    audience: 'private',
    sports: emptySports(),
    show_totals: true,
    show_records: false,
    updated_at: null,
  };
}

export function normalizeSportProfileAudience(value: unknown): SportProfileAudience {
  const key = fold(value);
  if (key === 'public') return 'public';
  if (key === 'abonnies' || key === 'abonnes' || key === 'followers' || key === 'friends') {
    return 'abonnies';
  }
  return 'private';
}

export function sportProfileAudienceLabel(value: unknown): string {
  const audience = normalizeSportProfileAudience(value);
  if (audience === 'public') return 'Public';
  if (audience === 'abonnies') return 'Abonnés';
  return 'Privé';
}

function normalizeUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function normalizeSportProfilePreferences(raw: unknown): SportProfilePreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultSportProfilePreferences();
  }
  const row = raw as Record<string, unknown>;
  if (row.schema !== G01_SPORT_PROFILE_SCHEMA) {
    return defaultSportProfilePreferences();
  }
  const sports = emptySports();
  if (row.sports && typeof row.sports === 'object' && !Array.isArray(row.sports)) {
    const sportsRow = row.sports as Record<string, unknown>;
    for (const sport of SPORT_KEYS) {
      // Seul `true` active un sport. `"true"`, `1` et les clés inconnues sont
      // ignorés : un profil ne devient jamais public par coercition.
      if (sportsRow[sport] === true) sports[sport] = true;
    }
  }
  return {
    schema: G01_SPORT_PROFILE_SCHEMA,
    audience: normalizeSportProfileAudience(row.audience),
    sports,
    show_totals: strictBoolean(row.show_totals) !== false,
    show_records: strictBoolean(row.show_records) === true,
    updated_at: normalizeUpdatedAt(row.updated_at),
  };
}

export function mergeSportProfilePreferences(
  current: unknown,
  patch: SportProfilePreferencesPatch | null | undefined
): SportProfilePreferences {
  const base = normalizeSportProfilePreferences(current);
  if (!patch || typeof patch !== 'object') return base;
  const sports = { ...base.sports };
  if (patch.sports && typeof patch.sports === 'object') {
    for (const sport of SPORT_KEYS) {
      const next = patch.sports[sport];
      if (typeof next === 'boolean') sports[sport] = next;
    }
  }
  return {
    ...base,
    audience:
      patch.audience !== undefined
        ? normalizeSportProfileAudience(patch.audience)
        : base.audience,
    sports,
    show_totals:
      typeof patch.show_totals === 'boolean' ? patch.show_totals : base.show_totals,
    show_records:
      typeof patch.show_records === 'boolean' ? patch.show_records : base.show_records,
    updated_at: new Date().toISOString(),
  };
}

export type SportProfileAccessReason =
  | 'owner'
  | 'public'
  | 'anonymous_public'
  | 'follower'
  | 'community'
  | 'missing_owner'
  | 'blocked'
  | 'blocked_unknown'
  | 'profile_private'
  | 'prefs_private'
  | 'followers_only';

export interface SportProfileAccess {
  allowed: boolean;
  reason: SportProfileAccessReason;
  isOwner: boolean;
  isAnonymous: boolean;
  preferences: SportProfilePreferences;
}

function profileVisibility(value: unknown): 'private' | 'community' | 'public' {
  const key = fold(value);
  if (key === 'private' || key === 'prive') return 'private';
  if (key === 'communaute' || key === 'community') return 'community';
  if (key === 'public') return 'public';
  return 'private';
}

export interface SportProfileAccessInput {
  ownerId?: string | null;
  viewer?: ViewerFacts | null;
  preferences?: unknown;
  /** `user_profiles.profile_visibility` ; absent = privé. */
  profileVisibility?: unknown;
}

export function resolveSportProfileAccess(
  input: SportProfileAccessInput = {}
): SportProfileAccess {
  const preferences = normalizeSportProfilePreferences(input.preferences);
  const ownerId = typeof input.ownerId === 'string' ? input.ownerId.trim() : '';
  const viewerId =
    typeof input.viewer?.viewerId === 'string' ? input.viewer.viewerId.trim() : '';
  const isOwner = Boolean(ownerId && viewerId && ownerId === viewerId);
  const isAnonymous = !viewerId;
  const accountVisibility = profileVisibility(input.profileVisibility);

  if (!ownerId || !isUuid(ownerId)) {
    return {
      allowed: false,
      reason: 'missing_owner',
      isOwner: false,
      isAnonymous,
      preferences,
    };
  }

  if (isOwner) {
    return { allowed: true, reason: 'owner', isOwner: true, isAnonymous: false, preferences };
  }

  if (input.viewer?.blocked === true) {
    return { allowed: false, reason: 'blocked', isOwner: false, isAnonymous, preferences };
  }
  if (!isAnonymous && (input.viewer?.blocked === null || input.viewer?.blocked === undefined)) {
    return {
      allowed: false,
      reason: 'blocked_unknown',
      isOwner: false,
      isAnonymous,
      preferences,
    };
  }

  if (accountVisibility === 'private') {
    return { allowed: false, reason: 'profile_private', isOwner: false, isAnonymous, preferences };
  }
  if (accountVisibility === 'community' && isAnonymous) {
    return { allowed: false, reason: 'community', isOwner: false, isAnonymous, preferences };
  }

  if (preferences.audience === 'private') {
    return { allowed: false, reason: 'prefs_private', isOwner: false, isAnonymous, preferences };
  }
  if (preferences.audience === 'abonnies' && input.viewer?.isFollower !== true) {
    return { allowed: false, reason: 'followers_only', isOwner: false, isAnonymous, preferences };
  }
  if (preferences.audience === 'public') {
    return {
      allowed: true,
      reason: isAnonymous ? 'anonymous_public' : 'public',
      isOwner: false,
      isAnonymous,
      preferences,
    };
  }
  return { allowed: true, reason: 'follower', isOwner: false, isAnonymous, preferences };
}

export interface SportAggregate {
  sport: unknown;
  sessions?: number | null;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  durationSeconds?: number | null;
}

export interface SportProfileRecord {
  id: string;
  sport: unknown;
  stat: SportStatKey | string;
  value: unknown;
  visibility?: unknown;
  achievedAt?: string | null;
}

export interface SportProfileSportVM {
  sport: SportKey;
  label: string;
  sessions: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSeconds: number | null;
  distanceLabel: string | null;
  elevationLabel: string | null;
  durationLabel: string | null;
}

export interface SportProfileSummaryVM {
  visible: boolean;
  reason: SportProfileAccessReason;
  owner: boolean;
  audience: SportProfileAudience;
  audienceLabel: string;
  sports: SportProfileSportVM[];
  records: SportRecordChip[];
  hasData: boolean;
  preferences: SportProfilePreferences;
}

const PROFILE_RECORD_LABELS: Record<SportStatKey, string> = {
  distance: 'Record distance',
  elevation: 'Record dénivelé',
  duration: 'Record durée',
  pace: 'Record allure',
  speed: 'Record vitesse',
  altitude: 'Record altitude',
};

const PROFILE_RECORD_STATS: readonly SportStatKey[] = [
  'distance',
  'elevation',
  'duration',
  'pace',
  'speed',
  'altitude',
];

function profileRecords(
  records: readonly SportProfileRecord[] | null | undefined,
  preferences: SportProfilePreferences
): SportRecordChip[] {
  if (!preferences.show_records || !Array.isArray(records)) return [];
  const chips: SportRecordChip[] = [];
  for (const record of records) {
    if (chips.length >= 4) break;
    if (!record || typeof record !== 'object') continue;
    const sport = normalizeSport(record.sport);
    if (!sport || !preferences.sports[sport]) continue;
    if (normalizeActivityVisibility(record.visibility) === 'private') continue;
    const stat = PROFILE_RECORD_STATS.find((candidate) => candidate === record.stat);
    if (!stat) continue;
    const value = finiteNumber(record.value, { min: 0 });
    if (value === null) continue;
    const formatted = formatSportRecordValue(stat, value);
    chips.push({
      id: typeof record.id === 'string' && record.id ? record.id : `${sport}:${stat}`,
      label: PROFILE_RECORD_LABELS[stat],
      formatted: formatted.formatted,
    });
  }
  return chips;
}

/**
 * Résumé public : uniquement les sports explicitement cochés et les records
 * non privés, et seulement si la politique d'accès l'autorise. Aucun agrégat
 * n'est calculé ici : les totaux viennent du serveur ou d'une requête déjà
 * filtrée par RLS.
 */
export function buildSportProfileSummary(
  input: SportProfileAccessInput & {
    aggregates?: readonly SportAggregate[] | null;
    records?: readonly SportProfileRecord[] | null;
  } = {}
): SportProfileSummaryVM {
  const access = resolveSportProfileAccess(input);
  const preferences = access.preferences;
  const empty: SportProfileSummaryVM = {
    visible: access.allowed,
    reason: access.reason,
    owner: access.isOwner,
    audience: preferences.audience,
    audienceLabel: sportProfileAudienceLabel(preferences.audience),
    sports: [],
    records: [],
    hasData: false,
    preferences,
  };
  if (!access.allowed) return empty;

  const sports: SportProfileSportVM[] = [];
  for (const aggregate of Array.isArray(input.aggregates) ? input.aggregates : []) {
    const sport = normalizeSport(aggregate?.sport);
    if (!sport || !preferences.sports[sport]) continue;
    const sessions = positiveInteger(aggregate.sessions) ?? 0;
    if (sessions <= 0) continue;
    const distanceKm = preferences.show_totals
      ? finiteNumber(aggregate.distanceKm, { min: 0 })
      : null;
    const elevationGainM = preferences.show_totals
      ? finiteNumber(aggregate.elevationGainM, { min: 0 })
      : null;
    const durationSeconds = preferences.show_totals
      ? finiteNumber(aggregate.durationSeconds, { min: 0 })
      : null;
    sports.push({
      sport,
      label: sportLabel(sport),
      sessions,
      distanceKm,
      elevationGainM,
      durationSeconds,
      distanceLabel: distanceKm === null ? null : `${formatNumber(distanceKm, 1)} km`,
      elevationLabel: elevationGainM === null ? null : `${formatNumber(elevationGainM, 0)} m D+`,
      durationLabel: durationSeconds === null ? null : formatDuration(durationSeconds),
    });
  }

  const records = profileRecords(input.records, preferences);
  return {
    ...empty,
    sports,
    records,
    hasData: sports.length > 0 || records.length > 0,
  };
}
