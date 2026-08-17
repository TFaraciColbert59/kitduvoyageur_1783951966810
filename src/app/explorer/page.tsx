import React from 'react';
import { getTrails } from '@/lib/queries/trails';
import ExplorerClient from '@/components/explorer/ExplorerClient';

export const revalidate = 60;

export default async function ExplorerPage() {
  const initialTrails = await getTrails();

  return <ExplorerClient initialTrails={initialTrails} />;
}
