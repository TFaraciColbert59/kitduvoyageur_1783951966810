import { describe, expect, it, vi } from 'vitest';
import { buildCarnetDetail } from '../buildCarnetDetail';
import { replyToCarnetStory } from '@/lib/stories/carnetReply';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { CarnetRow, BuildCarnetDetailInput, EtapeRow } from '../types';

describe('Carnet v2 Data Layer', () => {
  const baseCarnet: CarnetRow = {
    id: 'carnet-123',
    title: 'Tour des Fiz',
    description: 'Une aventure alpine inoubliable',
    author_id: 'user-owner',
    cover_image: 'https://example.com/cover.jpg',
    cover_image_alt: null,
    created_at: '2026-06-01T10:00:00Z',
    start_date: '2026-06-10',
    end_date: '2026-06-14',
    status: 'published',
    visibility: 'public',
    live_sharing: true,
    views_count: 10,
    likes_count: 5,
    comments_count: 2,
    destination: 'Haute-Savoie',
    distance_km: 45,
    denivele_m: 3200,
    groupe_id: null,
    lieu_depart: 'Plaine-Joux',
    lieu_arrivee: 'Plaine-Joux',
    country_iso: 'FR',
    verified: false,
  };

  const baseEtape: EtapeRow = {
    id: 'step-1',
    jour_numero: 1,
    ordre: 1,
    lieu_depart: 'Plaine-Joux',
    lieu_arrivee: 'Refuge de Platé',
    date_etape: '2026-06-10',
    distance_km: 12.5,
    denivele_m: 850,
    duree_texte: '4h',
    meteo: 'Ensoleillé',
    temperature_c: 20,
    recit: 'Montée vers Platé',
  };

  it('génère les nuits via le fallback hebergements si carnet_nights est vide', () => {
    const input: BuildCarnetDetailInput = {
      carnet: baseCarnet,
      author: null,
      hikeSession: null,
      etapes: [baseEtape],
      moments: [],
      hebergements: [
        {
          id: 'heb-1',
          apres_jour_numero: 1,
          nom: 'Refuge de Platé',
          type_hebergement: 'refuge',
          prix_cents: 4500,
          prix_note: '45 € en demi-pension',
          altitude_m: 2032,
          note: 'Refuge gardé très accueillant',
          hote: 'Gardien Platé',
        },
      ],
      nights: [],
      kitItems: [],
      viewerRole: 'participant',
      viewerId: 'user-owner',
      liked: false,
      favorited: false,
    };

    const detail = buildCarnetDetail(input);
    expect(detail.nights).toHaveLength(1);
    expect(detail.nights?.[0].name).toBe('Refuge de Platé');
    expect(detail.nights?.[0].type).toBe('refuge');
    expect(detail.nights?.[0].dayNumber).toBe(1);
  });

  it('utilise carnet_nights prioritairement lorsqu’elles sont fournies', () => {
    const input: BuildCarnetDetailInput = {
      carnet: baseCarnet,
      author: null,
      hikeSession: null,
      etapes: [baseEtape],
      moments: [],
      hebergements: [],
      nights: [
        {
          id: 'night-1',
          dayNumber: 1,
          name: 'Bivouac sous les Fiz',
          type: 'bivouac',
          lat: 45.99,
          lng: 6.73,
          altitudeM: 2100,
          infos: 'Spot magique',
          mapRefugeId: null,
        },
      ],
      kitItems: [],
      viewerRole: 'visitor',
      viewerId: null,
      liked: false,
      favorited: false,
    };

    const detail = buildCarnetDetail(input);
    expect(detail.nights).toHaveLength(1);
    expect(detail.nights?.[0].name).toBe('Bivouac sous les Fiz');
    expect(detail.nights?.[0].type).toBe('bivouac');
    expect(detail.nights?.[0].altitudeM).toBe(2100);
  });

  it('masque le budget pour les visiteurs et le conserve pour les participants', () => {
    const budgetData = {
      total: 350,
      totalCents: 35000,
      currency: 'EUR',
      perPersonCents: null,
      items: [
        { id: 'b1', label: 'Refuge', amount: 180, amountCents: 18000, category: 'hebergement', paidByUserId: null, date: null },
        { id: 'b2', label: 'Nourriture', amount: 170, amountCents: 17000, category: 'nourriture', paidByUserId: null, date: null },
      ],
    };

    const inputParticipant: BuildCarnetDetailInput = {
      carnet: baseCarnet,
      author: null,
      hikeSession: null,
      etapes: [baseEtape],
      moments: [],
      hebergements: [],
      kitItems: [],
      budget: budgetData,
      viewerRole: 'participant',
      viewerId: 'user-owner',
      liked: false,
      favorited: false,
    };

    const detailParticipant = buildCarnetDetail(inputParticipant);
    expect(detailParticipant.budget).not.toBeNull();
    expect(detailParticipant.budget?.total).toBe(350);

    const inputVisitor: BuildCarnetDetailInput = {
      carnet: baseCarnet,
      author: null,
      hikeSession: null,
      etapes: [baseEtape],
      moments: [],
      hebergements: [],
      kitItems: [],
      budget: budgetData,
      viewerRole: 'visitor',
      viewerId: null,
      liked: false,
      favorited: false,
    };

    const detailVisitor = buildCarnetDetail(inputVisitor);
    expect(detailVisitor.budget).toBeNull();
  });

  it('associe correctement les verdicts de matériel dans le kit', () => {
    const input: BuildCarnetDetailInput = {
      carnet: baseCarnet,
      author: null,
      hikeSession: null,
      etapes: [baseEtape],
      moments: [],
      hebergements: [],
      kitItems: [
        {
          id: 'kit-1',
          nom: 'Matelas NeoAir XLite',
          categorie: 'couchage',
          poids_g: 360,
          quantite: 1,
          porteur_label: 'Moi',
          verdict_status: 'top',
          verdict_notes: 'Confort parfait et super isolant sur la neige',
          verdict_rating: 5,
        },
        {
          id: 'kit-2',
          nom: 'Filtre BeFree',
          categorie: 'eau',
          poids_g: 65,
          quantite: 1,
          porteur_label: 'Moi',
          verdict_status: 'flop',
          verdict_notes: 'Débit réduit après 3 jours d’eau chargée',
          verdict_rating: 2,
        },
      ],
      viewerRole: 'visitor',
      viewerId: null,
      liked: false,
      favorited: false,
    };

    const detail = buildCarnetDetail(input);
    expect(Object.keys(detail.kitVerdicts ?? {})).toHaveLength(2);
    expect(detail.kitVerdicts?.['kit-1']?.verdict).toBe('top');
    expect(detail.kitVerdicts?.['kit-2']?.verdict).toBe('flop');
  });

  it('structure les réactions de jour et l’engagement des moments', () => {
    const input: BuildCarnetDetailInput = {
      carnet: baseCarnet,
      author: null,
      hikeSession: null,
      etapes: [baseEtape],
      moments: [
        {
          id: 'moment-1',
          jour_numero: 1,
          heure: '14:30',
          citation: 'Vue splendide',
          auteur_nom: 'Camille',
          lieu: 'Désert de Platé',
          image_url: 'https://example.com/plate.jpg',
          titre: 'Au sommet de Platé',
          legende: 'Vue splendide sur le massif du Mont-Blanc',
          lieu_nom: 'Désert de Platé',
          media_type: 'photo',
          media_url: 'https://example.com/plate.jpg',
          prive: false,
        },
      ],
      hebergements: [],
      kitItems: [],
      dayReactions: {
        1: { dayNumber: 1, likesCount: 14, userLiked: true, commentsCount: 3 },
      },
      momentEngagement: {
        'moment-1': {
          momentId: 'moment-1',
          likesCount: 8,
          userLiked: false,
          commentsCount: 2,
          savesCount: 5,
          userSaved: true,
        },
      },
      viewerRole: 'participant',
      viewerId: 'user-owner',
      liked: false,
      favorited: false,
    };

    const detail = buildCarnetDetail(input);
    expect(detail.dayReactions?.[1].likesCount).toBe(14);
    expect(detail.dayReactions?.[1].userLiked).toBe(true);
    expect(detail.momentEngagement?.['moment-1'].savesCount).toBe(5);
    expect(detail.momentEngagement?.['moment-1'].userSaved).toBe(true);
  });
});

