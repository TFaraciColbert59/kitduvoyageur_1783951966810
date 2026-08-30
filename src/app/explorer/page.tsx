import React from 'react';
import { getTrails } from '@/lib/queries/trails';
import ExplorerClient from '@/components/explorer/ExplorerClient';
import type { MapTrail } from '@/components/explorer/types';

export const revalidate = 60;

export default async function ExplorerPage() {
  let initialTrails: MapTrail[] = [];
  try {
    // Initial 2km bounds around Chamonix [45.9237, 6.8694]
    initialTrails = await getTrails({
      minLat: 45.9237 - 0.018,
      maxLat: 45.9237 + 0.018,
      minLng: 6.8694 - 0.026,
      maxLng: 6.8694 + 0.026,
      limit: 50,
    });
  } catch (error) {
    console.error('[ExplorerPage] Error fetching initial trails:', error);
  }

  return <ExplorerClient initialTrails={initialTrails} />;
}
