'use client';

import { useSyncExternalStore } from 'react';
import {
  DISCOVERY_STEPS,
  getStepsForSurface,
  resolveDiscoverySurface,
  type DiscoveryStep,
} from './catalog';

export interface DiscoveryPersistedState {
  enabled: boolean;
  /** Repères validés par interaction directe sur l'élément ciblé. */
  completedIds: string[];
  /** Repères déjà présentés puis repliés (auto ou swipe) — ne reviennent pas. */
  dismissedIds: string[];
  updatedAt: number;
}

export interface DiscoveryRuntimeState extends DiscoveryPersistedState {
  /** Identifiant du repère actuellement affiché (strictement 0 ou 1 globalement). */
  activeStepId: string | null;
  /** Timestamp avant lequel aucun nouveau repère ne peut se déclencher. */
  cooldownUntil: number;
}

const STORAGE_KEY = 'lkdv_discovery_v1';

/** Délai doux après arrivée sur une page avant d'afficher le premier repère. */
export const DISCOVERY_ENTRY_DELAY_MS = 900;

/** Temps calme obligatoire entre deux repères sur la même surface. */
export const DISCOVERY_COOLDOWN_MS = 3200;

const DEFAULT_PERSISTED: DiscoveryPersistedState = {
  enabled: true,
  completedIds: [],
  dismissedIds: [],
  updatedAt: 0,
};

let state: DiscoveryRuntimeState = {
  ...DEFAULT_PERSISTED,
  activeStepId: null,
  cooldownUntil: 0,
};

let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Un abonné défaillant ne doit jamais bloquer les autres
    }
  });
}

function readStorage(): DiscoveryPersistedState {
  if (typeof window === 'undefined') return DEFAULT_PERSISTED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED;
    const parsed = JSON.parse(raw) as Partial<DiscoveryPersistedState>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      completedIds: Array.isArray(parsed.completedIds)
        ? parsed.completedIds.filter((x): x is string => typeof x === 'string')
        : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((x): x is string => typeof x === 'string')
        : [],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_PERSISTED;
  }
}

function writeStorage(next: DiscoveryPersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* stockage privé / plein : l'état mémoire continue de fonctionner */
  }
}

export function hydrateDiscoveryState(): void {
  if (hydratedFromStorage || typeof window === 'undefined') return;
  hydratedFromStorage = true;
  const persisted = readStorage();
  state = {
    ...state,
    ...persisted,
  };
  emit();
}

export function getDiscoverySnapshot(): DiscoveryRuntimeState {
  return state;
}

export function subscribeDiscovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDiscoveryState(): DiscoveryRuntimeState {
  return useSyncExternalStore(
    subscribeDiscovery,
    getDiscoverySnapshot,
    () => state,
  );
}

export interface PickDiscoveryOptions {
  /** Vrai si un tiroir modal (Communauté, Création, Compte, Club…) est ouvert au premier plan. */
  modalDrawerOpen?: boolean;
  /** Vrai si un tiroir docké (ex. Explorer en mid/full) est actuellement déployé. */
  drawerExpanded?: boolean;
}

/**
 * Sélectionne le prochain repère éligible pour le `pathname` courant,
 * en respectant l'ordre strict et en vérifiant que l'ancre est disponible.
 *
 * Priorité contextuelle :
 * - Si un tiroir modal est ouvert, seuls les repères universels `'drawer'` sont
 *   proposés (jamais un bouton masqué derrière le tiroir).
 * - Si un tiroir docké est déployé (ex. Explorer `mid`/`full`), les repères `'drawer'`
 *   passent en priorité devant les contrôles de la carte derrière.
 * - Sinon, on joue d'abord les repères de la page, puis les repères `'drawer'` visibles.
 */
export function pickNextDiscoveryStep(
  pathname: string | null | undefined,
  current: DiscoveryRuntimeState,
  isAnchorAvailable: (anchor: string) => boolean,
  options: PickDiscoveryOptions = {},
): DiscoveryStep | null {
  if (!current.enabled) return null;
  if (current.activeStepId) return null;

  const seen = new Set([...current.completedIds, ...current.dismissedIds]);
  const drawerCandidates = getStepsForSurface('drawer');

  const pickFirstAvailable = (steps: DiscoveryStep[]): DiscoveryStep | null => {
    for (const step of steps) {
      if (seen.has(step.id)) continue;
      if (isAnchorAvailable(step.anchor)) return step;
    }
    return null;
  };

  if (options.modalDrawerOpen) {
    return pickFirstAvailable(drawerCandidates);
  }

  const surface = resolveDiscoverySurface(pathname);
  const pageCandidates = surface ? getStepsForSurface(surface) : [];

  if (options.drawerExpanded) {
    return pickFirstAvailable(drawerCandidates) ?? pickFirstAvailable(pageCandidates);
  }

  return pickFirstAvailable(pageCandidates) ?? pickFirstAvailable(drawerCandidates);
}

