import React from 'react';
import { getTrails } from '@/lib/queries/trails';
import { getAtlasDensity, type AtlasDensity } from '@/lib/queries/atlas';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { resolveUnifiedMapEnabled } from '@/lib/atlas/rollout';
import ExplorerClient from '@/components/explorer/ExplorerClient';
import type { MapTrail } from '@/components/explorer/types';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface ExplorerPageProps {
  searchParams?: Promise<{ atlas?: string }>;
}

export default async function ExplorerPage({ searchParams }: ExplorerPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  // CHANTIER ATLAS Phase 7 — rollout progressif via le système de flags existant.
  // `?atlas=1` reste le switch interne (tests/équipe) ; le flag global gouverne
  // le trafic réel et permet un rollback instantané (moteur legacy conservé).
  const flags = await currentFeatureFlags();
  const unifiedMap = resolveUnifiedMapEnabled({
    flagEnabled: flags.explorer_unified_map_enabled,
    atlasParam: resolvedSearchParams?.atlas,
  });

  // P1 — chargement serveur parallèle : sentiers initiaux et densité ATLAS ne
  // dépendent pas l'un de l'autre. Chaque source garde son propre repli explicite.
  const initialTrailsPromise = getTrails({
    minLat: 45.9237 - 0.018,
    maxLat: 45.9237 + 0.018,
    minLng: 6.8694 - 0.026,
    maxLng: 6.8694 + 0.026,
    limit: 50,
  }).catch((error) => {
    console.error('[ExplorerPage] Error fetching initial trails:', error);
    return [] as MapTrail[];
  });

  // Paliers continent/région : densités matérialisées (Phase 1), uniquement utile
  // au moteur unifié — aucun coût sur le chemin legacy Leaflet.
  const atlasDensityPromise: Promise<AtlasDensity> = unifiedMap
    ? getAtlasDensity().catch((error) => {
        console.error('[ExplorerPage] Error fetching atlas density:', error);
        return { countries: [], cells: [] } satisfies AtlasDensity;
      })
    : Promise.resolve({ countries: [], cells: [] });

  const [initialTrails, atlasDensity] = await Promise.all([
    initialTrailsPromise,
    atlasDensityPromise,
  ]);

  return (
    <ExplorerClient
      initialTrails={initialTrails}
      unifiedMap={unifiedMap}
      atlasDensity={atlasDensity}
    />
  );
}
