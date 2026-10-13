/**
 * T26 — médias dédupliqués :
 *   (a) empreinte stable : domaine, paramètres et dérivés évidents ignorés ;
 *   (b) photos différentes → empreintes différentes ; invalide → null ;
 *   (c) hook : EXIF non retiré, visite non prouvée, média invalide → refus ;
 *   (d) hook : photo consentie + visite prouvée → gain avec claim média partagé.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/features/progression/server/awardProducer', () => ({ awardProducerGain: vi.fn() }));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain } from '@/features/progression/server/awardProducer';
import {
  mediaClaimFor,
  mediaFingerprint,
  normalizeMediaIdentity,
} from '@/features/progression/server/mediaClaim';
import { awardPlacePhoto } from '@/features/progression/server/producerHooks';

const mockedGetService = vi.mocked(getServiceSupabase);
const mockedAward = vi.mocked(awardProducerGain);

interface MockOptions {
  photo?: unknown;
  reviewCount?: number;
}

function createMock(options: MockOptions) {
  return {
    from(table: string) {
      if (table === 'place_photos') {
        const builder: Record<string, unknown> = {};
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.maybeSingle = () => Promise.resolve({ data: options.photo ?? null, error: null });
        return builder;
      }
      if (table === 'place_reviews') {
        const builder: Record<string, unknown> = {};
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ count: options.reviewCount ?? 0, error: null }).then(resolve);
        return builder;
      }
      throw new Error(`table inattendue: ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAward.mockResolvedValue({ success: true, outcome: 'awarded' });
});

describe('empreintes média', () => {
  it('(a) domaine, paramètres et dérivés évidents ignorés', () => {
    const original = 'https://cdn.lkdv.fr/carnets/photo-123.jpg';
    const variants = [
      'https://cdn.lkdv.fr/carnets/photo-123.jpg?w=800&q=80',
      'https://autre-domaine.fr/carnets/photo-123.jpg',
      'https://cdn.lkdv.fr/carnets/photo-123-400x400.jpg',
      'https://cdn.lkdv.fr/carnets/photo-123_thumb.jpg',
      'https://cdn.lkdv.fr/carnets/photo-123@2x.jpg',
      'https://cdn.lkdv.fr/carnets/photo-123-scaled.jpg',
    ];
    const reference = mediaFingerprint(original);
    expect(reference).not.toBeNull();
    for (const variant of variants) {
      expect(mediaFingerprint(variant)).toBe(reference);
    }
    expect(normalizeMediaIdentity(original)).toBe('/carnets/photo-123.jpg');
  });

  it('(b) photos distinctes → empreintes distinctes ; entrée invalide → null', () => {
    expect(mediaFingerprint('https://cdn.lkdv.fr/a/photo-1.jpg')).not.toBe(
      mediaFingerprint('https://cdn.lkdv.fr/a/photo-2.jpg')
    );
    expect(mediaFingerprint('')).toBeNull();
    expect(mediaFingerprint('   ')).toBeNull();
    expect(mediaClaimFor('')).toBeNull();
  });
});

describe('hook photo de lieu', () => {
  it('(c) EXIF, visite, média : refus explicites sans crédit', async () => {
    mockedGetService.mockReturnValue(createMock({ photo: null }) as never);
    expect((await awardPlacePhoto('p1')).reason).toBe('photo_introuvable');

    mockedGetService.mockReturnValue(
      createMock({ photo: { id: 'p1', place_id: 'pl1', author_id: 'u1', url: 'x', has_exif_stripped: false } }) as never
    );
    expect((await awardPlacePhoto('p1')).reason).toBe('consentement_requis');

    mockedGetService.mockReturnValue(
      createMock({
        photo: { id: 'p1', place_id: 'pl1', author_id: 'u1', url: 'https://cdn/a.jpg', has_exif_stripped: true },
        reviewCount: 0,
      }) as never
    );
    expect((await awardPlacePhoto('p1')).reason).toBe('visite_non_prouvee');

    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(d) photo consentie + visite prouvée → gain avec claim média partagé', async () => {
    mockedGetService.mockReturnValue(
      createMock({
        photo: {
          id: 'p1',
          place_id: 'pl1',
          author_id: 'u1',
          url: 'https://cdn.lkdv.fr/lieux/photo-9.jpg?w=1200',
          has_exif_stripped: true,
        },
        reviewCount: 1,
      }) as never
    );

    await awardPlacePhoto('p1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('place_photo');
    expect(input.claims?.[0].group).toBe('media');
    expect(input.claims?.[0].key).toBe(`media:${mediaFingerprint('https://cdn.lkdv.fr/lieux/photo-9.jpg?w=1200')}`);
  });
});
