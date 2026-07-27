'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import CarnetView from '@/components/carnet/CarnetView';

export const dynamic = 'force-dynamic';

export default function CarnetPage() {
  const params = useParams();
  const carnetId = (params?.carnetId as string) || (params?.id as string);

  return <CarnetView carnetId={carnetId} />;
}
