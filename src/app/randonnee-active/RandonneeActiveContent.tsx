'use client';

import React from 'react';
import { HikingCockpitPage } from '@/features/hiking';

export default function RandonneeActiveContent({
  terrainEnabled = false,
}: {
  /** A13 (S7) — flag `terrain_live` résolu côté serveur. */
  terrainEnabled?: boolean;
}) {
  return <HikingCockpitPage terrainEnabled={terrainEnabled} />;
}
