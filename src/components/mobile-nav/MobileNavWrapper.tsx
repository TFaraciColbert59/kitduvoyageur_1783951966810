'use client';

import React, { useState } from 'react';
import BottomTabBar from '@/components/mobile-nav/BottomTabBar';
import MobileDrawer from '@/components/mobile-nav/MobileDrawer';
import SearchOverlay from '@/components/search/SearchOverlay';
import LkvIcon from '@/components/ui/LkvIcon';

export default function MobileNavWrapper() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Floating hamburger — only mobile, opens drawer */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden"
        aria-label="Menu"
        style={{
          position: 'fixed',
          top: 'calc(12px + env(safe-area-inset-top))',
          left: '12px',
          zIndex: 45,
          width: '38px',
          height: '38px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(11,31,23,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0B1F17',
          cursor: 'pointer',
          outline: 'none',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <LkvIcon name="menu" size={20} />
      </button>
      <BottomTabBar />
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <SearchOverlay />
    </>
  );
}
