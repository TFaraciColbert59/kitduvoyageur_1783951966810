import { describe, it, expect } from 'vitest';
import {
  buildProgressionProfile,
  buildTerritorialLeaderboardDto,
  parseProgressionRules,
  resolveLevel,
  type ChallengeRow,
  type UserProgressionRow,
} from '@/features/progression/server/progressionDto';

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

const RULES = parseProgressionRules(RULES_PAYLOAD);

function emptyProfileInput() {
  return {
    userId: 'profil-vide',
    progression: null,
    season: null,
    account: null,
    profile: null,
    territory: null,
    challenge: null,
    rules: RULES,
  };
}

function progressionRow(overrides: Partial<UserProgressionRow> = {}): UserProgressionRow {
  return {
    user_id: 'profil-vide',
    lifetime_points: 0,
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
    ...overrides,
  };
}

describe('progressionDto — règles versionnées', () => {
  it('lit les paliers et le seuil de participants depuis le payload réel', () => {
    const snapshot = parseProgressionRules({ ...RULES_PAYLOAD, min_participants: 12 });

    expect(snapshot.levels).toHaveLength(5);
    expect(snapshot.levels[0]).toEqual({ level: 1, min_points: 0, title: 'Randonneur Curieux' });
    expect(snapshot.minParticipants).toBe(12);
  });

  it('retombe sur un seuil de 5 sans inventer de niveaux quand le payload est absent', () => {
    const snapshot = parseProgressionRules(null);

    expect(snapshot.levels).toEqual([]);
    expect(snapshot.minParticipants).toBe(5);
  });

  it('ignore les paliers incomplets plutôt que de fabriquer un titre', () => {
    const snapshot = parseProgressionRules({
      levels: [{ level: 2, min_points: 100 }, { level: 'x', min_points: 50, title: 'Faux' }],
      min_participants: 5,
    });

    expect(snapshot.levels).toEqual([]);
  });
});

describe('progressionDto — niveau canonique', () => {
  it('résout le titre depuis les règles pour 0 point', () => {
    const level = resolveLevel(RULES.levels, 0);

    expect(level.level).toBe(1);
    expect(level.title).toBe('Randonneur Curieux');
    expect(level.nextLevelPoints).toBe(100);
    expect(level.progressPct).toBe(0);
  });

  it('calcule la progression vers le palier suivant', () => {
    const level = resolveLevel(RULES.levels, 1500);

    expect(level.level).toBe(5);
    expect(level.title).toBe('Navigateur Alpin');
    expect(level.nextLevelPoints).toBe(20000);
    expect(level.progressPct).toBe(0);
  });

  it('plafonne au niveau maximum avec 100 % de progression', () => {
    const level = resolveLevel(RULES.levels, 25000);

    expect(level.level).toBe(10);
    expect(level.title).toBe('Gardien des Horizons');
    expect(level.nextLevelPoints).toBeNull();
    expect(level.progressPct).toBe(100);
  });

  it('reste honnête sans règles : niveau 1, titre inconnu, aucun seuil inventé', () => {
    const level = resolveLevel([], 900);

    expect(level).toEqual({ level: 1, title: null, nextLevelPoints: null, progressPct: 0 });
  });

  it('borne les points négatifs à zéro', () => {
    expect(resolveLevel(RULES.levels, -50).level).toBe(1);
    expect(resolveLevel(RULES.levels, -50).progressPct).toBe(0);
  });
});

