/**
 * Phase 2 — Test d'intégration LOCAL de la chaîne d'identifiants réelle :
 * user → trip → plan → route → kit → session → carnet → publication, puis
 * injections d'échec à chaque étape (attach non-propriétaire, route sans
 * géométrie, session sans carnet, publication sans carnet, ré-affectation).
 *
 * Exécution : `PHASE2_LOCAL_INTEGRATION=1` + `PHASE2_LOCAL_SERVICE_ROLE_KEY`
 * + `PHASE2_LOCAL_ANON_KEY` (sinon ignoré). Garde-fous : toute URL non locale
 * lève immédiatement (jamais la production) et une base locale injoignable
 * provoque un SKIP propre, jamais un FAIL.
 *
 * La projection `getTripExperience` est exercée avec un client porté par la
 * session réelle de l'utilisateur (RLS), jamais le service role.
 *
 * Preuves :
 *   TEST-PHASE2-CHAIN-01 — chaîne complète créée puis relue par la projection ;
 *   TEST-PHASE2-CHAIN-02 — attach non-propriétaire refusé, comptages inchangés ;
 *   TEST-PHASE2-CHAIN-03 — sélection d'une route sans géométrie refusée ;
 *   TEST-PHASE2-CHAIN-04 — session pointant un carnet inexistant refusée ;
 *   TEST-PHASE2-CHAIN-05 — publication avec carnet inexistant refusée ;
 *   TEST-PHASE2-CHAIN-06 — ré-affectation d'un plan attaché refusée ;
 *   TEST-PHASE2-CHAIN-07 — projection d'un tiers ⇒ null (RLS et scope).
 */
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

const holder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => holder.client),
}));

import { getTripExperience } from '@/features/trips/server/getTripExperience';

const RUN = process.env.PHASE2_LOCAL_INTEGRATION === '1';
const API_URL = process.env.PHASE2_LOCAL_API_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.PHASE2_LOCAL_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.PHASE2_LOCAL_ANON_KEY ?? '';
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];

type Json = Record<string, unknown>;

let reachable = false;

if (RUN && SERVICE_KEY && ANON_KEY) {
  try {
    const hostname = new URL(API_URL).hostname;
    if (!LOCAL_HOSTS.includes(hostname)) {
      throw new Error(
        `URL non locale refusée (${hostname}) — test local uniquement, jamais la production.`
      );
    }
    const probe = await fetch(`${API_URL}/rest/v1/`, {
      headers: { apikey: SERVICE_KEY },
    });
    reachable = probe.status < 500;
  } catch {
    reachable = false;
  }
}

const suite = RUN && reachable ? describe : describe.skip;

let serviceClient: SupabaseClient;
let ownerClient: SupabaseClient;
let intruderClient: SupabaseClient;

let ownerId = '';
let intruderId = '';
let planId = '';
let plan2Id = '';
let tripId = '';
let trip2Id = '';
let intruderTripId = '';
let routeId = 0;
let routeWithoutGeometryId = 0;
let kitId = '';
let carnetId = '';
let sessionId = '';
let postId = '';
let correlationId = '';

const runKey = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const ownerEmail = `phase2-chain-owner-${runKey}@example.invalid`;
const intruderEmail = `phase2-chain-intruder-${runKey}@example.invalid`;
const password = `Phase2-${randomUUID().slice(0, 12)}-local!`;

async function insertRow(table: string, row: Json): Promise<Json> {
  const { data, error } = await serviceClient.from(table).insert(row).select('*').single();
  if (error) throw new Error(`seed ${table}: ${error.message}`);
  return data as Json;
}

async function countRows(table: string, column: string, value: unknown): Promise<number> {
  const { count, error } = await serviceClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value as never);
  if (error) throw new Error(`comptage ${table}: ${error.message}`);
  return count ?? 0;
}

