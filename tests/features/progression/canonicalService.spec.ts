import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import {
  getProgressionProfile,
  getTerritorialLeaderboard,
} from '@/features/progression/server/progressionService';

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };
const USER_ID = '11111111-1111-4111-8111-111111111111';

const RULES_PAYLOAD = {
  levels: [
    { level: 1, min_points: 0, title: 'Randonneur Curieux' },
    { level: 2, min_points: 100, title: 'Marcheur Averti' },
    { level: 3, min_points: 300, title: 'Arpenteur des Bois' },
    { level: 5, min_points: 1500, title: 'Navigateur Alpin' },
    { level: 10, min_points: 20000, title: 'Gardien des Horizons' },
  ],
  min_participants: 5,
};

interface TableState {
  data: unknown;
  error: { message: string } | null;
}

interface RpcState {
  data: unknown;
  error: { message: string } | null;
}

function createSupabaseMock(
  state: Record<string, TableState | undefined>,
  rpcState?: Record<string, RpcState | undefined>
) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const result = state[table] ?? { data: null, error: null };
      builder.select = (...args: unknown[]) => {
        calls.push(['select', table, ...args]);
        return builder;
      };
      builder.eq = (...args: unknown[]) => {
        calls.push(['eq', table, ...args]);
        return builder;
      };
      builder.order = (...args: unknown[]) => {
        calls.push(['order', table, ...args]);
        return builder;
      };
      builder.limit = (...args: unknown[]) => {
        calls.push(['limit', table, ...args]);
        return builder;
      };
      builder.maybeSingle = async () => ({ data: result.data, error: result.error });
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve({ data: result.data, error: result.error }).then(resolve, reject);
      return builder;
    },
    ...(rpcState
      ? {
          rpc: (name: string, params: unknown) => {
            calls.push(['rpc', name, params]);
            const result = rpcState[name] ?? { data: null, error: null };
            return Promise.resolve({ data: result.data, error: result.error });
          },
        }
      : {}),
  };
  return { client, calls };
}

function useMock(
  state: Record<string, TableState | undefined>,
  rpcState?: Record<string, RpcState | undefined>
) {
  const mock = createSupabaseMock(state, rpcState);
  mockedCreateClient.mockReturnValue(mock.client as never);
  return mock;
}

const EMPTY_TABLES: Record<string, TableState> = {
  user_progression: { data: null, error: null },
  user_profiles: { data: null, error: null },
  user_territory: { data: null, error: null },
  progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
  reward_accounts: { data: null, error: null },
};

describe('progressionService — profil honnête (zéro donnée de démonstration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://progression.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('profil vide : hasData=false, zéro point, niveau 1 lu dans les règles, rang null', async () => {
    const { calls } = useMock({ ...EMPTY_TABLES });

    const profile = await getProgressionProfile(USER_ID);

    expect(profile.hasData).toBe(false);
    expect(profile.points).toEqual({ lifetime: 0, season: 0, seasonId: null });
    expect(profile.level).toEqual({
      level: 1,
      title: 'Randonneur Curieux',
      nextLevelPoints: 100,
      progressPct: 0,
    });
    expect(profile.challenge).toBeNull();
    expect(profile.leaderboardRank).toBeNull();
    expect(profile.usableBalance).toBeNull();
    expect(profile.updatedAt).toBeNull();
    expect(profile.territory).toBeNull();
    expect(calls).toContainEqual(['eq', 'user_progression', 'user_id', USER_ID]);
    expect(calls).toContainEqual(['eq', 'progression_rules', 'active', true]);

    const serialized = JSON.stringify(profile);
    for (const marker of ['user_demo', 'DEMO_', 'Chamonix', 'chal_exp_01']) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('profil réel : projette les lignes serveur sans inventer de valeurs', async () => {
    useMock({
      user_progression: {
        data: {
          user_id: USER_ID,
          lifetime_points: 420,
          season_points: 120,
          level: 3,
          level_title: 'Arpenteur des Bois',
          skill_explorer_points: 30,
          skill_preparer_points: 10,
          skill_partager_points: 0,
          skill_entraider_points: 0,
          current_season_id: 'saison-reelle',
          current_challenge_id: null,
          challenge_progress: 0,
          challenge_replaced_at: null,
          updated_at: '2026-09-19T10:00:00.000Z',
        },
        error: null,
      },
      user_season_progress: {
        data: { season_id: 'saison-reelle', season_points: 120 },
        error: null,
      },
      user_profiles: { data: { full_name: 'Camille', avatar_url: null }, error: null },
      user_territory: {
        data: {
          city_name: 'Grenoble',
          city_code: '38185',
          region_code: '84',
          country_code: 'FR',
        },
        error: null,
      },
      progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
      reward_accounts: { data: { available_points: 30 }, error: null },
    });

    const profile = await getProgressionProfile(USER_ID);

    expect(profile.hasData).toBe(true);
    expect(profile.points).toEqual({
      lifetime: 420,
      season: 120,
      seasonId: 'saison-reelle',
    });
    expect(profile.level.level).toBe(3);
    expect(profile.level.title).toBe('Arpenteur des Bois');
    expect(profile.usableBalance).toBe(30);
    expect(profile.displayName).toBe('Camille');
    expect(profile.territory?.cityName).toBe('Grenoble');
    expect(profile.updatedAt).toBe('2026-09-19T10:00:00.000Z');
    expect(profile.skills.explorer.points).toBe(30);
    expect(profile.skills.explorer.pct).toBe(75);
  });

  it('sans saison réelle, les points de saison valent 0 et jamais 65 % du cumul', async () => {
    useMock({
      ...EMPTY_TABLES,
      user_progression: {
        data: {
          user_id: USER_ID,
          lifetime_points: 1000,
          season_points: 0,
          level: 1,
          level_title: null,
          skill_explorer_points: 0,
          skill_preparer_points: 0,
          skill_partager_points: 0,
          skill_entraider_points: 0,
          current_season_id: null,
          current_challenge_id: null,
          challenge_progress: 0,
          challenge_replaced_at: null,
          updated_at: null,
        },
        error: null,
      },
    });

    const profile = await getProgressionProfile(USER_ID);

    expect(profile.points.lifetime).toBe(1000);
    expect(profile.points.season).toBe(0);
    expect(profile.points.seasonId).toBeNull();
  });

  it('erreur serveur : refuse de présenter un profil vide comme une vérité', async () => {
    useMock({
      ...EMPTY_TABLES,
      user_progression: { data: null, error: { message: 'relation indisponible' } },
    });

    await expect(getProgressionProfile(USER_ID)).rejects.toBeTruthy();
  });

  it('configuration serveur absente : erreur explicite, aucun client créé', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(getProgressionProfile(USER_ID)).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});

