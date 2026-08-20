'use client';

/**
 * LKDV — Mon Matériel : cadre global (raccord layout Server → UI client).
 * Le layout `src/app/mon-materiel/layout.tsx` est un Server Component ; pour
 * respecter le plan (1.2) il délègue à ce client component qui monte :
 *  • AnimatedBackground (fond Ken Burns / vidéo, prefers-reduced-motion safe)
 *  • useMonMaterielMigration (migration storage v3, exécutée UNE seule fois)
 *  • children (la page = MonMaterielGrid orchestré)
 */

import React from 'react';
import { AnimatedBackground } from './AnimatedBackground';
import { useMonMaterielMigration } from '@/hooks/useMonMaterielMigration';

export function CockpitFrame({ children }: { children: React.ReactNode }) {
  useMonMaterielMigration();

  return (
    <>
      <AnimatedBackground />
      {children}
    </>
  );
}