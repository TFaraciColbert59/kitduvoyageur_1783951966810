'use client';

import React from 'react';
import TopBar from './TopBar';
import BottomTabBar from './BottomTabBar';

interface MobilePageShellProps {
  children: React.ReactNode;
  showBack?: boolean;
  title?: string;
  cartCount?: number;
  notifCount?: number;
}

/**
 * MobilePageShell — centralized wrapper for ALL mobile pages.
 * Handles TopBar + safe-area padding + BottomTabBar automatically.
 * Use on every page that needs mobile layout.
 */
export default function MobilePageShell({
  children,
  showBack,
  title,
  cartCount = 0,
  notifCount = 0,
}: MobilePageShellProps) {
  return (
    <>
      <TopBar showBack={showBack} title={title} cartCount={cartCount} notifCount={notifCount} />
      <main
        id="main-content"
        style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top))',
          paddingBottom: 'calc(56px + env(safe-area-inset-bottom) + 16px)',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
      <BottomTabBar />
    </>
  );
}
