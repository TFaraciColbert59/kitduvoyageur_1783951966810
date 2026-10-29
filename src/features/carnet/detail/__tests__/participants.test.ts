import { describe, expect, it } from 'vitest';
import { buildCarnetDetail, buildParticipants } from '../buildCarnetDetail';
import type { BuildCarnetDetailInput, CarnetRow, ParticipantRow } from '../types';

const CARNET: CarnetRow = {
  id: 'c1',
  author_id: 'u1',
  title: 'Trois jours dans le Vercors',
  destination: 'Vercors, France',
  description: null,
  cover_image: null,
  cover_image_alt: null,
  start_date: '2026-09-26',
  end_date: null,
  visibility: 'public',
  verified: false,
  likes_count: 0,
  comments_count: 0,
  distance_km: null,
  denivele_m: null,
  groupe_id: null,
  lieu_depart: null,
  lieu_arrivee: null,
};

const AUTHOR = { id: 'u1', full_name: 'Léa Fontaine', handle: 'lea.fontaine', avatar_url: 'a1.jpg', trust_score: 94 };

const participant = (userId: string, source: ParticipantRow['source'], profile: ParticipantRow['profile'] = null) =>
  ({ user_id: userId, source, profile }) satisfies ParticipantRow;

function input(overrides: Partial<BuildCarnetDetailInput> = {}): BuildCarnetDetailInput {
  return {
    carnet: CARNET,
    author: AUTHOR,
    hikeSession: null,
    etapes: [],
    hebergements: [],
    moments: [],
    kitItems: [],
    viewerId: null,
    liked: false,
    favorited: false,
    ...overrides,
  };
}

describe('participants réels du carnet', () => {
  it('place l’auteur en premier avec le rôle author', () => {
    const participants = buildParticipants(input({ participants: [participant('u2', 'participant')] }));
    expect(participants[0]).toEqual({
      userId: 'u1',
      name: 'Léa Fontaine',
      handle: 'lea.fontaine',
      avatarUrl: 'a1.jpg',
      role: 'author',
    });
    expect(participants).toHaveLength(2);
  });

  it('dédoublonne par userId : la première occurrence gagne, l’auteur le reste', () => {
    const participants = buildParticipants(
      input({
        participants: [
          participant('u1', 'participant'),
          participant('u2', 'collaborator'),
          participant('u2', 'participant'),
          participant('u3', 'participant'),
        ],
      }),
    );
    expect(participants.map((p) => p.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(participants.map((p) => p.role)).toEqual(['author', 'collaborator', 'participant']);
  });

  it('dédoublonne aussi deux présences de la même sortie (doublons réels en base)', () => {
    const participants = buildParticipants(
      input({ participants: [participant('u4', 'participant'), participant('u4', 'participant')] }),
    );
    expect(participants.filter((p) => p.userId === 'u4')).toHaveLength(1);
  });

  it('n’expose aucun liker, même quand les likes existent', () => {
    const detail = buildCarnetDetail(
      input({
        likers: [
          { user_id: 'u9', reaction: 'like', profile: { id: 'u9', full_name: 'Liker', handle: 'liker', avatar_url: null, trust_score: 0 } },
        ],
        participants: [participant('u2', 'participant')],
      }),
    );
    expect(detail.likers.map((l) => l.id)).toEqual(['u9']);
    expect(detail.participants.map((p) => p.userId)).toEqual(['u1', 'u2']);
  });

  it('un carnet sans collaborateur ni sortie ne montre que l’auteur', () => {
    const detail = buildCarnetDetail(input());
    expect(detail.participants).toHaveLength(1);
    expect(detail.participants[0]).toMatchObject({ userId: 'u1', role: 'author' });
  });

  it('garde une entrée minimale quand le profil public manque', () => {
    const detail = buildCarnetDetail(input({ participants: [participant('u5', 'participant', null)] }));
    expect(detail.participants).toHaveLength(2);
    expect(detail.participants[1]).toEqual({
      userId: 'u5',
      name: null,
      handle: null,
      avatarUrl: null,
      role: 'participant',
    });
  });

  it('ignore une ligne de participation sans user_id', () => {
    const detail = buildCarnetDetail(
      input({ participants: [{ user_id: null, source: 'participant', profile: null }] }),
    );
    expect(detail.participants.map((p) => p.userId)).toEqual(['u1']);
  });

  it('sans auteur lisible, les collaborateurs restent les seuls participants', () => {
    const detail = buildCarnetDetail(
      input({
        author: null,
        carnet: { ...CARNET, author_id: null },
        participants: [
          participant('u2', 'collaborator', { id: 'u2', full_name: 'Noé Vidal', handle: 'noe', avatar_url: null, trust_score: 0 }),
        ],
      }),
    );
    expect(detail.participants.map((p) => p.userId)).toEqual(['u2']);
    expect(detail.participants[0].role).toBe('collaborator');
  });
});
