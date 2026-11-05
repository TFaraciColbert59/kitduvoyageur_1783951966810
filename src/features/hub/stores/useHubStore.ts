import { create } from 'zustand';
import { HubStoreState, BaseCampState, ActionState } from '../types/hub.types';
import { calculatePrepScore, calculateTrekCountdown } from '../services/prepScoreCalculator';

const HUB_STORAGE_KEY = 'lkdv_hub_state_v2';

const initialBaseCamp: BaseCampState = {
  trekId: null,
  trekName: '',
  destination: '',
  departureDate: null,
  countdown: null,
  prepScore: null,
  prepBreakdown: null,
  activeAlerts: [],
  lastSyncAt: null,
};

const initialAction: ActionState = {
  startTime: null,
  elapsedSeconds: 0,
  isPaused: false,
  currentPosition: null,
  headingDegrees: null,
  altitudeMeters: null,
  elevationGainMeters: 0,
  distanceTraveledKm: 0,
  nextWater: null,
  hydrationLevelPercent: null,
  batteryLevel: null,
  isUltraSaveActive: false,
  sosState: 'idle',
  sosArmingProgress: 0,
};

export function purgeLegacyHubStorage(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('lkdv_hub_state_v1');
    } catch {
      // Ignore
    }
  }
}

function loadStoredState(): Partial<HubStoreState> {
  purgeLegacyHubStorage();
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistState(state: HubStoreState) {
  if (typeof window === 'undefined') return;
  try {
    const toSave = {
      isTrekActive: state.isTrekActive,
      activeTrekId: state.activeTrekId,
      baseCamp: state.baseCamp,
      isUltraSaveActive: state.action.isUltraSaveActive,
    };
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage quota errors
  }
}

export const useHubStore = create<HubStoreState>((set, get) => {
  const stored = loadStoredState();

  const baseCampState: BaseCampState = {
    ...initialBaseCamp,
    ...(stored.baseCamp || {}),
    countdown: calculateTrekCountdown(stored.baseCamp?.departureDate || null),
  };

  const actionState: ActionState = {
    ...initialAction,
    isUltraSaveActive: stored.baseCamp ? Boolean((stored as any).isUltraSaveActive) : false,
  };

  return {
    isTrekActive: stored.isTrekActive ?? false,
    activeTrekId: stored.activeTrekId ?? null,
    baseCamp: baseCampState,
    action: actionState,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    gpsStatus: 'CHECKING',
    isStale: false,

    setTrekActive: (active: boolean, trekId?: string) => {
      set((state) => {
        const next = {
          ...state,
          isTrekActive: active,
          activeTrekId: trekId ?? state.activeTrekId,
          action: active
            ? {
                ...state.action,
                startTime: state.action.startTime ?? Date.now(),
                isPaused: false,
              }
            : state.action,
        };
        persistState(next);
        return next;
      });
    },

    updateBaseCamp: (partial) => {
      set((state) => {
        const updatedBaseCamp: BaseCampState = {
          ...state.baseCamp,
          ...partial,
          countdown: partial.departureDate
            ? calculateTrekCountdown(partial.departureDate)
            : state.baseCamp.countdown,
        };
        const next = { ...state, baseCamp: updatedBaseCamp };
        persistState(next);
        return next;
      });
    },

    updateAction: (partial) => {
      set((state) => ({
        ...state,
        action: { ...state.action, ...partial },
      }));
    },

    toggleUltraSave: (force) => {
      set((state) => {
        const nextVal = force !== undefined ? force : !state.action.isUltraSaveActive;
        const nextAction = { ...state.action, isUltraSaveActive: nextVal };
        const next = { ...state, action: nextAction };
        persistState(next);
        return next;
      });
    },

    dismissAlert: (alertId: string) => {
      set((state) => {
        const updatedAlerts = state.baseCamp.activeAlerts.map((a) =>
          a.id === alertId ? { ...a, isDismissed: true } : a
        );
        const next = {
          ...state,
          baseCamp: { ...state.baseCamp, activeAlerts: updatedAlerts },
        };
        persistState(next);
        return next;
      });
    },

    startSosArming: () => {
      set((state) => ({
        action: { ...state.action, sosState: 'arming', sosArmingProgress: 0 },
      }));
    },

    updateSosArmingProgress: (progress: number) => {
      set((state) => ({
        action: {
          ...state.action,
          sosArmingProgress: Math.min(1, Math.max(0, progress)),
          sosState: progress >= 1 ? 'triggered' : 'arming',
        },
      }));
    },

    cancelSosArming: () => {
      set((state) => ({
        action: { ...state.action, sosState: 'cancelled', sosArmingProgress: 0 },
      }));
    },

    triggerSos: async () => {
      set((state) => ({
        action: { ...state.action, sosState: 'triggered', sosArmingProgress: 1 },
      }));
    },

    resetSos: () => {
      set((state) => ({
        action: { ...state.action, sosState: 'idle', sosArmingProgress: 0 },
      }));
    },

    refreshPrepScore: () => {
      set((state) => {
        const { score, breakdown } = calculatePrepScore({
          gearTotal: 12,
          gearPacked: 10,
          vitalMissingCount: 0,
          hasWeather48h: true,
          weatherWarning: false,
          hasIceContact: true,
          hasMedicalProfile: true,
          isRouteCachedOffline: true,
        });

        const next = {
          ...state,
          baseCamp: {
            ...state.baseCamp,
            prepScore: score,
            prepBreakdown: breakdown,
            lastSyncAt: new Date().toISOString(),
          },
        };
        persistState(next);
        return next;
      });
    },
  };
});

const originalGetState = useHubStore.getState;
useHubStore.getState = () => {
  purgeLegacyHubStorage();
  return originalGetState();
};
