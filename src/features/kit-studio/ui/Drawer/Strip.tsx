'use client';
import type { ReactNode } from 'react';

/** Barre basse du tiroir (30 px) : capsules à gauche et à droite. */
export function Strip({ children }: { children: ReactNode }) {
  return <div className="ks-dstrip">{children}</div>;
}
