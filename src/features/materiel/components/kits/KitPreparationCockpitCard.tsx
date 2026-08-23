'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import type { KitListItem } from '@/features/materiel/services/getKits';

/** Donut SVG animé à l'entrée via strokeDashoffset (GPU-only, transform + opacity). */
function SvgDonut({ pct }: { pct: number }) {
  const size = 44;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circumference - (clamped / 100) * circumference;
  const circleRef = useRef<SVGCircleElement>(null);

  // Animation strokeDashoffset à l'entrée (CSS transition GPU-friendly)
  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    // Départ depuis la valeur pleine (cercle vide)
    el.style.strokeDashoffset = String(circumference);
    // Force reflow pour que la transition démarre bien
    void el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.strokeDashoffset = String(offset);
  }, [circumference, offset]);

  return (
    <div
      className="relative shrink-0 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center"
      role="img"
      aria-label={`Préparation du kit : ${Math.round(pct)}%`}
    >
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(23, 64, 44, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={pct >= 100 ? '#2D6B4A' : '#5B7F55'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-bold text-[9px] md:text-[10px] text-[#17402C]"
        aria-hidden="true"
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

interface Props {
  kit: KitListItem | null;
}

/** Widget 3 — Statut de Préparation du Kit avec donut animé à l'entrée et aria complet. */
export function KitPreparationCockpitCard({ kit }: Props) {
  const items = kit?.items ?? [];
  const readyCount = items.filter((i) => !!i.product_ownership_id).length;
  const pendingCount = items.length - readyCount;
  const pct = items.length > 0 ? (readyCount / items.length) * 100 : 100;
  const isComplete = pct >= 100;

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="prep-title" className="p-2.5 sm:p-3 flex flex-col items-center justify-between text-center h-full min-h-0">
      <div className="w-full flex items-center justify-center pr-8 md:pr-10 shrink-0 mb-0.5">
        <p className="truncate text-[10px] md:text-xs font-semibold text-[#17402C] font-body text-center">
          Statut · Préparation
        </p>
      </div>

      <div className="flex items-center justify-center gap-2.5 my-auto min-h-0 w-full">
        <SvgDonut pct={pct} />
        <div className="flex flex-col items-start justify-center gap-0.5 min-w-0 text-left">
          <motion.span
            key={readyCount}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[11px] font-bold text-[#17402C] truncate leading-tight"
          >
            {readyCount} prêt(s)
          </motion.span>
          <span className={`text-[9px] truncate leading-tight ${isComplete ? 'text-[#2D6B4A] font-semibold' : 'text-[#5A7064]'}`}>
            {pendingCount > 0 ? `${pendingCount} en commande` : 'Kit complet ✓'}
          </span>
        </div>
      </div>

      <div className="text-[8px] md:text-[9px] font-semibold uppercase tracking-wider text-[#365233] text-center shrink-0">
        {readyCount}/{items.length} équipement(s)
      </div>
    </GlassCard>
  );
}
