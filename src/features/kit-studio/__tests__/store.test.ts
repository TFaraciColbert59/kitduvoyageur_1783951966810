// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidates } from '../domain/packing';
import { createInitialState, currentKit, isPacked } from '../domain/state';
import { modOn } from '../domain/parts';
import { parseKitState } from '../domain/schema';
import { KIT_STORAGE_KEY, clear, load, migrate, save } from '../services/kitRepository';
import { SAVE_DELAY_MS, UNDO_MAX, useKitStore } from '../store/kitStore';
import { selectOrderTotalCents, selectToOrder, selectTotals } from '../store/selectors';
import { AUTO_OPEN_MS, useUiStore } from '../store/uiStore';

const S = () => useKitStore.getState();

function reset(): void {
  useKitStore.setState({ kit: createInitialState(), hydrated: false, undoStack: [], canUndo: false });
  localStorage.clear();
}

beforeEach(() => {
  vi.useFakeTimers();
  reset();
});
afterEach(async () => {
  await S().flush();
  vi.useRealTimers();
});

describe('schéma', () => {
  it('accepte l état initial et le renvoie équivalent', () => {
    const s = createInitialState();
    expect(parseKitState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('refuse les données invalides sans exception', () => {
    for (const bad of [null, undefined, 42, 'x', [], {}, { version: 2 }, { ...createInitialState(), kitId: 'zzz' }, { ...createInitialState(), day: 99 }]) {
      expect(parseKitState(bad)).toBeNull();
    }
  });
});

describe('actions', () => {
  it('pack range un objet, unpack le retire', () => {
    const it = candidates(S().kit, 'main')[0]!;
    const r = S().pack(it.id, 'main');
    expect(r.ok).toBe(true);
    expect(isPacked(S().kit, it.id)).toBe(true);
    expect(S().canUndo).toBe(true);
    expect(S().unpack(it.id).ok).toBe(true);
    expect(isPacked(S().kit, it.id)).toBe(false);
  });
  it('pack refusé : résultat renvoyé, état et pile inchangés', () => {
    const it = candidates(S().kit, 'main')[0]!;
    S().pack(it.id, 'main');
    const before = S().kit;
    const depth = S().undoStack.length;
    const r = S().pack(it.id, 'main');
    expect(r).toMatchObject({ ok: false, reason: 'already' });
    expect(S().kit).toBe(before);
    expect(S().undoStack.length).toBe(depth);
  });
  it('setBag change le corps de sac', () => {
    const other = currentKit(S().kit).bag === 'b42' ? 'b28' : 'b42';
    const r = S().setBag(other);
    expect(r.ok).toBe(true);
    expect(currentKit(S().kit).bag).toBe(other);
    expect(S().setBag(other).ok).toBe(false);
  });
  it('toggleModule et setMod', () => {
    expect(modOn(S().kit, 'tool')).toBe(false);
    expect(S().setMod('tool', true).ok).toBe(true);
    expect(modOn(S().kit, 'tool')).toBe(true);
    expect(S().toggleModule('tool', true).ok).toBe(false);
  });
  it('setPartOption : coloris global, forme, accessoire, module', () => {
    expect(S().setPartOption('all', 'col', 'sauge').ok).toBe(true);
    expect(currentKit(S().kit).cw).toBe('sauge');
    expect(S().setPartOption('lid', 'fin', 'gloss').ok).toBe(true);
    expect(S().kit.config[currentKit(S().kit).bag].lid.fin).toBe('gloss');
    const had = S().kit.config[currentKit(S().kit).bag].acc.includes('cover');
    S().setPartOption('all', 'acc', 'cover');
    expect(S().kit.config[currentKit(S().kit).bag].acc.includes('cover')).toBe(!had);
    const m = S().setPartOption('all', 'mod', 'flask');
    expect(m.ok === modOn(S().kit, 'flask')).toBe(true);
  });
  it('confirmOrder déplace les pièces à commander vers order', () => {
    S().setPartOption('all', 'col', 'nuit');
    const before = selectToOrder(S().kit).length;
    expect(before).toBeGreaterThan(0);
    expect(selectOrderTotalCents(S().kit)).toBeGreaterThan(0);
    expect(S().confirmOrder().ok).toBe(true);
    expect(selectToOrder(S().kit)).toHaveLength(0);
    expect(selectOrderTotalCents(S().kit)).toBe(0);
    expect(S().confirmOrder().ok).toBe(false);
  });
  it('switchKit et setDay (bornés), non annulables', () => {
    expect(S().switchKit('vercors').ok).toBe(true);
    expect(S().kit.kitId).toBe('vercors');
    expect(S().switchKit('vercors').ok).toBe(false);
    S().setDay(99);
    expect(S().kit.day).toBe(currentKit(S().kit).days);
    S().setDay(-4);
    expect(S().kit.day).toBe(1);
    expect(S().canUndo).toBe(false);
  });
  it('sélecteurs mémoïsés : même référence tant que l état ne change pas', () => {
    const k = S().kit;
    expect(selectTotals(k)).toBe(selectTotals(k));
    expect(selectToOrder(k)).toBe(selectToOrder(k));
  });
});

describe('annulation', () => {
  it('undo restaure l état précédent et vide la pile', () => {
    const it = candidates(S().kit, 'main')[0]!;
    const start = S().kit;
    S().pack(it.id, 'main');
    expect(S().undo()).toBe(true);
    expect(S().kit).toEqual(start);
    expect(S().canUndo).toBe(false);
    expect(S().undo()).toBe(false);
  });
  it('undo conserve le kit affiché et le jour', () => {
    const it = candidates(S().kit, 'main')[0]!;
    S().pack(it.id, 'main');
    S().switchKit('cabine');
    S().undo();
    expect(S().kit.kitId).toBe('cabine');
    expect(isPacked(S().kit, it.id)).toBe(false);
  });
  it(`la pile est plafonnée à ${UNDO_MAX}`, () => {
    for (let i = 0; i < UNDO_MAX + 7; i++) S().setMod('tool', i % 2 === 0);
    expect(S().undoStack.length).toBe(UNDO_MAX);
  });
});

describe('persistance', () => {
  it('aller-retour localStorage', async () => {
    S().setPartOption('all', 'col', 'pierre');
    await save(S().kit);
    expect(localStorage.getItem(KIT_STORAGE_KEY)).not.toBeNull();
    expect(await load()).toEqual(S().kit);
    await clear();
    expect(await load()).toBeNull();
  });
  it('hydrate relit le kit local', async () => {
    S().setPartOption('all', 'col', 'sauge');
    const saved = S().kit;
    await save(saved);
    useKitStore.setState({ kit: createInitialState() });
    await S().hydrate();
    expect(S().hydrated).toBe(true);
    expect(S().kit).toEqual(saved);
    expect(S().canUndo).toBe(false);
  });
  it('donnée corrompue : état initial, sans exception', async () => {
    for (const raw of ['{pas du json', '{"version":1}', 'null', JSON.stringify({ ...createInitialState(), kitId: 'x' })]) {
      localStorage.setItem(KIT_STORAGE_KEY, raw);
      expect(await load()).toBeNull();
      await S().hydrate();
      expect(S().kit).toEqual(createInitialState());
    }
  });
  it('localStorage qui lève : load null, save sans exception', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué'); });
    const spy2 = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    expect(await load()).toBeNull();
    await expect(save(createInitialState())).resolves.toBeUndefined();
    spy.mockRestore();
    spy2.mockRestore();
  });
  it('migration v0 (sans version, sans own/order/extraItems) → v1', async () => {
    const { own: _o, order: _r, extraItems: _e, version: _v, ...v0 } = createInitialState();
    void _o; void _r; void _e; void _v;
    const migrated = migrate(v0) as { version: number };
    expect(migrated.version).toBe(1);
    localStorage.setItem(KIT_STORAGE_KEY, JSON.stringify({ ...v0, version: 0 }));
    expect(await load()).toEqual(createInitialState());
    expect(migrate('x')).toBe('x');
    expect(migrate({ version: 7 })).toEqual({ version: 7 });
  });
  it(`sauvegarde différée de ${SAVE_DELAY_MS} ms, regroupée`, async () => {
    S().setMod('tool', true);
    S().setMod('flask', true);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    expect(localStorage.getItem(KIT_STORAGE_KEY)).toBeNull();
    await vi.advanceTimersByTimeAsync(2);
    expect(await load()).toEqual(S().kit);
  });
  it('flush écrit immédiatement', async () => {
    S().setMod('tool', true);
    await S().flush();
    expect(await load()).toEqual(S().kit);
  });
  it('hors ligne : aucun appel réseau', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    S().setMod('tool', true);
    await S().flush();
    await S().hydrate();
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ dockOpen: false, pendingOpen: null, sheet: null, view: 'cards', mode: 'content' });
  });
  it('ouverture automatique si rien d autre n a eu lieu', () => {
    const t = useUiStore.getState().armOpen();
    expect(AUTO_OPEN_MS).toBe(750);
    expect(useUiStore.getState().commitOpen(t)).toBe(true);
    expect(useUiStore.getState().dockOpen).toBe(true);
  });
  it('anti-course : une action utilisateur annule l ouverture automatique', () => {
    const t = useUiStore.getState().armOpen();
    useUiStore.getState().setDockOpen(false);
    expect(useUiStore.getState().commitOpen(t)).toBe(false);
    expect(useUiStore.getState().dockOpen).toBe(false);
    const t2 = useUiStore.getState().armOpen();
    useUiStore.getState().openSheet('bilan');
    expect(useUiStore.getState().commitOpen(t2)).toBe(false);
  });
  it('un nouveau jeton remplace l ancien', () => {
    const a = useUiStore.getState().armOpen();
    const b = useUiStore.getState().armOpen();
    expect(useUiStore.getState().commitOpen(a)).toBe(false);
    expect(useUiStore.getState().commitOpen(b)).toBe(true);
  });
  it('feuille : ouverture, page, fermeture', () => {
    useUiStore.getState().openSheet('item', 'tent1');
    expect(useUiStore.getState().sheet).toEqual({ kind: 'item', id: 'tent1', page: 0 });
    useUiStore.getState().setSheetPage(2);
    expect(useUiStore.getState().sheet?.page).toBe(2);
    useUiStore.getState().closeSheet();
    expect(useUiStore.getState().sheet).toBeNull();
  });
});
