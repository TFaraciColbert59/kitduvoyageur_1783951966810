"use client";

import React from 'react';
import Link from 'next/link';
import type { TrailMessageMeta } from '../types/messaging.types';

interface TrailCardProps {
  meta: TrailMessageMeta;
  isMine: boolean;
}

const formatKm = (km?: number | null): string | null => {
  if (km == null) return null;
  return `${km.toFixed(1).replace('.', ',')} km`;
};

const formatDeniv = (m?: number | null): string | null => {
  if (m == null) return null;
  return `${Math.round(m)} m D+`;
};

export const TrailCard: React.FC<TrailCardProps> = ({ meta, isMine }) => {
  const href = `/explorer?trail=${meta.id}`;
  const title = meta.name || 'Randonnée LKDV';
  const km = formatKm(meta.distance_km);
  const deniv = formatDeniv(meta.elevation_gain_m);

  return (
    <Link
      href={href}
      className={`mt-2 max-w-[240px] rounded-2xl px-3.5 py-3 flex flex-col gap-1.5 ${
        isMine ? 'bg-white/15 border-white/30' : 'bg-white/70 border-stone-200/70'
      } border shadow-sm active:scale-[0.98] transition-transform`}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          isMine ? 'text-white/80' : 'text-[#2D6B4A]'
        }`}
      >
        🥾 Randonnée
      </span>
      <p
        className={`text-[14px] font-bold leading-snug ${
          isMine ? 'text-white' : 'text-[#17402C]'
        }`}
      >
        {title}
      </p>
      {(km || deniv) && (
        <p
          className={`text-[12px] font-medium ${
            isMine ? 'text-white/80' : 'text-[#5A574E]'
          }`}
        >
          {[km, deniv, meta.region].filter(Boolean).join(' · ')}
        </p>
      )}
    </Link>
  );
};