describe('replyToCarnetStory', () => {
  it('envoie une réponse story avec metadata.carnet_moment_reply', async () => {
    const spyGetConv = vi
      .spyOn(messagingService, 'getOrCreateDirectConversation')
      .mockResolvedValue('conv-456');

    const spySend = vi
      .spyOn(messagingService, 'sendMessage')
      .mockResolvedValue({ id: 'msg-999' } as never);

    const res = await replyToCarnetStory({
      carnetId: 'carnet-123',
      momentId: 'moment-1',
      dayNumber: 2,
      caption: 'Bivouac au coucher du soleil',
      author: {
        id: 'author-user',
        name: 'Camille',
      },
      myUserId: 'my-user-id',
      text: 'Magnifique photo ! Quel abri utilisais-tu ?',
    });

    expect(res.ok).toBe(true);
    expect(spyGetConv).toHaveBeenCalledWith('author-user', 'my-user-id');
    expect(spySend).toHaveBeenCalledWith(
      'conv-456',
      'my-user-id',
      'Magnifique photo ! Quel abri utilisais-tu ?',
      'text',
      undefined,
      {
        carnet_moment_reply: {
          carnet_id: 'carnet-123',
          moment_id: 'moment-1',
          jour_numero: 2,
          author_id: 'author-user',
          author_name: 'Camille',
          caption: 'Bivouac au coucher du soleil',
        },
      }
    );

    spyGetConv.mockRestore();
    spySend.mockRestore();
  });

  it('refuse d’envoyer une réponse à soi-même', async () => {
    const res = await replyToCarnetStory({
      carnetId: 'carnet-123',
      momentId: 'moment-1',
      author: {
        id: 'same-user',
        name: 'Moi',
      },
      myUserId: 'same-user',
      text: 'Test',
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('vous-même');
  });
});
