'use client';

import { create } from 'zustand';
import type {
  ActivityState,
  CameraIntent,
  Detent,
  ExplorerState,
  Level,
  PoiKind,
  Selection,
  SheetKind,
  Sport,
  ToastMessage,
} from './types';
import { LEVEL_ZOOM, SCENES, type SceneName } from './scenes';

export const DETENT_RATIO: Record<Detent, number> = {
  peek: 0,
  low: 0,
  mid: 0,
  full: 0,
};

interface ExplorerActions {
  hydrateFromScene: (scene: SceneName) => void;
  patch: (patch: Partial<ExplorerState>) => void;
  setLevel: (level: Level, center?: [number, number], geo?: string) => void;
  openCountry: (iso: string, center: [number, number], name?: string) => void;
  openRegion: (regionId: string, center: [number, number], name?: string) => void;
  openPlace: (placeId: string, center: [number, number], name?: string) => void;
  goUp: () => void;
  select: (selection: Selection, sheet: SheetKind, detent?: Detent) => void;
  clearSelection: () => void;
  setSheet: (sheet: SheetKind, detent?: Detent) => void;
  setDetent: (detent: Detent) => void;
  setTab: (tab: number) => void;
  setMini: (mini: 0 | 1) => void;
  setCenter: (center: [number, number], zoom: number) => void;
  setCamera: (camera: CameraIntent) => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: () => void;
  startActivity: (sport: Sport, sessionId?: string | null) => void;
  updateActivity: (patch: Partial<ActivityState>) => void;
  stopActivity: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleNorthUp: () => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  setMapBaseStyle: (style: 'relief' | 'satellite' | 'plan') => void;
  toggleLayer: (layerId: string) => void;
}

export type ExplorerStore = ExplorerState & ExplorerActions;

const initialState: ExplorerState = {
  level: 0,
  geo: '',
  sheet: 'level',
  detent: 'peek',
  tab: 0,
  mini: 0,
  camera: { type: 'none' },
  profile: null,
  easyMode: false,
  theme: 'light',
  online: true,
  locationPermission: 'prompt',
  orbitPaused: false,
  northUp: true,
  units: 'metric',
  reveal: false,
  background: false,
  center: [2.35, 48.85],
  zoom: 1.6,
  mapBaseStyle: 'relief',
  layerVisibility: {
    routes: true,
    water: true,
    refuges: true,
    dangers: true,
    snow: true,
    slope: false,
  },
};

let toastSeq = 0;

/**
 * Journal d'événements lu par `scripts/explorer-v2/click-inventory.mjs` et par
 * les tests Playwright (`window.__explorerEvents`). Instrumentation de test
 * uniquement : aucune donnée utilisateur, aucun envoi réseau.
 */
