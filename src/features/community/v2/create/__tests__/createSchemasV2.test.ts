import { describe, expect, it } from 'vitest';
import {
  carnetSchemaV2,
  clubSchemaV2,
  createDefaultsV2,
  kitSchemaV2,
  postSchemaV2,
  sortieSchemaV2,
  storySchemaV2,
  findPendingMedia,
} from '../engine/createSchemasV2';

const today = new Date();
const tomorrow = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

describe('schémas V2 — une validation par étape', () => {
  it('Publication photo : médias et légende requis', () => {
    const values = createDefaultsV2('post');
    const result = postSchemaV2.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('media');
      expect(paths).toContain('content');
    }
  });

  it('Publication photo valide avec un média téléversé', () => {
    const values = {
      ...createDefaultsV2('post'),
      content: 'Un moment au bord du lac.',
      media: [
        {
          id: 'm1',
          name: 'lac.jpg',
          type: 'image/jpeg',
          size: 100,
          previewUrl: '',
          url: 'https://example.test/lac.jpg',
          alt: 'Lac au lever du jour',
          cover: true,
          status: 'uploaded' as const,
          progress: 100,
          storageBucket: 'carnet-media',
          storagePath: 'u/lac.jpg',
          crop: '4:5' as const,
        },
      ],
    };
    expect(postSchemaV2.safeParse(values).success).toBe(true);
  });

  it('Publication non publique : les médias sont refusés', () => {
    const values = {
      ...createDefaultsV2('post'),
      format: 'photo' as const,
      audience: 'abonnies' as const,
      content: 'Texte',
      media: [{ id: 'm1', name: 'a.jpg', type: 'image/jpeg', size: 1, status: 'uploaded' as const }],
    };
    const result = postSchemaV2.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'media')).toBe(true);
    }
  });

  it('Publication billet : titre requis', () => {
    const values = {
      ...createDefaultsV2('post'),
      format: 'billet' as const,
      content: 'Récit',
      title: '',
    };
    const result = postSchemaV2.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'title')).toBe(true);
    }
  });

  it('Publication : public sans club choisi → une seule erreur club', () => {
    const values = {
      ...createDefaultsV2('post'),
      format: 'question' as const,
      content: 'Question ?',
      audience: 'club' as const,
      clubId: '',
    };
    const result = postSchemaV2.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.filter((issue) => issue.path[0] === 'clubId')).toHaveLength(1);
    }
  });

  it('Story : média requis, audience close_friends acceptée, alt ≤ 200', () => {
    const values = createDefaultsV2('story');
    expect(storySchemaV2.safeParse(values).success).toBe(false);
    const valid = {
      ...values,
      media: [
        {
          id: 's1',
          name: 'story.jpg',
          type: 'image/jpeg',
          size: 100,
          previewUrl: '',
          url: 'https://example.test/s.jpg',
          alt: '',
          cover: true,
          status: 'uploaded' as const,
          progress: 100,
          storageBucket: 'stories-private',
          storagePath: 'u/s.jpg',
          crop: '9:16' as const,
        },
      ],
      audience: 'close_friends' as const,
      altText: 'x'.repeat(201),
    };
    const result = storySchemaV2.safeParse(valid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'altText')).toBe(true);
    }
    expect(storySchemaV2.safeParse({ ...valid, altText: 'Un pont au-dessus du torrent.' }).success).toBe(true);
  });

  it('Story vidéo : extrait vide refusé, 60 s maximum', () => {
    const base = createDefaultsV2('story');
    const media = [
      {
        id: 'v1',
        name: 'story.mp4',
        type: 'video/mp4',
        size: 100,
        previewUrl: '',
        url: 'https://example.test/s.mp4',
        alt: '',
        cover: true,
        status: 'uploaded' as const,
        progress: 100,
        storageBucket: 'stories-private',
        storagePath: 'u/s.mp4',
        crop: '9:16' as const,
        durationMs: 30_000,
      },
    ];
    expect(
      storySchemaV2.safeParse({ ...base, media, trimStartMs: 5000, trimEndMs: 5000 }).success,
    ).toBe(false);
    expect(
      storySchemaV2.safeParse({ ...base, media, trimStartMs: 0, trimEndMs: 61_000 }).success,
    ).toBe(false);
    expect(storySchemaV2.safeParse({ ...base, media, trimStartMs: 1000, trimEndMs: 20_000 }).success).toBe(true);
  });

  it('Sortie : date et heure requises, date passée refusée, fin avant début refusée', () => {
    const base = { ...createDefaultsV2('sortie'), title: 'Lac Blanc', location: 'Chamonix' };
    expect(sortieSchemaV2.safeParse(base).success).toBe(false);
    expect(
      sortieSchemaV2.safeParse({ ...base, date: '2000-01-01', startTime: '08:00' }).success,
    ).toBe(false);
    expect(
      sortieSchemaV2.safeParse({ ...base, date: tomorrow, startTime: '08:00', endTime: '07:00' }).success,
    ).toBe(false);
    expect(
      sortieSchemaV2.safeParse({ ...base, date: tomorrow, startTime: '08:00', endTime: '12:00' }).success,
    ).toBe(true);
  });

  it('Kit : au moins un objet avec un poids', () => {
    const base = { ...createDefaultsV2('kit'), name: 'Kit bivouac' };
    expect(kitSchemaV2.safeParse(base).success).toBe(false);
    expect(
      kitSchemaV2.safeParse({
        ...base,
        items: [{ id: 'i1', name: 'Sac', category: 'Transport', weightG: 800, quantity: 1, productId: null, ownershipId: null }],
      }).success,
    ).toBe(true);
  });

  it('Club : nom requis, slug valide, activités multiples, 3 questions maximum', () => {
    const base = { ...createDefaultsV2('club'), name: 'La Cordée' };
    expect(clubSchemaV2.safeParse(base).success).toBe(true);
    expect(clubSchemaV2.safeParse({ ...base, slug: 'La Cordée !' }).success).toBe(false);
    expect(clubSchemaV2.safeParse({ ...base, slug: 'la-cordee-du-vercors' }).success).toBe(true);
    expect(
      clubSchemaV2.safeParse({ ...base, joinQuestions: ['a', 'b', 'c', 'd'] }).success,
    ).toBe(false);
  });

  it('Carnet : privé par défaut, fin avant début refusée, moment vide refusé', () => {
    const defaults = createDefaultsV2('carnet');
    expect(defaults.visibility).toBe('private');
    const base = { ...defaults, title: 'Tour des Écrins', destination: 'Écrins' };
    expect(carnetSchemaV2.safeParse(base).success).toBe(true);
    expect(
      carnetSchemaV2.safeParse({ ...base, startDate: '2026-05-02', endDate: '2026-05-01' }).success,
    ).toBe(false);
    expect(
      carnetSchemaV2.safeParse({
        ...base,
        days: [
          {
            id: 'd1',
            dayNumber: 1,
            title: '',
            date: '',
            night: null,
            moments: [{ id: 'm1', kind: 'photo', time: '', text: '', place: '', photo: null }],
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('médias en cours d’envoi', () => {
  it('détecte un média non téléversé au fond des valeurs', () => {
    expect(findPendingMedia({ media: [{ id: 'a', name: 'a.jpg', size: 1, status: 'uploading' }] })).not.toBeNull();
    expect(findPendingMedia({ media: [{ id: 'a', name: 'a.jpg', size: 1, status: 'uploaded' }] })).toBeNull();
  });
});
