'use client';

import React, { useEffect, useRef, useCallback } from 'react';

/**
 * SpotlightTracker — wrapper client léger qui suit le curseur et met à jour
 * les variables CSS --mx / --my pour les effets de spotlight (.glass.spotlight).
 */
export default function SpotlightTracker({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '0%');
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} onPointerMove={onPointerMove} className={className}>
      {children}
    </div>
  );
}