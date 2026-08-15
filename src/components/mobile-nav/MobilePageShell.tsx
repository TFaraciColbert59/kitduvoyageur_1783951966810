'use client';

import React from 'react';

interface MobilePageShellProps {
  children: React.ReactNode;
  /**
   * Couleur de fond de la page mobile. Par défaut : le token global
   * `--background` (#F5F3EE), identique au rendu desktop.
   */
  background?: string;
}

/**
 * MobilePageShell — wrapper for mobile page content.
 * TopBar and BottomTabBar are rendered globally in layout.tsx.
 * This component only provides the correct padding/spacing.
 * (Pas de bascule mode sombre : les fonds mobiles restent clairs.)
 */
export default function MobilePageShell({
  children,
  background = 'var(--background)',
}: MobilePageShellProps) {
  return (
    <div
      style={{
        background,
        paddingBottom: 'calc(76px + env(safe-area-inset-bottom))',
        minHeight: '100dvh',
        // NOTE: pas de overflowY ici — il casserait position: sticky (tabs Compte).
        overflowX: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
