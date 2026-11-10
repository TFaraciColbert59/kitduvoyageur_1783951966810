import { beforeEach, describe, expect, it, vi } from 'vitest';

const CARNET = '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
const ITEM = '0b1c9c0e-3c1d-4f6a-9a2e-0d4c1b7e8f01';
const USER = '11111111-1111-4111-8111-111111111111';

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

const state = {
  user: { id: USER, is_anonymous: false } as { id: string; is_anonymous: boolean } | null,
  participant: true,
  calls: [] as Call[],
  /** Réponse par `table.op` : { data, error }. */
  responses: {} as Record<string, { data: unknown; error?: { code?: string } | null }>,
};

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  state.calls.push(call);
  const chain: Record<string, unknown> = {};
  const result = () => {
    const response = state.responses[`${table}.${call.op}`] ?? { data: null, error: null };
    return { data: response.data ?? null, error: response.error ?? null };
  };
  for (const op of ['insert', 'update', 'upsert', 'delete']) {
    chain[op] = (payload?: unknown) => {
      call.op = op;
      call.payload = payload;
      return chain;
    };
  }
  for (const f of ['eq', 'ilike']) {
    chain[f] = (col: string, value: unknown) => {
      call.filters.push([`${f}:${col}`, value]);
      return chain;
    };
  }
  chain.select = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () => Promise.resolve(result());
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    rpc: async () => ({ data: state.participant, error: null }),
    from: (table: string) => builder(table),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  addTravelerAction,
  deleteNightAction,
  deleteStepAction,
  removeTravelerAction,
  saveNightAction,
  saveStepAction,
  saveVerdictAction,
  updateMomentAction,
  updateTravelerAction,
} from '../editActions';

beforeEach(() => {
  state.user = { id: USER, is_anonymous: false };
  state.participant = true;
  state.calls = [];
  state.responses = {};
});

const step = { carnetId: CARNET, dayNumber: 1, from: 'A', to: 'B' };

describe('saveStepAction', () => {
  it('refuse une saisie invalide avant tout accès à la base', async () => {
    const result = await saveStepAction({ ...step, from: '' });
    expect(result).toEqual({ ok: false, error: 'Indique le départ.' });
    expect(state.calls).toHaveLength(0);
  });

  it('exige une session non anonyme et le droit de participant', async () => {
    state.user = null;
    expect(await saveStepAction(step)).toMatchObject({ ok: false, error: 'Connexion requise.' });
    state.user = { id: USER, is_anonymous: true };
    expect(await saveStepAction(step)).toMatchObject({ ok: false, error: 'Connexion requise.' });
    state.user = { id: USER, is_anonymous: false };
    state.participant = false;
    const refused = await saveStepAction(step);
    expect(refused.ok).toBe(false);
    expect(state.calls).toHaveLength(0);
  });

  it('écrit dans groupe_etapes du groupe du carnet', async () => {
    state.responses['carnets.select'] = { data: { groupe_id: 'g-1' } };
    state.responses['groupe_etapes.insert'] = {
      data: { id: 'e-9', jour_numero: 1, ordre: 1, date_etape: null, lieu_depart: 'A', lieu_arrivee: 'B', recit: null, distance_km: null, denivele_m: null, duree_texte: null, meteo: null, temperature_c: null },
    };
    const result = await saveStepAction(step);
    expect(result).toMatchObject({ ok: true, etape: { id: 'e-9', from: 'A', to: 'B', dayNumber: 1 } });
    const insert = state.calls.find((c) => c.table === 'groupe_etapes');
    expect(insert?.op).toBe('insert');
    expect(insert?.payload).toMatchObject({ groupe_id: 'g-1', lieu_depart: 'A' });
  });

  it('dit les limites : pas de groupe, ligne refusée par la RLS', async () => {
    state.responses['carnets.select'] = { data: { groupe_id: null } };
    expect(await saveStepAction(step)).toMatchObject({ ok: false });
    state.responses['carnets.select'] = { data: { groupe_id: 'g-1' } };
    state.responses['groupe_etapes.insert'] = { data: null };
    expect(await saveStepAction(step)).toEqual({
      ok: false,
      error: 'Tu n’as pas le droit de modifier ce carnet.',
    });
  });

  it('met à jour par identifiant et restreint au groupe', async () => {
    state.responses['carnets.select'] = { data: { groupe_id: 'g-1' } };
    state.responses['groupe_etapes.update'] = {
      data: { id: ITEM, jour_numero: 1, ordre: 1, date_etape: null, lieu_depart: 'A', lieu_arrivee: 'B', recit: null, distance_km: null, denivele_m: null, duree_texte: null, meteo: null, temperature_c: null },
    };
    const result = await saveStepAction({ ...step, id: ITEM });
    expect(result.ok).toBe(true);
    const update = state.calls.find((c) => c.op === 'update');
    expect(update?.filters).toEqual([
      ['eq:id', ITEM],
      ['eq:groupe_id', 'g-1'],
    ]);
  });
});

