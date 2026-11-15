import type { Collection, Outcome, ShareLink, Viewer } from '../types';
import { fail, ok } from './result';
import type { Runtime } from './runtime';

const DEFAULT_TTL_DAYS = 30;
const MAX_TTL_DAYS = 365;
const MAX_LINKS = 10;

export function sharePath(token: string): string {
  return `/h/c/${encodeURIComponent(token)}`;
}

export function createShareLink(
  collection: Collection,
  viewer: Viewer,
  runtime: Runtime,
  options: { expiresInDays?: number } = {}
): Outcome<{ collection: Collection; link: ShareLink }> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
  if (viewer.id !== collection.ownerId) return fail('forbidden', 'Réservé au propriétaire.');
  const now = runtime.now();
  const active = collection.shareLinks.filter(
    (link) =>
      link.revokedAt == null &&
      (link.expiresAt == null || new Date(link.expiresAt).getTime() > new Date(now).getTime())
  );
  if (active.length >= MAX_LINKS) {
    return fail(
      'limit-reached',
      'Trop de liens actifs : révoquez-en un avant d’en créer un autre.'
    );
  }
  const requested = options.expiresInDays ?? DEFAULT_TTL_DAYS;
  const days = Math.min(MAX_TTL_DAYS, Math.max(1, Math.floor(requested)));
  const expiresAt = new Date(new Date(now).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  let token = runtime.token();
  let guard = 0;
  while (collection.shareLinks.some((link) => link.token === token) && guard < 5) {
    token = runtime.token();
    guard += 1;
  }
  const link: ShareLink = {
    id: runtime.id(),
    collectionId: collection.id,
    token,
    createdBy: viewer.id,
    createdAt: now,
    expiresAt,
    revokedAt: null,
  };
  return ok({
    collection: { ...collection, shareLinks: [...collection.shareLinks, link], updatedAt: now },
    link,
  });
}

export function revokeShareLink(
  collection: Collection,
  linkId: string,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
  if (viewer.id !== collection.ownerId) return fail('forbidden', 'Réservé au propriétaire.');
  const link = collection.shareLinks.find((item) => item.id === linkId);
  if (!link) return fail('not-found', 'Lien introuvable.');
  if (link.revokedAt != null) return ok(collection);
  const now = runtime.now();
  return ok({
    ...collection,
    shareLinks: collection.shareLinks.map((item) =>
      item.id === linkId ? { ...item, revokedAt: now } : item
    ),
    updatedAt: now,
  });
}

export function revokeAllShareLinks(
  collection: Collection,
  viewer: Viewer,
  runtime: Runtime
): Outcome<Collection> {
  if (viewer.id == null) return fail('unauthenticated', 'Connexion requise.');
  if (viewer.id !== collection.ownerId) return fail('forbidden', 'Réservé au propriétaire.');
  const now = runtime.now();
  return ok({
    ...collection,
    shareLinks: collection.shareLinks.map((item) =>
      item.revokedAt == null ? { ...item, revokedAt: now } : item
    ),
    updatedAt: now,
  });
}

export type ShareResolution =
  { ok: true; link: ShareLink } | { ok: false; reason: 'not-found' | 'revoked' | 'expired' };

/**
 * Résout un jeton opaque. Le même message couvre inconnu, révoqué et expiré :
 * l'appelant ne doit pas pouvoir sonder l'existence d'une collection privée.
 */
export function resolveShareLink(
  collection: Collection,
  token: string,
  now: string
): ShareResolution {
  const link = collection.shareLinks.find((item) => item.token === token);
  if (!link) return { ok: false, reason: 'not-found' };
  if (link.revokedAt != null) return { ok: false, reason: 'revoked' };
  if (link.expiresAt != null && new Date(link.expiresAt).getTime() <= new Date(now).getTime()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, link };
}

export function activeShareLinks(collection: Collection, now: string): ShareLink[] {
  return collection.shareLinks.filter((link) => resolveShareLink(collection, link.token, now).ok);
}
