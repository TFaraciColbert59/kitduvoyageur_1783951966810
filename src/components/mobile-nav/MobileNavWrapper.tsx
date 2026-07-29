'use client';

import React, { useState } from 'react';
import TopBar from '@/components/mobile-nav/TopBar';
import BottomTabBar from '@/components/mobile-nav/BottomTabBar';
import MobileDrawer from '@/components/mobile-nav/MobileDrawer';

export default function MobileNavWrapper() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <TopBar onMenuOpen={() => setDrawerOpen(true)} />
      <BottomTabBar />
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
