/**
 * Phase 5 — Bucket privé `user-documents` : chemin propriétaire + URL signée courte.
 *   TEST-PHASE5-DOC-01 : le chemin est préfixé par l'utilisateur (policy RLS).
 *   TEST-PHASE5-DOC-02 : les buckets publics conservent leur dossier.
 *   TEST-PHASE5-DOC-03 : la durée d'URL signée reste courte (1 h).
 */
import { describe, it, expect } from 'vitest';
import {
  buildMediaUploadPath,
  isPrivateMediaBucket,
  PRIVATE_MEDIA_BUCKETS,
  SIGNED_URL_TTL_SECONDS,
} from '@/components/ui/mediaUploadPath';

describe('Phase 5 — chemins d’upload (TEST-PHASE5-DOC)', () => {
  it('TEST-PHASE5-DOC-01: bucket privé ⇒ dossier propriétaire imposé', () => {
    const result = buildMediaUploadPath({
      bucket: 'user-documents',
      folder: 'passports',
      userId: 'user-1',
      fileName: 'scan.pdf',
    });
    expect(result.isPrivate).toBe(true);
    expect(result.path).toBe('user-1/scan.pdf');
    expect(isPrivateMediaBucket('user-documents')).toBe(true);
    expect(PRIVATE_MEDIA_BUCKETS).toContain('user-documents');
  });

  it('TEST-PHASE5-DOC-02: buckets publics ⇒ dossier conservé', () => {
    expect(
      buildMediaUploadPath({
        bucket: 'carnet-media',
        folder: 'carnets/abc',
        userId: 'user-1',
        fileName: 'photo.jpg',
      })
    ).toEqual({ path: 'carnets/abc/photo.jpg', isPrivate: false });

    expect(
      buildMediaUploadPath({
        bucket: 'gear-photos',
        userId: 'user-1',
        fileName: '/photo.jpg',
      }).path
    ).toBe('photo.jpg');
    expect(isPrivateMediaBucket('gear-photos')).toBe(false);
  });

  it('TEST-PHASE5-DOC-03: URL signée courte (1 h)', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(3600);
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(3600);
  });
});
