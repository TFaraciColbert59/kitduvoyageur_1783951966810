'use client';

import { createClient } from '@/lib/supabase/client';
import {
  fetchFullProfile,
  fetchUserActivities,
  fetchUserBadges,
  fetchUserCarnets,
  fetchUserClubs,
  type CompteActiviteItem,
  type CompteBadgeItem,
  type CompteCarnet,
  type CompteClubItem,
  type CompteUserProfile,
} from '@/lib/supabase/queries-compte';
import { fetchReelComments } from './freedomReelsService';
import type { FreedomComment } from './freedom-types';

const PUBLIC_PROFILES_VIEW = 'public_profiles';

// ── 1. NETWORK CAPABILITY DETECTION ──────────────────────────────────────────

/**
 * Vérifie si la connexion réseau actuelle permet un préchargement en arrière-plan.
 * Respecte les contraintes utilisateur :
 * - Retourne `false` si l'utilisateur a activé le mode économiseur de données (`saveData`).
 * - Retourne `false` si le réseau est de type 2G ou slow-2g.
 * - Retourne `false` si le navigateur est hors ligne.
 */
export function isNetworkPermittingBackgroundPreload(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.onLine) return false;

  const conn =
    (navigator as unknown as { connection?: NetworkInformation }).connection ||
    (navigator as unknown as { mozConnection?: NetworkInformation }).mozConnection ||
    (navigator as unknown as { webkitConnection?: NetworkInformation }).webkitConnection;

  if (conn) {
    if (conn.saveData) {
      return false;
    }
    const type = String(conn.effectiveType || '').toLowerCase();
    if (type === 'slow-2g' || type === '2g') {
      return false;
    }
  }

  return true;
}

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

/**
 * Retourne vrai si la connexion est rapide (4G, 5G, Wi-Fi).
 */
export function isFastNetworkConnection(): boolean {
  if (!isNetworkPermittingBackgroundPreload()) return false;
  const conn = (navigator as unknown as { connection?: NetworkInformation }).connection;
  if (!conn) return true;
  const type = String(conn.effectiveType || '').toLowerCase();
  return type === '4g' || type === '5g' || !type;
}

// ── 2. IDLE SCHEDULER ────────────────────────────────────────────────────────

/**
 * Planifie l'exécution d'une tâche de préchargement lorsque le thread principal
 * est au repos (via `requestIdleCallback` ou fallback `setTimeout`).
 * Ne bloque jamais les animations 60fps ni les gestes tactiles.
 */
export function runWhenIdle(callback: () => void, timeoutMs = 1800): () => void {
  if (typeof window === 'undefined') return () => {};

  const win = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof win.requestIdleCallback === 'function') {
    const handle = win.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => {
      win.cancelIdleCallback?.(handle);
    };
  }

  const timer = globalThis.setTimeout(callback, 250);
  return () => globalThis.clearTimeout(timer);
}

// ── 3. ASSET PRELOADER (AVATARS / IMAGES) ────────────────────────────────────

const preloadedImagesSet = new Set<string>();

/**
 * Précharge une image (avatar, cover) dans le cache mémoire natif du navigateur.
 */
export function preloadImage(url: string | null | undefined): void {
  if (!url || typeof window === 'undefined') return;
  if (preloadedImagesSet.has(url)) return;
  preloadedImagesSet.add(url);

  try {
    const img = new Image();
    img.src = url;
  } catch {
    // Non-blocking
  }
}

// ── 4. COMMENTS PRELOAD CACHE ────────────────────────────────────────────────

interface CommentsCacheEntry {
  comments: FreedomComment[];
  timestamp: number;
}

const commentsCache = new Map<string, CommentsCacheEntry>();
const COMMENTS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export function getPreloadedReelComments(reelId: string): FreedomComment[] | null {
  const entry = commentsCache.get(reelId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > COMMENTS_CACHE_TTL_MS) {
    commentsCache.delete(reelId);
    return null;
  }
  return entry.comments;
}

export function hasPreloadedReelComments(reelId: string): boolean {
  return getPreloadedReelComments(reelId) !== null;
}

export function setPreloadedReelComments(reelId: string, comments: FreedomComment[]): void {
  commentsCache.set(reelId, {
    comments,
    timestamp: Date.now(),
  });
}

/**
 * Précharge les commentaires d'un reel en arrière-plan si le réseau le permet.
 */
export async function preloadReelComments(
  reelId: string,
  user?: unknown,
): Promise<FreedomComment[] | null> {
  if (!isNetworkPermittingBackgroundPreload()) return null;

  const existing = getPreloadedReelComments(reelId);
  if (existing) return existing;

  try {
    const list = await fetchReelComments(reelId, user);
    setPreloadedReelComments(reelId, list);
    return list;
  } catch (err) {
    console.warn('[ReelsPreload] Comment preload error:', err);
    return null;
  }
}

