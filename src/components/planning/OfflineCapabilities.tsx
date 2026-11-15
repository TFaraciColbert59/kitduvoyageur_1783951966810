'use client';

import React from 'react';
import { Badge } from '@/components/ui';
import type { StageOfflineCapabilities } from '@/features/planning';
import { offlineLabel } from './format';

const OFFLINE_KEYS: Array<keyof StageOfflineCapabilities> = [
  'traceReady',
  'guidanceReady',
  'mapReady',
  'searchReady',
  'rerouteReady',
];

export function OfflineCapabilitiesList({ offline }: { offline: StageOfflineCapabilities }) {
  return (
    <div className="flex flex-wrap gap-[var(--space-1)]" aria-label="Capacités hors-ligne">
      {OFFLINE_KEYS.map((key) => (
        <Badge key={key} tone={offline[key] ? 'sage' : 'stone'}>
          {offlineLabel(key)} {offline[key] ? 'prêt' : 'absent'}
        </Badge>
      ))}
    </div>
  );
}

export default OfflineCapabilitiesList;
