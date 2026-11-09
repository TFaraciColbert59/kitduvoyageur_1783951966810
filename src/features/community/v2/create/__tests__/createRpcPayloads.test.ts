import { describe, expect, it } from 'vitest';
import {
  buildCarnetPayload,
  buildClubPayload,
  buildEventPayload,
  buildKitPayload,
  buildPostPayload,
  buildStoryCompositionV2,
  carnetCover,
  toStartsAt,
} from '../createRpc';
import {
  createDefaultsV2,
  createMediaItemV2,
  type CarnetFormValuesV2,
  type MediaItemV2,
} from '../engine/createSchemasV2';

function uploaded(partial: Partial<MediaItemV2> = {}): MediaItemV2 {
  return createMediaItemV2({
    status: 'uploaded',
    progress: 100,
    url: 'https://example.test/media.jpg',
    storageBucket: 'carnet-media',
    storagePath: 'u/media.jpg',
    ...partial,
  });
}

describe('payloads RPC — conformes à RPC-CONTRACTS.md', () => {
  it('create_community_post : contenu, médias, alt, lieu et métadonnées', () => {
    const values = {
      ...createDefaultsV2('post'),
      format: 'photo' as const,
      content: 'Un moment simple au bord du lac.',
      media: [uploaded({ alt: 'Lac au lever du jour' }), uploaded({ url: 'https://example.test/b.jpg', alt: '' })],
      location: 'Lac Blanc, Chamonix',
      locationLat: 45.98,
      locationLng: 6.89,
      tags: ['rando'],
    };
    const payload = buildPostPayload(values);
    expect(payload.content).toBe('Un moment simple au bord du lac.');
    expect(payload.audience).toBe('public');
    expect(payload.image_url).toBe('https://example.test/media.jpg');
    expect(payload.media_urls).toHaveLength(2);
    expect(payload.place_label).toBe('Lac Blanc, Chamonix');
    expect(payload.place_lat).toBe(45.98);
    expect(payload.place_lng).toBe(6.89);
    expect((payload.creation_meta as { media_alts: string[] }).media_alts).toEqual([
      'Lac au lever du jour',
      '',
    ]);
    expect(payload.tags).toEqual(['rando']);
    expect(payload.client_request_id).toBe(values.clientRequestId);
  });

  it('create_community_post : le billet garde son titre dans le texte', () => {
    const values = {
      ...createDefaultsV2('post'),
      format: 'billet' as const,
      title: 'La traversée',
      content: 'Récit du jour.',
    };
    const payload = buildPostPayload(values);
    expect(payload.content).toBe('La traversée\n\nRécit du jour.');
    expect((payload.creation_meta as { title: string }).title).toBe('La traversée');
  });

  it('create_event_with_post : starts_at/ends_at ISO, activité, coordonnées et annonce', () => {
    const values = {
      ...createDefaultsV2('sortie'),
      title: 'Lac Blanc au lever du jour',
      location: 'Chamonix',
      date: '2026-12-12',
      startTime: '08:00',
      endTime: '12:30',
      meetingPoint: 'Parking de la Flégère',
      meetingLat: 45.97,
      meetingLng: 6.88,
      distanceKm: 12.5,
      elevationGainM: 850,
      safetyChecklist: ['DVA', 'Pelle'],
      recurrence: 'weekly' as const,
    };
    const payload = buildEventPayload(values);
    expect(payload.starts_at).toBe(toStartsAt('2026-12-12', '08:00'));
    expect(typeof payload.starts_at).toBe('string');
    expect(payload.ends_at).toBe(toStartsAt('2026-12-12', '12:30'));
    expect(payload.activity).toBe('Randonnée');
    expect(payload.type).toBe('rando');
    expect(payload.meeting_lat).toBe(45.97);
    expect(payload.elevation_gain_m).toBe(850);
    expect(payload.safety_checklist).toEqual(['DVA', 'Pelle']);
    expect(payload.recurrence).toBe('weekly');
    expect(payload.announce).toBe(true);
  });

  it('create_event_with_post : les 5 niveaux sont ramenés aux 3 valeurs admises en base', () => {
    const base = {
      ...createDefaultsV2('sortie'),
      title: 'Lac Blanc',
      location: 'Chamonix',
      date: '2026-12-12',
      startTime: '08:00',
    };
    expect(buildEventPayload({ ...base, level: 'tres_facile' }).level).toBe('facile');
    expect(buildEventPayload({ ...base, level: 'moyen' }).level).toBe('moyen');
    expect(buildEventPayload({ ...base, level: 'expert' }).level).toBe('difficile');
  });

  it('create_club_with_admin : l’avatar carré sert de cover_image (repli bannière)', () => {
    const base = { ...createDefaultsV2('club'), name: 'La Cordée', activities: ['Randonnée'] };
    const withAvatar = buildClubPayload(
      { ...base, avatar: [uploaded({ url: 'https://example.test/avatar.jpg' })], banner: [uploaded({ url: 'https://example.test/banner.jpg' })] },
      'la-cordee',
    );
    expect(withAvatar.cover_image).toBe('https://example.test/avatar.jpg');
    const bannerOnly = buildClubPayload(
      { ...base, avatar: [], banner: [uploaded({ url: 'https://example.test/banner.jpg' })] },
      'la-cordee',
    );
    expect(bannerOnly.cover_image).toBe('https://example.test/banner.jpg');
    expect(buildClubPayload(base, 'la-cordee').cover_image).toBeUndefined();
  });

  it('create_club_with_admin : slug, activités, adhésion et questions', () => {
    const values = {
      ...createDefaultsV2('club'),
      name: 'La Cordée du Vercors',
      activities: ['Randonnée', 'Escalade'],
      privacy: 'closed' as const,
      joinQuestions: ['Quel est ton niveau ?'],
      welcomePost: true,
      welcomeContent: 'Bienvenue !',
    };
    const payload = buildClubPayload(values, 'la-cordee-du-vercors');
    expect(payload.slug).toBe('la-cordee-du-vercors');
    expect(payload.category).toBe('Randonnée');
    expect(payload.activities).toEqual(['Randonnée', 'Escalade']);
    expect(payload.privacy).toBe('closed');
    expect(payload.join_questions).toEqual(['Quel est ton niveau ?']);
    expect(payload.welcome_post).toBe(true);
  });

  it('create_kit_with_items : items, poids par objet et visibilité', () => {
    const values = {
      ...createDefaultsV2('kit'),
      name: 'Kit bivouac été',
      isPublic: true,
      items: [
        { id: 'i1', name: 'Sac', category: 'Transport', weightG: 800, quantity: 1, productId: 'p1', ownershipId: 'o1', isChecked: true },
        { id: 'i2', name: 'Chaussettes', category: 'Vêtements', weightG: 60, quantity: 2, productId: null, ownershipId: null, isChecked: false },
      ],
    };
    const payload = buildKitPayload(values);
    expect(payload.items).toHaveLength(2);
    expect((payload.items as Array<Record<string, unknown>>)[1].quantity).toBe(2);
    expect(payload.is_public).toBe(true);
    expect(payload.share_content).toContain('Kit bivouac été');
  });

  it('create_carnet_v2 : moments, médias, couverture, visibilité privée, nuits selon flag', () => {
    const photo = uploaded({ id: 'photo-1', url: 'https://example.test/moment.jpg', alt: 'Refuge' });
    const values: CarnetFormValuesV2 = {
      ...createDefaultsV2('carnet'),
      title: 'Tour des Écrins',
      destination: 'Écrins',
      visibility: 'private',
      trace: [
        [6.1, 44.9],
        [6.2, 44.95],
      ],
      distanceKm: 42,
      days: [
        {
          id: 'd1',
          dayNumber: 1,
          title: 'Refuge du Temple',
          date: '2026-07-10',
          night: { name: 'Refuge du Temple', type: 'refuge', infos: 'Demi-pension' },
          moments: [
            { id: 'm1', kind: 'photo', time: '18:00', text: 'Arrivée au refuge.', place: '', photo },
          ],
        },
      ],
      coverMediaId: 'photo-1',
      postEnabled: true,
      postContent: 'Carnet public',
    };
    const payload = buildCarnetPayload(values, { hasCarnetNights: false });
    expect(payload.visibility).toBe('private');
    expect(payload.cover_image).toBe('https://example.test/moment.jpg');
    expect(payload.media).toHaveLength(1);
    expect(payload.moments).toHaveLength(1);
    expect(payload.nights).toEqual([]);
    expect((payload.post as { enabled: boolean }).enabled).toBe(false);
    expect(carnetCover(values)?.id).toBe('photo-1');

    const withNights = buildCarnetPayload(values, { hasCarnetNights: true });
    expect(withNights.nights).toHaveLength(1);
  });
});

describe('stories V2', () => {
  it('compose textes déplaçables, stickers et lien dans la composition v1-compatible', () => {
    const values = {
      ...createDefaultsV2('story'),
      textLayers: [
        { id: 't1', text: 'Au sommet', x: 0.5, y: 0.3, scale: 1.2, rotation: 4, style: 'clair' as const },
      ],
      stickers: {
        place: { label: 'Chamonix', lat: 45.9, lng: 6.8 },
        altitudeM: 2380,
        weatherLabel: '12° · nuageux',
        distanceKm: 8.4,
        link: { url: 'https://example.test', label: 'Le carnet' },
        carnetId: 'carnet-1',
        carnetTitle: 'Tour',
        carnetDay: null,
      },
    };
    const composition = buildStoryCompositionV2(values);
    expect(composition).not.toBeNull();
    const types = composition!.map((entry) => entry.type);
    expect(types).toContain('text');
    expect(types).toContain('sticker');
    expect(types).toContain('link');
    expect(composition![0]).toMatchObject({ type: 'text', text: 'Au sommet', x: 0.5, y: 0.3 });
  });
});
