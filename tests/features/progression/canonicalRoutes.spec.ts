import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/features/progression/server/progressionService', () => ({
  getProgressionProfile: vi.fn(),
  getTerritorialLeaderboard: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  getProgressionProfile,
  getTerritorialLeaderboard,
} from '@/features/progression/server/progressionService';
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

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
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

    const response = await territoryPOST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
  });

  it('POST /api/progression/challenge/replace sans session → 401 unauthorized', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await challengePOST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
  });

  it('POST /api/progression/territory authentifié → 501 not_implemented_p3', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await territoryPOST();

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ success: false, error: 'not_implemented_p3' });
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
    expect(mockedLeaderboard).toHaveBeenCalledWith(USER_ID, 'region');
  });

  it('GET /api/progression/leaderboard authentifié → filtre invalide ramené à world', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedLeaderboard.mockResolvedValue(LEADERBOARD);

    const response = await leaderboardGET(
      new NextRequest('http://localhost/api/progression/leaderboard?filter=galaxie')
    );

    expect(response.status).toBe(200);
    expect(mockedLeaderboard).toHaveBeenCalledWith(USER_ID, 'world');
  });
});
