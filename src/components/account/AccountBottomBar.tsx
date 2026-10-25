'use client';

import React from 'react';
import { IOS27BottomBar, type IOS27BottomBarProps } from '@/components/navigation/IOS27BottomBar';

/**
 * Barre basse canonique Liquid Glass iOS 27 (48 px, 5 destinations canoniques, lentille 40 px avec physique ressort).
 * Re-exporte directement IOS27BottomBar avec détection de route dynamique et haptique Apple.
 */
export function AccountBottomBar(props: IOS27BottomBarProps) {
  return <IOS27BottomBar {...props} />;
}

export default AccountBottomBar;
