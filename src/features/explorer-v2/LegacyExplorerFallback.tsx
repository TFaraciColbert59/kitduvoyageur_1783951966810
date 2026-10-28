'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import type { MapTrail } from '@/components/explorer/types';
import type { AtlasDensity } from '@/lib/queries/atlas';

/**
 * Chemin legacy de `/explorer` (moteur ATLAS d'avant l'Explorer v2).
 *
 * Le composant est chargé **en différé** : tant que le flag
 * `explorer_v2_enabled` est actif, ses 300 Ko ne font pas partie du First Load
 * JS de la route (budget 170 Ko, 02_ARCHITECTURE §9). Il disparaît en phase 10
 * (P10-04).
 */
const ExplorerClient = dynamic(() => import('@/components/explorer/ExplorerClient'), {
  ssr: false,
  loading: () => (
    <div
      style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#E9EEE7' }}
      aria-busy="true"
      aria-label="Chargement de la carte"
    >
      <span
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 42% 34%, #E4EEEA, #C8D8CD 70%)',
        }}
      />
    </div>
  ),
});

export interface LegacyExplorerFallbackProps {
  initialTrails: MapTrail[];
  unifiedMap: boolean;
  atlasDensity: AtlasDensity;
}

export default function LegacyExplorerFallback(props: LegacyExplorerFallbackProps) {
  return (
    <ExplorerClient
      initialTrails={props.initialTrails}
      unifiedMap={props.unifiedMap}
      atlasDensity={props.atlasDensity}
    />
  );
}
