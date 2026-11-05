// État d'interface (éphémère, non persisté) : tiroir, vue, mode, sélection, feuille ouverte.
import { create } from 'zustand';
import type { Deck } from '../domain/deck';

export type View = 'cards' | 'sheet' | 'deck';
export type Mode = 'content' | 'appearance';
export type SheetKind = 'bilan' | 'item' | 'bag' | 'part' | 'order' | 'deck';
export interface SheetState { readonly kind: SheetKind; readonly id?: string; readonly page: number }

/** Délai de l'ouverture automatique du tiroir (ms). */
export const AUTO_OPEN_MS = 750;

interface UiStore {
  readonly dockOpen: boolean;
  readonly view: View;
  readonly mode: Mode;
  readonly family: string | null;
  readonly category: string | null;
  readonly part: string | null;
  readonly sheet: SheetState | null;
  /** Deck « Remplir le sac » / « Débrief » en cours (null = aucun). */
  readonly deck: Deck | null;
  /** Jeton de l'ouverture automatique armée (null = rien en attente). */
  readonly pendingOpen: number | null;

  setDockOpen(open: boolean): void;
  setView(v: View): void;
  setMode(m: Mode): void;
  setFamily(f: string | null): void;
  setCategory(c: string | null): void;
  setPart(p: string | null): void;
  openSheet(kind: SheetKind, id?: string): void;
  setDeck(deck: Deck | null): void;
  setSheetPage(page: number): void;
  closeSheet(): void;
  /** Arme l'ouverture automatique ; renvoie son jeton. */
  armOpen(): number;
  /** À l'échéance : ouvre le tiroir seulement si le jeton est toujours le bon. Renvoie true si ouvert. */
  commitOpen(token: number): boolean;
  /** Toute action utilisateur déjà faite annule l'ouverture automatique. */
  cancelOpen(): void;
}

let seq = 0;

export const useUiStore = create<UiStore>()((set, get) => ({
  dockOpen: false,
  view: 'cards',
  mode: 'content',
  family: null,
  category: null,
  part: null,
  sheet: null,
  deck: null,
  pendingOpen: null,

  setDockOpen: (open) => set({ dockOpen: open, pendingOpen: null }),
  setView: (view) => set({ view, pendingOpen: null }),
  setMode: (mode) => set({ mode, pendingOpen: null }),
  setFamily: (family) => set({ family, pendingOpen: null }),
  setCategory: (category) => set({ category, pendingOpen: null }),
  setPart: (part) => set({ part, pendingOpen: null }),
  openSheet: (kind, id) => set({ sheet: id === undefined ? { kind, page: 0 } : { kind, id, page: 0 }, pendingOpen: null }),
  setSheetPage: (page) => {
    const sheet = get().sheet;
    if (sheet) set({ sheet: { ...sheet, page } });
  },
  closeSheet: () => set({ sheet: null }),
  setDeck: (deck) => set({ deck, pendingOpen: null }),

  armOpen: () => {
    const token = ++seq;
    set({ pendingOpen: token });
    return token;
  },
  commitOpen: (token) => {
    if (get().pendingOpen !== token) return false;
    set({ dockOpen: true, pendingOpen: null });
    return true;
  },
  cancelOpen: () => set({ pendingOpen: null }),
}));
