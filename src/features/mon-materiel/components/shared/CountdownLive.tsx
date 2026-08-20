'use client';
/**
 * LKDV — CountdownLive : affiche "J-x" en temps reel.
 * Met a jour chaque minute. Si date passee -> "Aujourd'hui".
 */
import React from 'react';

interface CountdownLiveProps {
  targetDate: string; // ISO date string YYYY-MM-DD
  className?: string;
}

export function CountdownLive({ targetDate, className = '' }: CountdownLiveProps) {
  const compute = React.useCallback(() => {
    const now = new Date();
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
    if (diff <= 0) return 'Aujourd\u2019hui';
    return `J-${diff}`;
  }, [targetDate]);
  const [label, setLabel] = React.useState(compute);
  React.useEffect(() => {
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 60_000);
    return () => clearInterval(id);
  }, [compute]);
  return <span className={className}>{label}</span>;
}