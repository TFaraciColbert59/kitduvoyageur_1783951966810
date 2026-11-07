// Store du kit (zustand, sans middleware persist) : état KitState + actions qui appellent le domaine PUR.
// Chaque action renvoie le résultat du domaine pour que l'UI réagisse (haptique, clignotement) sans toast.
// Sauvegarde différée de 600 ms (local + serveur si un handler est injecté) ; annulation par instantanés (20 max).
// Échec d'écriture serveur : retour à l'état enregistré + HUD « Non enregistré · réessaie » (sync='error').
import { create } from 'zustand';
import { addPlanned, swapItem } from '../domain/swap';
import { autopack, pack, setBag, unpack } from '../domain/packing';
import type { PackResult } from '../domain/packing';
import { confirmOrder, toOrder } from '../domain/order';
import { toggleModule } from '../domain/attach';
import { modOn, setMod } from '../domain/parts';
import { createInitialState, currentKit, registryHasKit } from '../domain/state';
import { isDemoStudioData } from '../domain/studioData';
import type { Alternative, BagId, KitId, ModuleId, PartNameId, ZoneId } from '../domain/catalog';
import type { AnyItemId, KitState } from '../domain/types';
import * as repo from '../services/kitRepository';
import { getStudioSyncHandler } from '../services/studioSync';
import { setPartOption } from './partOption';
import type { OptionCat, OptionResult } from './partOption';

export const SAVE_DELAY_MS = 600;
export const UNDO_MAX = 20;

/** État d'enregistrement affiché par le HUD du studio. */
export type SyncStatus = 'idle' | 'saving' | 'error';

export interface ActionResult { readonly ok: boolean; readonly reason?: string }

interface KitStore {
  readonly kit: KitState;
  readonly hydrated: boolean;
  /** Dernier état effectivement enregistré (local + serveur) : cible du retour arrière. */
  readonly lastSaved: KitState;
  /** État optimiste dont l'écriture serveur a échoué (rejoué par `retry`). */
  readonly failed: KitState | null;
  readonly sync: SyncStatus;
  readonly undoStack: readonly KitState[];
  readonly canUndo: boolean;

  hydrate(): Promise<void>;
  /** Applique un état produit par une feuille (domaine pur) ; annulable par défaut. */
  apply(next: KitState, undoable?: boolean): boolean;
  undo(): boolean;
  /** Écrit tout de suite l'état en attente (fin de session, passage en arrière-plan). */
  flush(): Promise<void>;
  /** Rejoue l'écriture optimiste qui a échoué (HUD « réessaie »). */
  retry(): Promise<boolean>;

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

type Get = () => KitStore;
type Set = (partial: Partial<KitStore>) => void;

/** Écrit l'état courant : d'abord le miroir local (hors-ligne), puis les écritures serveur. */
async function persist(get: Get, set: Set): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const target = get().kit;
  set({ sync: 'saving' });
  try {
    await repo.save(target);
    const handler = getStudioSyncHandler();
    if (handler) await handler(get().lastSaved, target);
    set({ lastSaved: target, failed: null, sync: 'idle' });
  } catch {
    // Échec réseau/RLS : l'écran revient à l'état réellement enregistré, la tentative est gardée
    // pour que « réessaie » la rejoue. Aucun état incohérent ne reste affiché.
    set({ kit: get().lastSaved, failed: target, sync: 'error', undoStack: [], canUndo: false });
  }
}

function scheduleSave(get: Get, set: Set): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void persist(get, set);
  }, SAVE_DELAY_MS);
}

/** L'état local est-il compatible avec le registre de données actif ? */
function compatibleWithRegistry(state: KitState): boolean {
  if (!registryHasKit(state.kitId)) return false;
  return Object.keys(state.kits).every((id) => registryHasKit(id as KitId));
}

export const useKitStore = create<KitStore>()((set, get) => {
  const initial = createInitialState();
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
    scheduleSave(get, set);
    return true;
  };

  return {
    kit: initial,
    hydrated: false,
    lastSaved: initial,
    failed: null,
    sync: 'idle',
    undoStack: [],
    canUndo: false,

    apply(next, undoable = true) {
      return commit(next, undoable);
    },

    async hydrate() {
      const saved = await repo.load();
      // Données de démonstration : le kit local est relu tel quel (comportement existant).
      // Données serveur : le kit local n'est relu que s'il est compatible avec le registre
      // (mêmes kits) ; sinon un état neuf est construit à partir de la donnée serveur.
      const usable = saved !== null && (isDemoStudioData() || compatibleWithRegistry(saved));
      const kit = usable ? saved : createInitialState();
      set({ kit, hydrated: true, lastSaved: kit, failed: null, sync: 'idle', undoStack: [], canUndo: false });
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
      scheduleSave(get, set);
      return true;
    },

    async flush() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      await persist(get, set);
    },

    async retry() {
      const failed = get().failed;
      if (!failed) return false;
      set({ kit: failed, failed: null, sync: 'idle' });
      await persist(get, set);
      return get().sync === 'idle';
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
      const cur = get().kit;
      const next = toggleModule(cur, m, on);
      // Le domaine renvoie le même état pour deux causes distinctes : module déjà dans l'état visé
      // (« noop ») ou points d'attache insuffisants (« points »). L'appelant doit pouvoir les distinguer.
      if (next === cur) return { ok: false, reason: modOn(cur, m) === on ? 'noop' : 'points' };
      commit(next, true);
      return { ok: true };
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