export function activateDiscoveryStep(stepId: string): boolean {
  if (!state.enabled) return false;
  if (state.activeStepId && state.activeStepId !== stepId) return false;
  if (state.completedIds.includes(stepId) || state.dismissedIds.includes(stepId)) {
    return false;
  }
  state = {
    ...state,
    activeStepId: stepId,
  };
  emit();
  return true;
}

/** Valide un repère (l'utilisateur a interagi avec l'élément ciblé). */
export function completeDiscoveryStep(
  stepId: string,
  nowMs: number = Date.now(),
): void {
  const completedIds = state.completedIds.includes(stepId)
    ? state.completedIds
    : [...state.completedIds, stepId];
  const dismissedIds = state.dismissedIds.filter((id) => id !== stepId);
  const persisted: DiscoveryPersistedState = {
    enabled: state.enabled,
    completedIds,
    dismissedIds,
    updatedAt: nowMs,
  };
  state = {
    ...persisted,
    activeStepId: state.activeStepId === stepId ? null : state.activeStepId,
    cooldownUntil: nowMs + DISCOVERY_COOLDOWN_MS,
  };
  writeStorage(persisted);
  emit();
}

/** Replie un repère sans bloquer (timeout doux ou swipe vers le haut). */
export function dismissDiscoveryStep(
  stepId: string,
  nowMs: number = Date.now(),
): void {
  const dismissedIds =
    state.dismissedIds.includes(stepId) || state.completedIds.includes(stepId)
      ? state.dismissedIds
      : [...state.dismissedIds, stepId];
  const persisted: DiscoveryPersistedState = {
    enabled: state.enabled,
    completedIds: state.completedIds,
    dismissedIds,
    updatedAt: nowMs,
  };
  state = {
    ...persisted,
    activeStepId: state.activeStepId === stepId ? null : state.activeStepId,
    cooldownUntil: nowMs + DISCOVERY_COOLDOWN_MS,
  };
  writeStorage(persisted);
  emit();
}

/** Suspend silencieusement le repère affiché sans le marquer vu (ex: ouverture d'un modal). */
export function pauseActiveDiscoveryStep(): void {
  if (!state.activeStepId) return;
  state = {
    ...state,
    activeStepId: null,
  };
  emit();
}

export function setDiscoveryEnabled(enabled: boolean, nowMs: number = Date.now()): void {
  const persisted: DiscoveryPersistedState = {
    enabled,
    completedIds: state.completedIds,
    dismissedIds: state.dismissedIds,
    updatedAt: nowMs,
  };
  state = {
    ...persisted,
    activeStepId: enabled ? state.activeStepId : null,
    cooldownUntil: enabled ? nowMs + 400 : state.cooldownUntil,
  };
  writeStorage(persisted);
  emit();
}

export function resetDiscovery(nowMs: number = Date.now()): void {
  const persisted: DiscoveryPersistedState = {
    enabled: true,
    completedIds: [],
    dismissedIds: [],
    updatedAt: nowMs,
  };
  state = {
    ...persisted,
    activeStepId: null,
    cooldownUntil: nowMs + 500,
  };
  writeStorage(persisted);
  emit();
}

/** Calcule l'avancement global pour l'affichage dans Paramètres. */
export function getDiscoveryProgress(current: DiscoveryRuntimeState): {
  seenCount: number;
  completedCount: number;
  totalCount: number;
} {
  const totalCount = DISCOVERY_STEPS.length;
  const seen = new Set([...current.completedIds, ...current.dismissedIds]);
  const validIds = new Set(DISCOVERY_STEPS.map((s) => s.id));
  let seenCount = 0;
  let completedCount = 0;
  for (const id of seen) {
    if (validIds.has(id)) seenCount += 1;
  }
  for (const id of current.completedIds) {
    if (validIds.has(id)) completedCount += 1;
  }
  return { seenCount, completedCount, totalCount };
}

/** Utilitaire réservé aux tests unitaires pour repartir d'un état propre. */
export function __resetDiscoveryStoreForTest(): void {
  hydratedFromStorage = false;
  state = {
    ...DEFAULT_PERSISTED,
    activeStepId: null,
    cooldownUntil: 0,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible en test
    }
  }
  emit();
}
