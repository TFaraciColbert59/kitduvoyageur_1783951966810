'use client';

import React from 'react';
import CompteBackground from '@/components/compte/CompteBackground';

interface MobilePageShellProps {
  children: React.ReactNode;
  /**
   * Couleur de fond de la page mobile.
   */
  background?: string;
  /**
   * Activer le mode fond immersif : la canopée dorée CompteBackground est posée en fixe derrière.
   */
  videoBackground?: boolean;
}

/**
 * MobilePageShell — wrapper pour les pages mobiles avec fond canopée immersif unifié.
 */
export default function MobilePageShell({
  children,
  background = 'transparent',
  videoBackground = true,
}: MobilePageShellProps) {
  return (
    <div
      style={{
        background: videoBackground ? 'transparent' : background,
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
        minHeight: '100dvh',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {videoBackground && <CompteBackground />}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
