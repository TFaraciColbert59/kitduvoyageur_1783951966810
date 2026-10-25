import 'server-only';
import { createHash } from 'node:crypto';

/**
 * T26 — Déduplication des médias récompensés.
 *
 * Une même photo originale ne peut être rémunérée qu'une fois, quel que soit
 * le producteur (photo de lieu, média de carnet, trace…). L'empreinte est
 * déterministe à partir de l'identité stable du fichier :
 *   • paramètres de requête et domaine retirés ;
 *   • suffixes de transformation évidents retirés (`-400x400`, `_thumb`,
 *     `@2x`, `?w=…`) : un dérivé évident garde la même empreinte ;
 *   • hachage SHA-256 tronqué (aucune coordonnée, aucun contenu).
 *
 * Le claim partagé `media:<empreinte>` est réservé atomiquement par le moteur
 * (T08) : l'ordre carnet→lieu ou lieu→carnet est indifférent.
 */

export const MEDIA_CLAIM_GROUP = 'media';

export function normalizeMediaIdentity(source: string): string | null {
  if (typeof source !== 'string') return null;
  let value = source.trim();
  if (value.length === 0) return null;

  // Domaine et protocole retirés ; paramètres de requête ignorés.
  value = value.replace(/^https?:\/\/[^/]+/i, '');
  value = value.split('?')[0].split('#')[0];

  // Suffixes de transformation évidents.
  value = value
    .replace(/-(\d{2,5})x(\d{2,5})(?=\.[a-z0-9]+$|$)/gi, '')
    .replace(/@\d+x(?=\.[a-z0-9]+$|$)/gi, '')
    .replace(/(_thumb|_small|_medium|_large|-scaled)(?=\.[a-z0-9]+$|$)/gi, '');

  return value.toLowerCase();
}

/** Empreinte SHA-256 tronquée : stable, sans réversibilité pratique. */
export function mediaFingerprint(source: string): string | null {
  const normalized = normalizeMediaIdentity(source);
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export function mediaClaimKey(fingerprint: string): string {
  return `media:${fingerprint}`;
}

export function mediaClaimFor(source: string): { group: string; key: string } | null {
  const fingerprint = mediaFingerprint(source);
  if (!fingerprint) return null;
  return { group: MEDIA_CLAIM_GROUP, key: mediaClaimKey(fingerprint) };
}
