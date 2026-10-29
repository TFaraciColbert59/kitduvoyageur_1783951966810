'use client';

import React from 'react';
import FloatingLiquidTabBar from '@/components/mobile-nav/FloatingLiquidTabBar';

/**
 * AccountBottomBar a été unifiée avec la barre système unique
 * Apple Liquid Glass (iOS 26/27).
 */
export function AccountBottomBar(_props?: Record<string, unknown>) {
  return <FloatingLiquidTabBar />;
}

export default AccountBottomBar;
