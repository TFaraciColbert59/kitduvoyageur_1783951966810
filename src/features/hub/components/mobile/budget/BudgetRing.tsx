'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface BudgetRingProps {
  pct: number;
  over?: boolean;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

export function BudgetRing({ pct, over = false, size = 112, stroke = 10, children }: BudgetRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lkv-forest-100)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? 'var(--lkv-danger)' : 'var(--lkv-primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? targetOffset : circumference}
          style={{ transition: 'stroke-dashoffset 700ms var(--ease-glass)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export default BudgetRing;