async function createUser(email: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!response.ok) throw new Error(`création utilisateur local: HTTP ${response.status}`);
  const created = (await response.json()) as { id: string };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('id', created.id)
      .maybeSingle();
    if (data) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return created.id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createSupabaseClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`connexion locale: ${error.message}`);
  return client;
}

suite('Phase 2 — chaîne d’identifiants sur base locale (TEST-PHASE2-CHAIN)', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    serviceClient = createSupabaseClient(API_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    ownerId = await createUser(ownerEmail);
    intruderId = await createUser(intruderEmail);
    ownerClient = await signIn(ownerEmail);
    intruderClient = await signIn(intruderEmail);

    const trip = await insertRow('trips', {
      slug: `phase2-chain-${runKey}`,
      title: 'Phase 2 — chaîne intégration',
      user_id: ownerId,
      visibility: 'private',
      status: 'draft',
    });
    tripId = String(trip.id);

    const trip2 = await insertRow('trips', {
      slug: `phase2-chain-second-${runKey}`,
      title: 'Phase 2 — second voyage',
      user_id: ownerId,
      visibility: 'private',
      status: 'draft',
    });
    trip2Id = String(trip2.id);

    const intruderTrip = await insertRow('trips', {
      slug: `phase2-chain-intruder-${runKey}`,
      title: 'Phase 2 — voyage tiers',
      user_id: intruderId,
      visibility: 'private',
      status: 'draft',
    });
    intruderTripId = String(intruderTrip.id);

    const plan = await insertRow('adventure_plans', {
      owner_id: ownerId,
      title: 'Phase 2 — plan orphelin intégration',
      status: 'draft',
      current_version: 1,
    });
    planId = String(plan.id);

    await insertRow('adventure_plan_versions', {
      plan_id: planId,
      version: 1,
      snapshot: { id: planId, currentVersion: 1 },
      reason: 'Génération initiale (test Phase 2)',
      generated_by: 'phase2-integration',
    });

    const plan2 = await insertRow('adventure_plans', {
      owner_id: ownerId,
      title: 'Phase 2 — second plan orphelin intégration',
      status: 'draft',
      current_version: 1,
    });
    plan2Id = String(plan2.id);

    const route = await insertRow('hiking_routes', {
      id: Number(Date.now()),
      osm_relation_id: Number(`9${Date.now().toString().slice(-10)}`),
      name: 'Phase 2 — route navigable intégration',
      distance_km: 12.5,
      geom: {
        type: 'MultiLineString',
        coordinates: [[[6.0, 45.0], [6.1, 45.1], [6.2, 45.0]]],
      },
    });
    routeId = Number(route.id);

    const bareRoute = await insertRow('hiking_routes', {
      id: Number(Date.now()) + 1,
      osm_relation_id: Number(`8${Date.now().toString().slice(-10)}`),
      name: 'Phase 2 — route sans géométrie intégration',
      distance_km: 4.2,
    });
    routeWithoutGeometryId = Number(bareRoute.id);

    const kit = await insertRow('materiel_kits', {
      user_id: ownerId,
      name: 'Phase 2 — kit intégration',
    });
    kitId = String(kit.id);

    correlationId = randomUUID();
  });

  afterAll(async () => {
    if (!serviceClient) return;
    const cleanup = async (table: string, column: string, value: string) => {
      await serviceClient.from(table).delete().eq(column, value as never).then(
        () => undefined,
        () => undefined
      );
    };
    if (postId) await cleanup('community_posts', 'id', postId);
    if (carnetId) {
      await cleanup('community_posts', 'linked_carnet_id', carnetId);
      await cleanup('hike_sessions', 'carnet_id', carnetId);
      await cleanup('carnets', 'id', carnetId);
    }
    if (ownerId) await cleanup('adventure_plans', 'owner_id', ownerId);
    if (ownerId) await cleanup('trips', 'user_id', ownerId);
    if (intruderId) await cleanup('trips', 'user_id', intruderId);
    if (ownerId) await cleanup('materiel_kits', 'user_id', ownerId);
    for (const id of [routeId, routeWithoutGeometryId]) {
      if (id) await serviceClient.from('hiking_routes').delete().eq('id', id);
    }
    for (const id of [ownerId, intruderId]) {
      if (id) {
        await fetch(`${API_URL}/auth/v1/admin/users/${id}`, {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
        }).catch(() => {});
      }
    }
  });

  it('TEST-PHASE2-CHAIN-01: crée la chaîne complète et la relit via la projection', async () => {
    const attached = await ownerClient.rpc('attach_adventure_plan_to_trip', {
      p_plan_id: planId,
      p_trip_id: tripId,
      p_correlation_id: correlationId,
    });
    expect(attached.error).toBeNull();
    expect((attached.data as Json).trip_id).toBe(tripId);
    expect((attached.data as Json).correlation_id).toBe(correlationId);

    const selected = await ownerClient.rpc('select_adventure_plan_route', {
      p_plan_id: planId,
      p_route_id: routeId,
      p_correlation_id: correlationId,
    });
    expect(selected.error).toBeNull();
    expect(String((selected.data as Json).selected_route_id)).toBe(String(routeId));

    const kitUpdate = await ownerClient
      .from('trips')
      .update({ kit_id: kitId })
      .eq('id', tripId)
      .select('id')
      .single();
    expect(kitUpdate.error).toBeNull();

    const carnet = await ownerClient
      .from('carnets')
      .insert({
        author_id: ownerId,
        title: 'Phase 2 — carnet intégration',
        destination: 'Chartreuse',
        trip_id: tripId,
        correlation_id: correlationId,
        visibility: 'private',
      })
      .select('id')
      .single();
    expect(carnet.error).toBeNull();
    carnetId = String(carnet.data?.id);

    const startedAt = new Date(Date.now() - 3600_000).toISOString();
    const session = await ownerClient
      .from('hike_sessions')
      .insert({
        user_id: ownerId,
        route_id: routeId,
        kit_id: kitId,
        carnet_id: carnetId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        distance_km: 12.5,
        duration_seconds: 3600,
        correlation_id: correlationId,
      })
      .select('id')
      .single();
    expect(session.error).toBeNull();
    sessionId = String(session.data?.id);

    const post = await ownerClient
      .from('community_posts')
      .insert({
        author_id: ownerId,
        content: 'Phase 2 — publication corrélée',
        post_type: 'share',
        linked_carnet_id: carnetId,
        correlation_id: correlationId,
      })
      .select('id')
      .single();
    expect(post.error).toBeNull();
    postId = String(post.data?.id);

    holder.client = ownerClient;
    const experience = await getTripExperience(tripId);
    expect(experience).not.toBeNull();
    expect(experience?.trip_id).toBe(tripId);
    expect(experience?.adventure_plan_id).toBe(planId);
    expect(experience?.selected_route_id).toBe(routeId);
    expect(experience?.route_name).toContain('route navigable intégration');
    expect(experience?.kit_id).toBe(kitId);
    expect(experience?.hike_session_id).toBe(sessionId);
    expect(experience?.journal_id).toBe(carnetId);
    expect(experience?.community_post_id).toBe(postId);
    expect(experience?.correlation_id).toBe(correlationId);
    expect(experience?.plan_version_id).not.toBeNull();
  });

  it('TEST-PHASE2-CHAIN-02: attach non-propriétaire refusé, aucun objet créé', async () => {
    const plansBefore = await countRows('adventure_plans', 'owner_id', ownerId);
    const selectionsBefore = await countRows('adventure_plan_route_selections', 'plan_id', planId);

    const intruderAttempt = await intruderClient.rpc('attach_adventure_plan_to_trip', {
      p_plan_id: planId,
      p_trip_id: intruderTripId,
    });
    expect(intruderAttempt.error).not.toBeNull();
    expect(intruderAttempt.error?.message).toContain('non détenu');

    const ownerToIntruderTrip = await ownerClient.rpc('attach_adventure_plan_to_trip', {
      p_plan_id: plan2Id,
      p_trip_id: intruderTripId,
    });
    expect(ownerToIntruderTrip.error).not.toBeNull();
    expect(ownerToIntruderTrip.error?.message).toContain('non détenu');

    expect(await countRows('adventure_plans', 'owner_id', ownerId)).toBe(plansBefore);
    expect(await countRows('adventure_plan_route_selections', 'plan_id', planId)).toBe(
      selectionsBefore
    );
    const { data: plan } = await serviceClient
      .from('adventure_plans')
      .select('trip_id')
      .eq('id', planId)
      .single();
    expect(plan?.trip_id).toBe(tripId);
  });

  it('TEST-PHASE2-CHAIN-03: sélection d’une route sans géométrie refusée', async () => {
    const selectionsBefore = await countRows('adventure_plan_route_selections', 'plan_id', planId);

    const attempt = await ownerClient.rpc('select_adventure_plan_route', {
      p_plan_id: planId,
      p_route_id: routeWithoutGeometryId,
      p_correlation_id: randomUUID(),
    });
    expect(attempt.error).not.toBeNull();
    expect(attempt.error?.message).toContain('sans géométrie navigable');

    expect(await countRows('adventure_plan_route_selections', 'plan_id', planId)).toBe(
      selectionsBefore
    );
    const { data: plan } = await serviceClient
      .from('adventure_plans')
      .select('selected_route_id')
      .eq('id', planId)
      .single();
    expect(String(plan?.selected_route_id)).toBe(String(routeId));
  });

  it('TEST-PHASE2-CHAIN-04: session pointant un carnet inexistant refusée', async () => {
    const sessionsBefore = await countRows('hike_sessions', 'user_id', ownerId);

    const attempt = await ownerClient.from('hike_sessions').insert({
      user_id: ownerId,
      carnet_id: randomUUID(),
      started_at: new Date(Date.now() - 60_000).toISOString(),
      ended_at: new Date().toISOString(),
      distance_km: 3.1,
      duration_seconds: 1200,
      correlation_id: correlationId,
    });

    expect(attempt.error).not.toBeNull();
    expect(await countRows('hike_sessions', 'user_id', ownerId)).toBe(sessionsBefore);
  });

  it('TEST-PHASE2-CHAIN-05: publication avec carnet inexistant refusée', async () => {
    const postsBefore = await countRows('community_posts', 'author_id', ownerId);

    const attempt = await ownerClient.from('community_posts').insert({
      author_id: ownerId,
      content: 'Phase 2 — publication sans carnet source',
      post_type: 'share',
      linked_carnet_id: randomUUID(),
      correlation_id: correlationId,
    });

    expect(attempt.error).not.toBeNull();
    expect(await countRows('community_posts', 'author_id', ownerId)).toBe(postsBefore);
  });

  it('TEST-PHASE2-CHAIN-06: ré-affectation d’un plan déjà attaché refusée', async () => {
    const tripsBefore = await countRows('trips', 'user_id', ownerId);

    const attempt = await ownerClient.rpc('attach_adventure_plan_to_trip', {
      p_plan_id: planId,
      p_trip_id: trip2Id,
      p_correlation_id: randomUUID(),
    });
    expect(attempt.error).not.toBeNull();
    expect(attempt.error?.message).toContain('déjà attaché');

    expect(await countRows('trips', 'user_id', ownerId)).toBe(tripsBefore);
    const { data: plan } = await serviceClient
      .from('adventure_plans')
      .select('trip_id, correlation_id')
      .eq('id', planId)
      .single();
    expect(plan?.trip_id).toBe(tripId);
    expect(plan?.correlation_id).toBe(correlationId);
  });

  it('TEST-PHASE2-CHAIN-07: projection d’un tiers ⇒ null (RLS et scope)', async () => {
    holder.client = intruderClient;

    await expect(getTripExperience(tripId)).resolves.toBeNull();
  });
});