describe('progressionDto — profil utilisateur', () => {
  it('profil vide : hasData=false, zéro point, rang null, aucun défi', () => {
    const profile = buildProgressionProfile(emptyProfileInput());

    expect(profile.hasData).toBe(false);
    expect(profile.points).toEqual({ lifetime: 0, season: 0, seasonId: null });
    expect(profile.level).toEqual({
      level: 1,
      title: 'Randonneur Curieux',
      nextLevelPoints: 100,
      progressPct: 0,
    });
    expect(Object.values(profile.skills).map((skill) => skill.points)).toEqual([0, 0, 0, 0]);
    expect(Object.values(profile.skills).map((skill) => skill.pct)).toEqual([0, 0, 0, 0]);
    expect(profile.challenge).toBeNull();
    expect(profile.leaderboardRank).toBeNull();
    expect(profile.usableBalance).toBeNull();
    expect(profile.updatedAt).toBeNull();
    expect(profile.territory).toBeNull();
    expect(profile.displayName).toBeNull();
    expect(profile.avatarUrl).toBeNull();
  });

  it('profil réel : lit les projections sans répartir de points de démonstration', () => {
    const challenge: ChallengeRow = {
      id: 'chal_canonique',
      title: 'Défi canonique',
      description: 'Défi issu du catalogue réel.',
      skill: 'explorer',
      points_reward: 50,
      difficulty: 'facile',
      target_progress: 2,
      unit: 'sentier',
    };

    const profile = buildProgressionProfile({
      userId: 'profil-reel',
      progression: progressionRow({
        user_id: 'profil-reel',
        lifetime_points: 420,
        season_points: 120,
        level: 3,
        level_title: 'Arpenteur des Bois',
        skill_explorer_points: 30,
        skill_preparer_points: 10,
        current_season_id: 'saison-reelle',
        current_challenge_id: 'chal_canonique',
        challenge_progress: 1,
        updated_at: '2026-09-19T10:00:00.000Z',
      }),
      season: { season_id: 'saison-reelle', season_points: 120 },
      account: { available_points: 30 },
      profile: { full_name: 'Camille', avatar_url: null },
      territory: {
        city_name: 'Grenoble',
        city_code: '38185',
        region_code: '84',
        country_code: 'FR',
      },
      challenge,
      rules: RULES,
    });

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
    expect(profile.updatedAt).toBe('2026-09-19T10:00:00.000Z');
    expect(profile.territory).toEqual({
      cityName: 'Grenoble',
      cityCode: '38185',
      regionCode: '84',
      countryCode: 'FR',
    });
    expect(profile.skills.explorer.points).toBe(30);
    expect(profile.skills.explorer.pct).toBe(75);
    expect(profile.skills.preparer.points).toBe(10);
    expect(profile.skills.preparer.pct).toBe(25);
    expect(profile.skills.partager.pct).toBe(0);
    expect(profile.challenge?.id).toBe('chal_canonique');
    expect(profile.challenge?.isCompleted).toBe(false);
  });

  it('sans saison réelle, les points de saison restent à zéro (jamais 65 % du cumul)', () => {
    const profile = buildProgressionProfile({
      ...emptyProfileInput(),
      progression: progressionRow({ lifetime_points: 1000, season_points: 0 }),
    });

    expect(profile.hasData).toBe(true);
    expect(profile.points.lifetime).toBe(1000);
    expect(profile.points.season).toBe(0);
    expect(profile.points.seasonId).toBeNull();
    expect(profile.level.level).toBe(1);
  });

  it('ignore un défi dont la compétence ou la difficulté est inconnue', () => {
    const profile = buildProgressionProfile({
      ...emptyProfileInput(),
      progression: progressionRow({ current_challenge_id: 'chal_inconnu' }),
      challenge: {
        id: 'chal_inconnu',
        title: 'Défi',
        description: 'Défi',
        skill: 'teleporter',
        points_reward: 50,
        difficulty: 'facile',
        target_progress: 1,
        unit: 'action',
      },
    });

    expect(profile.challenge).toBeNull();
  });
});

describe('progressionDto — classement territorial', () => {
  it('classement vide : rows vides, communauté en formation, refresh inconnu', () => {
    const leaderboard = buildTerritorialLeaderboardDto({
      filter: 'world',
      rows: [],
      currentUserId: 'moi',
      minParticipants: 5,
      levels: RULES.levels,
      refreshedAt: null,
    });

    expect(leaderboard.rows).toEqual([]);
    expect(leaderboard.totalParticipants).toBe(0);
    expect(leaderboard.communityForming).toBe(true);
    expect(leaderboard.minParticipants).toBe(5);
    expect(leaderboard.refreshedAt).toBeNull();
  });

  it('classe par points puis identifiant sans exposer d’UUID dans les lignes', () => {
    const leaderboard = buildTerritorialLeaderboardDto({
      filter: 'city',
      rows: [
        { user_id: 'uuid-alpha', season_points: 100, level: 2, alias: 'Alpha' },
        { user_id: 'uuid-beta', season_points: 300, level: 5, alias: 'Beta' },
        { user_id: 'moi', season_points: 300, level: 1, alias: null },
      ],
      currentUserId: 'moi',
      minParticipants: 5,
      levels: RULES.levels,
      refreshedAt: '2026-09-19T12:00:00.000Z',
    });

    expect(leaderboard.rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(leaderboard.rows.map((row) => row.alias)).toEqual([null, 'Beta', 'Alpha']);
    expect(leaderboard.rows[0].seasonPoints).toBe(300);
    expect(leaderboard.rows[0].levelTitle).toBe('Randonneur Curieux');
    expect(leaderboard.rows[0].isCurrentUser).toBe(true);
    expect(leaderboard.rows[1].levelTitle).toBe('Navigateur Alpin');
    expect(leaderboard.rows[1].isCurrentUser).toBe(false);
    expect(leaderboard.rows[2].levelTitle).toBe('Marcheur Averti');
    expect(leaderboard.minParticipants).toBe(5);
    expect(leaderboard.refreshedAt).toBe('2026-09-19T12:00:00.000Z');

    const serialized = JSON.stringify(leaderboard);
    expect(serialized).not.toContain('uuid-alpha');
    expect(serialized).not.toContain('uuid-beta');
    expect(serialized).not.toContain('"user_id"');
  });

  it('masque le titre de niveau inconnu au lieu de le déduire', () => {
    const leaderboard = buildTerritorialLeaderboardDto({
      filter: 'world',
      rows: [{ user_id: 'inconnu', season_points: 10, level: 42, alias: 'Inconnu' }],
      currentUserId: 'moi',
      minParticipants: 1,
      levels: RULES.levels,
      refreshedAt: null,
    });

    expect(leaderboard.rows[0].level).toBe(42);
    expect(leaderboard.rows[0].levelTitle).toBeNull();
    expect(leaderboard.communityForming).toBe(false);
  });
});
