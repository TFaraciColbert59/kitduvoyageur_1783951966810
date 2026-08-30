'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, TrendingUp, Star, ChevronRight, Navigation } from 'lucide-react';
import type { MapTrail } from './types';
import { getTrailImage, getDifficultyColor, getDifficultyLabel, formatDistance, formatDuration } from './types';

interface Props {
  trail: MapTrail;
  isSelected: boolean;
  onClick: () => void;
  onPrepareClick?: (e: React.MouseEvent) => void;
}

export default function ExplorerListCard({ trail, isSelected, onClick }: Props) {
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);
  const dist = formatDistance(trail.distance_km);
  const dur = formatDuration(trail.duration_hours);
  const score = trail.adventure_score ? Math.round(trail.adventure_score) : null;

  return (
    <motion.article
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`group relative flex shrink-0 h-[84px] w-full gap-2.5 p-2.5 cursor-pointer transition-all duration-200 select-none ${
        isSelected
          ? 'ring-2 ring-[#17402C]/40 shadow-lg scale-[1.01]'
          : 'hover:scale-[1.01] shadow-xs hover:shadow-md'
      }`}
      style={{
        borderRadius: 22,
        background: isSelected
          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(251, 250, 246, 0.45) 100%)'
          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(251, 250, 246, 0.30) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: isSelected ? '1.5px solid rgba(23, 64, 44, 0.5)' : '1px solid rgba(255, 255, 255, 0.70)',
        boxShadow: isSelected
          ? '0 12px 36px -6px rgba(23, 64, 44, 0.18), inset 0 1px 1.5px rgba(255, 255, 255, 0.95)'
          : '0 4px 16px -2px rgba(23, 64, 44, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.85)',
      }}
    >
      {/* Vignette Photo Liquid Glass */}
      <div className="relative w-16 h-16 rounded-[14px] overflow-hidden shrink-0 bg-[#F1EDE6] border border-white/60">
        <img
          src={imgUrl}
          alt={trail.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span
          className="glass-capsule-btn text-[8.5px] font-bold !py-0 !px-1.5 absolute bottom-1 left-1 !text-white !border-transparent shadow-xs"
          style={{ backgroundColor: diffColor }}
        >
          {diffLabel}
        </span>
      </div>

      {/* Info & Metrics */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="font-display font-bold text-[#17402C] text-[12.5px] leading-tight line-clamp-1 group-hover:text-[#365233] transition-colors">
            {trail.name}
          </h3>
          <p className="text-[10.5px] font-medium text-[#5A7064] truncate flex items-center gap-1 mt-0.5">
            <MapPin size={9.5} className="shrink-0 text-[#17402C]/80" />
            <span>{trail.terrain_type || trail.network || 'Massif Alpin'}</span>
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between pt-1 border-t border-white/30">
          <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#365233]">
            <span className="flex items-center gap-0.5 font-semibold text-[#17402C]">
              <Navigation size={9} />
              {dist}
            </span>
            <span className="text-[#5A7064]/40">·</span>
            <span className="flex items-center gap-0.5 font-medium text-[#5A7064]">
              <Clock size={9} />
              {dur}
            </span>
            {trail.elevation_gain !== null && trail.elevation_gain !== undefined && (
              <>
                <span className="text-[#5A7064]/40">·</span>
                <span className="flex items-center gap-0.5 font-bold text-[#17402C]">
                  <TrendingUp size={9} />
                  +{Math.round(trail.elevation_gain)}m
                </span>
              </>
            )}
          </div>

          {score !== null ? (
            <div className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-[#17402C]">
              <Star size={10} className="text-[#C89A3B] fill-[#C89A3B]" />
              <span>{score}</span>
            </div>
          ) : (
            <div className="text-[9.5px] font-bold text-[#17402C] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              <ChevronRight size={11} />
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