describe('deleteStepAction / deleteNightAction', () => {
  it('signale une suppression que la base a refusée (0 ligne)', async () => {
    state.responses['carnets.select'] = { data: { groupe_id: 'g-1' } };
    state.responses['groupe_etapes.delete'] = { data: [] };
    expect(await deleteStepAction({ carnetId: CARNET, id: ITEM })).toMatchObject({ ok: false });
    state.responses['groupe_etapes.delete'] = { data: [{ id: ITEM }] };
    expect(await deleteStepAction({ carnetId: CARNET, id: ITEM })).toEqual({ ok: true });
    state.responses['carnet_nights.delete'] = { data: [{ id: 'n' }] };
    expect(await deleteNightAction({ carnetId: CARNET, dayNumber: 2 })).toEqual({ ok: true });
  });
});

describe('saveNightAction', () => {
  const night = { carnetId: CARNET, dayNumber: 2, name: 'Gîte des Claux', type: 'gite' };
  const row = {
    id: 'n-2', jour_numero: 2, nom: 'Gîte des Claux', type: 'gite', altitude_m: null, infos: null, lat: null, lng: null, map_refuge_id: null,
  };

  it('crée par upsert sur (carnet, jour)', async () => {
    state.responses['carnet_nights.upsert'] = { data: row };
    const result = await saveNightAction(night);
    expect(result).toMatchObject({ ok: true, night: { id: 'n-2', name: 'Gîte des Claux' } });
    const upsert = state.calls.find((c) => c.op === 'upsert');
    expect(upsert?.payload).toMatchObject({ carnet_id: CARNET, jour_numero: 2, created_by: USER });
  });

  it('retombe sur l’upsert quand l’identifiant vient de l’ancien carnet de groupe', async () => {
    state.responses['carnet_nights.update'] = { data: null };
    state.responses['carnet_nights.upsert'] = { data: row };
    const result = await saveNightAction({ ...night, id: ITEM });
    expect(result.ok).toBe(true);
    expect(state.calls.map((c) => c.op)).toEqual(['update', 'upsert']);
  });

  it('dit « une nuit existe déjà » sur un conflit de jour', async () => {
    state.responses['carnet_nights.update'] = { data: null, error: { code: '23505' } };
    expect(await saveNightAction({ ...night, id: ITEM })).toEqual({
      ok: false,
      error: 'Une nuit existe déjà pour ce jour.',
    });
  });
});

describe('saveVerdictAction', () => {
  it('écrit verdict, note et jours sur l’objet du carnet', async () => {
    state.responses['carnet_kit_items.update'] = { data: [{ id: ITEM }] };
    const result = await saveVerdictAction({
      carnetId: CARNET,
      itemId: ITEM,
      verdict: 'defaillant',
      note: 'fermeture cassée',
      days: [2, 1],
    });
    expect(result).toMatchObject({ ok: true, verdict: { verdict: 'defaillant', joursUtilises: [1, 2] } });
    const update = state.calls.find((c) => c.op === 'update');
    expect(update?.payload).toEqual({
      verdict: 'defaillant',
      verdict_note: 'fermeture cassée',
      jours_utilises: [1, 2],
    });
    expect(update?.filters).toEqual([
      ['eq:id', ITEM],
      ['eq:carnet_id', CARNET],
    ]);
  });

  it('explique une base sans la migration des verdicts', async () => {
    state.responses['carnet_kit_items.update'] = { data: null, error: { code: '42703' } };
    const result = await saveVerdictAction({ carnetId: CARNET, itemId: ITEM, verdict: 'utile' });
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain('pas encore disponibles');
  });
});

