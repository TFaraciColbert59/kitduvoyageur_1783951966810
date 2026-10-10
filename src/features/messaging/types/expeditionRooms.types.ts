/**
 * LKDV Social — Expedition Rooms Domain Types & Cockpit Interfaces
 * File: src/features/messaging/types/expeditionRooms.types.ts
 */

import type { GPXSnapshot } from './outdoorObjects.types';

// ============================================================================
// 1. EXPEDITION ROOM STATUS & MODEL
// ============================================================================

export type ExpeditionRoomStatus = 'planning' | 'active' | 'completed' | 'archived';

export type ChecklistCategory =
  | 'gear'
  | 'safety'
  | 'food'
  | 'logistics'
  | 'navigation'
  | 'camp'
  | 'medical'
  | 'admin';

export interface ExpeditionLocation {
  latitude: number;
  longitude: number;
  label?: string;
  altitudeM?: number;
  elevationM?: number;
  name?: string;
}

export interface WeatherLocationData {
  latitude: number;
  longitude: number;
  locationName: string;
  elevationM?: number;
  currentTempC?: number;
  weatherCode?: number;
  windSpeedKmH?: number;
  freezingLevelM?: number;
  precipitationProbability?: number;
}

export interface ExpeditionChecklistItem {
  id: string;
  roomId?: string;
  label: string;
  isCompleted: boolean;
  assignedTo?: string | null;
  assignedName?: string | null;
  assignedToName?: string | null;
  assignedToAvatarUrl?: string | null;
  category: ChecklistCategory;
  weightGrams?: number;
  updatedBy?: string;
  updatedAt: string;
  dueDate?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
}

export type CheckInStatus = 'ok' | 'delayed' | 'sos' | 'camp_set';
export type FieldCheckInStatus = CheckInStatus;

export interface CheckInLocation {
  latitude: number;
  longitude: number;
  elevationM?: number;
  altitudeM?: number;
  name?: string;
  label?: string;
}

export interface FieldCheckIn {
  id: string;
  roomId?: string;
  conversationId?: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  status: CheckInStatus;
  location: CheckInLocation;
  batteryPercent?: number;
  batteryPct?: number;
  networkSignal?: 'strong' | 'weak' | 'satellite' | 'none';
  timestamp: string;
  message?: string;
}

export interface ExpeditionChecklistSummary {
  totalCount: number;
  completedCount: number;
  remainingCount: number;
  progressPercent: number;
}

export interface ExpeditionCheckinStatusSummary {
  latestStatus?: CheckInStatus;
  lastCheckinAt?: string;
  lastCheckinAuthorName?: string;
  totalCheckins: number;
  hasActiveAlert: boolean;
}

export interface ExpeditionRoom {
  id: string;
  conversationId: string;
  tripId?: string | null;
  title: string;
  status: ExpeditionRoomStatus;
  gpxTrackUrl?: string | null;
  gpxSnapshot?: GPXSnapshot | null;
  weatherLocation?: WeatherLocationData | ExpeditionLocation | null;
  checklistItems?: ExpeditionChecklistItem[];
  lastCheckIn?: FieldCheckIn | null;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// 2. CHECKLIST LOGIC & IMMUTABLE MUTATIONS
// ============================================================================

export function toggleChecklistItem(
  items: ExpeditionChecklistItem[],
  itemId: string,
  userId: string,
  timestamp: string = new Date().toISOString()
): ExpeditionChecklistItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      const nextCompleted = !item.isCompleted;
      return {
        ...item,
        isCompleted: nextCompleted,
        updatedBy: userId,
        updatedAt: timestamp,
        completedAt: nextCompleted ? timestamp : null,
        completedBy: nextCompleted ? userId : null,
      };
    }
    return item;
  });
}

export function assignChecklistItem(
  items: ExpeditionChecklistItem[],
  itemId: string,
  assignedTo: string | null,
  assignedName?: string | null
): ExpeditionChecklistItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        assignedTo: assignedTo || null,
        assignedName: assignedName || null,
        assignedToName: assignedName || null,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
}

export function calculateChecklistProgress(items: ExpeditionChecklistItem[]): {
  total: number;
  completed: number;
  percentage: number;
} {
  const total = items.length;
  if (total === 0) return { total: 0, completed: 0, percentage: 0 };
  const completed = items.filter((i) => i.isCompleted).length;
  const percentage = Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

export function computeChecklistSummary(
  items: ExpeditionChecklistItem[]
): ExpeditionChecklistSummary {
  const { total, completed, percentage } = calculateChecklistProgress(items);
  return {
    totalCount: total,
    completedCount: completed,
    remainingCount: total - completed,
    progressPercent: percentage,
  };
}

// ============================================================================
// 3. FIELD CHECK-IN LIFECYCLE & COORDINATES FORMATTING
// ============================================================================

export function formatEmergencyCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined
): string {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return 'Position non disponible — utilise l’application de ton téléphone pour communiquer ta position exacte au 112';
  }
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  const absLat = Number(Math.round(Number(Math.abs(lat) + 'e4')) + 'e-4').toFixed(4);
  const absLng = Number(Math.round(Number(Math.abs(lng) + 'e4')) + 'e-4').toFixed(4);
  return `${absLat}° ${latDir}, ${absLng}° ${lngDir}`;
}

