'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  Navigation,
  Clock,
  TrendingUp,
  Backpack,
  FileText,
  List,
  Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { MapTrail } from './types';
import {
  getDifficultyColor,
  formatDistance,
  formatDuration,
  getTrailImage,
} from './types';
import ExplorerListCard from './ExplorerListCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ExplorerMobileHikeCarouselProps {
  trails: MapTrail[];
  selectedTrailId: string | null;
  count: number;
  onSelectTrail: (trail: MapTrail) => void;
  onOpenDetail: (trail: MapTrail) => void;
}

export default function ExplorerMobileHikeCarousel({
  trails,
  selectedTrailId,
  count,
  onSelectTrail,
  onOpenDetail,
}: ExplorerMobileHikeCarouselProps) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');

  // Auto-scroll the horizontal carousel to center the selected trail card
  useEffect(() => {
    if (!selectedTrailId || viewMode !== 'carousel' || !carouselScrollRef.current) return;
    const activeEl = carouselScrollRef.current.querySelector<HTMLElement>(`[data-trail-id="${selectedTrailId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedTrailId, viewMode]);

  const toggleViewMode = useCallback(() => {
    triggerHaptic('medium');
    setViewMode((prev) => (prev === 'carousel' ? 'list' : 'carousel'));
  }, [triggerHaptic]);

  if (trails.length === 0) return null;

  return (
    <div
      className="block md:hidden fixed left-0 right-0 z-[800] pointer-events-none"
      style={{ bottom: 'calc(var(--bottom-tab-base-height, 68px) + 8px)' }}
    >
      {/* ── TOP FLOATING PILL (Mode Switch & Counter) ── */}
      <div className="flex items-center justify-between px-3.5 mb-1.5 pointer-events-auto">
        <div className="glass-capsule-btn text-xs font-bold !py-1 !px-3">
          <MapPin size={12} className="text-[#17402C]" />
          <span>{count} randonnées</span>
        </div>

        <button
          type="button"
          onClick={toggleViewMode}
          className="glass-capsule-btn text-xs font-bold !py-1 !px-3 active:scale-95 transition-all cursor-pointer"
        >
          {viewMode === 'carousel' ? (
            <>
              <List size={12} />
              <span>Voir liste</span>
            </>
          ) : (
            <>
              <Layers size={12} />
              <span>Mode cartes</span>
            </>
          )}
        </button>
      </div>

      {/* ── MODE 1: HORIZONTAL SWIPEABLE CAROUSEL (NATIVE APP FEEL) ── */}
      {viewMode === 'carousel' && (
        <div
          ref={carouselScrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-3.5 pb-1 pointer-events-auto no-scrollbar"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            scrollPaddingLeft: '14px',
            scrollPaddingRight: '28px',
          }}
        >
          {trails.slice(0, 40).map((trail) => {
            const isSelected = String(trail.id) === String(selectedTrailId);

            return (
              <div
                key={trail.id}
                data-trail-id={trail.id}
                onClick={() => {
                  triggerHaptic('selection');
                  onSelectTrail(trail);
                }}
                className="snap-start shrink-0 w-[calc(100vw-68px)] max-w-[290px] rounded-[22px] overflow-hidden transition-all duration-200 cursor-pointer"
                style={{
                  background: isSelected
                    ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(251, 250, 246, 0.45) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(251, 250, 246, 0.30) 100%)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: isSelected ? '1.5px solid rgba(23, 64, 44, 0.5)' : '1px solid rgba(255, 255, 255, 0.65)',
                  boxShadow: isSelected
                    ? '0 12px 36px -6px rgba(23, 64, 44, 0.20), inset 0 1px 1.5px rgba(255, 255, 255, 0.95)'
                    : '0 8px 24px -4px rgba(23, 64, 44, 0.10), inset 0 1px 1px rgba(255, 255, 255, 0.85)',
                }}
              >
                {/* Photo Header */}
                <div className="relative h-20 w-full overflow-hidden bg-stone-200">
                  <img
                    src={getTrailImage(trail.id)}
                    alt={trail.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Difficulty Badge */}
                  {trail.difficulty && (
                    <span
                      className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-2xs backdrop-blur-md"
                      style={{ backgroundColor: getDifficultyColor(trail.difficulty) }}
                    >
                      {trail.difficulty}
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-2.5 flex flex-col gap-1.5">
                  <h4 className="font-display font-bold text-xs text-[#17402C] truncate">
                    {trail.name}
                  </h4>

                  {/* Key Metrics */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#365233]">
                    <span className="flex items-center gap-0.5 font-bold text-[#17402C]">
                      <Navigation size={9} />
                      {formatDistance(trail.distance_km)}
                    </span>
                    <span className="text-[#5A7064]/40">·</span>
                    <span className="flex items-center gap-0.5 text-[#5A7064]">
                      <Clock size={9} />
                      {formatDuration(trail.duration_hours)}
                    </span>
                    {trail.elevation_gain != null && (
                      <>
                        <span className="text-[#5A7064]/40">·</span>
                        <span className="flex items-center gap-0.5 font-bold text-[#17402C]">
                          <TrendingUp size={9} />
                          +{Math.round(trail.elevation_gain)}m
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#17402C]/06">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        router.push(`/preparer-randonnee?routeId=${trail.id}`);
                      }}
                      className="glass-capsule-btn primary flex-1 !min-h-[32px] text-xs font-bold shadow-xs active:scale-[0.97] transition-all cursor-pointer"
                    >
                      <span>Préparer</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        onOpenDetail(trail);
                      }}
                      className="glass-circle-btn w-8.5 h-8.5 shrink-0 active:scale-[0.97] transition-all cursor-pointer"
                      title="Voir la fiche complète"
                      aria-label="Voir la fiche complète"
                    >
                      <FileText size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Trailing safe spacer so last card is never clipped */}
          <div className="shrink-0 w-4 h-1 pointer-events-none" aria-hidden="true" />
        </div>
      )}

      {/* ── MODE 2: VERTICAL EXPANDABLE LIST SHEET ── */}
      {viewMode === 'list' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="mx-3 rounded-[24px] p-3 pointer-events-auto max-h-[50vh] flex flex-col shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.70) 0%, rgba(251, 250, 246, 0.40) 100%)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            boxShadow: '0 20px 50px -12px rgba(23, 64, 44, 0.2), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
          }}
        >
          <div className="flex items-center justify-between pb-2 mb-1 px-1 border-b border-[#17402C]/5">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#17402C]">
              Tous les sentiers ({trails.length})
            </span>
            <button
              type="button"
              onClick={toggleViewMode}
              className="text-xs font-bold text-[#5A7064] hover:text-[#17402C]"
            >
              Fermer ✕
            </button>
          </div>

          <div className="overflow-y-auto no-scrollbar flex flex-col gap-1.5 pr-0.5">
            {trails.map((trail) => (
              <ExplorerListCard
                key={trail.id}
                trail={trail}
                isSelected={String(selectedTrailId) === String(trail.id)}
                onClick={() => {
                  onSelectTrail(trail);
                  onOpenDetail(trail);
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