describe('progressionService — classement territorial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://progression.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('agrégat absent (P1) : rows vides, communauté en formation, refreshedAt null', async () => {
    useMock({
      progression_rules: {
        data: { payload: { ...RULES_PAYLOAD, min_participants: 7 } },
        error: null,
      },
      progression_leaderboard_agg: {
        data: null,
        error: { message: 'relation "public.progression_leaderboard_agg" does not exist' },
      },
    });

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'world');

    expect(leaderboard.rows).toEqual([]);
    expect(leaderboard.totalParticipants).toBe(0);
    expect(leaderboard.communityForming).toBe(true);
    expect(leaderboard.minParticipants).toBe(7);
    expect(leaderboard.refreshedAt).toBeNull();
  });

  it('agrégat réel : alias et rangs exposés, aucun UUID dans le payload', async () => {
    useMock({
      progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
      progression_leaderboard_agg: {
        data: [
          { user_id: 'uuid-autre', season_points: 90, level: 2, alias: 'Autre' },
          { user_id: USER_ID, season_points: 30, level: 1, alias: null },
        ],
        error: null,
      },
    });

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'city');

    expect(leaderboard.rows).toHaveLength(2);
    expect(leaderboard.rows[0]).toMatchObject({
      rank: 1,
      alias: 'Autre',
      seasonPoints: 90,
      isCurrentUser: false,
    });
    expect(leaderboard.rows[1].isCurrentUser).toBe(true);
    expect(leaderboard.rows[1].alias).toBeNull();
    expect(leaderboard.communityForming).toBe(true);

    const serialized = JSON.stringify(leaderboard);
    expect(serialized).not.toContain('uuid-autre');
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain('"user_id"');
  });

  it('RPC disponible : mappe le payload serveur, jamais d’UUID, rang fourni', async () => {
    const { calls } = useMock(
      {
        progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
      },
      {
        get_leaderboard: {
          data: {
            rows: [
              {
                alias: 'Voyageur abc123',
                level: 3,
                level_title: 'Arpenteur des Bois',
                season_points: 300,
                rank: 1,
                is_current_user: false,
              },
              {
                alias: 'Voyageur def456',
                level: 2,
                level_title: 'Marcheur Averti',
                season_points: 100,
                rank: 2,
                is_current_user: true,
              },
            ],
            total_participants: 2,
            community_forming: true,
            min_participants: 5,
            refreshed_at: '2026-09-19T12:00:00.000Z',
            rank: 2,
          },
          error: null,
        },
      }
    );

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'around_me', {
      limit: 10,
      cursor: { points: 500, userId: USER_ID },
    });

    expect(leaderboard.filter).toBe('around_me');
    expect(leaderboard.rows).toHaveLength(2);
    expect(leaderboard.rows[0]).toEqual({
      rank: 1,
      alias: 'Voyageur abc123',
      level: 3,
      levelTitle: 'Arpenteur des Bois',
      seasonPoints: 300,
      isCurrentUser: false,
    });
    expect(leaderboard.rows[1].isCurrentUser).toBe(true);
    expect(leaderboard.rank).toBe(2);
    expect(leaderboard.totalParticipants).toBe(2);
    expect(leaderboard.communityForming).toBe(true);
    expect(leaderboard.refreshedAt).toBe('2026-09-19T12:00:00.000Z');
    expect(calls).toContainEqual([
      'rpc',
      'get_leaderboard',
      {
        p_user_id: USER_ID,
        p_filter: 'local',
        p_limit: 10,
        p_cursor_points: 500,
        p_cursor_user: USER_ID,
      },
    ]);

    const serialized = JSON.stringify(leaderboard);
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain('"user_id"');
    expect(serialized).not.toContain('lat');
  });

  it('RPC local sous flag off : local_unavailable + reason, aucune ligne inventée', async () => {
    useMock(
      {
        progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
      },
      {
        get_leaderboard: {
          data: {
            rows: [],
            total_participants: 0,
            community_forming: true,
            min_participants: 5,
            refreshed_at: null,
            rank: null,
            local_unavailable: true,
            reason: 'flag_off',
          },
          error: null,
        },
      }
    );

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'around_me');

    expect(leaderboard.rows).toEqual([]);
    expect(leaderboard.communityForming).toBe(true);
    expect(leaderboard.localUnavailable).toBe(true);
    expect(leaderboard.reason).toBe('flag_off');
  });

  it('RPC rate limited : erreur explicite sans données', async () => {
    useMock(
      {
        progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
      },
      {
        get_leaderboard: {
          data: { error: 'rate_limited' },
          error: null,
        },
      }
    );

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'around_me');

    expect(leaderboard.error).toBe('rate_limited');
    expect(leaderboard.rows).toEqual([]);
    expect(leaderboard.totalParticipants).toBe(0);
  });

  it('RPC absente + filtre 1 km : jamais d’élargissement silencieux', async () => {
    useMock({
      progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
      progression_leaderboard_agg: {
        data: [{ user_id: USER_ID, season_points: 90, level: 2, alias: 'Voyageur' }],
        error: null,
      },
    });

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'around_me');

    expect(leaderboard.rows).toEqual([]);
    expect(leaderboard.totalParticipants).toBe(0);
    expect(leaderboard.localUnavailable).toBe(true);
    expect(leaderboard.reason).toBe('rpc_unavailable');
  });

  it('RPC en erreur : repli honnête sur la lecture tolérante des agrégats', async () => {
    const { calls } = useMock(
      {
        progression_rules: { data: { payload: RULES_PAYLOAD }, error: null },
        progression_leaderboard_agg: {
          data: [{ user_id: USER_ID, season_points: 30, level: 1, alias: 'Voyageur' }],
          error: null,
        },
      },
      {
        get_leaderboard: { data: null, error: { message: 'relation absente' } },
      }
    );

    const leaderboard = await getTerritorialLeaderboard(USER_ID, 'world');

    expect(leaderboard.rows).toHaveLength(1);
    expect(leaderboard.rows[0].isCurrentUser).toBe(true);
    expect(calls).toContainEqual([
      'rpc',
      'get_leaderboard',
      {
        p_user_id: USER_ID,
        p_filter: 'world',
        p_limit: 50,
        p_cursor_points: null,
        p_cursor_user: null,
      },
    ]);
  });
});

describe('progression — invariants du code de production', () => {
  it('aucune chaîne de démonstration dans le code de production de progression', () => {
    const productionFiles = [
      'src/features/progression/server/progressionService.ts',
      'src/features/progression/server/progressionDto.ts',
      'src/features/progression/domain/types.ts',
      'src/app/api/progression/route.ts',
      'src/app/api/progression/leaderboard/route.ts',
      'src/app/api/progression/territory/route.ts',
      'src/app/api/progression/challenge/replace/route.ts',
      'src/components/progression/MaProgressionView.tsx',
    ];

    for (const file of productionFiles) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/user_demo|DEMO_|Chamonix|chal_exp_01/);
      expect(source, file).not.toMatch(/\?\?\s*380/);
      expect(source, file).not.toMatch(/0\.65\s*\*/);
    }
  });
});