export function getCheckInSeverity(
  status: CheckInStatus
): 'normal' | 'info' | 'warning' | 'critical' {
  switch (status) {
    case 'sos':
      return 'critical';
    case 'delayed':
      return 'warning';
    case 'camp_set':
      return 'info';
    case 'ok':
    default:
      return 'normal';
  }
}

export function formatCheckInBroadcast(checkIn: FieldCheckIn): {
  type: string;
  title: string;
  content: string;
  severity: 'normal' | 'info' | 'warning' | 'critical';
  emergencyCoordinates?: string;
} {
  const severity = getCheckInSeverity(checkIn.status);
  let title = 'Point de situation';
  let content = `${checkIn.authorName} : statut ${checkIn.status.toUpperCase()}`;

  if (checkIn.status === 'sos') {
    title = '🚨 ALERTE DETRESSE SOS';
    const coords = formatEmergencyCoordinates(
      checkIn.location.latitude,
      checkIn.location.longitude
    );
    content = `URGENCE signalée par ${checkIn.authorName} à ${coords}. ${
      checkIn.message || 'Assistance requise immédiatement.'
    }`;
    return {
      type: 'field_checkin_sos',
      title,
      content,
      severity,
      emergencyCoordinates: coords,
    };
  }

  if (checkIn.status === 'camp_set') {
    title = '⛺ Bivouac Établi';
    content = `${checkIn.authorName} a installé le campement pour la nuit (${
      checkIn.location.name || checkIn.location.label || 'Emplacement sécurisé'
    }).`;
  } else if (checkIn.status === 'delayed') {
    title = '⚠️ Retard Signalé';
    content = `${checkIn.authorName} signale un retard sur l'itinéraire prévu (${
      checkIn.message || 'Progression ralentie'
    }).`;
  } else if (checkIn.status === 'ok') {
    title = '✅ Tout Va Bien';
    content = `${checkIn.authorName} confirme que tout se déroule normalement.`;
  }

  return {
    type: `field_checkin_${checkIn.status}`,
    title,
    content,
    severity,
  };
}

export function computeCheckinSummary(
  checkins: FieldCheckIn[]
): ExpeditionCheckinStatusSummary {
  if (!checkins || checkins.length === 0) {
    return {
      totalCheckins: 0,
      hasActiveAlert: false,
    };
  }

  const sorted = [...checkins].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latest = sorted[0];
  const hasActiveAlert = sorted.some((c) => c.status === 'sos');

  return {
    latestStatus: latest.status,
    lastCheckinAt: latest.timestamp,
    lastCheckinAuthorName: latest.authorName,
    totalCheckins: sorted.length,
    hasActiveAlert,
  };
}

export interface CheckinBadgeVisual {
  label: string;
  badgeClass: string;
  dotColorClass: string;
  iconName: string;
}

export function getCheckinStatusBadgeInfo(status: CheckInStatus): CheckinBadgeVisual {
  switch (status) {
    case 'ok':
      return {
        label: 'OK · Progression normale',
        badgeClass: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
        dotColorClass: 'bg-emerald-500',
        iconName: 'check-circle',
      };
    case 'camp_set':
      return {
        label: 'Bivouac établi',
        badgeClass: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
        dotColorClass: 'bg-sky-500',
        iconName: 'tent',
      };
    case 'delayed':
      return {
        label: 'Retard sur planning',
        badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
        dotColorClass: 'bg-amber-500',
        iconName: 'clock',
      };
    case 'sos':
      return {
        label: 'ALERTE / SOS',
        badgeClass: 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40 animate-pulse',
        dotColorClass: 'bg-rose-600',
        iconName: 'alert-triangle',
      };
  }
}

// ============================================================================
// 4. TYPE GUARDS
// ============================================================================

export function isExpeditionRoom(obj: unknown): obj is ExpeditionRoom {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.conversationId === 'string' &&
    typeof r.title === 'string' &&
    typeof r.status === 'string'
  );
}

export function isFieldCheckIn(obj: unknown): obj is FieldCheckIn {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.authorId === 'string' &&
    typeof c.authorName === 'string' &&
    ['ok', 'delayed', 'sos', 'camp_set'].includes(c.status as string) &&
    typeof c.timestamp === 'string'
  );
}

export function isExpeditionChecklistItem(obj: unknown): obj is ExpeditionChecklistItem {
  if (!obj || typeof obj !== 'object') return false;
  const i = obj as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.label === 'string' &&
    typeof i.isCompleted === 'boolean' &&
    typeof i.category === 'string'
  );
}
