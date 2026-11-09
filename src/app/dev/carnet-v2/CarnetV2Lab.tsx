'use client';

import React, { useMemo } from 'react';
import { CarnetScreenV2 } from '@/components/carnet/v2/CarnetScreenV2';
import { buildEcrinsDetail } from '@/features/carnet/detail/fixtures/ecrinsDetail';

export function CarnetV2Lab({ role, empty }: { role: 'participant' | 'visitor'; empty: boolean }) {
  const detail = useMemo(() => buildEcrinsDetail({ role, empty }), [role, empty]);
  return <CarnetScreenV2 detail={detail} />;
}
