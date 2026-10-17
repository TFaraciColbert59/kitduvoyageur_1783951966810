import React from 'react';
import { Carte3DView } from '@/features/carte-3d/components/Carte3DView';

export const dynamic = 'force-dynamic';

interface Carte3DPageProps {
  searchParams?: Promise<{ trail?: string }>;
}

export default async function Carte3DPage({ searchParams }: Carte3DPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTrailId = resolvedParams?.trail;

  return <Carte3DView initialTrailId={initialTrailId} />;
}
