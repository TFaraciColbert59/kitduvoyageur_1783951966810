'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { NavigationInstruction, POI } from '../types';

interface NavigationCardProps {
  instruction?: NavigationInstruction | null;
  nextPoi?: (POI & { distanceRemainingM: number }) | null;
  routeName?: string | null;
  bearingDeg?: number | null;
  deviceHeading?: number | null;
}

function cardinalLabel(deg: number): string {
  const norm = (deg + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return 'Nord';
  if (norm >= 22.5 && norm < 67.5) return 'Nord-Est';
  if (norm >= 67.5 && norm < 112.5) return 'Est';
  if (norm >= 112.5 && norm < 157.5) return 'Sud-Est';
  if (norm >= 157.5 && norm < 202.5) return 'Sud';
  if (norm >= 202.5 && norm < 247.5) return 'Sud-Ouest';
  if (norm >= 247.5 && norm < 292.5) return 'Ouest';
  return 'Nord-Ouest';
}

function ArrowIcon({ bearingDeg, deviceHeading }: { bearingDeg?: number | null; deviceHeading?: number | null }) {
  if (bearingDeg == null) return <span className="text-xl">⬆️</span>;

  let rotation = bearingDeg;
  if (deviceHeading != null) {
    rotation = (bearingDeg - deviceHeading + 360) % 360;
  }

  return (
    <motion.div
      animate={{ rotate: rotation }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="w-10 h-10 rounded-2xl bg-[#2D6A4F] border border-[#4E9F3D]/40 flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0"
    >
      ↑
    </motion.div>
  );
}

export default function NavigationCard({
  instruction,
  nextPoi,
  routeName,
  bearingDeg,
  deviceHeading,
}: NavigationCardProps) {
  if (!instruction && !nextPoi && !routeName) return null;

  const targetName = instruction?.message || nextPoi?.name || 'Suivre le sentier';
  const distM = instruction?.distanceMeters ?? nextPoi?.distanceRemainingM ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-2 p-3 bg-[#0d1a12]/90 border border-[#2D5A27]/30 rounded-2xl backdrop-blur-xl shadow-xl flex items-center gap-3 text-white"
    >
      <ArrowIcon bearingDeg={bearingDeg ?? instruction?.bearingDeg} deviceHeading={deviceHeading} />

      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest truncate">
          {routeName || 'Navigation'}
        </p>
        <p className="font-bold text-sm text-white truncate leading-tight mt-0.5">
          {targetName}
        </p>
        <p className="text-[11px] text-[#A3C4A3]/80 mt-0.5">
          {bearingDeg != null && `Direction ${cardinalLabel(bearingDeg)} · `}
          {distM > 0 ? `${Math.round(distM)} m` : 'Sur le sentier'}
        </p>
      </div>

      {distM > 0 && (
        <div className="bg-[#17402C] border border-[#2D5A27]/40 px-3 py-1.5 rounded-xl font-mono font-bold text-xs text-[#4E9F3D] flex-shrink-0">
          {distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`}
        </div>
      )}
    </motion.div>
  );
}
