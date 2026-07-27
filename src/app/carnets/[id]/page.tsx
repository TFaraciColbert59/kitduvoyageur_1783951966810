'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import CarnetView from '@/components/carnet/CarnetView';

export const dynamic = 'force-dynamic';

export default function CarnetDetailPage() {
  const params = useParams();
  const carnetId = (params?.id as string) || (params?.carnetId as string);

  return <CarnetView carnetId={carnetId} />;
}
