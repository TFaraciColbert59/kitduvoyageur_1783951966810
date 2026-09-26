import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimTripLaunch,
  completeTripLaunch,
  failTripLaunch,
} from '@/features/trips/server/tripLaunch';

const USER = 'user-1';
const ROUTE = 4242;
const TRIP = 'trip-1';

const SECRET = 'sb_rst_super_secret_value';

function client(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  return { rpc: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })) } as never;
}

const rpcOf = (db: unknown) => (db as { rpc: ReturnType<typeof vi.fn> }).rpc;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('claimTripLaunch', () => {
  it('appelle la RPC avec user + route', async () => {
    const db = client({ data: [{ status: 'claimed', trip_id: null, slug: null, title: null }] });
    await claimTripLaunch(db, USER, ROUTE);
    expect(rpcOf(db)).toHaveBeenCalledWith('claim_trip_launch', {
      p_user_id: USER,
      p_route_id: ROUTE,
    });
  });

  it('claimed : reservation posee, aucun voyage', async () => {
    const db = client({ data: [{ status: 'claimed' }] });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({ status: 'claimed' });
  });

  it('ready : renvoie le voyage gagnant', async () => {
    const db = client({ data: [{ status: 'ready', trip_id: TRIP, slug: 's', title: 't' }] });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({
      status: 'ready',
      trip: { tripId: TRIP, slug: 's', title: 't' },
    });
  });

  it('in_progress : une preparation concurrente est en cours', async () => {
    const db = client({ data: [{ status: 'in_progress' }] });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({ status: 'in_progress' });
  });

  it('migration absente (42P01) -> unavailable, on ne casse pas la page', async () => {
    const db = client({ error: { code: '42P01', message: 'function does not exist' } });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({ status: 'unavailable' });
  });

  it('ready sans trip_id -> unavailable (reponse inexploitable)', async () => {
    const db = client({ data: [{ status: 'ready', trip_id: null }] });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({ status: 'unavailable' });
  });

  it('statut inconnu -> unavailable', async () => {
    const db = client({ data: [{ status: 'weird' }] });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({ status: 'unavailable' });
  });

  it('reponse vide -> unavailable', async () => {
    const db = client({ data: [] });
    await expect(claimTripLaunch(db, USER, ROUTE)).resolves.toEqual({ status: 'unavailable' });
  });

  it('ne journalise que le code SQL, jamais le message', async () => {
    const db = client({ error: { code: '42P01', message: `key=${SECRET}` } });
    await claimTripLaunch(db, USER, ROUTE);
    const logged = JSON.stringify(
      (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
    );
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain('42P01');
  });
});

describe('completeTripLaunch', () => {
  it('ready : route_id attache', async () => {
    const db = client({ data: [{ status: 'ready', trip_id: TRIP, slug: 's', title: 't' }] });
    await expect(completeTripLaunch(db, USER, ROUTE, TRIP)).resolves.toEqual({
      status: 'ready',
      trip: { tripId: TRIP, slug: 's', title: 't' },
    });
    expect(rpcOf(db)).toHaveBeenCalledWith('complete_trip_launch', {
      p_user_id: USER,
      p_route_id: ROUTE,
      p_trip_id: TRIP,
    });
  });

  it('lost : course perdue, voyage gagnant fourni', async () => {
    const db = client({ data: [{ status: 'lost', trip_id: 'winner', slug: 'w', title: 'W' }] });
    await expect(completeTripLaunch(db, USER, ROUTE, TRIP)).resolves.toEqual({
      status: 'lost',
      trip: { tripId: 'winner', slug: 'w', title: 'W' },
    });
  });

  it('erreur SQL -> unavailable', async () => {
    const db = client({ error: { code: '42501', message: 'not owner' } });
    await expect(completeTripLaunch(db, USER, ROUTE, TRIP)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('statut inattendu -> unavailable', async () => {
    const db = client({ data: [{ status: 'failed' }] });
    await expect(completeTripLaunch(db, USER, ROUTE, TRIP)).resolves.toEqual({
      status: 'unavailable',
    });
  });
});

describe('failTripLaunch', () => {
  it('failed : compensation appliquee', async () => {
    const db = client({ data: [{ status: 'failed' }] });
    await expect(failTripLaunch(db, USER, ROUTE, TRIP, 'lost_race')).resolves.toBe('failed');
    expect(rpcOf(db)).toHaveBeenCalledWith('fail_trip_launch', {
      p_user_id: USER,
      p_route_id: ROUTE,
      p_trip_id: TRIP,
      p_reason: 'lost_race',
    });
  });

  it('ready : no-op, la reservation gagnante n est jamais compensee', async () => {
    const db = client({ data: [{ status: 'ready' }] });
    await expect(failTripLaunch(db, USER, ROUTE, TRIP, 'late')).resolves.toBe('ready');
  });

  it('borne la raison a 200 caracteres', async () => {
    const db = client({ data: [{ status: 'failed' }] });
    await failTripLaunch(db, USER, ROUTE, TRIP, 'e'.repeat(500));
    const call = rpcOf(db).mock.calls[0][1] as { p_reason: string };
    expect(call.p_reason).toHaveLength(200);
  });

  it('erreur SQL -> unavailable', async () => {
    const db = client({ error: { code: '42P01', message: 'nope' } });
    await expect(failTripLaunch(db, USER, ROUTE, TRIP, 'x')).resolves.toBe('unavailable');
  });

  it('statut inconnu -> unavailable', async () => {
    const db = client({ data: [{ status: 'in_progress' }] });
    await expect(failTripLaunch(db, USER, ROUTE, TRIP, 'x')).resolves.toBe('unavailable');
  });
});
