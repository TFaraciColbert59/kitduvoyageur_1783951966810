'use client';
import React from 'react';
import type { MapTrail } from './types';
import { getTrailImage, getDifficultyColor, getDifficultyLabel, formatDistance, formatDuration } from './types';

interface Props {
  trail: MapTrail;
  isSelected: boolean;
  onClick: () => void;
}

export default function ExplorerListCard({ trail, isSelected, onClick }: Props) {
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);
  const dist = formatDistance(trail.distance_km);
  const dur = formatDuration(trail.duration_hours);
  const score = trail.adventure_score ? Math.round(trail.adventure_score) : null;

  return (
    <div
      onClick={onClick}
      className={`group flex gap-3 p-3 cursor-pointer transition-all duration-150 border-b border-[#E8E4D8] ${
        isSelected ? 'bg-[#F0EDE4]' : 'bg-white hover:bg-[#FAFAF7]'
      }`}
    >
      {/* Image */}
      <div className="relative w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#E7E3D6]">
        <img
          src={imgUrl}
          alt={trail.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Difficulty badge */}
        <div
          className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white"
          style={{ backgroundColor: diffColor }}
        >
          {diffLabel}
        </div>
        {/* Heart */}
        <button
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/75 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="12" height="12" fill="none" stroke="#1C2620" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="font-semibold text-[#1C2620] text-sm leading-tight mb-0.5 line-clamp-2">
            {trail.name}
          </h3>
          <p className="text-[11px] text-[#7A8A7D] truncate">
            {trail.terrain_type || 'Randonnée'}{trail.ref ? ` · ${trail.ref}` : ''}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2">
          {/* Distance */}
          <div className="flex items-center gap-1 text-[11px] text-[#3A4A3D]">
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            <span className="font-medium">{dist}</span>
          </div>
          {/* Duration */}
          <div className="flex items-center gap-1 text-[11px] text-[#3A4A3D]">
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="font-medium">{dur}</span>
          </div>
          {/* Elevation */}
          {trail.elevation_gain !== null && trail.elevation_gain !== undefined && (
            <div className="flex items-center gap-1 text-[11px] text-[#3A4A3D]">
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span className="font-medium">+{trail.elevation_gain} m</span>
            </div>
          )}
        </div>

        {/* Score + Season */}
        <div className="flex items-center justify-between mt-1.5">
          {score !== null ? (
            <div className="flex items-center gap-1">
              <span className="text-[#E4501C] text-xs">★</span>
              <span className="text-[11px] font-semibold text-[#1C2620]">{score}/100</span>
            </div>
          ) : (
            <span />
          )}
          {trail.season && (
            <span className="text-[10px] text-[#7A8A7D] bg-[#F0EDE4] px-1.5 py-0.5 rounded-md">
              {trail.season}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
