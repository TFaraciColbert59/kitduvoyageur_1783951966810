// Store du kit (zustand, sans middleware persist) : état KitState + actions qui appellent le domaine PUR.
// Chaque action renvoie le résultat du domaine pour que l'UI réagisse (haptique, clignotement) sans toast.
// Sauvegarde différée de 300 ms via le repository ; annulation par instantanés (20 max).
import { create } from 'zustand';
import { addPlanned, swapItem } from '../domain/swap';
import { autopack, pack, setBag, unpack } from '../domain/packing';
import type { PackResult } from '../domain/packing';
import { confirmOrder, toOrder } from '../domain/order';
import { toggleModule } from '../domain/attach';
import { setMod } from '../domain/parts';
import { createInitialState, currentKit } from '../domain/state';
import type { Alternative, BagId, KitId, ModuleId, PartNameId, ZoneId } from '../domain/catalog';
import type { AnyItemId, KitState } from '../domain/types';
import * as repo from '../services/kitRepository';
import { setPartOption } from './partOption';
import type { OptionCat, OptionResult } from './partOption';

export const SAVE_DELAY_MS = 300;
export const UNDO_MAX = 20;

export interface ActionResult { readonly ok: boolean; readonly reason?: string }

interface KitStore {
  readonly kit: KitState;
  readonly hydrated: boolean;
  readonly undoStack: readonly KitState[];
  readonly canUndo: boolean;

  hydrate(): Promise<void>;
  /** Applique un état produit par une feuille (domaine pur) ; annulable par défaut. */
  apply(next: KitState, undoable?: boolean): boolean;
  undo(): boolean;
  /** Écrit tout de suite l'état en attente (fin de session, passage en arrière-plan). */
  flush(): Promise<void>;

  pack(id: AnyItemId, zone: ZoneId): PackResult;
  unpack(id: AnyItemId): ActionResult;
  swap(oldId: AnyItemId, newId: AnyItemId, alt?: Alternative): ActionResult;
  setBag(bag: BagId): { ok: boolean; moved: number };
  autopack(): ActionResult;
  setMod(m: ModuleId, on: boolean): ActionResult;
  toggleModule(m: ModuleId, on: boolean): ActionResult;
  setPartOption(part: PartNameId, cat: OptionCat, value: string): OptionResult;
  confirmOrder(): ActionResult;
  switchKit(id: KitId): ActionResult;
  setDay(day: number): ActionResult;
}

let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(get: () => KitStore): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void repo.save(get().kit);
  }, SAVE_DELAY_MS);
}

export const useKitStore = create<KitStore>()((set, get) => {
  /** Applique un nouvel état. `undoable` : empile l'ancien état (au plus UNDO_MAX). */
  const commit = (next: KitState, undoable: boolean): boolean => {
    const prev = get().kit;
    if (next === prev) return false;
    if (undoable) {
      const stack = [...get().undoStack, prev].slice(-UNDO_MAX);
      set({ kit: next, undoStack: stack, canUndo: true });
    } else {
      set({ kit: next });
    }
    scheduleSave(get);
    return true;
  };

  return {
    kit: createInitialState(),
    hydrated: false,
    undoStack: [],
    canUndo: false,

    apply(next, undoable = true) {
      return commit(next, undoable);
    },

    async hydrate() {
      const saved = await repo.load();
      set({ kit: saved ?? createInitialState(), hydrated: true, undoStack: [], canUndo: false });
    },

    undo() {
      const stack = get().undoStack;
      const last = stack[stack.length - 1];
      if (!last) return false;
      const cur = get().kit;
      // Le kit affiché et le jour ne reviennent pas en arrière : seul le contenu est annulé.
      const restored: KitState = { ...last, kitId: cur.kitId, day: cur.day };
      const rest = stack.slice(0, -1);
      set({ kit: restored, undoStack: rest, canUndo: rest.length > 0 });
      scheduleSave(get);
      return true;
    },

    async flush() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      await repo.save(get().kit);
    },

    pack(id, zone) {
      const r = pack(get().kit, id, zone);
      if (r.ok) commit(r.state, true);
      return r;
    },

    unpack(id) {
      return { ok: commit(unpack(get().kit, id), true) };
    },

    swap(oldId, newId, alt) {
      let s = get().kit;
      if (alt) s = addPlanned(s, alt).state;
      const next = swapItem(s, oldId, newId);
      if (next === s) return { ok: false, reason: 'swap' };
      return { ok: commit(next, true) };
    },

    setBag(bag) {
      const r = setBag(get().kit, bag);
      const changed = currentKit(r.state).bag !== currentKit(get().kit).bag;
      if (changed) commit(r.state, true);
      return { ok: changed, moved: r.moved };
    },

    autopack() {
      return { ok: commit(autopack(get().kit), true) };
    },

    setMod(m, on) {
      return { ok: commit(setMod(get().kit, m, on), true) };
    },

    toggleModule(m, on) {
      const ok = commit(toggleModule(get().kit, m, on), true);
      return ok ? { ok } : { ok, reason: 'points' };
    },

    setPartOption(part, cat, value) {
      const r = setPartOption(get().kit, part, cat, value);
      if (r.ok) commit(r.state, true);
      return r;
    },

    confirmOrder() {
      const s = get().kit;
      if (toOrder(s).length === 0) return { ok: false, reason: 'empty' };
      return { ok: commit(confirmOrder(s), true) };
    },

    switchKit(id) {
      const s = get().kit;
      if (s.kitId === id) return { ok: false };
      return { ok: commit({ ...s, kitId: id, day: 1 }, false) };
    },

    setDay(day) {
      const s = get().kit;
      const max = currentKit(s).days;
      const d = Math.min(Math.max(1, Math.round(day)), max);
      if (d === s.day) return { ok: false };
      return { ok: commit({ ...s, day: d }, false) };
    },
  };
});
