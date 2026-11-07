// @vitest-environment jsdom
// Tests de la synchronisation serveur P1 : diff des écritures, sauvegarde différée 600 ms,
// retour arrière sur échec + HUD « Non enregistré · réessaie », compatibilité de l'hydratation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLORWAYS, DEFAULT_CONFIG, FAMILIES, ITEMS, KITS, ONE } from '../domain/catalog';
import type { KitId } from '../domain/catalog';
import { candidates } from '../domain/packing';
import { createInitialState, isPacked } from '../domain/state';
import { setStudioData } from '../domain/studioData';
import type { StudioData } from '../domain/studioData';
import { colorsOf, diffStudioWrites, modulesOf } from '../domain/syncDiff';
import { save } from '../services/kitRepository';
import { setStudioSyncHandler } from '../services/studioSync';
import { SAVE_DELAY_MS, useKitStore } from '../store/kitStore';

const S = () => useKitStore.getState();

beforeEach(async () => {
  vi.useFakeTimers();
  // Réchauffe l'import dynamique du backend natif : sous faux minuteurs, un import jamais
  // résolu bloquerait la fin de `repo.save`.
  await import('@capacitor/core');
  const initial = createInitialState();
  useKitStore.setState({
    kit: initial,
    hydrated: true,
    lastSaved: initial,
    failed: null,
    sync: 'idle',
    undoStack: [],
    canUndo: false,
  });
  localStorage.clear();
});

afterEach(() => {
  setStudioSyncHandler(null);
  vi.useRealTimers();
});

describe('diff des écritures serveur', () => {
  it('aucun changement → aucune écriture', () => {
    const s = createInitialState();
    expect(diffStudioWrites(s, s)).toEqual([]);
    expect(diffStudioWrites(s, createInitialState())).toEqual([]);
  });

  it('changement de corps → saveBagConfig (corps, modules, couleurs)', () => {
    const prev = createInitialState();
    const next = { ...prev, kitId: prev.kitId, config: { ...prev.config, b42: { ...prev.config.b42, body: { ...prev.config.b42.body, col: 'm-789972' as const } } } };
    const writes = diffStudioWrites(prev, next);
    const bag = writes.find((w) => w.kind === 'bagConfig');
    expect(bag).toBeDefined();
    if (bag?.kind !== 'bagConfig') throw new Error('attendu bagConfig');
    expect(bag).toEqual({
      kind: 'bagConfig',
      corpsId: 'corps:b42',
      modules: ['lid', 'front', 'sides'],
      colors: expect.objectContaining({ body: '#789972' }),
    });
  });

  it('modules actifs déduits de la configuration (couvercle, poche avant, poches latérales)', () => {
    const cfg = DEFAULT_CONFIG.b42;
    expect(modulesOf(cfg)).toEqual(['lid', 'front', 'sides']);
    expect(modulesOf({ ...cfg, hip: { ...cfg.hip, shape: 'wide' }, acc: ['axe', 'sbottle'] })).toEqual([
      'lid', 'front', 'sides', 'hipp', 'tool', 'flask',
    ]);
    expect(colorsOf(cfg)).toMatchObject({ body: '#2D482A', front: '#3D6038', accent: '#9BBDA7' });
  });

  it('rangement → saveKitItemPlacement (zone, slot, ordre)', () => {
    const prev = createInitialState();
    const item = candidates(prev, 'main')[0]!;
    const current = prev.kits[prev.kitId];
    const withItem = {
      ...prev,
      kits: {
        ...prev.kits,
        [prev.kitId]: {
          ...current,
          packed: { ...current.packed, main: [...current.packed.main, item.id] },
        },
      },
    };
    const writes = diffStudioWrites(prev, withItem);
    expect(writes).toContainEqual({
      kind: 'placement',
      itemId: item.id,
      zone: 'main',
      slot: null,
      loadOrder: current.packed.main.length,
    });
  });

  it('changement de kit : aucune écriture de contenu (pas de fuite du kit A vers le kit B)', () => {
    const prev = createInitialState('tmb');
    const next = { ...prev, kitId: 'vercors' as const };
    expect(diffStudioWrites(prev, next)).toEqual([]);
    // La précommande, elle, reste indépendante du kit courant.
    const both = { ...next, order: { 'mod:tool': 'nuit' as const } };
    expect(diffStudioWrites(prev, both)).toEqual([
      { kind: 'preorder', items: [{ pieceId: 'mod:tool', colorwayId: 'nuit' }] },
    ]);
  });

  it('nouvelle précommande → placePreorder avec les pièces nouvellement commandées', () => {
    const prev = createInitialState();
    const next = { ...prev, order: { 'mod:tool': 'nuit' as const } };
    const writes = diffStudioWrites(prev, next);
    expect(writes).toContainEqual({ kind: 'preorder', items: [{ pieceId: 'mod:tool', colorwayId: 'nuit' }] });
  });
});

describe('sauvegarde différée 600 ms et retour arrière', () => {
  it('écrit localement après 600 ms (aucun handler = aucun réseau)', async () => {
    S().setMod('tool', true);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    expect(localStorage.getItem('lkdv-kit-studio:v1')).toBeNull();
    await vi.advanceTimersByTimeAsync(2);
    expect(localStorage.getItem('lkdv-kit-studio:v1')).not.toBeNull();
    expect(S().sync).toBe('idle');
  });

  it('échec serveur → état annulé, sync=error, puis « réessaie » rejoue l’écriture', async () => {
    const before = S().kit;
    useKitStore.setState({ lastSaved: before });
    const item = candidates(before, 'main')[0]!;

    setStudioSyncHandler(async () => {
      throw new Error('réseau indisponible');
    });
    S().pack(item.id, 'main');
    expect(isPacked(S().kit, item.id)).toBe(true); // optimiste
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 2);

    // Retour arrière : l'écran ne ment pas, le HUD signale l'échec.
    expect(S().sync).toBe('error');
    expect(S().kit).toBe(before);
    expect(isPacked(S().kit, item.id)).toBe(false);

    // « réessaie » : rejoue l'état optimiste, cette fois accepté.
    const pushed: string[] = [];
    setStudioSyncHandler(async (_prev, next) => {
      pushed.push('ok');
      void next;
    });
    await S().retry();
    expect(S().sync).toBe('idle');
    expect(pushed).toHaveLength(1);
    expect(isPacked(S().kit, item.id)).toBe(true);
  });

  it('flush écrit immédiatement et vide l’erreur après succès', async () => {
    const pushed: number[] = [];
    setStudioSyncHandler(async () => {
      pushed.push(1);
    });
    S().setMod('tool', true);
    await S().flush();
    expect(pushed).toHaveLength(1);
    expect(S().sync).toBe('idle');
  });
});

describe('hydratation face à un registre serveur', () => {
  it('un état local de démonstration n’est pas réutilisé quand la base fournit d’autres kits', async () => {
    await save(createInitialState());
    const kit = { ...KITS[0]!, id: 'server-kit' as KitId };
    const serverData: StudioData = {
      items: ITEMS,
      kits: [kit],
      one: ONE,
      colorways: COLORWAYS,
      config: DEFAULT_CONFIG,
      own: { chassis: 'foret' },
      order: {},
      bodyKg: 72,
      families: FAMILIES,
    };
    try {
      setStudioData(serverData);
      useKitStore.setState({ kit: createInitialState() });
      await S().hydrate();
      expect(S().kit.kitId).toBe('server-kit');
      expect(Object.keys(S().kit.kits)).toEqual(['server-kit']);
      expect(S().hydrated).toBe(true);
    } finally {
      setStudioData(null);
    }
  });
});
