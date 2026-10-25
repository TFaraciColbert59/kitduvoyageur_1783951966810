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
      className={`mt-[var(--space-2)] flex max-w-[240px] flex-col gap-[var(--space-1)] rounded-[var(--lkv-radius-md)] border px-[var(--space-3)] py-[var(--space-3)] shadow-elevation-1 transition-transform active:scale-[0.98] ${
        isMine ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]' : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      <span
        className={`text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider ${
          isMine ? 'text-[color:var(--lkv-text-inverted)]/80' : 'text-[color:var(--lkv-forest-700)]'
        }`}
      >
        🥾 Randonnée
      </span>
      <p
        className={`text-[length:var(--lkv-text-caption)] font-bold leading-snug ${
          isMine ? 'text-[color:var(--lkv-text-inverted)]' : 'text-[color:var(--lkv-text-primary)]'
        }`}
      >
        {title}
      </p>
      {(km || deniv) && (
        <p
          className={`text-[length:var(--lkv-text-caption)] font-medium ${
            isMine ? 'text-[color:var(--lkv-text-inverted)]/80' : 'text-[color:var(--lkv-text-secondary)]'
          }`}
        >
          {[km, deniv, meta.region].filter(Boolean).join(' · ')}
        </p>
      )}
    </Link>
  );
};