function emit(event: string, detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __explorerEvents?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.__explorerEvents)) w.__explorerEvents = [];
  w.__explorerEvents.push({ event, detail: detail ?? null, t: Date.now() });
}

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  ...initialState,

  hydrateFromScene: (sceneName) => {
    const preset = SCENES[sceneName];
    if (!preset) return;
    set({ ...(preset as Partial<ExplorerStore>), scene: sceneName });
    emit('scene', { scene: sceneName });
  },

  patch: (patch) => set(patch as Partial<ExplorerStore>),

  setLevel: (level, center, geo) => {
    set((state) => ({
      level,
      geo: geo ?? state.geo,
      center: center ?? state.center,
      zoom: LEVEL_ZOOM[level],
      camera: center ? { type: 'level', level, center } : state.camera,
    }));
    emit('level', { level });
  },

  openCountry: (iso, center, name) => {
    set({
      level: 1,
      geo: iso,
      regionId: undefined,
      placeId: undefined,
      selection: undefined,
      center,
      zoom: LEVEL_ZOOM[1],
      sheet: 'level',
      detent: 'peek',
      tab: 0,
      camera: { type: 'level', level: 1, center },
    });
    emit('open-country', { iso, name });
  },

  openRegion: (regionId, center, name) => {
    set({
      level: 2,
      regionId,
      placeId: undefined,
      selection: undefined,
      center,
      zoom: LEVEL_ZOOM[2],
      sheet: 'level',
      detent: 'low',
      tab: 0,
      camera: { type: 'level', level: 2, center },
    });
    emit('open-region', { regionId, name });
  },

  openPlace: (placeId, center, name) => {
    set({
      level: 3,
      placeId,
      selection: undefined,
      center,
      zoom: LEVEL_ZOOM[3],
      sheet: 'level',
      detent: 'peek',
      tab: 0,
      camera: { type: 'level', level: 3, center },
    });
    emit('open-place', { placeId, name });
  },

  goUp: () => {
    const { level } = get();
    const next = (level > 0 ? level - 1 : 0) as Level;
    set({
      level: next,
      regionId: next < 2 ? undefined : get().regionId,
      placeId: next < 3 ? undefined : get().placeId,
      selection: undefined,
      sheet: 'level',
      detent: next === 0 ? 'peek' : 'low',
      tab: 0,
      camera: { type: 'level', level: next, center: get().center },
    });
    emit('go-up', { level: next });
  },

  select: (selection, sheet, detent = 'mid') => {
    const center = get().center;
    set({
      selection,
      sheet,
      detent,
      tab: 0,
      reveal: true,
      camera:
        selection.kind === 'trail'
          ? { type: 'flyover', routeId: selection.id }
          : { type: 'reveal', center },
    });
    emit('select', { kind: selection.kind, id: selection.id, sheet });
  },

  clearSelection: () => set({ selection: undefined, sheet: 'level', detent: 'peek' }),

  setSheet: (sheet, detent) => {
    set({ sheet, detent: detent ?? get().detent });
    emit('sheet', { sheet, detent: detent ?? null });
  },

  setDetent: (detent) => {
    set({ detent });
    emit('detent', { detent });
  },

  setTab: (tab) => {
    set({ tab });
    emit('tab', { tab });
  },

  setMini: (mini) => {
    set({ mini });
    emit('mini', { mini });
  },

  setCenter: (center, zoom) => set({ center, zoom }),

  setCamera: (camera) => set({ camera }),

  showToast: (toast) => {
    toastSeq += 1;
    set({ toast: { ...toast, id: toastSeq } });
    emit('toast', { title: toast.title });
  },

  dismissToast: () => set({ toast: undefined }),

  startActivity: (sport, sessionId = null) => {
    const activity: ActivityState = {
      sport,
      sessionId,
      startedAt: Date.now(),
      paused: false,
      offRoute: false,
      distanceM: 0,
      elevGainM: 0,
      movingS: 0,
    };
    set({ activity, sheet: 'live', detent: 'peek', camera: { type: 'follow' } });
    emit('activity-start', { sport, sessionId });
  },

  updateActivity: (patch) =>
    set((state) => (state.activity ? { activity: { ...state.activity, ...patch } } : {})),

  stopActivity: () => {
    const current = get().activity;
    set({
      activity: undefined,
      summary: current ? { ...current, endedAt: Date.now() } : null,
      summarySaved: 'pending',
      sheet: 'summary',
      detent: 'full',
      camera: { type: 'overview' },
    });
    emit('activity-stop', {});
  },

  setTheme: (theme) => set({ theme }),

  toggleNorthUp: () => {
    const next = !get().northUp;
    set({ northUp: next, camera: { type: 'bearing', northUp: next } });
    emit('compass', { northUp: next });
  },

  setUnits: (units) => set({ units }),

  setMapBaseStyle: (mapBaseStyle) => {
    set({ mapBaseStyle });
    emit('map-style', { style: mapBaseStyle });
  },

  toggleLayer: (layerId) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerId]: !state.layerVisibility?.[layerId],
      },
    })),
}));

export type { PoiKind };
