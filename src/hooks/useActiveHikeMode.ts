import { useState, useEffect, useRef, useCallback } from 'react';

export interface HikeStats {
  distanceKm: number;
  durationSeconds: number;
  paceMinPerKm: number;
  positions: { latitude: number; longitude: number }[];
}

interface ActiveHikeModeState {
  isActive: boolean;
  stats: HikeStats;
  startHike: () => void;
  stopHike: () => void;
  emergencyContact: string | null;
  setEmergencyContact: (contact: string) => void;
}

const STORAGE_KEY = 'lkdv_hike_state';
const CONTACT_KEY = 'lkdv_emergency_contact';

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useActiveHikeMode(): ActiveHikeModeState {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState<HikeStats>({
    distanceKm: 0,
    durationSeconds: 0,
    paceMinPerKm: 0,
    positions: [],
  });
  const [emergencyContact, setEmergencyContactState] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Restore emergency contact
    try {
      const saved = localStorage.getItem(CONTACT_KEY);
      if (saved) setEmergencyContactState(saved);
    } catch (_e) { /* ignore */ }

    // Restore active hike if app was closed mid-hike
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { isActive?: boolean; startTime?: number };
        if (parsed.isActive && parsed.startTime) {
          setIsActive(true);
          startTimeRef.current = parsed.startTime;
        }
      }
    } catch (_e) { /* ignore */ }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isActive) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000);
        setStats((prev) => {
          const pace =
            prev.distanceKm > 0.05
              ? elapsed / 60 / prev.distanceKm
              : 0;
          return { ...prev, durationSeconds: elapsed, paceMinPerKm: pace };
        });
      }, 1000);

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setStats((prev) => {
              const newPositions = [
                ...prev.positions,
                { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
              ];
              let totalDist = prev.distanceKm;
              if (newPositions.length >= 2) {
                const last = newPositions[newPositions.length - 2];
                const curr = newPositions[newPositions.length - 1];
                totalDist += calcDistance(last.latitude, last.longitude, curr.latitude, curr.longitude);
              }
              return { ...prev, positions: newPositions, distanceKm: totalDist };
            });
          },
          undefined,
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ isActive: true, startTime: startTimeRef.current }));
      } catch (_e) { /* ignore */ }
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* ignore */ }
    }
  }, [isActive]);

  const startHike = useCallback(() => {
    startTimeRef.current = Date.now();
    setStats({ distanceKm: 0, durationSeconds: 0, paceMinPerKm: 0, positions: [] });
    setIsActive(true);
  }, []);

  const stopHike = useCallback(() => {
    setIsActive(false);
    startTimeRef.current = null;
  }, []);

  const setEmergencyContact = useCallback((contact: string) => {
    setEmergencyContactState(contact);
    try { localStorage.setItem(CONTACT_KEY, contact); } catch (_e) { /* ignore */ }
  }, []);

  return { isActive, stats, startHike, stopHike, emergencyContact, setEmergencyContact };
}
