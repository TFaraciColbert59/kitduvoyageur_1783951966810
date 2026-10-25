import { PrepBreakdown, TrekCountdown } from '../types/hub.types';

export interface PrepScoreInput {
  gearTotal: number;
  gearPacked: number;
  vitalMissingCount: number;
  hasWeather48h: boolean;
  weatherWarning: boolean;
  hasIceContact: boolean;
  hasMedicalProfile: boolean;
  isRouteCachedOffline: boolean;
}

/**
 * Calculates countdown until trek departure.
 */
export function calculateTrekCountdown(departureDateStr: string | null, now: number = Date.now()): TrekCountdown | null {
  if (!departureDateStr) return null;
  const target = new Date(departureDateStr).getTime();
  if (isNaN(target)) return null;

  const diffMs = target - now;
  const isOverdue = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  const totalMinutes = Math.round(absDiff / (1000 * 60));
  const daysRemaining = Math.floor(totalMinutes / (60 * 24));
  const hoursRemaining = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutesRemaining = totalMinutes % 60;

  return {
    targetDate: departureDateStr,
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    isOverdue,
  };
}

/**
 * Calculates domain prepScore (0 to 100) with 4-pillar breakdown.
 */
export function calculatePrepScore(input: PrepScoreInput): { score: number; breakdown: PrepBreakdown } {
  // 1. Gear (max 35)
  let gearScore = 0;
  if (input.gearTotal > 0) {
    const packingRatio = Math.min(1, input.gearPacked / input.gearTotal);
    gearScore = Math.round(packingRatio * 35);
  } else {
    gearScore = 15; // default neutral if no gear defined yet
  }
  // Penalize missing vitals (-10 pts each, min 0)
  if (input.vitalMissingCount > 0) {
    gearScore = Math.max(0, gearScore - input.vitalMissingCount * 10);
  }

  // 2. Weather (max 25)
  let weatherScore = input.hasWeather48h ? 25 : 10;
  if (input.weatherWarning) {
    weatherScore = Math.max(0, weatherScore - 15);
  }

  // 3. Safety (max 25)
  let safetyScore = 0;
  if (input.hasIceContact) safetyScore += 15;
  if (input.hasMedicalProfile) safetyScore += 10;

  // 4. Offline Route (max 15)
  const routeOfflineScore = input.isRouteCachedOffline ? 15 : 0;

  const totalScore = Math.min(100, Math.max(0, gearScore + weatherScore + safetyScore + routeOfflineScore));

  return {
    score: totalScore,
    breakdown: {
      gearScore,
      weatherScore,
      safetyScore,
      routeOfflineScore,
    },
  };
}

/**
 * Generates deterministic versioned emergency SOS string.
 * Format: LKDV1|SOS|GPS:lat,lon|ALT:xxxm|BAT:xx%|TIME:iso|ID:xxx
 */
export function generateSosMessage(params: {
  lat: number;
  lon: number;
  alt?: number;
  batteryPercent?: number;
  userId?: string;
}): string {
  const parts: string[] = [
    'LKDV1',
    'SOS',
    `GPS:${params.lat.toFixed(5)},${params.lon.toFixed(5)}`,
  ];

  if (params.alt !== undefined && params.alt !== null) {
    parts.push(`ALT:${Math.round(params.alt)}m`);
  }

  if (params.batteryPercent !== undefined && params.batteryPercent !== null) {
    parts.push(`BAT:${Math.round(params.batteryPercent)}%`);
  }

  parts.push(`TIME:${new Date().toISOString()}`);

  if (params.userId) {
    parts.push(`ID:${params.userId.slice(0, 8)}`);
  }

  return parts.join('|');
}
