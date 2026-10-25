/**
 * T16 — rythme choisi :
 *   (a) semaine ISO UTC (frontière du lundi) ;
 *   (b) objectif atteint / non atteint, borné visuellement, sans pénalité ;
 *   (c) pause : objectif masqué, aucune perte (préférence intacte) ;
 *   (d) route préférences : 401, 400, 200 nominal, identité de session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/features/progression/server/rhythmService', () => ({
  getProgressionRhythm: vi.fn(),
  updateProgressionRhythm: vi.fn(),
}));

import {
  computeWeeklyRhythmProgress,
  isoWeekKeyUtc,
} from '@/features/progression/domain/rhythm';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  getProgressionRhythm,
  updateProgressionRhythm,
} from '@/features/progression/server/rhythmService';
import { GET, POST } from '@/app/api/progression/preferences/route';

const ORIGINAL_ENV = { ...process.env };
const SESSION_USER = '22222222-2222-4222-8222-222222222222';

describe('rythme — domaine', () => {
  it('(a) clé de semaine ISO UTC : lundi 00:00 UTC change de semaine', () => {
    // 2026-10-11 est un dimanche ; 2026-10-12 est le lundi suivant.
    expect(isoWeekKeyUtc(new Date('2026-10-11T23:59:59Z'))).toBe('2026-W41');
    expect(isoWeekKeyUtc(new Date('2026-10-12T00:00:00Z'))).toBe('2026-W42');
  });

  it('(b) objectif : compte la semaine courante, borne la présentation, pas de pénalité', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    const { weekly } = {
      weekly: computeWeeklyRhythmProgress(
        { rhythmId: 'regulier', paused: false },
        [
          '2026-10-05T08:00:00Z',
          '2026-10-06T18:30:00Z',
          '2026-10-12T07:00:00Z', // semaine suivante
          'pas-une-date',
        ],
        now
      ),
    };
    expect(weekly).toEqual({ target: 2, done: 2, atGoal: true, paused: false });

    const under = computeWeeklyRhythmProgress(
      { rhythmId: 'intense', paused: false },
      ['2026-10-05T08:00:00Z'],
      now
    );
    expect(under).toEqual({ target: 3, done: 1, atGoal: false, paused: false });
  });

  it('(c) pause : objectif masqué, préférence intacte (aucune perte)', () => {
    const preference = { rhythmId: 'regulier' as const, paused: true };
    const weekly = computeWeeklyRhythmProgress(
      preference,
      ['2026-10-05T08:00:00Z', '2026-10-06T08:00:00Z'],
      new Date('2026-10-07T12:00:00Z')
    );
    expect(weekly.paused).toBe(true);
    expect(weekly.done).toBe(0);
    expect(preference.rhythmId).toBe('regulier');
  });

  it('(c2) sans objectif choisi : aucune cible, aucune obligation', () => {
    const weekly = computeWeeklyRhythmProgress({ rhythmId: null, paused: false }, [], new Date());
    expect(weekly.target).toBeNull();
    expect(weekly.atGoal).toBe(false);
  });
});

describe('route préférences', () => {
  const mockedServer = vi.mocked(createServerClient);
  const mockedRateLimit = vi.mocked(enforceRateLimit);
  const mockedGet = vi.mocked(getProgressionRhythm);
  const mockedUpdate = vi.mocked(updateProgressionRhythm);

  function request(method: 'GET' | 'POST', body?: unknown) {
    return new NextRequest('http://localhost/api/progression/preferences', {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    mockedServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: SESSION_USER } } }) },
    } as never);
    mockedRateLimit.mockResolvedValue(null as never);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('(d1) 401 sans session', async () => {
    mockedServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);
    expect((await GET()).status).toBe(401);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('(d2) POST invalide → 400 sans écriture', async () => {
    expect((await POST(request('POST', { rhythmId: 'extreme' }))).status).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('(d3) POST nominal : identité de session, pause acceptée', async () => {
    mockedUpdate.mockResolvedValue({ ok: true });
    const response = await POST(request('POST', { paused: true }));
    expect(response.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(SESSION_USER, { paused: true });
  });

  it('(d4) GET nominal renvoie préférence + semaine', async () => {
    mockedGet.mockResolvedValue({
      preference: { rhythmId: 'leger', paused: false },
      weekly: { target: 1, done: 1, atGoal: true, paused: false },
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preference.rhythmId).toBe('leger');
    expect(body.weekly.atGoal).toBe(true);
  });
});
