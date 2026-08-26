import React from 'react';
import { getTrails } from '@/lib/queries/trails';
import ExplorerClient from '@/components/explorer/ExplorerClient';
import type { MapTrail } from '@/components/explorer/types';

export const revalidate = 60;

export default async function ExplorerPage() {
  let initialTrails: MapTrail[] = [];
  try {
    initialTrails = await getTrails();
  } catch (error) {
    console.error('[ExplorerPage] Error fetching initial trails:', error);
  }

  return <ExplorerClient initialTrails={initialTrails} />;
}
