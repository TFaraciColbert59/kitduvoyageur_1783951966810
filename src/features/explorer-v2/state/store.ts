'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type {
  ActivityState,
  CameraIntent,
  Detent,
  ExplorerState,
  Level,
  PendingStart,
  PoiKind,
  Selection,
  SheetKind,
  Sport,
  SportSelection,
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
  setMini: (mini: number) => void;
  setCenter: (center: [number, number], zoom: number) => void;
  setCamera: (camera: CameraIntent) => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: () => void;
  startActivity: (sport: Sport, sessionId?: string | null, selection?: SportSelection) => void;
  updateActivity: (patch: Partial<ActivityState>) => void;
  stopActivity: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleNorthUp: () => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  setMapBaseStyle: (style: 'relief' | 'satellite' | 'plan') => void;
  toggleLayer: (layerId: string) => void;
  /** Réglage local de préparation : active ou coupe la pause automatique. */
  setAutoPauseEnabled: (enabled: boolean) => void;
}

export type ExplorerStore = ExplorerState & ExplorerActions;

/** Clé locale du réglage de préparation de l'Explorer v2. */
export const AUTO_PAUSE_STORAGE_KEY = 'lkdv.explorer.pauseAuto';

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
  // S1.05 : décision produit retenue, détection active par défaut et
  // désactivable depuis le drawer de préparation. OFF seulement après un choix
  // explicite de l'utilisateur (la fiche exige la désactivabilité, pas le ON).
  autoPauseEnabled: true,
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

function activityStarted(
  sport: Sport,
  sessionId: string | null,
  selection?: SportSelection,
): ActivityState {
  return {
    sport,
    ...(selection ? { selection } : {}),
    sessionId,
    startedAt: Date.now(),
    paused: false,
    autoPaused: false,
    offRoute: false,
    distanceM: 0,
    elevGainM: 0,
    movingS: 0,
  };
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

  startActivity: (sport, sessionId = null, selection) => {
    const activity = activityStarted(sport, sessionId, selection);
    set({
      activity,
      sheet: 'live',
      detent: 'peek',
      camera: { type: 'follow' },
    });
    emit('activity-start', {
      sport,
      sessionId,
      variantId: selection?.variantId ?? null,
    });
  },

  updateActivity: (patch) =>
    set((state) => (state.activity ? { activity: { ...state.activity, ...patch } } : {})),

  stopActivity: () => {
    const current = get().activity;
    set({
      activity: undefined,
      summary: current ? { ...current, endedAt: Date.now() } : null,
      // Sans UUID serveur, le bilan est local : ne jamais suggérer un problème
      // de connexion à un utilisateur authentifié.
      summarySaved: current?.sessionId ? 'pending' : 'local',
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

  setAutoPauseEnabled: (enabled) => {
    set({ autoPauseEnabled: enabled });
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTO_PAUSE_STORAGE_KEY, enabled ? '1' : '0');
      }
    } catch {
      /* stockage indisponible : le réglage reste valable pour la session */
    }
    emit('auto-pause-setting', { enabled });
  },
}));

/**
 * Applique la préférence de pause automatique stockée localement.
 *
 * Appelée après le montage (jamais pendant le rendu serveur). Le défaut
 * initial est ON (S1.05 : détection active, désactivable). Une valeur stockée
 * `0`/`false` coupe la fonction, `1`/`true` la réactive. Sans clé — ou si le
 * stockage est indisponible — l'état courant n'est **pas** écrasé : un OFF
 * explicite de la session survit au remontage même quand `localStorage` ne
 * peut pas le persister (mode privé, quota, politique navigateur).
 */
export function hydrateAutoPausePreference(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(AUTO_PAUSE_STORAGE_KEY);
    if (raw === '0' || raw === 'false') {
      useExplorerStore.setState({ autoPauseEnabled: false });
    } else if (raw === '1' || raw === 'true') {
      useExplorerStore.setState({ autoPauseEnabled: true });
    }
  } catch {
    /* stockage indisponible : le réglage de session reste inchangé */
  }
}

export interface TransientStart {
  pendingStart: PendingStart | null;
  requestStart: (sport: Sport, selection?: SportSelection) => void;
  confirmStart: () => void;
  cancelStart: () => void;
}

/**
 * Brouillon de départ lié au montage de l’Explorer.
 *
 * Il vit dans l’état React du composant, jamais dans le store global : une
 * navigation qui démonte Explorer annule donc le compte à rebours et aucun
 * départ ne peut repartir tout seul au retour. `pendingRef` rend `confirmStart`
 * stable et bloque un double départ.
 */
export function useTransientStart(): TransientStart {
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);
  const pendingRef = useRef<PendingStart | null>(null);

  const cancelStart = useCallback(() => {
    pendingRef.current = null;
    setPendingStart(null);
  }, []);

  const requestStart = useCallback((sport: Sport, selection?: SportSelection) => {
    const next: PendingStart = { sport, selection };
    pendingRef.current = next;
    setPendingStart(next);
  }, []);

  const confirmStart = useCallback(() => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPendingStart(null);
    useExplorerStore.getState().startActivity(current.sport, null, current.selection);
  }, []);

  useEffect(
    () => () => {
      // Le démontage d’Explorer jette le brouillon, sans effet de bord.
      pendingRef.current = null;
    },
    [],
  );

  return { pendingStart, requestStart, confirmStart, cancelStart };
}

export type { PoiKind };
