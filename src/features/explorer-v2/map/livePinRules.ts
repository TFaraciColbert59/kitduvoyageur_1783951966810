/**
 * Explorer v2 — Règles déterministes anti-encombrement pour les éléments 3D live
 * (Balises Live, Signalements terrain et Repères de sortie).
 *
 * Garantit :
 * 1. Apparition immédiate du dernier élément posé (priorité absolue).
 * 2. Fusion / anti-doublon spatial (aucun empilement de balises ou signalements au même endroit).
 * 3. Plafonds stricts sur la carte (1 balise Live, max 5 signalements, max 6 repères, max 10 au total).
 * 4. Anti-rafale (cooldown 1,5 s sur les repères) + expiration propre (24 h pour les signalements locaux).
 */

import type { MapPin } from './MapStage';

export const LIVE_PIN_LIMITS = {
  /** Une seule Balise Live active à la fois. */
  maxLiveBeacons: 1,
  /** Maximum de signalements 3D affichés simultanément sur la carte. */
  maxSafetyReports: 5,
  /** Maximum de repères de sortie 3D affichés simultanément. */
  maxWaypoints: 6,
  /** Plafond global d'objets 3D live simultanés en suivi GPS. */
  maxTotalLive3D: 10,
  /** Rayon (m) en dessous duquel un nouveau signalement met à jour l'existant au lieu d'empiler. */
  safetyReportMergeRadiusM: 35,
  /** Rayon (m) en dessous duquel un nouveau repère remplace le repère existant au même endroit. */
  waypointMergeRadiusM: 25,
  /** Cooldown anti-double-tap (ms) sur la pose de repère. */
  waypointCooldownMs: 1500,
  /** Durée de vie (ms) d'un signalement local avant nettoyage automatique (24 h). */
  localSafetyReportTtlMs: 24 * 60 * 60 * 1000,
} as const;

export interface TimestampedSafetyPin extends MapPin {
  createdAtMs: number;
  category?: string;
}

export interface TimestampedWaypoint {
  id: string;
  kind: string;
  label: string;
  lat: number;
  lng: number;
  createdAtMs?: number;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ajoute ou fusionne un signalement terrain selon le rayon anti-doublon (35 m) et le TTL (24 h).
 */
export function upsertSafetyReportPin(
  existing: ReadonlyArray<TimestampedSafetyPin>,
  incoming: TimestampedSafetyPin,
  nowMs = Date.now(),
): {
  next: TimestampedSafetyPin[];
  merged: boolean;
  activePinId: string;
} {
  const fresh = existing.filter(
    (p) => nowMs - p.createdAtMs <= LIVE_PIN_LIMITS.localSafetyReportTtlMs,
  );
  const nearbyIdx = fresh.findIndex(
    (p) =>
      haversineMeters(p.lat, p.lon, incoming.lat, incoming.lon) <=
      LIVE_PIN_LIMITS.safetyReportMergeRadiusM,
  );

  if (nearbyIdx >= 0) {
    const updated = [...fresh];
    const replaced: TimestampedSafetyPin = {
      ...incoming,
      id: fresh[nearbyIdx].id,
      createdAtMs: nowMs,
    };
    updated[nearbyIdx] = replaced;
    return { next: updated, merged: true, activePinId: replaced.id };
  }

  // Garder les plus récents dans la limite mémoire propre (max 12 stockés localement)
  const next = [...fresh, { ...incoming, createdAtMs: nowMs }].slice(-12);
  return { next, merged: false, activePinId: incoming.id };
}

/**
 * Ajoute ou remplace un repère de sortie avec protection anti-rafale (1,5 s) et anti-empilement (25 m).
 */
export function upsertSessionWaypoint<T extends TimestampedWaypoint>(
  existing: ReadonlyArray<T>,
  incoming: T,
  nowMs = Date.now(),
): {
  next: T[];
  status: 'added' | 'merged' | 'throttled';
  activeId: string;
} {
  const last = existing[existing.length - 1];
  if (
    last &&
    typeof last.createdAtMs === 'number' &&
    nowMs - last.createdAtMs < LIVE_PIN_LIMITS.waypointCooldownMs &&
    haversineMeters(last.lat, last.lng, incoming.lat, incoming.lng) < 12
  ) {
    return { next: [...existing], status: 'throttled', activeId: last.id };
  }

  const nearbyIdx = existing.findIndex(
    (wp) =>
      haversineMeters(wp.lat, wp.lng, incoming.lat, incoming.lng) <=
      LIVE_PIN_LIMITS.waypointMergeRadiusM,
  );

  if (nearbyIdx >= 0) {
    const updated = [...existing];
    const mergedItem = { ...incoming, id: existing[nearbyIdx].id, createdAtMs: nowMs };
    updated[nearbyIdx] = mergedItem;
    return { next: updated, status: 'merged', activeId: mergedItem.id };
  }

  return {
    next: [...existing, { ...incoming, createdAtMs: nowMs }],
    status: 'added',
    activeId: incoming.id,
  };
}

/**
 * Applique les plafonds visuels stricts sur les éléments 3D live affichés à l'écran :
 * - Toujours 1 Balise Live max (prioritaire)
 * - Dernier élément posé garanti visible
 * - Max 5 signalements (dédupliqués à 35 m), max 6 repères, max 10 au total
 */
export function selectCleanLivePins(params: {
  beaconPin: MapPin | null;
  safetyPins: ReadonlyArray<MapPin>;
  waypointPins: ReadonlyArray<MapPin>;
  priorityPinId?: string | null;
}): MapPin[] {
  const { beaconPin, safetyPins, waypointPins, priorityPinId = null } = params;
  const out: MapPin[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (pin: MapPin): boolean => {
    if (seenIds.has(pin.id)) return false;
    if (out.length >= LIVE_PIN_LIMITS.maxTotalLive3D) return false;
    seenIds.add(pin.id);
    out.push(pin);
    return true;
  };

  // 1. Balise Live unique (priorité absolue)
  if (beaconPin) {
    pushUnique(beaconPin);
  }

  // 2. Signalements terrain (dernier posé d'abord, puis proximité, dédupliqués à 35 m, plafonnés à 5)
  const sortedSafety = [...safetyPins].sort((a, b) => {
    if (a.id === priorityPinId) return -1;
    if (b.id === priorityPinId) return 1;
    return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
  });
  const keptSafety: MapPin[] = [];
  for (const pin of sortedSafety) {
    if (keptSafety.length >= LIVE_PIN_LIMITS.maxSafetyReports) break;
    const tooClose = keptSafety.some(
      (k) =>
        haversineMeters(k.lat, k.lon, pin.lat, pin.lon) <=
        LIVE_PIN_LIMITS.safetyReportMergeRadiusM,
    );
    if (tooClose) continue;
    keptSafety.push(pin);
    pushUnique(pin);
  }

  // 3. Repères de sortie (les plus récents / prioritaires en premier, plafonnés à 6)
  const reversedWaypoints = [...waypointPins].reverse().sort((a, b) => {
    if (a.id === priorityPinId) return -1;
    if (b.id === priorityPinId) return 1;
    return 0;
  });
  let wpCount = 0;
  for (const wp of reversedWaypoints) {
    if (wpCount >= LIVE_PIN_LIMITS.maxWaypoints) break;
    if (pushUnique(wp)) wpCount += 1;
  }

  return out;
}
