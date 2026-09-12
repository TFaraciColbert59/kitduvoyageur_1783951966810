/**
 * Phase 2 — Projection serveur `getTripExperience` : chaîne complète
 * voyage → plan → version → route → kit → session → carnet → publication,
 * corrélation unifiée et maillons absents sans invention.
 *
 *   • TEST-PHASE2-EXP-01 : chaîne complète lue avec le client de session (RLS)
 *   • TEST-PHASE2-EXP-02 : non authentifié / id invalide / voyage introuvable
 *   • TEST-PHASE2-EXP-03 : maillons absents ⇒ null, jamais d'objet inventé
 *   • TEST-PHASE2-EXP-04 : corrélation de repli session quand le plan est froid
 *   • TEST-PHASE2-EXP-05 : erreur de lecture du voyage ⇒ null tracé
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getTripExperience } from '@/features/trips/server/getTripExperience';

const USER_ID = 'f2e00000-0000-4000-8000-000000000001';
const TRIP_ID = 'f2e00000-0000-4000-8000-000000000002';
const PLAN_ID = 'f2e00000-0000-4000-8000-000000000003';
const VERSION_ID = 'f2e00000-0000-4000-8000-000000000004';
const CARNET_ID = 'f2e00000-0000-4000-8000-000000000005';
const SESSION_ID = 'f2e00000-0000-4000-8000-000000000006';
const POST_ID = 'f2e00000-0000-4000-8000-000000000007';
const KIT_ID = 'f2e00000-0000-4000-8000-000000000008';
const CORRELATION_ID = 'f2e00000-0000-4000-8000-000000000009';

type Result = { data: unknown; error: unknown };
type Handler = (filters: Record<string, unknown>) => Result;

function chainFor(table: string, handlers: Record<string, Handler>, filters: Record<string, unknown>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return chain;
    }),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () =>
      handlers[table] ? handlers[table](filters) : { data: null, error: null }
    ),
  };
  return chain;
}

function mockSupabase(
  handlers: Record<string, Handler>,
  user: { id: string } | null = { id: USER_ID }
) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn((table: string) => {
        calls.push(table);
        return chainFor(table, handlers, {});
      }),
    },
  };
}

describe('Phase 2 — projection TripExperience (TEST-PHASE2-EXP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('TEST-PHASE2-EXP-01: lit la chaîne complète avec le client de session', async () => {
    const handlers: Record<string, Handler> = {
      trips: () => ({
        data: {
          id: TRIP_ID,
          slug: 'traversee-phase2',
          title: 'Traversée Phase 2',
          status: 'active',
          kit_id: KIT_ID,
        },
        error: null,
      }),
      adventure_plans: () => ({
        data: {
          id: PLAN_ID,
          current_version: 3,
          selected_route_id: 920000001,
          correlation_id: CORRELATION_ID,
        },
        error: null,
      }),
      adventure_plan_versions: () => ({ data: { id: VERSION_ID, version: 3 }, error: null }),
      hiking_routes: () => ({ data: { name: 'Arête du Phase 2' }, error: null }),
      carnets: () => ({
        data: { id: CARNET_ID, title: 'Carnet Phase 2', correlation_id: CORRELATION_ID },
        error: null,
      }),
      hike_sessions: () => ({ data: { id: SESSION_ID, correlation_id: CORRELATION_ID }, error: null }),
      community_posts: () => ({ data: { id: POST_ID, correlation_id: CORRELATION_ID }, error: null }),
    };
    const { client, calls } = mockSupabase(handlers);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const experience = await getTripExperience(TRIP_ID);

    expect(experience).toEqual({
      trip_id: TRIP_ID,
      slug: 'traversee-phase2',
      title: 'Traversée Phase 2',
      status: 'active',
      kit_id: KIT_ID,
      adventure_plan_id: PLAN_ID,
      plan_version_id: VERSION_ID,
      plan_version: 3,
      selected_route_id: 920000001,
      route_name: 'Arête du Phase 2',
      hike_session_id: SESSION_ID,
      journal_id: CARNET_ID,
      journal_title: 'Carnet Phase 2',
      community_post_id: POST_ID,
      correlation_id: CORRELATION_ID,
    });
    expect(calls).toContain('trips');
    expect(calls).toContain('adventure_plans');
    expect(calls).toContain('hike_sessions');
    expect(calls).toContain('community_posts');
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('TEST-PHASE2-EXP-02: non authentifié, id invalide ou voyage introuvable ⇒ null', async () => {
    const anonymous = mockSupabase({}, null);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(anonymous.client);

    await expect(getTripExperience(TRIP_ID)).resolves.toBeNull();
    expect(anonymous.client.from).not.toHaveBeenCalled();

    const invalid = await getTripExperience('pas-un-uuid');
    expect(invalid).toBeNull();

    const noTrip = mockSupabase({ trips: () => ({ data: null, error: null }) });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(noTrip.client);
    await expect(getTripExperience(TRIP_ID)).resolves.toBeNull();
  });

  it('TEST-PHASE2-EXP-03: plan et carnet absents ⇒ maillons null sans invention', async () => {
    const handlers: Record<string, Handler> = {
      trips: () => ({
        data: {
          id: TRIP_ID,
          slug: 'voyage-frais',
          title: 'Voyage frais',
          status: 'draft',
          kit_id: null,
        },
        error: null,
      }),
      adventure_plans: () => ({ data: null, error: null }),
      carnets: () => ({ data: null, error: null }),
    };
    const { client, calls } = mockSupabase(handlers);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const experience = await getTripExperience(TRIP_ID);

    expect(experience).toEqual({
      trip_id: TRIP_ID,
      slug: 'voyage-frais',
      title: 'Voyage frais',
      status: 'draft',
      kit_id: null,
      adventure_plan_id: null,
      plan_version_id: null,
      plan_version: null,
      selected_route_id: null,
      route_name: null,
      hike_session_id: null,
      journal_id: null,
      journal_title: null,
      community_post_id: null,
      correlation_id: null,
    });
    expect(calls).not.toContain('adventure_plan_versions');
    expect(calls).not.toContain('hike_sessions');
    expect(calls).not.toContain('community_posts');
  });

  it('TEST-PHASE2-EXP-04: corrélation de repli session et publication par corrélation', async () => {
    const handlers: Record<string, Handler> = {
      trips: () => ({
        data: {
          id: TRIP_ID,
          slug: 'voyage-correle',
          title: 'Voyage corrélé',
          status: 'active',
          kit_id: null,
        },
        error: null,
      }),
      adventure_plans: () => ({
        data: {
          id: PLAN_ID,
          current_version: 1,
          selected_route_id: 920000002,
          correlation_id: null,
        },
        error: null,
      }),
      adventure_plan_versions: () => ({ data: { id: VERSION_ID, version: 1 }, error: null }),
      hiking_routes: () => ({ data: { name: 'Route corrélée' }, error: null }),
      carnets: () => ({ data: null, error: null }),
      hike_sessions: (filters) => {
        if (filters.route_id === 920000002) {
          return { data: { id: SESSION_ID, correlation_id: CORRELATION_ID }, error: null };
        }
        return { data: null, error: null };
      },
      community_posts: (filters) => {
        if (filters.correlation_id === CORRELATION_ID) {
          return { data: { id: POST_ID, correlation_id: CORRELATION_ID }, error: null };
        }
        return { data: null, error: null };
      },
    };
    const { client } = mockSupabase(handlers);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const experience = await getTripExperience(TRIP_ID);

    expect(experience?.correlation_id).toBe(CORRELATION_ID);
    expect(experience?.hike_session_id).toBe(SESSION_ID);
    expect(experience?.community_post_id).toBe(POST_ID);
    expect(experience?.journal_id).toBeNull();
  });

  it('TEST-PHASE2-EXP-05: erreur de lecture du voyage ⇒ null tracé', async () => {
    const handlers: Record<string, Handler> = {
      trips: () => ({ data: null, error: { message: 'boom' } }),
    };
    const { client } = mockSupabase(handlers);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    await expect(getTripExperience(TRIP_ID)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
