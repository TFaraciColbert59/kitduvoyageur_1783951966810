'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CarnetLivePosition, CarnetPublicZone, CarnetViewerRole } from './types';

export interface UseCarnetLivePositionArgs {
  carnetId: string;
  viewerRole: CarnetViewerRole;
  liveSharing: 'off' | 'participants' | 'public';
  userId: string | null;
  initialLivePosition?: CarnetLivePosition | null;
  initialPublicZone?: CarnetPublicZone | null;
  onIsland?: (message: string) => void;
}

export function useCarnetLivePosition({
  carnetId,
  viewerRole,
  liveSharing,
  userId,
  initialLivePosition = null,
  initialPublicZone = null,
  onIsland,
}: UseCarnetLivePositionArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [livePosition, setLivePosition] = useState<CarnetLivePosition | null>(initialLivePosition);
  const [publicZone, setPublicZone] = useState<CarnetPublicZone | null>(initialPublicZone);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const isParticipant = viewerRole === 'participant';

  // Broadcast GPS updates to Supabase (participants only)
  const sendLocationUpdate = useCallback(
    async (coords: GeolocationCoordinates) => {
      if (!userId || !carnetId) return;
      const now = Date.now();
      // Throttle: max once every 10 seconds
      if (now - lastUpdateRef.current < 10000) return;
      lastUpdateRef.current = now;

      try {
        const { error } = await supabase.from('carnet_live_positions').upsert(
          {
            carnet_id: carnetId,
            user_id: userId,
            lat: coords.latitude,
            lng: coords.longitude,
            altitude: coords.altitude ?? null,
            accuracy: coords.accuracy ?? null,
            heading: coords.heading ?? null,
            speed: coords.speed ?? null,
            recorded_at: new Date().toISOString(),
          },
          { onConflict: 'carnet_id,user_id' }
        );

        if (error) throw error;

        setLivePosition({
          userId,
          lat: coords.latitude,
          lng: coords.longitude,
          altitude: coords.altitude ?? null,
          accuracy: coords.accuracy ?? null,
          heading: coords.heading ?? null,
          speed: coords.speed ?? null,
          recordedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Erreur envoi position live:', err);
      }
    },
    [carnetId, supabase, userId]
  );

  const startBroadcast = useCallback(() => {
    if (!isParticipant) return;
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setTrackingError('Géolocalisation indisponible sur cet appareil.');
      return;
    }

    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setTrackingError(null);
          void sendLocationUpdate(pos.coords);
        },
        (err) => {
          setTrackingError(err.message || 'Impossible d’accéder au GPS');
          setIsBroadcasting(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        }
      );
      watchIdRef.current = id;
      setIsBroadcasting(true);
      onIsland?.('Partage de position en direct activé');
    } catch {
      setTrackingError('Erreur d’initialisation du GPS');
    }
  }, [isParticipant, onIsland, sendLocationUpdate]);

  const stopBroadcast = useCallback(() => {
    if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsBroadcasting(false);
    onIsland?.('Partage de position en direct arrêté');
  }, [onIsland]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Polling for public zone when viewer is visitor and liveSharing === 'public'
  useEffect(() => {
    if (isParticipant || liveSharing !== 'public' || !carnetId) return;

    let mounted = true;
    const fetchZone = async () => {
      try {
        const { data, error } = await supabase.rpc('carnet_public_position', {
          p_carnet_id: carnetId,
        });
        if (error) throw error;
        if (mounted && data) {
          const row = Array.isArray(data) ? data[0] : data;
          if (row && typeof row.center_lat === 'number') {
            setPublicZone({
              centerLat: row.center_lat,
              centerLng: row.center_lng,
              radiusMeters: row.radius_meters ?? 5000,
              recordedAt: row.recorded_at,
              isDelayed: row.is_delayed ?? true,
            });
          }
        }
      } catch {
        // silent
      }
    };

    void fetchZone();
    const interval = setInterval(fetchZone, 45000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [carnetId, isParticipant, liveSharing, supabase]);

  return {
    livePosition,
    publicZone,
    isBroadcasting,
    trackingError,
    startBroadcast,
    stopBroadcast,
  };
}