// ── 5. PROFILE PRELOAD CACHE ─────────────────────────────────────────────────

export interface PreloadedProfileBundle {
  targetId: string;
  cleanKey: string;
  profile: CompteUserProfile;
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  badges: CompteBadgeItem[];
  activite: CompteActiviteItem[];
  timestamp: number;
}

const profileCache = new Map<string, PreloadedProfileBundle>();
const inflightProfileRequests = new Map<string, Promise<PreloadedProfileBundle | null>>();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeProfileKey(key: string): string {
  return key.trim().toLowerCase().replace(/^@/, '');
}

export function getPreloadedPublicProfile(
  handleOrId: string | null | undefined,
): PreloadedProfileBundle | null {
  if (!handleOrId) return null;
  const normalized = normalizeProfileKey(handleOrId);
  const entry =
    profileCache.get(normalized) ||
    profileCache.get(normalized.replace(/_/g, '.')) ||
    profileCache.get(normalized.replace(/\./g, '_'));

  if (!entry) return null;
  if (Date.now() - entry.timestamp > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(normalized);
    return null;
  }
  return entry;
}

export function setPreloadedPublicProfile(key: string, bundle: PreloadedProfileBundle): void {
  const norm = normalizeProfileKey(key);
  profileCache.set(norm, bundle);
  if (bundle.targetId) profileCache.set(bundle.targetId.toLowerCase(), bundle);
  if (bundle.cleanKey) profileCache.set(normalizeProfileKey(bundle.cleanKey), bundle);
}

export function clearPreloadProfileCache(): void {
  profileCache.clear();
  commentsCache.clear();
  inflightProfileRequests.clear();
}

/**
 * Précharge le profil d'un voyageur en arrière-plan.
 * Récupère le profil, carnets, clubs, badges et activités pour que la navigation
 * vers /profil/[id] soit 100% instantanée.
 */
export async function preloadPublicProfile(
  handleOrId: string,
  authorHint?: { id?: string; name?: string; handle?: string; avatarUrl?: string | null },
): Promise<PreloadedProfileBundle | null> {
  if (!handleOrId) return null;
  if (!isNetworkPermittingBackgroundPreload()) return null;

  const key = normalizeProfileKey(handleOrId);
  const cached = getPreloadedPublicProfile(key);
  if (cached) return cached;

  if (inflightProfileRequests.has(key)) {
    return inflightProfileRequests.get(key)!;
  }

  const promise = (async (): Promise<PreloadedProfileBundle | null> => {
    try {
      const supabase = createClient();
      let targetId: string | null = authorHint?.id || null;

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);

      if (isUUID) {
        targetId = key;
      } else if (!targetId) {
        // Résolution du handle
        const { data: byHandle } = await supabase
          .from(PUBLIC_PROFILES_VIEW)
          .select('id, handle')
          .ilike('handle', key)
          .maybeSingle();

        if (byHandle?.id) {
          targetId = byHandle.id;
        } else {
          const dotted = key.replace(/_/g, '.');
          const { data: byDotted } = await supabase
            .from(PUBLIC_PROFILES_VIEW)
            .select('id, handle')
            .ilike('handle', dotted)
            .maybeSingle();
          if (byDotted?.id) targetId = byDotted.id;
        }
      }

      if (!targetId) return null;

      // Charge l'ensemble des données du profil voyageur
      const [profileData, carnetsData, clubsData, badgesData, activiteData] = await Promise.all([
        fetchFullProfile(targetId),
        fetchUserCarnets(targetId),
        fetchUserClubs(targetId),
        fetchUserBadges(targetId),
        fetchUserActivities(targetId),
      ]);

      if (!profileData) return null;

      const bundle: PreloadedProfileBundle = {
        targetId,
        cleanKey: key,
        profile: profileData,
        carnets: carnetsData,
        clubs: clubsData,
        badges: badgesData,
        activite: activiteData,
        timestamp: Date.now(),
      };

      setPreloadedPublicProfile(key, bundle);
      setPreloadedPublicProfile(targetId, bundle);
      if (authorHint?.handle) setPreloadedPublicProfile(authorHint.handle, bundle);

      // Précharge également l'avatar si disponible
      if (profileData.avatar_url || authorHint?.avatarUrl) {
        preloadImage(profileData.avatar_url || authorHint?.avatarUrl);
      }

      return bundle;
    } catch (err) {
      console.warn('[ReelsPreload] Failed to preload profile for', key, err);
      return null;
    } finally {
      inflightProfileRequests.delete(key);
    }
  })();

  inflightProfileRequests.set(key, promise);
  return promise;
}
