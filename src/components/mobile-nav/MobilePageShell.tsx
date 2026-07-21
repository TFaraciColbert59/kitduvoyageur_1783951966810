'use client';

import React from 'react';

interface MobilePageShellProps {
  children: React.ReactNode;
  showBack?: boolean;
  title?: string;
  cartCount?: number;
  notifCount?: number;
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
        paddingTop: 'calc(52px + env(safe-area-inset-top))',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom) + 8px)',
        minHeight: '100dvh',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {children}
    </div>
  );
}
