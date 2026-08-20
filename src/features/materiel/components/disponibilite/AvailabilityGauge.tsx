'use client';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

/** W-A-1 AvailabilityGauge — jauge circulaire animée. */
export function AvailabilityGauge({ availableCount, total }: { availableCount: number; total: number }) {
  const pct = total > 0 ? (availableCount / total) * 100 : 100;
  const spring = useSpring(0, { stiffness: 120, damping: 20 });
  const strokeDashoffset = useTransform(spring, (v) => 2 * Math.PI * 32 * (1 - v / 100));

  useEffect(() => { spring.set(pct); }, [pct, spring]);

  return (
    <div className="relative h-[72px] w-[72px]" role="img" aria-label={`${availableCount} sur ${total} objets disponibles`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r="32" fill="none" stroke="var(--stone-200)" strokeWidth="8" />
        <motion.circle
          cx="36" cy="36" r="32" fill="none" stroke="var(--sage-500)" strokeWidth="8"
          strokeDasharray={2 * Math.PI * 32}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-semibold text-[15px] tabular-nums">
        {availableCount}/{total}
      </span>
    </div>
  );
}
