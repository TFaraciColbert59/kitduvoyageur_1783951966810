import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTrails } from '@/lib/queries/trails';
import { getAtlasDensity, type AtlasDensity } from '@/lib/queries/atlas';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { resolveUnifiedMapEnabled } from '@/lib/atlas/rollout';
import ExplorerClient from '@/components/explorer/ExplorerClient';
import type { MapTrail } from '@/components/explorer/types';
import ExplorerV2 from '@/features/explorer-v2/ExplorerV2';
import { isSceneName, sceneEnabled } from '@/features/explorer-v2/state/scenes';

export const metadata: Metadata = {
  title: 'Explorer · Le Kit du Voyageur',
  description:
    'Le globe, les pays, les régions et le sentier : carte 3D, points d’eau, refuges, itinéraires et activités en direct.',
  openGraph: {
    title: 'Explorer · Le Kit du Voyageur',
    description:
      'Du globe au sentier : repères réels, itinéraires OSM, points d’eau et suivi d’activité.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface ExplorerPageProps {
  searchParams?: Promise<{ atlas?: string; v2?: string; scene?: string; lat?: string; lng?: string }>;
}

/** Centre approximatif fourni par le réseau de diffusion (jamais bloquant). */
async function approximateCenter(): Promise<[number, number] | null> {
  try {
    const h = await headers();
    const lat = Number.parseFloat(h.get('x-vercel-ip-latitude') ?? '');
    const lng = Number.parseFloat(h.get('x-vercel-ip-longitude') ?? '');
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return [lng, lat];
    }
  } catch {
    /* aucun en-tête géographique : le client demandera la position */
  }
  return null;
}

export default async function ExplorerPage({ searchParams }: ExplorerPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flags = await currentFeatureFlags();

  // Explorer v2 : piloté par le flag `explorer_v2_enabled` ; `?v2=1` reste le
  // commutateur interne (développement, tests, recette) comme `?atlas=1` hier.
  const v2Enabled =
    flags.explorer_v2_enabled ||
    (process.env.NODE_ENV !== 'production' && resolvedSearchParams?.v2 === '1') ||
    // Recette sur build de production (CI, `next start`) : jamais actif en prod.
    (process.env.EXPLORER_V2_E2E === '1' && resolvedSearchParams?.v2 === '1');

  if (v2Enabled) {
    const scene =
      sceneEnabled() && resolvedSearchParams?.scene && isSceneName(resolvedSearchParams.scene)
        ? resolvedSearchParams.scene
        : null;

    const queryLat = Number.parseFloat(resolvedSearchParams?.lat ?? '');
    const queryLng = Number.parseFloat(resolvedSearchParams?.lng ?? '');
    const initialCenter =
      Number.isFinite(queryLat) && Number.isFinite(queryLng) && Math.abs(queryLat) <= 90
        ? ([queryLng, queryLat] as [number, number])
        : await approximateCenter();

    return <ExplorerV2 initialScene={scene} initialCenter={initialCenter} />;
  }

  // ── Legacy (supprimé en phase 10 après la gate finale) ────────────────────
  const unifiedMap = resolveUnifiedMapEnabled({
    flagEnabled: flags.explorer_unified_map_enabled,
    atlasParam: resolvedSearchParams?.atlas,
  });

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

  const atlasDensityPromise: Promise<AtlasDensity> = unifiedMap
    ? getAtlasDensity().catch((error) => {
        console.error('[ExplorerPage] Error fetching atlas density:', error);
        return { countries: [], cells: [] } satisfies AtlasDensity;
      })
    : Promise.resolve({ countries: [], cells: [] });

  const [initialTrails, atlasDensity] = await Promise.all([initialTrailsPromise, atlasDensityPromise]);

  return (
    <ExplorerClient initialTrails={initialTrails} unifiedMap={unifiedMap} atlasDensity={atlasDensity} />
  );
}
