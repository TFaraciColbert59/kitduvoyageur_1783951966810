/**
 * Types TypeScript pour la Section 1 "Le Hub" (Le Kit du Voyageur)
 * Architecture des États (Phase 1)
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Participant {
  name: string;
  initial: string;
  color: string;
  profileId?: string | null;
}

export interface SmartPromptAlert {
  id: string;
  category: 'weather' | 'checklist' | 'medical' | 'equipment' | 'water';
  severity: AlertSeverity;
  title: string;
  message: string;
  targetSection: 'map' | 'weather' | 'kit' | 'checklist' | 'consumables' | 'participants';
  actionLabel?: string;
  actionHref?: string;
  isDismissed?: boolean;
}

export interface TrekCountdown {
  targetDate: string; // ISO String
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string;
}

export interface PrepProgress {
  overallPercentage: number; // 0 - 100
  checklistChecked: number;
  checklistTotal: number;
  equipmentReady: boolean;
  medicalProfilesCompleted: number;
  medicalProfilesTotal: number;
  statusGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface GpsData {
  latitude: number | null;
  longitude: number | null;
  altitudeMeters: number | null;
  headingDegrees: number | null; // 0 - 360 pour la boussole
  speedKmh: number | null;
  accuracyMeters: number | null;
  lastUpdated: string | null;
}

export interface WaterPointInfo {
  id: string;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  isPotable: boolean;
  flowRate?: 'high' | 'medium' | 'low' | 'unknown';
  lat?: number;
  lng?: number;
}

export interface WaterGauge {
  currentLiters: number;
  maxLiters: number;
  percentage: number; // 0 - 100
  targetConsumptionPerHour: number; // Litres/h recommandé
  estimatedAutonomyHours: number;
}

export interface SosState {
  isHolding: boolean;
  holdProgress: number; // 0 - 100
  isTriggered: boolean;
  triggeredAt: string | null;
  emergencyContact: string | null;
  lastKnownCoordinates: { lat: number; lng: number } | null;
}

export interface BatteryStatus {
  level: number | null; // 0 - 100
  isCharging: boolean;
}

export interface WaypointInfo {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  etaMinutes: number;
}

export interface ChecklistItem {
  id?: string;
  name: string;
  category: string | null;
  weight_g: number;
  is_checked: boolean;
  is_worn?: boolean;
  is_consumable?: boolean;
  is_vital?: boolean;
  quantity?: number;
  photoUrl?: string | null;
  productHref?: string | null;
}

export interface WeightCategory {
  category: string;
  weightG: number;
  percentage: number;
  itemCount: number;
}

export interface TrekHubState {
  // Mode temporel principal
  isTrekActive: boolean; // False = Camp de Base (Prépa), True = Mode Action (Pendant Trek)
  isEcoMode: boolean; // Mode économie OLED (fond noir pur, 0 blur, 0 animations)
  battery: BatteryStatus;

  // Données globales Trek
  trekId: string;
  trekName: string;
  departureDate: string; // ISO

  // Mode Camp de Base
  countdown: TrekCountdown;
  prepProgress: PrepProgress;
  alerts: SmartPromptAlert[];
  items: ChecklistItem[];
  weightBreakdown: WeightCategory[];
  totalWeightG: number;

  // Mode Action (En marche / Survie)
  gps: GpsData;
  nextWaterPoint: WaterPointInfo | null;
  nextWaypoint: WaypointInfo | null;
  activeFieldAlert: SmartPromptAlert | null;
  waterGauge: WaterGauge;
  sos: SosState;

  // Actions du Store
  setTrekActive: (active: boolean) => void;
  toggleTrekActive: () => void;
  setEcoMode: (eco: boolean) => void;
  toggleEcoMode: () => void;
  updateBattery: (battery: Partial<BatteryStatus>) => void;
  updateGps: (data: Partial<GpsData>) => void;
  updateWaterLevel: (liters: number) => void;
  consumeWater: (amountLiters: number) => void;
  refillWater: (amountLiters?: number) => void;
  dismissAlert: (alertId: string) => void;
  addAlert: (alert: SmartPromptAlert) => void;
  setAlerts: (alerts: SmartPromptAlert[]) => void;
  setActiveFieldAlert: (alert: SmartPromptAlert | null) => void;
  setNextWaypoint: (wp: WaypointInfo | null) => void;
  toggleChecklistItem: (nameOrId: string) => void;
  setChecklistItems: (items: ChecklistItem[]) => void;
  setSosHolding: (isHolding: boolean, progress?: number) => void;
  triggerSos: () => void;
  cancelSos: () => void;
  refreshCountdown: () => void;
  initTrekHub: (initialData: Partial<TrekHubState>) => void;
}
