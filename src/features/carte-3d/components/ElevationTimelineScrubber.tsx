'use client';

import React, { useCallback, useId, useMemo, useRef } from 'react';
import type { Carte3DTrail, Carte3DWaypoint, ScrubberState } from '../types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

interface ElevationTimelineScrubberProps {
  trail: Carte3DTrail;
  scrubberState: ScrubberState;
  onSeek: (progress: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: 1 | 2 | 5 | 10) => void;
  onToggleCameraChase: () => void;
  onWaypointSelect?: (wpt: Carte3DWaypoint) => void;
}

export function ElevationTimelineScrubber({
  trail,
  scrubberState,
  onSeek,
  onTogglePlay,
  onSpeedChange,
  onToggleCameraChase,
  onWaypointSelect,
}: ElevationTimelineScrubberProps) {
  const gradientId = useId();
  const { triggerHaptic } = useHapticFeedback();
  const svgRef = useRef<SVGSVGElement>(null);

  const profile = trail.elevationProfile;
  const totalDist = trail.distanceKm || 1;
  const minEle = trail.minElevationM;
  const maxEle = Math.max(trail.maxElevationM, minEle + 50);
  const eleSpan = maxEle - minEle || 1;

  // Dimensions SVG normalisées
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 100;
  const PADDING_TOP = 14;
  const PADDING_BOTTOM = 16;
  const GRAPH_HEIGHT = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  // Calcul du path SVG
  const { areaPath, linePath } = useMemo(() => {
    if (!profile || profile.length < 2) {
      return { areaPath: '', linePath: '' };
    }

    const points: [number, number][] = profile.map((p) => {
      const x = Math.max(0, Math.min(SVG_WIDTH, (p.distanceKm / totalDist) * SVG_WIDTH));
      const normalizedEle = (p.elevationM - minEle) / eleSpan;
      const y = PADDING_TOP + (1 - normalizedEle) * GRAPH_HEIGHT;
      return [x, y];
    });

    let dLine = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      dLine += ` L ${points[i][0].toFixed(1)},${points[i][1].toFixed(1)}`;
    }

    const dArea = `${dLine} L ${SVG_WIDTH},${SVG_HEIGHT - PADDING_BOTTOM} L 0,${SVG_HEIGHT - PADDING_BOTTOM} Z`;

    return { areaPath: dArea, linePath: dLine };
  }, [profile, totalDist, minEle, eleSpan, GRAPH_HEIGHT]);

  // Position du curseur actuel sur le graphique SVG
  const cursorX = scrubberState.progress * SVG_WIDTH;
  const cursorY = useMemo(() => {
    const normalizedEle = (scrubberState.currentElevationM - minEle) / eleSpan;
    return PADDING_TOP + (1 - Math.max(0, Math.min(1, normalizedEle))) * GRAPH_HEIGHT;
  }, [scrubberState.currentElevationM, minEle, eleSpan, GRAPH_HEIGHT]);

  // Gestion du scrub direct au toucher / clic sur le graphe
  const handleGraphPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const clientX = e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      triggerHaptic('light');
      onSeek(pct);
    },
    [onSeek, triggerHaptic]
  );

  // Temps écoulé estimé au point courant
  const currentDurationHours = useMemo(() => {
    const ratio = scrubberState.progress;
    return Math.round(ratio * trail.estimatedDurationHours * 10) / 10;
  }, [scrubberState.progress, trail.estimatedDurationHours]);

  const formatHours = (h: number) => {
    const fullHours = Math.floor(h);
    const mins = Math.round((h - fullHours) * 60);
    return `${fullHours}h${mins < 10 ? '0' : ''}${mins}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2 md:px-4 pointer-events-auto select-none">
      <div className="relative rounded-2xl md:rounded-3xl backdrop-blur-2xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/10 shadow-2xl p-3 md:p-4 text-stone-900 dark:text-stone-100 transition-all">
        
        {/* En-tête : Métriques instantanées (dilum sanjaya style) */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {/* Distance */}
            <div className="flex items-baseline gap-1 bg-stone-200/50 dark:bg-white/10 px-2.5 py-1 rounded-full text-xs font-mono">
              <span className="text-[10px] uppercase tracking-wider text-stone-700 dark:text-stone-300 font-sans font-semibold">Dist</span>
              <span className="font-bold text-sm">{scrubberState.currentDistanceKm.toFixed(1)}</span>
              <span className="text-[10px] text-stone-500">/{trail.distanceKm.toFixed(0)} km</span>
            </div>

            {/* Altitude */}
            <div className="flex items-baseline gap-1 bg-stone-200/50 dark:bg-white/10 px-2.5 py-1 rounded-full text-xs font-mono">
              <span className="text-[10px] uppercase tracking-wider text-stone-700 dark:text-stone-300 font-sans font-semibold">Alt</span>
              <span className="font-bold text-sm">{scrubberState.currentElevationM}</span>
              <span className="text-[10px] text-stone-500">m</span>
            </div>

            {/* Pente instantanée */}
            <div className="hidden sm:flex items-baseline gap-1 bg-stone-200/50 dark:bg-white/10 px-2.5 py-1 rounded-full text-xs font-mono">
              <span className="text-[10px] uppercase tracking-wider text-stone-700 dark:text-stone-300 font-sans font-semibold">Pente</span>
              <span
                className={`font-bold text-sm ${
                  scrubberState.currentSlopePercent > 20
                    ? 'text-rose-600 dark:text-rose-400'
                    : scrubberState.currentSlopePercent > 10
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {scrubberState.currentSlopePercent > 0 ? `+${scrubberState.currentSlopePercent}` : scrubberState.currentSlopePercent}%
              </span>
            </div>

            {/* Temps estimé */}
            <div className="hidden md:flex items-baseline gap-1 bg-stone-200/50 dark:bg-white/10 px-2.5 py-1 rounded-full text-xs font-mono">
              <span className="text-[10px] uppercase tracking-wider text-stone-700 dark:text-stone-300 font-sans font-semibold">Temps</span>
              <span className="font-bold text-sm">{formatHours(currentDurationHours)}</span>
              <span className="text-[10px] text-stone-500">/{formatHours(trail.estimatedDurationHours)}</span>
            </div>
          </div>

          {/* Mode Suivi Caméra Toggle */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              onToggleCameraChase();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
              scrubberState.chaseCamera
                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-md'
                : 'bg-stone-200/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
            }`}
            title="Activer/Désactiver le suivi caméra 3D"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                scrubberState.chaseCamera ? 'bg-white dark:bg-stone-900 animate-pulse' : 'bg-stone-400'
              }`}
            />
            <span className="hidden xs:inline">Suivi caméra</span>
            <span className="xs:hidden">Suivi</span>
          </button>
        </div>

        {/* Profil d'altitude interactif SVG */}
        <div className="relative w-full h-24 md:h-28 touch-none">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-full cursor-crosshair overflow-visible"
            preserveAspectRatio="none"
            onPointerDown={handleGraphPointer}
            onPointerMove={(e) => {
              if (e.buttons === 1) handleGraphPointer(e);
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#355644" stopOpacity="0.55" />
                <stop offset="70%" stopColor="#355644" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#355644" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Lignes de repère altimétriques subtiles */}
            <line
              x1="0"
              y1={PADDING_TOP}
              x2={SVG_WIDTH}
              y2={PADDING_TOP}
              stroke="currentColor"
              strokeDasharray="4 4"
              className="text-stone-300 dark:text-stone-700 opacity-60"
            />
            <line
              x1="0"
              y1={SVG_HEIGHT - PADDING_BOTTOM}
              x2={SVG_WIDTH}
              y2={SVG_HEIGHT - PADDING_BOTTOM}
              stroke="currentColor"
              className="text-stone-300 dark:text-stone-700 opacity-60"
            />

            {/* Remplissage de l'aire sous la courbe */}
            {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

            {/* Ligne de relief 3D */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#17402C"
                strokeWidth="2.5"
                className="dark:stroke-stone-300 transition-colors"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Points d'intérêt (Waypoints) épinglés sur le profil */}
            {trail.waypoints.map((wpt) => {
              const x = (wpt.distanceKm / totalDist) * SVG_WIDTH;
              const normalizedEle = (wpt.altitudeM - minEle) / eleSpan;
              const y = PADDING_TOP + (1 - Math.max(0, Math.min(1, normalizedEle))) * GRAPH_HEIGHT;
              const isNearby = scrubberState.activeNearbyWaypoint?.id === wpt.id;

              return (
                <g
                  key={wpt.id}
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('medium');
                    onSeek(wpt.distanceKm / totalDist);
                    onWaypointSelect?.(wpt);
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isNearby ? 5 : 3.5}
                    className={
                      isNearby
                        ? 'fill-amber-400 stroke-white stroke-2'
                        : wpt.category === 'summit'
                        ? 'fill-rose-500 stroke-white stroke-1'
                        : wpt.category === 'refuge'
                        ? 'fill-sky-500 stroke-white stroke-1'
                        : wpt.category === 'water'
                        ? 'fill-blue-400 stroke-white stroke-1'
                        : wpt.category === 'pass'
                        ? 'fill-orange-400 stroke-white stroke-1'
                        : wpt.category === 'photo'
                        ? 'fill-purple-400 stroke-white stroke-1'
                        : 'fill-stone-600 stroke-white stroke-1'
                    }
                  />
                </g>
              );
            })}

            {/* Curseur de progression vertical */}
            <line
              x1={cursorX}
              y1={0}
              x2={cursorX}
              y2={SVG_HEIGHT}
              stroke="#17402C"
              strokeWidth="2"
              className="dark:stroke-white"
            />

            {/* Marqueur lumineux sur la courbe */}
            <circle
              cx={cursorX}
              cy={cursorY}
              r="6"
              fill="#17402C"
              stroke="#FBFAF6"
              strokeWidth="2"
              className="dark:fill-stone-200 shadow-lg animate-pulse"
            />
          </svg>

          {/* Repères Min / Max altitude */}
          <div className="absolute left-1 top-0.5 text-[9px] font-mono text-stone-500 pointer-events-none">
            {maxEle} m
          </div>
          <div className="absolute left-1 bottom-1 text-[9px] font-mono text-stone-500 pointer-events-none">
            {minEle} m
          </div>
          <div className="absolute right-1 bottom-1 text-[9px] font-mono text-stone-500 pointer-events-none">
            {totalDist.toFixed(0)} km
          </div>
        </div>

        {/* Barre de commandes inférieure : Play / Slider / Vitesses */}
        <div className="flex items-center gap-3 mt-2 pt-1 border-t border-stone-200/50 dark:border-stone-800/50">
          {/* Bouton Play / Pause */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onTogglePlay();
            }}
            aria-label={scrubberState.isPlaying ? 'Mettre en pause' : 'Lancer la simulation 3D'}
            className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-[#17402C] text-white hover:bg-stone-700 active:scale-95 transition-all shadow-md"
          >
            {scrubberState.isPlaying ? (
              <LKDVIcon name="pause" size={16} className="w-4 h-4" />
            ) : (
              <LKDVIcon name="lecture" size={16} className="w-4 h-4 translate-x-0.5" />
            )}
          </button>

          {/* Scrubber Range Slider */}
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={scrubberState.progress}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              aria-label="Position sur la randonnée"
              className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-stone-700 dark:accent-stone-300 focus:outline-none"
            />
          </div>

          {/* Vitesse de lecture (1x, 2x, 5x, 10x) */}
          <div className="flex items-center bg-stone-200/60 dark:bg-stone-800/60 p-0.5 rounded-full text-xs font-mono">
            {([1, 2, 5, 10] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  triggerHaptic('selection');
                  onSpeedChange(s);
                }}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  scrubberState.playbackSpeed === s
                    ? 'bg-[#17402C] text-white shadow-sm font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
