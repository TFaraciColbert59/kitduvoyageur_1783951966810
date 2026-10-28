'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type {
  Carte3DBasemap,
  Carte3DOfflinePack,
  Carte3DTrail,
  Carte3DWaypoint,
  ScrubberState,
  WaypointCategory,
} from '../types';
import { PRESET_TRAILS } from '../data/presetTrails';
import {
  findNearbyWaypoint,
  interpolatePositionAtProgress,
} from '../lib/elevationEngine';
import { parseGPXStringToTrail } from '../lib/gpxParser';
import {
  checkTrailOfflineStatus,
  deleteTrailOfflinePack,
  downloadTrailOfflinePack,
} from '../offline/carte3dOfflineStorage';
import { Carte3DMap } from './Carte3DMap';
import { ElevationTimelineScrubber } from './ElevationTimelineScrubber';
import { FloatingGlassControls } from './FloatingGlassControls';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

interface Carte3DViewProps {
  initialTrailId?: string;
}

export function Carte3DView({ initialTrailId }: Carte3DViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const mapInstanceRef = useRef<MapLibreMap | null>(null);

  // 1. Sentier actif
  const [currentTrail, setCurrentTrail] = useState<Carte3DTrail>(() => {
    if (initialTrailId) {
      const found = PRESET_TRAILS.find((t) => t.id === initialTrailId);
      if (found) return found;
    }
    return PRESET_TRAILS[0];
  });

  // 2. État du Scrubber et Playhead 3D
  const initialPoint = interpolatePositionAtProgress(currentTrail, 0);
  const [scrubberState, setScrubberState] = useState<ScrubberState>({
    progress: 0,
    currentDistanceKm: 0,
    currentElevationM: initialPoint.elevationM,
    currentSlopePercent: initialPoint.slopePercent,
    currentCoordinate: initialPoint.coord,
    currentBearingDeg: initialPoint.bearingDeg,
    isPlaying: false,
    playbackSpeed: 1,
    chaseCamera: true, // Caméra de poursuite cinématique par défaut
    activeNearbyWaypoint: null,
  });

  // 3. Contrôles de vue (3D / 2D / Basemap / Catégories)
  const [is3D, setIs3D] = useState(true);
  const [bearing, setBearing] = useState(25);
  const [basemap, setBasemap] = useState<Carte3DBasemap>('satellite-esri');
  const [activeCategories, setActiveCategories] = useState<Set<WaypointCategory>>(
    () => new Set(['summit', 'refuge', 'water', 'pass', 'viewpoint', 'weather', 'photo'])
  );

  // 4. État du Waypoint sélectionné (bulle éphémère)
  const [selectedWaypoint, setSelectedWaypoint] = useState<Carte3DWaypoint | null>(null);

  // 5. État hors-ligne
  const [offlinePack, setOfflinePack] = useState<Carte3DOfflinePack | null>(null);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 6. Glisser-déposer de fichiers GPX
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Vérification de la disponibilité hors-ligne
  useEffect(() => {
    let cancelled = false;
    checkTrailOfflineStatus(currentTrail.id).then((pack) => {
      if (!cancelled) setOfflinePack(pack);
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrail.id]);

  // Réinitialisation du scrubber lors d'un changement de sentier
  const handleSelectTrail = useCallback((trail: Carte3DTrail) => {
    setCurrentTrail(trail);
    setSelectedWaypoint(null);
    const p = interpolatePositionAtProgress(trail, 0);
    setScrubberState((prev) => ({
      ...prev,
      progress: 0,
      currentDistanceKm: 0,
      currentElevationM: p.elevationM,
      currentSlopePercent: p.slopePercent,
      currentCoordinate: p.coord,
      currentBearingDeg: p.bearingDeg,
      isPlaying: false,
      activeNearbyWaypoint: null,
    }));
  }, []);

  // Déplacement manuel du scrubber (slider ou tap sur le graphe)
  const handleSeek = useCallback(
    (progress: number) => {
      const p = interpolatePositionAtProgress(currentTrail, progress);
      const nearby = findNearbyWaypoint(currentTrail.waypoints, p.distanceKm, 0.4);

      if (nearby) {
        triggerHaptic('light');
        setSelectedWaypoint(nearby);
      } else {
        setSelectedWaypoint(null);
      }

      setScrubberState((prev) => ({
        ...prev,
        progress,
        currentDistanceKm: p.distanceKm,
        currentElevationM: p.elevationM,
        currentSlopePercent: p.slopePercent,
        currentCoordinate: p.coord,
        currentBearingDeg: p.bearingDeg,
        activeNearbyWaypoint: nearby,
      }));
    },
    [currentTrail, triggerHaptic]
  );

  // Toggle Lecture / Pause avec reprise intelligente au début si terminé
  const handleTogglePlay = useCallback(() => {
    setScrubberState((prev) => {
      const restarting = !prev.isPlaying && prev.progress >= 0.999;
      if (restarting) {
        const p0 = interpolatePositionAtProgress(currentTrail, 0);
        return {
          ...prev,
          progress: 0,
          currentDistanceKm: 0,
          currentElevationM: p0.elevationM,
          currentSlopePercent: p0.slopePercent,
          currentCoordinate: p0.coord,
          currentBearingDeg: p0.bearingDeg,
          isPlaying: true,
          activeNearbyWaypoint: null,
        };
      }
      return {
        ...prev,
        isPlaying: !prev.isPlaying,
      };
    });
  }, [currentTrail]);

  // Changement de vitesse
  const handleSpeedChange = useCallback((speed: 1 | 2 | 5 | 10) => {
    setScrubberState((prev) => ({
      ...prev,
      playbackSpeed: speed,
    }));
  }, []);

  // Toggle Suivi Caméra
  const handleToggleCameraChase = useCallback(() => {
    setScrubberState((prev) => ({
      ...prev,
      chaseCamera: !prev.chaseCamera,
    }));
  }, []);

  // Si l'utilisateur touche / drague la carte : bascule en mode libre (désactive temporairement la caméra chase)
  const handleUserInteracted = useCallback(() => {
    if (scrubberState.chaseCamera) {
      setScrubberState((prev) => ({
        ...prev,
        chaseCamera: false,
      }));
    }
  }, [scrubberState.chaseCamera]);

  // Commandes de Zoom fluides
  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn({ duration: 300 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut({ duration: 300 });
  }, []);

  // Réorientation fluide vers le Nord
  const handleResetNorth = useCallback(() => {
    mapInstanceRef.current?.easeTo({ bearing: 0, duration: 600 });
    setBearing(0);
  }, []);

  // Boucle d'animation fluide de la simulation 3D (requestAnimationFrame) avec arrêt propre
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scrubberState.isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const durationSeconds = 60 / scrubberState.playbackSpeed; // Boucle de 60s à 1x
    const progressRatePerSec = 1 / durationSeconds;
    let isRunning = true;

    const tick = (now: number) => {
      if (!isRunning) return;

      if (!lastTimeRef.current) {
        lastTimeRef.current = now;
      }
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setScrubberState((prev) => {
        let nextProgress = prev.progress + progressRatePerSec * dt;
        let isStillPlaying = true;

        if (nextProgress >= 1) {
          nextProgress = 1;
          isStillPlaying = false; // Fin de la randonnée
          isRunning = false; // Arrêt immédiat de la boucle
        }

        const p = interpolatePositionAtProgress(currentTrail, nextProgress);
        const nearby = findNearbyWaypoint(currentTrail.waypoints, p.distanceKm, 0.35);

        return {
          ...prev,
          progress: nextProgress,
          currentDistanceKm: p.distanceKm,
          currentElevationM: p.elevationM,
          currentSlopePercent: p.slopePercent,
          currentCoordinate: p.coord,
          currentBearingDeg: p.bearingDeg,
          isPlaying: isStillPlaying,
          activeNearbyWaypoint: nearby,
        };
      });

      if (isRunning) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [scrubberState.isPlaying, scrubberState.playbackSpeed, currentTrail]);

  // Synchronisation éphémère de la bulle lors de la progression (se masque automatiquement après passage)
  useEffect(() => {
    if (scrubberState.activeNearbyWaypoint) {
      setSelectedWaypoint(scrubberState.activeNearbyWaypoint);
    } else if (scrubberState.isPlaying) {
      setSelectedWaypoint(null);
    }
  }, [scrubberState.activeNearbyWaypoint, scrubberState.isPlaying]);

  // Téléchargement de zone hors-ligne
  const handleDownloadOffline = async () => {
    try {
      setIsDownloadingOffline(true);
      setDownloadProgress(0);
      const pack = await downloadTrailOfflinePack(currentTrail, (pct) => {
        setDownloadProgress(pct);
      });
      setOfflinePack(pack);
      triggerHaptic('success');
    } catch (err) {
      console.error('[Carte3D] Échec téléchargement hors-ligne', err);
      triggerHaptic('error');
    } finally {
      setIsDownloadingOffline(false);
    }
  };

  // Suppression de zone hors-ligne
  const handleDeleteOffline = async () => {
    try {
      await deleteTrailOfflinePack(currentTrail.id);
      setOfflinePack(null);
      triggerHaptic('light');
    } catch (err) {
      console.error('[Carte3D] Échec suppression hors-ligne', err);
    }
  };

  // Toggle catégorie de POI
  const handleToggleCategory = (cat: WaypointCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Glisser-déposer de fichiers GPX directement sur l'écran
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const xml = event.target?.result as string;
      const parsed = parseGPXStringToTrail(xml, file.name.replace(/\.gpx$/i, ''));
      if (parsed.success && parsed.trail) {
        triggerHaptic('success');
        handleSelectTrail(parsed.trail);
      } else {
        triggerHaptic('error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-[100dvh] overflow-hidden bg-[#111814] text-[#FBFAF6] select-none"
    >
      {/* ── MOTEUR CARTE 3D GL ────────────────────────────────────── */}
      <Carte3DMap
        trail={currentTrail}
        scrubberState={scrubberState}
        is3D={is3D}
        basemap={basemap}
        activeCategories={activeCategories}
        onBearingChange={setBearing}
        onSelectWaypoint={setSelectedWaypoint}
        selectedWaypoint={selectedWaypoint}
        onUserInteracted={handleUserInteracted}
        forwardedMapRef={mapInstanceRef}
      />

      {/* ── COMMANDES SUPÉRIEURES FLOTTANTES (LIQUID GLASS) ────────── */}
      <FloatingGlassControls
        currentTrail={currentTrail}
        onSelectTrail={handleSelectTrail}
        is3D={is3D}
        onToggle3D={() => setIs3D(!is3D)}
        bearing={bearing}
        onResetNorth={handleResetNorth}
        basemap={basemap}
        onChangeBasemap={setBasemap}
        activeCategories={activeCategories}
        onToggleCategory={handleToggleCategory}
        offlinePack={offlinePack}
        isDownloadingOffline={isDownloadingOffline}
        downloadProgress={downloadProgress}
        onDownloadOffline={handleDownloadOffline}
        onDeleteOffline={handleDeleteOffline}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* ── TIMELINE INFÉRIEURE & PROFIL D'ALTITUDE ────────────────── */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <div className="absolute bottom-2 md:bottom-5 inset-x-0 z-20 pointer-events-none pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ElevationTimelineScrubber
          trail={currentTrail}
          scrubberState={scrubberState}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
          onSpeedChange={handleSpeedChange}
          onToggleCameraChase={handleToggleCameraChase}
          onWaypointSelect={setSelectedWaypoint}
        />
      </div>

      {/* ── DROP OVERLAY GPX (LIQUID GLASS) ────────────────────────── */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md border-4 border-dashed border-stone-400 p-6 pointer-events-none animate-in fade-in duration-200">
          <div className="text-center text-white">
            <div className="text-5xl mb-3 animate-bounce"><LKDVIcon name="randonnee" size="1em" className="lkdv-icon-inline" /></div>
            <div className="text-xl font-bold">Déposez votre tracé GPX</div>
            <p className="text-sm text-stone-300 mt-1">
              Rendu instantané en relief 3D et drapage satellite
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
