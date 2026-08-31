'use client';

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { ChevronDownAnimated, ChevronUpAnimated } from '@/components/icons';
import type { MapTrail } from './types';
import ExplorerListCard from './ExplorerListCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ExplorerMobileSheetProps {
  trails: MapTrail[];
  selectedTrailId: string | null;
  count: number;
  expanded: boolean;
  onExpandChange: (v: boolean) => void;
  onTrailClick: (trail: MapTrail) => void;
}

const PEEK_VH = 27;
const EXPANDED_VH = 62;

export default function ExplorerMobileSheet({
  trails,
  selectedTrailId,
  count,
  expanded,
  onExpandChange,
  onTrailClick,
}: ExplorerMobileSheetProps) {
  const { triggerHaptic } = useHapticFeedback();
  const dragStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - e.changedTouches[0].clientY;
      if (delta > 40) {
        if (!expanded) triggerHaptic('medium');
        onExpandChange(true);
      } else if (delta < -40) {
        if (expanded) triggerHaptic('light');
        onExpandChange(false);
      }
      dragStartY.current = null;
    },
    [expanded, onExpandChange, triggerHaptic]
  );

  const toggle = useCallback(() => {
    const next = !expanded;
    triggerHaptic(next ? 'medium' : 'light');
    onExpandChange(next);
  }, [expanded, onExpandChange, triggerHaptic]);

  const listMaxHeight = expanded ? `${EXPANDED_VH - 14}vh` : '11vh';

  return (
    <motion.div
      className="block md:hidden fixed left-2.5 right-2.5 z-[800] pointer-events-auto flex flex-col"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)' }}
      initial={false}
      animate={{ height: expanded ? `${EXPANDED_VH}vh` : `${PEEK_VH}vh` }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Liste des sentiers"
    >
      {/* Sheet surface Liquid Glass */}
      <div
        className="absolute inset-0 rounded-[26px] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.28) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.60)',
          boxShadow: '0 20px 50px -12px rgba(23,64,44, 0.20), inset 0 1.5px 1px rgba(255, 255, 255, 0.9)',
        }}
      />

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
        <div className="w-10 h-1.5 rounded-full bg-[#17402C]/25" />
      </div>

      {/* Header pill */}
      <div className="relative z-10 flex items-center justify-between px-3 py-1 shrink-0">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#17402C]">
          <MapPin size={11} className="text-[#17402C]" />
          <span>Sentiers ({count})</span>
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-mono text-[#5A7064]">
            {expanded ? 'Replier' : 'Glisser pour explorer'}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? 'Replier la liste' : 'Déplier la liste'}
            className="w-7 h-7 rounded-full bg-white/70 hover:bg-white border border-white/60 text-[#17402C] flex items-center justify-center transition-all active:scale-90 "
          >
            {expanded ? <ChevronDownAnimated size={12} /> : <ChevronUpAnimated size={12} />}
          </button>
        </div>
      </div>

      {/* List */}
      <div
        className="relative z-10 overflow-y-auto pb-2 px-2 flex flex-col gap-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: listMaxHeight }}
      >
        {trails.length === 0 ? (
          <div className="py-6 text-center flex flex-col items-center gap-1.5">
            <p className="text-[11px] font-bold text-[#17402C]">Aucun itinéraire trouvé</p>
            <p className="text-[10px] text-[#5A7064]">Essayez d'élargir vos filtres</p>
          </div>
        ) : (
          trails.slice(0, 60).map((trail) => (
            <ExplorerListCard
              key={trail.id}
              trail={trail}
              isSelected={selectedTrailId === trail.id}
              onClick={() => onTrailClick(trail)}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}
