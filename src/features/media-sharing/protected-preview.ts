import { createHash, randomBytes } from 'node:crypto';
import { haversineDistanceM } from './privacy';
import type {
  GeoPoint,
  ProtectedPreviewRecord,
  ProtectedPreviewResolution,
  PublishableTrackProjection,
} from './types';

export function hashPreviewToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Simplification Ramer-Douglas-Peucker pour produire une géométrie simplifiée non navigable.
 */
export function simplifyTrackGeometry(
  points: readonly GeoPoint[],
  toleranceMeters = 35,
): Array<{ lat: number; lng: number }> {
  if (points.length <= 2) {
    return points.map((p) => ({ lat: p.lat, lng: p.lng }));
  }

  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let splitIdx = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicularDistanceM(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }

  if (maxDist > toleranceMeters) {
    const left = simplifyTrackGeometry(points.slice(0, splitIdx + 1), toleranceMeters);
    const right = simplifyTrackGeometry(points.slice(splitIdx), toleranceMeters);
    return [...left.slice(0, -1), ...right];
  }

  return [
    { lat: first.lat, lng: first.lng },
    { lat: last.lat, lng: last.lng },
  ];
}

function perpendicularDistanceM(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const ab = haversineDistanceM(a, b);
  if (ab === 0) return haversineDistanceM(p, a);
  const ap = haversineDistanceM(a, p);
  const bp = haversineDistanceM(b, p);
  const s = (ab + ap + bp) / 2;
  const areaSq = Math.max(0, s * (s - ab) * (s - ap) * (s - bp));
  return (2 * Math.sqrt(areaSq)) / ab;
}

function buildElevationProfile(
  points: readonly GeoPoint[],
): Array<{ distanceM: number; elevationM: number | null }> {
  const profile: Array<{ distanceM: number; elevationM: number | null }> = [];
  let acc = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) {
      acc += haversineDistanceM(points[i - 1], points[i]);
    }
    profile.push({
      distanceM: Math.round(acc),
      elevationM: points[i].elevationM ?? null,
    });
  }
  return profile;
}

/**
 * K5.28 — Store en mémoire / contrat de persistance pour les aperçus protégés révocables.
 * - Ne stocke jamais le jeton brut, uniquement son empreinte SHA-256.
 * - Fail-closed : un lien révoqué, expiré ou dont `maskVersion` a changé ne retourne aucune coordonnée ni miniature.
 */
export class ProtectedPreviewStore {
  private readonly recordsById = new Map<string, ProtectedPreviewRecord>();
  private readonly idByTokenHash = new Map<string, string>();

  createLink(input: {
    track: PublishableTrackProjection;
    ownerId: string;
    expiresInSec: number;
    toleranceMeters?: number;
    nowMs?: number;
  }): { rawToken: string; record: ProtectedPreviewRecord } {
    if (input.track.ownerId !== input.ownerId) {
      throw new Error('protected_preview_owner_mismatch');
    }

    const nowMs = input.nowMs ?? Date.now();
    const ttlMs = Math.max(60, input.expiresInSec) * 1000;
    const rawToken = randomBytes(24).toString('base64url');
    const tokenHash = hashPreviewToken(rawToken);
    const linkId = `ppv_${tokenHash.slice(0, 12)}_${nowMs}`;

    const simplifiedPoints = simplifyTrackGeometry(
      input.track.points,
      input.toleranceMeters ?? 35,
    );
    const elevationProfile = buildElevationProfile(input.track.points);

    const record: ProtectedPreviewRecord = {
      linkId,
      trackId: input.track.trackId,
      ownerId: input.ownerId,
      tokenHash,
      maskVersion: input.track.maskVersion,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + ttlMs,
      revokedAtMs: null,
      simplifiedPoints,
      elevationProfile,
      totalDistanceM: input.track.totalDistanceM,
      elevationGainM: input.track.elevationGainM,
      title: input.track.title,
      sport: input.track.sport,
    };

    this.recordsById.set(linkId, record);
    this.idByTokenHash.set(tokenHash, linkId);

    return { rawToken, record };
  }

  resolveToken(
    rawToken: string,
    options: { nowMs?: number; currentMaskVersion?: string } = {},
  ): ProtectedPreviewResolution {
    if (!rawToken || rawToken.trim().length === 0) {
      return { ok: false, reason: 'not_found', preview: null };
    }

    const tokenHash = hashPreviewToken(rawToken);
    const linkId = this.idByTokenHash.get(tokenHash);
    if (!linkId) {
      return { ok: false, reason: 'not_found', preview: null };
    }

    const record = this.recordsById.get(linkId);
    if (!record) {
      return { ok: false, reason: 'not_found', preview: null };
    }

    if (record.revokedAtMs !== null) {
      return { ok: false, reason: 'revoked', preview: null };
    }

    const nowMs = options.nowMs ?? Date.now();
    if (nowMs >= record.expiresAtMs) {
      return { ok: false, reason: 'expired', preview: null };
    }

    if (
      options.currentMaskVersion !== undefined &&
      options.currentMaskVersion !== record.maskVersion
    ) {
      return { ok: false, reason: 'mask_invalidated', preview: null };
    }

    return {
      ok: true,
      preview: {
        linkId: record.linkId,
        title: record.title,
        sport: record.sport,
        totalDistanceM: record.totalDistanceM,
        elevationGainM: record.elevationGainM,
        simplifiedPoints: record.simplifiedPoints,
        elevationProfile: record.elevationProfile,
        downloadable: false,
        navigable: false,
        expiresAtMs: record.expiresAtMs,
      },
    };
  }

  revokeLink(linkId: string, ownerId: string, nowMs = Date.now()): boolean {
    const record = this.recordsById.get(linkId);
    if (!record || record.ownerId !== ownerId) {
      return false;
    }
    if (record.revokedAtMs === null) {
      this.recordsById.set(linkId, { ...record, revokedAtMs: nowMs });
    }
    return true;
  }

  revokeAllForTrack(trackId: string, ownerId: string, nowMs = Date.now()): number {
    let count = 0;
    for (const [linkId, record] of Array.from(this.recordsById.entries())) {
      if (record.trackId === trackId && record.ownerId === ownerId && record.revokedAtMs === null) {
        this.recordsById.set(linkId, { ...record, revokedAtMs: nowMs });
        count += 1;
      }
    }
    return count;
  }

  getRecordMetadata(linkId: string): Omit<ProtectedPreviewRecord, 'simplifiedPoints' | 'elevationProfile'> | null {
    const record = this.recordsById.get(linkId);
    if (!record) return null;
    const { simplifiedPoints: _s, elevationProfile: _e, ...meta } = record;
    return meta;
  }
}