describe('voyageurs', () => {
  const profile = { id: '22222222-2222-4222-8222-222222222201', full_name: 'Léo Barbier', handle: 'leo', avatar_url: null };

  it('ajoute un voyageur trouvé par son pseudo, jamais deux fois ni l’auteur', async () => {
    state.responses['public_profiles.select'] = { data: profile };
    state.responses['carnets.select'] = { data: { author_id: USER } };
    state.responses['carnet_collaborators.select'] = { data: [] };
    state.responses['carnet_collaborators.insert'] = { data: { user_id: profile.id } };
    const ok = await addTravelerAction({ carnetId: CARNET, handle: '@leo', role: 'contributor' });
    expect(ok).toMatchObject({ ok: true, participant: { userId: profile.id, name: 'Léo Barbier' } });
    const insert = state.calls.find((c) => c.op === 'insert');
    expect(insert?.payload).toEqual({ carnet_id: CARNET, user_id: profile.id, role: 'contributor' });

    state.responses['carnet_collaborators.select'] = { data: [{ user_id: profile.id }] };
    expect(await addTravelerAction({ carnetId: CARNET, handle: 'leo', role: 'viewer' })).toMatchObject({
      ok: false,
      error: 'Ce voyageur fait déjà partie du carnet.',
    });

    state.responses['carnets.select'] = { data: { author_id: profile.id } };
    expect(await addTravelerAction({ carnetId: CARNET, handle: 'leo', role: 'viewer' })).toMatchObject({
      ok: false,
      error: 'Cette personne est l’auteur du carnet.',
    });
  });

  it('échappe les jokers LIKE du pseudo', async () => {
    state.responses['public_profiles.select'] = { data: null };
    const result = await addTravelerAction({ carnetId: CARNET, handle: 'a_b', role: 'viewer' });
    expect(result).toEqual({ ok: false, error: 'Aucun voyageur « @a_b ».' });
    const lookup = state.calls.find((c) => c.table === 'public_profiles');
    expect(lookup?.filters).toEqual([['ilike:handle', 'a\\_b']]);
  });

  it('dit que seul l’auteur change un rôle ou retire un voyageur quand la RLS refuse', async () => {
    state.responses['carnet_collaborators.update'] = { data: [] };
    expect(
      await updateTravelerAction({ carnetId: CARNET, userId: profile.id, role: 'viewer' })
    ).toMatchObject({ ok: false });
    state.responses['carnet_collaborators.delete'] = { data: [] };
    expect(await removeTravelerAction({ carnetId: CARNET, userId: profile.id })).toMatchObject({
      ok: false,
    });
    state.responses['carnet_collaborators.delete'] = { data: [{ user_id: profile.id }] };
    expect(await removeTravelerAction({ carnetId: CARNET, userId: profile.id })).toEqual({ ok: true });
  });
});

describe('updateMomentAction', () => {
  it('modifie lieu et texte du moment du carnet', async () => {
    state.responses['carnet_moments.update'] = { data: [{ id: ITEM }] };
    const result = await updateMomentAction({ carnetId: CARNET, id: ITEM, place: 'Col', caption: 'Brume' });
    expect(result).toEqual({ ok: true, place: 'Col', caption: 'Brume' });
    const update = state.calls.find((c) => c.op === 'update');
    expect(update?.payload).toEqual({ lieu: 'Col', citation: 'Brume' });
    expect(update?.filters).toContainEqual(['eq:carnet_id', CARNET]);
  });
});
