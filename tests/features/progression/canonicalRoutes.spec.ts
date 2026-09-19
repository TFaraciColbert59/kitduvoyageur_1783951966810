import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/features/progression/server/progressionService', () => ({
  getProgressionProfile: vi.fn(),
  getTerritorialLeaderboard: vi.fn(),
}));
vi.mock('@/features/progression/server/territoryService', () => ({
  getTerritoryState: vi.fn(),
  updateDeclaredTerritory: vi.fn(),
  updatePrivateAttachment: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  getProgressionProfile,
  getTerritorialLeaderboard,
} from '@/features/progression/server/progressionService';
import { updateDeclaredTerritory } from '@/features/progression/server/territoryService';
import { GET as progressionGET } from '@/app/api/progression/route';
import { GET as leaderboardGET } from '@/app/api/progression/leaderboard/route';
import { POST as territoryPOST } from '@/app/api/progression/territory/route';
import { POST as challengePOST } from '@/app/api/progression/challenge/replace/route';
import {
  SkillType,
  TerritorialLeaderboard,
  UserProgressionProfile,
} from '@/features/progression/domain/types';

const USER_ID = '22222222-2222-4222-8222-222222222222';

const mockedCreateClient = vi.mocked(createClient);
const mockedProfile = vi.mocked(getProgressionProfile);
const mockedLeaderboard = vi.mocked(getTerritorialLeaderboard);
const mockedDeclared = vi.mocked(updateDeclaredTerritory);

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function jsonRequest(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function skill(skillType: SkillType): UserProgressionProfile['skills'][SkillType] {
  return {
    skill: skillType,
    label: skillType,
    points: 0,
    pct: 0,
    icon: 'compass',
    description: '',
  };
}

const PROFILE: UserProgressionProfile = {
  userId: USER_ID,
  displayName: null,
  avatarUrl: null,
  hasData: false,
  points: { lifetime: 0, season: 0, seasonId: null },
  level: { level: 1, title: 'Randonneur Curieux', nextLevelPoints: 100, progressPct: 0 },
  skills: {
    explorer: skill('explorer'),
    preparer: skill('preparer'),
    partager: skill('partager'),
    entraider: skill('entraider'),
  },
  challenge: null,
  leaderboardRank: null,
  usableBalance: null,
  updatedAt: null,
  territory: null,
};

const LEADERBOARD: TerritorialLeaderboard = {
  filter: 'world',
  rows: [],
  totalParticipants: 0,
  communityForming: true,
  minParticipants: 5,
  refreshedAt: null,
};

describe('routes API progression — session et périmètre P1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/progression sans session → 401 unauthorized, service jamais appelé', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await progressionGET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
    expect(mockedProfile).not.toHaveBeenCalled();
  });

  it('GET /api/progression/leaderboard sans session → 401 unauthorized, service jamais appelé', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await leaderboardGET(
      new NextRequest('http://localhost/api/progression/leaderboard?filter=city')
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
    expect(mockedLeaderboard).not.toHaveBeenCalled();
  });

  it('POST /api/progression/territory sans session → 401 unauthorized', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await territoryPOST(jsonRequest('http://localhost/api/progression/territory'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
  });

  it('POST /api/progression/challenge/replace sans session → 401 unauthorized', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await challengePOST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
  });

  it('POST /api/progression/territory authentifié, choix manuel → upsert déclaré', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedDeclared.mockResolvedValue({
      ok: true,
      declared: {
        cityName: 'Grenoble',
        cityCode: '38185',
        regionCode: '84',
        countryCode: 'FR',
        source: 'manual',
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
    });

    const response = await territoryPOST(
      jsonRequest('http://localhost/api/progression/territory', {
        city_code: '38185',
        region_code: '84',
        country_code: 'FR',
        city_name: 'Grenoble',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      declared: {
        cityName: 'Grenoble',
        cityCode: '38185',
        regionCode: '84',
        countryCode: 'FR',
        source: 'manual',
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
    });
    expect(mockedDeclared).toHaveBeenCalledWith(USER_ID, {
      city_code: '38185',
      region_code: '84',
      country_code: 'FR',
      city_name: 'Grenoble',
    });
  });

  it('POST /api/progression/challenge/replace authentifié → 501 not_implemented_p3', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await challengePOST();

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ success: false, error: 'not_implemented_p3' });
  });

  it('GET /api/progression authentifié → 200 avec le profil canonique', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedProfile.mockResolvedValue(PROFILE);

    const response = await progressionGET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, profile: PROFILE });
    expect(mockedProfile).toHaveBeenCalledWith(USER_ID);
  });

  it('GET /api/progression/leaderboard authentifié → 200 et filtre transmis', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedLeaderboard.mockResolvedValue({ ...LEADERBOARD, filter: 'region' });

    const response = await leaderboardGET(
      new NextRequest('http://localhost/api/progression/leaderboard?filter=region')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      leaderboard: { ...LEADERBOARD, filter: 'region' },
    });
    expect(mockedLeaderboard).toHaveBeenCalledWith(USER_ID, 'region', {
      limit: 50,
      cursor: null,
    });
  });

  it('GET /api/progression/leaderboard authentifié → filtre invalide ramené à world', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedLeaderboard.mockResolvedValue(LEADERBOARD);

    const response = await leaderboardGET(
      new NextRequest('http://localhost/api/progression/leaderboard?filter=galaxie')
    );

    expect(response.status).toBe(200);
    expect(mockedLeaderboard).toHaveBeenCalledWith(USER_ID, 'world', {
      limit: 50,
      cursor: null,
    });
  });

  it('GET /api/progression/leaderboard transmet limite et curseur keyset valides', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedLeaderboard.mockResolvedValue(LEADERBOARD);

    await leaderboardGET(
      new NextRequest(
        `http://localhost/api/progression/leaderboard?filter=world&limit=10&cursor=400:${USER_ID}`
      )
    );

    expect(mockedLeaderboard).toHaveBeenCalledWith(USER_ID, 'world', {
      limit: 10,
      cursor: { points: 400, userId: USER_ID },
    });
  });

  it('GET /api/progression/leaderboard ignore un curseur malformé', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedLeaderboard.mockResolvedValue(LEADERBOARD);

    await leaderboardGET(
      new NextRequest('http://localhost/api/progression/leaderboard?cursor=abc:pas-un-uuid')
    );

    expect(mockedLeaderboard).toHaveBeenCalledWith(USER_ID, 'world', {
      limit: 50,
      cursor: null,
    });
  });
});
