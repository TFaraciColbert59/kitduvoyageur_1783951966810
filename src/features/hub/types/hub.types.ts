export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface HubAlert {
  id: string;
  source: 'gear' | 'weather' | 'route' | 'participant' | 'safety' | 'system';
  severity: AlertSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  createdAt: string;
  expiresAt?: string;
  isDismissed?: boolean;
}

export interface TrekCountdown {
  targetDate: string; // ISO 8601
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isOverdue: boolean;
}

export interface PrepBreakdown {
  gearScore: number;        // max 35 pts
  weatherScore: number;     // max 25 pts
  safetyScore: number;      // max 25 pts
  routeOfflineScore: number;// max 15 pts
}

export interface BaseCampState {
  trekId: string | null;
  trekName: string;
  destination: string;
  departureDate: string | null;
  countdown: TrekCountdown | null;
  prepScore: number; // 0 - 100
  prepBreakdown: PrepBreakdown;
  activeAlerts: HubAlert[];
  lastSyncAt: string | null;
}

export interface ActionTrackPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: number;
}

export interface NextWaterPoint {
  name: string;
  distanceMeters: number;
  elevationDeltaMeters: number;
  estimatedTimeMinutes: number;
  isReliable: boolean;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface ActionState {
  startTime: number | null;
  elapsedSeconds: number;
  isPaused: boolean;
  currentPosition: ActionTrackPoint | null;
  headingDegrees: number | null;
  altitudeMeters: number | null;
  elevationGainMeters: number;
  distanceTraveledKm: number;
  nextWater: NextWaterPoint | null;
  hydrationLevelPercent: number; // 0 - 100
  batteryLevel: number | null; // 0 - 1
  isUltraSaveActive: boolean;
  sosState: 'idle' | 'arming' | 'triggered' | 'cancelled';
  sosArmingProgress: number; // 0 - 1
}

export interface HubStoreState {
  isTrekActive: boolean;
  activeTrekId: string | null;
  baseCamp: BaseCampState;
  action: ActionState;
  isOnline: boolean;
  gpsStatus: 'CHECKING' | 'AUTHORIZED' | 'DENIED' | 'UNAVAILABLE' | 'PROMPT';
  isStale: boolean;

  // Actions
  setTrekActive: (active: boolean, trekId?: string) => void;
  updateBaseCamp: (partial: Partial<BaseCampState>) => void;
  updateAction: (partial: Partial<ActionState>) => void;
  toggleUltraSave: (force?: boolean) => void;
  dismissAlert: (alertId: string) => void;
  startSosArming: () => void;
  updateSosArmingProgress: (progress: number) => void;
  cancelSosArming: () => void;
  triggerSos: () => Promise<void>;
  resetSos: () => void;
  refreshPrepScore: () => void;
}
