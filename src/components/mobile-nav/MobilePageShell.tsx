'use client';

import React from 'react';

interface MobilePageShellProps {
  children: React.ReactNode;
}

/**
 * MobilePageShell — wrapper for mobile page content.
 * TopBar and BottomTabBar are rendered globally in layout.tsx.
 * This component only provides the correct padding/spacing.
 */
export default function MobilePageShell({
  children,
}: MobilePageShellProps) {
  return (
    <div
      style={{
        paddingBottom: 'calc(86px + env(safe-area-inset-bottom))',
        height: '100dvh',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {children}
    </div>
  );
}
