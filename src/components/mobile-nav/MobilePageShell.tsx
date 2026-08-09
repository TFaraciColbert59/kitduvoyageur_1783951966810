'use client';

import React, { useEffect } from 'react';

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
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    // Initial check
    handleChange(mediaQuery);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <div
      style={{
        paddingBottom: 'calc(86px + env(safe-area-inset-bottom))',
        minHeight: '100dvh',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {children}
    </div>
  );
}
