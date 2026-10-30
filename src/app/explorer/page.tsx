import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
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

export const dynamic = 'force-dynamic';

interface ExplorerPageProps {
  searchParams?: Promise<{ v2?: string; scene?: string; lat?: string; lng?: string }>;
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

/**
 * `/explorer` sert l'Explorer v2 (P10-04 : le moteur legacy est supprimé).
 *
 * Le flag `explorer_v2_enabled` reste lu pour la traçabilité du rollout : à 0 %,
 * la page renvoie quand même v2 — l'ancien moteur n'existe plus, et un retour
 * arrière se fait par redéploiement du commit précédent.
 */
export default async function ExplorerPage({ searchParams }: ExplorerPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flags = await currentFeatureFlags();
  if (!flags.explorer_v2_enabled) {
    console.warn('[explorer] flag explorer_v2_enabled à 0 — v2 servi quand même (legacy supprimé)');
  }

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
