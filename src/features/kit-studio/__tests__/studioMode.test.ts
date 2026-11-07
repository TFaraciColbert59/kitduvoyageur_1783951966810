// Tests du choix de mode de la page /kit-studio et de l'état de page (sans navigateur).
// Règle P1 revue Lead : la démonstration n'existe que sur `?debug=1` explicite.
import { describe, expect, it, vi } from 'vitest';
import { COLORWAYS, DEFAULT_CONFIG, FAMILIES, ITEMS, KITS, ONE } from '../domain/catalog';
import type { StudioData } from '../domain/studioData';
import { resolveStudioPageState, studioModeFromParam } from '../server/studioMode';

const studioData: StudioData = {
  items: ITEMS,
  kits: KITS,
  one: ONE,
  colorways: COLORWAYS,
  config: DEFAULT_CONFIG,
  own: {},
  order: {},
  bodyKg: 72,
  families: FAMILIES,
};

describe('studioModeFromParam', () => {
  it('seul ?debug=1 ouvre le mode démonstration', () => {
    expect(studioModeFromParam('1')).toBe('debug');
    expect(studioModeFromParam(['1'])).toBe('debug');
  });

  it('tout le reste est la production (pas de démo implicite)', () => {
    expect(studioModeFromParam(undefined)).toBe('production');
    expect(studioModeFromParam('0')).toBe('production');
    expect(studioModeFromParam('')).toBe('production');
    expect(studioModeFromParam('true')).toBe('production');
    expect(studioModeFromParam('2')).toBe('production');
    expect(studioModeFromParam(['0', '1'])).toBe('production');
  });
});

describe('resolveStudioPageState', () => {
  const base = {
    next: '/kit-studio',
  };

  it('?debug=1 : démonstration explicite, sans même lire la session', async () => {
    const getUser = vi.fn();
    const getData = vi.fn();
    const state = await resolveStudioPageState({ ...base, debug: '1', getUser, getData });
    expect(state).toEqual({ kind: 'debug' });
    expect(getUser).not.toHaveBeenCalled();
    expect(getData).not.toHaveBeenCalled();
  });

  it('sans session : redirection connexion avec retour (jamais la démo)', async () => {
    const getData = vi.fn();
    const state = await resolveStudioPageState({
      ...base,
      debug: undefined,
      getUser: async () => null,
      getData,
    });
    expect(state).toEqual({ kind: 'login', next: '/kit-studio' });
    expect(getData).not.toHaveBeenCalled();
  });

  it('session illisible (config absente) : traitée comme non connectée, jamais la démo', async () => {
    const state = await resolveStudioPageState({
      ...base,
      debug: undefined,
      getUser: async () => {
        throw new Error('Configuration Supabase manquante');
      },
      getData: async () => studioData,
    });
    expect(state).toEqual({ kind: 'login', next: '/kit-studio' });
  });

  it('compte avec kit : données réelles injectées', async () => {
    const state = await resolveStudioPageState({
      ...base,
      debug: undefined,
      getUser: async () => ({ id: 'u-1' }),
      getData: async () => studioData,
    });
    expect(state.kind).toBe('studio');
    if (state.kind !== 'studio') throw new Error('attendu studio');
    expect(state.data).toBe(studioData);
  });

  it('compte sans kit : état vide explicite (pas la démo)', async () => {
    const state = await resolveStudioPageState({
      ...base,
      debug: undefined,
      getUser: async () => ({ id: 'u-1' }),
      getData: async () => ({ ...studioData, kits: [] }),
    });
    expect(state).toEqual({ kind: 'empty' });
  });

  it('base indisponible : état unavailable (pas la démo)', async () => {
    const state = await resolveStudioPageState({
      ...base,
      debug: undefined,
      getUser: async () => ({ id: 'u-1' }),
      getData: async () => {
        throw new Error('getStudioData(one_pieces) : erreur simulée');
      },
    });
    expect(state).toEqual({ kind: 'unavailable' });
  });
});
