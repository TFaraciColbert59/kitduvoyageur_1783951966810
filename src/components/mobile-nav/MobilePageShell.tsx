'use client';

import React from 'react';
import AppShell, { type AppShellProps } from '@/components/shell/AppShell';

export type MobilePageShellProps = AppShellProps;

/**
 * MobilePageShell — wrapper canonique pour les pages mobiles (délégué vers AppShell).
 */
export default function MobilePageShell(props: MobilePageShellProps) {
  return <AppShell {...props} />;
}
